import { prisma } from "@/lib/prisma";
import type { AuthUser } from "@/lib/auth";

export async function writeAuditLog({
  user,
  action,
  entity,
  entityId,
  summary,
  details
}: {
  user: AuthUser | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  details?: unknown;
}) {
  const profile = user?.email ? await prisma.profile.findUnique({ where: { email: user.email } }) : null;
  await prisma.auditLog.create({
    data: {
      actorId: profile?.id,
      actorEmail: user?.email ?? "sin-sesion",
      action,
      entity,
      entityId,
      summary,
      details: details === undefined ? undefined : (details as object)
    }
  });
}
