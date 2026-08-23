@echo off
title CodyNoah.net  -  Site Server
color 0b
echo.
echo   ============================================================
echo      C O D Y N O A H . N E T   ( GrimForge )   -   starting
echo   ============================================================
echo.
echo      Local view :  http://localhost:8090
echo.
echo      SECURITY (2026-08-19): this used to run its own unfiltered
echo      Python server on 8080, which the public Tailscale Funnel URL
echo      pointed straight at - no path blocking at all, so .env,
echo      backend/, and the gated resume PDF were all one request away
echo      the moment this window ran. Nginx on 8090 already serves this
echo      site correctly filtered (see codynoah.conf) - this script now
echo      just opens that instead of starting a second, unsafe server.
echo      The Funnel's own "/" mapping still needs to be manually
echo      repointed from :8080 to :8090 for the public link to work
echo      again at all - ask Claude or run:
echo        tailscale serve --https=10000 http://localhost:8090
echo      (the exact working command wasn't confirmed live - verify
echo      the mapping actually changed with: tailscale serve status)
echo   ------------------------------------------------------------
echo.

rem --- open the site (nginx, already filtered - no bare dev server) ---
start "" http://localhost:8090

echo.
echo   Opened via nginx (8090). This window has nothing left to do.
pause
exit /b 0

rem --- old unfiltered path, kept only for reference, never runs ---
rem cd /d D:\CodyNoah.net
rem "C:\Python313\python.exe" -m http.server 8080

echo.
echo   Server stopped.
pause
