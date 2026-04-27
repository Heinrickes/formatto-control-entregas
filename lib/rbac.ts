import { NextRequest } from "next/server";
import { getCookieName, verifySessionToken } from "@/lib/auth";

export type Role = "admin" | "operador" | "lector";

const roleRank: Record<Role, number> = {
  lector: 1,
  operador: 2,
  admin: 3
};

export function getRequestRole(request: NextRequest): Role {
  const user = verifySessionToken(request.cookies.get(getCookieName())?.value);
  const envRole = process.env.NODE_ENV === "development" ? (process.env.FORMATTO_DEV_ROLE as Role | undefined) : undefined;
  const role = user?.role ?? envRole ?? "lector";
  return role in roleRank ? role : "lector";
}

export function can(role: Role, minimum: Role) {
  return roleRank[role] >= roleRank[minimum];
}

export function forbidden(message = "No tienes permisos para esta accion") {
  return Response.json({ error: message }, { status: 403 });
}
