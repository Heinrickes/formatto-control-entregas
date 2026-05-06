import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { can, forbidden, getRequestRole } from "@/lib/rbac";
import { decryptAccessPassword } from "@/lib/user-access-mail";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const role = getRequestRole(request);
  if (!can(role, "admin")) return forbidden("Solo admin puede ver claves de acceso");

  const secrets = await prisma.userAccessSecret.findMany({
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return Response.json({
    secrets: secrets.map((item) => ({
      id: item.id,
      profileId: item.profileId,
      profileEmail: item.profileEmail,
      profileName: item.profileName,
      password: decryptAccessPassword(item.passwordCipher),
      action: item.action,
      sentByEmail: item.sentByEmail,
      createdAt: item.createdAt
    }))
  });
}
