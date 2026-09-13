class WallpaperGifChanger {
    constructor() {
        this.images = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.intervalId = null;
        this.draggedItem = null;
        this.dbName = 'WallpaperDB';
        this.storeName = 'wallpaperStore';

        this.initElements();
        this.bindEvents();
        this.initDatabase();
    }

    // Khởi tạo IndexedDB
    initDatabase() {
        const request = indexedDB.open(this.dbName, 1);

        request.onerror = () => {
            console.error('Lỗi mở database');
            this.loadFromLocalStorage(); // Fallback
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(this.storeName)) {
                db.createObjectStore(this.storeName, { keyPath: 'id' });
            }
        };

        request.onsuccess = () => {
            this.db = request.result;
            this.loadFromDatabase();
        };
    }

    initElements() {
        this.wallpaperImage = document.getElementById('wallpaperImage');
        this.imageInput = document.getElementById('imageInput');
        this.imageList = document.getElementById('imageList');
        this.intervalTime = document.getElementById('intervalTime');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.toolbar = document.getElementById('toolbar');
        this.toggleToolbar = document.getElementById('toggleToolbar');
    }

    bindEvents() {
        // Tải ảnh
        this.imageInput.addEventListener('change', (e) => this.handleImageUpload(e));

        // Điều khiển phát
        this.startBtn.addEventListener('click', () => this.play());
        this.stopBtn.addEventListener('click', () => this.stop());
        this.fullscreenBtn.addEventListener('click', () => this.enterFullscreen());
        this.clearBtn.addEventListener('click', () => this.clearAllImages());

        // Toggle thanh công cụ
        this.toggleToolbar.addEventListener('click', () => this.toggleToolbarVisibility());

        // Lưu thời gian khi thay đổi
        this.intervalTime.addEventListener('change', () => this.saveToDatabase());

        // Phím ESC để thoát fullscreen
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) {
                this.toolbar.classList.remove('hidden');
            }
        });

        // Phím tắt
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.fullscreenElement) {
                document.exitFullscreen();
            }
            if (e.code === 'Space') {
                e.preventDefault();
                this.isPlaying ? this.stop() : this.play();
            }
        });
    }

    handleImageUpload(event) {
        const files = Array.from(event.target.files);
        
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.images.push({
                    name: file.name,
                    data: e.target.result,
                    type: file.type,
                    timestamp: Date.now()
                });
                this.render();
                this.saveToDatabase();
            };
            reader.readAsDataURL(file);
        });

        // Reset input
        this.imageInput.value = '';
    }

    render() {
        this.imageList.innerHTML = '';
        
        this.images.forEach((img, index) => {
            const li = document.createElement('li');
            li.className = 'image-item';
            li.draggable = true;
            li.dataset.index = index;

            li.innerHTML = `
                <span class="drag-handle">⋮⋮</span>
                <span class="image-name" title="${img.name}">${img.name}</span>
                <button class="delete-btn">Xóa</button>
            `;

            // Sự kiện kéo thả
            li.addEventListener('dragstart', (e) => this.handleDragStart(e, index));
            li.addEventListener('dragover', (e) => this.handleDragOver(e));
            li.addEventListener('drop', (e) => this.handleDrop(e, index));
            li.addEventListener('dragend', (e) => this.handleDragEnd(e));
            li.addEventListener('dragleave', (e) => this.handleDragLeave(e));

            // Xóa ảnh
            li.querySelector('.delete-btn').addEventListener('click', () => {
                this.images.splice(index, 1);
                this.render();
                this.saveToDatabase();
                if (this.currentIndex >= this.images.length && this.images.length > 0) {
                    this.currentIndex = 0;
                }
                this.displayImage();
            });

            this.imageList.appendChild(li);
        });

        if (this.images.length > 0 && !this.wallpaperImage.src) {
            this.displayImage();
        }
    }

    handleDragStart(e, index) {
        this.draggedItem = index;
        e.currentTarget.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    }

    handleDrop(e, targetIndex) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');

        if (this.draggedItem !== null && this.draggedItem !== targetIndex) {
            // Swap ảnh
            const temp = this.images[this.draggedItem];
            this.images[this.draggedItem] = this.images[targetIndex];
            this.images[targetIndex] = temp;

            this.render();
            this.saveToDatabase();
        }
    }

    handleDragEnd(e) {
        e.currentTarget.classList.remove('dragging');
        this.draggedItem = null;

        // Xóa drag-over class từ tất cả
        document.querySelectorAll('.image-item').forEach(item => {
            item.classList.remove('drag-over');
        });
    }

    displayImage() {
        if (this.images.length > 0) {
            const img = this.images[this.currentIndex];
            this.wallpaperImage.src = img.data;
        }
    }

    play() {
        if (this.images.length === 0) {
            alert('Vui lòng tải ít nhất 1 ảnh!');
            return;
        }

        this.isPlaying = true;
        this.startBtn.disabled = true;
        this.stopBtn.disabled = false;

        const interval = parseInt(this.intervalTime.value) * 1000;

        this.intervalId = setInterval(() => {
            this.currentIndex = (this.currentIndex + 1) % this.images.length;
            this.displayImage();
        }, interval);

        this.displayImage();
    }

    stop() {
        this.isPlaying = false;
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    enterFullscreen() {
        if (this.images.length === 0) {
            alert('Vui lòng tải ít nhất 1 ảnh!');
            return;
        }

        const container = document.documentElement;
        if (container.requestFullscreen) {
            container.requestFullscreen().then(() => {
                this.toolbar.classList.add('hidden');
            });
        }
    }

    toggleToolbarVisibility() {
        this.toolbar.classList.toggle('hidden');
    }

    clearAllImages() {
        if (confirm('Bạn chắc chắn muốn xóa tất cả ảnh?')) {
            this.stop();
            this.images = [];
            this.currentIndex = 0;
            this.wallpaperImage.src = '';
            this.render();
            this.saveToDatabase();
        }
    }

    // Lưu vào IndexedDB
    saveToDatabase() {
        if (!this.db) {
            this.saveToLocalStorage();
            return;
        }

        const data = {
            id: 'wallpaperData',
            images: this.images,
            intervalTime: this.intervalTime.value,
            timestamp: Date.now()
        };

        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put(data);

        request.onsuccess = () => {
            console.log('✅ Dữ liệu đã được lưu');
        };

        request.onerror = () => {
            console.error('❌ Lỗi lưu dữ liệu');
            this.saveToLocalStorage(); // Fallback
        };
    }

    // Tải từ IndexedDB
    loadFromDatabase() {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get('wallpaperData');

        request.onsuccess = () => {
            const data = request.result;
            if (data) {
                this.images = data.images || [];
                this.intervalTime.value = data.intervalTime || '3';
                this.render();
                console.log('✅ Dữ liệu đã được tải từ database');
            }
        };

        request.onerror = () => {
            console.error('❌ Lỗi tải dữ liệu');
            this.loadFromLocalStorage(); // Fallback
        };
    }

    // Fallback: Lưu vào localStorage
    saveToLocalStorage() {
        try {
            const data = {
                images: this.images,
                intervalTime: this.intervalTime.value
            };
            localStorage.setItem('wallpaperData', JSON.stringify(data));
            console.log('✅ Dữ liệu đã lưu vào localStorage');
        } catch (e) {
            console.warn('❌ Không thể lưu vào localStorage:', e);
        }
    }

    // Tải từ localStorage
    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('wallpaperData');
            if (saved) {
                const data = JSON.parse(saved);
                this.images = data.images || [];
                this.intervalTime.value = data.intervalTime || '3';
                this.render();
                console.log('✅ Dữ liệu đã được tải từ localStorage');
            }
        } catch (e) {
            console.warn('❌ Không thể tải từ localStorage:', e);
        }
    }
}

// Khởi tạo ứng dụng khi DOM ready
document.addEventListener('DOMContentLoaded', () => {
    new WallpaperGifChanger();
});
