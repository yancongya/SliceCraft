#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate

echo "正在下载 rembg 模型..."
python3 -c "
from rembg import new_session
print('下载 u2net...')
new_session('u2net')
print('下载 isnet-general-use...')
new_session('isnet-general-use')
print('✅ rembg 模型下载完成！')
"

echo ""
echo "正在下载 Real-ESRGAN 模型..."
WEIGHTS_DIR="backend/app/upscalers/weights"
mkdir -p "$WEIGHTS_DIR"

if [ ! -f "$WEIGHTS_DIR/RealESRGAN_x4plus.pth" ]; then
    echo "下载 RealESRGAN_x4plus..."
    curl -L -o "$WEIGHTS_DIR/RealESRGAN_x4plus.pth" \
        https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth
else
    echo "RealESRGAN_x4plus 已存在，跳过"
fi

if [ ! -f "$WEIGHTS_DIR/RealESRGAN_x2plus.pth" ]; then
    echo "下载 RealESRGAN_x2plus..."
    curl -L -o "$WEIGHTS_DIR/RealESRGAN_x2plus.pth" \
        https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth
else
    echo "RealESRGAN_x2plus 已存在，跳过"
fi

if [ ! -f "$WEIGHTS_DIR/RealESRGAN_x4plus_anime_6B.pth" ]; then
    echo "下载 RealESRGAN_x4plus_anime_6B..."
    curl -L -o "$WEIGHTS_DIR/RealESRGAN_x4plus_anime_6B.pth" \
        https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth
else
    echo "RealESRGAN_x4plus_anime_6B 已存在，跳过"
fi

echo ""
echo "✅ 所有模型下载完成！"