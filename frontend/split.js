        // ============ 切分面板 ============
        
        // 加载示例
        $('loadExampleBtn').addEventListener('click', async e => {
            e.stopPropagation();
            setStatus('加载示例...', true);
            try {
                const res = await fetch('/example.png');
                const blob = await res.blob();
                uploadImage(new File([blob], 'example.png', { type: 'image/png' }));
            } catch { setStatus('加载失败', false, true); }
        });
        
        // 上传
        $('uploadZone').addEventListener('click', () => $('fileInput').click());
        $('uploadZone').addEventListener('dragover', e => { e.preventDefault(); e.currentTarget.classList.add('dragover'); });
        $('uploadZone').addEventListener('dragleave', e => e.currentTarget.classList.remove('dragover'));
        $('uploadZone').addEventListener('drop', e => { e.preventDefault(); e.currentTarget.classList.remove('dragover'); if (e.dataTransfer.files[0]) uploadImage(e.dataTransfer.files[0]); });
        $('fileInput').addEventListener('change', e => { if (e.target.files[0]) uploadImage(e.target.files[0]); });
        
        // 换图按钮 - 重置状态并触发文件选择
        $('splitReupload').addEventListener('click', () => {
            state.elements = [];
            state.selection = window.ElementModel.createSelectionState();
            state.splitImageId = null;
            state.splitImageSize = null;
            state.splitHasManualEdits = false;
            $('splitImage').classList.add('hidden');
            show($('uploadZone'));
            hide($('splitBar'));
            $('toolbar').style.display = 'none';
            const overlay = $('overlayCanvas');
            if (overlay) { overlay.width = 0; overlay.height = 0; }
            renderAllElementViews();
            $('fileInput').click();
        });
        
        async function uploadImage(file) {
            setStatus('上传中...', true);
            const fd = new FormData(); fd.append('file', file);
            try {
                const res = await fetch(API + '/api/upload', { method: 'POST', body: fd });
                if (!res.ok) throw new Error('上传失败');
                const data = await res.json();
                state.splitImageId = data.image_id;
                state.splitImageSize = { w: data.width, h: data.height };
                state.splitHasManualEdits = false;
                $('splitImage').src = data.preview;
                show($('splitImage')); hide($('uploadZone'));
                $('toolbar').style.display = 'flex';
                setStatus(data.filename + ' (' + data.width + '×' + data.height + ')');
                runDetection();
            } catch (err) { setStatus(err.message, false, true); }
        }
        
        // 参数
        document.querySelectorAll('#panel-split .range').forEach(slider => {
            const val = $('v_' + slider.id);
            if (val) slider.addEventListener('input', () => { val.textContent = slider.value; autoDetect(); });
        });
        
        $('detectMethod').addEventListener('change', e => {
            const m = e.target.value;
            $('secSmart').classList.toggle('hidden', m !== 'smart');
            $('secCanny').classList.toggle('hidden', m !== 'canny');
            $('secFlood').classList.toggle('hidden', m !== 'flood');
            autoDetect();
        });
        
        $('smartMode').addEventListener('change', autoDetect);
        
        // 预设
        document.querySelectorAll('.preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const P = {
                    sticker: { method: 'smart', smartMode: 'color', sensitivity: 60, minArea: 300, mergeDist: 30 },
                    sprite: { method: 'canny', gaussSigma: 1.0, threshold1: 50, threshold2: 150, closeIter: 2, dilateIter: 2, minArea: 200, mergeDist: 15 },
                    handdrawn: { method: 'smart', smartMode: 'edge', sensitivity: 40, minArea: 800, mergeDist: 25 },
                    solid: { method: 'flood', floodTol: 50, minArea: 300 }
                };
                const p = P[btn.dataset.p]; if (!p) return;
                $('detectMethod').value = p.method;
                $('detectMethod').dispatchEvent(new Event('change'));
                for (const [k, v] of Object.entries(p)) {
                    if (k === 'method') continue;
                    const el = $(k); if (el) { el.value = v; const val = $('v_' + k); if (val) val.textContent = v; }
                }
                autoDetect(true);
            });
        });
        
        // 重置按钮
        $('resetBtn').addEventListener('click', () => {
            const method = $('detectMethod').value;
            const defaults = {
                smart: { smartMode: 'auto', sensitivity: 50, minArea: 500, mergeDist: 20 },
                canny: { gaussSigma: 1.0, threshold1: 50, threshold2: 150, closeIter: 1, dilateIter: 1, minArea: 500, mergeDist: 20 },
                flood: { floodTol: 30, minArea: 500 }
            };
            
            const d = defaults[method];
            if (!d) return;
            
            for (const [k, v] of Object.entries(d)) {
                const el = $(k);
                if (el) {
                    el.value = v;
                    const val = $('v_' + k);
                    if (val) val.textContent = v;
                }
            }
            
            autoDetect(true);
            setStatus('已重置为默认参数');
        });
        
        // 检测
        let detectTimer = null;
        function autoDetect(force = false) {
            if (!state.splitImageId) return;
            if (state.splitHasManualEdits && !force) {
                setStatus('已保留人工编辑；使用预设或重置可重新检测');
                return;
            }
            clearTimeout(detectTimer);
            detectTimer = setTimeout(() => runDetection(force), 300);
        }
        
        let isDetecting = false;
        async function runDetection(force = false) {
            if (!state.splitImageId || isDetecting) return;
            if (state.splitHasManualEdits && !force) {
                setStatus('已保留人工编辑；未自动覆盖检测结果');
                return;
            }
            isDetecting = true;
            setStatus('检测中...', true);
            
            const method = $('detectMethod').value;
            const fd = new FormData();
            fd.append('image_id', state.splitImageId);
            fd.append('method', method);
            
            // 通用参数
            fd.append('crop_padding', $('padding').value);
            
            if (method === 'smart') {
                fd.append('smart_mode', $('smartMode').value);
                fd.append('sensitivity', $('sensitivity').value);
                fd.append('min_area', $('minArea').value);
                fd.append('merge_distance', $('mergeDist').value);
            } else if (method === 'canny') {
                fd.append('gauss_sigma', $('gaussSigma').value);
                fd.append('threshold1', $('threshold1').value);
                fd.append('threshold2', $('threshold2').value);
                fd.append('close_iter', $('closeIter').value);
                fd.append('dilate_iter', $('dilateIter').value);
                fd.append('min_area', $('minArea').value);
                fd.append('merge_distance', $('mergeDist').value);
            } else if (method === 'flood') {
                fd.append('flood_tolerance', $('floodTol').value);
                fd.append('min_area', $('minArea').value);
            }
            
            try {
                const res = await fetch(API + '/api/detect', { method: 'POST', body: fd });
                if (!res.ok) throw new Error('检测失败');
                const data = await res.json();
                $('splitImage').src = data.preview;
                state.elements = (data.elements || []).map((el, i) => createElementFromSplit(el, i, {
                    sourceImageId: state.splitImageId,
                    sourceImageSize: state.splitImageSize,
                }));
                state.selection = window.ElementModel.createSelectionState();
                selectAll(state.selection, 'split', state.elements);
                state.splitHasManualEdits = false;
                renderAllElementViews();
                setStatus('找到 ' + data.count + ' 个元素');
                showToast('检测到 ' + data.count + ' 个元素', 'success');
            } catch (err) { setStatus(err.message, false, true); }
            finally { isDetecting = false; }
        }
        
        function renderSplitElements() {
            const has = state.elements.length > 0;
            $('splitBar').classList.toggle('hidden', !has);
            $('splitCount').textContent = state.elements.length + ' 个';
            
            const list = $('splitList');
            list.innerHTML = '';
            
            state.elements.forEach((el, i) => {
                const div = document.createElement('div');
                const selected = isSelected(state.selection, 'split', el.id);
                div.className = 'elem-card' + (selected ? ' selected' : '');
                div.dataset.index = el.index;
                div.dataset.id = el.id;
                div.innerHTML = '<img src="' + getElementImage(el, 'split') + '"><span class="num">' + el.index + '</span><button class="card-delete" title="删除">×</button>';
                div.addEventListener('click', e => {
                    if (e.target.classList.contains('card-delete')) return;
                    if (e.shiftKey) {
                        setSelected(state.selection, 'split', el.id, true);
                    } else {
                        setOnlySelected(state.selection, 'split', el.id);
                    }
                    renderSplitElements();
                });
                div.addEventListener('dblclick', e => {
                    if (e.target.classList.contains('card-delete')) return;
                    openModal(getElementImage(el, 'split'));
                });
                div.querySelector('.card-delete').addEventListener('click', e => {
                    e.stopPropagation();
                    state.elements.splice(i, 1);
                    reindexElements(state.elements);
                    pruneSelections(state.selection, state.elements);
                    state.splitHasManualEdits = true;
                    renderAllElementViews();
                });
                list.appendChild(div);
            });
            
            updateBadges();
            updateElementsLayout();
            drawOverlay();
            updateElementDetail('split', state.elements);
        }
        
        $('selectSplitAll').addEventListener('click', () => { selectAll(state.selection, 'split', state.elements); renderSplitElements(); updateBadges(); });
        $('deselectSplitAll').addEventListener('click', () => { clearSelection(state.selection, 'split'); renderSplitElements(); updateBadges(); });
        
        // 切分导出 - 下拉菜单
        $('splitExport').addEventListener('click', e => {
            e.stopPropagation();
            $('splitExportMenu').classList.toggle('hidden');
        });
        document.addEventListener('click', () => hide($('splitExportMenu')));
        
        // 选择 PSD 时显示布局选项
        $('splitExportMenu').addEventListener('click', async e => {
            const btn = e.target.closest('button[data-format]');
            if (!btn) return;
            hide($('splitExportMenu'));
            const format = btn.dataset.format;
            
            // PSD 时显示布局选项
            $('splitPsdLayout').classList.toggle('hidden', format !== 'psd');
            
            await doExport('split', format);
        });
        
        async function doExport(panel, format) {
            const selected = getTabSelected(panel);
            const source = selected.length ? selected : state.elements;
            
            if (!source.length) { showToast('没有可导出的元素', 'error'); return; }
            
            // 超过 3 个确认
            if (source.length > 3) {
                const ok = await showDialog('导出确认', `即将导出 ${source.length} 个元素，是否继续？`);
                if (!ok) return;
            }
            
            const exportModeEl = $(panel + 'ExportSource');
            const exportMode = exportModeEl ? exportModeEl.value : panel === 'split' ? 'split' : 'latest';
            const imagePurpose = exportMode === 'split' ? 'export-split'
                : exportMode === 'remove' ? 'export-remove'
                : exportMode === 'upscale' ? 'export-upscale'
                : 'export-latest';
            
            if (format === 'png') {
                // 单个 PNG
                for (const el of source) {
                    const image = getElementImage(el, imagePurpose);
                    if (!image) continue;
                    const a = document.createElement('a');
                    a.href = image;
                    a.download = (el.name || ('element_' + el.index)) + '.png';
                    a.click();
                    await new Promise(r => setTimeout(r, 200));
                }
                showToast('已导出 ' + source.length + ' 个 PNG', 'success');
            } else if (format === 'zip') {
                // ZIP
                showToast('正在打包...', '');
                const elementsData = source.map(el => ({
                    name: (el.name || ('element_' + el.index)) + '.png',
                    base64: getElementImage(el, imagePurpose)
                })).filter(el => el.base64);
                const fd = new FormData();
                fd.append('elements_json', JSON.stringify(elementsData));
                const resp = await fetch(API + '/api/export_zip_from_elements', { method: 'POST', body: fd });
                if (!resp.ok) { showToast('导出失败', 'error'); return; }
                const blob = await resp.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'elements.zip'; a.click();
                URL.revokeObjectURL(url);
                showToast('已导出 ZIP', 'success');
            } else if (format === 'psd') {
                // PSD
                showToast('正在生成 PSD...', '');
                const posMode = panel === 'split'
                    ? document.querySelector('input[name="splitPsdPos"]:checked')?.value
                    : document.querySelector('input[name="removePsdPos"]:checked')?.value;
                const useBbox = posMode === 'bbox';
                
                const elementsData = source.map(el => ({
                    name: el.name || ('Element ' + el.index),
                    base64: getElementImage(el, imagePurpose),
                    x: useBbox ? (el.bbox ? el.bbox[0] : 0) : 0,
                    y: useBbox ? (el.bbox ? el.bbox[1] : 0) : 0
                })).filter(el => el.base64);
                
                // 获取画布尺寸
                let canvasW, canvasH;
                const sourceImageSize = source.find(el => el.sourceImageSize)?.sourceImageSize;
                if (useBbox && (state.splitImageSize || sourceImageSize)) {
                    // 按位置导出时用原图尺寸，跨面板结果也沿用来源画布
                    const size = panel === 'split' ? state.splitImageSize : sourceImageSize;
                    canvasW = size.w;
                    canvasH = size.h;
                } else {
                    // 抠图 tab 或左上对齐：用第一张图尺寸
                    const firstImg = new Image();
                    firstImg.src = elementsData[0].base64;
                    await new Promise(r => firstImg.onload = r);
                    canvasW = firstImg.naturalWidth;
                    canvasH = firstImg.naturalHeight;
                }
                
                const fd = new FormData();
                fd.append('elements_json', JSON.stringify(elementsData));
                fd.append('canvas_width', canvasW);
                fd.append('canvas_height', canvasH);
                const resp = await fetch(API + '/api/export_psd_from_elements', { method: 'POST', body: fd });
                if (!resp.ok) { showToast('导出失败', 'error'); return; }
                const blob = await resp.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'elements.psd'; a.click();
                URL.revokeObjectURL(url);
                showToast('已导出 PSD', 'success');
            }
        }
        window.doExport = doExport;
        
