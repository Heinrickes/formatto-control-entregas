import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/lib/dates";

export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const programId = request.nextUrl.searchParams.get("programId");
  const program = await prisma.program.findFirst({
    where: programId ? { id: programId } : { active: true },
    include: { dispatches: { include: { status: true }, orderBy: [{ sortOrder: "asc" }, { scheduledAt: "asc" }] } }
  });

  if (!program) return new Response("No hay programa activo", { status: 404 });

  const rows = program.dispatches.map((dispatch) => ({
    Programa: program.name,
    Constructora: program.builder,
    Proyecto: dispatch.project,
    Tipo: dispatch.type,
    Detalle: dispatch.detail ?? "",
    Unidades: dispatch.units || "",
    "Fecha Programada": toDateOnly(dispatch.scheduledAt),
    "Fecha Real": toDateOnly(dispatch.status?.actualAt),
    Estado: dispatch.status?.state ?? "pendiente",
    Observaciones: dispatch.status?.notes ?? ""
  }));
  const headers = Object.keys(rows[0] ?? {});
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header as keyof typeof row])).join(","))].join("\n");

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv;charset=utf-8",
      "Content-Disposition": `attachment; filename="Formatto_Seguimiento_${toDateOnly(new Date())}.csv"`
    }
  });
}
