import { execFile } from "child_process";
import { promisify } from "util";
import { z } from "zod";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDailyReport, saveDailyReportPdf, todayChile } from "@/lib/daily-report";
import { can, forbidden, getRequestRole, getRequestUser } from "@/lib/rbac";

const execFileAsync = promisify(execFile);

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  recipients: z.array(z.string().email()).min(1),
  observations: z.string().optional()
});

async function sendOutlookMail({ recipients, subject, htmlBody, attachment }: { recipients: string[]; subject: string; htmlBody: string; attachment: string }) {
  const command = `
$outlook = New-Object -ComObject Outlook.Application
$mail = $outlook.CreateItem(0)
$mail.To = ${JSON.stringify(recipients.join(";"))}
$mail.Subject = ${JSON.stringify(subject)}
$mail.HTMLBody = ${JSON.stringify(htmlBody)}
$mail.Attachments.Add(${JSON.stringify(attachment)}) | Out-Null
$mail.Send()
`;
  await execFileAsync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], { timeout: 60000 });
}

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
  const subject = `REPORTE DE ENTREGAS ${sendDate}`;
  const extra = payload.observations?.trim() ? `<p>${payload.observations.trim()}</p>` : "";
  const htmlBody = `
<div style="font-family: Arial, sans-serif; font-size: 11pt; color: #111111;">
  <p>Estimado(s),</p>
  <p>Se envia Reporte de Entregas correspondientes al dia ${reportDate}.</p>
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

  return Response.json({ delivery: item }, { status: status === "enviado" ? 200 : 500 });
}
