$ErrorActionPreference = "Stop"

$project = Resolve-Path (Join-Path $PSScriptRoot "..")
$startup = [Environment]::GetFolderPath("Startup")
$shell = New-Object -ComObject WScript.Shell

$items = @(
  @{
    Name = "Formatto Control App.lnk"
    Target = Join-Path $project "scripts\start-formatto-app.cmd"
  },
  @{
    Name = "Formatto Control Tunnel.lnk"
    Target = Join-Path $project "scripts\start-formatto-tunnel.cmd"
  }
)

foreach ($item in $items) {
  $shortcutPath = Join-Path $startup $item.Name
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $item.Target
  $shortcut.WorkingDirectory = $project
  $shortcut.WindowStyle = 7
  $shortcut.Save()
  Write-Host "Creado: $shortcutPath"
}

Write-Host ""
Write-Host "Listo. Estos accesos se ejecutaran al iniciar sesion de Windows."
Write-Host "Para probar ahora, ejecuta:"
Write-Host ".\scripts\start-formatto-app.cmd"
Write-Host ".\scripts\start-formatto-tunnel.cmd"
