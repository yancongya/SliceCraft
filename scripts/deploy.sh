#!/bin/bash
# deploy.sh — Image Splitter 部署到 NAS Docker
# 用法: ./scripts/deploy.sh "提交信息"
#
# 流程：Mac 构建镜像 → 导出 tar → NAS 加载 → rsync 代码 → 重启容器

set -e

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

# 1. Git commit + push
echo "1️⃣  Git commit..."
cd "$PROJECT_DIR"
git add -A
git commit -m "$MSG" || echo "  (没有新改动)"

echo "2️⃣  Git push..."
git push origin main 2>/dev/null || echo "  (push 跳过)"

# 2. Mac 构建 Docker 镜像
echo "3️⃣  Mac 构建镜像 (linux/amd64)..."
docker build -t "$IMAGE_NAME" --platform linux/amd64 . 2>&1 | tail -3

# 3. 导出镜像
echo "4️⃣  导出镜像..."
docker save "$IMAGE_NAME" | gzip > "$TMP_DIR/$PROJECT_NAME.tar.gz"

# 4. 传输到 NAS
echo "5️⃣  传输镜像到 NAS..."
scp "$TMP_DIR/$PROJECT_NAME.tar.gz" "$NAS_HOST:/tmp/"

# 5. NAS 加载镜像
echo "6️⃣  NAS 加载镜像..."
ssh "$NAS_HOST" "gunzip -c /tmp/$PROJECT_NAME.tar.gz | sudo docker load"

# 6. 同步代码和配置
echo "7️⃣  同步代码..."
rsync -av \
  docker-compose.yml \
  --exclude='.DS_Store' \
  "$NAS_HOST:$NAS_DIR/" 2>/dev/null | tail -1

# 7. 重启容器
echo "8️⃣  重启容器..."
ssh "$NAS_HOST" "cd $NAS_DIR && sudo docker compose up -d"

# 8. 清理
rm -f "$TMP_DIR/$PROJECT_NAME.tar.gz"
ssh "$NAS_HOST" "rm -f /tmp/$PROJECT_NAME.tar.gz" 2>/dev/null || true

# 9. 验证
echo "9️⃣  验证..."
sleep 3
if curl -4 -s --noproxy '*' --connect-timeout 5 \
  "http://192.168.31.110:8001/api/health" | grep -q '"status":"ok"'; then
  echo "✅ 部署完成: http://192.168.31.110:8001"
else
  echo "⚠️  部署完成但验证失败，请手动检查"
fi
