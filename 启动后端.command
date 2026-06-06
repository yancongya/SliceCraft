#!/bin/bash
cd "$(dirname "$0")"

# 杀死已有的后端进程
lsof -i :8001 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null
sleep 1

echo "🚀 启动后端服务 (端口 8001)..."
source venv/bin/activate
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001