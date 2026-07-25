@echo off
set CHOKIDAR_USEPOLLING=1
set WATCHPACK_POLLING=true
cd /d "%~dp0"
"%~dp0node_modules\.bin\next.cmd" dev "%~dp0" -p 3000 --webpack
