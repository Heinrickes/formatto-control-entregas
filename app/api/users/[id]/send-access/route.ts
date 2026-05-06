import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { hashPassword } from "@/lib/passwords";
import { can, forbidden, getRequestRole, getRequestUser } from "@/lib/rbac";
import { generateAccessPassword, getAppAccessUrl, sendUserAccessMail } from "@/lib/user-access-mail";

export const dynamic = "force-dynamic";

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

  const currentUser = await prisma.profile.findUnique({ where: { id: params.id } });
  if (!currentUser) return Response.json({ error: "Usuario no encontrado." }, { status: 404 });
  if (!currentUser.active) return Response.json({ error: "No se puede enviar acceso a un usuario inactivo." }, { status: 400 });

  const password = generateAccessPassword(currentUser.area);

  try {
    await sendUserAccessMail({
      user: currentUser,
      password,
      appUrl: getAppAccessUrl(request)
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "No se pudo enviar el correo de acceso."
    }, { status: 500 });
  }

  const user = await prisma.profile.update({
    where: { id: params.id },
    data: {
      passwordHash: hashPassword(password),
      mustChangePassword: true
    }
  });

  await writeAuditLog({
    user: actor,
    action: "enviar_acceso_usuario",
    entity: "profile",
    entityId: user.id,
    summary: `Genero y envio nueva clave a ${user.email}`,
    details: { email: user.email }
  });

  return Response.json({ user: toPayload(user) });
}
