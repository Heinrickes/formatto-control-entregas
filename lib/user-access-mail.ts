import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from "crypto";
import path from "path";
import { prisma } from "@/lib/prisma";
import type { AuthUser } from "@/lib/auth";
import { sendOutlookMail } from "@/lib/outlook-mail";
import { areaPrefixes, userAreas } from "@/lib/users";

type AccessUser = {
  email: string;
  fullName: string;
  role: string;
  area: string | null;
};

const accessAuditRecipient = "enrique.arenas@formatto.cl";
const accessSender = "enrique.arenas@formatto.cl";
const defaultAppUrl = "https://formatto-control-entregas.vercel.app";
const formattoLogoCid = "formatto-logo";
const formattoLogoPath = path.join(process.cwd(), "public", "formatto-logo.png");

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

function accessSecretKey() {
  const secret = process.env.FORMATTO_ACCESS_SECRET ?? process.env.FORMATTO_AUTH_SECRET ?? "dev-secret-change-me";
  return createHash("sha256").update(secret).digest();
}

export function encryptAccessPassword(password: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", accessSecretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptAccessPassword(cipherText: string) {
  const [ivValue, tagValue, encryptedValue] = cipherText.split(":");
  if (!ivValue || !tagValue || !encryptedValue) return "";
  const decipher = createDecipheriv("aes-256-gcm", accessSecretKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export async function recordUserAccessSecret({
  user,
  password,
  action,
  actor,
}: {
  user: AccessUser & { id: string };
  password: string;
  action: string;
  actor: AuthUser | null;
}) {
  await prisma.userAccessSecret.create({
    data: {
      profileId: user.id,
      profileEmail: user.email,
      profileName: user.fullName,
      passwordCipher: encryptAccessPassword(password),
      action,
      sentByEmail: actor?.email ?? "sin-sesion"
    }
  });
}

export function getAppAccessUrl(request: Request) {
  const configured = process.env.FORMATTO_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return defaultAppUrl;
}

function formattoSignature() {
  return `
  <table style="border-collapse: collapse; margin-top: 18px; font-family: Arial, sans-serif; color: #111111;">
    <tr>
      <td style="padding: 0 18px 0 0; vertical-align: middle;">
        <img src="cid:${formattoLogoCid}" alt="Formatto" style="display:block; width: 230px; height: auto;" />
      </td>
      <td style="border-left: 2px solid #555555; padding: 0 0 0 16px; vertical-align: middle; font-size: 11pt; line-height: 1.35;">
        <div style="font-size: 13pt; font-weight: 700;">Enrique Arenas D.</div>
        <div style="font-size: 12pt; font-weight: 700; margin-bottom: 16px;">Jefe de Planificacion</div>
        <div>(+562) 2587 9900</div>
        <div>Longitudinal Sur KM 43.5, Parcela 251 - Paine - Stgo</div>
        <div><a href="https://www.formatto.cl" style="color:#111111; text-decoration:none;">www.formatto.cl</a></div>
      </td>
    </tr>
  </table>`;
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
  ${formattoSignature()}
</div>`;

  await sendOutlookMail({
    recipients: Array.from(new Set([user.email, accessAuditRecipient])),
    subject,
    htmlBody,
    from: accessSender,
    inlineImages: [{ path: formattoLogoPath, contentId: formattoLogoCid }],
  });
}

export async function sendAdminAccessNotice({
  user,
  password,
  action,
}: {
  user: AccessUser;
  password: string;
  action: string;
}) {
  const subject = "REGISTRO CLAVE CONTROL DE ENTREGAS - FORMATTO";
  const htmlBody = `
<div style="font-family: Arial, sans-serif; font-size: 11pt; color: #111111;">
  <p>Se registro un cambio de clave en Control de Entregas - Formatto.</p>
  <table style="border-collapse: collapse; margin: 14px 0; font-size: 10.5pt;">
    <tr>
      <td style="padding: 6px 10px; border: 1px solid #dddddd; font-weight: 700;">Usuario</td>
      <td style="padding: 6px 10px; border: 1px solid #dddddd;">${escapeHtml(user.fullName)} - ${escapeHtml(user.email)}</td>
    </tr>
    <tr>
      <td style="padding: 6px 10px; border: 1px solid #dddddd; font-weight: 700;">Accion</td>
      <td style="padding: 6px 10px; border: 1px solid #dddddd;">${escapeHtml(action.replaceAll("_", " "))}</td>
    </tr>
    <tr>
      <td style="padding: 6px 10px; border: 1px solid #dddddd; font-weight: 700;">Clave</td>
      <td style="padding: 6px 10px; border: 1px solid #dddddd; font-weight: 700;">${escapeHtml(password)}</td>
    </tr>
  </table>
  ${formattoSignature()}
</div>`;

  await sendOutlookMail({
    recipients: [accessAuditRecipient],
    subject,
    htmlBody,
    from: accessSender,
    inlineImages: [{ path: formattoLogoPath, contentId: formattoLogoCid }],
  });
}
