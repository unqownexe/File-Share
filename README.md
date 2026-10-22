# FileShare

Aynı Wi-Fi ağındaki cihazlar arasında **dosya ve metin paylaşmanızı** sağlayan,
tamamen kendi bilgisayarınızda çalışan basit bir panel.

Telefondan fotoğraf gönderin, bilgisayardan dosya indirin; hepsi tarayıcıdan.
İnternete veya buluta hiçbir şey yüklenmez.

## Özellikler

- Sürükle bırak ile dosya yükleme (birden fazla dosya)
- Dosya önizleme, tek tıkla indirme ve toplu indirme
- Metin paylaşma (link yazarsanız tarayıcıda açar)
- Yerel ağdaki diğer bilgisayarları görme ve aralarında dosya gönderme
- QR kod ile telefondan hızlı erişim
- Dosya eklendiğinde sayfayı yenilemeden canlı güncelleme

## Gereksinimler

- [Node.js](https://nodejs.org/) **20 veya üzeri** (npm ile birlikte gelir)
- İnternet bağlantısı (yalnızca `npm install` sırasında)
- Aynı Wi-Fi ağına bağlı cihazlar

## Kurulum

```bash
git clone https://github.com/unqownexe/FileShare.git
cd FileShare
npm install
```

## Çalıştırma

```bash
npm start
```

Windows'ta `baslat.bat` dosyasına çift tıklayarak da başlatabilirsiniz.

Bilgisayarınızda `http://localhost:3000` adresini açın. Telefondan kullanmak
için aynı Wi-Fi ağına bağlanıp paneldeki QR kodu okutun veya terminalde yazan
ikinci adresi telefonun tarayıcısına girin.

Yüklenen dosyalar proje içindeki `paylas` klasöründe tutulur.

---

made by **unqown** · credit: [webtelya.com](https://webtelya.com)
