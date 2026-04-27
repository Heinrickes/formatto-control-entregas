import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/dates";
import { can, forbidden, getRequestRole } from "@/lib/rbac";
import { programInputSchema } from "@/lib/validators";
import { programInclude } from "@/lib/program-queries";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const program = await prisma.program.findUnique({
    where: { id: params.id },
    include: programInclude
  });
  if (!program) return Response.json({ error: "Programa no encontrado" }, { status: 404 });
  return Response.json({ program });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const role = getRequestRole(request);
  if (!can(role, "admin")) return forbidden("Solo admin puede editar programas");

  const payload = programInputSchema.partial({ dispatches: true }).parse(await request.json());
  const program = await prisma.$transaction(async (tx) => {
    if (payload.active) await tx.program.updateMany({ where: { NOT: { id: params.id } }, data: { active: false } });
    return tx.program.update({
      where: { id: params.id },
      data: {
        name: payload.name,
        builder: payload.builder,
        startsAt: payload.startsAt === undefined ? undefined : parseDateOnly(payload.startsAt),
        endsAt: payload.endsAt === undefined ? undefined : parseDateOnly(payload.endsAt),
        active: payload.active
      },
      include: programInclude
    });
  });

  return Response.json({ program });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const role = getRequestRole(request);
  if (!can(role, "admin")) return forbidden("Solo admin puede eliminar programas");

  await prisma.program.delete({ where: { id: params.id } });
  return Response.json({ ok: true });
}
