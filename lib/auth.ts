import { createHmac, timingSafeEqual } from "crypto";
import type { Role } from "@/lib/rbac";

export type AuthUser = {
  email: string;
  role: Role;
  name: string;
};

const cookieName = "formatto_session";

export function getCookieName() {
  return cookieName;
}

function secret() {
  return process.env.FORMATTO_AUTH_SECRET ?? "dev-secret-change-me";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createSessionToken(user: AuthUser) {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token?: string | null): AuthUser | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthUser;
  } catch {
    return null;
  }
}

export function getRequestUserFromCookie(cookieValue?: string | null) {
  return verifySessionToken(cookieValue);
}
