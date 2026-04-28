@echo off
cd /d "%~dp0.."
powershell.exe -NoProfile -Command "$c=New-Object Net.Sockets.TcpClient; try { $a=$c.BeginConnect('127.0.0.1',3000,$null,$null); if($a.AsyncWaitHandle.WaitOne(800,$false)){ $c.EndConnect($a); exit 0 } else { exit 1 } } catch { exit 1 } finally { $c.Close() }"
if errorlevel 1 (
  npm.cmd run dev
) else (
  echo La app ya esta corriendo en http://localhost:3000
  pause
)
