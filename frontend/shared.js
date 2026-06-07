        const API = window.location.origin;
        const $ = id => document.getElementById(id);
        const show = el => el.classList.remove('hidden');
        const hide = el => el.classList.add('hidden');
        
        // 阻止全局的拖拽和选择行为
        document.addEventListener('dragstart', e => e.preventDefault());
        
        // 在预览区域阻止文本选择（不阻止元素卡片的双击）
        document.addEventListener('selectstart', e => {
            if (e.target.closest('.preview') && !e.target.closest('.elem-card')) {
                e.preventDefault();
                return false;
            }
        });
        
        const state = {
            splitImageId: null,
            splitElements: [],
            removeElements: [],
            upscaleItems: [],
            recognizeItems: []
        };
        
        // ============ 工具函数 ============
        function setStatus(text, loading = false, error = false) {
            $('statusText').textContent = text;
            $('dot').className = 'dot' + (loading ? ' loading' : '') + (error ? ' error' : '');
        }
        
        function updateBadges() {
            const s = state.splitElements.filter(e => e.selected).length;
            const r = state.removeElements.filter(e => e.selected).length;
            const u = (state.upscaleItems || []).filter(e => e.selected).length;
            const g = (state.recognizeItems || []).filter(e => e.selected).length;
            const sb = $('splitBadge'), rb = $('removeBadge'), ub = $('upscaleBadge'), gb = $('recognizeBadge');
            s > 0 ? (sb.textContent = s, show(sb)) : hide(sb);
            r > 0 ? (rb.textContent = r, show(rb)) : hide(rb);
            u > 0 ? (ub.textContent = u, show(ub)) : hide(ub);
            g > 0 ? (gb.textContent = g, show(gb)) : hide(gb);
        }
        
        // ============ Tab ============
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                $('panel-' + tab.dataset.panel).classList.add('active');
            });
        });
        
        // ============ Modal ============
        function openModal(src) { $('modalImg').src = src; $('modal').classList.add('active'); }
        function closeModal() { $('modal').classList.remove('active'); }
        $('modalClose').addEventListener('click', closeModal);
        $('modal').addEventListener('click', e => { if (e.target === $('modal')) closeModal(); });
        document.addEventListener('keydown', e => { 
            if (e.key === 'Escape') { closeModal(); exitLassoMode(); } 
            if (e.key === 'l' || e.key === 'L') { 
                if (lassoMode) exitLassoMode(); else enterLassoMode(); 
            }
        });
        
        // ============ 套索工具 ============
        let lassoMode = false;
        let lassoPoints = [];
        let lassoCanvas = null;
        let lassoCtx = null;
        
        function enterLassoMode() {
            if (!state.splitImageId) { setStatus('请先上传图片', false, true); return; }
            
            lassoMode = true;
            lassoPoints = [];
            $('lassoBtn').classList.add('active');
            $('toolHint').textContent = '绘制轮廓，松手闭合';
            
            // 创建 Canvas overlay
            const preview = $('splitPreview');
            lassoCanvas = document.createElement('canvas');
            lassoCanvas.className = 'canvas-overlay';
            lassoCanvas.width = preview.offsetWidth;
            lassoCanvas.height = preview.offsetHeight;
            preview.appendChild(lassoCanvas);
            lassoCtx = lassoCanvas.getContext('2d');
            
            // 绑定事件
            lassoCanvas.addEventListener('mousedown', onLassoStart);
            lassoCanvas.addEventListener('mousemove', onLassoMove);
            lassoCanvas.addEventListener('mouseup', onLassoEnd);
        }
        
        function exitLassoMode() {
            lassoMode = false;
            lassoPoints = [];
            $('lassoBtn').classList.remove('active');
            $('toolHint').textContent = '';
            
            if (lassoCanvas) {
                lassoCanvas.remove();
                lassoCanvas = null;
                lassoCtx = null;
            }
        }
        
        function onLassoStart(e) {
            lassoPoints = [];
            const rect = lassoCanvas.getBoundingClientRect();
            lassoPoints.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
        }
        
        function onLassoMove(e) {
            if (lassoPoints.length === 0) return;
            
            const rect = lassoCanvas.getBoundingClientRect();
            lassoPoints.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            
            // 绘制路径
            lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
            lassoCtx.beginPath();
            lassoCtx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
            for (let i = 1; i < lassoPoints.length; i++) {
                lassoCtx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
            }
            lassoCtx.strokeStyle = 'var(--accent)';
            lassoCtx.lineWidth = 2;
            lassoCtx.setLineDash([5, 5]);
            lassoCtx.stroke();
            lassoCtx.setLineDash([]);
        }
        
        function onLassoEnd(e) {
            if (lassoPoints.length < 10) {
                exitLassoMode();
                return;
            }
            
            // 闭合路径
            lassoCtx.clearRect(0, 0, lassoCanvas.width, lassoCanvas.height);
            lassoCtx.beginPath();
            lassoCtx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
            for (let i = 1; i < lassoPoints.length; i++) {
                lassoCtx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
            }
            lassoCtx.closePath();
            lassoCtx.fillStyle = 'rgba(37, 99, 235, 0.2)';
            lassoCtx.fill();
            lassoCtx.strokeStyle = 'var(--accent)';
            lassoCtx.lineWidth = 2;
            lassoCtx.stroke();
            
            // 获取原图尺寸
            const img = $('splitImage');
            const imgNaturalW = img.naturalWidth;
            const imgNaturalH = img.naturalHeight;
            const imgDisplayW = img.offsetWidth;
            const imgDisplayH = img.offsetHeight;
            
            // 计算缩放比例
            const scaleX = imgNaturalW / imgDisplayW;
            const scaleY = imgNaturalH / imgDisplayH;
            
            // 计算图片在画布中的偏移
            const imgRect = img.getBoundingClientRect();
            const canvasRect = lassoCanvas.getBoundingClientRect();
            const offsetX = imgRect.left - canvasRect.left;
            const offsetY = imgRect.top - canvasRect.top;
            
            // 生成 mask（使用原图尺寸）
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = imgNaturalW;
            maskCanvas.height = imgNaturalH;
            const maskCtx = maskCanvas.getContext('2d');
            maskCtx.fillStyle = 'black';
            maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
            maskCtx.beginPath();
            // 将坐标从画布坐标转换为原图坐标
            const firstX = (lassoPoints[0].x - offsetX) * scaleX;
            const firstY = (lassoPoints[0].y - offsetY) * scaleY;
            maskCtx.moveTo(firstX, firstY);
            for (let i = 1; i < lassoPoints.length; i++) {
                const x = (lassoPoints[i].x - offsetX) * scaleX;
                const y = (lassoPoints[i].y - offsetY) * scaleY;
                maskCtx.lineTo(x, y);
            }
            maskCtx.closePath();
            maskCtx.fillStyle = 'white';
            maskCtx.fill();
            
            // 直接提交，不显示弹窗
            const maskData = maskCanvas.toDataURL('image/png');
            exitLassoMode();
            submitLasso(maskData, false);
        }
        
        // 套索按钮
        $('lassoBtn').addEventListener('click', () => {
            if (lassoMode) {
                exitLassoMode();
            } else {
                enterLassoMode();
            }
        });
        
        async function submitLasso(maskData, autoDetect) {
            setStatus('套索切分中...', true);
            
            const fd = new FormData();
            fd.append('image_id', state.splitImageId);
            fd.append('mask_base64', maskData);
            fd.append('auto_detect_remaining', autoDetect);
            fd.append('detect_method', $('detectMethod').value);
            fd.append('sensitivity', $('sensitivity').value);
            fd.append('min_area', $('minArea').value);
            fd.append('merge_distance', $('mergeDist').value);
            fd.append('crop_padding', $('padding').value);
            
            try {
                const res = await fetch(API + '/api/lasso', { method: 'POST', body: fd });
                if (!res.ok) throw new Error('套索切分失败');
                const data = await res.json();
                
                // 添加套索元素
                const lassoEl = data.lasso_element;
                lassoEl.index = state.splitElements.length + 1;
                lassoEl.selected = true;
                state.splitElements.push(lassoEl);
                
                // 添加剩余元素
                if (data.remaining_elements) {
                    data.remaining_elements.forEach(el => {
                        el.index = state.splitElements.length + 1;
                        el.selected = true;
                        state.splitElements.push(el);
                    });
                }
                
                renderSplitElements();
                setStatus(`套索切分完成，共 ${state.splitElements.length} 个元素`);
            } catch (err) {
                setStatus(err.message, false, true);
            }
        }
        
        // 元素条布局
        function updateElementsLayout() {
            document.querySelectorAll('.elements-bar').forEach(bar => {
                const container = bar.querySelector('.elements-container');
                if (!container) return;
                const h = bar.offsetHeight;
                const w = container.offsetWidth;
                
                if (h > 120) {
                    // 多行模式 - 计算最优卡片大小
                    container.className = 'elements-container multi-row';
                    const count = container.children.length;
                    if (count > 0) {
                        // 计算能放多少列，然后确定卡片大小
                        const gap = 8;
                        const padding = 32;
                        const availableWidth = w - padding;
                        const minCardSize = 56;
                        const maxCardSize = 120;
                        
                        // 计算列数
                        let cols = Math.floor((availableWidth + gap) / (minCardSize + gap));
                        cols = Math.max(1, cols);
                        
                        // 计算卡片大小
                        let cardSize = Math.floor((availableWidth - (cols - 1) * gap) / cols);
                        cardSize = Math.min(maxCardSize, Math.max(minCardSize, cardSize));
                        
                        container.style.setProperty('--card-size', cardSize + 'px');
                        
                        // 更新卡片大小
                        container.querySelectorAll('.elem-card').forEach(card => {
                            card.style.width = cardSize + 'px';
                            card.style.height = cardSize + 'px';
                        });
                    }
                } else {
                    // 单行模式
                    container.className = 'elements-container single-row';
                    container.style.removeProperty('--card-size');
                    container.querySelectorAll('.elem-card').forEach(card => {
                        card.style.width = '64px';
                        card.style.height = '64px';
                    });
                }
            });
        }
        
        // 使用 ResizeObserver 监听容器大小变化
        const resizeObserver = new ResizeObserver(() => {
            updateElementsLayout();
            drawOverlay();
        });
        
        // ============ 拖拽调节 ============
        // 侧栏宽度拖拽
        document.querySelectorAll('.sidebar-resize').forEach(handle => {
            const sidebar = handle.parentElement;
            let startX, startWidth;
            
            handle.addEventListener('mousedown', e => {
                e.preventDefault();
                startX = e.clientX;
                startWidth = sidebar.offsetWidth;
                
                const onMove = e => {
                    const delta = startX - e.clientX;
                    const newWidth = Math.min(400, Math.max(200, startWidth + delta));
                    sidebar.style.width = newWidth + 'px';
                };
                
                const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                };
                
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        });
        
        // 底栏高度拖拽
        document.querySelectorAll('.bar-resize').forEach(handle => {
            const bar = handle.parentElement;
            let startY, startFlex;
            
            handle.addEventListener('mousedown', e => {
                e.preventDefault();
                startY = e.clientY;
                startFlex = parseFloat(bar.style.flex) || 4;
                const parentHeight = bar.parentElement.offsetHeight;
                const startPixel = (startFlex / 10) * parentHeight;
                
                const onMove = e => {
                    const delta = startY - e.clientY;
                    const newPixel = Math.min(parentHeight * 0.7, Math.max(60, startPixel + delta));
                    const contentFlex = parseFloat(bar.previousElementSibling?.style.flex) || 6;
                    const newFlex = (newPixel / parentHeight) * 10;
                    bar.style.flex = newFlex;
                    if (bar.previousElementSibling) {
                        bar.previousElementSibling.style.flex = 10 - newFlex;
                    }
                    updateElementsLayout();
                };
                
                const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                };
                
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        });
        
        // ============ 框选 ============
        function initMarquee(previewId, elementsKey) {
            const preview = $(previewId);
            if (!preview) return;
            
            // 查找或创建 marquee 元素
            let marquee = preview.querySelector('.marquee');
            if (!marquee) {
                marquee = document.createElement('div');
                marquee.className = 'marquee';
                preview.style.position = 'relative';
                preview.appendChild(marquee);
            }
            
            let active = false, sx, sy, shiftKey = false;
            let mouseDownTarget = null;
            let mouseDownTime = 0;
            
            // 阻止默认的拖拽和选择行为
            preview.addEventListener('dragstart', e => e.preventDefault());
            preview.addEventListener('selectstart', e => {
                e.preventDefault();
                return false;
            });
            
            preview.addEventListener('mousedown', e => {
                mouseDownTarget = e.target;
                mouseDownTime = Date.now();
                console.log('mousedown on', previewId, 'target:', e.target.className, 'shift:', e.shiftKey);
                
                // 忽略按钮点击
                if (e.target.closest('button')) return;
                
                // 如果点击在元素卡片上，不启动框选
                if (e.target.closest('.elem-card')) {
                    console.log('clicked on elem-card, skip marquee');
                    return;
                }
                
                // 忽略上传区域
                if (e.target.closest('.upload')) return;
                
                e.preventDefault();
                active = true;
                shiftKey = e.shiftKey;
                const rect = preview.getBoundingClientRect();
                sx = e.clientX - rect.left;
                sy = e.clientY - rect.top;
                
                // 显示选框
                marquee.style.display = 'block';
                marquee.style.left = sx + 'px';
                marquee.style.top = sy + 'px';
                marquee.style.width = '0px';
                marquee.style.height = '0px';
            });
            
            preview.addEventListener('mousemove', e => {
                if (!active) return;
                e.preventDefault();
                const rect = preview.getBoundingClientRect();
                const cx = e.clientX - rect.left;
                const cy = e.clientY - rect.top;
                
                const x = Math.min(sx, cx);
                const y = Math.min(sy, cy);
                const w = Math.abs(cx - sx);
                const h = Math.abs(cy - sy);
                
                marquee.style.left = x + 'px';
                marquee.style.top = y + 'px';
                marquee.style.width = w + 'px';
                marquee.style.height = h + 'px';
            });
            
            preview.addEventListener('mouseup', e => {
                if (!active) {
                    // 处理点击空白的情况
                    if (!e.target.closest('.elem-card') && !e.target.closest('button')) {
                        const elapsed = Date.now() - mouseDownTime;
                        if (elapsed < 300) {
                            // 短点击：取消全部选择
                            state[elementsKey].forEach(el => el.selected = false);
                            preview.querySelectorAll('.elem-card').forEach(c => c.classList.remove('selected'));
                            updateBadges();
                        }
                    }
                    return;
                }
                e.preventDefault();
                active = false;
                
                // 获取选框区域
                const box = marquee.getBoundingClientRect();
                marquee.style.display = 'none';
                
                // 如果选框太小，视为点击空白，取消全部选择
                if (box.width < 5 && box.height < 5) {
                    state[elementsKey].forEach(el => el.selected = false);
                    preview.querySelectorAll('.elem-card').forEach(c => c.classList.remove('selected'));
                    updateBadges();
                    return;
                }
                
                // 框选逻辑
                const cards = preview.querySelectorAll('.elem-card');
                let count = 0;
                
                cards.forEach(card => {
                    const cardRect = card.getBoundingClientRect();
                    if (intersects(box, cardRect)) {
                        const idx = parseInt(card.dataset.index);
                        const el = state[elementsKey].find(e => e.index === idx);
                        if (el) {
                            if (shiftKey) {
                                // Shift + 框选：强制加选
                                el.selected = true;
                                card.classList.add('selected');
                            } else {
                                // 普通框选：切换选中状态
                                el.selected = !el.selected;
                                card.classList.toggle('selected', el.selected);
                            }
                            count++;
                        }
                    }
                });
                
                if (count > 0) {
                    updateBadges();
                    const selectedCount = state[elementsKey].filter(e => e.selected).length;
                    setStatus(`框选了 ${count} 个元素，共选中 ${selectedCount} 个`);
                }
            });
            
            // 双击空白：全选
            preview.addEventListener('dblclick', e => {
                if (e.target.closest('.elem-card') || e.target.closest('button')) return;
                state[elementsKey].forEach(el => el.selected = true);
                preview.querySelectorAll('.elem-card').forEach(c => c.classList.add('selected'));
                updateBadges();
                setStatus('已全选');
            });
            
            // 文档级别的 mouseup，确保鼠标离开预览区域时也能结束框选
            document.addEventListener('mouseup', e => {
                if (!active) return;
                active = false;
                marquee.style.display = 'none';
            });
            
            function intersects(a, b) {
                return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
            }
        }
        
        // ============ 绘制画布边框 ============
        function drawOverlay() {
            const canvas = $('overlayCanvas');
            const img = $('splitImage');
            const preview = $('splitPreview');
            if (!canvas || !img || img.classList.contains('hidden')) return;
            
            const containerRect = preview.getBoundingClientRect();
            const imgRect = img.getBoundingClientRect();
            
            const dpr = window.devicePixelRatio || 1;
            canvas.width = containerRect.width * dpr;
            canvas.height = containerRect.height * dpr;
            canvas.style.width = containerRect.width + 'px';
            canvas.style.height = containerRect.height + 'px';
            
            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (!state.splitElements.length) return;
            
            const offsetX = imgRect.left - containerRect.left;
            const offsetY = imgRect.top - containerRect.top;
            const scaleX = imgRect.width / img.naturalWidth;
            const scaleY = imgRect.height / img.naturalHeight;
            
            state.splitElements.forEach((el, i) => {
                const [x, y, w, h] = el.bbox;
                const sx = offsetX + x * scaleX;
                const sy = offsetY + y * scaleY;
                const sw = w * scaleX;
                const sh = h * scaleY;
                
                ctx.strokeStyle = '#22c55e';
                ctx.lineWidth = 2;
                ctx.strokeRect(sx, sy, sw, sh);
                
                ctx.fillStyle = '#22c55e';
                ctx.font = 'bold 11px sans-serif';
                const text = String(el.index);
                const tw = ctx.measureText(text).width + 8;
                ctx.fillRect(sx, sy - 18, tw, 18);
                ctx.fillStyle = '#fff';
                ctx.fillText(text, sx + 4, sy - 5);
            });
            
            canvas.style.pointerEvents = 'auto';
        }
        
        // 点击画布边框删除元素
        $('overlayCanvas')?.addEventListener('click', e => {
            if (!state.splitElements.length) return;
            
            const canvas = $('overlayCanvas');
            const img = $('splitImage');
            const preview = $('splitPreview');
            const containerRect = preview.getBoundingClientRect();
            const imgRect = img.getBoundingClientRect();
            const clickX = e.clientX - containerRect.left;
            const clickY = e.clientY - containerRect.top;
            
            const offsetX = imgRect.left - containerRect.left;
            const offsetY = imgRect.top - containerRect.top;
            const scaleX = imgRect.width / img.naturalWidth;
            const scaleY = imgRect.height / img.naturalHeight;
            
            for (let i = state.splitElements.length - 1; i >= 0; i--) {
                const el = state.splitElements[i];
                const [x, y, w, h] = el.bbox;
                const sx = offsetX + x * scaleX;
                const sy = offsetY + y * scaleY;
                const sw = w * scaleX;
                const sh = h * scaleY;
                
                if (clickX >= sx && clickX <= sx + sw && clickY >= sy && clickY <= sy + sh) {
                    state.splitElements.splice(i, 1);
                    drawOverlay();
                    if (typeof renderSplitElements === 'function') renderSplitElements();
                    setStatus('已删除元素 ' + el.index);
                    return;
                }
            }
        });
        
        // 鼠标悬停样式
        $('overlayCanvas')?.addEventListener('mousemove', e => {
            if (!state.splitElements.length) return;
            
            const canvas = $('overlayCanvas');
            const img = $('splitImage');
            const preview = $('splitPreview');
            const containerRect = preview.getBoundingClientRect();
            const imgRect = img.getBoundingClientRect();
            const mx = e.clientX - containerRect.left;
            const my = e.clientY - containerRect.top;
            
            const offsetX = imgRect.left - containerRect.left;
            const offsetY = imgRect.top - containerRect.top;
            const scaleX = imgRect.width / img.naturalWidth;
            const scaleY = imgRect.height / img.naturalHeight;
            
            let hovering = false;
            for (const el of state.splitElements) {
                const [x, y, w, h] = el.bbox;
                const sx = offsetX + x * scaleX;
                const sy = offsetY + y * scaleY;
                const sw = w * scaleX;
                const sh = h * scaleY;
                if (mx >= sx && mx <= sx + sw && my >= sy && my <= sy + sh) {
                    hovering = true;
                    break;
                }
            }
            canvas.style.cursor = hovering ? 'pointer' : 'default';
        });
        
        // ============ 初始化框选 ============
        initMarquee('splitList', 'splitElements');
        initMarquee('removeList', 'removeElements');
        initMarquee('upscaleList', 'upscaleItems');
        initMarquee('recognizeList', 'recognizeItems');
        
        // ============ 元素详情（header 中显示） ============
        function updateElementDetail(tab, elements) {
            const detail = $(tab + 'Detail');
            if (!detail) return;
            
            const selected = elements.filter(e => e.selected);
            
            if (selected.length === 1) {
                const el = selected[0];
                detail.classList.remove('hidden');
                
                const sizeEl = $(tab + 'InfoSize');
                const nameEl = $(tab + 'InfoName');
                
                if (sizeEl) {
                    let w = 0, h = 0;
                    if (el.bbox) {
                        w = el.bbox[2]; h = el.bbox[3];
                    } else if (el.resultWidth && el.resultHeight) {
                        w = el.resultWidth; h = el.resultHeight;
                    }
                    
                    if (w && h) {
                        sizeEl.textContent = w + ' × ' + h;
                    } else {
                        const imgSrc = el.processed ? el.result : el.src || el.preview;
                        if (imgSrc) {
                            const img = new Image();
                            img.onload = () => { sizeEl.textContent = img.width + ' × ' + img.height; };
                            img.src = imgSrc;
                        } else {
                            sizeEl.textContent = '-';
                        }
                    }
                }
                
                if (nameEl) {
                    nameEl.value = el.name || ('element_' + el.index);
                    nameEl.onchange = () => { el.name = nameEl.value; };
                    // 回车时取消焦点
                    nameEl.onkeydown = (e) => { if (e.key === 'Enter') nameEl.blur(); };
                }
            } else {
                detail.classList.add('hidden');
            }
        }
        window.updateElementDetail = updateElementDetail;
        
        // ============ Toast ============
        function showToast(msg, type = '') {
            const c = $('toastContainer');
            const t = document.createElement('div');
            t.className = 'toast' + (type ? ' ' + type : '');
            t.textContent = msg;
            c.appendChild(t);
            setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 2500);
        }
        window.showToast = showToast;
        
        // ============ Dialog ============
        function showDialog(title, body) {
            return new Promise(resolve => {
                $('dialogTitle').textContent = title;
                $('dialogBody').textContent = body;
                $('dialogOverlay').classList.remove('hidden');
                const onConfirm = () => { cleanup(); resolve(true); };
                const onCancel = () => { cleanup(); resolve(false); };
                const cleanup = () => {
                    $('dialogOverlay').classList.add('hidden');
                    $('dialogConfirm').removeEventListener('click', onConfirm);
                    $('dialogCancel').removeEventListener('click', onCancel);
                };
                $('dialogConfirm').addEventListener('click', onConfirm);
                $('dialogCancel').addEventListener('click', onCancel);
            });
        }
        window.showDialog = showDialog;
        
