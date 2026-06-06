#!/bin/bash
cd "$(dirname "$0")"

# 杀死已有的前端进程
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null
sleep 1

echo "🌐 启动前端服务 (端口 3000)..."
cd frontend
python3 -m http.server 3000