FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends libgl1 libglib2.0-0 curl && \
    rm -rf /var/lib/apt/lists/*

# 安装 PyTorch CPU 版本（兼容版本）
RUN pip install --no-cache-dir \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    torch==2.2.0+cpu \
    torchvision==0.17.0+cpu

# 安装其他依赖
RUN pip install --no-cache-dir \
    fastapi uvicorn[standard] python-multipart \
    opencv-python-headless Pillow rembg numpy psd-tools \
    onnxruntime realesrgan==0.3.0 basicsr==1.4.2

# 修复 basicsr 兼容性问题
RUN sed -i 's/from torchvision.transforms.functional_tensor import rgb_to_grayscale/from torchvision.transforms.functional import rgb_to_grayscale/' \
    /usr/local/lib/python3.11/site-packages/basicsr/data/degradations.py

# 模型目录（挂载卷，不打包进镜像）
RUN mkdir -p /app/backend/app/upscalers/weights /root/.u2net

# 模型目录（挂载卷，不打包进镜像）
RUN mkdir -p /app/backend/app/upscalers/weights /root/.u2net

COPY backend/ ./backend/
COPY frontend/ ./frontend/

RUN mkdir -p /app/data

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8001/api/health || exit 1

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
