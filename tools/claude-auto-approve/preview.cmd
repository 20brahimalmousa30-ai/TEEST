@echo off
REM معاينة: يعرض قراره لكل طلب دون أن يضغط شيئاً.
cd /d "%~dp0"
python -m pip install -r requirements.txt --quiet
python claude_auto_approve.py --dry-run %*
pause
