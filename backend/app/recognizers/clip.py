"""CLIP 零样本图像识别器（ONNX 版本，使用预计算文本特征）"""

import os
import cv2
import numpy as np
import onnxruntime as ort

# 视觉模型会话缓存
_session_cache = None

# 预计算的文本特征和标签
_text_features = None
_labels = None


def _load_precomputed_features():
    """加载预计算的文本特征和标签"""
    global _text_features, _labels
    
    if _text_features is not None:
        return _text_features, _labels
    
    features_dir = os.path.join(os.path.dirname(__file__), 'features')
    features_path = os.path.join(features_dir, 'clip_text_features.npy')
    labels_path = os.path.join(features_dir, 'clip_text_features_labels.txt')
    
    if not os.path.exists(features_path):
        raise FileNotFoundError(f"预计算特征文件不存在: {features_path}")
    
    # 加载文本特征
    _text_features = np.load(features_path)
    
    # 加载标签
    with open(labels_path, 'r', encoding='utf-8') as f:
        _labels = [line.strip() for line in f if line.strip()]
    
    return _text_features, _labels


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


def recognize(image: np.ndarray, labels: list = None, top_k: int = 3) -> list:
    """
    零样本识别图片内容
    
    Args:
        image: 输入图片 (BGR numpy array)
        labels: 候选标签列表（如果为 None，使用预计算的标签）
        top_k: 返回前 k 个结果
    
    Returns:
        [{"label": "icon", "confidence": 0.85}, ...]
    """
    session = _get_session()
    
    # 加载预计算的文本特征
    text_features, default_labels = _load_precomputed_features()
    
    # 如果指定了自定义标签，需要重新计算文本特征（简化版：使用默认特征的子集）
    if labels is not None:
        # 找到自定义标签在默认标签中的索引
        indices = []
        for label in labels:
            if label in default_labels:
                indices.append(default_labels.index(label))
        
        if indices:
            text_features = text_features[indices]
            active_labels = labels
        else:
            # 如果没有匹配的标签，使用默认标签
            active_labels = default_labels
    else:
        active_labels = default_labels
    
    # 预处理图片
    img_input = preprocess(image)
    
    # 获取输入输出名称
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    
    # 推理获取图片特征
    image_features = session.run([output_name], {input_name: img_input})[0]
    
    # 归一化图片特征
    image_features = image_features / np.linalg.norm(image_features, axis=1, keepdims=True)
    
    # 计算相似度
    similarities = np.dot(image_features, text_features.T)[0]
    
    # 应用 softmax 获取概率
    probs = np.exp(similarities) / np.sum(np.exp(similarities))
    
    # 获取 top_k
    top_indices = np.argsort(probs)[-top_k:][::-1]
    
    results = []
    for idx in top_indices:
        confidence = float(probs[idx])
        if idx < len(active_labels):
            results.append({
                "label": active_labels[idx],
                "confidence": round(confidence, 4),
                "index": int(idx)
            })
    
    return results


def recognize_with_custom_labels(image: np.ndarray, custom_labels: list, top_k: int = 3) -> list:
    """
    使用自定义标签进行零样本识别
    
    注意：自定义标签必须在预计算的标签列表中，否则会被忽略
    """
    return recognize(image, labels=custom_labels, top_k=top_k)


def get_available_labels() -> list:
    """获取可用的标签列表"""
    _, labels = _load_precomputed_features()
    return labels
