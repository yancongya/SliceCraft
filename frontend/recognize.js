// ============ 图片识别面板 ============

// 识别状态
const recognizeState = {
    model: 'clip',
    customLabels: ''
};

// state.recognizeItems 在 shared.js 中初始化

// ============ 获取内容 ============
$('getFromSplitForRecognize')?.addEventListener('click', () => {
    const selected = state.splitElements.filter(e => e.selected);
    if (!selected.length) { showToast('请先在切分面板选择元素', 'error'); return; }

    syncElementsToTarget(state.recognizeItems, selected, (el) => ({
        index: 0,
        src: el.preview,
        name: el.name || ('element_' + el.index),
        sourceElementId: el.sourceElementId || el.id,
        sourceImageId: el.sourceImageId,
        sourceImageSize: el.sourceImageSize,
        bbox: el.bbox,
        rawPreview: el.rawPreview,
        selected: true,
        label: null,
        confidence: null
    }));

    renderRecognizeElements();
    $('recognizeBtn').disabled = false;
    showToast('已同步 ' + selected.length + ' 个元素');
});

$('getFromRemoveForRecognize')?.addEventListener('click', () => {
    const processed = state.removeElements.filter(e => e.processed && e.result);
    if (!processed.length) { showToast('请先在抠图面板处理元素', 'error'); return; }

    syncElementsToTarget(state.recognizeItems, processed, (el) => ({
        index: 0,
        src: el.result,
        name: el.name || ('element_' + el.index),
        sourceElementId: el.sourceElementId || el.id,
        sourceImageId: el.sourceImageId,
        sourceImageSize: el.sourceImageSize,
        bbox: el.bbox,
        rawPreview: el.rawPreview,
        selected: true,
        label: null,
        confidence: null
    }));

    renderRecognizeElements();
    $('recognizeBtn').disabled = false;
    showToast('已同步 ' + processed.length + ' 个元素');
});

$('getFromUpscaleForRecognize')?.addEventListener('click', () => {
    const processed = state.upscaleItems.filter(e => e.processed && e.result);
    if (!processed.length) { showToast('请先在放大面板处理元素', 'error'); return; }

    syncElementsToTarget(state.recognizeItems, processed, (el) => ({
        index: 0,
        src: el.result,
        name: el.name || ('element_' + el.index),
        sourceElementId: el.sourceElementId || el.id,
        sourceImageId: el.sourceImageId,
        sourceImageSize: el.sourceImageSize,
        bbox: el.bbox,
        rawPreview: el.rawPreview,
        selected: true,
        label: null,
        confidence: null
    }));

    renderRecognizeElements();
    $('recognizeBtn').disabled = false;
    showToast('已同步 ' + processed.length + ' 个元素');
});

// ============ 渲染卡片（多行网格布局） ============
function renderRecognizeElements() {
    const has = state.recognizeItems.length > 0;
    $('recognizeCount').textContent = state.recognizeItems.length + ' 个';

    const list = $('recognizeList');
    if (!list) return;
    list.innerHTML = '';
    list.className = 'elements-container recognize-grid';

    state.recognizeItems.forEach((el, i) => {
        const div = document.createElement('div');
        div.className = 'elem-card' + (el.selected ? ' selected' : '');
        div.dataset.index = el.index;
        
        // 标签显示
        let labelHtml = '';
        if (el.label) {
            const conf = el.confidence ? ' (' + Math.round(el.confidence * 100) + '%)' : '';
            labelHtml = '<span class="recognize-label" title="' + el.label + conf + '">' + el.label + conf + '</span>';
        }
        
        div.innerHTML = '<img src="' + el.src + '"><span class="num">' + el.index + '</span>' + labelHtml + '<button class="card-delete" title="删除">×</button>';
        
        // 点击：单选
        div.addEventListener('click', e => {
            if (e.target.classList.contains('card-delete')) return;
            if (e.shiftKey) {
                el.selected = true;
            } else {
                state.recognizeItems.forEach(x => x.selected = false);
                el.selected = true;
            }
            renderRecognizeElements();
        });
        
        // 双击：预览
        div.addEventListener('dblclick', e => {
            if (e.target.classList.contains('card-delete')) return;
            openModal(el.src);
        });
        
        // 删除
        div.querySelector('.card-delete').addEventListener('click', e => {
            e.stopPropagation();
            state.recognizeItems.splice(i, 1);
            reindexElements(state.recognizeItems);
            renderRecognizeElements();
        });
        
        list.appendChild(div);
    });

    updateBadges();
    updateElementDetail('recognize', state.recognizeItems);
}

