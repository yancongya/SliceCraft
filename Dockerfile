FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends libgl1 libglib2.0-0 curl git && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# 安装 CPU 版本 PyTorch 和依赖
RUN pip install --no-cache-dir \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    torch torchvision && \
    pip install --no-cache-dir \
    fastapi uvicorn[standard] python-multipart \
    opencv-python-headless Pillow rembg numpy psd-tools \
    onnxruntime realesrgan basicsr

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

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8001"]
