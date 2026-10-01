@echo off
title ITS Tour — Hikvision Bridge
color 0A
echo ============================================
echo   ITS Tour - Hikvision Bridge
echo ============================================
echo.

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
  echo ERROR: Node.js tapilmadi! https://nodejs.org dan yukleyin.
  pause
  exit /b 1
)

:: Check .env
if not exist ".env" (
  echo ERROR: .env fayli tapilmadi!
  echo .env.example faylini .env kimi kopyalayin ve doldura.
  pause
  exit /b 1
)

:: Install deps if needed
if not exist "node_modules" (
  echo Asililiklar yuklenilir...
  npm install
)

echo Bridge bashlayir...
echo Dayandirmaq ucun: Ctrl+C
echo.
node bridge.js

pause
