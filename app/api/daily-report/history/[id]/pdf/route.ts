import { readFile } from "fs/promises";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  getRequestRole(request);
  const item = await prisma.reportDelivery.findUnique({ where: { id: params.id } });
  if (!item) return Response.json({ error: "Reporte no encontrado" }, { status: 404 });
  const pdf = await readFile(item.filePath);
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${item.fileName}"`
    }
  });
}
