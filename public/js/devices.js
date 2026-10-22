// Yerel ağdaki aktif cihazlar ve FileShare uzak cihaz işlemleri
// Tüm kod IIFE içinde; download.js ile global değişken çakışmaz.
(function () {
    const grid = document.getElementById('devicesGrid');
    const status = document.getElementById('devicesStatus');
    const refreshBtn = document.getElementById('devicesRefresh');

    const panel = document.getElementById('peerPanel');
    const peerTitle = document.getElementById('peerTitle');
    const peerSub = document.getElementById('peerSub');
    const peerRefresh = document.getElementById('peerRefresh');
    const peerUploadBtn = document.getElementById('peerUploadBtn');
    const peerOpenWeb = document.getElementById('peerOpenWeb');
    const peerClose = document.getElementById('peerClose');
    const peerInput = document.getElementById('peerInput');
    const peerProgressBox = document.getElementById('peerProgressBox');
    const peerProgressBar = document.getElementById('peerProgressBar');
    const peerMsg = document.getElementById('peerMsg');
    const peerFiles = document.getElementById('peerFiles');
    const peerEmpty = document.getElementById('peerEmpty');

    const POLL_MS = 10000;

    let devices = [];
    let activePeer = null;
    let loading = false;

    function humanSize(bytes) {
        if (bytes > 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
        if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
        if (bytes > 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return bytes + ' B';
    }

    function ipQuery(ip) {
        return 'ip=' + encodeURIComponent(ip);
    }

    function setMsg(text, type) {
        peerMsg.textContent = text || '';
        peerMsg.className = 'devices-status peer-msg' + (type ? ' ' + type : '');
    }

    function isPeer(d) {
        return d.fileshare && !d.self;
    }

    function tag(text, cls) {
        const t = document.createElement('span');
        t.className = 'device-tag' + (cls ? ' ' + cls : '');
        t.textContent = text;
        return t;
    }

    function renderDevices() {
        grid.innerHTML = '';

        if (!devices.length) {
            status.textContent = 'Aktif cihaz bulunamadı';
            return;
        }

        const shareCount = devices.filter(d => d.fileshare).length;
        status.textContent = devices.length + ' aktif cihaz • ' + shareCount + ' FileShare çalışıyor';

        devices.forEach(d => {
            const card = document.createElement('div');
            card.className = 'device-card' + (d.self ? ' self' : '') + (isPeer(d) ? ' clickable' : '');

            const icon = document.createElement('div');
            icon.className = 'device-icon';
            const ic = document.createElement('i');
            ic.className = d.self ? 'fa-solid fa-laptop' : 'fa-solid fa-desktop';
            icon.appendChild(ic);

            const info = document.createElement('div');
            info.className = 'device-info';

            const name = document.createElement('div');
            name.className = 'device-name';
            name.textContent = d.hostname || d.ip;
            info.appendChild(name);

            const ip = document.createElement('div');
            ip.className = 'device-detail';
            ip.textContent = d.ip;
            info.appendChild(ip);

            if (d.mac) {
                const mac = document.createElement('div');
                mac.className = 'device-detail';
                mac.textContent = d.mac;
                info.appendChild(mac);
            }

            const actions = document.createElement('div');
            actions.className = 'device-actions';
            if (d.self) {
                actions.appendChild(tag('Bu bilgisayar', 'self-tag'));
            } else if (d.fileshare) {
                actions.appendChild(tag('FileShare', 'on'));
                if (isPeer(d)) actions.appendChild(tag('Seçmek için tıkla'));
            } else {
                actions.appendChild(tag('FileShare yok'));
            }
            info.appendChild(actions);

            card.appendChild(icon);
            card.appendChild(info);

            if (isPeer(d)) card.addEventListener('click', () => openPeer(d));

            grid.appendChild(card);
        });
    }

    function renderPeerFiles(ip, files) {
        peerFiles.innerHTML = '';
        peerEmpty.style.display = files.length ? 'none' : 'block';

        files.forEach(f => {
            const row = document.createElement('div');
            row.className = 'peer-file';

            const ic = document.createElement('i');
            ic.className = 'fa-solid fa-file';

            const name = document.createElement('div');
            name.className = 'pf-name';
            name.textContent = f.name;

            const size = document.createElement('div');
            size.className = 'pf-size';
            size.textContent = humanSize(f.size);

            const link = document.createElement('a');
            link.href = '/api/remote/download?' + ipQuery(ip) + '&name=' + encodeURIComponent(f.name);
            link.setAttribute('download', f.name);
            link.innerHTML = '<i class="fa-solid fa-download"></i> İndir';

            row.appendChild(ic);
            row.appendChild(name);
            row.appendChild(size);
            row.appendChild(link);
            peerFiles.appendChild(row);
        });
    }

    async function loadPeerFiles() {
        if (!activePeer) return;
        const ip = activePeer.ip;

        setMsg('Dosyalar yükleniyor...');
        try {
            const r = await fetch('/api/remote/files?' + ipQuery(ip));
            const data = await r.json();
            if (!r.ok || data.error) throw new Error(data.error || 'Bilinmeyen hata');
            if (!activePeer || activePeer.ip !== ip) return;

            renderPeerFiles(ip, data.files || []);
            setMsg((data.files || []).length + ' dosya');
        } catch (e) {
            setMsg('Dosyalar alınamadı: ' + e.message, 'error');
        }
    }

    function openPeer(d) {
        activePeer = d;
        panel.classList.add('open');
        peerTitle.textContent = d.hostname || d.ip;
        peerSub.textContent = d.ip + (d.mac ? ' • ' + d.mac : '');
        peerOpenWeb.href = 'http://' + d.ip + ':3000';
        peerFiles.innerHTML = '';
        peerEmpty.style.display = 'none';
        loadPeerFiles();
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function closePeer() {
        activePeer = null;
        panel.classList.remove('open');
        peerFiles.innerHTML = '';
        setMsg('');
    }

    function uploadToPeer(list) {
        if (!activePeer || !list.length) return;
        const ip = activePeer.ip;

        const fd = new FormData();
        list.forEach(f => fd.append('files', f, f.name));

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/remote/upload?' + ipQuery(ip));

        peerUploadBtn.disabled = true;
        peerProgressBox.style.display = 'block';
        peerProgressBar.style.width = '0%';
        setMsg('Gönderiliyor...');

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                peerProgressBar.style.width = Math.round(e.loaded / e.total * 100) + '%';
            }
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                setMsg(list.length + ' dosya gönderildi', 'ok');
                loadPeerFiles();
            } else {
                setMsg('Gönderilemedi: ' + xhr.responseText, 'error');
            }
        };
        xhr.onerror = () => setMsg('Bağlantı hatası', 'error');
        xhr.onloadend = () => {
            peerUploadBtn.disabled = false;
            setTimeout(() => { peerProgressBox.style.display = 'none'; }, 800);
        };
        xhr.send(fd);
    }

    async function loadDevices(force) {
        if (loading) return;
        loading = true;
        refreshBtn.disabled = true;
        if (!devices.length) status.textContent = 'Ağ taranıyor, lütfen bekleyin...';

        try {
            const r = await fetch('/api/devices' + (force ? '?refresh=1' : ''));
            const data = await r.json();
            if (data.error) throw new Error(data.error);

            devices = data.devices || [];
            renderDevices();

            // Seçili cihaz artık aktif değilse paneli kapat
            if (activePeer && !devices.some(d => d.ip === activePeer.ip && isPeer(d))) {
                closePeer();
            }
        } catch (e) {
            status.textContent = 'Cihazlar taranamadı';
        } finally {
            loading = false;
            refreshBtn.disabled = false;
        }
    }

    refreshBtn.addEventListener('click', () => loadDevices(true));
    peerRefresh.addEventListener('click', () => loadPeerFiles());
    peerClose.addEventListener('click', closePeer);
    peerUploadBtn.addEventListener('click', () => peerInput.click());
    peerInput.addEventListener('change', () => {
        uploadToPeer(Array.from(peerInput.files));
        peerInput.value = '';
    });

    loadDevices(false);
    setInterval(() => loadDevices(false), POLL_MS);
})();
