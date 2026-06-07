"""Real-ESRGAN 图片超分辨率放大模块（ONNX 版本，无 PyTorch 依赖）"""

import os
import cv2
import numpy as np
from PIL import Image
import onnxruntime as ort

# 模型配置
MODELS = {
    "realesrgan-light": {
        "file": "realesrgan-light.onnx",
        "scale": 4,
        "description": "轻量版，速度快，适合 CPU",
        "size": "4.7MB"
    },
}

# 全局会话缓存
_session_cache = {}


def _get_session(model_name: str):
    """获取或创建 ONNX 推理会话（带缓存）"""
    if model_name in _session_cache:
        return _session_cache[model_name]

    model_config = MODELS.get(model_name)
    if not model_config:
        raise ValueError(f"未知模型: {model_name}")

    # 查找模型文件
    model_path = os.path.join(os.path.dirname(__file__), "weights", model_config["file"])
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"模型文件不存在: {model_path}")

    # 创建推理选项
    options = ort.SessionOptions()
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    options.intra_op_num_threads = 4

    # 创建推理会话
    providers = ['CPUExecutionProvider']
    session = ort.InferenceSession(model_path, sess_options=options, providers=providers)

    _session_cache[model_name] = session
    return session


def upscale_image(
    image: np.ndarray,
    model_name: str = "realesrgan-light",
    outscale: float = None,
) -> np.ndarray:
    """
    放大图片

    Args:
        image: 输入图片 (BGR numpy array)
        model_name: 模型名称
        outscale: 输出倍数（默认使用模型原生倍数）

    Returns:
        放大后的图片 (BGR numpy array)
    """
    model_config = MODELS.get(model_name)
    if not model_config:
        raise ValueError(f"未知模型: {model_name}")

    session = _get_session(model_name)

    # 如果没有指定倍数，使用模型原生倍数
    if outscale is None:
        outscale = model_config["scale"]

    # 处理 alpha 通道
    has_alpha = len(image.shape) == 3 and image.shape[2] == 4
    if has_alpha:
        alpha_channel = image[:, :, 3]
        image_bgr = image[:, :, :3]
    else:
        image_bgr = image

    # BGR -> RGB
    img_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)

    # 归一化到 [0, 1]
    img_float = img_rgb.astype(np.float32) / 255.0

    # HWC -> NCHW
    img_input = np.transpose(img_float, (2, 0, 1))
    img_input = np.expand_dims(img_input, 0).astype(np.float16)  # 模型需要 float16

    # 获取输入输出名称
    inputs = session.get_inputs()
    output_name = session.get_outputs()[0].name

    # 构建输入字典
    feed = {}
    for inp in inputs:
        if inp.name == 'input':
            feed[inp.name] = img_input
        elif inp.name == 'denoise_strength':
            # 降噪强度，默认 0.5
            feed[inp.name] = np.array([0.5], dtype=np.float16)
        else:
            # 其他参数，用默认值
            feed[inp.name] = np.zeros(inp.shape, dtype=np.float16)

    # 推理
    output = session.run([output_name], feed)[0]

    # NCHW -> HWC
    output = np.squeeze(output, 0)
    output = np.transpose(output, (1, 2, 0))

    # 反归一化到 [0, 255]
    output = np.clip(output * 255, 0, 255).astype(np.uint8)

    # RGB -> BGR
    output_bgr = cv2.cvtColor(output, cv2.COLOR_RGB2BGR)

    # 如果需要调整倍数
    if outscale != model_config["scale"]:
        h, w = image_bgr.shape[:2]
        new_h, new_w = int(h * outscale), int(w * outscale)
        output_bgr = cv2.resize(output_bgr, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)

    # 处理 alpha 通道
    if has_alpha:
        # 放大 alpha 通道
        alpha_resized = cv2.resize(
            alpha_channel,
            (output_bgr.shape[1], output_bgr.shape[0]),
            interpolation=cv2.INTER_CUBIC,
        )
        output_bgr = np.dstack([output_bgr, alpha_resized[:, :, np.newaxis]])

    return output_bgr


def get_model_info() -> list:
    """获取所有可用模型信息"""
    result = []
    for name, config in MODELS.items():
        model_path = os.path.join(os.path.dirname(__file__), "weights", config["file"])
        exists = os.path.exists(model_path)
        result.append({
            "name": name,
            "scale": config["scale"],
            "description": config["description"],
            "size": config["size"],
            "available": exists,
        })
    return result
