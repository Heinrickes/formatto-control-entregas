import { execFile } from "child_process";
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

export async function sendOutlookMail({
  recipients,
  subject,
  htmlBody,
  attachment,
}: {
  recipients: string[];
  subject: string;
  htmlBody: string;
  attachment: string;
}) {
  if (process.env.VERCEL || process.env.NEXT_RUNTIME === "edge") {
    throw new Error("El envio por Outlook solo funciona en la app local de Windows, no en Vercel.");
  }

  const command = `
$outlook = New-Object -ComObject Outlook.Application
$mail = $outlook.CreateItem(0)
$mail.To = @'
${recipients.join(";")}
'@
$mail.Subject = @'
${subject}
'@
$mail.HTMLBody = @'
${htmlBody}
'@
$mail.Attachments.Add(@'
${attachment}
'@) | Out-Null
$mail.Send()
`;

  try {
    await execFileAsync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], { timeout: 60000 });
  } catch (error) {
    throw new Error(outlookErrorMessage(error));
  }
}
