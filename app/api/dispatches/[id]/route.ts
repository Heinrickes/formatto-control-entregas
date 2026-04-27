import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/dates";
import { can, forbidden, getRequestRole } from "@/lib/rbac";
import { dispatchInputSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const role = getRequestRole(request);
  if (!can(role, "admin")) return forbidden("Solo admin puede editar despachos");

  const payload = dispatchInputSchema.partial().parse(await request.json());
  const dispatch = await prisma.dispatch.update({
    where: { id: params.id },
    data: {
      legacyId: payload.legacyId,
      project: payload.project,
      type: payload.type,
      detail: payload.detail,
      tower: payload.tower,
      core: payload.core,
      floor: payload.floor,
      units: payload.units,
      scheduledAt: payload.scheduledAt ? parseDateOnly(payload.scheduledAt) ?? undefined : undefined,
      source: payload.source,
      sortOrder: payload.sortOrder
    },
    include: { status: true }
  });

  return Response.json({ dispatch });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const role = getRequestRole(request);
  if (!can(role, "admin")) return forbidden("Solo admin puede eliminar despachos");

  await prisma.dispatch.delete({ where: { id: params.id } });
  return Response.json({ ok: true });
}
