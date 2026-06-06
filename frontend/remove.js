        // ============ 抠图面板 ============
        
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
                div.innerHTML = '<img src="' + (el.processed ? el.result : el.preview) + '"><span class="num">' + el.index + '</span><button class="card-delete" title="删除">×</button>';
                div.addEventListener('click', e => {
                    if (e.target.classList.contains('card-delete')) return;
                    if (e.shiftKey) { el.selected = true; } else { el.selected = !el.selected; }
                    div.classList.toggle('selected', el.selected);
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
