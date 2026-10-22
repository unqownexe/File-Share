const express = require('express');
const os = require('os');
const path = require('path');
const http = require('http');
const dns = require('dns').promises;
const multer = require('multer');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const { exec } = require('child_process');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = 3000;

// Paylaşılacak klasör
const sharedFolder = path.join(__dirname, 'paylas');

// Klasör yoksa oluştur
if (!fs.existsSync(sharedFolder)) {
    fs.mkdirSync(sharedFolder);
    console.log(`📁 'paylas' klasörü oluşturuldu.`);
}

// JSON body desteği (text share için)
app.use(express.json({ limit: '10mb' }));

// Statik dosyalar (CSS, JS)
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

// Multer Disk Storage Ayarları
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, sharedFolder);
    },
    filename: function (req, file, cb) {
        // Dosya ismindeki Türkçe karakterleri düzeltmeye çalış
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, Date.now() + '-' + file.originalname);
    }
});

// Limitleri yükseltiyoruz (örneğin 100 GB'a kadar izin ver)
const upload = multer({
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024 * 1024 // 100 GB (Yeterince büyük)
    }
});

// Arayüz (Frontend) — view klasöründen servis edilir
app.get('/upload', (req, res) => {
    res.sendFile(path.join(__dirname, 'view', 'upload.html'));
});

// HTML içine güvenli şekilde yazmak için kaçış
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Bu bilgisayarın kullanıcı adı (Windows/macOS/Linux)
function currentUsername() {
    try {
        return os.userInfo().username;
    } catch (e) {
        return process.env.USERNAME || process.env.USER || 'kullanici';
    }
}

// İstek bu bilgisayardan mı geliyor? (loopback veya yerel IP)
function isLocalRequest(req) {
    let ip = (req.socket.remoteAddress || '').replace('::ffff:', '');
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
    const interfaces = os.networkInterfaces();
    for (const list of Object.values(interfaces)) {
        for (const cfg of list) {
            if (cfg.address === ip) return true;
        }
    }
    return false;
}

// İndirme / dosya listesi sayfası — başlığa kullanıcı ve bilgisayar adı eklenir
app.get('/', (req, res) => {
    const htmlPath = path.join(__dirname, 'view', 'download.html');
    fs.readFile(htmlPath, 'utf8', (err, html) => {
        if (err) return res.status(500).send('Sayfa okunamadı');
        const title = `${currentUsername()} ${os.hostname()} - Dosyalar`;
        let page = html.replace('<title>Dosyalar</title>', `<title>${escapeHtml(title)}</title>`);

        // Yerel ağdaki cihaz bölümü yalnızca bu bilgisayarda gösterilir
        if (!isLocalRequest(req)) {
            page = page
                .replace(/<section class="devices-section">[\s\S]*?<\/section>/, '')
                .replace('<script src="/js/devices.js"></script>', '');
        }

        res.type('html').send(page);
    });
});

// Upload Endpoint (Çoklu Dosya + Hata Yakalamalı)
app.post('/upload', (req, res) => {
    // 'files' alanı ile en fazla 50 dosya kabul et
    const uploadMany = upload.array('files', 50);

    uploadMany(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            // Multer kaynaklı hata (örn: dosya çok büyük)
            console.error('Multer Hatası:', err);
            return res.status(500).send("Yükleme Hatası: " + err.message);
        } else if (err) {
            // Diğer hatalar
            console.error('Bilinmeyen Hata:', err);
            return res.status(500).send("Sunucu Hatası: " + err.message);
        }

        // Geriye dönük uyumluluk: tek dosya 'file' alanı ile de gelebilir
        const files = (req.files && req.files.length)
            ? req.files
            : (req.file ? [req.file] : []);

        if (!files.length) {
            return res.status(400).send("Hiç dosya yüklenmedi.");
        }

        console.log(`✅ ${files.length} dosya başarıyla kaydedildi:`);
        files.forEach(f => console.log('   • ' + f.filename));
        res.status(200).send("OK");
    });
});

