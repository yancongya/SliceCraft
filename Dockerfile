FROM python:3.11-slim

WORKDIR /app

# 系统依赖（OpenCV 需要）
RUN apt-get update && \
    apt-get install -y --no-install-recommends libgl1 libglib2.0-0 curl && \
    rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖（利用缓存）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# 数据目录
RUN mkdir -p /app/data

ENV PYTHONUNBUFFERED=1

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8001/api/health || exit 1

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8001"]
