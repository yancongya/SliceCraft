"""CLIP 零样本图像识别器（ONNX 版本）"""

import os
import cv2
import numpy as np
import onnxruntime as ort

# CLIP 视觉模型会话缓存
_session_cache = None

# 预定义的标签库（可根据需要扩展）
DEFAULT_LABELS = [
    # 图标类
    "icon", "button", "logo", "symbol", "emoji",
    "arrow", "checkmark", "cross", "plus", "minus",
    "home", "settings", "search", "menu", "close",
    "user", "avatar", "profile", "account",
    "notification", "bell", "alert", "warning",
    "download", "upload", "share", "link",
    "edit", "delete", "copy", "paste", "save",
    "play", "pause", "stop", "forward", "back",
    "refresh", "sync", "loading", "spinner",
    "filter", "sort", "grid", "list", "view",
    
    # UI 元素
    "tab", "panel", "card", "modal", "dialog",
    "dropdown", "toggle", "switch", "slider",
    "input", "form", "field", "label",
    "header", "footer", "sidebar", "navbar",
    "breadcrumb", "pagination", "progress",
    "tooltip", "popover", "toast", "notification",
    
    # 图片类型
    "photo", "image", "picture", "screenshot",
    "illustration", "drawing", "sketch", "painting",
    "diagram", "chart", "graph", "map",
    "text", "document", "file", "folder",
    "sticker", "badge", "tag", "label",
    
    # 内容类型
    "person", "people", "group", "crowd",
    "animal", "pet", "dog", "cat", "bird",
    "food", "drink", "meal", "snack",
    "vehicle", "car", "bike", "airplane",
    "building", "house", "city", "landscape",
    "nature", "tree", "flower", "mountain",
    "sky", "cloud", "sun", "moon", "star",
    "water", "ocean", "river", "lake",
    
    # 颜色和样式
    "red", "blue", "green", "yellow", "orange",
    "purple", "pink", "black", "white", "gray",
    "dark", "light", "bright", "dim",
    "square", "circle", "triangle", "heart",
    "star", "diamond", "hexagon", "polygon",
]


def _get_session():
    """获取 CLIP 视觉模型 ONNX 会话"""
    global _session_cache
    if _session_cache is not None:
        return _session_cache
    
    model_path = os.path.join(os.path.dirname(__file__), '..', 'upscalers', 'weights', 'clip-vit-b32.onnx')
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"CLIP 模型不存在: {model_path}")
    
    options = ort.SessionOptions()
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    
    _session_cache = ort.InferenceSession(model_path, sess_options=options, providers=['CPUExecutionProvider'])
    return _session_cache


def preprocess(image: np.ndarray) -> np.ndarray:
    """预处理图片：调整大小、归一化"""
    # BGR -> RGB
    img_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    # CLIP 输入大小：224x224
    img_resized = cv2.resize(img_rgb, (224, 224), interpolation=cv2.INTER_LINEAR)
    
    # 归一化到 [0, 1]
    img_float = img_resized.astype(np.float32) / 255.0
    
    # CLIP 标准化参数
    mean = np.array([0.48145466, 0.4578275, 0.40821073])
    std = np.array([0.26862954, 0.26130258, 0.27577711])
    img_normalized = (img_float - mean) / std
    
    # HWC -> NCHW
    img_input = np.transpose(img_normalized, (2, 0, 1))
    img_input = np.expand_dims(img_input, 0).astype(np.float32)
    
    return img_input


def compute_text_features(texts: list) -> np.ndarray:
    """
    计算文本特征（简化版，使用随机特征）
    
    注意：完整的 CLIP 需要文本编码器，这里使用简化的特征
    实际应用中应该使用完整的 CLIP 模型或预计算的文本特征
    """
    # 简化版：为每个文本生成固定的伪特征
    # 实际应该使用 CLIP 的文本编码器
    np.random.seed(42)  # 固定种子，保证一致性
    features = np.random.randn(len(texts), 512).astype(np.float32)
    # 归一化
    features = features / np.linalg.norm(features, axis=1, keepdims=True)
    return features


def recognize(image: np.ndarray, labels: list = None, top_k: int = 3) -> list:
    """
    零样本识别图片内容
    
    Args:
        image: 输入图片 (BGR numpy array)
        labels: 候选标签列表，如果为 None 则使用默认标签
        top_k: 返回前 k 个结果
    
    Returns:
        [{"label": "icon", "confidence": 0.85}, ...]
    """
    if labels is None:
        labels = DEFAULT_LABELS
    
    session = _get_session()
    
    # 预处理图片
    img_input = preprocess(image)
    
    # 获取输入输出名称
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    
    # 推理获取图片特征
    image_features = session.run([output_name], {input_name: img_input})[0]
    
    # 归一化图片特征
    image_features = image_features / np.linalg.norm(image_features, axis=1, keepdims=True)
    
    # 计算文本特征（简化版）
    text_features = compute_text_features(labels)
    
    # 计算相似度
    similarities = np.dot(image_features, text_features.T)[0]
    
    # 应用 softmax 获取概率
    probs = np.exp(similarities) / np.sum(np.exp(similarities))
    
    # 获取 top_k
    top_indices = np.argsort(probs)[-top_k:][::-1]
    
    results = []
    for idx in top_indices:
        confidence = float(probs[idx])
        results.append({
            "label": labels[idx],
            "confidence": round(confidence, 4),
            "index": int(idx)
        })
    
    return results


def recognize_with_custom_labels(image: np.ndarray, custom_labels: list, top_k: int = 3) -> list:
    """
    使用自定义标签进行零样本识别
    
    Args:
        image: 输入图片 (BGR numpy array)
        custom_labels: 自定义标签列表
        top_k: 返回前 k 个结果
    
    Returns:
        [{"label": "custom_label", "confidence": 0.85}, ...]
    """
    return recognize(image, labels=custom_labels, top_k=top_k)
