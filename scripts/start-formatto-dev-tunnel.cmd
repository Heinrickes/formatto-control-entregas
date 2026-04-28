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

start "Formatto App Local" /D "%PROJECT_DIR%" cmd /k npm.cmd run dev

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
