import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { hashPassword } from "@/lib/passwords";
import { can, forbidden, getRequestRole, getRequestUser } from "@/lib/rbac";
import { getAppAccessUrl, recordUserAccessSecret, sendUserAccessMail } from "@/lib/user-access-mail";
import { z } from "zod";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  password: z.string().min(4, "La clave debe tener al menos 4 caracteres.")
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

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const role = getRequestRole(request);
  const actor = getRequestUser(request);
  if (!can(role, "admin")) return forbidden("Solo admin puede enviar accesos de usuarios");

  const payload = payloadSchema.parse(await request.json());
  const currentUser = await prisma.profile.findUnique({ where: { id: params.id } });
  if (!currentUser) return Response.json({ error: "Usuario no encontrado." }, { status: 404 });
  if (!currentUser.active) return Response.json({ error: "No se puede enviar acceso a un usuario inactivo." }, { status: 400 });

  const password = payload.password.trim();
  const user = await prisma.profile.update({
    where: { id: params.id },
    data: {
      passwordHash: hashPassword(password),
      mustChangePassword: true
    }
  });

  let recordError: string | null = null;
  try {
    await recordUserAccessSecret({
      user,
      password,
      action: "actualizada_y_enviada",
      actor
    });
  } catch (error) {
    recordError = error instanceof Error ? error.message : "No se pudo registrar la clave en el historial privado.";
  }

  let mailError: string | null = null;
  try {
    await sendUserAccessMail({
      user,
      password,
      appUrl: getAppAccessUrl(request)
    });
  } catch (error) {
    mailError = error instanceof Error ? error.message : "No se pudo enviar el correo de acceso.";
  }

  await writeAuditLog({
    user: actor,
    action: mailError ? "actualizar_clave_usuario" : "enviar_acceso_usuario",
    entity: "profile",
    entityId: user.id,
    summary: mailError ? `Genero nueva clave para ${user.email}, pero fallo el correo` : `Genero y envio nueva clave a ${user.email}`,
    details: { email: user.email, mailError, recordError }
  });

  return Response.json({ user: toPayload(user), mailError, recordError });
}
