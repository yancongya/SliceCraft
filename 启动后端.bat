@echo off
chcp 65001 >nul
title Backend - Image Splitter

cd /d "%~dp0"

echo 🔄 停止已有后端服务...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8001 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
timeout /t 1 >nul

echo 🚀 启动后端服务 (端口 8001)...
call venv\Scripts\activate.bat
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
