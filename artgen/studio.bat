@echo off
cd /d "%~dp0"
title GrimForge Studio
echo.
echo   GrimForge Studio  -  http://localhost:7861
echo   (Make sure the Image Studio / ComfyUI is running first.)
echo.
python studio.py
pause
