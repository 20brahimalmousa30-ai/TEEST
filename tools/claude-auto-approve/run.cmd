@echo off
REM التشغيل الفعلي: يفهم كل طلب، يصنّفه، ثم يقبل أو يرفض.
cd /d "%~dp0"
python -m pip install -r requirements.txt --quiet
python claude_auto_approve.py %*
pause
