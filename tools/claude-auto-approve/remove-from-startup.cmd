@echo off
REM يلغي بدء الحارس التلقائي مع ويندوز.
powershell -NoProfile -Command "$w=New-Object -ComObject WScript.Shell; $p=Join-Path $w.SpecialFolders('Startup') 'ClaudeGuard.lnk'; if (Test-Path $p) { Remove-Item $p; 'أُلغي البدء التلقائي.' } else { 'البدء التلقائي غير مفعّل أصلاً.' }"
echo.
pause
