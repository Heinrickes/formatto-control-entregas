"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, ClipboardList, Home, Users } from "lucide-react";
import type { Role } from "@/lib/client-types";

type PresenceRow = {
  id: string;
  fullName: string;
  lastActivity?: string | null;
};

export function SideNav({ role = "lector" }: { role?: Role }) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceRow[]>([]);
  const items = [
    { href: "/", label: "Tablero", icon: Home, show: true },
    { href: "/diario", label: "Reportes", icon: BarChart3, show: true },
    { href: "/usuarios", label: "Usuarios", icon: Users, show: role === "admin" },
    { href: "/bitacora", label: "Bitacora", icon: ClipboardList, show: role === "admin" }
  ];

  const loadPresence = useCallback(async () => {
    if (role !== "admin") return;
    const res = await fetch("/api/presence", { headers: { "x-formatto-role": role } });
    if (!res.ok) return;
    const data = await res.json();
    setOnlineUsers(data.users ?? []);
  }, [role]);

  useEffect(() => {
    loadPresence().catch(() => undefined);
    const timer = window.setInterval(() => {
      loadPresence().catch(() => undefined);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [loadPresence]);

  return (
    <aside className="group fixed left-0 top-0 z-40 hidden h-screen w-[58px] border-r border-[var(--org)] bg-white text-[var(--org)] shadow-sm transition-all duration-200 hover:w-[220px] md:block">
      <div className="flex h-16 items-center gap-3 border-b border-[var(--g2)] px-4">
        <span className="h-5 w-5 shrink-0 bg-[var(--org)]" />
        <span className="relative h-6 w-[128px] shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
          <Image src="/formatto-logo.png" alt="Formatto" fill sizes="128px" className="object-contain object-left" />
        </span>
      </div>
      <nav className="py-3">
        {items.filter((item) => item.show).map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex h-12 items-center gap-3 border-l-2 border-transparent px-4 text-[var(--org)] no-underline transition hover:border-[var(--org)] hover:bg-[#faece7] hover:text-[var(--org)]" title={item.label}>
              <Icon size={18} className="shrink-0" />
              <span className="truncate text-xs font-semibold text-[var(--blk)] opacity-0 transition-opacity group-hover:opacity-100">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      {role === "admin" && (
        <div className="absolute bottom-3 left-0 right-0 px-3">
          <div className="border border-[var(--g2)] bg-[var(--g1)] px-2 py-2">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 bg-[var(--ok)]" />
              <span className="truncate text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--blk)] opacity-0 transition-opacity group-hover:opacity-100">Conectados</span>
            </div>
            <div className="space-y-1">
              {onlineUsers.slice(0, 4).map((user) => (
                <div key={user.id} className="flex h-6 items-center gap-2" title={user.lastActivity ?? "Activo"}>
                  <span className="h-2 w-2 shrink-0 bg-[var(--ok)]" />
                  <span className="truncate text-[11px] font-semibold text-[var(--blk)] opacity-0 transition-opacity group-hover:opacity-100">{user.fullName}</span>
                </div>
              ))}
              {onlineUsers.length === 0 && (
                <div className="flex h-6 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 bg-[var(--g2)]" />
                  <span className="truncate text-[11px] text-[var(--mut)] opacity-0 transition-opacity group-hover:opacity-100">Sin actividad</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
