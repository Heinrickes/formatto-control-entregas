import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/dates";
import { can, forbidden, getRequestRole } from "@/lib/rbac";
import { statusInputSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const role = getRequestRole(request);
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
        updatedBy: role
      },
      create: {
        dispatchId: params.id,
        state: payload.state,
        actualAt,
        notes: payload.notes ?? null,
        updatedBy: role
      }
    });

    const event = await tx.dispatchEvent.create({
      data: {
        dispatchId: params.id,
        state: payload.state,
        actualAt,
        notes: payload.notes ?? null
      }
    });

    return { status, event };
  });

  return Response.json(result);
}
