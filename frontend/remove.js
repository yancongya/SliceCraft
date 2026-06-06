        // ============ 抠图面板 ============
        
        // 画布状态
        const canvasState = {
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            isDragging: false,
            isErasing: false,
            showingOriginal: false,
            lastX: 0,
            lastY: 0,
            currentImage: null,
            currentElement: null,
            eraserSize: 20,
            bgMode: 'checker'
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
        
        // 眼睛功能 - 按住查看原图，松开显示抠图结果
        function showOriginal() {
            if (!canvasState.currentElement?.processed || canvasState.showingOriginal) return;
            canvasState.showingOriginal = true;
            $('eyeBtn')?.classList.add('active');
            showOnCanvas(canvasState.currentElement.preview, canvasState.currentElement);
        }
        
        function hideOriginal() {
            if (!canvasState.showingOriginal) return;
            canvasState.showingOriginal = false;
            $('eyeBtn')?.classList.remove('active');
            if (canvasState.currentElement) {
                showOnCanvas(canvasState.currentElement.result, canvasState.currentElement);
            }
        }
        
        $('eyeBtn')?.addEventListener('mousedown', showOriginal);
        $('eyeBtn')?.addEventListener('mouseup', hideOriginal);
        $('eyeBtn')?.addEventListener('mouseleave', hideOriginal);
        
        // V 键按住查看原图
        document.addEventListener('keydown', e => {
            if (e.key === 'v' || e.key === 'V') showOriginal();
        });
        document.addEventListener('keyup', e => {
            if (e.key === 'v' || e.key === 'V') hideOriginal();
        });
        
        // 橡皮擦功能
        $('eraserBtn')?.addEventListener('click', () => {
            canvasState.isErasing = !canvasState.isErasing;
            $('eraserBtn').classList.toggle('active', canvasState.isErasing);
            updateCanvasCursor();
        });
        
        $('eraserSize')?.addEventListener('input', e => {
            canvasState.eraserSize = parseInt(e.target.value);
        });
        
        function updateCanvasCursor() {
            const container = $('canvasContainer');
            if (!container) return;
            if (canvasState.isErasing) {
                const size = canvasState.eraserSize;
                const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2 - 1}" fill="none" stroke="red" stroke-width="1.5"/></svg>`;
                const encoded = btoa(svg);
                container.style.cursor = `url('data:image/svg+xml;base64,${encoded}') ${size/2} ${size/2}, crosshair`;
            } else {
                container.style.cursor = 'grab';
            }
        }
        
        function eraseAtPosition(x, y) {
            if (!canvasState.currentElement) return;
            const canvas = $('removeCanvas');
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d');
            const radius = canvasState.eraserSize / 2 / canvasState.scale;
            
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            
            // 保存修改
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
        
        // 归位按钮
        $('resetViewBtn')?.addEventListener('click', resetRemoveView);
        
        // R 键归位
        document.addEventListener('keydown', e => {
            if ((e.key === 'r' || e.key === 'R') && state.currentTab === 'remove') {
                resetRemoveView();
            }
        });
        
        // 背景色切换
        document.querySelectorAll('[data-bg]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-bg]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                canvasState.bgMode = btn.dataset.bg;
                updateCanvasBackground();
            });
        });
        
        function updateCanvasBackground() {
            const container = $('canvasContainer');
            if (!container) return;
            
            // 重置所有背景样式
            container.style.cssText = container.style.cssText.replace(/background[^;]*;?/g, '');
            container.style.position = 'absolute';
            container.style.top = '0';
            container.style.left = '0';
            container.style.right = '0';
            container.style.bottom = '0';
            container.style.overflow = 'hidden';
            container.style.cursor = canvasState.isErasing ? 'crosshair' : 'grab';
            container.style.zIndex = '5';
            
            switch (canvasState.bgMode) {
                case 'checker':
                    container.style.backgroundImage = 'linear-gradient(45deg, #e0e0e0 25%, transparent 25%), linear-gradient(-45deg, #e0e0e0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e0e0e0 75%), linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)';
                    container.style.backgroundSize = '20px 20px';
                    container.style.backgroundPosition = '0 0, 0 10px, 10px -10px, -10px 0px';
                    container.style.backgroundColor = '#ffffff';
                    break;
                case 'white':
                    container.style.backgroundColor = '#ffffff';
                    break;
                case 'black':
                    container.style.backgroundColor = '#000000';
                    break;
            }
        }
        
        function drawCanvas(img) {
            const canvas = $('removeCanvas');
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
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
        $('canvasContainer')?.addEventListener('mousedown', e => {
            if (e.target.closest('.toolbar')) return;
            
            // 空格键或非橡皮擦模式：拖拽
            if (canvasState.tempDrag || !canvasState.isErasing) {
                canvasState.isDragging = true;
                canvasState.lastX = e.clientX;
                canvasState.lastY = e.clientY;
            } else {
                canvasState.isErasingActive = true;
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
            if (canvasState.isErasingActive && !canvasState.tempDrag) {
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
            canvasState.isErasingActive = false;
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
        
        $('removeMethod').addEventListener('change', e => {
            const m = e.target.value;
            $('secRembg').classList.toggle('hidden', m !== 'rembg' && m !== 'combined');
            $('secRemFlood').classList.toggle('hidden', m !== 'flood' && m !== 'combined');
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
            $('exportBtn').disabled = false;
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
                    rf.append('image_id', up.image_id); rf.append('method', method); rf.append('model', model); rf.append('flood_tolerance', tol);
                    const rd = await (await fetch(API + '/api/remove_background', { method: 'POST', body: rf })).json();
                    
                    if (rd.results?.[0]) { sel[i].processed = true; sel[i].result = rd.results[0].preview; }
                } catch (err) { console.error('元素 ' + sel[i].index + ' 失败:', err); }
            }
            
            renderRemoveElements();
            setStatus('完成，处理了 ' + sel.length + ' 个元素');
            $('processBtn').disabled = false;
        });
        
        $('exportBtn').addEventListener('click', () => {
            state.removeElements.filter(e => e.processed).forEach(el => {
                const a = document.createElement('a'); a.href = el.result; a.download = 'element_' + el.index + '.png'; a.click();
            });
        });
        
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
