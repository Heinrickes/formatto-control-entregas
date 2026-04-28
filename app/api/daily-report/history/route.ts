import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  getRequestRole(_request);
  const history = await prisma.reportDelivery.findMany({
    orderBy: { createdAt: "desc" },
    take: 50
  });
  return Response.json({ history });
}
