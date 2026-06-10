@echo off
chcp 65001 >nul

echo 🛑 停止 Image Splitter 服务...

echo 停止后端服务 (端口 8001)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8001 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1

echo 停止前端服务 (端口 3000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1

echo.
echo ✅ 服务已停止
pause
