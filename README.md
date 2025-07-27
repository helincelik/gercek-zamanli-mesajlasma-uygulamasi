# 📱 Gerçek Zamanlı Mesajlaşma Uygulaması

Gerçek zamanlı mesajlaşma ve sesli arama destekli, JWT kimlik doğrulamalı, Flask ve WebRTC tabanlı sohbet uygulaması.

## 🚀 Özellikler

- ✅ Gerçek zamanlı mesajlaşma (Socket.IO)
- ✅ Sesli arama (WebRTC)
- ✅ JWT ile kimlik doğrulama
- ✅ Kullanıcı kayıt ve giriş işlemleri
- ✅ Flask ile backend altyapısı
- ✅ SQLite veritabanı

## 🛠️ Kurulum

Projeyi klonladıktan sonra aşağıdaki adımları takip edebilirsin:

1. Python sanal ortamını oluştur:
   ```bash
   python -m venv venv
   ```

2. Ortamı etkinleştir (Windows):
   ```bash
   venv\Scripts\activate
   ```

3. Gerekli bağımlılıkları yükle:
   ```bash
   pip install -r requirements.txt
   ```

## ▶️ Uygulamayı Başlat

1. Proje dizinine geç:
   ```bash
   cd Desktop/chat
   ```

2. Ortamı etkinleştir:
   ```bash
   venv\Scripts\activate
   ```

3. Uygulamayı çalıştır:
   ```bash
   python app.py
   ```

4. Tarayıcında aç:
   ```
   https://localhost:5000
   ```

## 📁 Proje Yapısı

```
chat/
├── app.py                  # Ana uygulama dosyası
├── import_sqlite3.py       # Veritabanı başlatma scripti
├── requirements.txt        # Bağımlılık listesi
├── templates/              # HTML dosyaları
├── static/                 # CSS ve JS dosyaları
├── cert.pem / key.pem      # HTTPS için sertifikalar
└── .gitignore              # Git'e dahil edilmeyecek dosyalar
```

## 📌 Notlar

- Sertifika dosyaları (`cert.pem`, `key.pem`) sadece yerel HTTPS geliştirme içindir.
- Tarayıcı mikrofon izni istemektedir, sesli arama özelliği için izin verilmelidir.
- WebRTC bağlantıları yalnızca HTTPS veya `localhost` üzerinden çalışır.

