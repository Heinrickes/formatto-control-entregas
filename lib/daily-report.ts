import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { PdfLite } from "@/lib/pdf-lite";

const timeZone = "America/Santiago";

export type DailyProjectReport = {
  project: string;
  status: "Al dia" | "Con alertas" | "Con atraso";
  total: number;
  todayTotal: number;
  todayCompleted: number;
  todayPending: number;
  completed: number;
  pending: number;
  changes: number;
  partial: number;
  lateOpen: number;
  dayProgress: number;
  accumulatedProgress: number;
  observations: string;
  alerts: string[];
  lateTasks: Array<{
    id: string;
    type: string;
    detail: string | null;
    units: number;
    scheduledAt: string;
    daysLate: number;
    notes: string | null;
  }>;
  tasks: Array<{
    id: string;
    type: string;
    detail: string | null;
    units: number;
    scheduledAt: string;
    actualAt: string;
    state: string;
    variance: number | null;
    responsible: string;
    progress: string;
    notes: string | null;
  }>;
};

export type DailyReport = {
  date: string;
  generatedAt: string;
  summary: {
    activeProjects: number;
    totalTasks: number;
    dayTasks: number;
    dayCompleted: number;
    dayPending: number;
    pending: number;
    alerts: number;
    partial: number;
    dayProgress: number;
    accumulatedProgress: number;
  };
  projects: DailyProjectReport[];
};

