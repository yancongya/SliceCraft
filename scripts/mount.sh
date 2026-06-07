#!/bin/bash
# mount.sh — SMB 挂载 NAS 目录到本地
# 用法: ./scripts/mount.sh [mount|umount|status]

set -e

NAS_HOST="tycon@192.168.31.110"
NAS_PASS="Aa.520.1323"
NAS_SHARE="//tycon:Aa.520.1323@192.168.31.110/services"
LOCAL_MOUNT="/tmp/nas-services"

case "${1:-mount}" in
  mount)
    echo "📁 挂载 NAS services 目录..."
    mkdir -p "$LOCAL_MOUNT"
    
    # 检查是否已挂载
    if mount | grep -q "$LOCAL_MOUNT"; then
      echo "⚠️  已挂载，先卸载..."
      umount "$LOCAL_MOUNT" 2>/dev/null || true
    fi
    
    mount_smbfs "$NAS_SHARE" "$LOCAL_MOUNT"
    echo "✅ 已挂载: $LOCAL_MOUNT"
    echo ""
    echo "项目目录: $LOCAL_MOUNT/image-splitter/"
    echo "数据目录: $LOCAL_MOUNT/data/image-splitter/"
    ;;
    
  umount)
    echo "📁 卸载 NAS services 目录..."
    umount "$LOCAL_MOUNT" 2>/dev/null || true
    echo "✅ 已卸载"
    ;;
    
  status)
    echo "📊 挂载状态:"
    if mount | grep -q "$LOCAL_MOUNT"; then
      echo "  ✅ 已挂载: $LOCAL_MOUNT"
      ls -la "$LOCAL_MOUNT/" | head -5
    else
      echo "  ❌ 未挂载"
    fi
    ;;
    
  *)
    echo "用法: $0 [mount|umount|status]"
    exit 1
    ;;
esac
