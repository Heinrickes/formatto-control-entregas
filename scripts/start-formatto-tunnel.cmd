@echo off
cd /d "%~dp0.."
"%~dp0cloudflared.exe" tunnel --url http://localhost:3000
