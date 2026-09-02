@echo off
REM بعد أن تثق بقراراته: يرفض بنفسه بدل أن يترك القرار لك.
cd /d "%~dp0"
python -m pip install -r requirements.txt --quiet
python claude_auto_approve.py --auto-deny %*
pause
