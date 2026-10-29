@echo off
setlocal
cd /d "%~dp0"
if "%~1"=="" (
  echo Drag a HEIC/JPG/PNG file onto process_eye.bat or pass its path as the first argument.
  pause
  exit /b 1
)
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" run_iris.py "%~1" --interactive
) else (
  py -3 run_iris.py "%~1" --interactive
)
pause
