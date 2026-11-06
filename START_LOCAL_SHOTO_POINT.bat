@echo off
setlocal
cd /d "%~dp0"
echo ===============================================
echo  SHOTO POINT PRODUCTION - HTML / CSS / JS + NODE
echo ===============================================
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install Node.js 24 or a compatible LTS version first.
  pause
  exit /b 1
)
if not exist "node_modules\express\package.json" (
  echo Installing required Node.js packages. This step needs internet access and runs only once.
  call npm install
  if errorlevel 1 (
    echo Package installation failed. Check the internet connection and try again.
    pause
    exit /b 1
  )
)
echo Starting the Shoto Point website and API on port 5000...
echo After the server starts, open http://127.0.0.1:5000/
echo Keep this window open while using the website.
call npm start
pause
