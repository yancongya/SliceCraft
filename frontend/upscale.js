// ============ AI 放大面板 ============
// state.upscaleItems 在 shared.js 中初始化
// 每项: { index, src, name, selected, processed, result, resultWidth, resultHeight }

// 画布状态（仅用于缩放/拖拽）
const upscaleCanvasState = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    lastX: 0,
    lastY: 0,
    currentImage: null,
    currentElement: null
};

// ============ 画布显示 ============
function showUpscaleCanvas(src, element) {
    const canvas = $('upscaleCanvas');
    const container = $('upscaleCanvasContainer');
    if (!canvas || !container) return;

    upscaleCanvasState.currentImage = src;
    if (element) upscaleCanvasState.currentElement = element;

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
    };
    img.src = src;

    container.style.display = 'block';
    if ($('upscaleToolbar')) $('upscaleToolbar').style.display = 'flex';
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

// 归位
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

// ============ 背景色 ============
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
        case 'white': container.style.cssText = baseStyle + 'background-color:#ffffff;'; break;
        case 'black': container.style.cssText = baseStyle + 'background-color:#000000;'; break;
        case 'custom': container.style.cssText = baseStyle + 'background-color:' + upscaleCustomColor + ';'; break;
    }
}

// ============ 眼睛对比 ============
let upscaleShowingOriginal = false;
function showUpscaleOriginal() {
    const cur = upscaleCanvasState.currentElement;
    if (!cur || !cur.processed || upscaleShowingOriginal) return;
    upscaleShowingOriginal = true;
    $('upscaleEyeBtn')?.classList.add('active');
    showUpscaleCanvas(cur.src, cur);
}
function hideUpscaleOriginal() {
    if (!upscaleShowingOriginal) return;
    upscaleShowingOriginal = false;
    $('upscaleEyeBtn')?.classList.remove('active');
    const cur = upscaleCanvasState.currentElement;
    if (cur && cur.result) showUpscaleCanvas(cur.result, cur);
}
$('upscaleEyeBtn')?.addEventListener('mousedown', showUpscaleOriginal);
$('upscaleEyeBtn')?.addEventListener('mouseup', hideUpscaleOriginal);
$('upscaleEyeBtn')?.addEventListener('mouseleave', hideUpscaleOriginal);

// ============ 画布交互 ============
$('upscaleCanvasContainer')?.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    upscaleCanvasState.scale = Math.max(0.1, Math.min(10, upscaleCanvasState.scale * delta));
    const canvas = $('upscaleCanvas');
    if (canvas) canvas.style.transform = `translate(calc(-50% + ${upscaleCanvasState.offsetX}px), calc(-50% + ${upscaleCanvasState.offsetY}px)) scale(${upscaleCanvasState.scale})`;
});
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
    if (canvas) canvas.style.transform = `translate(calc(-50% + ${upscaleCanvasState.offsetX}px), calc(-50% + ${upscaleCanvasState.offsetY}px)) scale(${upscaleCanvasState.scale})`;
});
document.addEventListener('mouseup', () => { upscaleCanvasState.isDragging = false; });

// ============ 渲染卡片（和 splitElements/removeElements 完全一致） ============
function renderUpscaleElements() {
    const has = state.upscaleItems.length > 0;
    $('upscaleBar').classList.toggle('hidden', !has);
    $('upscaleCount').textContent = state.upscaleItems.length + ' 个';

    const list = $('upscaleList');
    list.innerHTML = '';

    state.upscaleItems.forEach((el, i) => {
        const div = document.createElement('div');
        div.className = 'elem-card' + (el.selected ? ' selected' : '');
        div.dataset.index = el.index;
        const imgSrc = el.processed ? el.result : el.src;
        div.innerHTML = '<img src="' + imgSrc + '"><span class="num">' + el.index + '</span><button class="card-delete" title="删除">×</button>';
        div.addEventListener('click', e => {
            if (e.target.classList.contains('card-delete')) return;
            if (e.shiftKey) { el.selected = true; } else { el.selected = !el.selected; }
            div.classList.toggle('selected', el.selected);
            showUpscaleCanvas(imgSrc, el);
            updateBadges();
        });
        div.addEventListener('dblclick', e => {
            if (e.target.classList.contains('card-delete')) return;
            openModal(imgSrc);
        });
        div.querySelector('.card-delete').addEventListener('click', e => {
            e.stopPropagation();
            state.upscaleItems.splice(i, 1);
            renderUpscaleElements();
        });
        list.appendChild(div);
    });

    updateBadges();
    updateElementsLayout();
}

