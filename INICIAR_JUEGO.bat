@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8000/index.html
  py -m http.server 8000
  exit /b
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8000/index.html
  python -m http.server 8000
  exit /b
)
echo No se encontro Python. Abre esta carpeta con VS Code y usa Live Server para index.html.
pause
