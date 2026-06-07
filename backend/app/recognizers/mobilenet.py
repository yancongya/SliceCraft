"""MobileNet 图像分类识别器（ONNX 版本）"""

import os
import cv2
import numpy as np
import onnxruntime as ort

# ImageNet 类别标签（简化版，只保留常见类别）
IMAGENET_LABELS = None
_session_cache = None


def _load_labels():
    """加载 ImageNet 类别标签"""
    global IMAGENET_LABELS
    if IMAGENET_LABELS is not None:
        return IMAGENET_LABELS
    
    # 常见类别的简化映射（英文 -> 简短标签）
    label_map = {
        # 动物
        'tabby': 'cat', 'tiger_cat': 'cat', 'persian_cat': 'cat', 'siamese_cat': 'cat',
        'egyptian_cat': 'cat', 'cat': 'cat', 'kitten': 'cat',
        'golden_retriever': 'dog', 'labrador_retriever': 'dog', 'german_shepherd': 'dog',
        'beagle': 'dog', 'poodle': 'dog', 'chihuahua': 'dog', 'dog': 'dog', 'puppy': 'dog',
        'bird': 'bird', 'robin': 'bird', 'eagle': 'bird', 'parrot': 'bird',
        'fish': 'fish', 'goldfish': 'fish', 'shark': 'fish',
        'horse': 'horse', 'zebra': 'zebra', 'deer': 'deer', 'elephant': 'elephant',
        'lion': 'lion', 'tiger': 'tiger', 'bear': 'bear', 'rabbit': 'rabbit',
        'mouse': 'mouse', 'rat': 'rat', 'hamster': 'hamster',
        'turtle': 'turtle', 'snake': 'snake', 'frog': 'frog', 'frog': 'frog',
        'butterfly': 'butterfly', 'bee': 'bee', 'ant': 'ant', 'spider': 'spider',
        
        # 食物
        'pizza': 'pizza', 'burger': 'burger', 'hamburger': 'burger',
        'ice_cream': 'ice_cream', 'icecream': 'ice_cream',
        'cake': 'cake', 'chocolate': 'chocolate', 'cookie': 'cookie',
        'apple': 'apple', 'banana': 'banana', 'orange': 'orange', 'grape': 'grape',
        'strawberry': 'strawberry', 'watermelon': 'watermelon', 'lemon': 'lemon',
        'bread': 'bread', 'sandwich': 'sandwich', 'hotdog': 'hotdog',
        'sushi': 'sushi', 'rice': 'rice', 'noodle': 'noodle', 'pasta': 'pasta',
        'coffee': 'coffee', 'tea': 'tea', 'beer': 'beer', 'wine': 'wine',
        'milk': 'milk', 'juice': 'juice', 'water': 'water', 'bottle': 'bottle',
        
        # 交通工具
        'car': 'car', 'automobile': 'car', 'taxi': 'car', 'police_car': 'car',
        'truck': 'truck', 'bus': 'bus', 'van': 'van',
        'bicycle': 'bicycle', 'motorcycle': 'motorcycle', 'scooter': 'scooter',
        'airplane': 'airplane', 'plane': 'airplane', 'helicopter': 'helicopter',
        'boat': 'boat', 'ship': 'ship', 'yacht': 'yacht',
        'train': 'train', 'subway': 'subway',
        
        # 电子产品
        'laptop': 'laptop', 'computer': 'computer', 'pc': 'computer',
        'phone': 'phone', 'smartphone': 'phone', 'mobile': 'phone',
        'tablet': 'tablet', 'ipad': 'tablet',
        'monitor': 'monitor', 'screen': 'monitor', 'display': 'monitor',
        'keyboard': 'keyboard', 'mouse': 'mouse', 'remote': 'remote',
        'camera': 'camera', 'tv': 'tv', 'television': 'tv',
        'headphones': 'headphones', 'speaker': 'speaker', 'microphone': 'microphone',
        
        # 家具
        'chair': 'chair', 'table': 'table', 'desk': 'desk',
        'sofa': 'sofa', 'couch': 'sofa', 'bed': 'bed',
        'cabinet': 'cabinet', 'shelf': 'shelf', 'bookshelf': 'bookshelf',
        'door': 'door', 'window': 'window', 'mirror': 'mirror',
        'lamp': 'lamp', 'light': 'light', 'candle': 'candle',
        
        # 服装
        'shirt': 'shirt', 't-shirt': 'shirt', 'dress': 'dress',
        'pants': 'pants', 'jeans': 'pants', 'shorts': 'shorts',
        'shoes': 'shoes', 'sneakers': 'shoes', 'boots': 'boots',
        'hat': 'hat', 'cap': 'cap', 'glasses': 'glasses',
        'bag': 'bag', 'handbag': 'bag', 'backpack': 'bag',
        
        # 运动
        'ball': 'ball', 'football': 'football', 'basketball': 'basketball',
        'tennis': 'tennis', 'baseball': 'baseball', 'golf': 'golf',
        'racket': 'racket', 'bat': 'bat', 'skateboard': 'skateboard',
        'surfboard': 'surfboard', 'ski': 'ski', 'snowboard': 'snowboard',
        
        # 自然
        'tree': 'tree', 'flower': 'flower', 'plant': 'plant', 'leaf': 'leaf',
        'mountain': 'mountain', 'hill': 'hill', 'valley': 'valley',
        'river': 'river', 'lake': 'lake', 'ocean': 'ocean', 'sea': 'ocean',
        'beach': 'beach', 'island': 'island', 'forest': 'forest',
        'cloud': 'cloud', 'rain': 'rain', 'snow': 'snow', 'sun': 'sun',
        'moon': 'moon', 'star': 'star', 'sky': 'sky',
        
        # 建筑
        'house': 'house', 'building': 'building', 'skyscraper': 'building',
        'church': 'church', 'castle': 'castle', 'tower': 'tower',
        'bridge': 'bridge', 'fountain': 'fountain',
        
        # 其他
        'book': 'book', 'pen': 'pen', 'pencil': 'pencil', 'paper': 'paper',
        'clock': 'clock', 'watch': 'watch', 'ring': 'ring',
        'key': 'key', 'lock': 'lock', 'coin': 'coin',
        'toy': 'toy', 'doll': 'doll', 'teddy': 'teddy',
        'gift': 'gift', 'box': 'box', 'bag': 'bag',
        'flag': 'flag', 'umbrella': 'umbrella', 'glove': 'glove',
    }
    
    IMAGENET_LABELS = label_map
    return IMAGENET_LABELS


