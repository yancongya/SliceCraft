import cv2
import numpy as np
from . import rembg_remover, flood_remover


def remove_background(img: np.ndarray, model: str = "u2net", tolerance: int = 30) -> np.ndarray:
    """
    Remove background using combined method (flood fill + rembg).
    
    Args:
        img: Input image (BGR or BGRA)
        model: rembg model name
        tolerance: Flood fill tolerance
    
    Returns:
        Image with transparent background (BGRA)
    """
    # Get flood fill result
    flood_result = flood_remover.remove_background(img, tolerance)
    flood_alpha = flood_result[:, :, 3]
    
    # Get rembg result
    rembg_result = rembg_remover.remove_background(img, model)
    rembg_alpha = rembg_result[:, :, 3]
    
    # Combine masks (union)
    combined_alpha = cv2.bitwise_or(flood_alpha, rembg_alpha)
    
    # Clean up
    kernel = np.ones((3, 3), np.uint8)
    combined_alpha = cv2.morphologyEx(combined_alpha, cv2.MORPH_CLOSE, kernel, iterations=1)
    
    # Apply to original image
    if len(img.shape) == 2:
        bgr = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    elif img.shape[2] == 4:
        bgr = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
    else:
        bgr = img.copy()
    
    bgra = cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA)
    bgra[:, :, 3] = combined_alpha
    
    return bgra