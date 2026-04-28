import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { can, forbidden, getRequestRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const role = getRequestRole(request);
  if (!can(role, "admin")) return forbidden("Solo admin puede ver la bitacora");

  const user = request.nextUrl.searchParams.get("user")?.trim();
  const action = request.nextUrl.searchParams.get("action")?.trim();
  const date = request.nextUrl.searchParams.get("date")?.trim();
  const where: Prisma.AuditLogWhereInput = {};

  if (user) where.actorEmail = { contains: user, mode: "insensitive" };
  if (action && action !== "todos") where.action = action;
  if (date) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);
    where.createdAt = { gte: start, lte: end };
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return Response.json({ logs });
}
