import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/dates";
import { writeAuditLog } from "@/lib/audit";
import { can, forbidden, getRequestRole, getRequestUser } from "@/lib/rbac";
import { dispatchInputSchema } from "@/lib/validators";
import { cleanLocationValue, normalizeProjectName } from "@/lib/formatting";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const role = getRequestRole(request);
  const user = getRequestUser(request);
  if (!can(role, "admin")) return forbidden("Solo admin puede editar despachos");

  const payload = dispatchInputSchema.partial().parse(await request.json());
  const current = payload.originalScheduledAt !== undefined
    ? await prisma.dispatch.findUnique({ where: { id: params.id }, select: { originalScheduledAt: true } })
    : null;
  const dispatch = await prisma.dispatch.update({
    where: { id: params.id },
    data: {
      legacyId: payload.legacyId,
      businessLine: payload.businessLine,
      project: payload.project ? normalizeProjectName(payload.project) : undefined,
      projectType: payload.projectType,
      type: payload.type,
      description: payload.businessLine === "Constructora" ? null : payload.description,
      detail: payload.detail,
      tower: payload.tower === undefined ? undefined : cleanLocationValue(payload.tower, "torre") || null,
      core: payload.core === undefined ? undefined : cleanLocationValue(payload.core, "nucleo") || null,
      floor: payload.floor === undefined ? undefined : cleanLocationValue(payload.floor, "piso") || null,
      fabricationType: payload.fabricationType,
      productionStage: payload.productionStage,
      productionStartAt: payload.productionStartAt === undefined ? undefined : payload.productionStartAt ? parseDateOnly(payload.productionStartAt) : null,
      units: payload.units,
      originalScheduledAt: payload.originalScheduledAt === undefined ? undefined : payload.originalScheduledAt ? parseDateOnly(payload.originalScheduledAt) ?? undefined : undefined,
      scheduledAt: payload.scheduledAt ? parseDateOnly(payload.scheduledAt) ?? undefined : undefined,
      source: payload.source,
      sortOrder: payload.sortOrder
    },
    include: { status: true }
  });

  await writeAuditLog({
    user,
    action: "editar_tarea",
    entity: "dispatch",
    entityId: params.id,
    summary: `Edito tarea ${dispatch.project} - ${dispatch.type}`,
    details: {
      ...payload,
      originalScheduledAtBefore: current?.originalScheduledAt ?? null,
      originalScheduledAtAfter: payload.originalScheduledAt === undefined ? undefined : dispatch.originalScheduledAt
    }
  });

  return Response.json({ dispatch });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const role = getRequestRole(request);
  const user = getRequestUser(request);
  if (!can(role, "admin")) return forbidden("Solo admin puede eliminar despachos");

  const dispatch = await prisma.dispatch.delete({ where: { id: params.id } });
  await writeAuditLog({
    user,
    action: "eliminar_tarea",
    entity: "dispatch",
    entityId: params.id,
    summary: `Elimino tarea ${dispatch.project} - ${dispatch.type}`,
    details: { project: dispatch.project, type: dispatch.type, scheduledAt: dispatch.scheduledAt }
  });
  return Response.json({ ok: true });
}
