"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LogOut } from "lucide-react";
import { SideNav } from "@/components/side-nav";
import { UsersAdminPanel } from "@/components/users-admin-panel";
import type { Role } from "@/lib/client-types";

type Session = {
  email: string;
  role: Role;
  name: string;
};

export default function UsuariosPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem("formatto-session");
    if (raw) setSession(JSON.parse(raw));
    setLoaded(true);
  }, []);

  const role = session?.role ?? "lector";
  const headers = useMemo(() => ({ "Content-Type": "application/json", "x-formatto-role": role }), [role]);

  useEffect(() => {
    if (!session) return;
    const heartbeat = () => {
      fetch("/api/presence", {
        method: "POST",
        headers,
        body: JSON.stringify({ activity: "Usuarios" })
      }).catch(() => undefined);
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 30000);
    return () => window.clearInterval(timer);
  }, [headers, session]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.localStorage.removeItem("formatto-session");
    setSession(null);
    window.location.href = "/";
  }

  if (!loaded) {
    return <main className="formatto-shell md:pl-[58px]"><SideNav role={role} /></main>;
  }

  if (!session) {
    return (
      <main className="formatto-shell flex min-h-screen items-center justify-center bg-[var(--g1)] p-6">
        <section className="w-full max-w-md border border-[var(--g2)] bg-white p-6">
          <Image src="/formatto-logo.png" alt="Formatto" width={190} height={34} priority />
          <h1 className="mt-6 text-lg font-bold">Usuarios</h1>
          <p className="mt-2 text-sm text-[var(--mut)]">Inicia sesion desde el tablero para administrar usuarios.</p>
          <Link className="primary-button mt-5 inline-flex no-underline" href="/">Ir al tablero</Link>
        </section>
      </main>
    );
  }

  if (role !== "admin") {
    return (
      <main className="formatto-shell md:pl-[58px]">
        <SideNav role={role} />
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--g2)] bg-white px-6 py-4">
          <div className="flex items-center gap-4">
            <Image src="/formatto-logo.png" alt="Formatto" width={190} height={34} priority />
            <div className="h-8 w-px bg-[var(--g2)]" />
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--blk)]">Usuarios</div>
              <div className="text-[10px] text-[var(--mut)]">Administracion de accesos</div>
            </div>
          </div>
          <button className="thin-button inline-flex items-center gap-2" onClick={logout}><LogOut size={14} />{session.name}</button>
        </header>
        <section className="px-6 py-4">
          <div className="border border-[var(--g2)] bg-white p-5 text-sm text-[var(--mut)]">No tienes permisos para administrar usuarios.</div>
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
            <div className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--blk)]">Usuarios</div>
            <div className="text-[10px] text-[var(--mut)]">Administracion de accesos, roles y actividad</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className="thin-button no-underline" href="/">Volver al tablero</Link>
          <button className="thin-button inline-flex items-center gap-2" onClick={logout}><LogOut size={14} />{session.name}</button>
        </div>
      </header>
      <section className="px-6 py-4">
        <UsersAdminPanel headers={headers} />
      </section>
    </main>
  );
}
