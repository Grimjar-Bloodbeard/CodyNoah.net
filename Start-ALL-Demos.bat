@echo off
title Start ALL GrimForge Demos
color 0e
echo.
echo   ============================================================
echo      Starting ALL demos  ( CodyNoah.net + StockForge )
echo   ============================================================
echo.
echo      Two windows will open - one per demo.
echo      Keep them open to keep the demos up.
echo.

start "CodyNoah.net" "D:\CodyNoah.net\Start-CodyNoah-Site.bat"
start "StockForge"   "D:\StockForge\Start-StockForge-Demo.bat"

echo   Launched.  This window will close in a few seconds.
timeout /t 5 >nul
