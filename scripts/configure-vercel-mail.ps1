param(
  [string]$ProjectUrl = "https://formatto-control-entregas.vercel.app",
  [string]$From = "Enrique Arenas D. <enrique.arenas@formatto.cl>"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Add-VercelEnv {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Value,
    [Parameter(Mandatory = $true)][string[]]$Targets
  )

  foreach ($target in $Targets) {
    Write-Host "[Formatto] Configurando $Name en $target..."
    $Value | npx.cmd vercel env add $Name $target
  }
}

Write-Host ""
Write-Host "[Formatto] Configuracion de correo Vercel / Resend"
Write-Host "Necesitas una API key de Resend. No se guardara en archivos locales."
Write-Host ""

$resendKey = Read-Host "Pega RESEND_API_KEY"
if ([string]::IsNullOrWhiteSpace($resendKey)) {
  throw "RESEND_API_KEY no puede quedar vacio."
}

$accessBytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($accessBytes)
$accessSecret = [Convert]::ToBase64String($accessBytes)

$targets = @("production")

Add-VercelEnv -Name "RESEND_API_KEY" -Value $resendKey.Trim() -Targets $targets
Add-VercelEnv -Name "FORMATTO_MAIL_FROM" -Value $From -Targets $targets
Add-VercelEnv -Name "FORMATTO_APP_URL" -Value $ProjectUrl -Targets $targets
Add-VercelEnv -Name "FORMATTO_ACCESS_SECRET" -Value $accessSecret -Targets $targets

Write-Host ""
Write-Host "[Formatto] Variables de produccion configuradas. Ejecuta scripts\deploy-vercel.cmd para desplegar produccion."