// Paylaşılan dosyaları servis et (indirme için)
app.use('/files', express.static(sharedFolder));

// Dosya listesi API'si (indirme sayfası için)
app.get('/api/files', (req, res) => {
    fs.readdir(sharedFolder, (err, items) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        const files = items
            .filter(name => !name.startsWith('.'))
            .map(name => {
                const fullPath = path.join(sharedFolder, name);
                let stat;
                try {
                    stat = fs.statSync(fullPath);
                } catch (e) {
                    return null;
                }
                if (!stat.isFile()) return null;
                return {
                    name,
                    size: stat.size,
                    url: '/files/' + encodeURIComponent(name)
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.size - a.size);

        res.json({ files });
    });
});

// Text Share — metni al, konsola yaz; istenirse dosya olarak kaydet
app.post('/share-text', (req, res) => {
    const text = req.body && req.body.text;
    const saveAsFile = !!(req.body && req.body.saveAsFile);

    if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ success: false, error: 'Metin boş olamaz' });
    }

    // Gelen metni konsola yazdır
    console.log('📥 Gelen metin:');
    console.log('----------------------------------------');
    console.log(text);
    console.log('----------------------------------------');

    // Metin bir URL ise Chrome'da aç
    const trimmed = text.trim();
    const urlRegex = /^(https?:\/\/|www\.)[^\s]+$/i;
    if (urlRegex.test(trimmed)) {
        let url = trimmed;
        if (url.startsWith('www.')) {
            url = 'http://' + url;
        }
        console.log(`🔗 Link algılandı, Chrome'da açılıyor: ${url}`);
        exec(`start chrome "${url}"`, (err) => {
            if (err) {
                console.error('Chrome açma hatası:', err.message);
            }
        });
    }

    // Dosya olarak kaydetme seçili değilse sadece başarı döndür
    if (!saveAsFile) {
        console.log('i️  Metin dosya olarak kaydedilmedi (seçenek kapalı)');
        return res.json({ success: true, saved: false });
    }

    const id = Date.now();
    const filename = id + '-metin.txt';
    const filePath = path.join(sharedFolder, filename);

    fs.writeFile(filePath, text, 'utf8', (err) => {
        if (err) {
            console.error('Text share hatası:', err);
            return res.status(500).json({ success: false, error: err.message });
        }
        console.log(`📝 Metin dosya olarak kaydedildi: ${filename}`);
        res.json({ success: true, saved: true, url: '/files/' + encodeURIComponent(filename) });
    });
});

// IP Adresi bulma
function getLocalIPv4() {
    const interfaces = os.networkInterfaces();
    for (const iface of Object.values(interfaces)) {
        for (const config of iface) {
            if (config.family === 'IPv4' && !config.internal) {
                return config.address;
            }
        }
    }
    return 'localhost';
}

// ----------------------------------------------------
// Yerel ağdaki AKTİF bilgisayarları bulma
// Kriter: ping'e yanıt veriyor + ARP tablosunda MAC'i var
// FileShare çalışıyorsa /api/info ile ayrıca doğrulanır
// ----------------------------------------------------
let devicesCache = { time: 0, data: [] };
let devicesScanning = null;
const DEVICE_CACHE_MS = 20000;
const SCAN_INTERVAL_MS = 30000;

// Yerel IP'ye ait MAC adresini bul (kendi bilgisayarımız ARP tablosunda görünmez)
function localMacFor(ip) {
    const interfaces = os.networkInterfaces();
    for (const list of Object.values(interfaces)) {
        for (const cfg of list) {
            if (cfg.address === ip) return cfg.mac;
        }
    }
    return null;
}

function pingHost(ip) {
    let cmd;
    if (process.platform === 'win32') cmd = `ping -n 1 -w 800 ${ip}`;
    else if (process.platform === 'darwin') cmd = `ping -c 1 -W 800 ${ip}`; // macOS: ms
    else cmd = `ping -c 1 -W 1 ${ip}`; // Linux: saniye
    return new Promise((resolve) => {
        exec(cmd, { timeout: 2000, windowsHide: true }, (err) => resolve(!err));
    });
}

