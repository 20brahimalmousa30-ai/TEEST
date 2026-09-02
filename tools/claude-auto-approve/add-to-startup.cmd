@echo off
REM يجعل الحارس يبدأ تلقائياً مع تشغيل ويندوز (نافذة مصغّرة).
REM للتراجع: شغّل remove-from-startup.cmd
cd /d "%~dp0"
powershell -NoProfile -Command "$w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut((Join-Path $w.SpecialFolders('Startup') 'ClaudeGuard.lnk')); $s.TargetPath='%~dp0run.cmd'; $s.WorkingDirectory='%~dp0'; $s.WindowStyle=7; $s.Save()"
echo.
echo تم. سيبدأ الحارس تلقائياً مع ويندوز.
echo للتراجع شغّل: remove-from-startup.cmd
pause
