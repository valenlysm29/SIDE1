@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 "%~dp0servidor_local.py"
  pause
  exit /b
)
where python >nul 2>nul
if %errorlevel%==0 (
  python "%~dp0servidor_local.py"
  pause
  exit /b
)
echo No se encontro Python. Abre esta carpeta con VS Code y usa Live Server para index.html.
echo Antes de iniciar, cierra el servidor anterior para no abrir otra version de SIDE.
pause
