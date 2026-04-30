param(
  [string]$Recipient = "david.reyes@formatto.cl",
  [string]$Sender = "enrique.arenas@formatto.cl",
  [string]$LocalUrl = "http://localhost:3000",
  [string]$RecipientUser = "david.reyes@formatto.cl",
  [string]$RecipientPassword = "Plan02"
)

$ErrorActionPreference = "Stop"
$projectDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$cloudflared = Join-Path $PSScriptRoot "cloudflared.exe"
$logPath = Join-Path $projectDir "cloudflared-tunnel.log"
$errPath = Join-Path $projectDir "cloudflared-tunnel-error.log"
$dockerDesktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
$dockerCliConfig = Join-Path $projectDir ".docker-cli"

if (-not (Test-Path -LiteralPath $dockerCliConfig)) {
  New-Item -ItemType Directory -Path $dockerCliConfig | Out-Null
}
$env:DOCKER_CONFIG = $dockerCliConfig

function Send-TunnelMail {
  param([string]$TunnelUrl)

  try {
    $outlook = New-Object -ComObject Outlook.Application
    $mail = $outlook.CreateItem(0)
    $mail.Display()
    Start-Sleep -Milliseconds 800
    $signature = $mail.HTMLBody

    foreach ($account in $outlook.Session.Accounts) {
      if ($account.SmtpAddress -ieq $Sender) {
        $mail.SendUsingAccount = $account
        break
      }
    }

    $mail.To = $Recipient
    $mail.Subject = "Control de Entregas Formatto - enlace temporal"
    $mail.HTMLBody = @"
<div style="font-family: Arial, sans-serif; font-size: 11pt; color: #111111;">
  <p>Hola,</p>
  <p>El tablero esta disponible temporalmente en:</p>
  <p><a href="$TunnelUrl" style="color: #CE4620; font-weight: 700;">Control de Entregas - Formatto</a></p>
  <p>
    <strong>Acceso:</strong><br>
    Usuario: $RecipientUser<br>
    Clave: $RecipientPassword
  </p>
  <p>Este enlace funciona mientras el equipo de Enrique mantenga abierta la app y el tunel.</p>
</div>
$signature
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
  $body = [System.Uri]::EscapeDataString("Hola,`r`n`r`nEl tablero esta disponible temporalmente en:`r`nControl de Entregas - Formatto: $TunnelUrl`r`n`r`nAcceso:`r`nUsuario: $RecipientUser`r`nClave: $RecipientPassword`r`n`r`nEste enlace funciona mientras el equipo de Enrique mantenga abierta la app y el tunel.")
  Start-Process "mailto:$Recipient?subject=$subject&body=$body"
}

function Test-LocalPort {
  param([int]$Port)

  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $connected = $async.AsyncWaitHandle.WaitOne(800, $false)
    if ($connected) {
      $client.EndConnect($async)
    }
    $client.Close()
    return $connected
  } catch {
    return $false
  }
}

function Test-DockerReady {
  try {
    $output = & docker version --format "{{.Server.Version}}" 2>&1
  } catch {
    return $false
  }

  if ($LASTEXITCODE -ne 0) {
    return $false
  }

  return -not [string]::IsNullOrWhiteSpace($output)
}

function Start-DockerServiceIfPossible {
  $service = Get-Service -Name "com.docker.service" -ErrorAction SilentlyContinue
  if (-not $service -or $service.Status -eq "Running") {
    return
  }

  try {
    Write-Host "Iniciando servicio de Docker..." -ForegroundColor Yellow
    Start-Service -Name "com.docker.service" -ErrorAction Stop
  } catch {
    Write-Host "No se pudo iniciar el servicio de Docker automaticamente. Docker Desktop intentara levantarlo." -ForegroundColor DarkYellow
  }
}

function Ensure-Docker {
  if (Test-DockerReady) {
    Write-Host "Docker ya esta corriendo." -ForegroundColor Green
    return
  }

  if (-not (Test-Path $dockerDesktop)) {
    throw "Docker Desktop no esta instalado en la ruta esperada: $dockerDesktop"
  }

  Write-Host "Docker no esta corriendo. Iniciando Docker Desktop..." -ForegroundColor Yellow
  Start-DockerServiceIfPossible
  Start-Process -FilePath $dockerDesktop

  $elevatedAttempted = $false
  $elevateAfter = (Get-Date).AddSeconds(45)
  $deadline = (Get-Date).AddMinutes(5)
  while ((Get-Date) -lt $deadline) {
    if (Test-DockerReady) {
      Write-Host "Docker listo." -ForegroundColor Green
      return
    }

    if (-not $elevatedAttempted -and (Get-Date) -ge $elevateAfter) {
      $service = Get-Service -Name "com.docker.service" -ErrorAction SilentlyContinue
      if ($service -and $service.Status -ne "Running") {
        Write-Host "Docker aun no responde. Intentando abrir Docker Desktop con permisos de administrador..." -ForegroundColor Yellow
        Write-Host "Si Windows muestra una confirmacion, presiona Si para continuar." -ForegroundColor Yellow
        try {
          Start-Process -FilePath $dockerDesktop -Verb RunAs
        } catch {
          Write-Host "No se pudo solicitar elevacion automaticamente. Abre Docker Desktop como administrador y vuelve a intentar." -ForegroundColor DarkYellow
        }
      }
      $elevatedAttempted = $true
    }

    Start-Sleep -Seconds 5
    Write-Host "Esperando Docker..." -ForegroundColor DarkGray
  }

  throw "Docker no quedo listo despues de 5 minutos. Abre Docker Desktop manualmente, espera que diga Engine running y vuelve a intentar."
}

function Ensure-Supabase {
  Write-Host "Revisando Supabase local..." -ForegroundColor Cyan
  $healthReady = $false
  try {
    $response = Invoke-WebRequest -UseBasicParsing "$LocalUrl/api/health" -TimeoutSec 4
    $health = $response.Content | ConvertFrom-Json
    $healthReady = $health.database -eq "up"
  } catch {
    $healthReady = $false
  }

  if ($healthReady) {
    Write-Host "Base de datos disponible." -ForegroundColor Green
    return
  }

  Write-Host "Levantando Supabase local en Docker..." -ForegroundColor Yellow
  npx.cmd supabase start
}

Set-Location $projectDir

Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

foreach ($path in @($logPath, $errPath)) {
  if (Test-Path $path) {
    try {
      Remove-Item -LiteralPath $path -Force -ErrorAction Stop
    } catch {
      $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
      if ($path -eq $logPath) {
        $logPath = Join-Path $projectDir "cloudflared-tunnel-$stamp.log"
      } else {
        $errPath = Join-Path $projectDir "cloudflared-tunnel-error-$stamp.log"
      }
    }
  }
}

Write-Host "Iniciando Formatto Control de Entregas..." -ForegroundColor Cyan
Write-Host "App local: $LocalUrl"
Write-Host "Se enviara el enlace temporal a $Recipient cuando Cloudflare lo genere."
Write-Host "Registro: $logPath"
Write-Host "Errores: $errPath"
Write-Host ""

Ensure-Docker
Ensure-Supabase

if (Test-LocalPort -Port 3000) {
  Write-Host "La app ya esta corriendo en $LocalUrl. No se abre otro servidor." -ForegroundColor Yellow
} else {
  Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "npm.cmd run dev" -WorkingDirectory $projectDir -WindowStyle Normal
}

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
