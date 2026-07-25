@echo off
title CodyNoah.net  -  Site Server
color 0b
echo.
echo   ============================================================
echo      C O D Y N O A H . N E T   ( GrimForge )   -   starting
echo   ============================================================
echo.
echo      Local view :  http://localhost:8080
echo      Public link:  https://desktop-gkvskaf.tail73d7db.ts.net:10000
echo.
echo      Keep THIS window open to keep the site up.
echo      Close it (or press Ctrl+C) to stop the server.
echo   ------------------------------------------------------------
echo.

rem --- free port 8080 if an old copy is already running ---
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

rem --- open the site in your browser ---
start "" http://localhost:8080

rem --- serve the site (this line keeps the window running) ---
cd /d D:\CodyNoah.net
"C:\Python313\python.exe" -m http.server 8080

echo.
echo   Server stopped.
pause
