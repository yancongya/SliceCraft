// ============ AI 放大面板 ============

// 放大画布状态
const upscaleCanvasState = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    lastX: 0,
    lastY: 0,
    currentImage: null,
    originalImage: null,
    resultImage: null,
    showingResult: false
};

// 显示放大画布
function showUpscaleCanvas(src, isResult = false) {
    const canvas = $('upscaleCanvas');
    const container = $('upscaleCanvasContainer');
    if (!canvas || !container) return;

    upscaleCanvasState.currentImage = src;
    upscaleCanvasState.showingResult = isResult;

    const img = new Image();
    img.onload = () => {
        const containerW = container.offsetWidth;
        const containerH = container.offsetHeight;
        const padding = 40;

        const scaleX = (containerW - padding) / img.width;
        const scaleY = (containerH - padding) / img.height;
        upscaleCanvasState.scale = Math.min(scaleX, scaleY, 1);
        upscaleCanvasState.offsetX = 0;
        upscaleCanvasState.offsetY = 0;

        canvas.width = img.width;
        canvas.height = img.height;
        canvas.style.width = img.width + 'px';
        canvas.style.height = img.height + 'px';

        drawUpscaleCanvas(img);

        // 显示尺寸信息
        updateSizeInfo(img.width, img.height);
    };
    img.src = src;

    // 显示画布，隐藏空状态
    container.style.display = 'block';
    $('upscaleToolbar').style.display = 'flex';
    $('upscaleEmpty').classList.add('hidden');
    updateUpscaleCanvasBackground();
}

function drawUpscaleCanvas(img) {
    const canvas = $('upscaleCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.backgroundColor = 'transparent';
    ctx.drawImage(img, 0, 0);

    canvas.style.transform = `translate(calc(-50% + ${upscaleCanvasState.offsetX}px), calc(-50% + ${upscaleCanvasState.offsetY}px)) scale(${upscaleCanvasState.scale})`;
}

function updateSizeInfo(width, height) {
    const info = $('sizeInfo');
    if (info) {
        const origW = upscaleCanvasState.originalWidth || width;
        const origH = upscaleCanvasState.originalHeight || height;
        const scaleW = (width / origW).toFixed(1);
        info.textContent = `${origW}×${origH} → ${width}×${height} (${scaleW}x)`;
    }
}

// 归位功能
function resetUpscaleView() {
    const canvas = $('upscaleCanvas');
    const container = $('upscaleCanvasContainer');
    if (!canvas || !container || !upscaleCanvasState.currentImage) return;
    const img = new Image();
    img.onload = () => {
        const containerW = container.offsetWidth;
        const containerH = container.offsetHeight;
        const padding = 40;
        const scaleX = (containerW - padding) / img.width;
        const scaleY = (containerH - padding) / img.height;
        upscaleCanvasState.scale = Math.min(scaleX, scaleY, 1);
        upscaleCanvasState.offsetX = 0;
        upscaleCanvasState.offsetY = 0;
        drawUpscaleCanvas(img);
    };
    img.src = upscaleCanvasState.currentImage;
}
$('upscaleResetViewBtn')?.addEventListener('click', resetUpscaleView);

// 背景色切换
let upscaleBgMode = 'checker';
let upscaleCustomColor = '#808080';
document.querySelectorAll('[data-upscale-bg]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('[data-upscale-bg]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        upscaleBgMode = btn.dataset.upscaleBg;
        updateUpscaleCanvasBackground();
    });
});

$('upscaleCustomBgColor')?.addEventListener('input', e => {
    upscaleCustomColor = e.target.value;
    document.querySelectorAll('[data-upscale-bg]').forEach(b => b.classList.remove('active'));
    upscaleBgMode = 'custom';
    updateUpscaleCanvasBackground();
});

function updateUpscaleCanvasBackground() {
    const container = $('upscaleCanvasContainer');
    if (!container) return;

    const baseStyle = 'position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;cursor:grab;z-index:5;';

    switch (upscaleBgMode) {
        case 'checker':
            container.style.cssText = baseStyle +
                'background-image:linear-gradient(45deg, #e0e0e0 25%, transparent 25%), linear-gradient(-45deg, #e0e0e0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e0e0e0 75%), linear-gradient(-45deg, transparent 75%, #e0e0e0 75%);' +
                'background-size:20px 20px;background-position:0 0, 0 10px, 10px -10px, -10px 0px;background-color:#ffffff;';
            break;
        case 'white':
            container.style.cssText = baseStyle + 'background-color:#ffffff;';
            break;
        case 'black':
            container.style.cssText = baseStyle + 'background-color:#000000;';
            break;
        case 'custom':
            container.style.cssText = baseStyle + 'background-color:' + upscaleCustomColor + ';';
            break;
    }
}

