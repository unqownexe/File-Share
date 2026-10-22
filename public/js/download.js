const grid = document.getElementById('grid');
const empty = document.getElementById('empty');
const searchInput = document.getElementById('search');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const modalName = document.getElementById('modalName');
const modalDownload = document.getElementById('modalDownload');
const modalClose = document.getElementById('modalClose');
const modalBackdrop = document.getElementById('modalBackdrop');
const bulkBar = document.getElementById('bulkBar');
const bulkCount = document.getElementById('bulkCount');
const bulkDownload = document.getElementById('bulkDownload');
const bulkClear = document.getElementById('bulkClear');

let files = [];
let currentView = 'grid';
let selectedFiles = new Set();

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'];
const VIDEO_EXT = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'];
const AUDIO_EXT = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus'];
const TEXT_EXT = ['txt', 'md', 'json', 'js', 'css', 'html', 'xml', 'csv', 'log', 'yml', 'yaml'];

function ext(name) {
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function fileIcon(name) {
    const e = ext(name);
    if (IMAGE_EXT.includes(e)) return 'fa-solid fa-image';
    if (VIDEO_EXT.includes(e)) return 'fa-solid fa-film';
    if (AUDIO_EXT.includes(e)) return 'fa-solid fa-music';
    if (TEXT_EXT.includes(e)) return 'fa-solid fa-file-lines';
    if (e === 'pdf') return 'fa-solid fa-file-pdf';
    if (e === 'zip' || e === 'rar' || e === '7z' || e === 'tar' || e === 'gz') return 'fa-solid fa-file-zipper';
    return 'fa-solid fa-file';
}

// Font Awesome ikon elementi oluştur
function createFileIcon(name) {
    const ic = document.createElement('i');
    ic.className = fileIcon(name);
    return ic;
}

function humanSize(bytes) {
    if (bytes > 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
    if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    if (bytes > 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
}

function isImage(name) { return IMAGE_EXT.includes(ext(name)); }
function isVideo(name) { return VIDEO_EXT.includes(ext(name)); }
function isAudio(name) { return AUDIO_EXT.includes(ext(name)); }
function isText(name) { return TEXT_EXT.includes(ext(name)); }

function render() {
    const q = searchInput.value.toLowerCase();
    const filtered = files.filter(f => f.name.toLowerCase().includes(q));

    grid.innerHTML = '';
    grid.className = currentView === 'list' ? 'grid list' : 'grid';

    if (!filtered.length) {
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    filtered.forEach(f => {
        const card = document.createElement('div');
        card.className = 'card';
        if (selectedFiles.has(f.name)) {
            card.classList.add('selected');
        }

        const preview = document.createElement('div');
        preview.className = 'preview';

        if (isImage(f.name)) {
            const img = document.createElement('img');
            img.src = f.url;
            img.loading = 'lazy';
            img.alt = f.name;
            preview.appendChild(img);
        } else if (isVideo(f.name)) {
            // Video için thumbnail önizleme
            const video = document.createElement('video');
            video.src = f.url;
            video.preload = 'metadata';
            video.muted = true;
            video.playsInline = true;
            preview.appendChild(video);

            // Oynatma ikonu overlay
            const playOverlay = document.createElement('div');
            playOverlay.className = 'play-overlay';
            playOverlay.innerHTML = '<i class="fa-solid fa-play"></i>';
            preview.appendChild(playOverlay);
        } else if (isAudio(f.name)) {
            // Ses için görsel önizleme
            const audioPreview = document.createElement('div');
            audioPreview.className = 'audio-preview';
            const audioIcon = document.createElement('div');
            audioIcon.className = 'audio-preview-icon';
            audioIcon.appendChild(createFileIcon(f.name));
            const wave = document.createElement('div');
            wave.className = 'audio-wave';
            for (let i = 0; i < 5; i++) {
                const bar = document.createElement('span');
                wave.appendChild(bar);
            }
            audioPreview.appendChild(audioIcon);
            audioPreview.appendChild(wave);
            preview.appendChild(audioPreview);
        } else {
            const ic = document.createElement('div');
            ic.className = 'file-icon';
            ic.appendChild(createFileIcon(f.name));
            preview.appendChild(ic);
        }

        const badge = document.createElement('span');
        badge.className = 'type-badge';
        badge.textContent = ext(f.name) || 'file';
        preview.appendChild(badge);

        // Seçim checkbox'ı
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'select-checkbox';
        checkbox.checked = selectedFiles.has(f.name);
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            if (checkbox.checked) {
                selectedFiles.add(f.name);
            } else {
                selectedFiles.delete(f.name);
            }
            card.classList.toggle('selected', checkbox.checked);
            updateBulkBar();
        });
        preview.appendChild(checkbox);

        const meta = document.createElement('div');
        meta.className = 'meta';
        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = f.name;
        const size = document.createElement('div');
        size.className = 'size';
        size.textContent = humanSize(f.size);
        meta.appendChild(name);
        meta.appendChild(size);

        card.appendChild(preview);
        card.appendChild(meta);
        card.addEventListener('click', () => openPreview(f));

        grid.appendChild(card);
    });
}

function openPreview(f) {
    modalName.textContent = f.name;
    modalDownload.href = f.url;
    modalDownload.setAttribute('download', f.name);
    modalBody.innerHTML = '';

    if (isImage(f.name)) {
        const img = document.createElement('img');
        img.src = f.url;
        img.alt = f.name;
        modalBody.appendChild(img);
    } else if (isVideo(f.name)) {
        const video = document.createElement('video');
        video.src = f.url;
        video.controls = true;
        video.autoplay = true;
        modalBody.appendChild(video);
    } else if (isAudio(f.name)) {
        const audioWrap = document.createElement('div');
        audioWrap.className = 'audio-wrap';
        const audioIcon = document.createElement('div');
        audioIcon.className = 'audio-icon';
        audioIcon.appendChild(createFileIcon(f.name));
        const audio = document.createElement('audio');
        audio.src = f.url;
        audio.controls = true;
        audio.autoplay = true;
        audioWrap.appendChild(audioIcon);
        audioWrap.appendChild(audio);
        modalBody.appendChild(audioWrap);
    } else if (isText(f.name)) {
        fetch(f.url)
            .then(r => r.text())
            .then(text => {
                const div = document.createElement('div');
                div.className = 'text-content';
                div.textContent = text;
                modalBody.appendChild(div);
            })
            .catch(() => {
                const ic = document.createElement('div');
                ic.className = 'file-icon';
                ic.appendChild(createFileIcon(f.name));
                modalBody.appendChild(ic);
            });
    } else {
        const ic = document.createElement('div');
        ic.className = 'file-icon';
        ic.appendChild(createFileIcon(f.name));
        modalBody.appendChild(ic);
    }

    modal.classList.add('open');
}

function closeModal() {
    modal.classList.remove('open');
    modalBody.innerHTML = '';
}

modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
});

