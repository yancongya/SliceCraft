#!/bin/bash
set -euo pipefail

VERSION=${1:-"v0.1.0"}
RELEASE_NAME="SliceCraft ${VERSION}"

echo "=== 构建 ${RELEASE_NAME} ==="

# 1. 构建 .dmg（macOS）
echo ">>> 构建 macOS .dmg ..."
npx tauri build

# 2. 定位产物
DMG=$(ls src-tauri/target/release/bundle/dmg/*.dmg 2>/dev/null | head -1)
APP=$(ls src-tauri/target/release/bundle/macos/*.app 2>/dev/null | head -1)

if [ -z "$DMG" ]; then
  echo "错误: 未找到 .dmg 文件"
  exit 1
fi

echo ">>> .dmg: $DMG ($(du -h "$DMG" | cut -f1))"

# 3. 发布到 GitHub Release
echo ">>> 发布到 GitHub ..."
gh release create "$VERSION" \
  --title "$RELEASE_NAME" \
  --notes "请见 CHANGELOG" \
  --draft \
  "$DMG"

echo "=== 完成 ==="
echo "已创建草稿 Release: https://github.com/yancongya/SliceCraft/releases/tag/${VERSION}"
echo "去 GitHub 页面检查并发布即可。"
echo ""
echo "Windows 构建要在 Windows 上跑："
echo "  git clone <repo> && cd SliceCraft && npx tauri build"
echo "  然后把 *.exe / *.msi 上传到同一个 Release"
