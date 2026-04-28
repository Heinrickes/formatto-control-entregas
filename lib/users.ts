import type { Role } from "@/lib/rbac";

export const userAreas = [
  "Planificacion y Adquisiciones",
  "Produccion",
  "Armado",
  "Logistica",
  "Gerencia",
  "Instalaciones"
] as const;

export const userRoles: Role[] = ["admin", "operador", "lector"];

export const areaPrefixes: Record<(typeof userAreas)[number], string> = {
  "Planificacion y Adquisiciones": "Plan",
  Produccion: "Prod",
  Armado: "Arma",
  Logistica: "Logi",
  Gerencia: "Geren",
  Instalaciones: "Insta"
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
