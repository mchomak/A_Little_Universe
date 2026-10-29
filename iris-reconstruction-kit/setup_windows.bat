@echo off
setlocal
cd /d "%~dp0"
py -3 -m venv .venv
if errorlevel 1 (
  echo Python 3 is not available. Install Python 3.10+ and retry.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" -m pip install --upgrade pip
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
  echo Dependency installation failed.
  pause
  exit /b 1
)
echo.
echo Setup complete. Example:
echo .venv\Scripts\python.exe run_iris.py "C:\Photos\eye.heic" --interactive
echo Or drag a photo onto process_eye.bat.
pause