// Alt ağdaki 1-254 adresleri paralel ping'le; yanıt verenlerin listesini döndür
async function pingSweep(base) {
    const ips = [];
    for (let i = 1; i < 255; i++) ips.push(`${base}.${i}`);

    const alive = [];
    const CONCURRENCY = 128;
    for (let i = 0; i < ips.length; i += CONCURRENCY) {
        const chunk = ips.slice(i, i + CONCURRENCY);
        const results = await Promise.all(chunk.map(ip => pingHost(ip)));
        results.forEach((ok, idx) => { if (ok) alive.push(chunk[idx]); });
    }
    return alive;
}

// ARP tablosunu oku (Windows ve Linux/macOS formatlarını destekler)
function readArpTable() {
    return new Promise((resolve) => {
        const cmd = process.platform === 'win32' ? 'arp -a' : 'arp -an';
        exec(cmd, { timeout: 5000, windowsHide: true }, (err, stdout) => {
            const map = new Map();
            if (err && !stdout) return resolve(map);

            for (const line of String(stdout).split(/\r?\n/)) {
                // Windows: "  192.168.1.5    aa-bb-cc-dd-ee-ff    dynamic"
                let m = line.match(/^\s*(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9a-f]{2}(?:[-:][0-9a-f]{2}){5})\s+(\S+)/i);
                // Linux/macOS: "? (192.168.1.5) at aa:bb:cc:dd:ee:ff [ether] on wlan0"
                if (!m) {
                    const l = line.match(/\((\d{1,3}(?:\.\d{1,3}){3})\) at ([0-9a-f]{1,2}(?::[0-9a-f]{1,2}){5})/i);
                    if (l) m = [l[0], l[1], l[2]];
                }
                if (!m) continue;

                // macOS tek haneli oktetleri yazabilir (ör. 0:1:2...), 2 haneye tamamla
                const mac = m[2].replace(/-/g, ':').toLowerCase()
                    .split(':').map(p => p.padStart(2, '0')).join(':');
                // Yayın (broadcast) ve çoklu yayın (multicast) adreslerini atla
                if (mac === 'ff:ff:ff:ff:ff:ff' || mac.startsWith('01:00:5e') || mac.startsWith('33:33')) continue;
                map.set(m[1], mac);
            }
            resolve(map);
        });
    });
}

// Ters DNS ile host adı çöz (zaman aşımlı)
function resolveHostname(ip) {
    const lookup = dns.reverse(ip).then(names => names[0] || null).catch(() => null);
    const timeout = new Promise(resolve => setTimeout(() => resolve(null), 1000));
    return Promise.race([lookup, timeout]);
}

// Cihazda FileShare çalışıyor mu? (/api/info yanıtını kontrol eder)
function probeFileShare(ip) {
    return new Promise((resolve) => {
        const r = http.get({ host: ip, port: PORT, path: '/api/info', timeout: 1500 }, (up) => {
            let body = '';
            up.setEncoding('utf8');
            up.on('data', c => body += c);
            up.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    resolve(json.app === 'FileShare' ? json : null);
                } catch (e) {
                    resolve(null);
                }
            });
        });
        r.on('timeout', () => { r.destroy(); resolve(null); });
        r.on('error', () => resolve(null));
    });
}

function lastOctet(ip) {
    return Number(ip.split('.')[3]);
}

