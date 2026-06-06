        // ============ 抠图面板 ============
        
        // 画布状态
        const canvasState = {
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            isDragging: false,
            lastX: 0,
            lastY: 0,
            currentImage: null,
            currentElement: null
        };
        
        // 在画布上显示图片
        function showOnCanvas(src, element = null) {
            const canvas = $('removeCanvas');
            const container = $('canvasContainer');
            if (!canvas || !container) return;
            
            canvasState.currentImage = src;
            if (element) canvasState.currentElement = element;
            
            const img = new Image();
            img.onload = () => {
                const containerW = container.offsetWidth;
                const containerH = container.offsetHeight;
                const padding = 40;
                
                const scaleX = (containerW - padding) / img.width;
                const scaleY = (containerH - padding) / img.height;
                canvasState.scale = Math.min(scaleX, scaleY, 1);
                canvasState.offsetX = 0;
                canvasState.offsetY = 0;
                
                canvas.width = img.width;
                canvas.height = img.height;
                canvas.style.width = img.width + 'px';
                canvas.style.height = img.height + 'px';
                
                drawCanvas(img);
            };
            img.src = src;
            
            // 显示画布和工具栏，隐藏空状态
            container.style.display = 'block';
            $('removeToolbar').style.display = 'flex';
            $('removeEmpty').classList.add('hidden');
            updateCanvasBackground();
            updateCanvasCursor();
        }
        
        // 眼睛功能 - 按住查看原图，松开显示抠图结果（保持缩放状态）
        let showingOriginal = false;
        let savedScale = 1, savedOffsetX = 0, savedOffsetY = 0;
        
        function showOriginal() {
            if (!canvasState.currentElement?.processed || showingOriginal) return;
            showingOriginal = true;
            $('eyeBtn')?.classList.add('active');
            
            // 保存当前缩放状态
            savedScale = canvasState.scale;
            savedOffsetX = canvasState.offsetX;
            savedOffsetY = canvasState.offsetY;
            
            // 加载原图但保持缩放
            const img = new Image();
            img.onload = () => {
                const canvas = $('removeCanvas');
                if (!canvas) return;
                canvas.width = img.width;
                canvas.height = img.height;
                canvas.style.width = img.width + 'px';
                canvas.style.height = img.height + 'px';
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0);
                canvas.style.transform = `translate(calc(-50% + ${savedOffsetX}px), calc(-50% + ${savedOffsetY}px)) scale(${savedScale})`;
            };
            img.src = canvasState.currentElement.preview;
        }
        
        function hideOriginal() {
            if (!showingOriginal) return;
            showingOriginal = false;
            $('eyeBtn')?.classList.remove('active');
            if (canvasState.currentElement) {
                // 恢复抠图结果，保持缩放状态
                const img = new Image();
                img.onload = () => {
                    const canvas = $('removeCanvas');
                    if (!canvas) return;
                    canvas.width = img.width;
                    canvas.height = img.height;
                    canvas.style.width = img.width + 'px';
                    canvas.style.height = img.height + 'px';
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    ctx.drawImage(img, 0, 0);
                    canvas.style.transform = `translate(calc(-50% + ${savedOffsetX}px), calc(-50% + ${savedOffsetY}px)) scale(${savedScale})`;
                };
                img.src = canvasState.currentElement.result;
            }
        }
        $('eyeBtn')?.addEventListener('mousedown', showOriginal);
        $('eyeBtn')?.addEventListener('mouseup', hideOriginal);
        $('eyeBtn')?.addEventListener('mouseleave', hideOriginal);
        document.addEventListener('keydown', e => { if (e.key === 'v' || e.key === 'V') showOriginal(); });
        document.addEventListener('keyup', e => { if (e.key === 'v' || e.key === 'V') hideOriginal(); });
        
        // 橡皮擦功能
        let isErasing = false;
        let eraserMode = 'erase'; // 'erase' or 'restore'
        let eraserSize = 20;
        let originalImageData = null; // 保存原始图片数据用于恢复
        
        $('eraserBtn')?.addEventListener('click', () => {
            isErasing = !isErasing;
            if (isErasing) {
                // 切换模式：擦除 <-> 恢复
                eraserMode = eraserMode === 'erase' ? 'restore' : 'erase';
                $('eraserModeLabel').textContent = eraserMode === 'erase' ? '擦除' : '恢复';
            }
            $('eraserBtn').classList.toggle('active', isErasing);
            updateCanvasCursor();
            // 保存原始图片用于恢复
            if (isErasing) saveOriginalImage();
        });
        
        // 右键切换模式
        $('canvasContainer')?.addEventListener('contextmenu', e => {
            e.preventDefault();
            if (isErasing) {
                eraserMode = eraserMode === 'erase' ? 'restore' : 'erase';
                $('eraserModeLabel').textContent = eraserMode === 'erase' ? '擦除' : '恢复';
                updateCanvasCursor();
            }
        });
        
        $('eraserSize')?.addEventListener('input', e => { eraserSize = parseInt(e.target.value); });
        
        function updateCanvasCursor() {
            const container = $('canvasContainer');
            if (!container) return;
            if (isErasing) {
                const color = eraserMode === 'erase' ? 'red' : 'green';
                const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${eraserSize}" height="${eraserSize}" viewBox="0 0 ${eraserSize} ${eraserSize}"><circle cx="${eraserSize/2}" cy="${eraserSize/2}" r="${eraserSize/2 - 1}" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`;
                container.style.cursor = `url('data:image/svg+xml;base64,${btoa(svg)}') ${eraserSize/2} ${eraserSize/2}, crosshair`;
            } else {
                container.style.cursor = 'grab';
            }
        }
        
        // 保存原始图片数据（使用抠图结果作为"原始"数据，用于恢复）
        function saveOriginalImage() {
            if (!canvasState.currentElement) return;
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0);
                originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            };
            img.src = canvasState.currentElement.result || canvasState.currentElement.preview;
        }
        
        function eraseAtPosition(x, y) {
            if (!canvasState.currentElement) return;
            const canvas = $('removeCanvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            const radius = eraserSize / 2 / canvasState.scale;
            
            if (eraserMode === 'erase') {
                // 擦除模式
                ctx.save();
                ctx.globalCompositeOperation = 'destination-out';
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            } else {
                // 恢复模式：从原始图片恢复
                if (!originalImageData) saveOriginalImage();
                if (!originalImageData) return;
                
                const cx = Math.round(x);
                const cy = Math.round(y);
                const r = Math.round(radius);
                
                // 获取当前图片数据
                const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                
                // 在圆形区域内恢复原始像素
                for (let dy = -r; dy <= r; dy++) {
                    for (let dx = -r; dx <= r; dx++) {
                        if (dx*dx + dy*dy <= r*r) {
                            const px = cx + dx;
                            const py = cy + dy;
                            if (px >= 0 && px < canvas.width && py >= 0 && py < canvas.height) {
                                const idx = (py * canvas.width + px) * 4;
                                currentData.data[idx] = originalImageData.data[idx];
                                currentData.data[idx+1] = originalImageData.data[idx+1];
                                currentData.data[idx+2] = originalImageData.data[idx+2];
                                currentData.data[idx+3] = originalImageData.data[idx+3];
                            }
                        }
                    }
                }
                
                ctx.putImageData(currentData, 0, 0);
            }
            
            canvasState.currentElement.result = canvas.toDataURL('image/png');
        }
        
        // 归位功能
        function resetRemoveView() {
            const canvas = $('removeCanvas');
            const container = $('canvasContainer');
            if (!canvas || !container || !canvasState.currentImage) return;
            const img = new Image();
            img.onload = () => {
                const containerW = container.offsetWidth;
                const containerH = container.offsetHeight;
                const padding = 40;
                const scaleX = (containerW - padding) / img.width;
                const scaleY = (containerH - padding) / img.height;
                canvasState.scale = Math.min(scaleX, scaleY, 1);
                canvasState.offsetX = 0;
                canvasState.offsetY = 0;
                drawCanvas(img);
            };
            img.src = canvasState.currentImage;
        }
        $('resetViewBtn')?.addEventListener('click', resetRemoveView);
        document.addEventListener('keydown', e => { if ((e.key === 'r' || e.key === 'R') && state.currentTab === 'remove') resetRemoveView(); });
        
        // 背景色切换
        let bgMode = 'checker';
        let customColor = '#808080';
        document.querySelectorAll('[data-bg]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-bg]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                bgMode = btn.dataset.bg;
                updateCanvasBackground();
            });
        });
        
        // 自定义颜色
        $('customBgColor')?.addEventListener('input', e => {
            customColor = e.target.value;
            document.querySelectorAll('[data-bg]').forEach(b => b.classList.remove('active'));
            bgMode = 'custom';
            updateCanvasBackground();
        });
        function updateCanvasBackground() {
            const container = $('canvasContainer');
            if (!container) return;
            
            // 保存基础样式
            const baseStyle = 'position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;cursor:grab;z-index:5;';
            
            switch (bgMode) {
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
                    container.style.cssText = baseStyle + 'background-color:' + customColor + ';';
                    break;
            }
        }
        
        function drawCanvas(img) {
            const canvas = $('removeCanvas');
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            // 清除画布为透明
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // 确保 canvas 背景透明
            canvas.style.backgroundColor = 'transparent';
            // 绘制图片
            ctx.drawImage(img, 0, 0);
            
            canvas.style.transform = `translate(calc(-50% + ${canvasState.offsetX}px), calc(-50% + ${canvasState.offsetY}px)) scale(${canvasState.scale})`;
        }
        
        // 画布缩放
        $('canvasContainer')?.addEventListener('wheel', e => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            canvasState.scale = Math.max(0.1, Math.min(10, canvasState.scale * delta));
            const canvas = $('removeCanvas');
            if (canvas) {
                canvas.style.transform = `translate(calc(-50% + ${canvasState.offsetX}px), calc(-50% + ${canvasState.offsetY}px)) scale(${canvasState.scale})`;
            }
        });
        
        // 空格键临时切换到拖拽模式
        let spacePressed = false;
        document.addEventListener('keydown', e => {
            if (e.code === 'Space' && !spacePressed) {
                spacePressed = true;
                canvasState.tempDrag = true;
                $('canvasContainer').style.cursor = 'grab';
            }
        });
        document.addEventListener('keyup', e => {
            if (e.code === 'Space') {
                spacePressed = false;
                canvasState.tempDrag = false;
                updateCanvasCursor();
            }
        });
        
        // 画布交互
        let isErasingActive = false;
        $('canvasContainer')?.addEventListener('mousedown', e => {
            if (e.target.closest('.toolbar')) return;
            
            // 吸管取色模式
            if (canvasState.isColorPickMode) {
                const canvas = $('removeCanvas');
                if (canvas) {
                    const rect = canvas.getBoundingClientRect();
                    const x = Math.round((e.clientX - rect.left) / canvasState.scale);
                    const y = Math.round((e.clientY - rect.top) / canvasState.scale);
                    // 触发吸管抠图
                    pickColorAndRemove(x, y);
                }
                return;
            }
            
            // 空格键或非橡皮擦模式：拖拽
            if (canvasState.tempDrag || !isErasing) {
                canvasState.isDragging = true;
                canvasState.lastX = e.clientX;
                canvasState.lastY = e.clientY;
            } else {
                isErasingActive = true;
                const canvas = $('removeCanvas');
                if (canvas) {
                    const rect = canvas.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / canvasState.scale;
                    const y = (e.clientY - rect.top) / canvasState.scale;
                    eraseAtPosition(x, y);
                }
            }
        });
        
        document.addEventListener('mousemove', e => {
            if (isErasingActive && !canvasState.tempDrag) {
                const canvas = $('removeCanvas');
                if (canvas) {
                    const rect = canvas.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / canvasState.scale;
                    const y = (e.clientY - rect.top) / canvasState.scale;
                    eraseAtPosition(x, y);
                }
                return;
            }
            if (!canvasState.isDragging) return;
            const dx = e.clientX - canvasState.lastX;
            const dy = e.clientY - canvasState.lastY;
            canvasState.offsetX += dx;
            canvasState.offsetY += dy;
            canvasState.lastX = e.clientX;
            canvasState.lastY = e.clientY;
            const canvas = $('removeCanvas');
            if (canvas) {
                canvas.style.transform = `translate(calc(-50% + ${canvasState.offsetX}px), calc(-50% + ${canvasState.offsetY}px)) scale(${canvasState.scale})`;
            }
        });
        
        document.addEventListener('mouseup', () => {
            canvasState.isDragging = false;
            isErasingActive = false;
        });
        
        $('uploadElemBtn').addEventListener('click', () => $('elemInput').click());
        $('elemInput').addEventListener('change', e => {
            Array.from(e.target.files).forEach(file => {
                const reader = new FileReader();
                reader.onload = () => {
                    state.removeElements.push({ index: state.removeElements.length + 1, preview: reader.result, selected: true, processed: false, result: null });
                    renderRemoveElements();
                };
                reader.readAsDataURL(file);
            });
        });
        
        $('selectRemAll').addEventListener('click', () => { state.removeElements.forEach(e => e.selected = true); renderRemoveElements(); });
        $('deselectRemAll').addEventListener('click', () => { state.removeElements.forEach(e => e.selected = false); renderRemoveElements(); });
        
        // 换图按钮 - 清空并上传新图片
        $('removeReupload').addEventListener('click', () => {
            state.removeElements = [];
            canvasState.currentElement = null;
            canvasState.currentImage = null;
            const canvas = $('removeCanvas');
            if (canvas) {
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            renderRemoveElements();
            $('elemInput').click();
        });
        
        $('removeMethod').addEventListener('change', e => {
            const m = e.target.value;
            $('secRembg').classList.toggle('hidden', m === 'flood' || m === 'color_pick');
            $('secRemFlood').classList.toggle('hidden', m !== 'flood' && m !== 'combined' && m !== 'color_pick');
            // 吸管取色模式
            if (m === 'color_pick') {
                canvasState.isColorPickMode = true;
                $('canvasContainer').style.cursor = 'crosshair';
            } else {
                canvasState.isColorPickMode = false;
                if (!isErasing) $('canvasContainer').style.cursor = 'grab';
            }
        });
        
        $('remFloodTol').addEventListener('input', e => $('v_remFloodTol').textContent = e.target.value);
        
        function renderRemoveElements() {
            const has = state.removeElements.length > 0;
            $('removeEmpty').classList.toggle('hidden', has);
            $('removeBar').classList.toggle('hidden', !has);
            $('removeCount').textContent = state.removeElements.length + ' 个';
            $('processBtn').disabled = !has;
            
            const list = $('removeList');
            list.innerHTML = '';
            
            state.removeElements.forEach((el, i) => {
                const div = document.createElement('div');
                div.className = 'elem-card' + (el.selected ? ' selected' : '');
                div.dataset.index = el.index;
                const imgSrc = el.processed ? el.result : el.preview;
                div.innerHTML = '<img src="' + imgSrc + '"><span class="num">' + el.index + '</span><button class="card-delete" title="删除">×</button>';
                div.addEventListener('click', e => {
                    if (e.target.classList.contains('card-delete')) return;
                    if (e.shiftKey) { el.selected = true; } else { el.selected = !el.selected; }
                    div.classList.toggle('selected', el.selected);
                    showOnCanvas(imgSrc, el);
                    updateBadges();
                });
                div.addEventListener('dblclick', e => {
                    if (e.target.classList.contains('card-delete')) return;
                    openModal(el.processed ? el.result : el.preview);
                });
                div.querySelector('.card-delete').addEventListener('click', e => {
                    e.stopPropagation();
                    state.removeElements.splice(i, 1);
                    renderRemoveElements();
                });
                list.appendChild(div);
            });
            
            renderRemoveResults();
            updateBadges();
            updateElementsLayout();
            
            // 默认显示第一个元素到画布
            if (has && !canvasState.currentImage) {
                const firstEl = state.removeElements[0];
                const imgSrc = firstEl.processed ? firstEl.result : firstEl.preview;
                showOnCanvas(imgSrc, firstEl);
                firstEl.selected = true;
                list.querySelector('.elem-card')?.classList.add('selected');
            }
        }
        
        function renderRemoveResults() {
            const processed = state.removeElements.filter(e => e.processed);
            const grid = $('removeResults');
            if (!processed.length) { hide(grid); return; }
            show(grid);
            grid.innerHTML = '';
            processed.forEach(el => {
                const card = document.createElement('div');
                card.className = 'result-card';
                card.innerHTML = '<img src="' + el.result + '"><div class="label">元素 ' + el.index + '</div>';
                card.addEventListener('click', () => openModal(el.result));
                grid.appendChild(card);
            });
            $('removeExport').disabled = false;
        }
        
        // 吸管取色抠图
        async function pickColorAndRemove(x, y) {
            const cur = canvasState.currentElement;
            if (!cur || !cur.processed) { setStatus('请先抠图再使用吸管', false, true); return; }
            
            setStatus('吸管抠图中...', true);
            
            try {
                // 重新上传当前元素
                const blob = await fetch(cur.preview).then(r => r.blob());
                const fd = new FormData(); fd.append('file', blob, 'el.png');
                const up = await (await fetch(API + '/api/upload', { method: 'POST', body: fd })).json();
                
                // 检测
                const df = new FormData();
                df.append('image_id', up.image_id); df.append('method', 'alpha'); df.append('alpha_threshold', '0');
                await fetch(API + '/api/detect', { method: 'POST', body: df });
                
                // 吸管抠图
                const rf = new FormData();
                rf.append('image_id', up.image_id);
                rf.append('method', 'color_pick');
                rf.append('flood_tolerance', $('remFloodTol').value);
                rf.append('click_x', x);
                rf.append('click_y', y);
                const rd = await (await fetch(API + '/api/remove_background', { method: 'POST', body: rf })).json();
                
                if (rd.results?.[0]) {
                    cur.processed = true;
                    cur.result = rd.results[0].preview;
                    showOnCanvas(cur.result, cur);
                    renderRemoveElements();
                    setStatus('吸管抠图完成');
                }
            } catch (err) {
                console.error('吸管抠图失败:', err);
                setStatus('吸管抠图失败', false, true);
            }
        }
        
        $('processBtn').addEventListener('click', async () => {
            const sel = state.removeElements.filter(e => e.selected);
            if (!sel.length) { setStatus('请先选择元素', false, true); return; }
            $('processBtn').disabled = true;
            setStatus('抠图中 (0/' + sel.length + ')...', true);
            
            const method = $('removeMethod').value;
            const model = $('rembgModel').value;
            const tol = $('remFloodTol').value;
            
            for (let i = 0; i < sel.length; i++) {
                setStatus('抠图中 (' + (i+1) + '/' + sel.length + ')...', true);
                try {
                    const blob = await fetch(sel[i].preview).then(r => r.blob());
                    const fd = new FormData(); fd.append('file', blob, 'el.png');
                    const up = await (await fetch(API + '/api/upload', { method: 'POST', body: fd })).json();
                    
                    const df = new FormData();
                    df.append('image_id', up.image_id); df.append('method', 'alpha'); df.append('alpha_threshold', '0');
                    await fetch(API + '/api/detect', { method: 'POST', body: df });
                    
                    const rf = new FormData();
                    rf.append('image_id', up.image_id);
                    rf.append('method', method);
                    rf.append('model', model);
                    rf.append('flood_tolerance', tol);
                    const rd = await (await fetch(API + '/api/remove_background', { method: 'POST', body: rf })).json();
                    
                    if (rd.results?.[0]) { sel[i].processed = true; sel[i].result = rd.results[0].preview; }
                } catch (err) { console.error('元素 ' + sel[i].index + ' 失败:', err); }
            }
            
            renderRemoveElements();
            
            // 更新画布显示当前元素的抠图结果
            if (canvasState.currentElement && canvasState.currentElement.processed) {
                showOnCanvas(canvasState.currentElement.result, canvasState.currentElement);
            }
            
            setStatus('完成，处理了 ' + sel.length + ' 个元素');
            $('processBtn').disabled = false;
            $('removeExport').disabled = false;
        });
        
        // 抠图导出 - 下拉菜单
        $('removeExport').addEventListener('click', e => {
            e.stopPropagation();
            $('removeExportMenu').classList.toggle('hidden');
        });
        document.addEventListener('click', () => hide($('removeExportMenu')));
        
        $('removeExportMenu').addEventListener('click', async e => {
            const btn = e.target.closest('button[data-format]');
            if (!btn) return;
            hide($('removeExportMenu'));
            const format = btn.dataset.format;
            
            // PSD 时显示布局选项
            $('removePsdLayout').classList.toggle('hidden', format !== 'psd');
            
            // 用 doExport（定义在 split.js）
            if (window.doExport) await window.doExport('remove', format);
        });
        
        // 元素条框选功能
        
        // 元素条框选功能
        function initElementsMarquee(containerId, elementsKey) {
            const container = $(containerId);
            if (!container) return;
            
            let active = false, startX, startY, altKey = false;
            let marquee = null;
            
            container.addEventListener('mousedown', e => {
                // 忽略点击在元素卡片上的情况
                if (e.target.closest('.elem-card')) return;
                
                e.preventDefault();
                active = true;
                altKey = e.altKey;
                startX = e.clientX + container.scrollLeft - container.getBoundingClientRect().left;
                startY = e.clientY + container.scrollTop - container.getBoundingClientRect().top;
                
                // 创建选框
                marquee = document.createElement('div');
                marquee.className = 'marquee';
                marquee.style.cssText = 'display:block;position:absolute;left:' + startX + 'px;top:' + startY + 'px;width:0;height:0;pointer-events:none;';
                container.appendChild(marquee);
            });
            
            container.addEventListener('mousemove', e => {
                if (!active || !marquee) return;
                e.preventDefault();
                
                const currentX = e.clientX + container.scrollLeft - container.getBoundingClientRect().left;
                const currentY = e.clientY + container.scrollTop - container.getBoundingClientRect().top;
                
                const x = Math.min(startX, currentX);
                const y = Math.min(startY, currentY);
                const w = Math.abs(currentX - startX);
                const h = Math.abs(currentY - startY);
                
                marquee.style.left = x + 'px';
                marquee.style.top = y + 'px';
                marquee.style.width = w + 'px';
                marquee.style.height = h + 'px';
            });
            
            container.addEventListener('mouseup', e => {
                if (!active || !marquee) return;
                active = false;
                
                const box = marquee.getBoundingClientRect();
                marquee.remove();
                marquee = null;
                
                if (box.width < 5 || box.height < 5) return;
                
                // 选中或取消选中框内的元素
                let count = 0;
                container.querySelectorAll('.elem-card').forEach(card => {
                    const cardRect = card.getBoundingClientRect();
                    if (intersects(box, cardRect)) {
                        const idx = parseInt(card.dataset.index);
                        const el = state[elementsKey].find(e => e.index === idx);
                        if (el) {
                            if (altKey) {
                                // Alt 键：减选
                                el.selected = false;
                                card.classList.remove('selected');
                            } else {
                                // 普通框选：选中
                                el.selected = true;
                                card.classList.add('selected');
                            }
                            count++;
                        }
                    }
                });
                
                if (count > 0) {
                    updateBadges();
                    setStatus(altKey ? '取消选中了 ' + count + ' 个元素' : '框选了 ' + count + ' 个元素');
                }
            });
            
            container.addEventListener('mouseleave', () => {
                if (active && marquee) {
                    active = false;
                    marquee.remove();
                    marquee = null;
                }
            });
            
            function intersects(a, b) {
                return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
            }
        }
        
        // 初始化元素条框选
        initElementsMarquee('splitList', 'splitElements');
        initElementsMarquee('removeList', 'removeElements');
        
        // 启动 ResizeObserver
        document.querySelectorAll('.elements-container').forEach(el => {
            resizeObserver.observe(el);
        });
        
        // 监听预览区域大小变化
        const splitPreview = $('splitPreview');
        if (splitPreview) {
            resizeObserver.observe(splitPreview);
        }
