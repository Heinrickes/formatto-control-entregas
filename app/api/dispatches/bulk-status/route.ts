import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/dates";
import { can, forbidden, getRequestRole } from "@/lib/rbac";
import { statusInputSchema } from "@/lib/validators";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bulkStatusSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  status: statusInputSchema
});

export async function PATCH(request: NextRequest) {
  const role = getRequestRole(request);
  if (!can(role, "operador")) return forbidden("Solo operador o admin puede actualizar despachos");

  const payload = bulkStatusSchema.parse(await request.json());
  const actualAt = parseDateOnly(payload.status.actualAt);

  const result = await prisma.$transaction(async (tx) => {
    for (const dispatchId of payload.ids) {
      await tx.dispatchStatus.upsert({
        where: { dispatchId },
        update: {
          state: payload.status.state,
          actualAt,
          notes: payload.status.notes ?? null,
          updatedBy: role
        },
        create: {
          dispatchId,
          state: payload.status.state,
          actualAt,
          notes: payload.status.notes ?? null,
          updatedBy: role
        }
      });

      await tx.dispatchEvent.create({
        data: {
          dispatchId,
          state: payload.status.state,
          actualAt,
          notes: payload.status.notes ?? null
        }
      });
    }

    return { updated: payload.ids.length };
  });

  return Response.json(result);
}
