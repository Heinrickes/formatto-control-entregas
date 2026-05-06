import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { can, forbidden, getRequestRole, getRequestUser } from "@/lib/rbac";
import { hashPassword } from "@/lib/passwords";
import { normalizeEmail, userAreas } from "@/lib/users";
import { getAppAccessUrl, sendUserAccessMail } from "@/lib/user-access-mail";

export const dynamic = "force-dynamic";

const userPatchSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().min(2).optional(),
  role: z.enum(["admin", "operador", "lector"]).optional(),
  area: z.enum(userAreas).optional(),
  position: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  active: z.boolean().optional(),
  sendAccess: z.boolean().optional()
});

function toPayload(user: {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "operador" | "lector";
  area: string | null;
  position: string | null;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    area: user.area,
    position: user.position,
    active: user.active,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const role = getRequestRole(request);
  const actor = getRequestUser(request);
  if (!can(role, "admin")) return forbidden("Solo admin puede editar usuarios");

  const payload = userPatchSchema.parse(await request.json());
  const data: Record<string, unknown> = {};
  if (payload.email) data.email = normalizeEmail(payload.email);
  if (payload.fullName) data.fullName = payload.fullName.trim();
  if (payload.role) data.role = payload.role;
  if (payload.area) data.area = payload.area;
  if (payload.position !== undefined) data.position = payload.position?.trim() || null;
  if (payload.active !== undefined) data.active = payload.active;
  const newPassword = payload.password?.trim();
  if (newPassword) {
    data.passwordHash = hashPassword(newPassword);
    data.mustChangePassword = true;
  }

  const user = await prisma.profile.update({
    where: { id: params.id },
    data
  });

  await writeAuditLog({
    user: actor,
    action: "editar_usuario",
    entity: "profile",
    entityId: user.id,
    summary: `Edito usuario ${user.email}`,
    details: { ...payload, password: payload.password?.trim() ? "actualizada" : undefined }
  });

  let mailError: string | null = null;
  if (payload.sendAccess && newPassword) {
    try {
      await sendUserAccessMail({
        user,
        password: newPassword,
        appUrl: getAppAccessUrl(request)
      });
      await writeAuditLog({
        user: actor,
        action: "enviar_acceso_usuario",
        entity: "profile",
        entityId: user.id,
        summary: `Envio acceso a ${user.email}`,
        details: { email: user.email }
      });
    } catch (error) {
      mailError = error instanceof Error ? error.message : "No se pudo enviar el correo de acceso.";
    }
  }

  return Response.json({ user: toPayload(user), mailError });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const role = getRequestRole(request);
  const actor = getRequestUser(request);
  if (!can(role, "admin")) return forbidden("Solo admin puede desactivar usuarios");

  const user = await prisma.profile.update({
    where: { id: params.id },
    data: { active: false }
  });

  await writeAuditLog({
    user: actor,
    action: "desactivar_usuario",
    entity: "profile",
    entityId: user.id,
    summary: `Desactivo usuario ${user.email}`,
    details: { email: user.email }
  });

  return Response.json({ user: toPayload(user) });
}
