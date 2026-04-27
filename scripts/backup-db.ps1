param(
  [string]$OutputDir = ".\backups"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

if (-not $env:DATABASE_URL) {
  Write-Error "DATABASE_URL no esta definido. Carga .env o define la variable antes de ejecutar."
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$out = Join-Path $OutputDir "formatto-$stamp.sql"

pg_dump "$env:DATABASE_URL" -f $out
Write-Host "Backup creado: $out"
