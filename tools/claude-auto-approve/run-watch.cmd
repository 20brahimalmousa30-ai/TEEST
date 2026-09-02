@echo off
REM وضع المراقبة: يسجّل ما كان سيفعله دون أن يضغط شيئاً.
REM ابدأ بهذا دائماً، وراجع auto_approve.log قبل التشغيل الفعلي.
cd /d "%~dp0"
python -m pip install -r requirements.txt --quiet
python claude_auto_approve.py %*
pause
