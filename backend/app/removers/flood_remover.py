import cv2
import numpy as np


def remove_background(img: np.ndarray, tolerance: int = 30) -> np.ndarray:
    """
    Remove background using flood fill from corners (auto detect).
    """
    if len(img.shape) == 2:
        bgr = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    elif img.shape[2] == 4:
        bgr = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
    else:
        bgr = img.copy()
    
    h, w = bgr.shape[:2]
    mask = np.zeros((h + 2, w + 2), np.uint8)
    
    for point in [(0, 0), (w-1, 0), (0, h-1), (w-1, h-1)]:
        if 0 <= point[0] < w and 0 <= point[1] < h:
            cv2.floodFill(
                bgr.copy(), mask, point, (0, 0, 0),
                loDiff=(tolerance, tolerance, tolerance),
                upDiff=(tolerance, tolerance, tolerance),
                flags=cv2.FLOODFILL_MASK_ONLY | (255 << 8)
            )
    
    foreground_mask = cv2.bitwise_not(mask[1:-1, 1:-1])
    kernel = np.ones((3, 3), np.uint8)
    foreground_mask = cv2.morphologyEx(foreground_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    foreground_mask = cv2.morphologyEx(foreground_mask, cv2.MORPH_OPEN, kernel, iterations=1)
    
    bgra = cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA)
    bgra[:, :, 3] = foreground_mask
    
    # 边缘平滑
    bgra = _smooth_edge(bgra, tolerance)
    
    return bgra


def _smooth_edge(bgra, tolerance):
    """对 mask 做边缘平滑，减轻锯齿"""
    alpha = bgra[:, :, 3].copy()
    
    # 找到边缘区域：alpha 在 0~255 之间的过渡带
    # 先做一次模糊产生渐变
    blur_size = max(3, tolerance // 3)
    if blur_size % 2 == 0:
        blur_size += 1
    alpha = cv2.GaussianBlur(alpha, (blur_size, blur_size), 0)
    
    # 确保非边缘区域仍然是 0 或 255
    _, hard = cv2.threshold(alpha, 200, 255, cv2.THRESH_BINARY)
    _, zero = cv2.threshold(alpha, 55, 255, cv2.THRESH_BINARY_INV)
    
    # 边缘区域保持渐变，其他区域回到硬边
    mask_edge = cv2.bitwise_and(hard, cv2.bitwise_not(zero))  # 不是纯黑也不是纯白
    alpha = np.where(hard > 0, 255, np.where(zero > 0, 0, alpha))
    
    # 对边缘再做一次轻微的高斯模糊
    alpha = cv2.GaussianBlur(alpha.astype(np.uint8), (3, 3), 0)
    
    bgra[:, :, 3] = alpha
    return bgra


def remove_by_color(img: np.ndarray, x: int, y: int, tolerance: int = 30) -> np.ndarray:
    """
    Remove background by clicking on a color point (eyedropper).
    """
    if len(img.shape) == 2:
        bgr = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    elif img.shape[2] == 4:
        bgr = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
    else:
        bgr = img.copy()
    
    h, w = bgr.shape[:2]
    x = max(0, min(x, w - 1))
    y = max(0, min(y, h - 1))
    
    mask = np.zeros((h + 2, w + 2), np.uint8)
    
    cv2.floodFill(
        bgr.copy(), mask, (x, y), (0, 0, 0),
        loDiff=(tolerance, tolerance, tolerance),
        upDiff=(tolerance, tolerance, tolerance),
        flags=cv2.FLOODFILL_MASK_ONLY | (255 << 8)
    )
    
    bg_mask = mask[1:-1, 1:-1]
    
    # 形态学清理
    kernel = np.ones((3, 3), np.uint8)
    bg_mask = cv2.morphologyEx(bg_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    bg_mask = cv2.morphologyEx(bg_mask, cv2.MORPH_OPEN, kernel, iterations=1)
    
    foreground_mask = cv2.bitwise_not(bg_mask)
    
    bgra = cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA)
    bgra[:, :, 3] = foreground_mask
    
    # 边缘平滑
    bgra = _smooth_edge(bgra, tolerance)
    
    return bgra