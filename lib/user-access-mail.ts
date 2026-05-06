import { randomInt } from "crypto";
import { sendOutlookMail } from "@/lib/outlook-mail";
import { areaPrefixes, userAreas } from "@/lib/users";

type AccessUser = {
  email: string;
  fullName: string;
  role: string;
  area: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function generateAccessPassword(area?: string | null) {
  const safeArea = userAreas.find((item) => item === area) ?? "Planificacion y Adquisiciones";
  const prefix = areaPrefixes[safeArea];
  return `${prefix}${randomInt(10, 100)}`;
}

export function getAppAccessUrl(request: Request) {
  const configured = process.env.FORMATTO_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const origin = request.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");

  const host = request.headers.get("host");
  const protocol = host?.includes("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https";
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

export async function sendUserAccessMail({
  user,
  password,
  appUrl,
}: {
  user: AccessUser;
  password: string;
  appUrl: string;
}) {
  const subject = "ACCESO CONTROL DE ENTREGAS - FORMATTO";
  const htmlBody = `
<div style="font-family: Arial, sans-serif; font-size: 11pt; color: #111111;">
  <p>Estimado(a) ${escapeHtml(user.fullName)},</p>
  <p>Se envia tu acceso a la aplicacion Control de Entregas - Formatto.</p>
  <table style="border-collapse: collapse; margin: 14px 0; font-size: 10.5pt;">
    <tr>
      <td style="padding: 6px 10px; border: 1px solid #dddddd; font-weight: 700;">Aplicacion</td>
      <td style="padding: 6px 10px; border: 1px solid #dddddd;"><a href="${escapeHtml(appUrl)}">Control de Entregas - Formatto</a></td>
    </tr>
    <tr>
      <td style="padding: 6px 10px; border: 1px solid #dddddd; font-weight: 700;">Usuario</td>
      <td style="padding: 6px 10px; border: 1px solid #dddddd;">${escapeHtml(user.email)}</td>
    </tr>
    <tr>
      <td style="padding: 6px 10px; border: 1px solid #dddddd; font-weight: 700;">Clave temporal</td>
      <td style="padding: 6px 10px; border: 1px solid #dddddd; font-weight: 700;">${escapeHtml(password)}</td>
    </tr>
  </table>
  <p>Al ingresar, el sistema solicitara cambiar la clave.</p>
  <p>Saludos,</p>
  <p style="font-weight:700; color:#CE4620;">Departamento de Planificacion</p>
  <p style="font-size:9pt; color:#777777;">Control de Entregas - Formatto</p>
</div>`;

  await sendOutlookMail({
    recipients: [user.email],
    subject,
    htmlBody,
  });
}
