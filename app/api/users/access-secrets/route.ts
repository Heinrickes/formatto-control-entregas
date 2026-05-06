import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { can, forbidden, getRequestRole } from "@/lib/rbac";
import { decryptAccessPassword } from "@/lib/user-access-mail";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const role = getRequestRole(request);
  if (!can(role, "admin")) return forbidden("Solo admin puede ver claves de acceso");

  try {
    const secrets = await prisma.userAccessSecret.findMany({
      orderBy: { createdAt: "desc" },
      take: 200
    });

    return Response.json({
      secrets: secrets.map((item) => {
        let password = "";
        let decryptError: string | null = null;

        try {
          password = decryptAccessPassword(item.passwordCipher);
        } catch {
          decryptError = "No se pudo desencriptar esta clave. Revisa FORMATTO_ACCESS_SECRET en Vercel.";
        }

        return {
          id: item.id,
          profileId: item.profileId,
          profileEmail: item.profileEmail,
          profileName: item.profileName,
          password,
          decryptError,
          action: item.action,
          sentByEmail: item.sentByEmail,
          createdAt: item.createdAt
        };
      })
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "No se pudo cargar el historial privado de claves."
    }, { status: 500 });
  }
}