// 眼睛功能 - 对比原图和结果
function showUpscaleOriginal() {
    if (!upscaleCanvasState.originalImage || !upscaleCanvasState.showingResult) return;
    showUpscaleCanvas(upscaleCanvasState.originalImage, false);
    $('upscaleEyeBtn')?.classList.add('active');
}

function hideUpscaleOriginal() {
    if (!upscaleCanvasState.resultImage) return;
    showUpscaleCanvas(upscaleCanvasState.resultImage, true);
    $('upscaleEyeBtn')?.classList.remove('active');
}

$('upscaleEyeBtn')?.addEventListener('mousedown', showUpscaleOriginal);
$('upscaleEyeBtn')?.addEventListener('mouseup', hideUpscaleOriginal);
$('upscaleEyeBtn')?.addEventListener('mouseleave', hideUpscaleOriginal);

// 画布缩放
$('upscaleCanvasContainer')?.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    upscaleCanvasState.scale = Math.max(0.1, Math.min(10, upscaleCanvasState.scale * delta));
    const canvas = $('upscaleCanvas');
    if (canvas) {
        canvas.style.transform = `translate(calc(-50% + ${upscaleCanvasState.offsetX}px), calc(-50% + ${upscaleCanvasState.offsetY}px)) scale(${upscaleCanvasState.scale})`;
    }
});

// 画布拖拽
$('upscaleCanvasContainer')?.addEventListener('mousedown', e => {
    if (e.target.closest('.toolbar')) return;
    upscaleCanvasState.isDragging = true;
    upscaleCanvasState.lastX = e.clientX;
    upscaleCanvasState.lastY = e.clientY;
});

document.addEventListener('mousemove', e => {
    if (!upscaleCanvasState.isDragging) return;
    const dx = e.clientX - upscaleCanvasState.lastX;
    const dy = e.clientY - upscaleCanvasState.lastY;
    upscaleCanvasState.offsetX += dx;
    upscaleCanvasState.offsetY += dy;
    upscaleCanvasState.lastX = e.clientX;
    upscaleCanvasState.lastY = e.clientY;
    const canvas = $('upscaleCanvas');
    if (canvas) {
        canvas.style.transform = `translate(calc(-50% + ${upscaleCanvasState.offsetX}px), calc(-50% + ${upscaleCanvasState.offsetY}px)) scale(${upscaleCanvasState.scale})`;
    }
});

document.addEventListener('mouseup', () => {
    upscaleCanvasState.isDragging = false;
});

// 上传图片
$('upscaleUploadZone')?.addEventListener('click', () => $('upscaleFileInput').click());
$('upscaleUploadZone')?.addEventListener('dragover', e => {
    e.preventDefault();
    e.stopPropagation();
    $('upscaleUploadZone').classList.add('dragover');
});
$('upscaleUploadZone')?.addEventListener('dragleave', e => {
    e.preventDefault();
    e.stopPropagation();
    $('upscaleUploadZone').classList.remove('dragover');
});
$('upscaleUploadZone')?.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    $('upscaleUploadZone').classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        handleUpscaleUpload(e.dataTransfer.files[0]);
    }
});

$('upscaleFileInput')?.addEventListener('change', e => {
    if (e.target.files.length > 0) {
        handleUpscaleUpload(e.target.files[0]);
    }
});

