from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
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
from .removers import flood_remover
from .upscalers.real_esrgan import upscale_image, get_model_info, MODELS

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
    flood_padding: int = Form(5),
    # Alpha parameters
    alpha_threshold: int = Form(30),
    # Crop parameters
    crop_padding: int = Form(0),
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
            img, flood_tolerance, min_area, flood_padding
        )
    elif method == "alpha":
        contours, bboxes = alpha.detect(img, alpha_threshold)
    else:
        raise HTTPException(status_code=400, detail="Invalid method")
    
    # 返回原始图片（不含边框），前端自己绘制
    preview_img = img.copy()
    if len(preview_img.shape) == 2:
        preview_img = cv2.cvtColor(preview_img, cv2.COLOR_GRAY2BGR)
    elif preview_img.shape[2] == 4:
        preview_img = cv2.cvtColor(preview_img, cv2.COLOR_BGRA2BGR)
    
    # Encode preview
    _, buffer = cv2.imencode('.png', preview_img)
    preview_b64 = base64.b64encode(buffer).decode('utf-8')
    
    # 生成每个元素的裁切预览（应用 crop_padding）
    img_h, img_w = img.shape[:2]
    elements = []
    for i, (x, y, w, h) in enumerate(bboxes):
        # 应用 padding
        x1 = max(0, x - crop_padding)
        y1 = max(0, y - crop_padding)
        x2 = min(img_w, x + w + crop_padding)
        y2 = min(img_h, y + h + crop_padding)
        
        cropped = img[y1:y2, x1:x2]
        _, crop_buffer = cv2.imencode('.png', cropped)
        crop_b64 = base64.b64encode(crop_buffer).decode('utf-8')
        elements.append({
            "index": i + 1,
            "bbox": [x1, y1, x2 - x1, y2 - y1],
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
    click_x: int = Form(None),
    click_y: int = Form(None),
):
    """Remove background from detected elements."""
    if image_id not in uploaded_images:
        raise HTTPException(status_code=404, detail="Image not found")
    
    img_data = uploaded_images[image_id]
    img = img_data["original"]
    bboxes = img_data.get("bboxes", [])
    
    results = []
    
    if not bboxes:
        # 没有检测结果，直接处理整张图片
        bboxes = [(0, 0, img.shape[1], img.shape[0])]
    
    for i, (x, y, w, h) in enumerate(bboxes):
        # Crop element
        cropped = img[y:y+h, x:x+w]
        
        if method == "rembg":
            from .removers import rembg_remover
            result = rembg_remover.remove_background(cropped, model)
        elif method == "flood":
            result = flood_remover.remove_background(cropped, flood_tolerance)
        elif method == "color_pick":
            # 吸管取色抠图：将点击坐标转换为裁剪区域的相对坐标
            if click_x is not None and click_y is not None:
                rel_x = click_x - x
                rel_y = click_y - y
                result = flood_remover.remove_by_color(cropped, rel_x, rel_y, flood_tolerance)
            else:
                result = flood_remover.remove_background(cropped, flood_tolerance)
        elif method == "combined":
            from .removers import combined_remover
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


@app.get("/api/export")
async def export_results(
    image_id: str,
    format: str = "zip",
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


@app.post("/api/lasso")
async def lasso_detect(
    image_id: str = Form(...),
    mask_base64: str = Form(...),
    auto_detect_remaining: bool = Form(True),
    detect_method: str = Form("smart"),
    sensitivity: int = Form(50),
    min_area: int = Form(500),
    merge_distance: int = Form(20),
    crop_padding: int = Form(0),
):
    """套索工具：异形裁切 + 剩余区域检测"""
    if image_id not in uploaded_images:
        raise HTTPException(status_code=404, detail="Image not found")
    
    img = uploaded_images[image_id]["original"]
    img_h, img_w = img.shape[:2]
    
    # 解码 mask（PNG base64）
    mask_data = base64.b64decode(mask_base64.split(',')[1] if ',' in mask_base64 else mask_base64)
    mask_img = np.frombuffer(mask_data, np.uint8)
    mask_img = cv2.imdecode(mask_img, cv2.IMREAD_GRAYSCALE)
    
    # 调整 mask 大小匹配原图
    if mask_img.shape[:2] != (img_h, img_w):
        mask_img = cv2.resize(mask_img, (img_w, img_h), interpolation=cv2.INTER_NEAREST)
    
    # 二值化 mask
    _, mask_binary = cv2.threshold(mask_img, 127, 255, cv2.THRESH_BINARY)
    
    # 1. 异形裁切
    # 添加 alpha 通道
    if len(img.shape) == 2:
        img_bgra = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif img.shape[2] == 3:
        img_bgra = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    else:
        img_bgra = img.copy()
    
    # 应用 mask 作为 alpha
    img_bgra[:, :, 3] = mask_binary
    
    # 获取裁切区域 bbox
    contours, _ = cv2.findContours(mask_binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        raise HTTPException(status_code=400, detail="Invalid mask")
    
    x, y, w, h = cv2.boundingRect(contours[0])
    
    # 应用 padding
    x1 = max(0, x - crop_padding)
    y1 = max(0, y - crop_padding)
    x2 = min(img_w, x + w + crop_padding)
    y2 = min(img_h, y + h + crop_padding)
    
    # 裁切
    cropped = img_bgra[y1:y2, x1:x2]
    
    # 编码为 base64
    _, crop_buffer = cv2.imencode('.png', cropped)
    crop_b64 = base64.b64encode(crop_buffer).decode('utf-8')
    
    lasso_element = {
        "index": 0,  # 稍后分配
        "bbox": [x1, y1, x2 - x1, y2 - y1],
        "preview": f"data:image/png;base64,{crop_b64}",
        "type": "lasso"
    }
    
    result = {
        "lasso_element": lasso_element,
        "remaining_elements": []
    }
    
    # 2. 剩余区域检测
    if auto_detect_remaining:
        # 创建剩余区域 mask（反转）
        remaining_mask = cv2.bitwise_not(mask_binary)
        
        # 应用 mask 到原图
        remaining_img = cv2.bitwise_and(img, img, mask=remaining_mask)
        
        # 检测剩余区域
        if detect_method == "smart":
            contours, bboxes = smart.detect(remaining_img, "auto", sensitivity, min_area, merge_distance)
        elif detect_method == "canny":
            contours, bboxes = canny.detect(remaining_img, 1.0, 5, 50, 150, 3, 3, 1, 1, min_area, merge_distance)
        elif detect_method == "flood":
            contours, bboxes = flood.detect(remaining_img, 30, min_area, 5)
        else:
            contours, bboxes = smart.detect(remaining_img, "auto", sensitivity, min_area, merge_distance)
        
        # 生成元素预览
        remaining_elements = []
        for i, (bx, by, bw, bh) in enumerate(bboxes):
            # 应用 padding
            bx1 = max(0, bx - crop_padding)
            by1 = max(0, by - crop_padding)
            bx2 = min(img_w, bx + bw + crop_padding)
            by2 = min(img_h, by + bh + crop_padding)
            
            cropped = img[by1:by2, bx1:bx2]
            _, crop_buffer = cv2.imencode('.png', cropped)
            crop_b64 = base64.b64encode(crop_buffer).decode('utf-8')
            
            remaining_elements.append({
                "index": i + 1,
                "bbox": [bx1, by1, bx2 - bx1, by2 - by1],
                "preview": f"data:image/png;base64,{crop_b64}",
                "type": "auto"
            })
        
        result["remaining_elements"] = remaining_elements
    
    return JSONResponse(result)


@app.get("/api/export_psd")
async def export_psd(
    image_id: str,
    mode: str = "split",  # "split" = 切分结果, "remove" = 抠图结果
):
    """Export elements as a PSD file with each element on its own layer."""
    if image_id not in uploaded_images:
        raise HTTPException(status_code=404, detail="Image not found")
    
    img_data = uploaded_images[image_id]
    img = img_data["original"]
    bboxes = img_data.get("bboxes", [])
    img_h, img_w = img.shape[:2]
    
    if not bboxes:
        raise HTTPException(status_code=400, detail="No elements detected")
    
    from psd_tools import PSDImage
    
    # 为每个元素创建图层
    layers = []
    for i, (x, y, w, h) in enumerate(bboxes):
        cropped = img[y:y+h, x:x+w]
        
        if len(cropped.shape) == 2:
            pil_img = Image.fromarray(cropped).convert("RGBA")
        elif cropped.shape[2] == 3:
            pil_img = Image.fromarray(cv2.cvtColor(cropped, cv2.COLOR_BGR2RGBA))
        else:
            pil_img = Image.fromarray(cv2.cvtColor(cropped, cv2.COLOR_BGRA2RGBA))
        
        layers.append((f"Element {i+1}", pil_img, x, y))
    
    try:
        # 创建 RGBA PSD
        psd = PSDImage.new(mode='RGBA', size=(img_w, img_h))
        
        # 添加每个元素图层（倒序，PSD 图层栈顶在前）
        for name, pil_img, x, y in reversed(layers):
            psd.create_pixel_layer(image=pil_img, name=name, top=y, left=x)
        
        # 保存到 BytesIO
        psd_buffer = io.BytesIO()
        psd.save(psd_buffer)
        psd_buffer.seek(0)
        
        return StreamingResponse(
            psd_buffer,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={img_data['filename']}.psd"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create PSD: {str(e)}")


@app.post("/api/export_zip_from_elements")
async def export_zip_from_elements(
    elements_json: str = Form(...),  # JSON array: [{"name": "...", "base64": "..."}]
):
    """从抠图结果直接生成 ZIP"""
    import json as json_mod
    elements = json_mod.loads(elements_json)
    
    if not elements:
        raise HTTPException(status_code=400, detail="No elements")
    
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for el in elements:
            b64_data = el['base64']
            if ',' in b64_data:
                b64_data = b64_data.split(',')[1]
            img_bytes = base64.b64decode(b64_data)
            zip_file.writestr(el.get('name', 'element.png'), img_bytes)
    
    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename=elements.zip'}
    )


@app.post("/api/export_psd_from_elements")
async def export_psd_from_elements(
    elements_json: str = Form(...),  # JSON array: [{"name": "...", "base64": "...", "x": 0, "y": 0}]
    canvas_width: int = Form(...),
    canvas_height: int = Form(...),
):
    """从抠图结果直接生成 PSD"""
    import json as json_mod
    elements = json_mod.loads(elements_json)
    
    if not elements:
        raise HTTPException(status_code=400, detail="No elements")
    
    from psd_tools import PSDImage
    
    psd = PSDImage.new(mode='RGBA', size=(canvas_width, canvas_height))
    
    # 倒序添加，PSD 图层栈顶在前
    for el in reversed(elements):
        # 解码 base64 图片
        b64_data = el['base64']
        if ',' in b64_data:
            b64_data = b64_data.split(',')[1]
        img_bytes = base64.b64decode(b64_data)
        pil_img = Image.open(io.BytesIO(img_bytes)).convert('RGBA')
        
        psd.create_pixel_layer(
            image=pil_img,
            name=el.get('name', 'Layer'),
            top=el.get('y', 0),
            left=el.get('x', 0)
        )
    
    psd_buffer = io.BytesIO()
    psd.save(psd_buffer)
    psd_buffer.seek(0)
    
    return StreamingResponse(
        psd_buffer,
        media_type="application/octet-stream",
        headers={"Content-Disposition": 'attachment; filename=elements.psd'}
    )


@app.post("/api/upscale")
async def upscale(
    image_id: str = Form(...),
    model: str = Form("RealESRGAN_x4plus"),
    scale: float = Form(None),
    tile_size: int = Form(0),
):
    """放大图片"""
    if image_id not in uploaded_images:
        raise HTTPException(status_code=404, detail="Image not found")
    
    if model not in MODELS:
        raise HTTPException(status_code=400, detail=f"未知模型: {model}")
    
    img = uploaded_images[image_id]["original"]
    
    try:
        result = upscale_image(img, model_name=model, outscale=scale, tile_size=tile_size)
        
        # 编码结果
        _, buffer = cv2.imencode('.png', result)
        result_b64 = base64.b64encode(buffer).decode('utf-8')
        
        # 计算放大后尺寸
        h, w = result.shape[:2]
        has_alpha = len(result.shape) == 3 and result.shape[2] == 4
        
        return JSONResponse({
            "preview": f"data:image/png;base64,{result_b64}",
            "width": w,
            "height": h,
            "channels": 4 if has_alpha else 3,
            "model": model,
            "scale": scale or MODELS[model]["scale"],
        })
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"放大失败: {str(e)}")


@app.get("/api/upscale/models")
async def get_upscale_models():
    """获取可用的放大模型列表"""
    return JSONResponse(get_model_info())


@app.post("/api/upscale/export")
async def export_upscaled(
    base64_data: str = Form(...),
    filename: str = Form("upscaled.png"),
    format: str = Form("png"),
):
    """导出放大后的图片"""
    # 解码 base64
    if ',' in base64_data:
        base64_data = base64_data.split(',')[1]
    
    img_bytes = base64.b64decode(base64_data)
    
    if format == "png":
        return StreamingResponse(
            io.BytesIO(img_bytes),
            media_type="image/png",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    else:
        # 转换为其他格式
        pil_img = Image.open(io.BytesIO(img_bytes))
        output = io.BytesIO()
        if format == "jpg" or format == "jpeg":
            # RGBA 转 RGB
            if pil_img.mode == 'RGBA':
                bg = Image.new('RGB', pil_img.size, (255, 255, 255))
                bg.paste(pil_img, mask=pil_img.split()[3])
                pil_img = bg
            pil_img.save(output, format='JPEG', quality=95)
        elif format == "webp":
            pil_img.save(output, format='WEBP', quality=90)
        else:
            pil_img.save(output, format='PNG')
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type=f"image/{format}",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


# 静态文件服务（前端）
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)