async function scanDevices() {
    const localIp = getLocalIPv4();
    if (localIp === 'localhost') return [];

    const base = localIp.split('.').slice(0, 3).join('.');

    const alive = await pingSweep(base);
    const arp = await readArpTable();

    // Windows güvenlik duvarı ping'e (ICMP) yanıt vermeyebilir; ama ARP yanıtı
    // engellenmez, bu yüzden ARP tablosundaki yerel IP'leri de aday olarak ekle
    const candidates = new Set(alive);
    for (const ip of arp.keys()) {
        if (ip.startsWith(base + '.')) candidates.add(ip);
    }
    // Kendi bilgisayarımız her zaman dahil
    candidates.add(localIp);

    const results = await Promise.all([...candidates].map(async (ip) => {
        const self = ip === localIp;
        const mac = self ? localMacFor(ip) : (arp.get(ip) || null);

        // MAC doğrulanamayan cihazlar güvenilir değil, listeye alınmaz
        if (!self && !mac) return null;

        const info = self ? null : await probeFileShare(ip);
        const hostname = self
            ? os.hostname()
            : (info && info.hostname) || await resolveHostname(ip);

        return {
            ip,
            mac,
            self,
            hostname: hostname || null,
            fileshare: self || !!info
        };
    }));

    // Yalnızca bu bilgisayar ve FileShare çalışan cihazlar listelenir
    return results
        .filter(d => d && (d.self || d.fileshare))
        .sort((a, b) => lastOctet(a.ip) - lastOctet(b.ip));
}

// Önbellekli ve aynı anda tek tarama çalıştıran yardımcı
function getDevices(force) {
    if (!force && Date.now() - devicesCache.time < DEVICE_CACHE_MS) {
        return Promise.resolve(devicesCache.data);
    }
    if (!devicesScanning) {
        devicesScanning = scanDevices()
            .then(data => {
                devicesCache = { time: Date.now(), data };
                return data;
            })
            .finally(() => {
                devicesScanning = null;
            });
    }
    return devicesScanning;
}

// Verilen IP, FileShare çalışan uzak bir cihaz mı?
async function findPeer(ip) {
    const devices = await getDevices(false);
    return devices.find(d => d.ip === ip && d.fileshare && !d.self) || null;
}

// Yerel ağdaki aktif cihazların listesi
app.get('/api/devices', async (req, res) => {
    try {
        const force = req.query.refresh === '1';
        const devices = await getDevices(force);
        res.json({ devices });
    } catch (err) {
        console.error('Cihaz tarama hatası:', err);
        res.status(500).json({ error: err.message });
    }
});

// Bu sunucunun kimlik bilgisi (diğer cihazlar FileShare tespiti için kullanır)
app.get('/api/info', (req, res) => {
    res.json({ app: 'FileShare', hostname: os.hostname(), user: currentUsername(), platform: os.platform() });
});

// ----------------------------------------------------
// Uzak cihaz işlemleri (sadece taranmış, FileShare çalıştıran cihazlara)
// ----------------------------------------------------
function sendPeerError(res, status, msg) {
    if (!res.headersSent) res.status(status).json({ error: msg });
}

async function requirePeer(req, res) {
    const peer = await findPeer(String(req.query.ip || ''));
    if (!peer) {
        sendPeerError(res, 404, 'Cihaz bulunamadı veya FileShare çalışmıyor');
        return null;
    }
    return peer;
}

// Uzak cihazın dosya listesi
app.get('/api/remote/files', async (req, res) => {
    const peer = await requirePeer(req, res);
    if (!peer) return;

    const r = http.get({ host: peer.ip, port: PORT, path: '/api/files', timeout: 5000 }, (up) => {
        let body = '';
        up.setEncoding('utf8');
        up.on('data', c => body += c);
        up.on('end', () => {
            res.status(up.statusCode || 502).type('application/json').send(body);
        });
    });
    r.on('timeout', () => r.destroy(new Error('Zaman aşımı')));
    r.on('error', (err) => sendPeerError(res, 502, err.message));
});