async function handleUpscaleUpload(file) {
    setStatus('上传中...', true);

    const fd = new FormData();
    fd.append('file', file);

    try {
        const res = await fetch(API + '/api/upload', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('上传失败');
        const data = await res.json();

        state.upscaleImageId = data.image_id;
        upscaleCanvasState.originalImage = data.preview;
        upscaleCanvasState.originalWidth = data.width;
        upscaleCanvasState.originalHeight = data.height;
        upscaleCanvasState.resultImage = null;

        showUpscaleCanvas(data.preview, false);

        // 启用放大按钮
        $('upscaleBtn').disabled = false;

        // 显示图片信息
        $('upscaleImageInfo').textContent = `${data.filename} (${data.width}×${data.height})`;
        show($('upscaleImageInfo'));

        setStatus('图片已上传，选择模型开始放大');
    } catch (err) {
        setStatus(err.message, false, true);
    }
}

// 从切分面板发送
$('sendToUpscaleBtn')?.addEventListener('click', () => {
    const selected = state.splitElements.filter(e => e.selected);
    if (!selected.length) {
        showToast('请先选择元素', 'error');
        return;
    }

    // 取第一个选中的元素
    const el = selected[0];
    state.upscaleImageId = null; // 不需要后端 image_id
    upscaleCanvasState.originalImage = el.preview;
    upscaleCanvasState.resultImage = null;

    showUpscaleCanvas(el.preview, false);

    // 启用放大按钮
    $('upscaleBtn').disabled = false;

    // 显示图片信息
    $('upscaleImageInfo').textContent = `元素 ${el.index}`;
    show($('upscaleImageInfo'));

    // 切换到放大 tab
    document.querySelector('.tab[data-panel="upscale"]').click();

    setStatus('已发送到放大面板');
});

// 模型选择
$('upscaleModel')?.addEventListener('change', e => {
    const model = e.target.value;
    const desc = $('modelDescription');
    if (desc) {
        const descriptions = {
            'RealESRGAN_x4plus': '通用场景，质量最佳，适合照片和复杂图像',
            'RealESRGAN_x2plus': '2倍放大，适合小幅提升或保持原图风格',
            'RealESRGAN_x4plus_anime_6B': '二次元/插画专用，保持线条清晰'
        };
        desc.textContent = descriptions[model] || '';
    }
});

// 开始放大
$('upscaleBtn')?.addEventListener('click', async () => {
    if (!upscaleCanvasState.originalImage) {
        showToast('请先上传图片', 'error');
        return;
    }

    $('upscaleBtn').disabled = true;
    $('upscaleProgress').style.display = 'flex';
    $('upscaleProgressText').textContent = '准备中...';
    setStatus('放大中...', true);

    const model = $('upscaleModel').value;
    const scale = parseFloat($('upscaleScale').value) || null;

    try {
        // 如果没有 image_id，先上传
        let imageId = state.upscaleImageId;
        if (!imageId) {
            $('upscaleProgressText').textContent = '上传图片...';
            const blob = await fetch(upscaleCanvasState.originalImage).then(r => r.blob());
            const fd = new FormData();
            fd.append('file', blob, 'image.png');
            const upRes = await fetch(API + '/api/upload', { method: 'POST', body: fd });
            if (!upRes.ok) throw new Error('上传失败');
            const upData = await upRes.json();
            imageId = upData.image_id;
            state.upscaleImageId = imageId;
        }

        $('upscaleProgressText').textContent = 'AI 处理中...';

        // 调用放大 API
        const fd = new FormData();
        fd.append('image_id', imageId);
        fd.append('model', model);
        if (scale) fd.append('scale', scale);

        const res = await fetch(API + '/api/upscale', { method: 'POST', body: fd });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || '放大失败');
        }

        const data = await res.json();

        // 显示结果
        upscaleCanvasState.resultImage = data.preview;
        upscaleCanvasState.originalWidth = upscaleCanvasState.originalWidth || upscaleCanvasState.originalHeight;
        showUpscaleCanvas(data.preview, true);

        // 更新信息
        $('upscaleImageInfo').textContent = `${model} - ${data.width}×${data.height} (${data.scale}x)`;

        // 启用导出按钮
        $('upscaleExportBtn').disabled = false;

        setStatus(`放大完成: ${data.width}×${data.height}`);
    } catch (err) {
        setStatus(err.message, false, true);
    } finally {
        $('upscaleBtn').disabled = false;
        $('upscaleProgress').style.display = 'none';
    }
});

// 导出
$('upscaleExportBtn')?.addEventListener('click', async () => {
    if (!upscaleCanvasState.resultImage) {
        showToast('没有可导出的结果', 'error');
        return;
    }

    const format = $('upscaleFormat').value || 'png';

    try {
        const fd = new FormData();
        fd.append('base64_data', upscaleCanvasState.resultImage);
        fd.append('filename', `upscaled.${format}`);
        fd.append('format', format);

        const res = await fetch(API + '/api/upscale/export', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('导出失败');

        // 下载文件
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `upscaled.${format}`;
        a.click();
        URL.revokeObjectURL(url);

        showToast('导出成功');
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// 快捷键
document.addEventListener('keydown', e => {
    if (e.key === 'r' || e.key === 'R') {
        if (document.querySelector('.panel.active')?.id === 'panel-upscale') {
            resetUpscaleView();
        }
    }
});

// 从抠图面板发送（保留兼容）
window.sendToUpscale = function(imageSrc, name) {
    upscaleCanvasState.originalImage = imageSrc;
    upscaleCanvasState.resultImage = null;
    state.upscaleImageId = null;

    showUpscaleCanvas(imageSrc, false);
    $('upscaleBtn').disabled = false;
    $('upscaleImageInfo').textContent = name || '从抠图发送';
    show($('upscaleImageInfo'));

    document.querySelector('.tab[data-panel="upscale"]').click();
};
