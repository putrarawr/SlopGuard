# 🛡️ SlopGuard

**SlopGuard** adalah Ekstensi Chrome inovatif yang berfungsi sebagai *Linguistic & Visual Auditor* untuk mendeteksi konten buatan AI (*AI Slop*) di internet. Ekstensi ini membantu Anda mengetahui apakah sebuah artikel, komponen teks, atau bahkan desain visual di suatu halaman web dihasilkan oleh manusia atau dimuntahkan secara massal oleh AI generatif.

## ✨ Fitur Utama

- **🔍 Active Page Audit:** Pindai seluruh teks di halaman web dengan sekali klik.
- **👁️ Visual Design Audit:** Analisis elemen desain dan tata letak menggunakan model Multimodal (Vision) untuk mendeteksi desain web generik ala AI.
- **🎯 Smart Component Highlighting:** Tidak perlu menebak! Ekstensi akan menyoroti (stabilo merah & kedip) paragraf atau komponen persis di web yang terindikasi tulisan robot.
- **⚡ Zero-Token Caching:** Sistem *Cache* cerdas akan menyimpan hasil pindai secara lokal. Pemindaian ulang pada web yang sama akan dimuat dalam 0 detik tanpa memotong kuota API Anda.
- **🧠 Multi-Provider AI:** Mendukung Google Gemini (Cloud), Groq (Cloud Super Cepat), dan Ollama (100% Offline Lokal & Privat).

---

## ⚠️ PERHATIAN PENTING: Keterbatasan Model AI Gratis

SlopGuard dirancang untuk bekerja dengan model API gratis seperti Google Gemini (Free Tier) dan Groq. Namun, karena Anda menggunakan model yang digratiskan oleh pihak ketiga, ada beberapa kekurangan yang mungkin Anda alami:

1. **Akurasi Berubah-ubah (Halusinasi):** Model gratis terkadang dapat melakukan *paraphrasing* yang salah atau keliru mengira teks manusia sebagai teks AI (*False Positive*). Model yang lebih kecil (seperti Llama 8B) kurang akurat dibandingkan model berbayar raksasa.
2. **Limitasi Kuota (Rate Limits 429):** Penyedia API sering membatasi jumlah permintaan per menit. Jika Anda terlalu sering mengeklik tombol Audit, Anda mungkin akan terkena *Error 429: Too Many Requests*.
3. **Server Down (Error 503):** Karena antrean pengguna gratisan di seluruh dunia sangat panjang, server Groq atau Gemini seringkali *Overload*. Anda mungkin menerima *Error 503 (High Demand)*. Ini bukan *bug* pada ekstensi, melainkan server pusat yang sedang sibuk.

**💡 Solusi Terbaik:**
Jika Anda memiliki komputer atau laptop dengan spesifikasi menengah-atas, kami sangat menyarankan Anda beralih ke **Ollama (Mode Lokal)**.
Dengan Ollama:
- **Gratis Selamanya** (Tanpa batasan kuota / Rate Limit).
- **100% Offline** (Tidak akan pernah *Error 503* karena servernya adalah komputer Anda sendiri).
- **Privasi Penuh** (Teks website yang Anda pindai tidak akan dikirim ke internet).

---

## 🚀 Cara Instalasi

1. Pastikan Anda sudah menginstal [Node.js](https://nodejs.org/).
2. Unduh/Clone *repository* ini ke komputer Anda.
3. Buka Terminal dan jalankan perintah:
   ```bash
   npm install
   npm run build
   ```
4. Buka Google Chrome, pergi ke `chrome://extensions/`.
5. Nyalakan **Developer mode** (Pojok kanan atas).
6. Klik **Load unpacked** dan pilih folder `dist/` yang baru saja dihasilkan oleh perintah *build*.
7. Ekstensi SlopGuard siap digunakan! Pin ikonnya di *toolbar* Anda.

## 🛠️ Konfigurasi API Key

Agar ekstensi bisa bekerja, Anda harus menyediakan minimal 1 *API Key* (Atau jalankan aplikasi Ollama di *background*):
- **Google Gemini:** Ambil secara gratis di [Google AI Studio](https://aistudio.google.com/app/apikey)
- **Groq:** Ambil secara gratis di [Groq Console](https://console.groq.com/keys)
- **Ollama:** *Download* aplikasinya di [Ollama.com](https://ollama.com/), instal, dan jalankan perintah `ollama run llama3` di CMD/Terminal Anda.

> Buka opsi **Pengaturan** ekstensi dengan mengeklik kanan ikon SlopGuard lalu pilih *Options* untuk memasukkan API Key Anda.
