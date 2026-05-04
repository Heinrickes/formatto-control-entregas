import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { can, forbidden, getRequestRole } from "@/lib/rbac";
import { parseDateOnly } from "@/lib/dates";
import { programInputSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const role = getRequestRole(request);
  if (!can(role, "admin")) return forbidden("Solo admin puede importar programas");

  const payload = programInputSchema.parse(await request.json());
  const program = await prisma.$transaction(async (tx) => {
    if (payload.active) await tx.program.updateMany({ data: { active: false } });
    return tx.program.create({
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
            project: dispatch.project,
            type: dispatch.type,
            detail: dispatch.detail ?? null,
            tower: dispatch.tower ?? null,
            core: dispatch.core ?? null,
            floor: dispatch.floor ?? null,
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
  });

  return Response.json({ program }, { status: 201 });
}
