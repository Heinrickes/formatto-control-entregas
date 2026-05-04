import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function dateOnly(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function ymdToUtc(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function isBusinessDay(date: Date) {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function businessDiffDays(scheduled: Date, actual?: Date | null) {
  if (!actual) return null;
  const start = ymdToUtc(dateOnly(scheduled));
  const end = ymdToUtc(dateOnly(actual));
  if (start.getTime() === end.getTime()) return 0;
  const direction = end > start ? 1 : -1;
  const cursor = new Date(start);
  let count = 0;
  while ((direction > 0 && cursor < end) || (direction < 0 && cursor > end)) {
    cursor.setUTCDate(cursor.getUTCDate() + direction);
    if (isBusinessDay(cursor)) count += direction;
  }
  return count;
}

export async function GET(request: NextRequest) {
  const programId = request.nextUrl.searchParams.get("programId");
  const program =
    programId
      ? await prisma.program.findUnique({
          where: { id: programId },
          include: { dispatches: { include: { status: true }, orderBy: [{ sortOrder: "asc" }] } }
        })
      : await prisma.program.findFirst({
          where: { active: true },
          include: { dispatches: { include: { status: true }, orderBy: [{ sortOrder: "asc" }] } }
        });

  if (!program) {
    return Response.json({
      program: null,
      summary: { total: 0, dispatched: 0, partial: 0, pending: 0, changes: 0, completion: 0, averageDelay: null, onTime: 0, late: 0, early: 0, onTimeRate: 0 },
      projectPerformance: [],
      businessLinePerformance: [],
      dispatches: []
    });
  }

  const total = program.dispatches.length;
  const dispatched = program.dispatches.filter((d) => d.status?.state === "despachado").length;
  const partial = program.dispatches.filter((d) => d.status?.state === "parcial").length;
  const changes = program.dispatches.filter((d) => d.status?.state === "cambio").length;
  const pending = total - dispatched - partial - changes;
  const diffs = program.dispatches
    .filter((d) => d.status?.state === "despachado" && d.status.actualAt)
    .map((d) => businessDiffDays(d.scheduledAt, d.status?.actualAt))
    .filter((value): value is number => value !== null);
  const averageDelay = diffs.length ? Math.round(diffs.reduce((sum, value) => sum + value, 0) / diffs.length) : null;
  const onTime = diffs.filter((value) => value === 0).length;
  const late = diffs.filter((value) => value > 0).length;
  const early = diffs.filter((value) => value < 0).length;

  const byProject = new Map<string, { project: string; total: number; dispatched: number; partial: number; onTime: number; late: number; early: number }>();
  const byBusinessLine = new Map<string, { businessLine: string; total: number; dispatched: number; partial: number; pending: number; changes: number }>();
  for (const dispatch of program.dispatches) {
    const item = byProject.get(dispatch.project) ?? { project: dispatch.project, total: 0, dispatched: 0, partial: 0, onTime: 0, late: 0, early: 0 };
    const lineName = dispatch.businessLine || "Constructora";
    const lineItem = byBusinessLine.get(lineName) ?? { businessLine: lineName, total: 0, dispatched: 0, partial: 0, pending: 0, changes: 0 };
    lineItem.total++;
    if (dispatch.status?.state === "despachado") lineItem.dispatched++;
    else if (dispatch.status?.state === "parcial") lineItem.partial++;
    else if (dispatch.status?.state === "cambio") lineItem.changes++;
    else lineItem.pending++;
    byBusinessLine.set(lineName, lineItem);

    item.total++;
    if (dispatch.status?.state === "parcial") item.partial++;
    if (dispatch.status?.state === "despachado") {
      item.dispatched++;
      const diff = businessDiffDays(dispatch.scheduledAt, dispatch.status.actualAt);
      if (diff === 0) item.onTime++;
      if (diff !== null && diff > 0) item.late++;
      if (diff !== null && diff < 0) item.early++;
    }
    byProject.set(dispatch.project, item);
  }

  return Response.json({
    program,
    summary: {
      total,
      dispatched,
      partial,
      pending,
      changes,
      completion: total ? Math.round((dispatched / total) * 100) : 0,
      averageDelay,
      onTime,
      late,
      early,
      projects: byProject.size,
      onTimeRate: dispatched ? Math.round((onTime / dispatched) * 100) : 0,
      lateRate: dispatched ? Math.round((late / dispatched) * 100) : 0,
      earlyRate: dispatched ? Math.round((early / dispatched) * 100) : 0
    },
    projectPerformance: Array.from(byProject.values()).map((item) => ({
      ...item,
      completion: item.total ? Math.round((item.dispatched / item.total) * 100) : 0,
      onTimeRate: item.dispatched ? Math.round((item.onTime / item.dispatched) * 100) : 0,
      lateRate: item.dispatched ? Math.round((item.late / item.dispatched) * 100) : 0,
      earlyRate: item.dispatched ? Math.round((item.early / item.dispatched) * 100) : 0
    })),
    businessLinePerformance: Array.from(byBusinessLine.values()).map((item) => ({
      ...item,
      completion: item.total ? Math.round((item.dispatched / item.total) * 100) : 0
    })),
    dispatches: program.dispatches
  });
}