// Uzak cihazdan dosya indir (proxy olarak aktarır)
app.get('/api/remote/download', async (req, res) => {
    const peer = await requirePeer(req, res);
    if (!peer) return;

    const name = String(req.query.name || '');
    if (!name || name.includes('/') || name.includes('\\') || name.startsWith('.')) {
        return sendPeerError(res, 400, 'Geçersiz dosya adı');
    }

    const r = http.get({
        host: peer.ip,
        port: PORT,
        path: '/files/' + encodeURIComponent(name),
        timeout: 30000
    }, (up) => {
        if (up.statusCode !== 200) {
            up.resume();
            return sendPeerError(res, up.statusCode || 502, 'Dosya indirilemedi');
        }
        res.setHeader('Content-Type', up.headers['content-type'] || 'application/octet-stream');
        if (up.headers['content-length']) res.setHeader('Content-Length', up.headers['content-length']);
        res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent(name));
        up.pipe(res);
    });
    r.on('timeout', () => r.destroy(new Error('Zaman aşımı')));
    r.on('error', (err) => sendPeerError(res, 502, err.message));
});

// Uzak cihaza dosya gönder (multipart gövde olduğu gibi iletilir)
app.post('/api/remote/upload', async (req, res) => {
    const peer = await requirePeer(req, res);
    if (!peer) return;

    const headers = { 'content-type': req.headers['content-type'] || 'multipart/form-data' };
    if (req.headers['content-length']) headers['content-length'] = req.headers['content-length'];

    const up = http.request({
        host: peer.ip,
        port: PORT,
        path: '/upload',
        method: 'POST',
        headers,
        timeout: 0
    }, (pr) => {
        let body = '';
        pr.setEncoding('utf8');
        pr.on('data', c => body += c);
        pr.on('end', () => {
            res.status(pr.statusCode || 502).type('text/plain').send(body);
        });
    });
    up.on('error', (err) => sendPeerError(res, 502, err.message));
    req.pipe(up);
});

// Sunucuyu başlat ve Timeout Ayarını Yap
const server = app.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIPv4();
    const uploadUrl = `http://${ip}:${PORT}/upload`;

    console.log(`🚀 FileShare Hazır!`);
    console.log(`   made by unqown • credit: https://webtelya.com`);
    console.log('');
    console.log(`📂 Dosyalar: http://${ip}:${PORT}`);
    console.log(`⬆️ Upload:   ${uploadUrl}`);
    console.log('');
    console.log('📱 Telefonla hızlı erişim için QR kodu okutun:');
    console.log('');
    qrcode.generate(uploadUrl, { small: true });
    console.log('');

    // Cihaz listesini arka planda sürekli tazele (sayfa açıldığında anında hazır olsun)
    getDevices(true).catch(() => { });
    setInterval(() => getDevices(true).catch(() => { }), SCAN_INTERVAL_MS);
});

// ----------------------------------------------------
// KRİTİK AYAR: Timeout Sürelerini Uzat/Kapat
// ----------------------------------------------------
server.timeout = 0;           // Sonsuz zaman aşımı (Server tarafı)
server.keepAliveTimeout = 0;  // Bağlantıyı canlı tutma süresi (Sonsuz)

// ----------------------------------------------------
// WebSocket Sunucusu — dosya değişikliklerini canlı bildir
// ----------------------------------------------------
const wss = new WebSocketServer({ server, path: '/ws' });

// Tüm bağlı istemcilere mesaj gönder
function broadcast(message) {
    const data = JSON.stringify(message);
    wss.clients.forEach(client => {
        if (client.readyState === 1) { // OPEN
            client.send(data);
        }
    });
}

wss.on('connection', (ws) => {
    console.log('🔌 Yeni WebSocket bağlantısı');
    ws.on('close', () => {
        console.log('🔌 WebSocket bağlantısı kapandı');
    });
});

// paylas klasörünü izle — dosya eklenince/silinince tüm istemcilere bildir
let watchTimeout = null;
fs.watch(sharedFolder, (eventType, filename) => {
    if (!filename) return;

    // Çoklu olayları tek bir bildirime indir (debounce)
    if (watchTimeout) clearTimeout(watchTimeout);
    watchTimeout = setTimeout(() => {
        console.log(`🔄 Dosya değişikliği algılandı (${eventType}): ${filename}`);
        broadcast({ type: 'files-changed' });
    }, 300);
});

console.log(`👀 'paylas' klasörü izleniyor (canlı güncelleme aktif)`);
