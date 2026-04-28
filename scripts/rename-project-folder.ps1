$ErrorActionPreference = "Stop"

$old = "C:\Users\Enrique Arenas\Documents\New project"
$new = "C:\Users\Enrique Arenas\Documents\Control de Entregas - Formatto"

Write-Host "Cerrando procesos de la app y tunnel..." -ForegroundColor Cyan
Get-Process node,cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force

if (Test-Path -LiteralPath $new) {
  throw "Ya existe la carpeta destino: $new"
}

Write-Host "Renombrando carpeta..." -ForegroundColor Cyan
Move-Item -LiteralPath $old -Destination $new

$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Control de Entregas.lnk"
$script = Join-Path $new "scripts\start-formatto-dev-tunnel-mail.cmd"
$icon = Join-Path $new "scripts\formatto-red-square.ico"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "C:\Windows\System32\cmd.exe"
$shortcut.Arguments = "/k `"$script`""
$shortcut.WorkingDirectory = $new
$shortcut.Description = "Inicia Control de Entregas Formatto, tunnel publico, Chrome y correo automatico"
$shortcut.IconLocation = $icon
$shortcut.Save()

Write-Host "Listo: $new" -ForegroundColor Green
Write-Host "El acceso directo del Escritorio quedo actualizado." -ForegroundColor Green
