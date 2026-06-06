import cv2
import numpy as np
from typing import List, Tuple


def merge_nearby_bboxes(bboxes: List[Tuple[int, int, int, int]], distance: int = 20) -> List[Tuple[int, int, int, int]]:
    """
    合并相邻的包围盒
    """
    if not bboxes:
        return []
    
    # 转换为 [x1, y1, x2, y2] 格式
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
                
                # 检查是否相邻（考虑距离阈值）
                if (x1 - distance <= bx2 and bx1 - distance <= x2 and
                    y1 - distance <= by2 and by1 - distance <= y2):
                    # 合并
                    x1 = min(x1, bx1)
                    y1 = min(y1, by1)
                    x2 = max(x2, bx2)
                    y2 = max(y2, by2)
                    used[j] = True
                    merged = True
            
            new_boxes.append((x1, y1, x2, y2))
        
        boxes = new_boxes
    
    # 转换回 (x, y, w, h) 格式
    return [(x1, y1, x2 - x1, y2 - y1) for x1, y1, x2, y2 in boxes]


def detect(
    img: np.ndarray,
    gauss_sigma: float = 1.0,
    gauss_amount: int = 5,
    threshold1: int = 50,
    threshold2: int = 150,
    struct_k1: int = 3,
    struct_k2: int = 3,
    close_iter: int = 1,
    dilate_iter: int = 1,
    min_area: int = 500,
    merge_distance: int = 20,
) -> Tuple[List[np.ndarray], List[Tuple[int, int, int, int]]]:
    """
    Detect elements using Canny edge detection.
    
    Returns:
        contours: List of contours
        bboxes: List of (x, y, w, h) bounding boxes
    """
    # Convert to grayscale if needed
    if len(img.shape) == 3:
        if img.shape[2] == 4:
            gray = cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY)
        else:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img.copy()
    
    # Gaussian blur
    ksize = gauss_amount if gauss_amount % 2 == 1 else gauss_amount + 1
    blurred = cv2.GaussianBlur(gray, (ksize, ksize), gauss_sigma)
    
    # Canny edge detection
    edges = cv2.Canny(blurred, threshold1, threshold2)
    
    # Morphological operations
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (struct_k1, struct_k2))
    
    if close_iter > 0:
        edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel, iterations=close_iter)
    
    if dilate_iter > 0:
        edges = cv2.dilate(edges, kernel, iterations=dilate_iter)
    
    # Find contours
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Filter and get bounding boxes
    bboxes = []
    valid_contours = []
    for contour in contours:
        area = cv2.contourArea(contour)
        x, y, w, h = cv2.boundingRect(contour)
        # 按面积过滤小区域
        if area >= min_area and w > 10 and h > 10:
            bboxes.append((x, y, w, h))
            valid_contours.append(contour)
    
    # 合并相邻包围盒
    bboxes = merge_nearby_bboxes(bboxes, merge_distance)
    
    # Sort by position (top-to-bottom, left-to-right)
    if bboxes:
        bboxes.sort(key=lambda b: (b[1] // 100, b[0]))
    
    return valid_contours, bboxes