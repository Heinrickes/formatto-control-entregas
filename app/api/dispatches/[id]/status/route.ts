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
  const statusActualAt = payload.state === "cambio" ? null : actualAt;
  const completionDueAt = parseDateOnly(payload.completionDueAt) ?? actualAt ?? new Date();

  const result = await prisma.$transaction(async (tx) => {
    const dispatch = await tx.dispatch.findUnique({
      where: { id: params.id },
      include: { status: true }
    });
    if (!dispatch) throw new Error("Despacho no encontrado");

    const status = await tx.dispatchStatus.upsert({
      where: { dispatchId: params.id },
      update: {
        state: payload.state,
        actualAt: statusActualAt,
        notes: payload.notes ?? null,
        updatedBy: user?.email ?? role
      },
      create: {
        dispatchId: params.id,
        state: payload.state,
        actualAt: statusActualAt,
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

    let updatedDispatch = dispatch;
    if (payload.state === "cambio" && actualAt) {
      updatedDispatch = await tx.dispatch.update({
        where: { id: params.id },
        data: { scheduledAt: actualAt },
        include: { status: true }
      });
    } else {
      updatedDispatch = await tx.dispatch.findUnique({
        where: { id: params.id },
        include: { status: true }
      }) ?? dispatch;
    }

    let completionTask = null;
    if (payload.state === "parcial") {
      completionTask = await tx.dispatch.findFirst({ where: { parentDispatchId: params.id } });
      if (!completionTask) {
        completionTask = await tx.dispatch.create({
          data: {
            programId: dispatch.programId,
            parentDispatchId: dispatch.id,
            project: dispatch.project,
            type: dispatch.type,
            detail: `Completar entrega parcial${dispatch.detail ? ` - ${dispatch.detail}` : ""}`,
            tower: dispatch.tower,
            core: dispatch.core,
              floor: dispatch.floor,
              units: dispatch.units,
              originalScheduledAt: completionDueAt,
              scheduledAt: completionDueAt,
              source: "manual",
            sortOrder: dispatch.sortOrder + 1
          }
        });
        await tx.dispatchStatus.create({
          data: {
            dispatchId: completionTask.id,
            state: "pendiente",
            actualAt: null,
            notes: "Completar saldo de entrega parcial.",
            updatedBy: user?.email ?? role
          }
        });
        await tx.dispatchEvent.create({
          data: {
            dispatchId: completionTask.id,
            state: "pendiente",
            notes: "Tarea creada automaticamente para completar entrega parcial.",
            actorId: user?.email ? (await tx.profile.findUnique({ where: { email: user.email } }))?.id : undefined
          }
        });
      }
    }

    return { status, event, completionTask, dispatch: updatedDispatch };
  });

  await writeAuditLog({
    user,
    action: "actualizar_estado",
    entity: "dispatch",
    entityId: params.id,
    summary: `Actualizo ${result.dispatch.project} - ${result.dispatch.type} a ${payload.state}`,
    details: {
      state: payload.state,
      actualAt: payload.actualAt,
      rescheduledAt: payload.state === "cambio" ? payload.actualAt : null,
      completionDueAt: payload.completionDueAt,
      notes: payload.notes ?? null,
      completionTaskId: result.completionTask?.id ?? null
    }
  });

  return Response.json(result);
}
