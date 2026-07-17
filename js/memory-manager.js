// ============ 数据管理类 ============
class MemoryManager {
    constructor() {
        this.memories = [];
        this.loadMemories();
    }

    loadMemories() {
        const stored = localStorage.getItem(CONFIG.storageKey);
        if (stored) {
            this.memories = JSON.parse(stored);
        } else {
            this.memories = this.getDefaultMemories();
            this.saveMemories();
        }
        return this.memories;
    }

    getDefaultMemories() {
        // 在这里修改默认示例城市
        return [
            {
                id: this.generateId(),
                name: '北京',
                coordinates: [39.9042, 116.4074],
                date: '2023年10月',
                description: '我们的第一次旅行，在北京的胡同里漫步。',
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
        localStorage.setItem(CONFIG.storageKey, JSON.stringify(this.memories));
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
        if (!CONFIG.apiKey || !CONFIG.binId) return;
        try {
            await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': CONFIG.apiKey
                },
                body: JSON.stringify({ memories: this.memories })
            });
            console.log('✅ 数据已同步');
        } catch (error) {
            console.error('同步失败:', error);
        }
    }

    async loadFromCloud() {
        if (!CONFIG.apiKey || !CONFIG.binId) return false;
        try {
            const response = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.binId}/latest`, {
                headers: { 'X-Master-Key': CONFIG.apiKey }
            });
            if (response.ok) {
                const data = await response.json();
                this.memories = data.record.memories || [];
                this.saveMemories();
                return true;
            }
        } catch (error) {
            console.error('加载失败:', error);
        }
        return false;
    }
}
