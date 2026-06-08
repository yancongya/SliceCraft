// ============ 图片识别面板 ============

// 识别状态
const recognizeState = {
    model: 'mobilenet',
    customLabels: '',
    results: []
};

// ============ 获取内容 ============
$('getFromSplitForRecognize')?.addEventListener('click', () => {
    const selected = state.splitElements.filter(e => e.selected);
    if (!selected.length) { showToast('请先在切分面板选择元素', 'error'); return; }

    syncElementsToTarget(state.recognizeItems, selected, (el) => ({
        index: 0,
        src: el.preview,
        name: el.name || ('element_' + el.index),
        selected: true,
        label: null,
        confidence: null,
        suggestedName: null
    }));

    renderRecognizeElements();
    $('recognizeBtn').disabled = false;
    $('applyNamesBtn').disabled = true;
    showToast(`已同步 ${selected.length} 个元素`);
});

$('getFromRemoveForRecognize')?.addEventListener('click', () => {
    const processed = state.removeElements.filter(e => e.processed && e.result);
    if (!processed.length) { showToast('请先在抠图面板处理元素', 'error'); return; }

    syncElementsToTarget(state.recognizeItems, processed, (el) => ({
        index: 0,
        src: el.result,
        name: el.name || ('element_' + el.index),
        selected: true,
        label: null,
        confidence: null,
        suggestedName: null
    }));

    renderRecognizeElements();
    $('recognizeBtn').disabled = false;
    $('applyNamesBtn').disabled = true;
    showToast(`已同步 ${processed.length} 个元素`);
});

$('getFromUpscaleForRecognize')?.addEventListener('click', () => {
    const processed = state.upscaleItems.filter(e => e.processed && e.result);
    if (!processed.length) { showToast('请先在放大面板处理元素', 'error'); return; }

    syncElementsToTarget(state.recognizeItems, processed, (el) => ({
        index: 0,
        src: el.result,
        name: el.name || ('element_' + el.index),
        selected: true,
        label: null,
        confidence: null,
        suggestedName: null
    }));

    renderRecognizeElements();
    $('recognizeBtn').disabled = false;
    $('applyNamesBtn').disabled = true;
    showToast(`已同步 ${processed.length} 个元素`);
});

// ============ 渲染识别元素列表 ============
function renderRecognizeElements() {
    const has = (state.recognizeItems || []).length > 0;
    $('recognizeBar').classList.toggle('hidden', !has);
    $('recognizeCount').textContent = (state.recognizeItems || []).length + ' 个';

    const list = $('recognizeList');
    if (!list) return;
    list.innerHTML = '';

    (state.recognizeItems || []).forEach((el, i) => {
        const div = document.createElement('div');
        div.className = 'elem-card' + (el.selected ? ' selected' : '');
        div.dataset.index = el.index;
        
        // 显示图片和标签
        let labelHtml = '';
        if (el.label) {
            labelHtml = `<span class="rec-label" style="position:absolute;bottom:2px;left:2px;right:2px;font-size:9px;background:rgba(0,0,0,0.7);color:#fff;padding:1px 3px;border-radius:2px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${el.label}</span>`;
        }
        
        div.innerHTML = `<img src="${el.src}"><span class="num">${el.index}</span>${labelHtml}<button class="card-delete" title="删除">×</button>`;
        
        div.addEventListener('click', e => {
            if (e.target.classList.contains('card-delete')) return;
            if (e.shiftKey) {
                el.selected = true;
            } else {
                state.recognizeItems.forEach(x => x.selected = false);
                el.selected = true;
            }
            renderRecognizeElements();
            updateElementDetail('recognize', state.recognizeItems);
        });
        
        div.addEventListener('dblclick', e => {
            if (e.target.classList.contains('card-delete')) return;
            openModal(el.src);
        });
        
        div.querySelector('.card-delete').addEventListener('click', e => {
            e.stopPropagation();
            state.recognizeItems.splice(i, 1);
            renderRecognizeElements();
        });
        
        list.appendChild(div);
    });

    updateBadges();
    updateElementsLayout();
    updateElementDetail('recognize', state.recognizeItems);
}

// ============ 模型选择 ============
$('recognizeModel')?.addEventListener('change', e => {
    recognizeState.model = e.target.value;
    const desc = $('recognizeModelDesc');
    if (desc) {
        const descriptions = {
            'mobilenet': 'ImageNet 1000 类，速度快，适合常见物体',
            'clip': '零样本分类，可自定义标签，更灵活'
        };
        desc.textContent = descriptions[recognizeState.model] || '';
    }
    
    // 显示/隐藏自定义标签输入
    $('customLabelsSection').classList.toggle('hidden', recognizeState.model !== 'clip');
});

