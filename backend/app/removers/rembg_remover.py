import cv2
import numpy as np
from rembg import remove
from PIL import Image
import io


def remove_background(img: np.ndarray, model: str = "u2net") -> np.ndarray:
    """
    Remove background using rembg AI.
    
    Args:
        img: Input image (BGR or BGRA)
        model: Model name (u2net, u2netp, isnet-general-use, silueta)
    
    Returns:
        Image with transparent background (BGRA)
    """
    # Convert to PIL Image
    if len(img.shape) == 2:
        pil_img = Image.fromarray(img)
    elif img.shape[2] == 3:
        pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    else:
        pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGRA2RGBA))
    
    # Remove background
    result_pil = remove(pil_img, session_name=model)
    
    # Convert back to OpenCV format
    result_np = np.array(result_pil)
    if result_np.shape[2] == 4:
        result = cv2.cvtColor(result_np, cv2.COLOR_RGBA2BGRA)
    else:
        result = cv2.cvtColor(result_np, cv2.COLOR_RGB2BGR)
    
    return result