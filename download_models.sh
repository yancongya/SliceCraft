#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate

echo "正在下载 RMBG-1.4 模型..."
python3 -c "
from transformers import AutoModelForImageSegmentation, AutoProcessor
print('下载 processor...')
AutoProcessor.from_pretrained('briaai/RMBG-1.4', trust_remote_code=True)
print('下载 model...')
AutoModelForImageSegmentation.from_pretrained('briaai/RMBG-1.4', trust_remote_code=True)
print('✅ RMBG-1.4 模型下载完成！')
"

echo ""
echo "正在下载 rembg 模型..."
python3 -c "
from rembg import new_session
print('下载 u2net...')
new_session('u2net')
print('✅ rembg 模型下载完成！')
"