@echo off
title ITS Tour — Initial Sync
color 0B
echo ============================================
echo   ITS Tour - Ilkin Sinxronizasiya
echo ============================================
echo.
if not exist "node_modules" npm install
echo Son 30 gunun melumatları yuklenilir...
node bridge.js --once
echo.
echo Tamamlandi!
pause
