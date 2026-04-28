import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/dates";
import { writeAuditLog } from "@/lib/audit";
import { can, forbidden, getRequestRole, getRequestUser } from "@/lib/rbac";
import { statusInputSchema } from "@/lib/validators";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bulkStatusSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  status: statusInputSchema
});

export async function PATCH(request: NextRequest) {
  const role = getRequestRole(request);
  const user = getRequestUser(request);
  if (!can(role, "operador")) return forbidden("Solo operador o admin puede actualizar despachos");

  const payload = bulkStatusSchema.parse(await request.json());
  const actualAt = parseDateOnly(payload.status.actualAt);

  const result = await prisma.$transaction(async (tx) => {
    const profile = user?.email ? await tx.profile.findUnique({ where: { email: user.email } }) : null;
    for (const dispatchId of payload.ids) {
      await tx.dispatchStatus.upsert({
        where: { dispatchId },
        update: {
          state: payload.status.state,
          actualAt,
          notes: payload.status.notes ?? null,
          updatedBy: user?.email ?? role
        },
        create: {
          dispatchId,
          state: payload.status.state,
          actualAt,
          notes: payload.status.notes ?? null,
          updatedBy: user?.email ?? role
        }
      });

      await tx.dispatchEvent.create({
        data: {
          dispatchId,
          state: payload.status.state,
          actualAt,
          notes: payload.status.notes ?? null,
          actorId: profile?.id
        }
      });
    }

    return { updated: payload.ids.length };
  });

  await writeAuditLog({
    user,
    action: "actualizar_estado_masivo",
    entity: "dispatch",
    summary: `Actualizo ${payload.ids.length} tarea(s) a ${payload.status.state}`,
    details: { ids: payload.ids, status: payload.status }
  });

  return Response.json(result);
}
