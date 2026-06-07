#!/bin/bash
# deploy.sh — Image Splitter 部署到 NAS Docker
# 用法: ./scripts/deploy.sh "提交信息"
#        ./scripts/deploy.sh --full "提交信息"  # 完整重建镜像
#
# 默认模式：只同步代码 + 重启容器（快）
# --full 模式：Mac 构建镜像 → 导出 → NAS 加载 → 重启

set -e

FULL_MODE=false
if [ "$1" = "--full" ]; then
  FULL_MODE=true
  shift
fi

MSG="${1:-update: $(date +%Y-%m-%d\ %H:%M)}"
NAS_HOST="tycon@192.168.31.110"
NAS_DIR="/vol1/1000/services/image-splitter"
PROJECT_NAME="image-splitter"
IMAGE_NAME="image-splitter:amd64"
SCRIPT_DIR="$(dirname "$0")"
PROJECT_DIR="$SCRIPT_DIR/.."
TMP_DIR="/tmp"

echo "📦 部署 Image Splitter 到 NAS Docker"
echo "====================================="

cd "$PROJECT_DIR"

# 1. Git commit
echo "1️⃣  Git commit..."
git add -A
git commit -m "$MSG" || echo "  (没有新改动)"

# 2. 同步代码（两种模式都需要）
echo "2️⃣  同步代码..."
rsync -av \
  --exclude='.git' \
  --exclude='venv' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.DS_Store' \
  docker-compose.yml \
  Dockerfile \
  backend/ \
  frontend/ \
  requirements.txt \
  "$NAS_HOST:$NAS_DIR/" 2>/dev/null | tail -1

if [ "$FULL_MODE" = true ]; then
  # 完整重建模式
  echo "3️⃣  Mac 构建镜像 (amd64)..."
  docker build -t "$IMAGE_NAME" --platform linux/amd64 . 2>&1 | tail -5
  
  echo "4️⃣  导出镜像..."
  docker save "$IMAGE_NAME" | gzip > "$TMP_DIR/$PROJECT_NAME.tar.gz"
  
  echo "5️⃣  传输镜像到 NAS..."
  scp "$TMP_DIR/$PROJECT_NAME.tar.gz" "$NAS_HOST:/tmp/"
  
  echo "6️⃣  NAS 加载镜像..."
  ssh "$NAS_HOST" "gunzip -c /tmp/$PROJECT_NAME.tar.gz | sudo docker load"
  
  rm -f "$TMP_DIR/$PROJECT_NAME.tar.gz"
  ssh "$NAS_HOST" "rm -f /tmp/$PROJECT_NAME.tar.gz" 2>/dev/null || true
fi

# 7. 重启容器
echo "7️⃣  重启容器..."
ssh "$NAS_HOST" "cd $NAS_DIR && sudo docker compose up -d"

# 8. 验证
echo "8️⃣  验证..."
sleep 3
if curl -4 -s --noproxy '*' --connect-timeout 5 \
  "http://192.168.31.110:8001/api/health" | grep -q '"status"'; then
  echo "✅ 部署完成: http://192.168.31.110:8001"
else
  echo "⚠️  部署完成但验证失败，请手动检查"
fi
