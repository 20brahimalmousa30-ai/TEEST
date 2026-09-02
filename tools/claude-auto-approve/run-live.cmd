@echo off
REM التشغيل الفعلي: يضغط الموافقة على الطلبات الآمنة فقط.
REM لا تستخدمه قبل أن تراجع سجلّ وضع المراقبة.
cd /d "%~dp0"
python -m pip install -r requirements.txt --quiet
python claude_auto_approve.py --live %*
pause
