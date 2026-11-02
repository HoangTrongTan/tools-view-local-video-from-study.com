@echo off
cd /d "M:\ID_PTS\VideoLearningTool"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js khong tim thay. Hay cai Node.js truoc khi chay.
  pause
  exit /b 1
)
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:38473"
node server.js
if errorlevel 1 pause
