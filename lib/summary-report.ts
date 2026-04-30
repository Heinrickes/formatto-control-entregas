import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { dayDiff, shortDate } from "@/lib/dates";
import { PdfLite } from "@/lib/pdf-lite";

export async function getSummaryReport() {
  const program = await prisma.program.findFirst({
    where: { active: true },
    include: { dispatches: { include: { status: true }, orderBy: [{ project: "asc" }, { scheduledAt: "asc" }] } }
  });
  if (!program) return null;

  const today = new Date();
  const total = program.dispatches.length;
  const dispatched = program.dispatches.filter((row) => row.status?.state === "despachado").length;
  const partial = program.dispatches.filter((row) => row.status?.state === "parcial").length;
  const changes = program.dispatches.filter((row) => row.status?.state === "cambio").length;
  const pending = total - dispatched - partial - changes;
  const urgent = program.dispatches
    .filter((row) => (row.status?.state ?? "pendiente") !== "despachado")
    .map((row) => ({ row, diff: dayDiff(row.scheduledAt, today) ?? 0 }))
    .filter((item) => item.diff >= 0 || Math.abs(item.diff) <= 3)
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 16);

  const grouped = Array.from(
    program.dispatches.reduce((map, row) => {
      map.set(row.project, [...(map.get(row.project) ?? []), row]);
      return map;
    }, new Map<string, typeof program.dispatches>())
  ).map(([project, rows]) => {
    const projectTotal = rows.length;
    const projectDispatched = rows.filter((row) => row.status?.state === "despachado").length;
    const projectPartial = rows.filter((row) => row.status?.state === "parcial").length;
    const projectChanges = rows.filter((row) => row.status?.state === "cambio").length;
    const projectPending = projectTotal - projectDispatched - projectPartial - projectChanges;
    const openLate = rows.filter((row) => (row.status?.state ?? "pendiente") !== "despachado" && (dayDiff(row.scheduledAt, today) ?? 0) > 0).length;
    return {
      project,
      rows,
      total: projectTotal,
      dispatched: projectDispatched,
      partial: projectPartial,
      pending: projectPending,
      changes: projectChanges,
      openLate,
      completion: projectTotal ? Math.round((projectDispatched / projectTotal) * 100) : 0
    };
  }).sort((a, b) => b.openLate - a.openLate || b.pending - a.pending || a.project.localeCompare(b.project));

  return {
    programName: program.name,
    generatedAt: today,
    total,
    dispatched,
    partial,
    changes,
    pending,
    completion: total ? Math.round((dispatched / total) * 100) : 0,
    urgent,
    grouped,
    projectNames: grouped.map((group) => group.project)
  };
}

export type SummaryReport = NonNullable<Awaited<ReturnType<typeof getSummaryReport>>>;

export function buildSummaryReportPdf(report: SummaryReport) {
  const reportDate = new Intl.DateTimeFormat("es-CL", { dateStyle: "long", timeZone: "America/Santiago" }).format(report.generatedAt);
  const pdf = new PdfLite("Reporte de Entrega General", `Control de Entregas - Formatto - ${reportDate}`);

  pdf.section("Resumen general");
  [
    ["Total", report.total],
    ["Despachados", report.dispatched],
    ["Parciales", report.partial],
    ["Pendientes", report.pending],
    ["Cambios", report.changes],
    ["Cumplimiento", `${report.completion}%`]
  ].forEach(([label, value], index) => pdf.card(String(label), String(value), 50 + index * 85, pdf.y, 78));
  pdf.y -= 62;

  pdf.section("Entregas urgentes");
  pdf.tableHeader(50, pdf.y, [112, 178, 68, 78, 76], ["Proyecto", "Entrega", "Fecha", "Estado tiempo", "Notas"]);
  pdf.y -= 15;
  if (report.urgent.length === 0) {
    pdf.tableRow(50, pdf.y, [512], ["Sin entregas urgentes."], { height: 22 });
    pdf.y -= 28;
  } else {
    for (const item of report.urgent) {
      pdf.ensure(28);
      const state = item.diff > 0 ? `${item.diff}d atrasado` : item.diff === 0 ? "Hoy" : `${Math.abs(item.diff)}d por vencer`;
      pdf.tableRow(50, pdf.y, [112, 178, 68, 78, 76], [item.row.project, `${item.row.type} - ${item.row.detail ?? "-"}`, shortDate(item.row.scheduledAt), state, item.row.status?.notes ?? ""], { height: 26 });
      pdf.y -= 26;
    }
  }

  pdf.y -= 10;
  let detailTitlePending = true;
  for (const group of report.grouped) {
    const rowsToShow = group.rows.slice(0, 10);
    const blockHeight = 86 + Math.max(1, rowsToShow.length) * 22;
    if (detailTitlePending) {
      pdf.ensure(28 + blockHeight);
      pdf.section("Detalle por proyecto");
      detailTitlePending = false;
    }
    pdf.ensure(blockHeight);
    pdf.fill(50, pdf.y - blockHeight + 8, 512, blockHeight, "1 1 1 rg");
    pdf.stroke(50, pdf.y - blockHeight + 8, 512, blockHeight, "0.90 0.89 0.86 RG");
    pdf.fill(50, pdf.y - 8, group.openLate ? 92 : 54, 1, group.openLate ? "0.81 0.27 0.13 rg" : "0.86 0.85 0.82 rg");
    pdf.wrappedText(group.project, 62, pdf.y - 23, 58, 1, 12);
    [
      ["Cumpl.", `${group.completion}%`],
      ["Total", group.total],
      ["Pend.", group.pending],
      ["Parc.", group.partial],
      ["Atraso", group.openLate]
    ].forEach(([label, value], index) => pdf.card(String(label), String(value), 210 + index * 67, pdf.y - 14, 58, 30));
    let rowY = pdf.y - 58;
    pdf.tableHeader(62, rowY, [158, 34, 58, 58, 58, 48, 56], ["Entrega", "Uds", "F. Prog.", "F. Real", "Desfase", "Estado", "Notas"]);
    rowY -= 15;
    for (const row of rowsToShow) {
      const state = row.status?.state ?? "pendiente";
      const diff = row.status?.actualAt ? dayDiff(row.scheduledAt, row.status.actualAt) : dayDiff(row.scheduledAt, report.generatedAt);
      const variance = state === "despachado" ? (diff === 0 ? "En fecha" : `${diff}d`) : diff && diff > 0 ? `${diff}d atraso` : "Pendiente";
      pdf.tableRow(62, rowY, [158, 34, 58, 58, 58, 48, 56], [`${row.type} - ${row.detail ?? "-"}`, row.units || "-", shortDate(row.scheduledAt), shortDate(row.status?.actualAt), variance, state, row.status?.notes ?? ""], { height: 22 });
      rowY -= 22;
    }
    if (group.rows.length > rowsToShow.length) pdf.text(`+ ${group.rows.length - rowsToShow.length} entregas adicionales del proyecto`, 68, rowY - 8, 7, "0.45 0.45 0.45 rg");
    pdf.y -= blockHeight + 14;
  }

  return pdf.output();
}

export function summaryReportFileName() {
  return `resumen-entregas-formatto-${new Date().toISOString().slice(0, 10)}.pdf`;
}

export async function saveSummaryReportPdf(report: SummaryReport) {
  const dir = path.join(process.cwd(), "reports");
  await mkdir(dir, { recursive: true });
  const fileName = summaryReportFileName();
  const filePath = path.join(dir, `${Date.now()}-${fileName}`);
  const pdf = buildSummaryReportPdf(report);
  await writeFile(filePath, pdf);
  return { fileName, filePath, pdf };
}
