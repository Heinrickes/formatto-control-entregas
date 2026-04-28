import { NextRequest } from "next/server";
import { getDailyReport, todayChile } from "@/lib/daily-report";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? todayChile();
  return Response.json({ report: await getDailyReport(date) });
}
