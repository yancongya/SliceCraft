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

# 预下载 rembg 模型（打包进镜像）
RUN python3 -c "from rembg import new_session; new_session('u2net'); print('u2net OK')"
RUN python3 -c "from rembg import new_session; new_session('isnet-general-use'); print('isnet OK')"

# 预下载 Real-ESRGAN 模型
RUN mkdir -p backend/app/upscalers/weights && \
    curl -L -o backend/app/upscalers/weights/RealESRGAN_x4plus.pth \
        https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth && \
    curl -L -o backend/app/upscalers/weights/RealESRGAN_x2plus.pth \
        https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth && \
    curl -L -o backend/app/upscalers/weights/RealESRGAN_x4plus_anime_6B.pth \
        https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth && \
    echo 'Real-ESRGAN models downloaded'

COPY backend/ ./backend/
COPY frontend/ ./frontend/

RUN mkdir -p /app/data

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8001/api/health || exit 1

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8001"]
