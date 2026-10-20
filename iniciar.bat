@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=5500
title URB San Lucas - Control de accesos

echo.
echo   URB San Lucas - Control de accesos
echo   -------------------------
echo.

where python >nul 2>&1
if %ERRORLEVEL%==0 (
  echo   Servidor local: http://localhost:%PORT%
  echo   Para detenerlo: Ctrl + C
  echo.
  start "" "http://localhost:%PORT%/index.html"
  python -m http.server %PORT%
  goto :eof
)

where py >nul 2>&1
if %ERRORLEVEL%==0 (
  echo   Servidor local: http://localhost:%PORT%
  start "" "http://localhost:%PORT%/index.html"
  py -m http.server %PORT%
  goto :eof
)

echo   Python no esta instalado.
echo   Se abrira el archivo directamente.
echo   Nota: la camara puede no funcionar sin servidor local.
echo.
start "" "index.html"
pause
