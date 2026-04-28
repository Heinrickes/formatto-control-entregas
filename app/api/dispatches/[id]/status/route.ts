import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/dates";
import { writeAuditLog } from "@/lib/audit";
import { can, forbidden, getRequestRole, getRequestUser } from "@/lib/rbac";
import { statusInputSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const role = getRequestRole(request);
  const user = getRequestUser(request);
  if (!can(role, "operador")) return forbidden("Solo operador o admin puede actualizar despachos");

  const payload = statusInputSchema.parse(await request.json());
  const actualAt = parseDateOnly(payload.actualAt);

  const result = await prisma.$transaction(async (tx) => {
    const status = await tx.dispatchStatus.upsert({
      where: { dispatchId: params.id },
      update: {
        state: payload.state,
        actualAt,
        notes: payload.notes ?? null,
        updatedBy: user?.email ?? role
      },
      create: {
        dispatchId: params.id,
        state: payload.state,
        actualAt,
        notes: payload.notes ?? null,
        updatedBy: user?.email ?? role
      }
    });

    const event = await tx.dispatchEvent.create({
      data: {
        dispatchId: params.id,
        state: payload.state,
        actualAt,
        notes: payload.notes ?? null,
        actorId: user?.email ? (await tx.profile.findUnique({ where: { email: user.email } }))?.id : undefined
      }
    });

    return { status, event };
  });

  await writeAuditLog({
    user,
    action: "actualizar_estado",
    entity: "dispatch",
    entityId: params.id,
    summary: `Actualizo estado a ${payload.state}`,
    details: { state: payload.state, actualAt: payload.actualAt, notes: payload.notes ?? null }
  });

  return Response.json(result);
}
