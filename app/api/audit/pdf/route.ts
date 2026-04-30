import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditActionLabel, auditDetailLines } from "@/lib/audit-format";
import { PdfLite, wrapPdfText } from "@/lib/pdf-lite";
import { can, forbidden, getRequestRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

function displayDate(value: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Santiago"
  }).format(value);
}

function buildWhere(request: NextRequest) {
  const user = request.nextUrl.searchParams.get("user")?.trim();
  const action = request.nextUrl.searchParams.get("action")?.trim();
  const date = request.nextUrl.searchParams.get("date")?.trim();
  const project = request.nextUrl.searchParams.get("project")?.trim();
  const where: Prisma.AuditLogWhereInput = {};

  if (user) where.actorEmail = { contains: user, mode: "insensitive" };
  if (action && action !== "todos") where.action = action;
  if (project) where.summary = { contains: project, mode: "insensitive" };
  if (date) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);
    where.createdAt = { gte: start, lte: end };
  }
  return where;
}

export async function GET(request: NextRequest) {
  const role = getRequestRole(request);
  if (!can(role, "admin")) return forbidden("Solo admin puede exportar bitacora");

  const logs = await prisma.auditLog.findMany({
    where: buildWhere(request),
    orderBy: { createdAt: "desc" },
    take: 300
  });

  const reportDate = new Intl.DateTimeFormat("es-CL", { dateStyle: "long", timeZone: "America/Santiago" }).format(new Date());
  const pdf = new PdfLite("Bitacora de Cambios", `Control de Entregas - Formatto - ${reportDate}`);
  pdf.section("Cambios registrados");

  for (const log of logs) {
    const summaryLines = wrapPdfText(log.summary, 95);
    const details = auditDetailLines(log.details).flatMap((line) => wrapPdfText(line, 98));
    const blockHeight = 54 + summaryLines.length * 8 + details.length * 8;

    pdf.ensure(blockHeight + 10);
    const top = pdf.y;
    pdf.fill(50, top - blockHeight, 512, blockHeight, "1 1 1 rg");
    pdf.stroke(50, top - blockHeight, 512, blockHeight, "0.90 0.89 0.86 RG");
    pdf.fill(50, top - 3, 512, 1, "0.81 0.27 0.13 rg");

    pdf.text(displayDate(log.createdAt), 60, top - 17, 7, "0.28 0.28 0.28 rg");
    pdf.text(auditActionLabel(log.action).toUpperCase(), 184, top - 17, 7, "0.07 0.07 0.07 rg");
    pdf.text(log.actorEmail, 354, top - 17, 7, "0.28 0.28 0.28 rg");

    let lineY = top - 34;
    pdf.text("CAMBIO", 60, lineY, 5.8, "0.45 0.45 0.45 rg");
    lineY -= 9;
    summaryLines.forEach((line) => {
      pdf.text(line, 60, lineY, 7, "0.10 0.10 0.10 rg");
      lineY -= 8;
    });

    lineY -= 4;
    pdf.text("DETALLE COMPLETO", 60, lineY, 5.8, "0.45 0.45 0.45 rg");
    lineY -= 9;
    details.forEach((line) => {
      pdf.text(line, 60, lineY, 6.8, "0.10 0.10 0.10 rg");
      lineY -= 8;
    });

    pdf.y -= blockHeight + 10;
  }

  if (!logs.length) {
    pdf.tableRow(50, pdf.y, [512], ["Sin cambios para los filtros seleccionados."], { height: 24 });
  }

  return new Response(pdf.output(), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="bitacora-control-entregas-formatto.pdf"`
    }
  });
}
