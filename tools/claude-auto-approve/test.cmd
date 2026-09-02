@echo off
REM تشغيل كل اختبارات الأداة.
cd /d "%~dp0"
python test_classifier.py
python test_prompts.py
python test_lifecycle.py
python test_memory_flow.py
python test_away_mode.py
pause
