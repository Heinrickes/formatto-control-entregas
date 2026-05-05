import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { can, forbidden, getRequestRole } from "@/lib/rbac";
import { parseDateOnly } from "@/lib/dates";
import { programInputSchema } from "@/lib/validators";
import { cleanLocationValue, normalizeProjectName } from "@/lib/formatting";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const role = getRequestRole(request);
  if (!can(role, "admin")) return forbidden("Solo admin puede importar programas");

  const payload = programInputSchema.parse(await request.json());
  if (payload.active) await prisma.program.updateMany({ data: { active: false } });
  const program = await prisma.program.create({
    data: {
      name: payload.name,
      builder: payload.builder,
      startsAt: parseDateOnly(payload.startsAt),
      endsAt: parseDateOnly(payload.endsAt),
      active: payload.active ?? true,
      dispatches: {
        create: payload.dispatches.map((dispatch, index) => ({
          legacyId: dispatch.legacyId ?? null,
          businessLine: dispatch.businessLine,
          project: normalizeProjectName(dispatch.project),
          projectType: dispatch.projectType,
          type: dispatch.type,
          description: dispatch.businessLine === "Constructora" ? null : dispatch.description ?? null,
          detail: dispatch.detail ?? null,
          tower: cleanLocationValue(dispatch.tower, "torre") || null,
          core: cleanLocationValue(dispatch.core, "nucleo") || null,
          floor: cleanLocationValue(dispatch.floor, "piso") || null,
          fabricationType: dispatch.fabricationType,
          productionStage: dispatch.productionStage,
          productionStartAt: dispatch.productionStartAt ? parseDateOnly(dispatch.productionStartAt) : null,
          units: dispatch.units,
          scheduledAt: parseDateOnly(dispatch.scheduledAt) ?? new Date(),
          source: dispatch.source,
          sortOrder: index,
          status: { create: { state: "pendiente" } }
        }))
      }
    },
    include: { dispatches: { include: { status: true } } }
  });

  return Response.json({ program }, { status: 201 });
}
