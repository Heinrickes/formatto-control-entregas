import { getCookieName } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", `${getCookieName()}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return response;
}
