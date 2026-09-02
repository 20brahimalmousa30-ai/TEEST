@echo off
REM يعرض تصنيف المحرّك لأوامر شائعة، أو لأمر تكتبه:  check.cmd "git status"
cd /d "%~dp0"
python demo.py %*
pause