def _get_session():
    """获取 MobileNet ONNX 会话"""
    global _session_cache
    if _session_cache is not None:
        return _session_cache
    
    model_path = os.path.join(os.path.dirname(__file__), '..', 'upscalers', 'weights', 'mobilenetv2.onnx')
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"MobileNet 模型不存在: {model_path}")
    
    options = ort.SessionOptions()
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    
    _session_cache = ort.InferenceSession(model_path, sess_options=options, providers=['CPUExecutionProvider'])
    return _session_cache


def preprocess(image: np.ndarray) -> np.ndarray:
    """预处理图片：调整大小、归一化"""
    # BGR -> RGB
    img_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    # 调整大小到 224x224
    img_resized = cv2.resize(img_rgb, (224, 224), interpolation=cv2.INTER_LINEAR)
    
    # 归一化到 [0, 1]
    img_float = img_resized.astype(np.float32) / 255.0
    
    # ImageNet 标准化
    mean = np.array([0.485, 0.456, 0.406])
    std = np.array([0.229, 0.224, 0.225])
    img_normalized = (img_float - mean) / std
    
    # HWC -> NCHW
    img_input = np.transpose(img_normalized, (2, 0, 1))
    img_input = np.expand_dims(img_input, 0).astype(np.float32)
    
    return img_input


def recognize(image: np.ndarray, top_k: int = 3) -> list:
    """
    识别图片内容
    
    Args:
        image: 输入图片 (BGR numpy array)
        top_k: 返回前 k 个结果
    
    Returns:
        [{"label": "cat", "confidence": 0.92}, ...]
    """
    session = _get_session()
    label_map = _load_labels()
    
    # 预处理
    img_input = preprocess(image)
    
    # 获取输入输出名称
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    
    # 推理
    output = session.run([output_name], {input_name: img_input})[0]
    
    # 获取概率分布
    probs = np.squeeze(output)
    
    # 应用 softmax
    probs = np.exp(probs) / np.sum(np.exp(probs))
    
    # 获取 top_k
    top_indices = np.argsort(probs)[-top_k:][::-1]
    
    results = []
    for idx in top_indices:
        confidence = float(probs[idx])
        # 尝试从标签映射中获取简短标签
        # MobileNet v2 输出 1000 类，需要从标签文件获取原始标签
        label = _get_label_from_index(idx)
        short_label = label_map.get(label, label)
        
        results.append({
            "label": short_label,
            "original_label": label,
            "confidence": round(confidence, 4),
            "index": int(idx)
        })
    
    return results


def _get_label_from_index(index: int) -> str:
    """从索引获取 ImageNet 标签"""
    # 简化的 ImageNet 标签（前 100 个常见类别）
    # 完整列表需要从文件加载
    simple_labels = [
        'tench', 'goldfish', 'great_white_shark', 'tiger_shark', 'hammerhead',
        'electric_ray', 'stingray', 'rooster', 'hen', 'ostrich',
        'brambling', 'goldfinch', 'house_finch', 'junco', 'indigo_bunting',
        'robin', 'bulbul', 'jay', 'magpie', 'chickadee',
        'water_ouzel', 'kite', 'bald_eagle', 'vulture', 'great_grey_owl',
        'european_fire_salamander', 'common_newt', 'eft', 'spotted_salamander', 'axolotl',
        'bullfrog', 'tree_frog', 'tailed_frog', 'loggerhead', 'leatherback_turtle',
        'mud_turtle', 'terrapin', 'box_turtle', 'banded_gecko', 'common_iguana',
        'american_chameleon', 'whiptail', 'agama', 'frilled_lizard', 'alligator_lizard',
        'gila_monster', 'green_lizard', 'african_chameleon', 'komodo_dragon', 'african_crocodile',
        'american_alligator', 'triceratops', 'thunder_snake', 'ringneck_snake', 'hognose_snake',
        'green_snake', 'king_snake', 'garter_snake', 'water_snake', 'vine_snake',
        'night_snake', 'boa_constrictor', 'rock_python', 'indian_cobra', 'green_mamba',
        'sea_snake', 'horned_viper', 'diamondback', 'sidewinder', 'trilobite',
        'harvestman', 'scorpion', 'black_and_gold_garden_spider', 'barn_spider', 'garden_spider',
        'black_widow', 'tarantula', 'wolf_spider', 'tick', 'centipede',
        'black_grouse', 'ptarmigan', 'ruffed_grouse', 'prairie_chicken', 'peacock',
        'quail', 'partridge', 'african_grey', 'macaw', 'sulphur_crested_cockatoo',
        'lorikeet', 'coucal', 'bee_eater', 'hornbill', 'hummingbird',
        'jacamar', 'toucan', 'drake', 'red_breasted_merganser', 'goose',
    ]
    
    if index < len(simple_labels):
        return simple_labels[index]
    return f'class_{index}'
