import { z } from "zod";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDailyReport, saveDailyReportPdf, todayChile } from "@/lib/daily-report";
import { sendOutlookMail } from "@/lib/outlook-mail";
import { can, forbidden, getRequestRole, getRequestUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  recipients: z.array(z.string().email()).min(1),
  observations: z.string().optional()
});

export async function POST(request: NextRequest) {
  const role = getRequestRole(request);
  if (!can(role, "admin")) return forbidden("Solo admin puede enviar reportes por correo");

  const user = getRequestUser(request);
  const payload = payloadSchema.parse(await request.json());
  const date = payload.date ?? todayChile();
  const report = await getDailyReport(date);
  const saved = await saveDailyReportPdf(report);
  const sendDate = new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeZone: "America/Santiago" }).format(new Date());
  const reportDate = new Intl.DateTimeFormat("es-CL", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  const subject = `REPORTE DE ENTREGA DIARIA ${sendDate}`;
  const extra = payload.observations?.trim() ? `<p>${payload.observations.trim()}</p>` : "";
  const htmlBody = `
<div style="font-family: Arial, sans-serif; font-size: 11pt; color: #111111;">
  <p>Estimado(s),</p>
  <p>Se envia Reporte de Entrega Diaria correspondiente al dia ${reportDate}.</p>
  ${extra}
  <p>Saludos,</p>
  <p style="font-weight:700; color:#CE4620;">Departamento de Planificacion</p>
  <p style="font-size:9pt; color:#777777;">Control de Entregas - Formatto</p>
</div>`;
  const projectNames = report.projects.map((project) => project.project);
  let status: "enviado" | "error" = "enviado";
  let error: string | null = null;

  try {
    await sendOutlookMail({ recipients: payload.recipients, subject, htmlBody, attachment: saved.filePath });
  } catch (err) {
    status = "error";
    error = err instanceof Error ? err.message : "Error desconocido";
  }

  const senderProfile = user?.email ? await prisma.profile.findUnique({ where: { email: user.email } }) : null;
  const item = await prisma.reportDelivery.create({
    data: {
      reportDate: new Date(`${date}T12:00:00Z`),
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
