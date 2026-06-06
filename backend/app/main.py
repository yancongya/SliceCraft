from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
import cv2
import numpy as np
from PIL import Image
import io
import zipfile
import tempfile
import os
from typing import List, Dict, Any
import base64

from .detectors import canny, flood, alpha, smart
from .removers import rembg_remover, flood_remover, combined_remover

app = FastAPI(title="Image Splitter API")

# CORS for local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for uploaded images (for simplicity)
uploaded_images = {}


@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    """Upload an image and return its ID and base64 preview."""
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image")
    
    # Generate a unique ID
    import uuid
    image_id = str(uuid.uuid4())
    
    # Store image
    uploaded_images[image_id] = {
        "original": img,
        "filename": file.filename,
    }
    
    # Create preview (base64)
    _, buffer = cv2.imencode('.png', img)
    preview_b64 = base64.b64encode(buffer).decode('utf-8')
    
    return JSONResponse({
        "image_id": image_id,
        "filename": file.filename,
        "width": img.shape[1],
        "height": img.shape[0],
        "preview": f"data:image/png;base64,{preview_b64}"
    })


@app.post("/api/detect")
async def detect_elements(
    image_id: str = Form(...),
    method: str = Form("smart"),
    # Smart parameters
    smart_mode: str = Form("auto"),
    sensitivity: int = Form(50),
    # Canny parameters
    gauss_sigma: float = Form(1.0),
    gauss_amount: int = Form(5),
    threshold1: int = Form(50),
    threshold2: int = Form(150),
    struct_k1: int = Form(3),
    struct_k2: int = Form(3),
    close_iter: int = Form(1),
    dilate_iter: int = Form(1),
    min_area: int = Form(500),
    merge_distance: int = Form(20),
    # Flood parameters
    flood_tolerance: int = Form(30),
    padding: int = Form(5),
    # Alpha parameters
    alpha_threshold: int = Form(30),
):
    """Detect elements using specified method."""
    if image_id not in uploaded_images:
        raise HTTPException(status_code=404, detail="Image not found")
    
    img = uploaded_images[image_id]["original"]
    
    if method == "smart":
        contours, bboxes = smart.detect(
            img, smart_mode, sensitivity, min_area, merge_distance
        )
    elif method == "canny":
        contours, bboxes = canny.detect(
            img, gauss_sigma, gauss_amount, threshold1, threshold2,
            struct_k1, struct_k2, close_iter, dilate_iter, min_area, merge_distance
        )
    elif method == "flood":
        contours, bboxes = flood.detect(
            img, flood_tolerance, min_area, padding
        )
    elif method == "alpha":
        contours, bboxes = alpha.detect(img, alpha_threshold)
    else:
        raise HTTPException(status_code=400, detail="Invalid method")
    
    # Create preview with bboxes only
    preview_img = img.copy()
    if len(preview_img.shape) == 2:
        preview_img = cv2.cvtColor(preview_img, cv2.COLOR_GRAY2BGR)
    elif preview_img.shape[2] == 4:
        preview_img = cv2.cvtColor(preview_img, cv2.COLOR_BGRA2BGR)
    
    # Draw bboxes with numbers
    for i, (x, y, w, h) in enumerate(bboxes):
        # 绿色包围盒
        cv2.rectangle(preview_img, (x, y), (x+w, y+h), (0, 255, 0), 2)
        # 编号标签
        label = str(i + 1)
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
        cv2.rectangle(preview_img, (x, y - th - 8), (x + tw + 4, y), (0, 255, 0), -1)
        cv2.putText(preview_img, label, (x + 2, y - 4),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    
    # Encode preview
    _, buffer = cv2.imencode('.png', preview_img)
    preview_b64 = base64.b64encode(buffer).decode('utf-8')
    
    # 生成每个元素的裁切预览
    elements = []
    for i, (x, y, w, h) in enumerate(bboxes):
        cropped = img[y:y+h, x:x+w]
        _, crop_buffer = cv2.imencode('.png', cropped)
        crop_b64 = base64.b64encode(crop_buffer).decode('utf-8')
        elements.append({
            "index": i + 1,
            "bbox": [x, y, w, h],
            "preview": f"data:image/png;base64,{crop_b64}"
        })
    
    # Store detection results
    uploaded_images[image_id]["contours"] = contours
    uploaded_images[image_id]["bboxes"] = bboxes
    
    return JSONResponse({
        "count": len(bboxes),
        "bboxes": bboxes,
        "preview": f"data:image/png;base64,{preview_b64}",
        "elements": elements
    })


@app.post("/api/remove_background")
async def remove_background(
    image_id: str = Form(...),
    method: str = Form("rembg"),
    model: str = Form("u2net"),
    flood_tolerance: int = Form(30),
):
    """Remove background from detected elements."""
    if image_id not in uploaded_images:
        raise HTTPException(status_code=404, detail="Image not found")
    
    img_data = uploaded_images[image_id]
    img = img_data["original"]
    bboxes = img_data.get("bboxes", [])
    
    if not bboxes:
        raise HTTPException(status_code=400, detail="No elements detected. Run detection first.")
    
    results = []
    for i, (x, y, w, h) in enumerate(bboxes):
        # Crop element
        cropped = img[y:y+h, x:x+w]
        
        if method == "rembg":
            result = rembg_remover.remove_background(cropped, model)
        elif method == "flood":
            result = flood_remover.remove_background(cropped, flood_tolerance)
        elif method == "combined":
            result = combined_remover.remove_background(cropped, model, flood_tolerance)
        else:
            raise HTTPException(status_code=400, detail="Invalid method")
        
        # Encode result
        _, buffer = cv2.imencode('.png', result)
        result_b64 = base64.b64encode(buffer).decode('utf-8')
        
        results.append({
            "index": i + 1,
            "width": w,
            "height": h,
            "preview": f"data:image/png;base64,{result_b64}"
        })
    
    return JSONResponse({
        "count": len(results),
        "results": results
    })


@app.post("/api/export")
async def export_results(
    image_id: str = Form(...),
    format: str = Form("zip"),
):
    """Export processed elements as PNG files in a ZIP archive."""
    if image_id not in uploaded_images:
        raise HTTPException(status_code=404, detail="Image not found")
    
    img_data = uploaded_images[image_id]
    img = img_data["original"]
    bboxes = img_data.get("bboxes", [])
    
    if not bboxes:
        raise HTTPException(status_code=400, detail="No elements detected")
    
    # Create ZIP in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for i, (x, y, w, h) in enumerate(bboxes):
            cropped = img[y:y+h, x:x+w]
            
            # Convert to PIL Image
            if len(cropped.shape) == 2:
                pil_img = Image.fromarray(cropped)
            elif cropped.shape[2] == 3:
                pil_img = Image.fromarray(cv2.cvtColor(cropped, cv2.COLOR_BGR2RGB))
            else:
                pil_img = Image.fromarray(cv2.cvtColor(cropped, cv2.COLOR_BGRA2RGBA))
            
            # Save to bytes
            img_bytes = io.BytesIO()
            pil_img.save(img_bytes, format='PNG')
            img_bytes.seek(0)
            
            # Add to ZIP
            zip_file.writestr(f"element_{i+1:03d}.png", img_bytes.read())
    
    zip_buffer.seek(0)
    
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={img_data['filename']}_elements.zip"}
    )


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)