"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Edit3, KeyRound, Mail, Save, Trash2 } from "lucide-react";
import type { Role } from "@/lib/client-types";

type UserRow = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  area?: string | null;
  position?: string | null;
  active: boolean;
  mustChangePassword: boolean;
};

type UserDraft = {
  email: string;
  fullName: string;
  role: Role;
  area: string;
  position: string;
  password: string;
  sendAccess: boolean;
  active: boolean;
};

type PresenceRow = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  lastSeenAt: string;
  lastActivity?: string | null;
};

function emptyUserDraft(): UserDraft {
  return {
    email: "",
    fullName: "",
    role: "lector",
    area: "Planificacion y Adquisiciones",
    position: "",
    password: "",
    sendAccess: false,
    active: true
  };
}

function shortDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santiago"
  }).format(new Date(value));
}

export function UsersAdminPanel({ headers }: { headers: Record<string, string> }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<PresenceRow[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [draft, setDraft] = useState<UserDraft>(emptyUserDraft());
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [createdPassword, setCreatedPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    const [res, presenceRes] = await Promise.all([
      fetch("/api/users", { headers }),
      fetch("/api/presence", { headers })
    ]);
    if (!res.ok) {
      setError("No se pudieron cargar los usuarios.");
      return;
    }
    const data = await res.json();
    setUsers(data.users ?? []);
    setAreas(data.areas ?? []);
    if (presenceRes.ok) {
      const presenceData = await presenceRes.json();
      setOnlineUsers(presenceData.users ?? []);
    }
    setError("");
  }, [headers]);

  useEffect(() => {
    loadUsers().catch(() => setError("No se pudieron cargar los usuarios."));
  }, [loadUsers]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadUsers().catch(() => undefined);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [loadUsers]);

  function editUser(user: UserRow) {
    setEditing(user);
    setCreatedPassword("");
    setDraft({
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      area: user.area ?? "Planificacion y Adquisiciones",
      position: user.position ?? "",
      password: "",
      sendAccess: false,
      active: user.active
    });
  }

  function resetForm() {
    setEditing(null);
    setDraft(emptyUserDraft());
    setCreatedPassword("");
    setError("");
  }

  async function saveUser() {
    setBusy(true);
    setError("");
    setMessage("");
    setCreatedPassword("");
    const res = await fetch(editing ? `/api/users/${editing.id}` : "/api/users", {
      method: editing ? "PATCH" : "POST",
      headers,
      body: JSON.stringify({
        email: draft.email,
        fullName: draft.fullName,
        role: draft.role,
        area: draft.area,
        position: draft.position,
        password: draft.password || null,
        sendAccess: draft.sendAccess,
        active: draft.active
      })
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar el usuario. Revisa duplicados y campos obligatorios.");
      return;
    }
    setEditing(null);
    setDraft(emptyUserDraft());
    if (data.initialPassword && (!draft.sendAccess || data.mailError)) setCreatedPassword(data.initialPassword);
    setMessage(data.mailError ? `${editing ? "Usuario actualizado" : "Usuario creado"}, pero no se pudo enviar el correo: ${data.mailError}` : editing ? "Usuario actualizado." : data.initialPassword && draft.sendAccess ? "Usuario creado y acceso enviado." : "Usuario creado.");
    await loadUsers();
  }

  async function sendAccess(user: UserRow) {
    if (!confirm(`Generar una nueva clave y enviarla a ${user.email}?`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    setCreatedPassword("");
    const res = await fetch(`/api/users/${user.id}/send-access`, { method: "POST", headers });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "No se pudo enviar el acceso.");
      return;
    }
    setMessage(`Nueva clave enviada a ${user.email}.`);
    await loadUsers();
  }

  async function deactivateUser(user: UserRow) {
    if (!confirm(`Desactivar usuario ${user.email}?`)) return;
    setBusy(true);
    setMessage("");
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE", headers });
    setBusy(false);
    if (!res.ok) {
      setError("No se pudo desactivar el usuario.");
      return;
    }
    setMessage("Usuario desactivado.");
    await loadUsers();
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <div className="border border-[var(--g2)] bg-white p-4">
        <div className="mb-4 border border-[var(--g2)] bg-[var(--g1)] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em]"><Activity size={14} />Usuarios activos</div>
          <div className="space-y-2">
            {onlineUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between gap-2 text-[11px]">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{user.fullName}</div>
                  <div className="truncate text-[10px] text-[var(--mut)]">{user.lastActivity ?? "Activo"} - {shortDateTime(user.lastSeenAt)}</div>
                </div>
                <span className="inline-flex h-2.5 w-2.5 shrink-0 bg-[var(--ok)]" title="Online" />
              </div>
            ))}
            {onlineUsers.length === 0 && <div className="text-xs text-[var(--mut)]">Sin usuarios activos en los ultimos minutos.</div>}
          </div>
        </div>

        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.06em]">{editing ? "Editar usuario" : "Nuevo usuario"}</div>
        <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Nombre</label>
        <input className="field mb-2" value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} />
        <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Email</label>
        <input className="field mb-2" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
        <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Area</label>
        <select className="field mb-2" value={draft.area} onChange={(event) => setDraft({ ...draft, area: event.target.value })}>
          {areas.map((area) => <option key={area} value={area}>{area}</option>)}
        </select>
        <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Cargo</label>
        <input className="field mb-2" value={draft.position} onChange={(event) => setDraft({ ...draft, position: event.target.value })} />
        <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Rol</label>
        <select className="field mb-2" value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as Role })}>
          <option value="admin">Admin</option>
          <option value="operador">Operador</option>
          <option value="lector">Lector</option>
        </select>
        <label className="mb-1 block text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Clave {editing ? "nueva opcional" : "opcional"}</label>
        <input className="field mb-2" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} placeholder="Vacio: genera por area" />
        <label className="mb-3 flex items-center gap-2 text-xs">
          <input type="checkbox" checked={draft.sendAccess} onChange={(event) => setDraft({ ...draft, sendAccess: event.target.checked })} />
          <span className="inline-flex items-center gap-1"><Mail size={13} />Enviar clave por correo</span>
        </label>
        <label className="mb-4 flex items-center gap-2 text-xs">
          <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
          Usuario activo
        </label>
        {createdPassword && <div className="mb-3 border-l-4 border-[var(--ok)] bg-[#eef8f1] p-2 text-xs">Clave inicial generada: <strong>{createdPassword}</strong></div>}
        {message && <div className="mb-3 border-l-4 border-[var(--ok)] bg-[#eef8f1] p-2 text-xs">{message}</div>}
        {error && <div className="mb-3 border-l-4 border-[var(--org)] bg-[#faece7] p-2 text-xs text-[#8b2500]">{error}</div>}
        <div className="flex gap-2">
          <button className="primary-button" disabled={busy} onClick={saveUser}><Save size={14} /> Guardar</button>
          <button className="thin-button" onClick={resetForm}>Limpiar</button>
        </div>
      </div>

      <div className="overflow-x-auto border border-[var(--g2)] bg-white">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[1.2fr_1.2fr_120px_110px_90px_150px] bg-[var(--blk)] px-3 py-2 text-[9px] uppercase tracking-[0.06em] text-white">
            <div>Usuario</div><div>Area</div><div>Cargo</div><div>Rol</div><div>Estado</div><div></div>
          </div>
          {users.map((user) => (
            <div key={user.id} className="grid grid-cols-[1.2fr_1.2fr_120px_110px_90px_150px] items-center border-t border-[var(--g2)] px-3 py-2 text-[11px]">
              <div>
                <div className="font-semibold">{user.fullName}</div>
                <div className="text-[10px] text-[var(--mut)]">{user.email}</div>
              </div>
              <div>{user.area ?? "-"}</div>
              <div className="truncate">{user.position ?? "-"}</div>
              <div><span className="status-badge status-pendiente">{user.role}</span></div>
              <div>{user.active ? "Activo" : "Inactivo"}</div>
              <div className="flex justify-end gap-2">
                <button className="thin-button p-2" disabled={busy || !user.active} onClick={() => sendAccess(user)} title="Generar y enviar nueva clave"><KeyRound size={13} /></button>
                <button className="thin-button p-2" onClick={() => editUser(user)} title="Editar usuario"><Edit3 size={13} /></button>
                <button className="thin-button p-2" disabled={!user.active} onClick={() => deactivateUser(user)} title="Desactivar usuario"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
          {users.length === 0 && <div className="p-4 text-xs text-[var(--mut)]">Sin usuarios creados.</div>}
        </div>
      </div>
    </section>
  );
}
