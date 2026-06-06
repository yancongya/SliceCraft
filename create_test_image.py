#!/usr/bin/env python3
"""Create a test image with multiple elements for testing."""
import numpy as np
import cv2

# Create a 800x600 white background
img = np.ones((600, 800, 3), dtype=np.uint8) * 255

# Draw some colored rectangles (simulating elements)
# Element 1: Red rectangle
cv2.rectangle(img, (50, 50), (200, 150), (0, 0, 255), -1)
cv2.putText(img, "1", (100, 110), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

# Element 2: Green circle
cv2.circle(img, (350, 100), 60, (0, 255, 0), -1)
cv2.putText(img, "2", (330, 110), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

# Element 3: Blue triangle
pts = np.array([[550, 50], [650, 150], [450, 150]], np.int32)
cv2.fillPoly(img, [pts], (255, 0, 0))
cv2.putText(img, "3", (530, 120), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

# Element 4: Yellow star-like shape
cv2.rectangle(img, (100, 250), (250, 350), (0, 255, 255), -1)
cv2.putText(img, "4", (150, 310), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)

# Element 5: Purple ellipse
cv2.ellipse(img, (400, 300), (80, 50), 0, 0, 360, (255, 0, 255), -1)
cv2.putText(img, "5", (380, 310), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

# Element 6: Cyan diamond
pts2 = np.array([[600, 250], [650, 300], [600, 350], [550, 300]], np.int32)
cv2.fillPoly(img, [pts2], (255, 255, 0))
cv2.putText(img, "6", (580, 310), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)

# Add some text
cv2.putText(img, "Test Image for Element Splitter", (200, 450), 
            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
cv2.putText(img, "6 elements: rect, circle, triangle, rect, ellipse, diamond", 
            (100, 500), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (100, 100, 100), 1)

# Save the image
cv2.imwrite("test_image.png", img)
print("✅ 测试图片已创建: test_image.png")
print(f"   尺寸: {img.shape[1]}x{img.shape[0]}")
print("   包含 6 个不同形状的元素")