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
            state.splitElements = [];
            state.splitImageId = null;
            state.splitImageSize = null;
            $('splitImage').classList.add('hidden');
            show($('uploadZone'));
            hide($('splitBar'));
            $('toolbar').style.display = 'none';
            const overlay = $('overlayCanvas');
            if (overlay) { overlay.width = 0; overlay.height = 0; }
            renderSplitElements();
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
                autoDetect();
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
            
            autoDetect();
            setStatus('已重置为默认参数');
        });
        
        // 检测
        let detectTimer = null;
        function autoDetect() { if (!state.splitImageId) return; clearTimeout(detectTimer); detectTimer = setTimeout(runDetection, 300); }
        
        let isDetecting = false;
        async function runDetection() {
            if (!state.splitImageId || isDetecting) return;
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
                state.splitElements = (data.elements || []).map(el => ({ ...el, selected: true }));
                renderSplitElements();
                setStatus('找到 ' + data.count + ' 个元素');
            } catch (err) { setStatus(err.message, false, true); }
            finally { isDetecting = false; }
        }
        
        function renderSplitElements() {
            const has = state.splitElements.length > 0;
            $('splitBar').classList.toggle('hidden', !has);
            $('splitCount').textContent = state.splitElements.length + ' 个';
            
            const list = $('splitList');
            list.innerHTML = '';
            
            state.splitElements.forEach((el, i) => {
                const div = document.createElement('div');
                div.className = 'elem-card' + (el.selected ? ' selected' : '');
                div.dataset.index = el.index;
                div.innerHTML = '<img src="' + el.preview + '"><span class="num">' + el.index + '</span><button class="card-delete" title="删除">×</button>';
                div.addEventListener('click', e => {
                    if (e.target.classList.contains('card-delete')) return;
                    if (e.shiftKey) {
                        // Shift+点击：追加选中
                        el.selected = true;
                    } else {
                        // 普通单击：只选当前，取消其他
                        state.splitElements.forEach(x => x.selected = false);
                        el.selected = true;
                    }
                    renderSplitElements();
                });
                div.addEventListener('dblclick', e => {
                    if (e.target.classList.contains('card-delete')) return;
                    openModal(el.preview);
                });
                div.querySelector('.card-delete').addEventListener('click', e => {
                    e.stopPropagation();
                    state.splitElements.splice(i, 1);
                    renderSplitElements();
                });
                list.appendChild(div);
            });
            
            updateBadges();
            updateElementsLayout();
            drawOverlay();
            updateElementDetail('split', state.splitElements);
        }
        
        $('selectSplitAll').addEventListener('click', () => { state.splitElements.forEach(e => e.selected = true); renderSplitElements(); });
        $('deselectSplitAll').addEventListener('click', () => { state.splitElements.forEach(e => e.selected = false); renderSplitElements(); });
        
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
            let source;
            if (panel === 'remove') {
                // 抠图 tab 只导出已处理的
                source = state.removeElements.filter(e => e.processed);
            } else {
                const selected = state.splitElements.filter(e => e.selected);
                source = selected.length ? selected : state.splitElements;
            }
            
            if (!source.length) { showToast('没有可导出的元素', 'error'); return; }
            
            // 超过 3 个确认
            if (source.length > 3) {
                const ok = await showDialog('导出确认', `即将导出 ${source.length} 个元素，是否继续？`);
                if (!ok) return;
            }
            
            const imgKey = panel === 'remove' ? 'result' : 'preview';
            
            if (format === 'png') {
                // 单个 PNG
                for (const el of source) {
                    const a = document.createElement('a');
                    a.href = el[imgKey];
                    a.download = 'element_' + el.index + '.png';
                    a.click();
                    await new Promise(r => setTimeout(r, 200));
                }
                showToast('已导出 ' + source.length + ' 个 PNG', 'success');
            } else if (format === 'zip') {
                // ZIP
                showToast('正在打包...', '');
                const elementsData = source.map(el => ({
                    name: 'element_' + el.index + '.png',
                    base64: el[imgKey]
                }));
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
                    name: 'Element ' + el.index,
                    base64: el[imgKey],
                    x: useBbox ? (el.bbox ? el.bbox[0] : 0) : 0,
                    y: useBbox ? (el.bbox ? el.bbox[1] : 0) : 0
                }));
                
                // 获取画布尺寸
                let canvasW, canvasH;
                if (panel === 'split' && useBbox && state.splitImageSize) {
                    // 切分 tab 用原图尺寸
                    canvasW = state.splitImageSize.w;
                    canvasH = state.splitImageSize.h;
                } else {
                    // 抠图 tab 或左上对齐：用第一张图尺寸
                    const firstImg = new Image();
                    firstImg.src = source[0][imgKey];
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
        
        $('sendBtn').addEventListener('click', () => {
            const sel = state.splitElements.filter(e => e.selected);
            if (!sel.length) { setStatus('请先选择元素', false, true); return; }
            
            state.removeElements = sel.map(el => ({
                index: el.index,
                preview: el.preview,
                selected: true,
                processed: false,
                result: null
            }));
            
            renderRemoveElements();
            document.querySelector('.tab[data-panel="remove"]').click();
            setStatus('已发送 ' + sel.length + ' 个元素');
        });
        
