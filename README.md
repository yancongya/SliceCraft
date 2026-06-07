# Image Splitter

图片切分与抠图工具，支持元素检测、AI 抠图、吸管取色、导出 PNG/ZIP/PSD。

## 功能

- **切分 Tab**：上传图片 → 自动检测元素 → 导出
- **抠图 Tab**：AI 抠图 / 泛洪填充 / 吸管取色 / 双重抠图
- **导出**：单个 PNG / ZIP 打包 / PSD 文件（支持按位置/左上对齐）

## 本地开发

```bash
# 启动开发环境
./scripts/dev.sh start

# 停止
./scripts/dev.sh stop

# 查看状态
./scripts/dev.sh status
```

访问 http://localhost:3000

## Docker 部署到 NAS

```bash
# 一键部署
./scripts/deploy.sh "feat: 新功能"

# 访问
http://192.168.31.110:8001
```

## SMB 热开发

```bash
# 挂载 NAS 目录到本地
./scripts/mount.sh mount

# 卸载
./scripts/mount.sh umount

# 查看状态
./scripts/mount.sh status
```

挂载后直接编辑 `/tmp/nas-services/image-splitter/` 下的文件，重启容器生效。

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/upload` | POST | 上传图片 |
| `/api/detect` | POST | 检测元素 |
| `/api/remove_background` | POST | 抠图 |
| `/api/export` | GET | 导出 ZIP |
| `/api/export_zip_from_elements` | POST | 导出 ZIP（抠图结果） |
| `/api/export_psd_from_elements` | POST | 导出 PSD |
| `/api/health` | GET | 健康检查 |

## 目录结构

```
image-splitter/
├── backend/           # FastAPI 后端
├── frontend/          # 前端页面
├── scripts/           # 脚本
│   ├── deploy.sh      # 部署到 NAS
│   ├── dev.sh         # 本地开发
│   └── mount.sh       # SMB 挂载
├── Dockerfile
└── docker-compose.yml
```
