#!/bin/bash
cd "$(dirname "$0")"

echo "🔄 停止已有服务..."
lsof -i :8001 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null
sleep 1

echo "🚀 启动后端服务 (端口 8001)..."
source venv/bin/activate
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001 &
BACKEND_PID=$!
cd ..

echo "🌐 启动前端服务 (端口 3000)..."
cd frontend
python3 -m http.server 3000 &
FRONTEND_PID=$!
cd ..

sleep 2

echo ""
echo "✅ 服务已启动！"
echo "   前端: http://localhost:3000"
echo "   后端: http://localhost:8001"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待进程
trap "echo ''; echo '🛑 停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait