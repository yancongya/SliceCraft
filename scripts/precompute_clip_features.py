#!/usr/bin/env python3
"""
预计算 CLIP 文本特征
运行一次，生成 text_features.npy 文件
之后运行时只需加载预计算的特征，不需要 transformers 和 torch
"""

import numpy as np
import torch
from transformers import CLIPProcessor, CLIPModel
import os

# 默认标签库
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
    
    # 颜色和形状
    "red", "blue", "green", "yellow", "orange",
    "purple", "pink", "black", "white", "gray",
    "dark", "light", "bright", "dim",
    "square", "circle", "triangle", "heart",
    "star shape", "diamond", "hexagon", "polygon",
    
    # 更具体的图标描述
    "settings gear", "search magnifier", "home house",
    "user person", "mail envelope", "phone call",
    "camera photo", "music note", "video play",
    "calendar date", "clock time", "location pin",
    "lock secure", "key unlock", "eye view",
    "bookmark save", "tag label", "flag mark",
    "lightning bolt", "fire flame", "star favorite",
    "heart like", "thumb up", "thumb down",
    "share send", "download save", "upload load",
    "refresh reload", "sync update", "loading wait",
    "check success", "cross close", "plus add",
    "minus remove", "arrow direction", "chevron navigate",
]

def precompute_text_features(labels, output_path):
    """预计算文本特征并保存"""
    print(f"加载 CLIP 模型...")
    model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    
    print(f"计算 {len(labels)} 个标签的文本特征...")
    
    # 分批处理，避免内存溢出
    batch_size = 32
    all_features = []
    
    for i in range(0, len(labels), batch_size):
        batch_labels = labels[i:i+batch_size]
        inputs = processor(text=batch_labels, return_tensors="pt", padding=True, truncation=True)
        
        with torch.no_grad():
            outputs = model.get_text_features(**inputs)
            # outputs 是 BaseModelOutputWithPooling，使用 pooler_output
            if hasattr(outputs, 'pooler_output'):
                text_features = outputs.pooler_output
            elif hasattr(outputs, 'last_hidden_state'):
                text_features = outputs.last_hidden_state[:, 0, :]  # 取 CLS token
            else:
                text_features = outputs
            text_features = text_features / text_features.norm(dim=1, keepdim=True)
            all_features.append(text_features.numpy())
        
        print(f"  处理 {i+len(batch_labels)}/{len(labels)}")
    
    # 合并所有特征
    all_features = np.concatenate(all_features, axis=0)
    
    # 保存
    np.save(output_path, all_features)
    print(f"保存文本特征到: {output_path}")
    print(f"特征形状: {all_features.shape}")
    
    # 同时保存标签列表
    labels_path = output_path.replace('.npy', '_labels.txt')
    with open(labels_path, 'w', encoding='utf-8') as f:
        for label in labels:
            f.write(label + '\n')
    print(f"保存标签列表到: {labels_path}")

if __name__ == '__main__':
    output_dir = os.path.join(os.path.dirname(__file__), '..', 'backend', 'app', 'recognizers', 'features')
    os.makedirs(output_dir, exist_ok=True)
    
    output_path = os.path.join(output_dir, 'clip_text_features.npy')
    precompute_text_features(DEFAULT_LABELS, output_path)
    
    print("\n完成！现在可以将 features 目录同步到 NAS。")
