// ============ 图片识别面板 ============

const recognizeState = {
    model: 'clip',
};

function recognizeImagePurpose() {
    const mode = $('recognizeInputSource')?.value || 'latest';
    if (mode === 'split') return 'split';
    if (mode === 'remove') return 'remove';
    if (mode === 'upscale') return 'upscale';
    return 'latest';
}

function renderRecognizeElements() {
    const has = state.elements.length > 0;
    $('recognizeCount').textContent = state.elements.length + ' 个';
    $('recognizeBtn').disabled = !has;

    const list = $('recognizeList');
    if (!list) return;
    list.innerHTML = '';
    list.className = 'elements-container recognize-grid';

    const purpose = recognizeImagePurpose();
    state.elements.forEach((el) => {
        const imgSrc = getElementImage(el, purpose);
        const div = document.createElement('div');
        div.className = 'elem-card' + (isSelected(state.selection, 'recognize', el.id) ? ' selected' : '');
        div.dataset.index = el.index;
        div.dataset.id = el.id;

        const label = el.recognition?.label;
        const confidence = el.recognition?.confidence;
        let labelHtml = '';
        if (label) {
            const conf = confidence ? ' (' + Math.round(confidence * 100) + '%)' : '';
            labelHtml = '<span class="recognize-label" title="' + label + conf + '">' + label + conf + '</span>';
        }

        div.innerHTML = '<img src="' + imgSrc + '"><span class="num">' + el.index + '</span>' + labelHtml;

        div.addEventListener('click', e => {
            if (e.shiftKey) {
                setSelected(state.selection, 'recognize', el.id, true);
            } else {
                setOnlySelected(state.selection, 'recognize', el.id);
            }
            renderRecognizeElements();
        });

        div.addEventListener('dblclick', () => openModal(getElementImage(el, purpose)));
        list.appendChild(div);
    });

    updateBadges();
    updateElementDetail('recognize', state.elements);
}

function updateRecognizeModelInfo() {
    const desc = $('recognizeModelDesc');
    if (desc) {
        desc.textContent = 'SigLIP/CLIP 零样本分类，使用内置标签库，也可输入自定义标签';
    }
    const customLabels = $('customLabelsSection');
    if (customLabels) customLabels.classList.remove('hidden');
}
updateRecognizeModelInfo();

$('recognizeInputSource')?.addEventListener('change', renderRecognizeElements);

$('recognizeModel')?.addEventListener('change', e => {
    recognizeState.model = e.target.value;
    updateRecognizeModelInfo();
});

$('recognizeBtn')?.addEventListener('click', async () => {
    const selected = getTabSelected('recognize');
    if (!selected.length) { showToast('请先选择元素', 'error'); return; }

    $('recognizeBtn').disabled = true;
    $('recognizeProgress').style.display = 'flex';
    setStatus('识别中...', true);

    const model = recognizeState.model;
    const labels = $('customLabelsInput')?.value || null;
    const purpose = recognizeImagePurpose();

    let successCount = 0;
    const total = selected.length;

    for (let i = 0; i < selected.length; i++) {
        const el = selected[i];
        $('recognizeProgressText').textContent = '处理中 (' + (i + 1) + '/' + total + ')...';
        setStatus('识别中 (' + (i + 1) + '/' + total + ')...', true);

        try {
            const src = getElementImage(el, purpose);
            const blob = await fetch(src).then(r => r.blob());
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
            el.recognition.label = data.best_label;
            el.recognition.confidence = data.best_confidence;
            el.recognition.model = model;
            successCount++;
        } catch (err) {
            console.error('识别失败:', err);
        }
    }

    uniqueNamesFromLabels(selected);
    renderAllElementViews();
    $('recognizeBtn').disabled = false;
    $('applyNamesBtn').disabled = false;
    $('recognizeProgress').style.display = 'none';
    setStatus('识别完成: ' + successCount + '/' + total);
    showToast('识别完成 ' + successCount + '/' + total + ' 个');
});

$('applyNamesBtn')?.addEventListener('click', () => {
    const items = state.elements.filter(e => e.recognition?.label);
    if (!items.length) { showToast('没有识别结果', 'error'); return; }
    uniqueNamesFromLabels(items);
    renderAllElementViews();
    showToast('已应用名称');
});

$('selectRecognizeAll')?.addEventListener('click', () => {
    selectAll(state.selection, 'recognize', state.elements);
    renderRecognizeElements();
});

$('deselectRecognizeAll')?.addEventListener('click', () => {
    clearSelection(state.selection, 'recognize');
    renderRecognizeElements();
});
