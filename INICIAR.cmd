@echo off
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (echo Instale Node.js 24. & pause & exit /b 1)
if not exist "node_modules\vite" (
 call npm ci
 if errorlevel 1 (pause & exit /b 1)
)
call npm run dev -- --open
pause
