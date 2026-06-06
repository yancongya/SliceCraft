        // ============ 切分面板 ============
        
        // 加载示例
        $('loadExampleBtn').addEventListener('click', async e => {
            e.stopPropagation();
            setStatus('加载示例...', true);
            try {
                const res = await fetch('/example/sticker-annotation-sheet.png');
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
        
        async function uploadImage(file) {
            setStatus('上传中...', true);
            const fd = new FormData(); fd.append('file', file);
            try {
                const res = await fetch(API + '/api/upload', { method: 'POST', body: fd });
                if (!res.ok) throw new Error('上传失败');
                const data = await res.json();
                state.splitImageId = data.image_id;
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
                    if (e.shiftKey) { el.selected = true; }
                    else { el.selected = !el.selected; }
                    div.classList.toggle('selected', el.selected);
                    updateBadges();
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
        }
        
        $('selectSplitAll').addEventListener('click', () => { state.splitElements.forEach(e => e.selected = true); renderSplitElements(); });
        $('deselectSplitAll').addEventListener('click', () => { state.splitElements.forEach(e => e.selected = false); renderSplitElements(); });
        
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
        
