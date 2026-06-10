@echo off
chcp 65001 >nul
title Image Splitter

cd /d "%~dp0"

echo 🔄 停止已有服务...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8001 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
timeout /t 1 >nul

echo 🚀 启动后端服务 (端口 8001)...
start "Backend" cmd /k "cd /d %~dp0 && call venv\Scripts\activate.bat && cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8001"

echo 🌐 启动前端服务 (端口 3000)...
start "Frontend" cmd /k "cd /d %~dp0\frontend && python -m http.server 3000"

timeout /t 2 >nul

echo.
echo ✅ 服务已启动！
echo    前端: http://localhost:3000
echo    后端: http://localhost:8001
echo.
echo 关闭此窗口不会停止服务
echo 需要停止服务请运行 "停止服务.bat"
echo.
pause
