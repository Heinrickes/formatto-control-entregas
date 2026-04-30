import { NextRequest } from "next/server";
import { buildSummaryReportPdf, getSummaryReport, summaryReportFileName } from "@/lib/summary-report";
import { can, forbidden, getRequestRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const role = getRequestRole(request);
  if (!can(role, "operador")) return forbidden("Solo operador o admin puede generar PDF");

  const report = await getSummaryReport();
  if (!report) return Response.json({ error: "No hay tablero activo" }, { status: 404 });

  const pdf = buildSummaryReportPdf(report);
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${summaryReportFileName()}"`
    }
  });
}