searchInput.addEventListener('input', render);

document.querySelectorAll('.vt').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.vt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentView = btn.dataset.view;
        render();
    });
});

// Toplu indirme çubuğunu güncelle
function updateBulkBar() {
    const count = selectedFiles.size;
    if (count > 0) {
        bulkBar.classList.add('show');
        bulkCount.textContent = count + ' dosya seçildi';
    } else {
        bulkBar.classList.remove('show');
    }
}

// Seçilen dosyaları sırayla indir
function downloadSelected() {
    if (!selectedFiles.size) return;

    const selected = files.filter(f => selectedFiles.has(f.name));
    let index = 0;

    function downloadNext() {
        if (index >= selected.length) {
            selectedFiles.clear();
            updateBulkBar();
            render();
            return;
        }

        const f = selected[index];
        const a = document.createElement('a');
        a.href = f.url;
        a.download = f.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        index++;
        // Tarayıcının çoklu indirmeyi engellememesi için küçük gecikme
        setTimeout(downloadNext, 500);
    }

    downloadNext();
}

bulkDownload.addEventListener('click', downloadSelected);
bulkClear.addEventListener('click', () => {
    selectedFiles.clear();
    updateBulkBar();
    render();
});

// Dosya listesini çek
function loadFiles() {
    fetch('/api/files')
        .then(r => r.json())
        .then(data => {
            files = data.files || [];
            render();
        })
        .catch(() => {
            empty.style.display = 'block';
            empty.querySelector('p').textContent = 'Dosyalar yüklenemedi';
        });
}

loadFiles();

// WebSocket — dosya değişikliklerinde otomatik güncelle
function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(protocol + '//' + location.host + '/ws');

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'files-changed') {
                loadFiles();
            }
        } catch (e) {
            // Geçersiz mesaj, yok say
        }
    };

    ws.onclose = () => {
        // Bağlantı koparsa 3 saniye sonra yeniden bağlan
        setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = () => {
        ws.close();
    };
}

connectWebSocket();
