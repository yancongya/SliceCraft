"""Real-ESRGAN 图片超分辨率放大模块"""

import os
import cv2
import numpy as np
from PIL import Image
from typing import Optional

# 模型配置
MODELS = {
    "RealESRGAN_x4plus": {
        "scale": 4,
        "description": "通用场景，质量最佳",
        "model_path": "weights/RealESRGAN_x4plus.pth",
    },
    "RealESRGAN_x2plus": {
        "scale": 2,
        "description": "2倍放大，更细腻",
        "model_path": "weights/RealESRGAN_x2plus.pth",
    },
    "RealESRGAN_x4plus_anime_6B": {
        "scale": 4,
        "description": "二次元/插画专用",
        "model_path": "weights/RealESRGAN_x4plus_anime_6B.pth",
    },
}

# 全局模型缓存
_upscaler_cache = {}


def _get_upscaler(model_name: str, tile_size: int = 0, half_precision: bool = True):
    """获取或创建 upscaler 实例（带缓存）"""
    if model_name in _upscaler_cache:
        return _upscaler_cache[model_name]

    from realesrgan import RealESRGANer
    from basicsr.archs.rrdbnet_arch import RRDBNet

    model_config = MODELS.get(model_name)
    if not model_config:
        raise ValueError(f"未知模型: {model_name}")

    # 构建模型网络
    if "anime_6B" in model_name:
        # 动漫模型用更轻量的网络
        model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=6, num_grow_ch=32, scale=4)
    else:
        model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)

    # 确定权重路径
    model_path = os.path.join(os.path.dirname(__file__), model_config["model_path"])
    if not os.path.exists(model_path):
        # 尝试从项目根目录找
        root_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), model_config["model_path"])
        if os.path.exists(root_path):
            model_path = root_path
        else:
            raise FileNotFoundError(f"模型文件不存在: {model_path}")

    # 自动检测设备
    import torch
    if torch.cuda.is_available():
        device = "cuda"
        half = half_precision
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = "mps"
        half = False  # MPS 不支持半精度
    else:
        device = "cpu"
        half = False

    upscaler = RealESRGANer(
        scale=model_config["scale"],
        model_path=model_path,
        model=model,
        tile=tile_size,
        tile_pad=10,
        pre_pad=0,
        half=half,
        device=device,
    )

    _upscaler_cache[model_name] = upscaler
    return upscaler


def upscale_image(
    image: np.ndarray,
    model_name: str = "RealESRGAN_x4plus",
    outscale: Optional[float] = None,
    tile_size: int = 0,
) -> np.ndarray:
    """
    放大图片

    Args:
        image: 输入图片 (BGR numpy array)
        model_name: 模型名称
        outscale: 输出倍数（默认使用模型原生倍数）
        tile_size: 分块大小（0=不分块，适合显存大的情况）

    Returns:
        放大后的图片 (BGR numpy array)
    """
    model_config = MODELS.get(model_name)
    if not model_config:
        raise ValueError(f"未知模型: {model_name}")

    upscaler = _get_upscaler(model_name, tile_size=tile_size)

    # 如果没有指定倍数，使用模型原生倍数
    if outscale is None:
        outscale = model_config["scale"]

    # 处理 alpha 通道
    has_alpha = len(image.shape) == 3 and image.shape[2] == 4
    if has_alpha:
        # 分离 alpha 通道
        alpha_channel = image[:, :, 3]
        image_bgr = image[:, :, :3]

        # 放大 RGB 部分
        output_bgr, _ = upscaler.enhance(image_bgr, outscale=outscale)

        # 放大 alpha 通道（用双三次插值）
        output_alpha = cv2.resize(
            alpha_channel,
            (output_bgr.shape[1], output_bgr.shape[0]),
            interpolation=cv2.INTER_CUBIC,
        )

        # 合并
        output = np.dstack([output_bgr, output_alpha[:, :, np.newaxis]])
    else:
        output, _ = upscaler.enhance(image, outscale=outscale)

    return output


def get_model_info() -> list:
    """获取所有可用模型信息"""
    result = []
    for name, config in MODELS.items():
        model_path = os.path.join(os.path.dirname(__file__), config["model_path"])
        exists = os.path.exists(model_path)
        result.append({
            "name": name,
            "scale": config["scale"],
            "description": config["description"],
            "available": exists,
        })
    return result
