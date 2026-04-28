import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/dates";
import { writeAuditLog } from "@/lib/audit";
import { can, forbidden, getRequestRole, getRequestUser } from "@/lib/rbac";
import { dispatchInputSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const dispatches = await prisma.dispatch.findMany({
    where: { programId: params.id },
    orderBy: [{ sortOrder: "asc" }, { scheduledAt: "asc" }],
    include: {
      status: true,
      events: { orderBy: { createdAt: "desc" }, take: 20, include: { actor: true } }
    }
  });
  return Response.json({ dispatches });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const role = getRequestRole(request);
  const user = getRequestUser(request);
  if (!can(role, "admin")) return forbidden("Solo admin puede crear despachos");

  const payload = dispatchInputSchema.parse(await request.json());
  const dispatch = await prisma.dispatch.create({
    data: {
      programId: params.id,
      legacyId: payload.legacyId ?? null,
      project: payload.project,
      type: payload.type,
      detail: payload.detail ?? null,
      tower: payload.tower ?? null,
      core: payload.core ?? null,
      floor: payload.floor ?? null,
      units: payload.units,
      scheduledAt: parseDateOnly(payload.scheduledAt) ?? new Date(),
      source: payload.source,
      sortOrder: payload.sortOrder,
      status: { create: { state: "pendiente" } }
    },
    include: { status: true }
  });
  await writeAuditLog({
    user,
    action: "crear_tarea",
    entity: "dispatch",
    entityId: dispatch.id,
    summary: `Creo tarea ${dispatch.project} - ${dispatch.type}`,
    details: payload
  });
  return Response.json({ dispatch }, { status: 201 });
}
