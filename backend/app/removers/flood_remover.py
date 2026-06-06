import cv2
import numpy as np


def remove_background(img: np.ndarray, tolerance: int = 30) -> np.ndarray:
    """
    Remove background using flood fill (for solid color backgrounds).
    
    Args:
        img: Input image (BGR or BGRA)
        tolerance: Color tolerance for flood fill
    
    Returns:
        Image with transparent background (BGRA)
    """
    # Convert to BGR if needed
    if len(img.shape) == 2:
        bgr = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    elif img.shape[2] == 4:
        bgr = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
    else:
        bgr = img.copy()
    
    h, w = bgr.shape[:2]
    
    # Get background color from corners
    corners = [
        bgr[0, 0],
        bgr[0, w-1],
        bgr[h-1, 0],
        bgr[h-1, w-1]
    ]
    bg_color = np.mean(corners, axis=0).astype(np.uint8)
    
    # Create mask for flood fill
    mask = np.zeros((h + 2, w + 2), np.uint8)
    
    # Flood fill from corners
    for point in [(0, 0), (0, w-1), (h-1, 0), (h-1, w-1)]:
        cv2.floodFill(
            bgr.copy(), mask, point, (0, 0, 0),
            loDiff=(tolerance, tolerance, tolerance),
            upDiff=(tolerance, tolerance, tolerance),
            flags=cv2.FLOODFILL_MASK_ONLY | (255 << 8)
        )
    
    # Invert mask to get foreground
    foreground_mask = cv2.bitwise_not(mask[1:-1, 1:-1])
    
    # Clean up mask
    kernel = np.ones((3, 3), np.uint8)
    foreground_mask = cv2.morphologyEx(foreground_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    foreground_mask = cv2.morphologyEx(foreground_mask, cv2.MORPH_OPEN, kernel, iterations=1)
    
    # Create alpha channel
    alpha = foreground_mask
    
    # Create BGRA image
    bgra = cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA)
    bgra[:, :, 3] = alpha
    
    return bgra