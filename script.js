// ============ 数据管理类 ============
class MemoryManager {
    constructor() {
        this.memories = [];
        this.storageKey = 'travel_memories';
        this.apiKey = '$2a$10$F86ANUc7v/rvTzIIDo3HKOzBEsjNvWirQGPAZqlf6PuS99QJ1X4om'; // 注册 https://jsonbin.io 获取
        this.binId = '6a59dd0ada38895dfe69b8f9'; // 创建 Bin 后获取
        this.loadMemories();
    }

    loadMemories() {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            this.memories = JSON.parse(stored);
        } else {
            this.memories = this.getDefaultMemories();
            this.saveMemories();
        }
        return this.memories;
    }

    getDefaultMemories() {
        return [
            {
                id: this.generateId(),
                name: '北京',
                coordinates: [39.9042, 116.4074],
                date: '2023年10月',
                description: '我们的第一次旅行，在北京的胡同里漫步，感受古都的魅力。',
                photos: [],
                createdAt: new Date().toISOString()
            },
            {
                id: this.generateId(),
                name: '上海',
                coordinates: [31.2304, 121.4737],
                date: '2023年12月',
                description: '跨年夜在外滩，看着黄浦江两岸的灯火。',
                photos: [],
                createdAt: new Date().toISOString()
            }
        ];
    }

    saveMemories() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.memories));
        this.syncToCloud();
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    getAllMemories() {
        return [...this.memories].sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
    }

    getMemoryById(id) {
        return this.memories.find(m => m.id === id);
    }

    addMemory(memory) {
        const newMemory = {
            ...memory,
            id: this.generateId(),
            createdAt: new Date().toISOString()
        };
        this.memories.push(newMemory);
        this.saveMemories();
        return newMemory;
    }

    updateMemory(id, updates) {
        const index = this.memories.findIndex(m => m.id === id);
        if (index !== -1) {
            this.memories[index] = { ...this.memories[index], ...updates };
            this.saveMemories();
            return this.memories[index];
        }
        return null;
    }

    deleteMemory(id) {
        this.memories = this.memories.filter(m => m.id !== id);
        this.saveMemories();
    }

    searchMemories(query) {
        const q = query.toLowerCase();
        return this.memories.filter(m => 
            m.name.toLowerCase().includes(q) ||
            m.description.toLowerCase().includes(q) ||
            m.date.includes(q)
        );
    }

    async syncToCloud() {
        if (!this.apiKey || !this.binId) return;
        try {
            const response = await fetch(`https://api.jsonbin.io/v3/b/${this.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.apiKey
                },
                body: JSON.stringify({ memories: this.memories })
            });
            if (response.ok) console.log('✅ 数据已同步到云端');
        } catch (error) {
            console.error('同步失败:', error);
        }
    }

    async loadFromCloud() {
        if (!this.apiKey || !this.binId) return false;
        try {
            const response = await fetch(`https://api.jsonbin.io/v3/b/${this.binId}/latest`, {
                headers: { 'X-Master-Key': this.apiKey }
            });
            if (response.ok) {
                const data = await response.json();
                this.memories = data.record.memories || [];
                this.saveMemories();
                return true;
            }
        } catch (error) {
            console.error('加载云端数据失败:', error);
        }
        return false;
    }
}

// ============ 照片处理类 ============
class PhotoManager {
    constructor() {
        this.maxFileSize = 5 * 1024 * 1024;
        this.allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    }

    async compressImage(file, maxWidth = 800) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    if (width > maxWidth) {
                        height = (maxWidth / width) * height;
                        width = maxWidth;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
}

// ============ UI 管理类 ============
class UIManager {
    constructor(memoryManager, photoManager) {
        this.memoryManager = memoryManager;
        this.photoManager = photoManager;
        this.map = null;
        this.markers = [];
        this.currentMemoryId = null;
        this.pendingPhotos = [];
        this.editingMemoryId = null;
        this.pickerMap = null;
        this.pickerMarker = null;
        
        this.initMap();
        this.bindEvents();
        this.renderCityList();
    }

    initMap() {
        this.map = L.map('map').setView([35.8617, 104.1954], 4);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);
        
        // 点击地图空白处取消选中
        this.map.on('click', () => {
            if (this.currentMemoryId) {
                document.getElementById('back-btn').click();
            }
        });
    }

    createIcon(isActive = false) {
        const color = isActive ? '#ff4757' : '#ff6b6b';
        const size = isActive ? 36 : 28;
        return L.divIcon({
            className: 'custom-marker',
            html: `
                <div style="
                    width: ${size}px;
                    height: ${size}px;
                    background: ${color};
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    border: 3px solid white;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.3);
                    transition: all 0.3s;
                "></div>
            `,
            iconSize: [size, size],
            iconAnchor: [size/2, size/2]
        });
    }

