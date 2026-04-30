import { execFile } from "child_process";
import { promisify } from "util";
import { z } from "zod";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { can, forbidden, getRequestRole, getRequestUser } from "@/lib/rbac";

const execFileAsync = promisify(execFile);
const payloadSchema = z.object({ recipients: z.array(z.string().email()).min(1) });

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

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const role = getRequestRole(request);
  if (!can(role, "admin")) return forbidden("Solo admin puede reenviar reportes");

  const original = await prisma.reportDelivery.findUnique({ where: { id: params.id } });
  if (!original) return Response.json({ error: "Reporte no encontrado" }, { status: 404 });

  const user = getRequestUser(request);
  const payload = payloadSchema.parse(await request.json());
  let status: "enviado" | "error" = "enviado";
  let error: string | null = null;

  try {
    const sendDate = new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeZone: "America/Santiago" }).format(new Date());
    const reportDate = new Intl.DateTimeFormat("es-CL", { dateStyle: "long", timeZone: "UTC" }).format(original.reportDate);
    await sendOutlookMail({
      recipients: payload.recipients,
    subject: `REPORTE DE ENTREGA DIARIA ${sendDate}`,
      htmlBody: `
<div style="font-family: Arial, sans-serif; font-size: 11pt; color: #111111;">
  <p>Estimado(s),</p>
  <p>Se reenvia Reporte de Entrega Diaria correspondiente al dia ${reportDate}.</p>
  <p>Saludos,</p>
  <p style="font-weight:700; color:#CE4620;">Departamento de Planificacion</p>
  <p style="font-size:9pt; color:#777777;">Control de Entregas - Formatto</p>
</div>`,
      attachment: original.filePath
    });
  } catch (err) {
    status = "error";
    error = err instanceof Error ? err.message : "Error desconocido";
  }

  const senderProfile = user?.email ? await prisma.profile.findUnique({ where: { email: user.email } }) : null;
  const item = await prisma.reportDelivery.create({
    data: {
      reportDate: original.reportDate,
      senderEmail: user?.email ?? "sin-sesion",
      senderId: senderProfile?.id,
      recipients: payload.recipients,
      projects: original.projects,
      fileName: original.fileName,
      filePath: original.filePath,
      status,
      error
    }
  });

  return Response.json({ delivery: item }, { status: status === "enviado" ? 200 : 500 });
}
