// ============ UI 管理类 ============
class UIManager {
    constructor(memoryManager, photoManager, mapManager) {
        this.memoryManager = memoryManager;
        this.photoManager = photoManager;
        this.mapManager = mapManager;
        this.currentMemoryId = null;
        this.pendingPhotos = [];
        this.editingMemoryId = null;
        this.pickerMap = null;
        this.pickerMarker = null;

        this.bindEvents();
        this.renderCityList();
    }

    // ============ 城市列表 ============
    renderCityList(searchQuery = '') {
        const cityList = document.getElementById('city-list');
        const memories = searchQuery 
            ? this.memoryManager.searchMemories(searchQuery)
            : this.memoryManager.getAllMemories();

        document.getElementById('city-count').textContent = 
            this.memoryManager.getAllMemories().length;

        if (memories.length === 0) {
            cityList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-map-marked-alt"></i>
                    <p>还没有旅行记忆</p>
                    <small>点击"添加记忆"开始记录吧！</small>
                </div>`;
            this.mapManager.updateMarkers([], null, () => {});
            return;
        }

        cityList.innerHTML = memories.map(memory => `
            <div class="city-card ${memory.id === this.currentMemoryId ? 'active' : ''}" data-id="${memory.id}">
                <div class="city-card-header">
                    <h3>📍 ${memory.name}</h3>
                    <div class="city-card-actions">
                        <button class="icon-btn edit-memory" data-id="${memory.id}">📝</button>
                        <button class="icon-btn delete delete-memory" data-id="${memory.id}">🗑️</button>
                    </div>
                </div>
                <div class="date">📅 ${memory.date}</div>
                <div class="preview">${memory.description || '暂无描述'}</div>
                ${memory.photos.length > 0 ? `<div style="margin-top:8px;font-size:13px;color:#999;">📸 ${memory.photos.length}张照片</div>` : ''}
            </div>
        `).join('');

        document.querySelectorAll('.city-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.city-card-actions')) {
                    this.showMemoryDetail(card.dataset.id);
                }
            });
        });

        document.querySelectorAll('.edit-memory').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openEditModal(btn.dataset.id);
            });
        });

        document.querySelectorAll('.delete-memory').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteMemory(btn.dataset.id);
            });
        });

        this.mapManager.updateMarkers(
            this.memoryManager.getAllMemories(), 
            this.currentMemoryId,
            (id) => this.showMemoryDetail(id)
        );
    }

    // ============ 城市详情 ============
    showMemoryDetail(id) {
        const memory = this.memoryManager.getMemoryById(id);
        if (!memory) return;

        this.currentMemoryId = id;
        document.getElementById('city-list').style.display = 'none';
        document.getElementById('city-detail').style.display = 'block';

        document.getElementById('detail-content').innerHTML = `
            <div class="detail-header">
                <h2 class="detail-city-name">📍 ${memory.name}</h2>
                <p class="detail-date">📅 ${memory.date}</p>
                <p style="font-size:12px;color:#bbb;">坐标: ${memory.coordinates[0].toFixed(4)}, ${memory.coordinates[1].toFixed(4)}</p>
            </div>
            <div class="detail-description">${memory.description || '还没有写下故事...'}</div>
            <div style="display:flex;gap:10px;margin-bottom:20px;">
                <button class="btn btn-primary edit-detail-btn" data-id="${memory.id}">✏️ 编辑</button>
                <button class="btn btn-secondary add-photos-btn" data-id="${memory.id}">📸 添加照片</button>
            </div>
            <div class="photo-gallery">
                ${memory.photos.length > 0 ? memory.photos.map((photo, index) => `
                    <div class="photo-item" onclick="ui.openPhotoViewer('${photo.url}', '${photo.caption || ''}')">
                        <img src="${photo.thumbnail || photo.url}" alt="${photo.caption || ''}" onerror="this.style.display='none'">
                        ${photo.caption ? `<div class="photo-overlay">${photo.caption}</div>` : ''}
                        <button onclick="event.stopPropagation();ui.removePhoto('${memory.id}',${index})"
                            style="position:absolute;top:5px;right:5px;background:rgba(255,0,0,0.8);color:white;border:none;width:24px;height:24px;border-radius:50%;cursor:pointer;z-index:10;">×</button>
                    </div>
                `).join('') : '<p style="color:#999;text-align:center;grid-column:1/-1;">还没有照片</p>'}
            </div>
        `;

        setTimeout(() => {
            document.querySelector('.edit-detail-btn')?.addEventListener('click', () => this.openEditModal(id));
            document.querySelector('.add-photos-btn')?.addEventListener('click', () => this.openAddPhotosModal(id));
        }, 0);

        this.mapManager.updateMarkers(
            this.memoryManager.getAllMemories(), 
            id,
            (mid) => this.showMemoryDetail(mid)
        );
        this.mapManager.flyTo(memory.coordinates);
    }

    // ============ 模态框 ============
    openAddModal() {
        this.editingMemoryId = null;
        document.getElementById('modal-title').textContent = '✨ 添加旅行记忆';
        document.getElementById('memory-form').reset();
        document.getElementById('memory-id').value = '';
        document.getElementById('latitude').value = '';
        document.getElementById('longitude').value = '';
        this.pendingPhotos = [];
        this.renderPhotoPreviews();
        document.getElementById('memory-modal').classList.add('show');
        setTimeout(() => this.initMapPicker(), 300);
    }

    openEditModal(id) {
        const memory = this.memoryManager.getMemoryById(id);
        if (!memory) return;

        this.editingMemoryId = id;
        document.getElementById('modal-title').textContent = '✏️ 编辑旅行记忆';
        document.getElementById('memory-id').value = id;
        document.getElementById('city-name').value = memory.name;
        document.getElementById('latitude').value = memory.coordinates[0];
        document.getElementById('longitude').value = memory.coordinates[1];
        document.getElementById('travel-date').value = memory.date;
        document.getElementById('description').value = memory.description || '';
        
        this.pendingPhotos = memory.photos.map(p => ({
            dataUrl: p.url,
            thumbnail: p.thumbnail || null,
            caption: p.caption || '',
            isExisting: true
        }));
        this.renderPhotoPreviews();
        
        document.getElementById('memory-modal').classList.add('show');
        setTimeout(() => this.initMapPicker(), 300);
    }

    openAddPhotosModal(id) {
        this.editingMemoryId = id;
        const memory = this.memoryManager.getMemoryById(id);
        if (!memory) return;
        this.pendingPhotos = memory.photos.map(p => ({
            dataUrl: p.url,
            thumbnail: p.thumbnail || null,
            caption: p.caption || '',
            isExisting: true
        }));
        document.getElementById('modal-title').textContent = '📸 添加照片';
        document.getElementById('memory-modal').classList.add('show');
    }

    closeModal() {
        document.getElementById('memory-modal').classList.remove('show');
        if (this.pickerMap) {
            this.pickerMap.remove();
            this.pickerMap = null;
            this.pickerMarker = null;
        }
        this.pendingPhotos = [];
        this.editingMemoryId = null;
    }

    // ============ 地图选择器 ============
    initMapPicker() {
        const mapPickerEl = document.getElementById('map-picker');
        if (!mapPickerEl) return;
        
        const latInput = document.getElementById('latitude');
        const lngInput = document.getElementById('longitude');
        const existingLat = parseFloat(latInput.value);
        const existingLng = parseFloat(lngInput.value);
        const initLat = !isNaN(existingLat) ? existingLat : 35.8617;
        const initLng = !isNaN(existingLng) ? existingLng : 104.1954;
        
        if (this.pickerMap) this.pickerMap.remove();
        
        this.pickerMap = L.map('map-picker').setView([initLat, initLng], 4);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 19
        }).addTo(this.pickerMap);
        
        if (!isNaN(existingLat) && !isNaN(existingLng)) {
            this.pickerMarker = L.marker([existingLat, existingLng], { draggable: true }).addTo(this.pickerMap);
            this.pickerMarker.on('dragend', () => {
                const pos = this.pickerMarker.getLatLng();
                latInput.value = pos.lat.toFixed(4);
                lngInput.value = pos.lng.toFixed(4);
            });
        }
        
        this.pickerMap.on('click', (e) => {
            const { lat, lng } = e.latlng;
            latInput.value = lat.toFixed(4);
            lngInput.value = lng.toFixed(4);
            
            if (this.pickerMarker) {
                this.pickerMarker.setLatLng([lat, lng]);
            } else {
                this.pickerMarker = L.marker([lat, lng], { draggable: true }).addTo(this.pickerMap);
                this.pickerMarker.on('dragend', () => {
                    const pos = this.pickerMarker.getLatLng();
                    latInput.value = pos.lat.toFixed(4);
                    lngInput.value = pos.lng.toFixed(4);
                });
            }
            this.showToast(`✅ 已选择: ${lat.toFixed(2)}, ${lng.toFixed(2)}`, 'success');
        });
        
        setTimeout(() => this.pickerMap.invalidateSize(), 200);
    }

    // ============ 表单提交 ============
    async handleFormSubmit(e) {
        e.preventDefault();

        const id = document.getElementById('memory-id').value;
        const name = document.getElementById('city-name').value.trim();
        const lat = parseFloat(document.getElementById('latitude').value);
        const lng = parseFloat(document.getElementById('longitude').value);
        const date = document.getElementById('travel-date').value.trim();
        const description = document.getElementById('description').value.trim();

        if (!name || isNaN(lat) || isNaN(lng) || !date) {
            this.showToast('请填写所有必填字段，并在地图上点击选择位置', 'error');
            return;
        }

        const photos = this.pendingPhotos.map(p => ({
            url: p.dataUrl,
            thumbnail: p.thumbnail || null,
            caption: p.caption || ''
        }));

        const memoryData = { name, coordinates: [lat, lng], date, description, photos };

        if (id) {
            this.memoryManager.updateMemory(id, memoryData);
            this.showToast('✅ 记忆更新成功！', 'success');
        } else {
            this.memoryManager.addMemory(memoryData);
            this.showToast('🎉 新记忆添加成功！', 'success');
        }

        this.closeModal();
        document.getElementById('city-detail').style.display = 'none';
        document.getElementById('city-list').style.display = 'block';
        this.renderCityList();
    }

    // ============ 删除 ============
    deleteMemory(id) {
        if (confirm('确定要删除吗？')) {
            this.memoryManager.deleteMemory(id);
            if (this.currentMemoryId === id) {
                this.currentMemoryId = null;
                document.getElementById('city-detail').style.display = 'none';
                document.getElementById('city-list').style.display = 'block';
            }
            this.renderCityList();
            this.showToast('🗑️ 已删除', 'success');
        }
    }

    removePhoto(memoryId, photoIndex) {
        const memory = this.memoryManager.getMemoryById(memoryId);
        if (!memory) return;
        if (confirm('确定删除这张照片吗？')) {
            memory.photos.splice(photoIndex, 1);
            this.memoryManager.updateMemory(memoryId, { photos: memory.photos });
            this.showMemoryDetail(memoryId);
            this.showToast('📸 照片已删除', 'success');
        }
    }

    // ============ 照片处理（ImgBB 优先，失败降级本地） ============
    async handlePhotoUpload(files) {
        let usedImgBB = false;
        
        // 尝试 ImgBB 上传
        if (typeof IMGBB_CONFIG !== 'undefined' && IMGBB_CONFIG.apiKey) {
            const imgbbUploader = new ImgBBUploader(IMGBB_CONFIG.apiKey);
            
            for (const file of files) {
                try {
                    this.showToast('📤 正在上传照片...', 'info');
                    const result = await imgbbUploader.upload(file);
                    
                    this.pendingPhotos.push({
                        dataUrl: result.url,
                        thumbnail: result.thumbnail,
                        caption: '',
                        isNew: true
                    });
                    usedImgBB = true;
                    this.showToast('✅ 照片上传成功！', 'success');
                } catch (error) {
                    console.warn('ImgBB 上传失败，降级为本地存储:', error);
                }
            }
        }
        
        // 降级：本地压缩存储
        if (!usedImgBB) {
            for (const file of files) {
                try {
                    const compressed = await this.photoManager.compressImage(file);
                    this.pendingPhotos.push({
                        dataUrl: compressed,
                        thumbnail: null,
                        caption: '',
                        isNew: true
                    });
                } catch (error) {
                    this.showToast('❌ 照片处理失败', 'error');
                }
            }
        }
        
        this.renderPhotoPreviews();
    }

    renderPhotoPreviews() {
        const previewsContainer = document.getElementById('photo-previews');
        const placeholder = document.getElementById('upload-placeholder');

        if (this.pendingPhotos.length > 0) {
            placeholder.style.display = 'none';
            previewsContainer.innerHTML = this.pendingPhotos.map((photo, index) => `
                <div class="preview-item">
                    <img src="${photo.thumbnail || photo.dataUrl}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%23ddd%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2212%22>加载中</text></svg>'">
                    <button class="remove-photo" onclick="ui.removePendingPhoto(${index})">×</button>
                    <input type="text" class="photo-caption-input" 
                           placeholder="照片说明" value="${photo.caption || ''}"
                           onchange="ui.updatePhotoCaption(${index}, this.value)"
                           style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.7);color:white;border:none;padding:5px;font-size:12px;">
                </div>
            `).join('');
        } else {
            placeholder.style.display = 'block';
            previewsContainer.innerHTML = '';
        }
    }

    removePendingPhoto(index) {
        this.pendingPhotos.splice(index, 1);
        this.renderPhotoPreviews();
    }

    updatePhotoCaption(index, caption) {
        if (this.pendingPhotos[index]) this.pendingPhotos[index].caption = caption;
    }

    // ============ 照片查看器 ============
    openPhotoViewer(url, caption) {
        document.getElementById('viewer-image').src = url;
        document.getElementById('viewer-caption').textContent = caption || '';
        document.getElementById('photo-viewer').classList.add('show');
    }

    closePhotoViewer() {
        document.getElementById('photo-viewer').classList.remove('show');
    }

    // ============ Toast ============
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // ============ 事件绑定 ============
    bindEvents() {
        document.getElementById('add-memory-btn').addEventListener('click', () => this.openAddModal());
        
        document.getElementById('sync-data-btn')?.addEventListener('click', async () => {
            const success = await this.memoryManager.loadFromCloud();
            this.renderCityList();
            this.showToast(success ? '✅ 同步成功' : '❌ 同步失败', success ? 'success' : 'error');
        });

        document.querySelector('.close-modal').addEventListener('click', () => this.closeModal());
        document.querySelector('.close-modal-btn')?.addEventListener('click', () => this.closeModal());

        document.getElementById('memory-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeModal();
        });

        document.getElementById('memory-form').addEventListener('submit', (e) => this.handleFormSubmit(e));

        const photoArea = document.getElementById('photo-upload-area');
        const photoInput = document.getElementById('photos-upload');
        photoArea.addEventListener('click', () => photoInput.click());
        photoInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) this.handlePhotoUpload(e.target.files);
        });

        photoArea.addEventListener('dragover', (e) => { e.preventDefault(); photoArea.style.borderColor = '#4ecdc4'; });
        photoArea.addEventListener('dragleave', () => { photoArea.style.borderColor = '#ddd'; });
        photoArea.addEventListener('drop', (e) => {
            e.preventDefault();
            photoArea.style.borderColor = '#ddd';
            if (e.dataTransfer.files.length > 0) this.handlePhotoUpload(e.dataTransfer.files);
        });

        document.getElementById('back-btn').addEventListener('click', () => {
            document.getElementById('city-detail').style.display = 'none';
            document.getElementById('city-list').style.display = 'block';
            this.currentMemoryId = null;
            this.renderCityList();
        });

        let searchTimeout;
        document.getElementById('search-input').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.renderCityList(e.target.value), 300);
        });

        document.querySelector('.close-viewer').addEventListener('click', () => this.closePhotoViewer());
        document.getElementById('photo-viewer').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closePhotoViewer();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (document.getElementById('memory-modal').classList.contains('show')) {
                    this.closeModal();
                } else if (document.getElementById('photo-viewer').classList.contains('show')) {
                    this.closePhotoViewer();
                }
            }
        });
    }
}
