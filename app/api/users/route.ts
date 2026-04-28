import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { can, forbidden, getRequestRole } from "@/lib/rbac";
import { hashPassword } from "@/lib/passwords";
import { areaPrefixes, normalizeEmail, userAreas, userRoles } from "@/lib/users";

export const dynamic = "force-dynamic";

const userSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  role: z.enum(["admin", "operador", "lector"]),
  area: z.enum(userAreas),
  position: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  active: z.boolean().optional()
});

function toPayload(user: {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "operador" | "lector";
  area: string | null;
  position: string | null;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    area: user.area,
    position: user.position,
    active: user.active,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

async function nextPassword(area: keyof typeof areaPrefixes) {
  const prefix = areaPrefixes[area];
  const count = await prisma.profile.count({
    where: {
      area,
      passwordHash: { not: null }
    }
  });
  return `${prefix}${String(count + 1).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  const role = getRequestRole(request);
  if (!can(role, "admin")) return forbidden("Solo admin puede gestionar usuarios");

  const users = await prisma.profile.findMany({
    orderBy: [{ area: "asc" }, { fullName: "asc" }]
  });

  return Response.json({
    users: users.map(toPayload),
    roles: userRoles,
    areas: userAreas,
    prefixes: areaPrefixes
  });
}

export async function POST(request: NextRequest) {
  const role = getRequestRole(request);
  if (!can(role, "admin")) return forbidden("Solo admin puede crear usuarios");

  const payload = userSchema.parse(await request.json());
  const email = normalizeEmail(payload.email);
  const password = payload.password?.trim() || (await nextPassword(payload.area));

  const user = await prisma.profile.create({
    data: {
      email,
      fullName: payload.fullName.trim(),
      role: payload.role,
      area: payload.area,
      position: payload.position?.trim() || null,
      passwordHash: hashPassword(password),
      mustChangePassword: true,
      active: payload.active ?? true
    }
  });

  return Response.json({ user: toPayload(user), initialPassword: password }, { status: 201 });
}
