@echo off
title YouTube Content Hub (Lokal + Cloudflare)
cd /d "%~dp0"

echo ===================================================
echo   Menyalakan YouTube Content Hub v4.37.2...
echo ===================================================
echo Database: Supabase PostgreSQL (Connected)
echo URL Lokal: http://localhost:3000
echo.

taskkill /f /im node.exe >nul 2>&1
taskkill /f /im cloudflared.exe >nul 2>&1

start "" node --env-file=.env server.mjs
timeout /t 3 /nobreak >nul

echo Menyalakan Cloudflare Tunnel untuk akses publik HTTPS...
start "" bin\cloudflared.exe tunnel --url http://localhost:3000

echo.
echo Membuka aplikasi di browser...
start http://localhost:3000

echo.
echo Aplikasi sudah aktif! Jangan tutup jendela ini jika ingin tetap online.
pause
