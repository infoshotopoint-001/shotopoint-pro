@echo off
setlocal
echo Checking Shoto Point Node.js API health...
curl -fsS http://127.0.0.1:5000/api/health
if errorlevel 1 echo API not reachable. Start the Node.js server with npm start and check MySQL settings.
echo.
pause
