import { execFile } from "child_process";
import { readFile } from "fs/promises";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

function commandDetails(error: unknown) {
  if (!error || typeof error !== "object") return String(error);
  return [
    error instanceof Error ? error.message : "",
    "stderr" in error ? String(error.stderr ?? "") : "",
    "stdout" in error ? String(error.stdout ?? "") : "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

function outlookErrorMessage(error: unknown) {
  const raw = commandDetails(error);
  if (/0x80070520|80070520|sesion de inicio|sesion especificada/i.test(raw)) {
    return "Outlook no esta disponible para el servidor local. Abre Outlook con tu sesion de Windows y ejecuta la app desde una consola normal de usuario; en Vercel este envio por Outlook no funciona.";
  }
  if (/CLSID|COM|Outlook\.Application|generador de clases/i.test(raw)) {
    return "No se pudo abrir Outlook en este equipo. Verifica que Outlook de escritorio este instalado, configurado y abierto.";
  }
  if (/powershell/i.test(raw)) {
    return "No se pudo ejecutar PowerShell para enviar el correo por Outlook.";
  }
  return raw || "Error desconocido al enviar correo por Outlook.";
}

function resendFrom(from?: string) {
  const configured = process.env.FORMATTO_MAIL_FROM?.trim();
  if (configured) return configured;
  if (from) return `Enrique Arenas D. <${from}>`;
  return "Control de Entregas - Formatto <onboarding@resend.dev>";
}

async function sendResendMail({
  recipients,
  subject,
  htmlBody,
  attachment,
  from,
}: {
  recipients: string[];
  subject: string;
  htmlBody: string;
  attachment?: string;
  from?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Falta configurar RESEND_API_KEY en Vercel para enviar correos.");
  }

  const payload: Record<string, unknown> = {
    from: resendFrom(from),
    to: recipients,
    subject,
    html: htmlBody
  };

  if (attachment) {
    const content = await readFile(attachment);
    payload.attachments = [{
      filename: path.basename(attachment),
      content: content.toString("base64")
    }];
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend no pudo enviar el correo (${response.status}). ${detail}`.trim());
  }
}

export async function sendOutlookMail({
  recipients,
  subject,
  htmlBody,
  attachment,
  from,
  inlineImages,
}: {
  recipients: string[];
  subject: string;
  htmlBody: string;
  attachment?: string;
  from?: string;
  inlineImages?: { path: string; contentId: string }[];
}) {
  if (process.env.RESEND_API_KEY || process.env.VERCEL || process.env.NEXT_RUNTIME === "edge") {
    await sendResendMail({ recipients, subject, htmlBody, attachment, from });
    return;
  }

  const command = `
$outlook = New-Object -ComObject Outlook.Application
$mail = $outlook.CreateItem(0)
${from ? `$fromAddress = @'
${from}
'@
foreach ($account in $outlook.Session.Accounts) {
  if ($account.SmtpAddress -eq $fromAddress) {
    $mail.SendUsingAccount = $account
    break
  }
}` : ""}
$mail.To = @'
${recipients.join(";")}
'@
$mail.Subject = @'
${subject}
'@
$mail.HTMLBody = @'
${htmlBody}
'@
${attachment ? `$mail.Attachments.Add(@'
${attachment}
'@) | Out-Null` : ""}
${(inlineImages ?? []).map((image, index) => `$inlineAttachment${index} = $mail.Attachments.Add(@'
${image.path}
'@)
$inlineAttachment${index}.PropertyAccessor.SetProperty("http://schemas.microsoft.com/mapi/proptag/0x3712001F", @'
${image.contentId}
'@)`).join("\n")}
$mail.Send()
`;

  try {
    await execFileAsync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], { timeout: 60000 });
  } catch (error) {
    throw new Error(outlookErrorMessage(error));
  }
}
