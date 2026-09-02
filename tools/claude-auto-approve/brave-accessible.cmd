@echo off
REM ============================================================
REM  يفتح Brave مع تفعيل شجرة إمكانية الوصول للصفحات.
REM
REM  بدون هذا، لا تكشف المتصفّحات محتوى الصفحة لـ UI Automation،
REM  فيقرأ الحارس واجهة المتصفّح فقط ولا يرى طلب الإذن أبداً.
REM
REM  أغلق كل نوافذ Brave أولاً، ثم شغّل هذا الملفّ.
REM ============================================================

set "BRAVE="
for %%P in (
  "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"
  "%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe"
  "%LocalAppData%\BraveSoftware\Brave-Browser\Application\brave.exe"
) do if exist %%P set "BRAVE=%%P"

if not defined BRAVE (
  echo لم أجد Brave في المسارات المعتادة.
  echo افتحه يدوياً مع الراية:  --force-renderer-accessibility
  pause
  exit /b 1
)

tasklist /fi "imagename eq brave.exe" 2>nul | find /i "brave.exe" >nul
if not errorlevel 1 (
  echo.
  echo تنبيه: Brave يعمل الآن. الراية لا تُطبَّق إلا على تشغيل جديد.
  echo أغلق كل نوافذ Brave ثم أعد تشغيل هذا الملفّ.
  echo.
  pause
  exit /b 1
)

echo يفتح Brave مع تفعيل إمكانية الوصول...
start "" %BRAVE% --force-renderer-accessibility
echo.
echo تم. افتح Claude Code في المتصفّح، ثم شغّل preview.cmd
pause
