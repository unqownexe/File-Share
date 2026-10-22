const fileInput = document.getElementById('file');
const drop = document.getElementById('drop');
const previews = document.getElementById('previews');
const badge = document.getElementById('badge');
const info = document.getElementById('info');

let selectedFiles = [];

drop.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => addFiles(fileInput.files));

['dragenter', 'dragover'].forEach(ev =>
    drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('dragover'); }));
['dragleave', 'drop'].forEach(ev =>
    drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('dragover'); }));
drop.addEventListener('drop', e => {
    if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
});

function addFiles(fileList) {
    for (const f of fileList) {
        selectedFiles.push(f);
    }
    renderPreviews();
}

function renderPreviews() {
    previews.innerHTML = '';
    badge.innerHTML = selectedFiles.length
        ? '<span class="count-badge">' + selectedFiles.length + ' dosya seçildi</span>' : '';
    selectedFiles.forEach((file, i) => {
        const div = document.createElement('div');
        div.className = 'thumb';

        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.onload = () => URL.revokeObjectURL(img.src);
            div.appendChild(img);
        } else {
            const ic = document.createElement('div');
            ic.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;font-size:28px';
            const icon = document.createElement('i');
            icon.className = file.type.startsWith('video/') ? 'fa-solid fa-film' : 'fa-solid fa-file';
            ic.appendChild(icon);
            div.appendChild(ic);
        }

        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = file.name;
        div.appendChild(name);

        const rm = document.createElement('button');
        rm.className = 'remove';
        rm.textContent = '×';
        rm.onclick = (e) => { e.stopPropagation(); selectedFiles.splice(i, 1); renderPreviews(); };
        div.appendChild(rm);

        previews.appendChild(div);
    });
}

function clearAll() {
    selectedFiles = [];
    fileInput.value = '';
    renderPreviews();
    info.textContent = '';
    info.className = 'info';
    document.getElementById('progBox').style.display = 'none';
    document.getElementById('bar').style.width = '0%';
}

function humanSize(bytes) {
    if (bytes > 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
    if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    if (bytes > 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
}

function upload() {
    if (!selectedFiles.length) return alert('Dosya seçilmedi');

    const formData = new FormData();
    selectedFiles.forEach(f => formData.append('files', f));

    const xhr = new XMLHttpRequest();
    const btn = document.getElementById('btn');
    const bar = document.getElementById('bar');
    const progBox = document.getElementById('progBox');

    btn.disabled = true;
    btn.innerText = 'Yükleniyor...';
    progBox.style.display = 'block';
    bar.style.background = 'linear-gradient(90deg, var(--orange), #fbbf24)';
    info.className = 'info';

    const startTime = Date.now();

    xhr.upload.onprogress = function (e) {
        if (e.lengthComputable) {
            const percent = (e.loaded / e.total) * 100;
            bar.style.width = percent + '%';
            const elapsed = (Date.now() - startTime) / 1000 || 0.001;
            const speed = e.loaded / elapsed;
            const speedText = speed > 1024 * 1024
                ? (speed / 1024 / 1024).toFixed(2) + ' MB/s'
                : (speed / 1024).toFixed(1) + ' KB/s';
            info.innerText = Math.floor(percent) + '% • ' + speedText
                + ' • ' + humanSize(e.loaded) + ' / ' + humanSize(e.total);
        }
    };

    xhr.onload = () => {
        btn.disabled = false;
        btn.innerText = 'Yükle';
        if (xhr.status === 200) {
            info.innerHTML = '<i class="fa-solid fa-circle-check"></i> ' + selectedFiles.length + ' dosya başarıyla yüklendi!';
            info.className = 'info ok';
            bar.style.background = 'linear-gradient(90deg, #22c55e, #4ade80)';
            clearAll();
        } else {
            info.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Hata: ' + xhr.responseText;
            info.className = 'info err';
            bar.style.background = '#ef4444';
        }
    };

    xhr.onerror = () => {
        btn.disabled = false;
        btn.innerText = 'Yükle';
        info.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Ağ Hatası Oluştu';
        info.className = 'info err';
    };

    xhr.open('POST', '/upload');
    xhr.timeout = 0;
    xhr.send(formData);
}

// ---- Text Share ----
function clearText() {
    document.getElementById('textInput').value = '';
    const ti = document.getElementById('textInfo');
    ti.textContent = '';
    ti.className = 'info';
}

function shareText() {
    const input = document.getElementById('textInput');
    const text = input.value.trim();
    const saveAsFile = document.getElementById('saveAsFile').checked;
    const ti = document.getElementById('textInfo');
    const btn = document.getElementById('textBtn');

    if (!text) {
        ti.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Paylaşmak için bir metin yazmalısın';
        ti.className = 'info err';
        return;
    }

    btn.disabled = true;
    btn.innerText = 'Paylaşılıyor...';
    ti.className = 'info';

    fetch('/share-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, saveAsFile })
    })
        .then(r => r.json())
        .then(data => {
            btn.disabled = false;
            btn.innerText = 'Metni Paylaş';
            if (data.success) {
                input.value = '';
                if (data.url) {
                    const link = location.origin + data.url;
                    ti.innerHTML = '<i class="fa-solid fa-circle-check"></i> Paylaşıldı! <a href="' + data.url + '" target="_blank">' + link + '</a>';
                } else {
                    ti.innerHTML = '<i class="fa-solid fa-circle-check"></i> Paylaşıldı!';
                }
                ti.className = 'info ok';
            } else {
                ti.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Hata: ' + (data.error || 'Bilinmeyen hata');
                ti.className = 'info err';
            }
        })
        .catch(err => {
            btn.disabled = false;
            btn.innerText = 'Metni Paylaş';
            ti.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Ağ Hatası Oluştu';
            ti.className = 'info err';
        });
}