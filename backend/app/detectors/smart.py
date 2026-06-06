import cv2
import numpy as np
from typing import List, Tuple


def detect(
    img: np.ndarray,
    mode: str = "auto",
    sensitivity: int = 50,
    min_area: int = 500,
    merge_distance: int = 20,
) -> Tuple[List[np.ndarray], List[Tuple[int, int, int, int]]]:
    """
    智能检测元素，自动选择最佳方法
    
    Args:
        img: 输入图像
        mode: 检测模式
            - "auto": 自动选择
            - "color": 基于颜色分割
            - "edge": 增强边缘检测
            - "threshold": 自适应阈值
        sensitivity: 灵敏度 (1-100)
        min_area: 最小面积
        merge_distance: 合并距离
    """
    # 转换为 BGR
    if len(img.shape) == 2:
        bgr = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    elif img.shape[2] == 4:
        bgr = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
    else:
        bgr = img.copy()
    
    h, w = bgr.shape[:2]
    
    if mode == "auto":
        # 自动选择最佳方法
        results = []
        
        # 尝试颜色分割
        _, bboxes_color = _detect_by_color(bgr, sensitivity, min_area, merge_distance)
        if 1 < len(bboxes_color) < 50:
            results.append(("color", bboxes_color))
        
        # 尝试自适应阈值
        _, bboxes_thresh = _detect_by_threshold(bgr, sensitivity, min_area, merge_distance)
        if 1 < len(bboxes_thresh) < 50:
            results.append(("threshold", bboxes_thresh))
        
        # 尝试增强边缘
        _, bboxes_edge = _detect_by_edge(bgr, sensitivity, min_area, merge_distance)
        if 1 < len(bboxes_edge) < 50:
            results.append(("edge", bboxes_edge))
        
        # 选择结果最合理的方法（数量适中，大小均匀）
        if results:
            best = min(results, key=lambda x: abs(len(x[1]) - 10))
            mode = best[0]
            bboxes = best[1]
        else:
            # 默认使用颜色分割
            _, bboxes = _detect_by_color(bgr, sensitivity, min_area, merge_distance)
    elif mode == "color":
        _, bboxes = _detect_by_color(bgr, sensitivity, min_area, merge_distance)
    elif mode == "threshold":
        _, bboxes = _detect_by_threshold(bgr, sensitivity, min_area, merge_distance)
    elif mode == "edge":
        _, bboxes = _detect_by_edge(bgr, sensitivity, min_area, merge_distance)
    else:
        _, bboxes = _detect_by_color(bgr, sensitivity, min_area, merge_distance)
    
    # 生成轮廓（用于预览）
    contours = []
    for x, y, w_box, h_box in bboxes:
        contour = np.array([[x, y], [x + w_box, y], [x + w_box, y + h_box], [x, y + h_box]])
        contours.append(contour.reshape(-1, 1, 2))
    
    return contours, bboxes


def _detect_by_color(bgr: np.ndarray, sensitivity: int, min_area: int, merge_distance: int):
    """基于颜色聚类的分割"""
    h, w = bgr.shape[:2]
    
    # 转换到 LAB 颜色空间（更好的颜色感知）
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    
    # 获取背景颜色（四角平均）
    corners = [
        lab[0, 0], lab[0, w-1], lab[h-1, 0], lab[h-1, w-1],
        lab[0, w//2], lab[h-1, w//2], lab[h//2, 0], lab[h//2, w-1]
    ]
    bg_color = np.mean(corners, axis=0)
    
    # 计算与背景的颜色差异
    diff = np.sqrt(np.sum((lab.astype(np.float32) - bg_color.astype(np.float32)) ** 2, axis=2))
    
    # 根据灵敏度调整阈值
    threshold = 30 + (100 - sensitivity) * 0.5
    
    # 二值化
    mask = (diff > threshold).astype(np.uint8) * 255
    
    # 形态学操作
    kernel = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=3)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=2)
    
    # 查找轮廓
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # 过滤和合并
    bboxes = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area >= min_area:
            x, y, w_box, h_box = cv2.boundingRect(contour)
            bboxes.append((x, y, w_box, h_box))
    
    bboxes = _merge_nearby_bboxes(bboxes, merge_distance)
    bboxes.sort(key=lambda b: (b[1] // 100, b[0]))
    
    return mask, bboxes


def _detect_by_threshold(bgr: np.ndarray, sensitivity: int, min_area: int, merge_distance: int):
    """自适应阈值分割"""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    
    # 自适应阈值
    block_size = 11 + (100 - sensitivity) // 10 * 2
    if block_size % 2 == 0:
        block_size += 1
    
    thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, block_size, 5
    )
    
    # 形态学操作
    kernel = np.ones((5, 5), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=3)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=2)
    
    # 查找轮廓
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # 过滤和合并
    bboxes = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area >= min_area:
            x, y, w_box, h_box = cv2.boundingRect(contour)
            bboxes.append((x, y, w_box, h_box))
    
    bboxes = _merge_nearby_bboxes(bboxes, merge_distance)
    bboxes.sort(key=lambda b: (b[1] // 100, b[0]))
    
    return thresh, bboxes


def _detect_by_edge(bgr: np.ndarray, sensitivity: int, min_area: int, merge_distance: int):
    """增强边缘检测"""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    
    # 高斯模糊
    blurred = cv2.GaussianBlur(gray, (5, 5), 1.0)
    
    # Canny 边缘检测
    low_thresh = 30 + (100 - sensitivity) // 2
    high_thresh = low_thresh * 2
    edges = cv2.Canny(blurred, low_thresh, high_thresh)
    
    # 膨胀连接边缘
    kernel = np.ones((5, 5), np.uint8)
    edges = cv2.dilate(edges, kernel, iterations=3)
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel, iterations=5)
    
    # 查找轮廓
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # 过滤和合并
    bboxes = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area >= min_area:
            x, y, w_box, h_box = cv2.boundingRect(contour)
            bboxes.append((x, y, w_box, h_box))
    
    bboxes = _merge_nearby_bboxes(bboxes, merge_distance)
    bboxes.sort(key=lambda b: (b[1] // 100, b[0]))
    
    return edges, bboxes


def _merge_nearby_bboxes(bboxes: List[Tuple[int, int, int, int]], distance: int) -> List[Tuple[int, int, int, int]]:
    """合并相邻包围盒"""
    if not bboxes:
        return []
    
    boxes = [(x, y, x + w, y + h) for x, y, w, h in bboxes]
    merged = True
    
    while merged:
        merged = False
        new_boxes = []
        used = [False] * len(boxes)
        
        for i in range(len(boxes)):
            if used[i]:
                continue
            
            x1, y1, x2, y2 = boxes[i]
            
            for j in range(i + 1, len(boxes)):
                if used[j]:
                    continue
                
                bx1, by1, bx2, by2 = boxes[j]
                
                if (x1 - distance <= bx2 and bx1 - distance <= x2 and
                    y1 - distance <= by2 and by1 - distance <= y2):
                    x1 = min(x1, bx1)
                    y1 = min(y1, by1)
                    x2 = max(x2, bx2)
                    y2 = max(y2, by2)
                    used[j] = True
                    merged = True
            
            new_boxes.append((x1, y1, x2, y2))
        
        boxes = new_boxes
    
    return [(x1, y1, x2 - x1, y2 - y1) for x1, y1, x2, y2 in boxes]