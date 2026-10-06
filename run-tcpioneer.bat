@echo off
setlocal
cd /d "%~dp0"

echo Installing project dependencies...
call npm ci --no-fund --no-audit
if errorlevel 1 exit /b %errorlevel%

echo Building and starting TCPIOneer...
call npm start
exit /b %errorlevel%
