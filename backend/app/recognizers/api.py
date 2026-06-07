"""图片识别 API"""

from fastapi import APIRouter, HTTPException, Form
from fastapi.responses import JSONResponse
import numpy as np
from typing import List, Optional

from . import mobilenet, clip

router = APIRouter(prefix="/api/recognize", tags=["recognize"])


@router.post("/mobilenet")
async def recognize_mobilenet(
    image_id: str = Form(...),
    top_k: int = Form(3),
):
    """使用 MobileNet 识别图片"""
    from ..main import uploaded_images
    
    if image_id not in uploaded_images:
        raise HTTPException(status_code=404, detail="Image not found")
    
    img = uploaded_images[image_id]["original"]
    
    try:
        results = mobilenet.recognize(img, top_k=top_k)
        return JSONResponse({
            "model": "mobilenet",
            "results": results,
            "best_label": results[0]["label"] if results else None,
            "best_confidence": results[0]["confidence"] if results else None,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"识别失败: {str(e)}")


@router.post("/clip")
async def recognize_clip(
    image_id: str = Form(...),
    labels: Optional[str] = Form(None),  # 逗号分隔的标签
    top_k: int = Form(3),
):
    """使用 CLIP 零样本识别图片"""
    from ..main import uploaded_images
    
    if image_id not in uploaded_images:
        raise HTTPException(status_code=404, detail="Image not found")
    
    img = uploaded_images[image_id]["original"]
    
    # 解析标签
    label_list = None
    if labels:
        label_list = [l.strip() for l in labels.split(',') if l.strip()]
    
    try:
        results = clip.recognize(img, labels=label_list, top_k=top_k)
        return JSONResponse({
            "model": "clip",
            "labels_used": label_list or clip.DEFAULT_LABELS[:20],  # 返回使用的标签
            "results": results,
            "best_label": results[0]["label"] if results else None,
            "best_confidence": results[0]["confidence"] if results else None,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"识别失败: {str(e)}")


@router.post("/batch")
async def recognize_batch(
    image_ids: str = Form(...),  # JSON 数组字符串
    model: str = Form("mobilenet"),
    labels: Optional[str] = Form(None),
    top_k: int = Form(1),
):
    """批量识别图片并返回建议的文件名"""
    import json
    from ..main import uploaded_images
    
    try:
        ids = json.loads(image_ids)
    except:
        raise HTTPException(status_code=400, detail="Invalid image_ids format")
    
    results = []
    label_counts = {}
    
    for image_id in ids:
        if image_id not in uploaded_images:
            results.append({
                "image_id": image_id,
                "error": "Image not found"
            })
            continue
        
        img = uploaded_images[image_id]["original"]
        
        try:
            if model == "clip":
                label_list = [l.strip() for l in labels.split(',') if l.strip()] if labels else None
                recognition = clip.recognize(img, labels=label_list, top_k=top_k)
            else:
                recognition = mobilenet.recognize(img, top_k=top_k)
            
            if recognition:
                best = recognition[0]
                label = best["label"]
                
                # 统计标签出现次数，生成唯一文件名
                if label not in label_counts:
                    label_counts[label] = 0
                label_counts[label] += 1
                
                # 生成文件名：label_01, label_02, ...
                filename = f"{label}_{label_counts[label]:02d}"
                
                results.append({
                    "image_id": image_id,
                    "label": label,
                    "confidence": best["confidence"],
                    "suggested_filename": filename,
                    "all_results": recognition,
                })
            else:
                results.append({
                    "image_id": image_id,
                    "label": "unknown",
                    "suggested_filename": f"element_{len(results)+1:02d}",
                })
        except Exception as e:
            results.append({
                "image_id": image_id,
                "error": str(e)
            })
    
    return JSONResponse({
        "model": model,
        "results": results,
        "total": len(results),
    })


@router.get("/models")
async def get_recognition_models():
    """获取可用的识别模型"""
    return JSONResponse([
        {
            "name": "mobilenet",
            "description": "MobileNet v2 - ImageNet 1000 类，速度快",
            "size": "13MB",
            "type": "classification",
        },
        {
            "name": "clip",
            "description": "CLIP ViT-B/32 - 零样本分类，可自定义标签",
            "size": "335MB",
            "type": "zero-shot",
        },
    ])


@router.get("/labels")
async def get_default_labels():
    """获取 CLIP 默认标签列表"""
    return JSONResponse({
        "labels": clip.DEFAULT_LABELS,
        "total": len(clip.DEFAULT_LABELS),
    })