// ============ 模型选择 ============
function updateRecognizeModelInfo() {
    const desc = $('recognizeModelDesc');
    if (desc) {
        desc.textContent = 'SigLIP/CLIP 零样本分类，使用内置标签库，也可输入自定义标签';
    }
    const customLabels = $('customLabelsSection');
    if (customLabels) customLabels.classList.remove('hidden');
}
updateRecognizeModelInfo();

$('recognizeModel')?.addEventListener('change', e => {
    recognizeState.model = e.target.value;
    updateRecognizeModelInfo();
});

// ============ 开始识别 ============
$('recognizeBtn')?.addEventListener('click', async () => {
    const selected = state.recognizeItems.filter(e => e.selected);
    if (!selected.length) { showToast('请先选择元素', 'error'); return; }

    $('recognizeBtn').disabled = true;
    $('recognizeProgress').style.display = 'flex';
    setStatus('识别中...', true);

    const model = recognizeState.model;
    const labels = model === 'clip' ? $('customLabelsInput')?.value : null;

    let successCount = 0;
    const total = selected.length;

    for (let i = 0; i < selected.length; i++) {
        const el = selected[i];
        $('recognizeProgressText').textContent = '处理中 (' + (i + 1) + '/' + total + ')...';
        setStatus('识别中 (' + (i + 1) + '/' + total + ')...', true);

        try {
            const blob = await fetch(el.src).then(r => r.blob());
            const fd = new FormData();
            fd.append('file', blob, 'image.png');
            const upRes = await fetch(API + '/api/upload', { method: 'POST', body: fd });
            if (!upRes.ok) throw new Error('上传失败');
            const upData = await upRes.json();

            const recognizeFd = new FormData();
            recognizeFd.append('image_id', upData.image_id);
            recognizeFd.append('top_k', '1');
            if (labels) recognizeFd.append('labels', labels);

            const res = await fetch(API + '/api/recognize/' + model, { method: 'POST', body: recognizeFd });
            if (!res.ok) throw new Error('识别失败');

            const data = await res.json();
            el.label = data.best_label;
            el.confidence = data.best_confidence;
            if (data.best_label) el.label = data.best_label;
            successCount++;
        } catch (err) {
            console.error('识别失败:', err);
        }
    }

    uniqueNamesFromLabels(selected.filter(e => e.label));
    renderRecognizeElements();
    $('recognizeBtn').disabled = false;
    $('applyNamesBtn').disabled = false;
    $('recognizeProgress').style.display = 'none';
    setStatus('识别完成: ' + successCount + '/' + total);
    showToast('识别完成 ' + successCount + '/' + total + ' 个');
});

// ============ 应用名称（带编号去重） ============
$('applyNamesBtn')?.addEventListener('click', () => {
    const items = state.recognizeItems.filter(e => e.label);
    if (!items.length) { showToast('没有识别结果', 'error'); return; }

    uniqueNamesFromLabels(items);

    renderRecognizeElements();
    showToast('已应用名称');
});

// ============ 同步名称到其他 tab ============
$('syncNamesBtn')?.addEventListener('click', () => {
    const items = state.recognizeItems.filter(e => e.name);
    if (!items.length) { showToast('没有可同步的名称', 'error'); return; }

    syncNamesBySource(items, [state.splitElements, state.removeElements, state.upscaleItems]);

    if (typeof renderSplitElements === 'function') renderSplitElements();
    if (typeof renderRemoveElements === 'function') renderRemoveElements();
    if (typeof renderUpscaleElements === 'function') renderUpscaleElements();

    showToast('已同步名称到其他面板');
});

// ============ 全选/取消 ============
$('selectRecognizeAll')?.addEventListener('click', () => {
    state.recognizeItems.forEach(e => e.selected = true);
    renderRecognizeElements();
});
$('deselectRecognizeAll')?.addEventListener('click', () => {
    state.recognizeItems.forEach(e => e.selected = false);
    renderRecognizeElements();
});
