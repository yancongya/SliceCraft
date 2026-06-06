#!/bin/bash
# 部署 image-splitter 到 NAS Docker
set -e

NAS_HOST="tycon@192.168.31.110"
NAS_DIR="/vol1/1000/services/image-splitter"
LOCAL_DIR="$(dirname "$0")/.."

echo "📦 同步代码到 NAS..."
rsync -avz --delete \
    --exclude venv \
    --exclude __pycache__ \
    --exclude .git \
    --exclude '*.pyc' \
    --exclude .DS_Store \
    "$LOCAL_DIR/" "$NAS_DIR/"

echo "🔨 构建并启动容器..."
ssh "$NAS_HOST" "cd $NAS_DIR && sudo docker compose up -d --build"

echo "⏳ 等待容器启动..."
sleep 5

echo "🔍 检查容器状态..."
ssh "$NAS_HOST" "sudo docker ps --filter name=image-splitter"

echo "✅ 部署完成"
echo "   浏览器: http://192.168.31.110:8001"
echo "   API:    http://192.168.31.110:8001/api/health"
