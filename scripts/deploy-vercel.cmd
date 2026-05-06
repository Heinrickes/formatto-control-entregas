@echo off
setlocal
cd /d "%~dp0.."

echo.
echo [Formatto] Compilando aplicacion...
call npm.cmd run build
if errorlevel 1 goto :error

echo.
echo [Formatto] Aplicando migraciones en Supabase Cloud...
call npm.cmd run cloud:migrate
if errorlevel 1 goto :error

echo.
echo [Formatto] Desplegando a Vercel produccion...
call npm.cmd run deploy:vercel
if errorlevel 1 goto :error

echo.
echo [Formatto] Deploy finalizado.
pause
exit /b 0

:error
echo.
echo [Formatto] El proceso fallo. Revisa el mensaje anterior.
pause
exit /b 1
