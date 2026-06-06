import cv2
import numpy as np


def feather_edges(img: np.ndarray, radius: int = 3) -> np.ndarray:
    """
    对透明图片的边缘进行羽化处理
    
    Args:
        img: BGRA 图片
        radius: 羽化半径 (1-20)
    
    Returns:
        边缘羽化后的 BGRA 图片
    """
    if img.shape[2] != 4:
        return img
    
    alpha = img[:, :, 3].copy()
    
    # 对整个 alpha 通道进行高斯模糊
    kernel_size = radius * 2 + 1
    if kernel_size < 3:
        kernel_size = 3
    blurred_alpha = cv2.GaussianBlur(alpha, (kernel_size, kernel_size), radius / 2)
    
    # 创建结果
    result = img.copy()
    result[:, :, 3] = blurred_alpha
    
    return result


def smooth_edges(img: np.ndarray, strength: int = 3) -> np.ndarray:
    """
    平滑边缘（去除锯齿）
    
    Args:
        img: BGRA 图片
        strength: 平滑强度 (1-10)
    
    Returns:
        边缘平滑后的 BGRA 图片
    """
    if img.shape[2] != 4:
        return img
    
    alpha = img[:, :, 3].copy()
    
    # 使用双边滤波平滑边缘（保持边缘但去除锯齿）
    # 首先创建一个边缘 mask
    kernel = np.ones((3, 3), np.uint8)
    edge_mask = cv2.subtract(
        cv2.dilate(alpha, kernel, iterations=1),
        cv2.erode(alpha, kernel, iterations=1)
    )
    
    # 对 alpha 通道进行双边滤波
    alpha_float = alpha.astype(np.float32) / 255.0
    smoothed = cv2.bilateralFilter(alpha_float, 9, 0.1, strength)
    smoothed = (smoothed * 255).astype(np.uint8)
    
    # 只在边缘区域应用平滑
    result_alpha = alpha.copy()
    edge_indices = edge_mask > 0
    result_alpha[edge_indices] = smoothed[edge_indices]
    
    # 创建结果
    result = img.copy()
    result[:, :, 3] = result_alpha
    
    return result


def fill_holes(img: np.ndarray, min_hole_size: int = 100) -> np.ndarray:
    """
    填充 alpha 通道中的孔洞
    
    Args:
        img: BGRA 图片
        min_hole_size: 最小孔洞面积（小于该值的孔洞会被填充）
    
    Returns:
        填充孔洞后的 BGRA 图片
    """
    if img.shape[2] != 4:
        return img
    
    alpha = img[:, :, 3].copy()
    
    # 反转 alpha（孔洞变成白色）
    inv_alpha = cv2.bitwise_not(alpha)
    
    # 查找连通区域
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(inv_alpha)
    
    # 填充小孔洞
    result_alpha = alpha.copy()
    for i in range(1, num_labels):  # 跳过背景
        area = stats[i, cv2.CC_STAT_AREA]
        if area < min_hole_size:
            # 这是一个小孔洞，填充它
            result_alpha[labels == i] = 255
    
    # 创建结果
    result = img.copy()
    result[:, :, 3] = result_alpha
    
    return result


def remove_small_objects(img: np.ndarray, min_size: int = 50) -> np.ndarray:
    """
    移除 alpha 通道中的小对象（噪点）
    
    Args:
        img: BGRA 图片
        min_size: 最小对象面积（小于该值的对象会被移除）
    
    Returns:
        移除小对象后的 BGRA 图片
    """
    if img.shape[2] != 4:
        return img
    
    alpha = img[:, :, 3].copy()
    
    # 查找连通区域
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(alpha)
    
    # 保留大对象，移除小对象
    result_alpha = np.zeros_like(alpha)
    for i in range(1, num_labels):  # 跳过背景
        area = stats[i, cv2.CC_STAT_AREA]
        if area >= min_size:
            result_alpha[labels == i] = 255
    
    # 创建结果
    result = img.copy()
    result[:, :, 3] = result_alpha
    
    return result


def erode_edges(img: np.ndarray, pixels: int = 3) -> np.ndarray:
    """
    收缩边缘（腐蚀 alpha 通道）
    
    Args:
        img: BGRA 图片
        pixels: 收缩像素数 (1-20)
    
    Returns:
        收缩边缘后的 BGRA 图片
    """
    if img.shape[2] != 4:
        return img
    
    alpha = img[:, :, 3].copy()
    
    # 腐蚀 alpha 通道
    kernel = np.ones((3, 3), np.uint8)
    eroded = cv2.erode(alpha, kernel, iterations=pixels)
    
    # 创建结果
    result = img.copy()
    result[:, :, 3] = eroded
    
    return result


def dilate_edges(img: np.ndarray, pixels: int = 3) -> np.ndarray:
    """
    扩展边缘（膨胀 alpha 通道）
    
    Args:
        img: BGRA 图片
        pixels: 扩展像素数 (1-20)
    
    Returns:
        扩展边缘后的 BGRA 图片
    """
    if img.shape[2] != 4:
        return img
    
    alpha = img[:, :, 3].copy()
    
    # 膨胀 alpha 通道
    kernel = np.ones((3, 3), np.uint8)
    dilated = cv2.dilate(alpha, kernel, iterations=pixels)
    
    # 创建结果
    result = img.copy()
    result[:, :, 3] = dilated
    
    return result


def optimize_edges(img: np.ndarray, feather: int = 3, smooth: int = 3, fill_holes_size: int = 100, remove_noise_size: int = 50, shrink: int = 0) -> np.ndarray:
    """
    综合边缘优化
    
    Args:
        img: BGRA 图片
        feather: 羽化强度 (0-20, 0=不羽化)
        smooth: 平滑强度 (0-10, 0=不平滑)
        fill_holes_size: 填充孔洞大小 (0=不填充)
        remove_noise_size: 移除噪点大小 (0=不移除)
        shrink: 收缩边缘像素数 (0=不收缩, 正数=收缩, 负数=扩展)
    
    Returns:
        优化后的 BGRA 图片
    """
    result = img.copy()
    
    # 移除噪点
    if remove_noise_size > 0:
        result = remove_small_objects(result, remove_noise_size)
    
    # 填充孔洞
    if fill_holes_size > 0:
        result = fill_holes(result, fill_holes_size)
    
    # 收缩/扩展边缘
    if shrink > 0:
        result = erode_edges(result, shrink)
    elif shrink < 0:
        result = dilate_edges(result, abs(shrink))
    
    # 平滑边缘
    if smooth > 0:
        result = smooth_edges(result, smooth)
    
    # 羽化边缘
    if feather > 0:
        result = feather_edges(result, feather)
    
    return result