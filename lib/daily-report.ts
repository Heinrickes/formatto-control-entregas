import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";

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
      progress: row.status?.state === "despachado" ? "100%" : row.status?.state === "cambio" ? "Reprogramado" : "0%",
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
      alerts,
      dayProgress: pct(dayCompleted, dayTasks),
      accumulatedProgress: pct(completed, totalTasks)
    },
    projects
  };
}

export function buildDailyReportPdf(report: DailyReport) {
  const reportDate = new Intl.DateTimeFormat("es-CL", { dateStyle: "long", timeZone: "UTC" }).format(ymdToUtc(report.date));
  const commands: string[][] = [];
  let current: string[] = [];
  let y = 0;

  const newPage = () => {
    current = [];
    commands.push(current);
    y = 800;
    current.push("0.98 0.98 0.97 rg 0 0 612 842 re f");
    current.push("1 1 1 rg 36 36 540 770 re f");
    current.push("0.88 0.86 0.82 RG 36 36 540 770 re S");
    current.push("0.07 0.07 0.07 rg 36 754 540 52 re f");
    current.push("0.81 0.27 0.13 rg 540 805 24 24 re f");
    text("CONTROL DE ENTREGAS - FORMATTO", 50, 817, 15, "1 1 1 rg");
    text(`Reporte Diario de Proyectos - ${reportDate}`, 50, 798, 9, "1 1 1 rg");
    y = 724;
  };

  const ensure = (height: number) => {
    if (y - height < 45) newPage();
  };

  function text(value: string, x: number, lineY: number, size = 9, color = "0.07 0.07 0.07 rg") {
    current.push("BT", color, `/F1 ${size} Tf`, `${x} ${lineY} Td`, `(${escapePdf(value)}) Tj`, "ET");
  }

  function rect(x: number, rectY: number, width: number, height: number, color = "1 1 1 rg") {
    current.push(color, `${x} ${rectY} ${width} ${height} re f`, "0.88 0.86 0.82 RG", `${x} ${rectY} ${width} ${height} re S`);
  }

  function orangeBox(x: number, rectY: number, width: number, height: number, color = "1 1 1 rg") {
    current.push(color, `${x} ${rectY} ${width} ${height} re f`, "0.81 0.27 0.13 RG", `${x} ${rectY} ${width} ${height} re S`);
  }

  function headerBox(x: number, rectY: number, width: number, height: number) {
    current.push("0.07 0.07 0.07 rg", `${x} ${rectY} ${width} ${height} re f`);
  }

  function card(label: string, value: string, x: number, width: number) {
    rect(x, y - 48, width, 44);
    current.push("0.81 0.27 0.13 RG", `${x} ${y - 8} ${width} 1 re S`);
    text(label.toUpperCase(), x + 8, y - 22, 7, "0.45 0.45 0.45 rg");
    text(value, x + 8, y - 40, 16);
  }

  function miniCard(label: string, value: string, x: number, top: number, width: number) {
    rect(x, top - 34, width, 30, "0.98 0.98 0.97 rg");
    current.push("0.81 0.27 0.13 RG", `${x} ${top - 7} ${width} 1 re S`);
    text(label.toUpperCase(), x + 5, top - 17, 6, "0.45 0.45 0.45 rg");
    text(value, x + 5, top - 30, 10);
  }

  function sectionTitle(value: string) {
    ensure(28);
    text(value.toUpperCase(), 50, y, 11);
    current.push("0.81 0.27 0.13 RG", `50 ${y - 6} 512 1 re S`);
    y -= 24;
  }

  newPage();
  sectionTitle("Resumen general");
  [
    ["Proyectos", String(report.summary.activeProjects)],
    ["Cumpl. hoy", `${report.summary.dayProgress}%`],
    ["Desp. hoy", String(report.summary.dayCompleted)],
    ["Pend. hoy", String(report.summary.dayPending)],
    ["Pend. total", String(report.summary.pending)],
    ["Alertas", String(report.summary.alerts)]
  ].forEach(([label, value], index) => card(label, value, 50 + index * 85, 78));
  y -= 62;

  sectionTitle("Detalle por proyecto");
  for (const project of report.projects) {
    const shownLate = Math.min(project.lateTasks.length, 5);
    const scheduledToday = project.tasks.filter((task) => task.scheduledAt === report.date);
    const shownTasks = Math.min(scheduledToday.length, 8);
    const blockHeight = 166 + shownLate * 13 + shownTasks * 12;
    ensure(blockHeight);
    orangeBox(50, y - blockHeight + 10, 512, blockHeight, "1 1 1 rg");
    const statusColor = project.lateOpen ? "0.75 0.12 0.09 rg" : "0.18 0.48 0.23 rg";
    text(project.project, 62, y - 10, 12);
    text(project.status, 440, y - 10, 9, statusColor);
    miniCard("Cumpl. hoy", `${project.dayProgress}%`, 62, y - 22, 82);
    miniCard("Cumpl. total", `${project.accumulatedProgress}%`, 154, y - 22, 82);
    miniCard("Pendientes", String(project.pending), 246, y - 22, 82);
    miniCard("Atrasos", String(project.lateOpen), 338, y - 22, 82);
    miniCard("Pend. hoy", String(project.todayPending), 430, y - 22, 82);
    text(`Observacion: ${project.observations}`, 62, y - 68, 8, "0.38 0.38 0.38 rg");
    let rowY = y - 86;
    if (project.lateTasks.length) {
      text("Tareas atrasadas abiertas", 62, rowY, 8, "0.75 0.12 0.09 rg");
      rowY -= 14;
      headerBox(62, rowY - 4, 438, 14);
      text("Tarea", 68, rowY, 7, "1 1 1 rg");
      text("Uds", 312, rowY, 7, "1 1 1 rg");
      text("Fecha", 350, rowY, 7, "1 1 1 rg");
      text("Atraso", 412, rowY, 7, "1 1 1 rg");
      rowY -= 16;
      project.lateTasks.slice(0, shownLate).forEach((task) => {
        text(`${task.type} - ${task.detail ?? "-"}`, 68, rowY, 7);
        text(String(task.units || "-"), 312, rowY, 7);
        text(displayDate(task.scheduledAt), 350, rowY, 7);
        text(`${task.daysLate}d`, 412, rowY, 7, "0.75 0.12 0.09 rg");
        rowY -= 12;
      });
      if (project.lateTasks.length > shownLate) text(`+ ${project.lateTasks.length - shownLate} tareas atrasadas adicionales`, 72, rowY, 7, "0.45 0.45 0.45 rg");
      rowY -= 12;
    } else {
      text("Sin tareas atrasadas abiertas.", 62, rowY, 8, "0.38 0.38 0.38 rg");
      rowY -= 18;
    }

    text("Tareas programadas del dia", 62, rowY, 8);
    rowY -= 14;
    headerBox(62, rowY - 4, 470, 14);
    text("Entrega", 68, rowY, 7, "1 1 1 rg");
    text("Uds", 228, rowY, 7, "1 1 1 rg");
    text("Responsable", 262, rowY, 7, "1 1 1 rg");
    text("F. prog.", 342, rowY, 7, "1 1 1 rg");
    text("Estado", 392, rowY, 7, "1 1 1 rg");
    text("Avance", 452, rowY, 7, "1 1 1 rg");
    text("Desfase", 500, rowY, 7, "1 1 1 rg");
    rowY -= 16;
    scheduledToday.slice(0, shownTasks).forEach((task) => {
      const variance = task.variance === null ? "-" : task.variance === 0 ? "En fecha" : `${task.variance}d`;
      text(`${task.type} - ${task.detail ?? "-"}`, 68, rowY, 7);
      text(String(task.units || "-"), 228, rowY, 7);
      text(task.responsible.slice(0, 18), 262, rowY, 7);
      text(displayDate(task.scheduledAt), 342, rowY, 7);
      text(task.state, 392, rowY, 7);
      text(task.progress, 452, rowY, 7);
      text(variance, 500, rowY, 7, task.variance && task.variance > 0 ? "0.75 0.12 0.09 rg" : "0.25 0.25 0.25 rg");
      rowY -= 12;
    });
    if (!scheduledToday.length) text("Sin tareas programadas para la fecha del reporte.", 68, rowY, 7, "0.45 0.45 0.45 rg");
    if (scheduledToday.length > shownTasks) text(`+ ${scheduledToday.length - shownTasks} tareas programadas adicionales`, 72, rowY, 7, "0.45 0.45 0.45 rg");
    y -= blockHeight + 12;
  }

  const objects: string[] = [];
  const pageIds: number[] = [];
  const fontId = 3;
  const pagesId = 2;
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  commands.forEach((pageCommands) => {
    const body = pageCommands.join("\n");
    const contentId = objects.length + 1;
    objects.push(`<< /Length ${Buffer.byteLength(body, "latin1")} >>\nstream\n${body}\nendstream`);
    const pageId = objects.length + 1;
    objects.push(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(pdf, "latin1");
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
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
