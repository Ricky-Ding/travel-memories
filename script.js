// ============ 数据管理类 ============
class MemoryManager {
    constructor() {
        this.memories = [];
        this.storageKey = 'travel_memories';
        this.apiKey = 'YOUR_JSONBIN_API_KEY'; // 注册 https://jsonbin.io 获取
        this.binId = 'YOUR_BIN_ID'; // 创建 Bin 后获取
        this.loadMemories();
    }

    // 从 LocalStorage 加载数据
    loadMemories() {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            this.memories = JSON.parse(stored);
        } else {
            // 加载默认示例数据
            this.memories = this.getDefaultMemories();
            this.saveMemories();
        }
        return this.memories;
    }

    // 获取默认示例数据
    getDefaultMemories() {
        return [
            {
                id: this.generateId(),
                name: '北京',
                coordinates: [39.9042, 116.4074],
                date: '2023年10月',
                description: '我们的第一次旅行，在北京的胡同里漫步，感受古都的魅力。一起登上了长城，在故宫的红墙下留下了我们的足迹。',
                photos: [],
                createdAt: new Date().toISOString()
            },
            {
                id: this.generateId(),
                name: '上海',
                coordinates: [31.2304, 121.4737],
                date: '2023年12月',
                description: '跨年夜在外滩，看着黄浦江两岸的灯火，我们许下了新年的愿望。',
                photos: [],
                createdAt: new Date().toISOString()
            }
        ];
    }

    // 保存到 LocalStorage
    saveMemories() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.memories));
        this.syncToCloud(); // 可选：同步到云端
    }

    // 生成唯一ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // 获取所有记忆
    getAllMemories() {
        return [...this.memories].sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
    }

    // 根据ID获取记忆
    getMemoryById(id) {
        return this.memories.find(m => m.id === id);
    }

    // 添加记忆
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

    // 更新记忆
    updateMemory(id, updates) {
        const index = this.memories.findIndex(m => m.id === id);
        if (index !== -1) {
            this.memories[index] = { ...this.memories[index], ...updates };
            this.saveMemories();
            return this.memories[index];
        }
        return null;
    }

    // 删除记忆
    deleteMemory(id) {
        this.memories = this.memories.filter(m => m.id !== id);
        this.saveMemories();
    }

    // 搜索记忆
    searchMemories(query) {
        const q = query.toLowerCase();
        return this.memories.filter(m => 
            m.name.toLowerCase().includes(q) ||
            m.description.toLowerCase().includes(q) ||
            m.date.includes(q)
        );
    }

    // 同步到云端（使用 JSONBin.io）
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
            
            if (response.ok) {
                console.log('✅ 数据已同步到云端');
            }
        } catch (error) {
            console.error('同步失败:', error);
        }
    }

    // 从云端加载数据
    async loadFromCloud() {
        if (!this.apiKey || !this.binId) return;
        
        try {
            const response = await fetch(`https://api.jsonbin.io/v3/b/${this.binId}/latest`, {
                headers: {
                    'X-Master-Key': this.apiKey
                }
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
        this.maxFileSize = 5 * 1024 * 1024; // 5MB
        this.allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    }

    // 将文件转换为 Base64
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            // 验证文件大小
            if (file.size > this.maxFileSize) {
                reject(new Error(`文件 ${file.name} 超过5MB限制`));
                return;
            }

            // 验证文件类型
            if (!this.allowedTypes.includes(file.type)) {
                reject(new Error(`文件 ${file.name} 格式不支持`));
                return;
            }

            const reader = new FileReader();
            reader.onload = () => resolve({
                dataUrl: reader.result,
                name: file.name,
                type: file.type
            });
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // 压缩图片（可选，节省存储空间）
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
        
        this.initMap();
        this.bindEvents();
        this.renderCityList();
    }

    // 初始化地图
    initMap() {
        this.map = L.map('map').setView([35.8617, 104.1954], 4);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);
    }

    // 创建自定义图标
    createIcon(isActive = false) {
        const color = isActive ? '#ff6b6b' : '#4ecdc4';
        return L.divIcon({
            className: 'custom-marker',
            html: `
                <div style="
                    width: 30px;
                    height: 30px;
                    background: ${color};
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    border: 3px solid white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    transition: all 0.3s;
                "></div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
    }

    // 更新地图标记
    updateMapMarkers() {
        // 清除旧标记
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];

        const memories = this.memoryManager.getAllMemories();
        
        memories.forEach(memory => {
            const marker = L.marker(memory.coordinates, {
                icon: this.createIcon(memory.id === this.currentMemoryId)
            }).addTo(this.map);

            marker.bindTooltip(memory.name, {
                permanent: false,
                direction: 'top'
            });

            marker.on('click', () => {
                this.showMemoryDetail(memory.id);
                this.map.flyTo(memory.coordinates, 10, { duration: 2 });
            });

            this.markers.push(marker);
        });

        // 自动调整视图
        if (this.markers.length > 0) {
            const group = L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds().pad(0.1));
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
                        <button class="icon-btn edit-memory" data-id="${memory.id}" 
                                title="编辑">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="icon-btn delete delete-memory" data-id="${memory.id}" 
                                title="删除">
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
                    const memory = this.memoryManager.getMemoryById(id);
                    if (memory) {
                        this.map.flyTo(memory.coordinates, 10, { duration: 2 });
                    }
                }
            });
        });

        // 绑定编辑按钮
        document.querySelectorAll('.edit-memory').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openEditModal(btn.dataset.id);
            });
        });

        // 绑定删除按钮
        document.querySelectorAll('.delete-memory').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteMemory(btn.dataset.id);
            });
        });

        this.updateMapMarkers();
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
                            <img src="${photo.url