    updateMapMarkers() {
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];

        const memories = this.memoryManager.getAllMemories();
        
        memories.forEach(memory => {
            const marker = L.marker(memory.coordinates, {
                icon: this.createIcon(memory.id === this.currentMemoryId)
            }).addTo(this.map);

            marker.bindTooltip(memory.name, {
                permanent: false,
                direction: 'top',
                offset: [0, -15]
            });

            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                this.showMemoryDetail(memory.id);
                this.map.flyTo(memory.coordinates, 10, { duration: 1.5 });
            });

            this.markers.push(marker);
        });

        if (this.markers.length > 0) {
            const group = L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
    }

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
                </div>
            `;
            return;
        }

        cityList.innerHTML = memories.map(memory => `
            <div class="city-card ${memory.id === this.currentMemoryId ? 'active' : ''}" 
                 data-id="${memory.id}">
                <div class="city-card-header">
                    <h3>📍 ${memory.name}</h3>
                    <div class="city-card-actions">
                        <button class="icon-btn edit-memory" data-id="${memory.id}" title="编辑">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="icon-btn delete delete-memory" data-id="${memory.id}" title="删除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="date">📅 ${memory.date}</div>
                <div class="preview">${memory.description || '暂无描述'}</div>
                ${memory.photos && memory.photos.length > 0 ? 
                    `<div style="margin-top: 10px; font-size: 13px; color: #999;">
                        📸 ${memory.photos.length} 张照片
                    </div>` : ''}
            </div>
        `).join('');

        document.querySelectorAll('.city-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.city-card-actions')) {
                    const id = card.dataset.id;
                    this.showMemoryDetail(id);
                    const memory = this.memoryManager.getMemoryById(id);
                    if (memory) {
                        this.map.flyTo(memory.coordinates, 10, { duration: 1.5 });
                    }
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

        this.updateMapMarkers();
    }

    showMemoryDetail(id) {
        const memory = this.memoryManager.getMemoryById(id);
        if (!memory) return;

        this.currentMemoryId = id;
        document.getElementById('city-list').style.display = 'none';
        document.getElementById('city-detail').style.display = 'block';

        const detailContent = document.getElementById('detail-content');
        detailContent.innerHTML = `
            <div class="detail-header">
                <h2 class="detail-city-name">📍 ${memory.name}</h2>
                <p class="detail-date">📅 ${memory.date}</p>
                <p style="font-size: 12px; color: #bbb; margin-top: 5px;">
                    坐标: ${memory.coordinates[0].toFixed(4)}, ${memory.coordinates[1].toFixed(4)}
                </p>
            </div>
            
            <div class="detail-description">
                ${memory.description || '还没有写下故事...'}
            </div>
            
            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                <button class="btn btn-primary btn-sm edit-detail-btn" data-id="${memory.id}">
                    <i class="fas fa-edit"></i> 编辑
                </button>
                <button class="btn btn-secondary btn-sm add-photos-btn" data-id="${memory.id}">
                    <i class="fas fa-camera"></i> 添加照片
                </button>
            </div>
            
            <div class="photo-gallery">
                ${memory.photos && memory.photos.length > 0 ? 
                    memory.photos.map((photo, index) => `
                        <div class="photo-item" onclick="ui.openPhotoViewer('${photo.url}', '${photo.caption || ''}')">
                            <img src="${photo.url}" alt="${photo.caption || ''}">
                            ${photo.caption ? `<div class="photo-overlay">${photo.caption}</div>` : ''}
                            <button class="remove-photo-btn" 
                                    onclick="event.stopPropagation(); ui.removePhoto('${memory.id}', ${index})"
                                    style="position: absolute; top: 5px; right: 5px; 
                                           background: rgba(255,0,0,0.8); color: white; 
                                           border: none; width: 24px; height: 24px; 
                                           border-radius: 50%; cursor: pointer; z-index: 10;">
                                ×
                            </button>
                        </div>
                    `).join('') : 
                    '<p style="color: #999; text-align: center; grid-column: 1/-1;">还没有照片</p>'
                }
            </div>
        `;

        setTimeout(() => {
            const editBtn = document.querySelector('.edit-detail-btn');
            const addPhotosBtn = document.querySelector('.add-photos-btn');
            if (editBtn) editBtn.addEventListener('click', () => this.openEditModal(id));
            if (addPhotosBtn) addPhotosBtn.addEventListener('click', () => this.openAddPhotosModal(id));
        }, 0);

        this.updateMapMarkers();
    }

    // ============ 🔥 核心功能：点击地图选坐标 ============
    initMapPicker() {
        const mapPickerEl = document.getElementById('map-picker');
        if (!mapPickerEl) return;
        
        const latInput = document.getElementById('latitude');
        const lngInput = document.getElementById('longitude');
        
        // 如果已有坐标，用已有的
        const existingLat = parseFloat(latInput.value);
        const existingLng = parseFloat(lngInput.value);
        const initLat = !isNaN(existingLat) ? existingLat : 35.8617;
        const initLng = !isNaN(existingLng) ? existingLng : 104.1954;
        
        // 初始化小地图
        if (this.pickerMap) {
            this.pickerMap.remove();
        }
        
        this.pickerMap = L.map('map-picker').setView([initLat, initLng], 4);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 19
        }).addTo(this.pickerMap);
        
        // 如果已有坐标，显示标记
        if (!isNaN(existingLat) && !isNaN(existingLng)) {
            this.pickerMarker = L.marker([existingLat, existingLng], {
                draggable: true
            }).addTo(this.pickerMap);
            
            // 拖拽标记时更新输入框
            this.pickerMarker.on('dragend', () => {
                const pos = this.pickerMarker.getLatLng();
                latInput.value = pos.lat.toFixed(4);
                lngInput.value = pos.lng.toFixed(4);
            });
        }
        
        // 点击地图放置/移动标记
        this.pickerMap.on('click', (e) => {
            const { lat, lng } = e.latlng;
            latInput.value = lat.toFixed(4);
            lngInput.value = lng.toFixed(4);
            
            if (this.pickerMarker) {
                this.pickerMarker.setLatLng([lat, lng]);
            } else {
                this.pickerMarker = L.marker([lat, lng], {
                    draggable: true
                }).addTo(this.pickerMap);
                
                this.pickerMarker.on('dragend', () => {
                    const pos = this.pickerMarker.getLatLng();
                    latInput.value = pos.lat.toFixed(4);
                    lngInput.value = pos.lng.toFixed(4);
                });
            }
            
            this.showToast(`✅ 已选择: ${lat.toFixed(2)}, ${lng.toFixed(2)}`, 'success');
        });
        
        // 监听手动输入，更新地图标记
        const updateMarkerFromInput = () => {
            const lat = parseFloat(latInput.value);
            const lng = parseFloat(lngInput.value);
            if (!isNaN(lat) && !isNaN(lng)) {
                if (this.pickerMarker) {
                    this.pickerMarker.setLatLng([lat, lng]);
                } else {
                    this.pickerMarker = L.marker([lat, lng], {
                        draggable: true
                    }).addTo(this.pickerMap);
                    this.pickerMarker.on('dragend', () => {
                        const pos = this.pickerMarker.getLatLng();
                        latInput.value = pos.lat.toFixed(4);
                        lngInput.value = pos.lng.toFixed(4);
                    });
                }
                this.pickerMap.setView([lat, lng], 8);
            }
        };
        
        latInput.addEventListener('change', updateMarkerFromInput);
        lngInput.addEventListener('change', updateMarkerFromInput);
        
        // 修复小地图显示问题
        setTimeout(() => {
            this.pickerMap.invalidateSize();
        }, 200);
    }

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
        
        // 初始化地图选择器
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
        
        this.pendingPhotos = (memory.photos || []).map(p => ({
            dataUrl: p.url,
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
        this.pendingPhotos = (memory.photos || []).map(p => ({
            dataUrl: p.url,
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
            caption: p.caption || ''
        }));

        const memoryData = { name, coordinates: [lat, lng], date, description, photos };

        try {
            if (id) {
                this.memoryManager.updateMemory(id, memoryData);
                this.showToast('✅ 记忆更新成功！', 'success');
            } else {
                this.memoryManager.addMemory(memoryData);
                this.showToast('🎉 新记忆添加成功！', 'success');
            }

            this.closeModal();
            
            if (this.currentMemoryId) {
                this.showMemoryDetail(this.currentMemoryId);
            }
            document.getElementById('city-detail').style.display = 'none';
            document.getElementById('city-list').style.display = 'block';
            this.renderCityList();
            
        } catch (error) {
            console.error('保存失败:', error);
            this.showToast('❌ 保存失败，请重试', 'error');
        }
    }

    deleteMemory(id) {
        if (confirm('确定要删除这段旅行记忆吗？此操作不可撤销！')) {
            this.memoryManager.deleteMemory(id);
            if (this.currentMemoryId === id) {
                this.currentMemoryId = null;
                document.getElementById('city-detail').style.display = 'none';
                document.getElementById('city-list').style.display = 'block';
            }
            this.renderCityList();
            this.showToast('🗑️ 记忆已删除', 'success');
        }
    }

    removePhoto(memoryId, photoIndex) {
        const memory = this.memoryManager.getMemoryById(memoryId);
        if (!memory) return;
        if (confirm('确定要删除这张照片吗？')) {
            memory.photos.splice(photoIndex, 1);
            this.memoryManager.updateMemory(memoryId, { photos: memory.photos });
            this.showMemoryDetail(memoryId);
            this.showToast('📸 照片已删除', 'success');
        }
    }

    async handlePhotoUpload(files) {
        for (const file of files) {
            try {
                const compressed = await this.photoManager.compressImage(file);
                this.pendingPhotos.push({
                    dataUrl: compressed,
                    caption: '',
                    isNew: true
                });
            } catch (error) {
                this.showToast(error.message, 'error');
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
                    <img src="${photo.dataUrl}" alt="">
                    <button class="remove-photo" onclick="ui.removePendingPhoto(${index})">×</button>
                    <input type="text" class="photo-caption-input" 
                           placeholder="照片说明" value="${photo.caption || ''}"
                           onchange="ui.updatePhotoCaption(${index}, this.value)"
                           style="position: absolute; bottom: 0; left: 0; right: 0; 
                                  background: rgba(0,0,0,0.7); color: white; border: none; 
                                  padding: 5px; font-size: 12px;">
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
        if (this.pendingPhotos[index]) {
            this.pendingPhotos[index].caption = caption;
        }
    }

    openPhotoViewer(url, caption) {
        const viewer = document.getElementById('photo-viewer');
        document.getElementById('viewer-image').src = url;
        document.getElementById('viewer-caption').textContent = caption || '';
        viewer.classList.add('show');
    }

    closePhotoViewer() {
        document.getElementById('photo-viewer').classList.remove('show');
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    bindEvents() {
        document.getElementById('add-memory-btn').addEventListener('click', () => this.openAddModal());
        
        document.getElementById('sync-data-btn')?.addEventListener('click', async () => {
            const success = await this.memoryManager.loadFromCloud();
            if (success) {
                this.renderCityList();
                this.showToast('✅ 数据同步成功！', 'success');
            } else {
                this.showToast('❌ 同步失败', 'error');
            }
        });

        document.querySelector('.close-modal').addEventListener('click', () => this.closeModal());
        document.querySelector('.close-modal-btn')?.addEventListener('click', () => this.closeModal());

        document.getElementById('memory-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeModal();
        });

        document.getElementById('memory-form').addEventListener('submit', (e) => this.handleFormSubmit(e));

        const photoUploadArea = document.getElementById('photo-upload-area');
        const photoInput = document.getElementById('photos-upload');

        photoUploadArea.addEventListener('click', () => photoInput.click());

        photoInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) this.handlePhotoUpload(e.target.files);
        });

        photoUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            photoUploadArea.style.borderColor = '#4ecdc4';
        });

        photoUploadArea.addEventListener('dragleave', () => {
            photoUploadArea.style.borderColor = '#ddd';
        });

        photoUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            photoUploadArea.style.borderColor = '#ddd';
            if (e.dataTransfer.files.length > 0) this.handlePhotoUpload(e.dataTransfer.files);
        });

        document.getElementById('back-btn').addEventListener('click', () => {
            document.getElementById('city-detail').style.display = 'none';
            document.getElementById('city-list').style.display = 'block';
            this.currentMemoryId = null;
            this.updateMapMarkers();
            if (this.markers.length > 0) {
                const group = L.featureGroup(this.markers);
                this.map.fitBounds(group.getBounds().pad(0.1));
            }
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
                } else if (this.currentMemoryId) {
                    document.getElementById('back-btn').click();
                }
            }
        });
    }
}

// ============ 导出/导入功能 ============
function exportData() {
    const memories = memoryManager.getAllMemories();
    const dataStr = JSON.stringify({ memories }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `travel-memories-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    ui.showToast('📥 数据导出成功！', 'success');
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.memories && Array.isArray(data.memories)) {
                memoryManager.memories = data.memories;
                memoryManager.saveMemories();
                ui.renderCityList();
                ui.showToast('📤 数据导入成功！', 'success');
            } else {
                ui.showToast('❌ 文件格式不正确', 'error');
            }
        } catch (error) {
            ui.showToast('❌ 文件解析失败', 'error');
        }
    };
    reader.readAsText(file);
}

// ============ 初始化 ============
const memoryManager = new MemoryManager();
const photoManager = new PhotoManager();
const ui = new UIManager(memoryManager, photoManager);
window.ui = ui;

document.getElementById('export-data-btn')?.addEventListener('click', exportData);
document.getElementById('import-data-input')?.addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
});

console.log('💑 旅行记忆地图已就绪！');
console.log('🖱️ 添加城市时，直接在地图上点击即可自动获取经纬度');
