#!/bin/bash
# dev.sh — 本地开发启动
# 用法: ./scripts/dev.sh [start|stop|restart|status]

set -e

PROJECT_DIR="$(dirname "$0")/.."
cd "$PROJECT_DIR"

case "${1:-start}" in
  start)
    echo "🚀 启动本地开发环境..."
    
    # 启动后端
    source venv/bin/activate
    cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8001 &
    BACKEND_PID=$!
    cd ..
    
    # 启动前端
    cd frontend && python3 -m http.server 3000 &
    FRONTEND_PID=$!
    cd ..
    
    echo "✅ 后端: http://localhost:8001"
    echo "✅ 前端: http://localhost:3000"
    echo ""
    echo "按 Ctrl+C 停止"
    
    # 等待信号
    trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
    wait
    ;;
    
  stop)
    echo "🛑 停止本地开发环境..."
    pkill -f "uvicorn app.main:app" 2>/dev/null || true
    pkill -f "python3 -m http.server 3000" 2>/dev/null || true
    echo "✅ 已停止"
    ;;
    
  restart)
    $0 stop
    sleep 1
    $0 start
    ;;
    
  status)
    echo "📊 本地开发环境状态:"
    if pgrep -f "uvicorn app.main:app" > /dev/null; then
      echo "  后端: ✅ 运行中 (8001)"
    else
      echo "  后端: ❌ 未运行"
    fi
    if pgrep -f "python3 -m http.server 3000" > /dev/null; then
      echo "  前端: ✅ 运行中 (3000)"
    else
      echo "  前端: ❌ 未运行"
    fi
    ;;
    
  *)
    echo "用法: $0 [start|stop|restart|status]"
    exit 1
    ;;
esac
