#!/bin/bash
# 启动图片元素拆分工具

echo "🎨 启动图片元素拆分工具..."
echo ""

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 检查虚拟环境
if [ ! -d "venv" ]; then
    echo "❌ 虚拟环境不存在，请先运行: python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

# 激活虚拟环境
source venv/bin/activate

# 启动后端
echo "🚀 启动后端服务 (端口 8001)..."
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001 &
BACKEND_PID=$!
cd ..

# 等待后端启动
sleep 2

# 启动前端
echo "🌐 启动前端服务 (端口 3000)..."
cd frontend
python3 -m http.server 3000 &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ 服务已启动！"
echo ""
echo "📱 访问地址: http://localhost:3000"
echo "🔧 后端 API: http://localhost:8001"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 捕获退出信号
trap "echo ''; echo '🛑 停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

# 等待进程
wait