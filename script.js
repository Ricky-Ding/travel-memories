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
        this.globe = null;
        this.markers = [];
        this.currentMemoryId = null;
        this.pendingPhotos = [];
        this.editingMemoryId = null;
        
        this.initGlobe();
        this.bindEvents();
        this.renderCityList();
    }

    // 🌍 初始化 3D 地球
    initGlobe() {
        const container = document.getElementById('map');
        
        this.globe = Globe()
            .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
            .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
            .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
            .showAtmosphere(true)
            .atmosphereColor('#4a90e2')
            .atmosphereAltitude(0.25)
            .pointsData([])
            .pointColor(() => '#ff6b6b')
            .pointAltitude(0.01)
            .pointRadius(0.5)
            .pointsMerge(true)
            (container);
        
        // 启用自动旋转
        this.globe.controls().autoRotate = true;
        this.globe.controls().autoRotateSpeed = 0.5;
        
        // 响应式调整
        window.addEventListener('resize', () => {
            this.globe.width([container.clientWidth]);
            this.globe.height([container.clientHeight]);
        });
        
        this.updateGlobeMarkers();
    }

    // 更新地球上的标记
    updateGlobeMarkers() {
        const memories = this.memoryManager.getAllMemories();
        
        const pointsData = memories.map(memory => ({
            lat: memory.coordinates[0],
            lng: memory.coordinates[1],
            size: memory.id === this.currentMemoryId ? 1.2 : 0.8,
            color: memory.id === this.currentMemoryId ? '#ff4757' : '#ff6b6b',
            name: memory.name,
            id: memory.id
        }));
        
        this.globe.pointsData(pointsData);
        
        // 点击标记事件
        this.globe.onPointClick((point) => {
            this.showMemoryDetail(point.id);
            // 旋转地球到该位置
            this.globe.pointOfView({
                lat: point.lat,
                lng: point.lng,
                altitude: 2.5
            }, 1000);
        });
        
        // 悬停提示
        this.globe.pointLabel(d => d.name);
        
        // 自动调整视图
        if (pointsData.length > 0) {
            const firstPoint = pointsData[0];
            this.globe.pointOfView({
                lat: firstPoint.lat,
                lng: firstPoint.lng,
                altitude: 2.5
            }, 1000);
        }
    }

    // 渲染城市列表
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
                    <i class="fas fa-globe-americas"></i>
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

        // 绑定卡片事件
        document.querySelectorAll('.city-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.city-card-actions')) {
                    const id = card.dataset.id;
                    this.showMemoryDetail(id);
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

        this.updateGlobeMarkers();
    }

    // 显示记忆详情
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
                                           border-radius: 50%; cursor: pointer;">
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

        this.updateGlobeMarkers();
        
        // 旋转地球到该城市
        this.globe.pointOfView({
            lat: memory.coordinates[0],
            lng: memory.coordinates[1],
            altitude: 1.5
        }, 1000);
    }

    openAddModal() {
        this.editingMemoryId = null;
        document.getElementById('modal-title').textContent = '✨ 添加旅行记忆';
        document.getElementById('memory-form').reset();
        document.getElementById('memory-id').value = '';
        this.pendingPhotos = [];
        this.renderPhotoPreviews();
        document.getElementById('memory-modal').classList.add('show');
        setTimeout(() => this.initMapPicker(), 100);
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
        setTimeout(() => this.initMapPicker(), 100);
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
            this.showToast('请填写所有必填字段', 'error');
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

    initMapPicker() {
        // 简化版地图选择器
        const latInput = document.getElementById('latitude');
        const lngInput = document.getElementById('longitude');
        
        // 提供快速选择中国主要城市的按钮
        const mapPickerEl = document.getElementById('map-picker');
        if (mapPickerEl) {
            const cities = [
                { name: '北京', lat: 39.9042, lng: 116.4074 },
                { name: '上海', lat: 31.2304, lng: 121.4737 },
                { name: '广州', lat: 23.1291, lng: 113.2644 },
                { name: '深圳', lat: 22.5431, lng: 114.0579 },
                { name: '成都', lat: 30.5728, lng: 104.0668 },
                { name: '杭州', lat: 30.2741, lng: 120.1551 },
                { name: '西安', lat: 34.3416, lng: 108.9398 },
                { name: '重庆', lat: 29.4316, lng: 106.9123 },
                { name: '南京', lat: 32.0603, lng: 118.7969 },
                { name: '武汉', lat: 30.5928, lng: 114.3055 },
                { name: '厦门', lat: 24.4798, lng: 118.0894 },
                { name: '三亚', lat: 18.2528, lng: 109.5120 },
                { name: '大理', lat: 25.5916, lng: 100.2299 },
                { name: '丽江', lat: 26.8721, lng: 100.2299 },
                { name: '拉萨', lat: 29.6500, lng: 91.1000 },
                { name: '哈尔滨', lat: 45.8038, lng: 126.5350 },
                { name: '青岛', lat: 36.0671, lng: 120.3826 },
                { name: '苏州', lat: 31.2990, lng: 120.5853 },
                { name: '桂林', lat: 25.2736, lng: 110.2900 },
                { name: '长沙', lat: 28.2282, lng: 112.9388 }
            ];
            
            mapPickerEl.innerHTML = `
                <div style="padding: 15px; height: 100%; overflow-y: auto;">
                    <p style="margin-bottom: 10px; color: #666; font-size: 14px;">
                        <i class="fas fa-hand-pointer"></i> 点击选择城市，或手动输入经纬度
                    </p>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                        ${cities.map(city => `
                            <button type="button" class="city-quick-btn" 
                                    data-lat="${city.lat}" data-lng="${city.lng}"
                                    style="padding: 8px; border: 1px solid #ddd; border-radius: 8px; 
                                           background: white; cursor: pointer; font-size: 13px;
                                           transition: all 0.2s;">
                                ${city.name}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
            
            // 绑定快速选择按钮
            mapPickerEl.querySelectorAll('.city-quick-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const lat = this.dataset.lat;
                    const lng = this.dataset.lng;
                    latInput.value = lat;
                    lngInput.value = lng;
                    
                    // 高亮选中按钮
                    mapPickerEl.querySelectorAll('.city-quick-btn').forEach(b => {
                        b.style.background = 'white';
                        b.style.color = '#333';
                    });
                    this.style.background = '#667eea';
                    this.style.color = 'white';
                });
            });
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
            this.updateGlobeMarkers();
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

// 导出/导入按钮
document.getElementById('export-data-btn')?.addEventListener('click', exportData);
document.getElementById('import-data-input')?.addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
});

console.log('🌍 3D 地球旅行记忆地图已就绪！');
