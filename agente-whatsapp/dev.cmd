@echo off
set PATH=%~dp0.tools\node22;%PATH%
cd /d %~dp0
npm run dev -- -p 3010