// ============ 获取内容 ============
$('getFromSplitBtn')?.addEventListener('click', () => {
    const selected = state.splitElements.filter(e => e.selected);
    if (!selected.length) { showToast('请先在切分面板选择元素', 'error'); return; }

    selected.forEach(el => {
        state.upscaleItems.push({
            index: state.upscaleItems.length + 1,
            src: el.preview,
            name: '切分-' + el.index,
            selected: true,
            processed: false,
            result: null
        });
    });

    // 重新编号
    state.upscaleItems.forEach((el, i) => el.index = i + 1);

    renderUpscaleElements();
    const last = state.upscaleItems[state.upscaleItems.length - 1];
    showUpscaleCanvas(last.src, last);
    $('upscaleBtn').disabled = false;
    $('upscaleExportBtn').disabled = true;
    showToast(`已获取 ${selected.length} 个切分元素`);
});

$('getFromRemoveBtn')?.addEventListener('click', () => {
    const processed = state.removeElements.filter(e => e.processed && e.result);
    if (!processed.length) { showToast('请先在抠图面板处理元素', 'error'); return; }

    processed.forEach(el => {
        state.upscaleItems.push({
            index: state.upscaleItems.length + 1,
            src: el.result,
            name: '抠图-' + el.index,
            selected: true,
            processed: false,
            result: null
        });
    });

    state.upscaleItems.forEach((el, i) => el.index = i + 1);
    renderUpscaleElements();
    const last = state.upscaleItems[state.upscaleItems.length - 1];
    showUpscaleCanvas(last.src, last);
    $('upscaleBtn').disabled = false;
    $('upscaleExportBtn').disabled = true;
    showToast(`已获取 ${processed.length} 个抠图结果`);
});

// 切分 tab 直接发送
$('sendToUpscaleFromSplit')?.addEventListener('click', () => {
    const selected = state.splitElements.filter(e => e.selected);
    if (!selected.length) { showToast('请先选择元素', 'error'); return; }

    document.querySelector('.tab[data-panel="upscale"]').click();

    selected.forEach(el => {
        state.upscaleItems.push({
            index: state.upscaleItems.length + 1,
            src: el.preview,
            name: '切分-' + el.index,
            selected: true,
            processed: false,
            result: null
        });
    });

    state.upscaleItems.forEach((el, i) => el.index = i + 1);
    renderUpscaleElements();
    const last = state.upscaleItems[state.upscaleItems.length - 1];
    showUpscaleCanvas(last.src, last);
    $('upscaleBtn').disabled = false;
    $('upscaleExportBtn').disabled = true;
    showToast(`已发送 ${selected.length} 个元素到放大`);
});

// 抠图 tab 直接发送
$('sendToUpscaleFromRemove')?.addEventListener('click', () => {
    const processed = state.removeElements.filter(e => e.processed && e.result);
    if (!processed.length) { showToast('请先处理元素', 'error'); return; }

    document.querySelector('.tab[data-panel="upscale"]').click();

    processed.forEach(el => {
        state.upscaleItems.push({
            index: state.upscaleItems.length + 1,
            src: el.result,
            name: '抠图-' + el.index,
            selected: true,
            processed: false,
            result: null
        });
    });

    state.upscaleItems.forEach((el, i) => el.index = i + 1);
    renderUpscaleElements();
    const last = state.upscaleItems[state.upscaleItems.length - 1];
    showUpscaleCanvas(last.src, last);
    $('upscaleBtn').disabled = false;
    $('upscaleExportBtn').disabled = true;
    showToast(`已发送 ${processed.length} 个结果到放大`);
});

