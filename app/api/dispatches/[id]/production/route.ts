import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/dates";
import { writeAuditLog } from "@/lib/audit";
import { can, forbidden, getRequestRole, getRequestUser } from "@/lib/rbac";
import { fabricationTypeSchema, productionStageSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

const productionInputSchema = z.object({
  fabricationType: fabricationTypeSchema.optional(),
  productionStage: productionStageSchema.optional(),
  productionStartAt: z.string().optional().nullable()
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const role = getRequestRole(request);
  const user = getRequestUser(request);
  if (!can(role, "operador")) return forbidden("Solo admin u operador puede actualizar produccion");

  const payload = productionInputSchema.parse(await request.json());
  const dispatch = await prisma.dispatch.update({
    where: { id: params.id },
    data: {
      fabricationType: payload.fabricationType,
      productionStage: payload.productionStage,
      productionStartAt: payload.productionStartAt === undefined ? undefined : payload.productionStartAt ? parseDateOnly(payload.productionStartAt) : null
    },
    include: { status: true, events: { orderBy: { createdAt: "desc" }, take: 20, include: { actor: true } } }
  });

  await writeAuditLog({
    user,
    action: "actualizar_produccion",
    entity: "dispatch",
    entityId: params.id,
    summary: `Actualizo produccion ${dispatch.project} - ${dispatch.type}`,
    details: payload
  });

  return Response.json({ dispatch });
}
