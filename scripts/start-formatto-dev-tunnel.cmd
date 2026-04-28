@echo off
setlocal

cd /d "%~dp0.."
set "PROJECT_DIR=%CD%"

echo Iniciando Formatto Control de Entregas...
echo.
echo Se abriran dos ventanas:
echo  - App local Next.js en http://localhost:3000
echo  - Cloudflare Tunnel con la URL publica temporal
echo  - Google Chrome con el tablero local
echo.

powershell.exe -NoProfile -Command "$c=New-Object Net.Sockets.TcpClient; try { $a=$c.BeginConnect('127.0.0.1',3000,$null,$null); if($a.AsyncWaitHandle.WaitOne(800,$false)){ $c.EndConnect($a); exit 0 } else { exit 1 } } catch { exit 1 } finally { $c.Close() }"
if errorlevel 1 (
  start "Formatto App Local" /D "%PROJECT_DIR%" cmd /k npm.cmd run dev
) else (
  echo La app ya esta corriendo en http://localhost:3000. No se abre otro servidor.
)

timeout /t 5 /nobreak >nul

start "Formatto Tunnel Publico" /D "%PROJECT_DIR%" cmd /k ".\scripts\cloudflared.exe tunnel --url http://localhost:3000"

timeout /t 3 /nobreak >nul

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
  start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "http://localhost:3000"
) else (
  start "" "http://localhost:3000"
)

echo Listo. Revisa la ventana "Formatto Tunnel Publico" para copiar la URL https://...trycloudflare.com
echo.
pause