// 全选/取消
$('selectUpscaleAll')?.addEventListener('click', () => {
    state.upscaleItems.forEach(e => e.selected = true);
    renderUpscaleElements();
});
$('deselectUpscaleAll')?.addEventListener('click', () => {
    state.upscaleItems.forEach(e => e.selected = false);
    renderUpscaleElements();
});

// ============ 模型选择 ============
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

// ============ 开始放大 ============
$('upscaleBtn')?.addEventListener('click', async () => {
    const sel = state.upscaleItems.filter(e => e.selected);
    if (!sel.length) { showToast('请先选择元素', 'error'); return; }

    $('upscaleBtn').disabled = true;
    $('upscaleProgress').style.display = 'flex';
    setStatus('放大中...', true);

    const model = $('upscaleModel').value;
    const scale = parseFloat($('upscaleScale').value) || null;

    let successCount = 0;
    const total = sel.length;

    for (let i = 0; i < sel.length; i++) {
        const el = sel[i];
        if (el.processed) { successCount++; continue; }

        $('upscaleProgressText').textContent = `处理中 (${i + 1}/${total})...`;
        setStatus(`放大中 (${i + 1}/${total})...`, true);

        try {
            const blob = await fetch(el.src).then(r => r.blob());
            const fd = new FormData();
            fd.append('file', blob, 'image.png');
            const upRes = await fetch(API + '/api/upload', { method: 'POST', body: fd });
            if (!upRes.ok) throw new Error('上传失败');
            const upData = await upRes.json();

            const upscaleFd = new FormData();
            upscaleFd.append('image_id', upData.image_id);
            upscaleFd.append('model', model);
            if (scale) upscaleFd.append('scale', scale);

            const res = await fetch(API + '/api/upscale', { method: 'POST', body: upscaleFd });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || '放大失败');
            }

            const data = await res.json();
            el.processed = true;
            el.result = data.preview;
            el.resultWidth = data.width;
            el.resultHeight = data.height;
            successCount++;
        } catch (err) {
            console.error('元素放大失败:', err);
        }
    }

    renderUpscaleElements();

    // 更新画布显示当前元素的放大结果
    if (upscaleCanvasState.currentElement && upscaleCanvasState.currentElement.processed) {
        showUpscaleCanvas(upscaleCanvasState.currentElement.result, upscaleCanvasState.currentElement);
    }

    $('upscaleBtn').disabled = false;
    $('upscaleExportBtn').disabled = false;
    $('upscaleProgress').style.display = 'none';
    setStatus(`放大完成: ${successCount}/${total}`);
    showToast(`放大完成 ${successCount}/${total} 个`);
});

// ============ 导出 ============
$('upscaleExportBtn')?.addEventListener('click', async () => {
    const results = state.upscaleItems.filter(e => e.processed && e.result);
    if (!results.length) { showToast('没有可导出的结果', 'error'); return; }

    const format = $('upscaleFormat').value || 'png';

    for (let i = 0; i < results.length; i++) {
        const el = results[i];
        const fd = new FormData();
        fd.append('base64_data', el.result);
        fd.append('filename', `${el.name}.${format}`);
        fd.append('format', format);

        try {
            const res = await fetch(API + '/api/upscale/export', { method: 'POST', body: fd });
            if (!res.ok) continue;
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${el.name}.${format}`;
            a.click();
            URL.revokeObjectURL(url);
            await new Promise(r => setTimeout(r, 200));
        } catch (err) { /* skip */ }
    }

    showToast('导出完成');
});

// ============ 快捷键 ============
document.addEventListener('keydown', e => {
    if ((e.key === 'r' || e.key === 'R') && document.querySelector('.panel.active')?.id === 'panel-upscale') {
        resetUpscaleView();
    }
});
