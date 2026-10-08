@echo off
rem Starts Duskspire. Installs dependencies first if node_modules is missing.
setlocal
cd /d "%~dp0"

if not exist "node_modules" (
  echo Installing dependencies for the first run...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed. Check that Node.js is installed and try again.
    pause
    exit /b 1
  )
)

call npm start
if errorlevel 1 (
  echo.
  echo Duskspire exited with an error.
  pause
)
endlocal
