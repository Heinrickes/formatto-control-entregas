"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import { SideNav } from "@/components/side-nav";
import type { Role } from "@/lib/client-types";
import { auditActionLabel, auditDetailLines, auditDetailText } from "@/lib/audit-format";

type Session = { email: string; role: Role; name: string };
type AuditRow = {
  id: string;
  actorEmail: string;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  details?: unknown;
  createdAt: string;
};

function displayDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Santiago"
  }).format(new Date(value));
}

export default function BitacoraPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [userFilter, setUserFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("todos");
  const [dateFilter, setDateFilter] = useState("");
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const raw = window.localStorage.getItem("formatto-session");
    if (raw) setSession(JSON.parse(raw));
    const params = new URLSearchParams(window.location.search);
    setProjectFilter(params.get("project") ?? "");
    setLoaded(true);
  }, []);

  const role = session?.role ?? "lector";
  const headers = useMemo(() => ({ "Content-Type": "application/json", "x-formatto-role": role }), [role]);

  const loadAudit = useCallback(async () => {
    const params = new URLSearchParams();
    if (userFilter.trim()) params.set("user", userFilter.trim());
    if (projectFilter.trim()) params.set("project", projectFilter.trim());
    if (actionFilter !== "todos") params.set("action", actionFilter);
    if (dateFilter) params.set("date", dateFilter);
    const res = await fetch(`/api/audit?${params.toString()}`, { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error ?? "No se pudo cargar la bitacora.");
      return;
    }
    setLogs(data.logs ?? []);
    setMessage("");
  }, [actionFilter, dateFilter, headers, projectFilter, userFilter]);

  useEffect(() => {
    if (!loaded || !session) return;
    loadAudit().catch(() => setMessage("No se pudo cargar la bitacora."));
  }, [loadAudit, loaded, session]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.localStorage.removeItem("formatto-session");
    window.location.href = "/";
  }

  function pdfHref() {
    const params = new URLSearchParams();
    if (userFilter.trim()) params.set("user", userFilter.trim());
    if (projectFilter.trim()) params.set("project", projectFilter.trim());
    if (actionFilter !== "todos") params.set("action", actionFilter);
    if (dateFilter) params.set("date", dateFilter);
    const suffix = params.toString();
    return `/api/audit/pdf${suffix ? `?${suffix}` : ""}`;
  }

  if (!loaded) return <main className="formatto-shell md:pl-[58px]"><SideNav role={role} /></main>;

  if (!session) {
    return (
      <main className="formatto-shell flex min-h-screen items-center justify-center bg-[var(--g1)] p-6">
        <section className="w-full max-w-md border border-[var(--g2)] bg-white p-6">
          <Image src="/formatto-logo.png" alt="Formatto" width={190} height={34} priority />
          <h1 className="mt-6 text-lg font-bold">Bitacora</h1>
          <p className="mt-2 text-sm text-[var(--mut)]">Inicia sesion desde el tablero para revisar cambios.</p>
          <Link className="primary-button mt-5 inline-flex no-underline" href="/">Ir al tablero</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="formatto-shell md:pl-[58px]">
      <SideNav role={role} />
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--g2)] bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Image src="/formatto-logo.png" alt="Formatto" width={190} height={34} priority />
          <div className="h-8 w-px bg-[var(--g2)]" />
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--blk)]">Bitacora de cambios</div>
            <div className="text-[10px] text-[var(--mut)]">Validacion de usuarios, proyectos y cambios de estado</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className="thin-button no-underline" href="/">Volver al tablero</Link>
          <button className="thin-button inline-flex items-center gap-2" onClick={logout}><LogOut size={14} />{session.name}</button>
        </div>
      </header>

      <section className="px-6 py-4">
        <div className="mb-4 grid gap-3 border border-[var(--g2)] bg-white p-4 md:grid-cols-[1fr_1fr_160px_160px_auto]">
          <input className="field" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} placeholder="Proyecto o tarea" />
          <input className="field" value={userFilter} onChange={(event) => setUserFilter(event.target.value)} placeholder="Usuario" />
          <select className="field" value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
            <option value="todos">Todas</option>
            <option value="actualizar_estado">Estado</option>
            <option value="actualizar_estado_masivo">Estado masivo</option>
            <option value="crear_tarea">Crear tarea</option>
            <option value="editar_tarea">Editar tarea</option>
            <option value="eliminar_tarea">Eliminar tarea</option>
          </select>
          <input className="field" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
          <button className="thin-button inline-flex items-center gap-2" onClick={loadAudit}><RefreshCw size={14} />Actualizar</button>
          <a className="primary-button inline-flex items-center justify-center no-underline" href={pdfHref()} target="_blank" rel="noreferrer">PDF</a>
        </div>

        {message && <div className="mb-4 border-l-4 border-[var(--org)] bg-[#faece7] px-4 py-2 text-xs text-[#8b2500]">{message}</div>}

        <div className="overflow-x-auto border border-[var(--g2)] bg-white">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[150px_1.1fr_140px_120px_1.7fr_1.4fr_90px] bg-[var(--blk)] px-3 py-2 text-[9px] uppercase tracking-[0.06em] text-white">
              <div>Fecha</div><div>Usuario</div><div>Accion</div><div>Entidad</div><div>Cambio</div><div>Detalle</div><div></div>
            </div>
            {logs.map((log) => (
              <div key={log.id} className="grid grid-cols-[150px_1.1fr_140px_120px_1.7fr_1.4fr_90px] items-start border-t border-[var(--g2)] px-3 py-2 text-[11px]">
                <div>{displayDate(log.createdAt)}</div>
                <div className="truncate">{log.actorEmail}</div>
                <div><span className="status-badge status-pendiente">{auditActionLabel(log.action)}</span></div>
                <div>{log.entity}</div>
                <div>{log.summary}</div>
                <div className="text-[10px] text-[var(--mut)]">{auditDetailText(log.details)}</div>
                <button className="thin-button px-2 py-1" onClick={() => setSelected(log)}>Ver</button>
              </div>
            ))}
            {logs.length === 0 && <div className="p-4 text-xs text-[var(--mut)]">Sin cambios para los filtros actuales.</div>}
          </div>
        </div>
      </section>
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <section className="w-full max-w-2xl border border-[var(--g2)] bg-white p-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-[var(--g2)] pb-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-[0.06em]">Detalle de cambio</h2>
                <p className="text-xs text-[var(--mut)]">{displayDate(selected.createdAt)} - {selected.actorEmail}</p>
              </div>
              <button className="thin-button" onClick={() => setSelected(null)}>Cerrar</button>
            </div>
            <div className="grid gap-3 text-sm">
              <div><span className="text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Accion</span><div className="font-semibold">{auditActionLabel(selected.action)}</div></div>
              <div><span className="text-[10px] uppercase tracking-[0.06em] text-[var(--mut)]">Cambio</span><div>{selected.summary}</div></div>
              <div className="border border-[var(--g2)] bg-[var(--g1)] p-3">
                {auditDetailLines(selected.details).map((line) => <div key={line} className="mb-1 text-xs">{line}</div>)}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
