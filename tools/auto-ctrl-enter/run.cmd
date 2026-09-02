@echo off
REM تشغيل الأداة على ويندوز: كل 3 ثوانٍ افتراضياً.
REM لتغيير الفاصل الزمني مرّر وسيطاً، مثال:  run.cmd -i 1.5
cd /d "%~dp0"
python -m pip install -r requirements.txt --quiet
python auto_ctrl_enter.py %*
pause
