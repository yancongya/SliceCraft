# 图片元素拆分工具

从元素板图片中自动检测并裁剪出每个独立元素，然后逐个去背景导出透明 PNG。

## 功能特性

- **智能检测**：支持 Canny 边缘检测、泛洪填充、Alpha 通道三种检测方法
- **实时预览**：调节参数后实时更新检测结果，显示轮廓和包围盒
- **多种抠图**：支持 rembg AI 抠图、泛洪填充、双重抠图（两者取并集）
- **批量导出**：支持单个导出和 ZIP 打包下载

## 快速开始

### 快速启动（推荐）

```bash
./start.sh
```

这将同时启动后端和前端服务。

### 分别启动

#### 1. 启动后端

```bash
./start_backend.sh
```

后端将在 http://localhost:8001 启动

#### 2. 启动前端

```bash
./start_frontend.sh
```

前端将在 http://localhost:3000 启动

### 3. 使用工具

1. 打开浏览器访问 http://localhost:3000
2. 上传元素板图片（支持 PNG、JPG、WebP）
3. 选择检测方法并调整参数
4. 点击"开始检测"查看结果
5. 选择抠图方法并点击"去除背景"
6. 点击"导出 ZIP"下载所有元素

## 技术栈

- **后端**：Python FastAPI + OpenCV + rembg
- **前端**：纯 HTML/CSS/JavaScript
- **图像处理**：OpenCV、Pillow、scipy
- **AI 抠图**：rembg (ONNX Runtime)

## 项目结构

```
image-splitter/
├── backend/           # 后端代码
│   ├── app/
│   │   ├── main.py    # FastAPI 主程序
│   │   ├── detectors/ # 检测算法
│   │   ├── removers/  # 抠图算法
│   │   └── utils/     # 工具函数
│   └── start.sh       # 后端启动脚本
├── frontend/          # 前端代码
│   └── index.html     # 主页面
├── venv/              # Python 虚拟环境
├── requirements.txt   # Python 依赖
├── start_backend.sh   # 后端启动脚本
├── start_frontend.sh  # 前端启动脚本
└── README.md          # 本文件
```

## API 接口

### 上传图片
- `POST /api/upload`
- 参数：`file` (图片文件)
- 返回：图片 ID、尺寸、预览

### 检测元素
- `POST /api/detect`
- 参数：`image_id`, `method`, 各种检测参数
- 返回：检测结果数量、包围盒、预览

### 去除背景
- `POST /api/remove_background`
- 参数：`image_id`, `method`, `model`, `flood_tolerance`
- 返回：处理结果预览

### 导出结果
- `POST /api/export`
- 参数：`image_id`
- 返回：ZIP 文件

### 健康检查
- `GET /api/health`
- 返回：服务状态

## 预设参数

| 场景 | 检测方法 | 关键参数 |
|------|---------|---------|
| 纯色背景元素板 | 泛洪填充 | 容差 30-80 |
| 游戏精灵图 | Canny | Sigma 1.0, T1 50, T2 150 |
| UI 图标集 | Canny | Sigma 0.8, T1 60, T2 180 |
| 手绘/水彩风 | Canny | Sigma 2.5, T1 30, T2 90 |
| 已有透明背景 | Alpha | 阈值 30 |

## 注意事项

- 图片处理在本地进行，不会上传到外部服务器
- 处理 2048x2048 图片应在 10 秒内完成检测
- rembg 单个元素抠图应在 3 秒内完成
- 支持批量处理 50+ 个元素