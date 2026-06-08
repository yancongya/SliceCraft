"""一次性脚本：用 SigLIP 文本编码器 ONNX 重算文本特征

用法：python3 compute_features.py
需要先下载 text_encode.onnx 到 /tmp/siglip-text-encoder.onnx
"""

import os
import sys
import json
import numpy as np

WEIGHTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'upscalers', 'weights'))
FEATURES_DIR = os.path.join(os.path.dirname(__file__), 'features')
LABELS_PATH = os.path.join(FEATURES_DIR, 'siglip_labels.txt')
TOKENIZER_PATH = '/tmp/siglip-tokenizer.json'
TEXT_ENCODER_PATH = '/tmp/siglip-text-encoder.onnx'
OUTPUT_PATH = os.path.join(FEATURES_DIR, 'siglip_text_features.npy')


def load_labels():
    with open(LABELS_PATH, 'r', encoding='utf-8') as f:
        return [line.strip() for line in f if line.strip()]


def main():
    if not os.path.exists(TEXT_ENCODER_PATH):
        print(f"错误: 文本编码器不存在: {TEXT_ENCODER_PATH}")
        print("请先下载: curl -L -o /tmp/siglip-text-encoder.onnx \\")
        print("  https://hf-mirror.com/deepghs/siglip_onnx/resolve/main/google/siglip-base-patch16-224/text_encode.onnx")
        sys.exit(1)

    labels = load_labels()
    print(f"加载了 {len(labels)} 个标签")

    # 加载 tokenizer
    from tokenizers import Tokenizer
    tokenizer = Tokenizer.from_file(TOKENIZER_PATH)
    tokenizer.enable_truncation(max_length=64)
    tokenizer.enable_padding(length=64)

    # 加载 ONNX 文本编码器
    import onnxruntime as ort
    options = ort.SessionOptions()
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    session = ort.InferenceSession(TEXT_ENCODER_PATH, sess_options=options, providers=['CPUExecutionProvider'])

    input_names = [inp.name for inp in session.get_inputs()]
    output_names = [out.name for out in session.get_outputs()]
    print(f"输入: {input_names}, 输出: {output_names}")

    all_features = []
    batch_size = 64

    for i in range(0, len(labels), batch_size):
        batch = labels[i:i + batch_size]
        encoded = tokenizer.encode_batch(batch)

        input_ids = np.array([e.ids for e in encoded], dtype=np.int32)
        attention_mask = np.array([e.attention_mask for e in encoded], dtype=np.int32)

        feed = {}
        for name in input_names:
            if name == 'input_ids':
                feed[name] = input_ids
            elif name == 'attention_mask':
                feed[name] = attention_mask
            else:
                # Try token_type_ids or others - use zeros
                feed[name] = np.zeros_like(input_ids)

        embeds = session.run(output_names, feed)[0]
        norms = np.linalg.norm(embeds, axis=1, keepdims=True)
        embeds = embeds / norms

        all_features.append(embeds)
        print(f"  处理中: {min(i+batch_size, len(labels))}/{len(labels)}")

    features = np.concatenate(all_features, axis=0)
    np.save(OUTPUT_PATH, features)
    print(f"\n完成! 特征已保存: {OUTPUT_PATH}")
    print(f"  形状: {features.shape}")


if __name__ == '__main__':
    main()
