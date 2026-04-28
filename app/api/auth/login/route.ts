import { z } from "zod";
import type { Role } from "@/lib/rbac";
import { createSessionToken, getCookieName } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/passwords";
import { normalizeEmail } from "@/lib/users";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

function users() {
  const raw = process.env.FORMATTO_USERS ?? "";
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [email, role, password] = item.split(":");
      return { email, role: role as Role, password };
    });
}

export async function POST(request: Request) {
  const payload = loginSchema.parse(await request.json());
  const email = normalizeEmail(payload.email);
  const profile = await prisma.profile.findUnique({ where: { email } });

  if (profile?.active && verifyPassword(payload.password, profile.passwordHash)) {
    const user = {
      email: profile.email,
      role: profile.role,
      name: profile.fullName
    };

    const response = Response.json({
      user: {
        email: user.email,
        role: user.role,
        name: user.name
      }
    });
    response.headers.append(
      "Set-Cookie",
      `${getCookieName()}=${createSessionToken(user)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 12}`
    );
    return response;
  }

  const match = users().find((user) => user.email.toLowerCase() === email && user.password === payload.password);

  if (!match) {
    return Response.json({ error: "Credenciales invalidas" }, { status: 401 });
  }

  const user = {
    email: match.email,
    role: match.role,
    name: match.email.split("@")[0]
  };

  const response = Response.json({
    user: {
      email: user.email,
      role: user.role,
      name: user.name
    }
  });
  response.headers.append(
    "Set-Cookie",
    `${getCookieName()}=${createSessionToken(user)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 12}`
  );
  return response;
}
