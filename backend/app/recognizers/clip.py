"""零样本图像识别器（ONNX，使用预计算文本特征）

支持：
- SigLIP ViT-B/16 (768维，推荐)
- CLIP ViT-B/32 (512维，回退)
"""

import os
import cv2
import numpy as np
import onnxruntime as ort

MODEL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'upscalers', 'weights'))
SIGLIP_PATH = os.path.join(MODEL_DIR, 'siglip-vit-base-patch16-224.onnx')
CLIP_PATH = os.path.join(MODEL_DIR, 'clip-vit-b32.onnx')
FEATURES_DIR = os.path.join(os.path.dirname(__file__), 'features')

_session_cache = None
_text_features = None
_labels = None


def _detect_model():
    if os.path.exists(SIGLIP_PATH) and os.path.getsize(SIGLIP_PATH) > 100 * 1024 * 1024:
        return 'siglip', SIGLIP_PATH
    return 'clip', CLIP_PATH


def _model_config():
    kind, path = _detect_model()
    if kind == 'siglip':
        return {
            'kind': 'siglip',
            'path': path,
            'size': 224,
            'mean': np.array([0.5, 0.5, 0.5]),
            'std': np.array([0.5, 0.5, 0.5]),
            'embed_dim': 768,
            'logit_scale': 117.3308,
            'logit_bias': -12.9324,
            'features_path': os.path.join(FEATURES_DIR, 'siglip_text_features.npy'),
            'labels_path': os.path.join(FEATURES_DIR, 'siglip_labels.txt'),
        }
    return {
        'kind': 'clip',
        'path': path,
        'size': 224,
        'mean': np.array([0.48145466, 0.4578275, 0.40821073]),
        'std': np.array([0.26862954, 0.26130258, 0.27577711]),
        'embed_dim': 512,
        'features_path': os.path.join(FEATURES_DIR, 'clip_text_features.npy'),
        'labels_path': os.path.join(FEATURES_DIR, 'clip_text_features_labels.txt'),
    }


def _load_precomputed_features():
    global _text_features, _labels
    if _text_features is not None:
        return _text_features, _labels

    cfg = _model_config()
    if not os.path.exists(cfg['features_path']):
        raise FileNotFoundError(f"特征文件不存在: {cfg['features_path']}")

    _text_features = np.load(cfg['features_path'])
    with open(cfg['labels_path'], 'r', encoding='utf-8') as f:
        _labels = [line.strip() for line in f if line.strip()]
    return _text_features, _labels


def _get_session():
    global _session_cache
    if _session_cache is not None:
        return _session_cache

    cfg = _model_config()
    if not os.path.exists(cfg['path']):
        raise FileNotFoundError(f"模型不存在: {cfg['path']}")

    options = ort.SessionOptions()
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    _session_cache = ort.InferenceSession(cfg['path'], sess_options=options, providers=['CPUExecutionProvider'])
    return _session_cache


def preprocess(image: np.ndarray) -> np.ndarray:
    cfg = _model_config()
    img_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    img_resized = cv2.resize(img_rgb, (cfg['size'], cfg['size']), interpolation=cv2.INTER_LINEAR)
    img_float = img_resized.astype(np.float32) / 255.0
    img_normalized = (img_float - cfg['mean']) / cfg['std']
    img_input = np.transpose(img_normalized, (2, 0, 1))
    img_input = np.expand_dims(img_input, 0).astype(np.float32)
    return img_input


def recognize(image: np.ndarray, labels: list = None, top_k: int = 3) -> list:
    session = _get_session()
    text_features, default_labels = _load_precomputed_features()

    if labels is not None:
        indices = [default_labels.index(l) for l in labels if l in default_labels]
        if indices:
            text_features = text_features[indices]
            active_labels = labels
        else:
            active_labels = default_labels
    else:
        active_labels = default_labels

    img_input = preprocess(image)
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    image_features = session.run([output_name], {input_name: img_input})[0]
    image_features = image_features / np.linalg.norm(image_features, axis=1, keepdims=True)

    similarities = np.dot(image_features, text_features.T)[0]
    cfg = _model_config()
    if cfg['kind'] == 'siglip':
        logits = cfg['logit_scale'] * similarities + cfg['logit_bias']
        scores = 1.0 / (1.0 + np.exp(-logits))
        top_indices = np.argsort(logits)[-top_k:][::-1]
    else:
        scores = np.exp(similarities) / np.sum(np.exp(similarities))
        top_indices = np.argsort(scores)[-top_k:][::-1]

    return [
        {
            "label": active_labels[idx],
            "confidence": round(float(scores[idx]), 4),
            "index": int(idx),
        }
        for idx in top_indices
        if idx < len(active_labels)
    ]


def recognize_with_custom_labels(image: np.ndarray, custom_labels: list, top_k: int = 3) -> list:
    return recognize(image, labels=custom_labels, top_k=top_k)


def get_available_labels() -> list:
    _, labels = _load_precomputed_features()
    return labels


def get_model_info() -> dict:
    cfg = _model_config()
    return {
        "name": cfg['kind'],
        "embed_dim": cfg['embed_dim'],
        "features_path": os.path.basename(cfg['features_path']),
        "labels_count": len(_load_precomputed_features()[1]),
    }
