// ============ 地图管理类 ============
class MapManager {
    constructor() {
        this.map = null;
        this.markers = [];
        this.init();
    }

    init() {
        this.map = L.map('map').setView([35.8617, 104.1954], 4);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);
    }

    createIcon(isActive = false) {
        const color = isActive ? '#ff4757' : '#ff6b6b';
        const size = isActive ? 36 : 28;
        return L.divIcon({
            className: 'custom-marker',
            html: `<div style="
                width: ${size}px; height: ${size}px;
                background: ${color};
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                border: 3px solid white;
                box-shadow: 0 3px 10px rgba(0,0,0,0.3);
            "></div>`,
            iconSize: [size, size],
            iconAnchor: [size/2, size/2]
        });
    }

    updateMarkers(memories, currentId, onClick) {
        this.markers.forEach(m => this.map.removeLayer(m));
        this.markers = [];

        memories.forEach(memory => {
            const marker = L.marker(memory.coordinates, {
                icon: this.createIcon(memory.id === currentId)
            }).addTo(this.map);

            marker.bindTooltip(memory.name, {
                direction: 'top',
                offset: [0, -15]
            });

            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                onClick(memory.id);
            });

            this.markers.push(marker);
        });

        if (this.markers.length > 0) {
            const group = L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
    }

    flyTo(coordinates, zoom = 10) {
        this.map.flyTo(coordinates, zoom, { duration: 1.5 });
    }

    fitAllMarkers() {
        if (this.markers.length > 0) {
            const group = L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
    }

    onMapClick(callback) {
        this.map.on('click', callback);
    }
}