export function todayChile() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function ymdToUtc(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function dateOnly(value: Date | null | undefined) {
  if (!value) return "";
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function displayDate(value: string) {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}-${month}-${year}`;
}

function pct(done: number, total: number) {
  return total ? Math.round((done / total) * 100) : 0;
}

function dateVariance(scheduledAt: Date | null | undefined, actualAt: Date | null | undefined) {
  if (!scheduledAt || !actualAt) return null;
  const scheduled = ymdToUtc(dateOnly(scheduledAt));
  const actual = ymdToUtc(dateOnly(actualAt));
  return Math.round((actual.getTime() - scheduled.getTime()) / 86400000);
}

function cleanText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escapePdf(value: string) {
  return cleanText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(value: string, max = 95) {
  const words = cleanText(value).split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > max) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function getDailyReport(date = todayChile()): Promise<DailyReport> {
  const program = await prisma.program.findFirst({
    where: { active: true },
    include: {
      dispatches: {
        include: { status: true },
        orderBy: [{ project: "asc" }, { scheduledAt: "asc" }]
      }
    }
  });

  const rows = program?.dispatches ?? [];
  const byProject = new Map<string, typeof rows>();
  for (const row of rows) {
    byProject.set(row.project, [...(byProject.get(row.project) ?? []), row]);
  }

  const projects = Array.from(byProject.entries()).map(([project, projectRows]) => {
    const todayRows = projectRows.filter((row) => dateOnly(row.scheduledAt) === date);
    const openRows = projectRows.filter((row) => row.status?.state !== "despachado");
    const lateOpenRows = openRows.filter((row) => dateOnly(row.scheduledAt) < date);
    const lateTasks = lateOpenRows.map((row) => ({
      id: row.id,
      type: row.type,
      detail: row.detail,
      units: row.units,
      scheduledAt: dateOnly(row.scheduledAt),
      daysLate: Math.max(1, Math.floor((ymdToUtc(date).getTime() - ymdToUtc(dateOnly(row.scheduledAt)).getTime()) / 86400000)),
      notes: row.status?.notes ?? null
    }));
    const todayCompleted = todayRows.filter((row) => row.status?.state === "despachado").length;
    const todayPending = todayRows.filter((row) => row.status?.state !== "despachado").length;
    const completed = projectRows.filter((row) => row.status?.state === "despachado").length;
    const partial = projectRows.filter((row) => row.status?.state === "parcial").length;
    const changes = projectRows.filter((row) => row.status?.state === "cambio").length;
    const tasks = projectRows.map((row) => ({
      id: row.id,
      type: row.type,
      detail: row.detail,
      units: row.units,
      scheduledAt: dateOnly(row.scheduledAt),
      actualAt: dateOnly(row.status?.actualAt),
      state: row.status?.state ?? "pendiente",
      variance: dateVariance(row.scheduledAt, row.status?.actualAt),
      responsible: row.status?.updatedBy ?? "Planificacion",
      progress: row.status?.state === "despachado" ? "100%" : row.status?.state === "parcial" ? "Parcial" : row.status?.state === "cambio" ? "Reprogramado" : "0%",
      notes: row.status?.notes ?? null
    }));
    const alerts = [
      ...(lateOpenRows.length ? [`${lateOpenRows.length} tarea(s) atrasada(s) sin despacho.`] : []),
      ...(changes ? [`${changes} tarea(s) en estado cambio.`] : [])
    ];

    return {
      project,
      status: lateOpenRows.length ? "Con atraso" : alerts.length ? "Con alertas" : "Al dia",
      total: projectRows.length,
      todayTotal: todayRows.length,
      todayCompleted,
      todayPending,
      completed,
      pending: openRows.length,
      changes,
      partial,
      lateOpen: lateOpenRows.length,
      dayProgress: pct(todayCompleted, todayRows.length),
      accumulatedProgress: pct(completed, projectRows.length),
      observations: lateOpenRows.length
        ? "Requiere gestion prioritaria para recuperar atrasos abiertos."
        : todayPending
          ? "Mantener seguimiento de compromisos del dia."
          : todayRows.length
            ? "Compromisos del dia completados o sin alertas relevantes."
            : "Sin entregas programadas para la fecha.",
      alerts,
      lateTasks,
      tasks
    } satisfies DailyProjectReport;
  }).sort((a, b) => b.lateOpen - a.lateOpen || b.todayPending - a.todayPending || a.project.localeCompare(b.project));

  const totalTasks = rows.length;
  const dayTasks = projects.reduce((sum, item) => sum + item.todayTotal, 0);
  const dayCompleted = projects.reduce((sum, item) => sum + item.todayCompleted, 0);
  const dayPending = projects.reduce((sum, item) => sum + item.todayPending, 0);
  const pending = projects.reduce((sum, item) => sum + item.pending, 0);
  const partial = projects.reduce((sum, item) => sum + item.partial, 0);
  const alerts = projects.reduce((sum, item) => sum + item.lateOpen + item.changes, 0);
  const completed = projects.reduce((sum, item) => sum + item.completed, 0);

  return {
    date,
    generatedAt: new Date().toISOString(),
    summary: {
      activeProjects: projects.length,
      totalTasks,
      dayTasks,
      dayCompleted,
      dayPending,
      pending,
      partial,
      alerts,
      dayProgress: pct(dayCompleted, dayTasks),
      accumulatedProgress: pct(completed, totalTasks)
    },
    projects
  };
}

export function buildDailyReportPdf(report: DailyReport) {
  const reportDate = new Intl.DateTimeFormat("es-CL", { dateStyle: "long", timeZone: "UTC" }).format(ymdToUtc(report.date));
  const pdf = new PdfLite("Reporte de Entrega Diaria", `Control de Entregas - Formatto - ${reportDate}`);

  pdf.section("Resumen general");
  [
    ["Proyectos", report.summary.activeProjects],
    ["Cumpl. hoy", `${report.summary.dayProgress}%`],
    ["Desp. hoy", report.summary.dayCompleted],
    ["Parciales", report.summary.partial],
    ["Pend. hoy", report.summary.dayPending],
    ["Pend. total", report.summary.pending],
    ["Alertas", report.summary.alerts]
  ].forEach(([label, value], index) => pdf.card(String(label), String(value), 50 + index * 73, pdf.y, 66));
  pdf.y -= 62;

  let detailTitlePending = true;
  for (const project of report.projects) {
    const shownLate = Math.min(project.lateTasks.length, 5);
    const scheduledToday = project.tasks.filter((task) => task.scheduledAt === report.date);
    const shownTasks = Math.min(scheduledToday.length, 8);
    const blockHeight = 150 + shownLate * 24 + Math.max(1, shownTasks) * 22;
    if (detailTitlePending) {
      pdf.ensure(28 + blockHeight);
      pdf.section("Detalle por proyecto");
      detailTitlePending = false;
    }
    pdf.ensure(blockHeight);
    pdf.fill(50, pdf.y - blockHeight + 8, 512, blockHeight, "1 1 1 rg");
    pdf.stroke(50, pdf.y - blockHeight + 8, 512, blockHeight, "0.90 0.89 0.86 RG");
    pdf.fill(50, pdf.y - 8, project.lateOpen ? 92 : 54, 1, project.lateOpen ? "0.81 0.27 0.13 rg" : "0.86 0.85 0.82 rg");
    pdf.wrappedText(project.project, 62, pdf.y - 23, 58, 1, 12);
    pdf.text(project.status, 444, pdf.y - 23, 8, project.lateOpen ? "0.75 0.12 0.09 rg" : "0.18 0.48 0.23 rg");
    [
      ["Cumpl. hoy", `${project.dayProgress}%`],
      ["Cumpl. total", `${project.accumulatedProgress}%`],
      ["Pendientes", project.pending],
      ["Parciales", project.partial],
      ["Atrasos", project.lateOpen],
      ["Pend. hoy", project.todayPending]
    ].forEach(([label, value], index) => pdf.card(String(label), String(value), 62 + index * 76, pdf.y - 40, 68, 32));
    pdf.wrappedText(`Observacion: ${project.observations}`, 62, pdf.y - 82, 108, 2, 6.5, "0.38 0.38 0.38 rg", 8);
    let rowY = pdf.y - 106;
    if (project.lateTasks.length) {
      pdf.text("Tareas atrasadas abiertas", 62, rowY, 8, "0.75 0.12 0.09 rg");
      rowY -= 12;
      pdf.tableHeader(62, rowY, [238, 38, 62, 56, 86], ["Tarea", "Uds", "Fecha", "Atraso", "Notas"]);
      rowY -= 15;
      project.lateTasks.slice(0, shownLate).forEach((task) => {
        pdf.tableRow(62, rowY, [238, 38, 62, 56, 86], [`${task.type} - ${task.detail ?? "-"}`, task.units || "-", displayDate(task.scheduledAt), `${task.daysLate}d`, task.notes ?? "-"], { height: 24 });
        rowY -= 24;
      });
      if (project.lateTasks.length > shownLate) pdf.text(`+ ${project.lateTasks.length - shownLate} tareas atrasadas adicionales`, 72, rowY - 8, 7, "0.45 0.45 0.45 rg");
      rowY -= 14;
    } else {
      pdf.text("Sin tareas atrasadas abiertas.", 62, rowY, 8, "0.38 0.38 0.38 rg");
      rowY -= 16;
    }

    pdf.text("Tareas programadas del dia", 62, rowY, 8);
    rowY -= 12;
    pdf.tableHeader(62, rowY, [158, 34, 78, 52, 58, 46, 46], ["Entrega", "Uds", "Responsable", "F. prog.", "Estado", "Avance", "Desfase"]);
    rowY -= 15;
    scheduledToday.slice(0, shownTasks).forEach((task) => {
      const variance = task.variance === null ? "-" : task.variance === 0 ? "En fecha" : `${task.variance}d`;
      pdf.tableRow(62, rowY, [158, 34, 78, 52, 58, 46, 46], [`${task.type} - ${task.detail ?? "-"}`, task.units || "-", task.responsible, displayDate(task.scheduledAt), task.state, task.progress, variance], { height: 22 });
      rowY -= 22;
    });
    if (!scheduledToday.length) pdf.text("Sin tareas programadas para la fecha del reporte.", 68, rowY - 10, 7, "0.45 0.45 0.45 rg");
    if (scheduledToday.length > shownTasks) pdf.text(`+ ${scheduledToday.length - shownTasks} tareas programadas adicionales`, 72, rowY - 8, 7, "0.45 0.45 0.45 rg");
    pdf.y -= blockHeight + 14;
  }
  return pdf.output();
}

export function reportFileName(date: string) {
  return `reporte-diario-formatto-${date}.pdf`;
}

export function reportsDir() {
  return path.join(process.cwd(), "reports");
}

export async function saveDailyReportPdf(report: DailyReport) {
  const dir = reportsDir();
  await mkdir(dir, { recursive: true });
  const fileName = reportFileName(report.date);
  const filePath = path.join(dir, `${Date.now()}-${fileName}`);
  const pdf = buildDailyReportPdf(report);
  await writeFile(filePath, pdf);
  return { fileName, filePath, pdf };
}
