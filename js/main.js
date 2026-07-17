// ============ 主入口 ============
const memoryManager = new MemoryManager();
const photoManager = new PhotoManager();
const mapManager = new MapManager();
const ui = new UIManager(memoryManager, photoManager, mapManager);
window.ui = ui;

// 启动时自动从云端加载最新数据
(async () => {
    await memoryManager.autoLoadFromCloud();
    ui.renderCityList();
    console.log('💑 旅行记忆地图已就绪！（自动同步模式）');
})();

// 导出功能
document.getElementById('export-data-btn')?.addEventListener('click', () => {
    const memories = memoryManager.getAllMemories();
    const dataStr = JSON.stringify({ memories }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `travel-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    ui.showToast('📥 导出成功', 'success');
});

// 导入功能
document.getElementById('import-data-input')?.addEventListener('change', (e) => {
    if (!e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.memories) {
                memoryManager.memories = data.memories;
                memoryManager.saveMemories();
                ui.renderCityList();
                ui.showToast('📤 导入成功', 'success');
            }
        } catch (error) {
            ui.showToast('❌ 文件格式错误', 'error');
        }
    };
    reader.readAsText(e.target.files[0]);
});
