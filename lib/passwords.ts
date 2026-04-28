import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const keyLength = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, keyLength).toString("base64url");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored?: string | null) {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;

  const expected = Buffer.from(hash, "base64url");
  const actual = scryptSync(password, salt, keyLength);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