// ============ 开始识别 ============
$('recognizeBtn')?.addEventListener('click', async () => {
    const selected = (state.recognizeItems || []).filter(e => e.selected);
    if (!selected.length) { showToast('请先选择元素', 'error'); return; }

    $('recognizeBtn').disabled = true;
    $('recognizeProgress').style.display = 'flex';
    setStatus('识别中...', true);

    const model = recognizeState.model;
    const labels = recognizeState.model === 'clip' ? $('customLabelsInput')?.value : null;

    let successCount = 0;
    const total = selected.length;

    for (let i = 0; i < selected.length; i++) {
        const el = selected[i];
        $('recognizeProgressText').textContent = `识别中 (${i + 1}/${total})...`;
        setStatus(`识别中 (${i + 1}/${total})...`, true);

        try {
            // 上传图片
            const blob = await fetch(el.src).then(r => r.blob());
            const fd = new FormData();
            fd.append('file', blob, 'image.png');
            const upRes = await fetch(API + '/api/upload', { method: 'POST', body: fd });
            if (!upRes.ok) throw new Error('上传失败');
            const upData = await upRes.json();

            // 调用识别 API
            const recognizeFd = new FormData();
            recognizeFd.append('image_id', upData.image_id);
            recognizeFd.append('top_k', '1');
            if (labels) recognizeFd.append('labels', labels);

            const res = await fetch(API + `/api/recognize/${model}`, { method: 'POST', body: recognizeFd });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || '识别失败');
            }

            const data = await res.json();

            // 更新元素信息
            el.label = data.best_label;
            el.confidence = data.best_confidence;
            el.suggestedName = data.best_label || el.name;
            successCount++;

        } catch (err) {
            console.error('元素识别失败:', err);
        }
    }

    renderRecognizeElements();

    // 启用应用名称按钮
    $('applyNamesBtn').disabled = false;
    $('recognizeBtn').disabled = false;
    $('recognizeProgress').style.display = 'none';

    setStatus(`识别完成: ${successCount}/${total}`);
    showToast(`识别完成 ${successCount}/${total} 个`);
});

// ============ 应用识别结果到名称 ============
$('applyNamesBtn')?.addEventListener('click', () => {
    const items = (state.recognizeItems || []).filter(e => e.label);
    if (!items.length) { showToast('没有识别结果', 'error'); return; }

    // 统计标签，生成唯一名称
    const labelCounts = {};
    items.forEach(el => {
        if (!labelCounts[el.label]) {
            labelCounts[el.label] = 0;
        }
        labelCounts[el.label]++;
        const num = String(labelCounts[el.label]).padStart(2, '0');
        el.name = `${el.label}_${num}`;
    });

    renderRecognizeElements();
    showToast('已应用识别结果到名称');
});

// ============ 同步名称到其他 tab ============
$('syncNamesBtn')?.addEventListener('click', () => {
    const items = (state.recognizeItems || []).filter(e => e.name);
    if (!items.length) { showToast('没有可同步的名称', 'error'); return; }

    // 同步到切分 tab
    items.forEach(recEl => {
        const splitEl = state.splitElements.find(el => el.index === recEl.index);
        if (splitEl) {
            splitEl.name = recEl.name;
        }
        
        const removeEl = state.removeElements.find(el => el.index === recEl.index);
        if (removeEl) {
            removeEl.name = recEl.name;
        }
        
        const upscaleEl = state.upscaleItems.find(el => el.index === recEl.index);
        if (upscaleEl) {
            upscaleEl.name = recEl.name;
        }
    });

    // 刷新其他 tab 的显示
    if (typeof renderSplitElements === 'function') renderSplitElements();
    if (typeof renderRemoveElements === 'function') renderRemoveElements();
    if (typeof renderUpscaleElements === 'function') renderUpscaleElements();

    showToast('已同步名称到切分、抠图、放大面板');
});

// ============ 全选/取消 ============
$('selectRecognizeAll')?.addEventListener('click', () => {
    (state.recognizeItems || []).forEach(e => e.selected = true);
    renderRecognizeElements();
});
$('deselectRecognizeAll')?.addEventListener('click', () => {
    (state.recognizeItems || []).forEach(e => e.selected = false);
    renderRecognizeElements();
});

// 初始化发送下拉菜单
initSendDropdown('recognizeSendBtn', 'recognizeSendMenu', (target) => {
    const sel = (state.recognizeItems || []).filter(e => e.selected);
    if (!sel.length) { showToast('请先选择元素', 'error'); return; }
    
    if (target === 'split') {
        syncElementsToTarget(state.splitElements, sel, (el) => ({
            index: 0,
            preview: el.src,
            selected: true,
            name: el.name || ('element_' + el.index),
            bbox: [0, 0, 0, 0]
        }));
        renderSplitElements();
        document.querySelector('.tab[data-panel="split"]').click();
    } else if (target === 'remove') {
        syncElementsToTarget(state.removeElements, sel, (el) => ({
            index: 0,
            preview: el.src,
            selected: true,
            processed: false,
            result: null,
            name: el.name || ('element_' + el.index)
        }));
        renderRemoveElements();
        document.querySelector('.tab[data-panel="remove"]').click();
    } else if (target === 'upscale') {
        syncElementsToTarget(state.upscaleItems, sel, (el) => ({
            index: 0,
            src: el.src,
            name: el.name || ('element_' + el.index),
            selected: true,
            processed: false,
            result: null
        }));
        renderUpscaleElements();
        document.querySelector('.tab[data-panel="upscale"]').click();
    }
    
    showToast(`已同步 ${sel.length} 个元素`);
});
