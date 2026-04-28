import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { can, forbidden, getRequestRole, getRequestUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const onlineWindowMs = 2 * 60 * 1000;

export async function GET(request: NextRequest) {
  const role = getRequestRole(request);
  if (!can(role, "admin")) return forbidden("Solo admin puede ver usuarios activos");

  const threshold = new Date(Date.now() - onlineWindowMs);
  const users = await prisma.userPresence.findMany({
    where: { lastSeenAt: { gte: threshold } },
    orderBy: { lastSeenAt: "desc" }
  });
  return Response.json({ users, threshold: threshold.toISOString() });
}

export async function POST(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user?.email) return Response.json({ ok: false }, { status: 401 });

  const payload = await request.json().catch(() => ({}));
  const profile = await prisma.profile.findUnique({ where: { email: user.email } });
  if (!profile || !profile.active) return Response.json({ ok: false }, { status: 401 });

  await prisma.userPresence.upsert({
    where: { profileId: profile.id },
    update: {
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      lastSeenAt: new Date(),
      lastActivity: typeof payload.activity === "string" ? payload.activity.slice(0, 120) : "Tablero"
    },
    create: {
      profileId: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      lastSeenAt: new Date(),
      lastActivity: typeof payload.activity === "string" ? payload.activity.slice(0, 120) : "Tablero"
    }
  });

  return Response.json({ ok: true });
}
