import cv2
import numpy as np
from typing import List, Tuple


def detect(
    img: np.ndarray,
    alpha_threshold: int = 30,
) -> Tuple[List[np.ndarray], List[Tuple[int, int, int, int]]]:
    """
    Detect elements using alpha channel.
    
    Returns:
        contours: List of contours
        bboxes: List of (x, y, w, h) bounding boxes
    """
    # Check if image has alpha channel
    if len(img.shape) < 3 or img.shape[2] < 4:
        # No alpha channel, return empty
        return [], []
    
    # Extract alpha channel
    alpha_channel = img[:, :, 3]
    
    # Threshold alpha channel
    _, mask = cv2.threshold(alpha_channel, alpha_threshold, 255, cv2.THRESH_BINARY)
    
    # Clean up mask
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    
    # Find contours
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Get bounding boxes
    h, w = img.shape[:2]
    bboxes = []
    valid_contours = []
    for contour in contours:
        x, y, w_box, h_box = cv2.boundingRect(contour)
        # Filter tiny contours
        if w_box > 5 and h_box > 5:
            bboxes.append((x, y, w_box, h_box))
            valid_contours.append(contour)
    
    # Sort by position
    if bboxes:
        indices = sorted(range(len(bboxes)), key=lambda i: (bboxes[i][1] // 50, bboxes[i][0]))
        bboxes = [bboxes[i] for i in indices]
        valid_contours = [valid_contours[i] for i in indices]
    
    return valid_contours, bboxes