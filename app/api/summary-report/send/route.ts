import { z } from "zod";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { can, forbidden, getRequestRole, getRequestUser } from "@/lib/rbac";
import { sendOutlookMail } from "@/lib/outlook-mail";
import { getSummaryReport, saveSummaryReportPdf } from "@/lib/summary-report";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  recipients: z.array(z.string().email()).min(1),
  observations: z.string().optional()
});

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function displayDate(value = new Date()) {
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeZone: "America/Santiago" }).format(value);
}

export async function POST(request: NextRequest) {
  const role = getRequestRole(request);
  if (!can(role, "admin")) return forbidden("Solo admin puede enviar reportes por correo");

  const user = getRequestUser(request);
  const payload = payloadSchema.parse(await request.json());
  const report = await getSummaryReport();
  if (!report) return Response.json({ error: "No hay tablero activo" }, { status: 404 });
  const saved = await saveSummaryReportPdf(report);
  const projectNames = report.projectNames;

  const sendDate = displayDate();
  const extra = payload.observations?.trim() ? `<p>${escapeHtml(payload.observations.trim())}</p>` : "";
  const htmlBody = `<div style="font-family: Arial, sans-serif; font-size: 11pt; color: #111111;">
  <p>Estimado(s),</p>
  <p>Se envia Reporte de Entrega General correspondiente al dia ${sendDate}.</p>
  ${extra}
  <p>Saludos,</p>
  <p style="font-weight:700; color:#CE4620;">Departamento de Planificacion</p>
  <p style="font-size:9pt; color:#777777;">Control de Entregas - Formatto</p>
</div>`;

  let status: "enviado" | "error" = "enviado";
  let error: string | null = null;
  try {
    await sendOutlookMail({ recipients: payload.recipients, subject: `REPORTE DE ENTREGA GENERAL ${sendDate}`, htmlBody, attachment: saved.filePath });
  } catch (err) {
    status = "error";
    error = err instanceof Error ? err.message : "Error desconocido";
  }

  const senderProfile = user?.email ? await prisma.profile.findUnique({ where: { email: user.email } }) : null;
  const item = await prisma.reportDelivery.create({
    data: {
      reportDate: new Date(),
      senderEmail: user?.email ?? "sin-sesion",
      senderId: senderProfile?.id,
      recipients: payload.recipients,
      projects: projectNames,
      fileName: saved.fileName,
      filePath: saved.filePath,
      status,
      error
    }
  });

  return Response.json({ delivery: item, error }, { status: status === "enviado" ? 200 : 500 });
}
