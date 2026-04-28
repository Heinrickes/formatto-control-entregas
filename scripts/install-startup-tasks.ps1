$ErrorActionPreference = "Stop"

$project = Resolve-Path (Join-Path $PSScriptRoot "..")
$appScript = Join-Path $project "scripts\start-formatto-app.cmd"
$tunnelScript = Join-Path $project "scripts\start-formatto-tunnel.cmd"

$actionApp = New-ScheduledTaskAction -Execute $appScript
$actionTunnel = New-ScheduledTaskAction -Execute $tunnelScript
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName "Formatto Control App" -Action $actionApp -Trigger $trigger -Principal $principal -Description "Inicia Next.js Formatto Control de Entregas" -Force
Register-ScheduledTask -TaskName "Formatto Control Tunnel" -Action $actionTunnel -Trigger $trigger -Principal $principal -Description "Inicia Cloudflare quick tunnel para Formatto Control" -Force

Write-Host "Tareas creadas:"
Write-Host "- Formatto Control App"
Write-Host "- Formatto Control Tunnel"
Write-Host ""
Write-Host "Puedes iniciarlas ahora con:"
Write-Host 'Start-ScheduledTask -TaskName "Formatto Control App"'
Write-Host 'Start-ScheduledTask -TaskName "Formatto Control Tunnel"'
