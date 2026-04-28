"use client";

import Image from "next/image";
import Link from "next/link";
import { BarChart3, Home, Users } from "lucide-react";
import type { Role } from "@/lib/client-types";

export function SideNav({ role = "lector" }: { role?: Role }) {
  const items = [
    { href: "/", label: "Tablero", icon: Home, show: true },
    { href: "/diario", label: "Reportes", icon: BarChart3, show: true },
    { href: "/?usuarios=1", label: "Usuarios", icon: Users, show: role === "admin" }
  ];

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
    </aside>
  );
}
