@echo off
REM Double-clickable wrapper around setup-windows.ps1
REM PowerShell blocks unsigned scripts by default, so we bypass the policy
REM for this one invocation and only for this process.

setlocal
cd /d "%~dp0"

echo.
echo   AdNexus CMS - Windows setup
echo   -----------------------------
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-windows.ps1"
set EXITCODE=%ERRORLEVEL%

echo.
if "%EXITCODE%"=="0" (
    echo   Setup finished successfully.
) else (
    echo   Setup did not finish. See the messages above.
)
echo.
pause
exit /b %EXITCODE%