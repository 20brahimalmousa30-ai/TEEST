@echo off
REM تشخيص: ماذا ترى الأداة على جهازك؟
REM شغّله ونافذةُ إذن Claude Code معروضةٌ على الشاشة.
cd /d "%~dp0"
python -m pip install -r requirements.txt --quiet
python diagnose.py
echo.
echo افتح diagnose_report.txt بالمفكرة وأرسل محتواه.
pause
