param(
  [string]$Recipient = "david.reyes@formatto.cl",
  [string]$Sender = "enrique.arenas@formatto.cl",
  [string]$LocalUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$projectDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$cloudflared = Join-Path $PSScriptRoot "cloudflared.exe"
$logPath = Join-Path $projectDir "cloudflared-tunnel.log"
$errPath = Join-Path $projectDir "cloudflared-tunnel-error.log"

function Send-TunnelMail {
  param([string]$TunnelUrl)

  try {
    $outlook = New-Object -ComObject Outlook.Application
    $mail = $outlook.CreateItem(0)

    foreach ($account in $outlook.Session.Accounts) {
      if ($account.SmtpAddress -ieq $Sender) {
        $mail.SendUsingAccount = $account
        break
      }
    }

    $mail.To = $Recipient
    $mail.Subject = "Control de Entregas Formatto - enlace temporal"
    $mail.Body = @"
Hola,

El tablero Control de Entregas esta disponible temporalmente en:

$TunnelUrl

Este enlace funciona mientras el equipo de Enrique mantenga abierta la app y el tunel.

Saludos,
Formatto Control de Entregas
"@
    $mail.Send()
    Write-Host "Correo enviado a $Recipient con el enlace $TunnelUrl" -ForegroundColor Green
    return $true
  } catch {
    Write-Host "No se pudo enviar el correo automaticamente desde Outlook." -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Yellow
    Write-Host "Enlace temporal: $TunnelUrl" -ForegroundColor Cyan
    return $false
  }
}

function Open-MailFallback {
  param([string]$TunnelUrl)

  $subject = [System.Uri]::EscapeDataString("Control de Entregas Formatto - enlace temporal")
  $body = [System.Uri]::EscapeDataString("Hola,`r`n`r`nEl tablero Control de Entregas esta disponible temporalmente en:`r`n`r`n$TunnelUrl`r`n`r`nEste enlace funciona mientras el equipo de Enrique mantenga abierta la app y el tunel.`r`n`r`nSaludos,`r`nFormatto Control de Entregas")
  Start-Process "mailto:$Recipient?subject=$subject&body=$body"
}

Set-Location $projectDir

foreach ($path in @($logPath, $errPath)) {
  if (Test-Path $path) {
    Remove-Item -LiteralPath $path -Force
  }
}

Write-Host "Iniciando Formatto Control de Entregas..." -ForegroundColor Cyan
Write-Host "App local: $LocalUrl"
Write-Host "Se enviara el enlace temporal a $Recipient cuando Cloudflare lo genere."
Write-Host "Registro: $logPath"
Write-Host "Errores: $errPath"
Write-Host ""

Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "npm.cmd run dev" -WorkingDirectory $projectDir -WindowStyle Normal

Start-Sleep -Seconds 5

if (Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe") {
  Start-Process -FilePath "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList $LocalUrl
} else {
  Start-Process $LocalUrl
}

$process = Start-Process `
  -FilePath $cloudflared `
  -ArgumentList @("tunnel", "--url", $LocalUrl) `
  -WorkingDirectory $projectDir `
  -RedirectStandardOutput $logPath `
  -RedirectStandardError $errPath `
  -WindowStyle Hidden `
  -PassThru

Write-Host "Cloudflare Tunnel iniciado. Esperando URL temporal..." -ForegroundColor Cyan

$tunnelUrl = $null
$deadline = (Get-Date).AddSeconds(45)

while ((Get-Date) -lt $deadline -and -not $process.HasExited) {
  foreach ($path in @($logPath, $errPath)) {
    if (-not (Test-Path $path)) {
      continue
    }

    $content = Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue
    if ($content -match "https://[a-z0-9-]+\.trycloudflare\.com") {
      $tunnelUrl = $Matches[0]
      break
    }
  }

  if ($tunnelUrl) {
    break
  }

  Start-Sleep -Seconds 1
}

if ($tunnelUrl) {
  Write-Host "URL temporal detectada: $tunnelUrl" -ForegroundColor Green
  $sent = Send-TunnelMail -TunnelUrl $tunnelUrl
  if (-not $sent) {
    Write-Host "Abriendo correo preparado como respaldo..." -ForegroundColor Yellow
    Open-MailFallback -TunnelUrl $tunnelUrl
  }
} else {
  Write-Host "No se detecto la URL temporal en 45 segundos." -ForegroundColor Yellow
  Write-Host "Revisa estos archivos:" -ForegroundColor Yellow
  Write-Host " - $logPath" -ForegroundColor Yellow
  Write-Host " - $errPath" -ForegroundColor Yellow
}

if ($process.HasExited) {
  Write-Host "Cloudflare Tunnel se cerro. Ultimas lineas de diagnostico:" -ForegroundColor Yellow
  if (Test-Path $errPath) {
    Get-Content -LiteralPath $errPath -Tail 20
  }
} else {
  Write-Host "Manten abierta esta ventana. Si la cierras, se corta el enlace publico." -ForegroundColor Cyan
}

pause
