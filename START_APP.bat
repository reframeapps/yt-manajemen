@echo off
title YouTube Content Hub v4.55.0
cd /d "%~dp0"

echo ===================================================
echo   Menyalakan YouTube Content Hub v4.55.0...
echo ===================================================
echo Database: Supabase PostgreSQL (Connected)
echo URL Lokal: http://localhost:3000
echo.

taskkill /f /im node.exe >nul 2>&1
taskkill /f /im cloudflared.exe >nul 2>&1
timeout /t 1 /nobreak >nul

set "NODE_CMD=node"
if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_CMD=C:\Program Files\nodejs\node.exe"
)

echo Menjalankan server aplikasi...
start "YouTube Server" /min "%NODE_CMD%" --env-file=.env server.mjs
timeout /t 3 /nobreak >nul

if exist "%~dp0bin\cloudflared.exe" (
    echo Menyalakan Cloudflare Tunnel untuk akses publik HTTPS...
    start "Cloudflare Tunnel" /min "%~dp0bin\cloudflared.exe" tunnel --url http://localhost:3000
)

echo Membuka aplikasi di browser...
start http://localhost:3000

echo.
echo ===================================================
echo   APLIKASI SUDAH AKTIF DAN BERJALAN!
echo ===================================================
echo  - Akses Laptop (Utama): http://localhost:3000
echo  - Password Admin      : 0S4gYLskRQ%%0uBCvxf
echo ===================================================
echo.
echo Jendela ini boleh diminimize, jangan ditutup (close) jika ingin tetap aktif.
pause
