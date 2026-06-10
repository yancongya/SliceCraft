@echo off
chcp 65001 >nul
title Frontend - Image Splitter

cd /d "%~dp0"

echo 🔄 停止已有前端服务...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
timeout /t 1 >nul

echo 🌐 启动前端服务 (端口 3000)...
cd frontend
python -m http.server 3000
