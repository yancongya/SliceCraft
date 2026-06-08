"""一次性脚本：导出 SigLIP 到 ONNX + 重算文本特征

用法：python upgrade_model.py
需要在有 PyTorch 的机器上运行（非 NAS 也可，产出物复制到 NAS 即可）
"""

import os
import sys
import numpy as np
import torch

MODEL_NAME = "google/siglip-base-patch16-224"
WEIGHTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'upscalers', 'weights'))
FEATURES_DIR = os.path.join(os.path.dirname(__file__), 'features')
LABELS_PATH = os.path.join(FEATURES_DIR, 'clip_text_features_labels.txt')


def load_labels():
    with open(LABELS_PATH, 'r', encoding='utf-8') as f:
        return [line.strip() for line in f if line.strip()]


def export_vision_encoder(model):
    """导出 SigLIP 视觉编码器到 ONNX"""
    class SigLIPVisionEncoder(torch.nn.Module):
        def __init__(self, model):
            super().__init__()
            self.model = model

        def forward(self, pixel_values):
            return self.model.get_image_features(pixel_values)

    vision_encoder = SigLIPVisionEncoder(model).eval()

    dummy = torch.randn(1, 3, 224, 224)
    onnx_path = os.path.join(WEIGHTS_DIR, 'siglip-vit-base-patch16-224.onnx')

    torch.onnx.export(
        vision_encoder,
        dummy,
        onnx_path,
        input_names=['pixel_values'],
        output_names=['image_embeds'],
        opset_version=17,
        dynamic_axes={
            'pixel_values': {0: 'batch'},
            'image_embeds': {0: 'batch'},
        },
    )
    print(f"视觉编码器已导出: {onnx_path}")
    return onnx_path


def compute_text_features(model, labels):
    """用 SigLIP 文本编码器计算所有标签的文本特征"""
    from transformers import AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    device = next(model.parameters()).device

    all_features = []
    batch_size = 64

    for i in range(0, len(labels), batch_size):
        batch = labels[i:i + batch_size]
        inputs = tokenizer(batch, padding='max_length', max_length=64,
                           truncation=True, return_tensors='pt')
        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            features = model.get_text_features(**inputs)
            features = features / features.norm(dim=-1, keepdim=True)

        all_features.append(features.cpu())

    text_features = torch.cat(all_features, dim=0).numpy()

    features_path = os.path.join(FEATURES_DIR, 'clip_text_features.npy')
    np.save(features_path, text_features)
    print(f"文本特征已保存: {features_path} ({len(labels)} 条, {text_features.shape[1]} 维)")
    return features_path


def main():
    print(f"正在加载模型: {MODEL_NAME}")
    from transformers import AutoModel
    model = AutoModel.from_pretrained(MODEL_NAME)
    model.eval()
    print("模型加载完成")

    labels = load_labels()
    print(f"标签数量: {len(labels)}")

    export_vision_encoder(model)
    compute_text_features(model, labels)

    print("\n完成！")
    print(f"\n旧模型可删除: {os.path.join(WEIGHTS_DIR, 'clip-vit-b32.onnx')}")
    print("请将新的 ONNX 文件和 features/ 下的 .npy 同步到 NAS")


if __name__ == '__main__':
    main()
