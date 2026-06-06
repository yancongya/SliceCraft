import cv2
import numpy as np
from typing import List, Tuple


def detect(
    img: np.ndarray,
    tolerance: int = 30,
    min_area: int = 100,
    padding: int = 5,
) -> Tuple[List[np.ndarray], List[Tuple[int, int, int, int]]]:
    """
    Detect elements using flood fill (for solid color backgrounds).
    
    Returns:
        contours: List of contours
        bboxes: List of (x, y, w, h) bounding boxes
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
    # Note: floodFill expects (x, y) format, and the point must be inside the image
    for point in [(0, 0), (w-1, 0), (0, h-1), (w-1, h-1)]:
        # Ensure point is inside image
        x, y = point
        if 0 <= x < w and 0 <= y < h:
            cv2.floodFill(
                bgr.copy(), mask, (x, y), (0, 0, 0),
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
    
    # Find contours
    contours, _ = cv2.findContours(foreground_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Filter by area and get bounding boxes
    bboxes = []
    valid_contours = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area >= min_area:
            x, y, w_box, h_box = cv2.boundingRect(contour)
            # Add padding
            x = max(0, x - padding)
            y = max(0, y - padding)
            w_box = min(w - x, w_box + 2 * padding)
            h_box = min(h - y, h_box + 2 * padding)
            bboxes.append((x, y, w_box, h_box))
            valid_contours.append(contour)
    
    # Sort by position
    if bboxes:
        indices = sorted(range(len(bboxes)), key=lambda i: (bboxes[i][1] // 50, bboxes[i][0]))
        bboxes = [bboxes[i] for i in indices]
        valid_contours = [valid_contours[i] for i in indices]
    
    return valid_contours, bboxes