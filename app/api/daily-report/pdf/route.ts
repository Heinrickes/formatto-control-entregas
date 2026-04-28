import { NextRequest } from "next/server";
import { buildDailyReportPdf, getDailyReport, reportFileName, todayChile } from "@/lib/daily-report";
import { can, forbidden, getRequestRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const role = getRequestRole(request);
  if (!can(role, "operador")) return forbidden("Solo operador o admin puede generar PDF");

  const date = request.nextUrl.searchParams.get("date") ?? todayChile();
  const report = await getDailyReport(date);
  const pdf = buildDailyReportPdf(report);
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${reportFileName(date)}"`
    }
  });
}
