#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

WEIGHTS_DIR="backend/app/upscalers/weights"
MODELS_DIR="backend/app/recognizers/features"
mkdir -p "$WEIGHTS_DIR" "$MODELS_DIR"

echo "=== 下载识别模型 (SigLIP) ==="
if [ ! -f "$WEIGHTS_DIR/siglip-vit-base-patch16-224.onnx" ]; then
    echo "下载 SigLIP 视觉编码器 (355MB)..."
    curl -#L -o "$WEIGHTS_DIR/siglip-vit-base-patch16-224.onnx" \
        https://huggingface.co/google/siglip-base-patch16-224/resolve/main/siglip-vit-base-patch16-224.onnx
else
    echo "SigLIP ONNX 已存在，跳过"
fi

if [ ! -f "$MODELS_DIR/siglip_text_features.npy" ]; then
    echo "错误: 文本特征文件缺失，请先运行 compute_features.py"
    echo "需要下载模型权重 + 使用 transformers 计算 640 条文本特征"
    exit 1
fi

echo ""
echo "=== 下载放大模型 (Real-ESRGAN) ==="
for model in \
    "RealESRGAN_x4plus.pth|https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth" \
    "RealESRGAN_x2plus.pth|https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth" \
    "RealESRGAN_x4plus_anime_6B.pth|https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth"; do
    name="${model%%|*}"
    url="${model##*|}"
    if [ ! -f "$WEIGHTS_DIR/$name" ]; then
        echo "下载 $name..."
        curl -#L -o "$WEIGHTS_DIR/$name" "$url"
    else
        echo "$name 已存在，跳过"
    fi
done

echo ""
echo "=== 下载抠图模型 (rembg) ==="
source venv/bin/activate
python3 -c "
from rembg import new_session
print('下载 u2net...')
new_session('u2net')
print('下载 isnet-general-use...')
new_session('isnet-general-use')
"

echo ""
echo "✅ 所有模型下载完成！"
echo "   识别: $(ls $WEIGHTS_DIR/siglip-*.onnx 2>/dev/null | wc -l) 个 ONNX"
echo "   放大: $(ls $WEIGHTS_DIR/RealESRGAN_*.pth 2>/dev/null | wc -l) 个 ESRGAN"
echo "   抠图: rembg (u2net + isnet)"
echo ""
echo "如需 CLIP 回退模型，手动下载:"
echo "  curl -#L -o $WEIGHTS_DIR/clip-vit-b32.onnx https://huggingface.co/openai/clip-vit-base-patch32/resolve/main/onnx/image_encoder.onnx"