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

$targets = @("production")

Add-VercelEnv -Name "RESEND_API_KEY" -Value $resendKey.Trim() -Targets $targets

Write-Host ""
Write-Host "[Formatto] Verificando variables configuradas en Vercel..."
npx.cmd vercel env ls

Write-Host ""
Write-Host "[Formatto] Si RESEND_API_KEY aparece en la lista, ejecuta scripts\deploy-vercel.cmd para desplegar produccion."
