@echo off
REM عرض القرارات التي تعلّمتها الأداة، وحذف ما تريد منها.
cd /d "%~dp0"
python memory.py %*
pause
