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
                    const idx = state.removeElements.length + 1;
                    state.removeElements.push({ 
                        id: createElementId('remove'),
                        index: idx, 
                        preview: reader.result, 
                        selected: true, 
                        processed: false, 
                        result: null,
                        name: 'element_' + idx
                    });
                    reindexElements(state.removeElements);
                    renderRemoveElements();
                };
                reader.readAsDataURL(file);
            });
        });
        
        $('selectRemAll').addEventListener('click', () => { state.removeElements.forEach(e => e.selected = true); renderRemoveElements(); });
        $('deselectRemAll').addEventListener('click', () => { state.removeElements.forEach(e => e.selected = false); renderRemoveElements(); });
        
        // 从切分面板获取
        $('getFromSplitForRemove')?.addEventListener('click', () => {
            const selected = state.splitElements.filter(e => e.selected);
            if (!selected.length) { showToast('请先在切分面板选择元素', 'error'); return; }

            syncElementsToTarget(state.removeElements, selected, (el) => ({
                index: 0,
                preview: el.preview,
                selected: true,
                processed: false,
                result: null,
                name: el.name || ('element_' + el.index),
                sourceElementId: el.sourceElementId || el.id,
                sourceImageId: el.sourceImageId,
                sourceImageSize: el.sourceImageSize,
                bbox: el.bbox,
                rawPreview: el.rawPreview,
                type: el.type || null
            }));

            renderRemoveElements();
            showToast('已同步 ' + selected.length + ' 个元素');
        });
        
        // 添加按钮 - 追加新图片
        $('removeReupload').addEventListener('click', () => {
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
                    if (e.shiftKey) {
                        el.selected = true;
                    } else {
                        state.removeElements.forEach(x => x.selected = false);
                        el.selected = true;
                    }
                    showOnCanvas(imgSrc, el);
                    renderRemoveElements();
                });
                div.addEventListener('dblclick', e => {
                    if (e.target.classList.contains('card-delete')) return;
                    openModal(el.processed ? el.result : el.preview);
                });
                div.querySelector('.card-delete').addEventListener('click', e => {
                    e.stopPropagation();
                    state.removeElements.splice(i, 1);
                    reindexElements(state.removeElements);
                    renderRemoveElements();
                });
                list.appendChild(div);
            });
            
            renderRemoveResults();
            updateBadges();
            updateElementsLayout();
            updateElementDetail('remove', state.removeElements);
            
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
                // 重新上传当前元素；套索元素用原始 bbox 图取色，结果再回盖套索 mask
                const uploadSource = processingPreviewForElement(cur);
                const blob = await fetch(uploadSource).then(r => r.blob());
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
                    cur.result = await finalizeRemoveResult(cur, rd.results[0].preview, $('remFloodTol').value);
                    showOnCanvas(cur.result, cur);
                    renderRemoveElements();
                    setStatus('吸管抠图完成');
                }
            } catch (err) {
                console.error('吸管抠图失败:', err);
                setStatus('吸管抠图失败', false, true);
            }
        }

        async function applyLassoMaskToResult(resultSrc, maskSrc) {
            const [resultImg, maskImg] = await Promise.all([
                loadImage(resultSrc),
                loadImage(maskSrc),
            ]);

            const canvas = document.createElement('canvas');
            canvas.width = resultImg.width;
            canvas.height = resultImg.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(resultImg, 0, 0);
            const resultData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = canvas.width;
            maskCanvas.height = canvas.height;
            const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
            maskCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
            const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);

            let resultAlphaPixels = 0;
            let maskAlphaPixels = 0;
            const pixelCount = resultData.data.length / 4;

            for (let p = 0; p < resultData.data.length; p += 4) {
                if (resultData.data[p + 3] > 10) resultAlphaPixels++;
                if (maskData.data[p + 3] > 10) maskAlphaPixels++;
            }

            const resultCoverage = resultAlphaPixels / pixelCount;
            const maskCoverage = maskAlphaPixels / pixelCount;
            if (shouldPreserveLassoRegion(maskCoverage, resultCoverage)) {
                return null;
            }

            for (let p = 0; p < resultData.data.length; p += 4) {
                const maskAlpha = maskData.data[p + 3] / 255;
                resultData.data[p + 3] = Math.round(resultData.data[p + 3] * maskAlpha);
            }

            ctx.putImageData(resultData, 0, 0);
            return canvas.toDataURL('image/png');
        }

        async function finalizeRemoveResult(element, resultSrc, tolerance) {
            if (!shouldApplyLassoMask(element)) return resultSrc;
            return await applyLassoMaskToResult(resultSrc, element.preview)
                || await removeLassoBackground(element, tolerance);
        }

        async function removeLassoBackground(element, tolerance) {
            const [rawImg, maskImg] = await Promise.all([
                loadImage(processingPreviewForElement(element)),
                loadImage(element.preview),
            ]);

            const canvas = document.createElement('canvas');
            canvas.width = rawImg.width;
            canvas.height = rawImg.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(rawImg, 0, 0);
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height);

            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = canvas.width;
            maskCanvas.height = canvas.height;
            const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
            maskCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
            const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);

            const w = canvas.width;
            const h = canvas.height;
            const total = w * h;
            const inside = new Uint8Array(total);
            const bg = new Uint8Array(total);
            const queue = new Int32Array(total);
            let head = 0;
            let tail = 0;
            const seedColors = [];

            function idx(x, y) { return y * w + x; }
            function addSeed(x, y) {
                const i = idx(x, y);
                if (!inside[i] || bg[i]) return;
                bg[i] = 1;
                queue[tail++] = i;
                const p = i * 4;
                seedColors.push([data.data[p], data.data[p + 1], data.data[p + 2]]);
            }

            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const i = idx(x, y);
                    if (maskData.data[i * 4 + 3] > 10) inside[i] = 1;
                }
            }

            for (let x = 0; x < w; x++) {
                addSeed(x, 0);
                addSeed(x, h - 1);
            }
            for (let y = 0; y < h; y++) {
                addSeed(0, y);
                addSeed(w - 1, y);
            }
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const i = idx(x, y);
                    if (!inside[i]) continue;
                    if (!inside[idx(x - 1, y)] || !inside[idx(x + 1, y)] || !inside[idx(x, y - 1)] || !inside[idx(x, y + 1)]) {
                        addSeed(x, y);
                    }
                }
            }

            if (!seedColors.length) return element.preview;

            const bgColor = seedColors.reduce((acc, color) => {
                acc[0] += color[0];
                acc[1] += color[1];
                acc[2] += color[2];
                return acc;
            }, [0, 0, 0]).map(v => v / seedColors.length);
            const threshold = Math.max(36, Number(tolerance || 30) * 2.2);
            const thresholdSq = threshold * threshold;

            function closeToBg(i) {
                const p = i * 4;
                const dr = data.data[p] - bgColor[0];
                const dg = data.data[p + 1] - bgColor[1];
                const db = data.data[p + 2] - bgColor[2];
                return dr * dr + dg * dg + db * db <= thresholdSq;
            }

            while (head < tail) {
                const i = queue[head++];
                const x = i % w;
                const y = Math.floor(i / w);
                const candidates = [];
                if (x > 0) candidates.push(i - 1);
                if (x < w - 1) candidates.push(i + 1);
                if (y > 0) candidates.push(i - w);
                if (y < h - 1) candidates.push(i + w);
                for (const n of candidates) {
                    if (!inside[n] || bg[n] || !closeToBg(n)) continue;
                    bg[n] = 1;
                    queue[tail++] = n;
                }
            }

            for (let i = 0; i < total; i++) {
                const p = i * 4;
                if (!inside[i] || bg[i]) {
                    data.data[p + 3] = 0;
                } else {
                    data.data[p + 3] = Math.round(data.data[p + 3] * (maskData.data[p + 3] / 255));
                }
            }

            ctx.putImageData(data, 0, 0);
            return canvas.toDataURL('image/png');
        }

        function loadImage(src) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = src;
            });
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
                    const uploadSource = processingPreviewForElement(sel[i]);
                    const uploadBlob = await fetch(uploadSource).then(r => r.blob());
                    
                    const fd = new FormData(); fd.append('file', uploadBlob, 'el.png');
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
                    
                    if (rd.results?.[0]) {
                        sel[i].processed = true;
                        sel[i].result = await finalizeRemoveResult(sel[i], rd.results[0].preview, tol);
                    }
                } catch (err) { console.error('元素 ' + sel[i].index + ' 失败:', err); }
            }
            
            renderRemoveElements();
            
            // 更新画布显示第一个已处理的选中元素
            const firstProcessed = sel.find(e => e.processed);
            if (firstProcessed) {
                showOnCanvas(firstProcessed.result, firstProcessed);
            }
            
            setStatus('完成，处理了 ' + sel.length + ' 个元素');
            showToast('抠图完成 ' + sel.length + ' 个', 'success');
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
        
        // 初始化发送下拉菜单
        initSendDropdown('removeSendBtn', 'removeSendMenu', (target) => {
            const sel = state.removeElements.filter(e => e.selected);
            if (!sel.length) { showToast('请先选择元素', 'error'); return; }
            
            if (target === 'split') {
                syncElementsToTarget(state.splitElements, sel, (el) => ({
                    index: 0,
                    preview: el.processed ? el.result : el.preview,
                    selected: true,
                    name: el.name || ('element_' + el.index),
                    sourceElementId: el.sourceElementId || el.id,
                    sourceImageId: el.sourceImageId,
                    sourceImageSize: el.sourceImageSize,
                    bbox: el.bbox,
                    rawPreview: el.rawPreview,
                    type: el.type || null
                }));
                renderSplitElements();
                document.querySelector('.tab[data-panel="split"]').click();
            } else if (target === 'upscale') {
                syncElementsToTarget(state.upscaleItems, sel, (el) => ({
                    index: 0,
                    src: el.processed ? el.result : el.preview,
                    name: el.name || ('element_' + el.index),
                    sourceElementId: el.sourceElementId || el.id,
                    sourceImageId: el.sourceImageId,
                    sourceImageSize: el.sourceImageSize,
                    bbox: el.bbox,
                    rawPreview: el.rawPreview,
                    selected: true,
                    processed: false,
                    result: null
                }));
                renderUpscaleElements();
                // 自动显示第一个元素到画布
                const first = state.upscaleItems[0];
                if (first) showUpscaleCanvas(first.src, first);
                $('upscaleBtn').disabled = false;
                document.querySelector('.tab[data-panel="upscale"]').click();
            } else if (target === 'recognize') {
                syncElementsToTarget(state.recognizeItems, sel, (el) => ({
                    index: 0,
                    src: el.processed ? el.result : el.preview,
                    name: el.name || ('element_' + el.index),
                    sourceElementId: el.sourceElementId || el.id,
                    sourceImageId: el.sourceImageId,
                    sourceImageSize: el.sourceImageSize,
                    bbox: el.bbox,
                    rawPreview: el.rawPreview,
                    selected: true,
                    label: null,
                    confidence: null,
                    suggestedName: null
                }));
                renderRecognizeElements();
                document.querySelector('.tab[data-panel="recognize"]').click();
            }
            
            showToast(`已同步 ${sel.length} 个元素`);
        });
        
        // 元素条框选（函数定义在 shared.js）
        
        // 启动 ResizeObserver
        document.querySelectorAll('.elements-container').forEach(el => {
            resizeObserver.observe(el);
        });
        
        // 监听预览区域大小变化
        const splitPreview = $('splitPreview');
        if (splitPreview) {
            resizeObserver.observe(splitPreview);
        }
        const upscalePreview = $('upscalePreview');
        if (upscalePreview) {
            resizeObserver.observe(upscalePreview);
        }
