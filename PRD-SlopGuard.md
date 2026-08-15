# Product Requirements Document (PRD)
## SlopGuard — AI Slop & Web Content Auditor
**Versi Dokumen:** 1.0
**Tipe Produk:** Browser Extension (Chrome/Firefox, Manifest V3)
**Status:** Draft untuk Review Teknis

---

## 1. Executive Summary & Problem Statement

### 1.1 Ringkasan Eksekutif

SlopGuard adalah ekstensi browser yang mendeteksi, mengaudit, dan memberi skor probabilitas konten AI-generated ("AI slop"), content farm, dan tulisan generik/klise secara real-time langsung pada halaman web yang sedang dibuka pengguna. Produk ini menggabungkan analisis teks berbasis LLM (BYOK — Bring Your Own Key) dengan overlay interaktif in-page yang terisolasi via Shadow DOM, sehingga pengguna dapat mengevaluasi kredibilitas konten tanpa berpindah tab atau alat eksternal.

### 1.2 Masalah yang Dipecahkan

| Masalah | Dampak |
|---|---|
| Ledakan konten AI-generated massal (content farm, SEO spam, "slop") membanjiri hasil pencarian | Pengguna kesulitan membedakan sumber kredibel vs. konten otomatis berkualitas rendah |
| Tidak ada indikator visual langsung di halaman untuk menilai keaslian/kualitas tulisan | Pengguna harus copy-paste ke alat eksternal (AI detector web), memutus alur baca |
| Konten AI cenderung memiliki pola klise, filler, dan struktur repetitif yang sulit dikenali kasat mata namun konsisten secara statistik-linguistik | Kepercayaan terhadap informasi menurun, riset/riset akademik/jurnalisme terganggu |
| Situs content farm sering menyamarkan diri sebagai sumber otoritatif | Sulit menilai kredibilitas domain secara keseluruhan sebelum membaca banyak artikel |

### 1.3 Value Proposition

- **Real-time, in-page, non-intrusif** — audit terjadi di tempat, tanpa copy-paste.
- **Granular** — tiga mode (per-elemen, per-halaman, per-domain) untuk kebutuhan berbeda: pembaca kasual, editor/peneliti, dan analis kredibilitas situs.
- **BYOK & privacy-conscious** — pengguna mengontrol API key dan biaya sendiri, tidak ada backend proprietary yang menyimpan konten yang dibaca pengguna.
- **Non-invasive terhadap web asli** — Shadow DOM memastikan UI SlopGuard tidak merusak tampilan/CSS situs yang diaudit.

### 1.4 Out of Scope (v1.0)

- Deteksi gambar/video AI-generated (deepfake, AI art).
- Ekstensi untuk browser mobile.
- Model deteksi lokal on-device (client-side ML) — v1 sepenuhnya bergantung pada LLM API eksternal (BYOK).
- Fitur kolaborasi/sharing skor antar pengguna (crowdsourced database) — dipertimbangkan untuk v2.

---

## 2. User Personas & Target Use Cases

### 2.1 Persona 1 — "Dana, Peneliti/Akademisi"
- **Profil:** Mahasiswa S2/dosen yang melakukan riset literatur online.
- **Kebutuhan:** Memverifikasi apakah sumber referensi (blog, artikel "expert opinion") ditulis manusia atau AI-generated tanpa fact-check.
- **Mode dominan:** Inspector Mode + Active Page Audit.
- **Pain point:** Waktu terbatas, butuh sinyal cepat tanpa membaca keseluruhan artikel.

### 2.2 Persona 2 — "Bimo, Editor Konten/SEO Specialist"
- **Profil:** Content editor di media atau agensi digital, bertanggung jawab menjaga kualitas naskah dan riset kompetitor.
- **Kebutuhan:** Mengaudit draft internal maupun benchmark artikel kompetitor untuk mendeteksi filler/klise dan mendapat saran rewrite.
- **Mode dominan:** Inspector Mode (rewrite suggestion), Active Page Audit.
- **Pain point:** Butuh output actionable (bukan sekadar skor), terintegrasi ke alur kerja editorial.

### 2.3 Persona 3 — "Sari, Pembaca Umum yang Skeptis"
- **Profil:** Pengguna internet umum yang sering terpapar artikel "top 10", listicle, dan situs berita agregator.
- **Kebutuhan:** Sinyal cepat & sederhana (skor warna) untuk menilai apakah suatu situs layak dipercaya sebelum membaca lebih jauh.
- **Mode dominan:** Overall Site Audit, indikator skor di toolbar icon.
- **Pain point:** Tidak ingin ribet konfigurasi teknis; butuh UX sederhana.

### 2.4 Persona 4 — "Rian, Developer/Power User"
- **Profil:** Software engineer yang ingin kontrol penuh atas model AI yang digunakan (privasi, biaya, atau eksperimen dengan LLM lokal).
- **Kebutuhan:** Konfigurasi BYOK fleksibel (Gemini, Groq, atau Ollama lokal), kontrol granular atas prompt/threshold.
- **Mode dominan:** Semua mode, dengan penyesuaian pengaturan lanjutan (advanced settings).

### 2.5 Ringkasan Use Case Matrix

| Use Case | Mode | Trigger |
|---|---|---|
| Cek cepat satu paragraf mencurigakan | Inspector | Hover + toggle aktif / shortcut |
| Audit menyeluruh satu artikel sebelum dikutip | Active Page Audit | Klik "Audit Halaman Ini" di popup |
| Menilai kredibilitas domain sebelum eksplorasi lebih jauh | Overall Site Audit | Klik "Audit Situs" di popup |
| Memantau kualitas draft sendiri (CMS berbasis web) | Inspector + Active Page Audit | Manual, saat editing di browser |

---

## 3. Functional Requirements

### 3.1 Mode 1 — Inspector Mode (Per-Section)

**FR-1.1 Aktivasi**
- Diaktifkan via toggle switch di popup UI atau keyboard shortcut yang dapat dikustomisasi (default: `Alt+Shift+S`).
- Saat aktif, cursor berubah menjadi crosshair/indicator khusus untuk menandakan mode inspeksi aktif.
- Status aktif disimpan per-tab (tidak global) menggunakan `chrome.storage.session` agar tidak persist tak sengaja ke semua tab.

**FR-1.2 Deteksi Elemen Target**
- Content script menggunakan event delegation (`mousemove` dengan throttle) untuk mendeteksi elemen teks yang di-hover: `<p>`, `<h1>`–`<h6>`, `<li>`, `<blockquote>`, `<article>` sections, `<div>` dengan kepadatan teks tinggi (heuristik: rasio teks-ke-tag anak minimal).
- Elemen dengan teks < 20 karakter diabaikan (threshold dikonfigurasi).
- Elemen di-highlight dengan outline tipis (1px, warna aksen netral) saat di-hover, sebelum modal muncul.

**FR-1.3 Floating Tooltip/Modal**
- Modal muncul dengan delay debounce 300–400ms setelah hover berhenti bergerak (mencegah trigger berlebihan saat cursor lewat cepat).
- Modal mengikuti posisi kursor dengan smart positioning (auto-flip jika mendekati tepi viewport, mirip Popper.js behavior — diimplementasikan manual tanpa dependency eksternal untuk menjaga bundle size).
- Modal berisi:
  - Skor indikasi AI (0–100%) dengan color coding.
  - Label kategori: "Kemungkinan Manusia", "Perlu Ditinjau", "Kemungkinan AI-Generated".
  - Daftar frasa klise/red flag yang terdeteksi (highlight inline pada teks asli jika memungkinkan via `<mark>` dalam Shadow DOM overlay, bukan memodifikasi DOM asli situs).
  - Saran penulisan ulang (rewrite suggestion) — collapsible, di-load on-demand (lazy fetch untuk menghemat token, hanya di-generate saat user klik "Tampilkan Saran").
  - Tombol "Salin Saran", "Tandai Sudah Dibaca" (dismiss & cache).
- Modal dapat di-pin (klik untuk mengunci posisi, agar tidak hilang saat mouse bergerak) untuk memungkinkan user membaca/scroll isi modal.

**FR-1.4 Debounce & Caching**
- Request ke API LLM di-debounce 300–400ms.
- Hasil audit per elemen di-cache secara lokal menggunakan hash konten (SHA-256 dari teks yang dinormalisasi) sebagai key, disimpan di `chrome.storage.local` dengan TTL default 7 hari (dikonfigurasi).
- Cache-hit tidak memicu request API baru — langsung render dari cache.
- Jika elemen yang sama di-hover ulang dalam sesi yang sama, gunakan in-memory cache (Map) sebelum fallback ke `chrome.storage.local`.

**FR-1.5 Shadow DOM Implementation**
- Seluruh UI Inspector Mode (highlight overlay, tooltip modal) dirender di dalam satu root Shadow DOM (`mode: 'closed'` direkomendasikan untuk isolasi maksimal, dengan fallback `'open'` jika dibutuhkan debugging).
- Shadow root di-attach ke satu container `<div>` yang disisipkan di akhir `<body>` via content script, dengan `position: fixed` dan `z-index` maksimal aman (misal `2147483647`) untuk memastikan selalu di atas elemen halaman.
- Semua style (reset CSS + Tailwind terkompilasi/scoped) di-inject ke dalam shadow root, tidak bocor ke halaman induk dan sebaliknya (CSS halaman tidak memengaruhi UI SlopGuard).
- Font di-load dengan fallback system font stack untuk menghindari FOUC dan dependency eksternal.

### 3.2 Mode 2 — Active Page Audit (Per-Halaman)

**FR-2.1 Ekstraksi Konten**
- Trigger manual via tombol "Audit Halaman Ini" di popup, atau otomatis (opsional, disable by default) saat navigasi ke halaman baru.
- Content script melakukan ekstraksi teks utama menggunakan strategi hybrid:
  1. Prioritas selector semantik: `<article>`, `<main>`, `[role="main"]`.
  2. Fallback: algoritma heuristik kepadatan teks (mirip Readability.js — dapat mengadaptasi library open-source Readability sebagai dependency, atau implementasi ringan custom) untuk mengidentifikasi blok konten utama.
- **Boilerplate exclusion** — elemen berikut dikecualikan dari analisis:
  - `<nav>`, `<header>`, `<footer>`, `<aside>`.
  - Elemen dengan class/id mengandung pola umum: `sidebar`, `ad`, `advertisement`, `banner`, `cookie`, `newsletter`, `related-posts`, `comments`, `share-buttons`, `menu`.
  - Elemen dengan `display: none` atau `visibility: hidden` (dicek via computed style).
  - iframe pihak ketiga (ads, embed sosial media) — teks dari iframe cross-origin tidak dapat diakses dan otomatis dikecualikan.

**FR-2.2 Analisis Menyeluruh**
- Teks yang diekstrak di-chunk (jika melebihi context window model yang dikonfigurasi) dengan overlap minimal untuk menjaga koherensi analisis.
- Evaluasi mencakup:
  - Skor AI-probability keseluruhan halaman (agregat, bukan rata-rata sederhana — mempertimbangkan bobot panjang tiap section).
  - Deteksi repetisi (frasa/struktur kalimat yang berulang secara tidak natural).
  - Kepadatan informasi vs. filler (rasio konten substantif terhadap kalimat pengisi).
  - Konsistensi alur argumen/narasi antar-paragraf.

**FR-2.3 Output Visual**
- **Outline berwarna** di-overlay pada section bermasalah langsung di halaman (border kiri tebal 3–4px dengan warna status), diimplementasikan via absolutely-positioned overlay dalam Shadow DOM container yang sama (bukan memodifikasi elemen asli — untuk menghindari konflik CSS/JS situs).
- **Panel sidebar** (slide-in dari kanan, di dalam Shadow DOM, lebar default 340px, dapat di-collapse):
  - Ringkasan skor keseluruhan halaman.
  - Daftar section bermasalah dengan skor masing-masing, dapat diklik untuk auto-scroll ke section terkait pada halaman.
  - Statistik: jumlah frasa klise terdeteksi, estimasi rasio AI-generated, panjang total teks dianalisis.
  - Tombol export laporan (JSON/Markdown) untuk kebutuhan dokumentasi (mis. editor menyimpan hasil audit draft).

### 3.3 Mode 3 — Overall Site Audit (Multi-Page/Domain Health)

**FR-3.1 Sampling Tautan Internal**
- Saat diaktifkan via popup ("Audit Situs"), ekstensi mengumpulkan seluruh tautan `<a>` pada halaman aktif yang mengarah ke domain yang sama (same eTLD+1).
- Filtering tautan kandidat:
  - Prioritaskan tautan yang berada dalam elemen konten utama (bukan navigasi/footer) — indikasi artikel terkait.
  - Exclude tautan ke halaman non-artikel (pola URL: `/login`, `/cart`, `/tag/`, `/category/`, file media langsung).
  - Deduplicate dan pilih 3–5 tautan secara representatif (kombinasi acak + prioritas tautan "artikel terkait"/"baca juga" jika terdeteksi).
- Fetch dilakukan di background (service worker + offscreen document/hidden tab strategy — lihat 3.5) tanpa mengganggu tab aktif pengguna.

**FR-3.2 Agregasi Skor Domain**
- Setiap halaman sampel menjalani proses ekstraksi & analisis ringkas (subset dari FR-2.1/2.2, dengan chunk lebih kecil untuk efisiensi token).
- Skor agregat domain dihitung sebagai weighted average, dengan indikator tambahan:
  - Konsistensi skor antar-halaman (variance rendah = pola sistematis, baik ke arah positif maupun negatif).
  - Flag "Kemungkinan Content Farm" jika: skor AI rata-rata tinggi (>70%) **dan** variance rendah **dan** pola struktural artikel sangat seragam (mis. heading pattern identik).
- Hasil ditampilkan di popup sebagai kartu ringkasan domain, dengan opsi "Lihat Detail per Halaman".

**FR-3.3 Batasan & Etika Scraping**
- Menghormati `robots.txt` untuk tautan yang di-fetch di background (parsing sederhana, cek disallow untuk path terkait).
- Rate limiting: jeda minimal antar-fetch (mis. 500ms–1s) untuk menghindari beban berlebih ke server target.
- Tidak melakukan fetch ke domain yang memerlukan autentikasi/berada di belakang paywall (deteksi via status code 401/403, atau elemen paywall umum) — fallback ke skip halaman tersebut.

### 3.4 Bypass Login / Halaman Terautentikasi

**FR-4.1 Prinsip Umum**
- SlopGuard **tidak** melakukan bypass otentikasi dalam arti keamanan (tidak mencoba menembus login). Yang dimaksud adalah kemampuan menganalisis konten pada halaman yang **sudah** diautentikasi oleh pengguna sendiri (mis. artikel premium yang sudah dibuka via subscription pengguna).
- Untuk Inspector Mode dan Active Page Audit: karena berjalan sebagai content script di tab aktif milik pengguna, ekstraksi teks otomatis mendapat akses ke DOM ter-render (termasuk konten yang baru muncul setelah login), tanpa perlu penanganan khusus — ini adalah perilaku default content script.
- Untuk Overall Site Audit (fetch background ke tautan lain): **tidak** menyertakan cookie sesi pengguna secara default (fetch dilakukan tanpa credentials untuk menghindari isu privasi/keamanan). Jika halaman sampel memerlukan login dan gagal diakses, halaman tersebut di-skip dan dicatat di laporan sebagai "Tidak dapat diakses (kemungkinan konten berbayar/privat)".
- Opsi lanjutan (disabled by default, dengan warning eksplisit saat diaktifkan): mengizinkan fetch background menyertakan cookie domain saat ini (`credentials: 'include'`) khusus untuk domain yang sama dengan tab aktif — untuk kasus situs berlangganan milik pengguna sendiri. Membutuhkan persetujuan eksplisit per-domain.

### 3.5 Arsitektur Eksekusi Cross-Component

**FR-5.1 Komponen**
- **Content Script** — inject ke setiap tab, menangani ekstraksi DOM, Shadow DOM UI, event listener hover.
- **Service Worker (Background)** — menangani komunikasi API ke LLM (agar API key tidak terekspos ke halaman web/content script yang berjalan di context halaman pihak ketiga), manajemen cache, orkestrasi Overall Site Audit (fetch multi-halaman).
- **Popup UI** — kontrol mode, pengaturan cepat, ringkasan hasil audit.
- **Options Page** — konfigurasi BYOK (API key, model provider, endpoint custom untuk Ollama), threshold skor, whitelist/blacklist domain, pengaturan retensi cache.
- Komunikasi antar-komponen via `chrome.runtime.sendMessage` / `chrome.runtime.onMessage`, dengan skema pesan terstruktur (lihat Bagian 6).

**FR-5.2 Keamanan API Key**
- API key BYOK disimpan di `chrome.storage.local` (bukan `sync`, untuk menghindari transmisi ke akun Google/Firefox pengguna tanpa kontrol eksplisit — dapat dijadikan opsi jika pengguna memilih sync).
- Seluruh request ke API LLM eksternal **hanya** dilakukan dari service worker, tidak pernah dari content script (mencegah eksposur key ke halaman web yang berpotensi malicious via console/DOM inspection).

### 3.6 Fitur Konfigurasi & Kontrol Pengguna

**FR-6.1 Whitelist/Blacklist Domain**
- Pengguna dapat menonaktifkan SlopGuard sepenuhnya untuk domain tertentu (mis. situs internal kantor, localhost saat development).

**FR-6.2 Threshold Kustomisasi**
- Pengguna dapat menyesuaikan ambang batas warna status (default: Hijau 0–30%, Kuning 31–65%, Merah 66–100%) via Options Page.

**FR-6.3 Manajemen Provider LLM**
- Dropdown pilihan provider: Gemini API, Groq, Ollama (local endpoint, default `http://localhost:11434`).
- Validasi koneksi ("Test Connection") sebelum menyimpan konfigurasi.
- Estimasi biaya per audit ditampilkan sebagai indikator kasar (berdasarkan jumlah token dan pricing publik provider terkait) — bukan biaya presisi.

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Aspek | Target | Catatan |
|---|---|---|
| Waktu respons hover-to-modal (cache hit) | < 100ms | Rendering murni dari cache lokal |
| Waktu respons hover-to-modal (cache miss, network) | Bergantung latensi provider, target UI skeleton loading muncul < 150ms | Tampilkan loading state segera, jangan blocking |
| Debounce hover trigger | 300–400ms | Mencegah request berlebih |
| Overhead injeksi content script per halaman | < 50ms tambahan pada `DOMContentLoaded` | Diukur via Performance API saat development |
| Ekstraksi teks Active Page Audit (halaman ukuran umum, ~2000 kata) | < 500ms proses lokal (belum termasuk waktu API) | Ekstraksi dilakukan async, tidak blocking main thread lama (gunakan `requestIdleCallback` jika memungkinkan) |

### 4.2 Token & Cost Optimization

- **Caching agresif** berbasis hash konten — hindari re-analisis teks identik.
- **Chunking cerdas** — hanya kirim teks yang relevan (setelah boilerplate exclusion), bukan seluruh HTML mentah.
- **Lazy loading rewrite suggestion** — saran penulisan ulang hanya di-generate on-demand, bukan otomatis bersamaan dengan skor awal (memisahkan API call skor vs. call rewrite untuk menghemat token pada kasus user hanya butuh skor cepat).
- **Batching untuk Overall Site Audit** — jika provider mendukung, gabungkan beberapa halaman sampel dalam satu request terstruktur alih-alih request terpisah per halaman (trade-off dengan context window; fallback ke request terpisah jika teks gabungan melebihi limit).
- **Truncation strategy** — untuk artikel sangat panjang, opsi sampling (analisis representative excerpt: pembuka + tengah + penutup) alih-alih seluruh teks, dapat dikonfigurasi pengguna (trade-off akurasi vs. biaya, dijelaskan secara transparan di UI).

### 4.3 Memory Footprint

- In-memory cache (Map) dibatasi maksimal (mis. 200 entri terbaru per sesi, LRU eviction) untuk menghindari memory leak pada sesi browsing panjang.
- `chrome.storage.local` cache dibatasi total ukuran (mis. cap 10MB, dengan eviction otomatis entri terlama saat mendekati limit — sejalan dengan `chrome.storage.local` quota yang tersedia).
- Shadow DOM container di-cleanup (removeEventListener, detach node) saat tab ditutup atau ekstensi dinonaktifkan untuk mencegah orphaned listener.

### 4.4 Keandalan & Error Handling

- Jika API call gagal (timeout, rate limit, invalid key), modal menampilkan status error yang jelas dengan opsi retry — tidak silent fail.
- Jika ekstraksi konten gagal mendeteksi area teks utama (halaman dengan struktur tidak umum, mis. SPA kompleks), fallback ke mode manual: pengguna dapat men-select teks secara manual dan klik "Audit Seleksi Ini" via context menu.
- Graceful degradation saat Manifest V3 service worker "tertidur" (idle) — request yang tertunda di-antrikan dan dijalankan ulang saat service worker aktif kembali (menggunakan `chrome.alarms` untuk keep-alive terbatas jika diperlukan, sesuai kebijakan MV3).

### 4.5 Kompatibilitas

- Chrome/Chromium (Manifest V3) sebagai target utama.
- Firefox (Manifest V3, mendukung sejak Firefox 109+) sebagai target sekunder — perhatikan perbedaan API (`browser.*` vs `chrome.*`, gunakan polyfill seperti `webextension-polyfill`).
- Tidak mendukung Manifest V2 (deprecated).

### 4.6 Privasi

- Tidak ada telemetry/analytics default yang mengirim konten halaman yang dibaca pengguna ke server SlopGuard sendiri — komunikasi hanya terjadi langsung antara ekstensi dan provider LLM pilihan pengguna (BYOK).
- Disclosure jelas di Options Page mengenai data apa yang dikirim ke provider eksternal (teks halaman yang dianalisis).

---

## 5. UI/UX Specifications

### 5.1 Prinsip Desain (Zero UI Slop)

- **Monokrom fungsional** — palet dasar grayscale (mis. `#0A0A0A` hingga `#FAFAFA`), dengan aksen warna **hanya** untuk status audit:
  - Hijau (`#22C55E` atau setara) — Original/Low Risk.
  - Kuning (`#EAB308` atau setara) — Perlu Ditinjau/Medium Risk.
  - Merah (`#EF4444` atau setara) — High Slop/High Risk.
- **Border tipis** (1px solid, warna abu netral) sebagai elemen pemisah utama — tanpa drop shadow berlebihan, tanpa gradient dekoratif.
- **Tipografi** — sans-serif sistem (mis. `Inter`, fallback ke `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`), hierarki tegas via weight (400/500/600/700) dan ukuran, bukan warna berlebih.
- **Tanpa emoji** — di seluruh UI, tooltip, notifikasi, dan dokumentasi. Indikator status menggunakan warna + label teks + ikon linear/outline sederhana (bukan emoji, bukan ikon filled berwarna-warni).
- **Whitespace disiplin** — spacing konsisten berbasis skala 4px/8px, tidak padat, tidak kosong berlebihan.

### 5.2 Popup UI (Toolbar Icon Click)

**Layout (dimensi: 360px × auto, max-height 560px):**

```
┌─────────────────────────────────────┐
│  SLOPGUARD              [● Aktif]   │  <- Header, status global
├─────────────────────────────────────┤
│  Mode Inspector          [ Toggle ] │
│  Shortcut: Alt+Shift+S              │
├─────────────────────────────────────┤
│  [ Audit Halaman Ini ]              │  <- Primary button, full width
│  [ Audit Situs (3-5 halaman) ]      │  <- Secondary button
├─────────────────────────────────────┤
│  Ringkasan Terakhir                 │
│  ┌─────────────────────────────┐   │
│  │ example.com/artikel-x        │   │
│  │ Skor: 72%  [MERAH]           │   │
│  │ Diaudit 2 menit lalu         │   │
│  └─────────────────────────────┘   │
├─────────────────────────────────────┤
│  [Icon] Pengaturan   [Icon] Riwayat │
└─────────────────────────────────────┘
```

- Status global (badge di icon toolbar) menampilkan skor Active Page Audit terakhir untuk tab tersebut (angka + warna latar badge), mengikuti pola badge notification standar ekstensi browser.

### 5.3 In-Page Floating Modal (Inspector Mode)

**Dimensi:** 320px lebar (responsive terhadap sisa ruang viewport), auto-height dengan max-height 400px + scroll internal.

```
┌───────────────────────────────────┐
│  ▌ 78%  KEMUNGKINAN AI-GENERATED   │  <- Header dgn accent bar warna status
├───────────────────────────────────┤
│  Frasa Terdeteksi:                 │
│  • "dalam lanskap yang terus       │
│     berkembang"                    │
│  • "penting untuk dicatat bahwa"   │
│  • "pada akhirnya"                 │
├───────────────────────────────────┤
│  [ Tampilkan Saran Rewrite ▾ ]     │  <- Collapsible, lazy load
├───────────────────────────────────┤
│  [ Salin ]   [ Tandai Dibaca ]  [x]│
└───────────────────────────────────┘
```

- Accent bar vertikal tipis (4px) di sisi kiri header menggunakan warna status — satu-satunya elemen non-monokrom selain badge skor.
- Skor ditampilkan besar dan tegas (font-weight 700, ukuran ~24px) sebagai focal point utama.
- Saat loading (cache miss, menunggu API), tampilkan skeleton shimmer minimal (bar abu-abu pulsing), bukan spinner generik.

### 5.4 Sidebar Panel (Active Page Audit)

**Dimensi:** 340px lebar, tinggi penuh viewport, slide-in dari kanan, dapat di-collapse ke strip 40px (icon-only).

```
┌──────────────────────────┐
│  AUDIT HALAMAN      [«]  │
├──────────────────────────┤
│  Skor Keseluruhan         │
│  ┌────────────────────┐  │
│  │        64%          │  │
│  │   PERLU DITINJAU    │  │
│  └────────────────────┘  │
├──────────────────────────┤
│  Section Bermasalah (4)   │
│  ┌────────────────────┐  │
│  │ § Pendahuluan  81%  │→ │  <- klik = scroll ke section
│  │ § Bagian 3     45%  │→ │
│  │ § Kesimpulan   88%  │→ │
│  └────────────────────┘  │
├──────────────────────────┤
│  Statistik                │
│  Frasa klise: 12          │
│  Kata dianalisis: 1,847   │
├──────────────────────────┤
│  [ Export Laporan ]       │
└──────────────────────────┘
```

- Outline berwarna pada halaman: border-left 4px solid pada bounding box overlay yang di-posisikan tepat di atas section asli (menggunakan `getBoundingClientRect()` dan reposisi saat scroll/resize via `ResizeObserver`/`IntersectionObserver`).

### 5.5 State Management (Frontend)

- **State lokal per-tab** (disimpan di `chrome.storage.session`, keyed by `tabId`):
  - Status Inspector Mode aktif/nonaktif.
  - Hasil Active Page Audit terakhir (jika ada) untuk render ulang sidebar saat popup dibuka kembali tanpa re-fetch.
- **State global** (disimpan di `chrome.storage.local`):
  - Preferensi pengguna (threshold, provider, shortcut key).
  - Cache hasil audit (keyed by content hash).
  - Whitelist/blacklist domain.
- **State flow:**
  1. Content script → kirim pesan ke Service Worker saat butuh analisis.
  2. Service Worker → cek cache → jika miss, panggil API LLM → simpan hasil ke cache → kirim balik ke content script.
  3. Content script → render hasil ke Shadow DOM UI.
  4. Popup UI → subscribe ke state tab aktif saat dibuka (query via `chrome.tabs.sendMessage` atau baca dari `chrome.storage.session`).
- Idempotency: setiap request diberi request ID unik; jika modal ditutup sebelum response tiba, response diabaikan (dicocokkan via request ID) untuk mencegah stale render.

### 5.6 Aksesibilitas

- Seluruh elemen interaktif dapat dinavigasi via keyboard (tab order logis di dalam Shadow DOM).
- Kontras warna teks-background memenuhi WCAG AA minimum, termasuk pada varian warna status (hijau/kuning/merah tetap readable terhadap background gelap/terang).
- `aria-label` pada tombol icon-only (mis. tombol collapse sidebar, tombol close modal).

---

## 6. Data Flow & API Schema

### 6.1 Diagram Alur Data (Ringkas)

```
[Content Script]
  │  1. Ekstraksi teks elemen (hover) / halaman / kumpulan tautan
  ▼
[Service Worker]
  │  2. Cek chrome.storage.local (cache by content-hash)
  │     ├─ HIT  → return cached result
  │     └─ MISS ▼
  │  3. Bangun prompt terstruktur + payload JSON
  ▼
[LLM Provider API] (Gemini / Groq / Ollama — BYOK)
  │  4. Response JSON terstruktur
  ▼
[Service Worker]
  │  5. Validasi schema response, simpan ke cache
  ▼
[Content Script / Popup]
  │  6. Render UI (modal / sidebar / popup summary)
```

### 6.2 Skema Pesan Internal (Content Script ↔ Service Worker)

**Request — Analisis Elemen Tunggal (Inspector Mode)**
```json
{
  "type": "ANALYZE_ELEMENT",
  "requestId": "uuid-v4-string",
  "payload": {
    "tabId": 123,
    "url": "https://example.com/artikel-x",
    "elementSelector": "article > p:nth-child(3)",
    "text": "Dalam lanskap digital yang terus berkembang, penting untuk dicatat bahwa...",
    "contentHash": "sha256-hex-string",
    "mode": "score_only"
  }
}
```

`mode` bernilai `"score_only"` (default, hemat token) atau `"full"` (skor + rewrite suggestion sekaligus, dipicu saat user klik "Tampilkan Saran").

**Request — Active Page Audit**
```json
{
  "type": "ANALYZE_PAGE",
  "requestId": "uuid-v4-string",
  "payload": {
    "tabId": 123,
    "url": "https://example.com/artikel-x",
    "sections": [
      {
        "sectionId": "sec-1",
        "selector": "article > h1",
        "role": "heading",
        "text": "Judul Artikel Contoh"
      },
      {
        "sectionId": "sec-2",
        "selector": "article > p:nth-child(2)",
        "role": "paragraph",
        "text": "Isi paragraf pertama..."
      }
    ],
    "excludedElementsCount": 14
  }
}
```

**Request — Overall Site Audit**
```json
{
  "type": "ANALYZE_SITE",
  "requestId": "uuid-v4-string",
  "payload": {
    "originDomain": "example.com",
    "sourceUrl": "https://example.com/artikel-x",
    "sampledUrls": [
      "https://example.com/artikel-y",
      "https://example.com/artikel-z",
      "https://example.com/artikel-w"
    ]
  }
}
```

### 6.3 Skema Prompt ke LLM (Konseptual)

Service worker membangun system prompt yang menginstruksikan model untuk **selalu** mengembalikan JSON valid tanpa teks tambahan, dengan struktur output yang telah ditentukan. Contoh kerangka instruksi (bukan verbatim prompt final):

- Instruksikan model bertindak sebagai auditor linguistik yang menilai probabilitas teks dihasilkan oleh AI generatif berdasarkan pola: frasa klise/filler umum, struktur kalimat homogen, kurangnya spesifisitas/detail konkret, transisi generik.
- Instruksikan output **hanya** JSON, sesuai schema pada 6.4, tanpa markdown code fence, tanpa preamble.
- Sertakan few-shot minimal (opsional, dapat dikonfigurasi) untuk kalibrasi skor.

### 6.4 Skema Output JSON dari LLM

**Response — Skor Elemen Tunggal**
```json
{
  "requestId": "uuid-v4-string",
  "elementScore": {
    "aiProbability": 78,
    "statusLabel": "high_slop",
    "flaggedPhrases": [
      {
        "phrase": "dalam lanskap yang terus berkembang",
        "reason": "transisi generik/klise umum pada teks AI-generated"
      },
      {
        "phrase": "penting untuk dicatat bahwa",
        "reason": "filler phrase, tidak menambah informasi substantif"
      }
    ],
    "rewriteSuggestion": null
  }
}
```

`statusLabel` bernilai salah satu dari: `"original"`, `"needs_review"`, `"high_slop"` — dipetakan dari `aiProbability` menggunakan threshold yang dikonfigurasi pengguna (default 0–30 / 31–65 / 66–100).

`rewriteSuggestion` bernilai `null` pada `mode: "score_only"`, dan berisi string saran penulisan ulang saat `mode: "full"`.

**Response — Audit Halaman**
```json
{
  "requestId": "uuid-v4-string",
  "pageAudit": {
    "overallScore": 64,
    "statusLabel": "needs_review",
    "totalWordsAnalyzed": 1847,
    "totalFlaggedPhrases": 12,
    "sections": [
      {
        "sectionId": "sec-1",
        "score": 81,
        "statusLabel": "high_slop"
      },
      {
        "sectionId": "sec-2",
        "score": 45,
        "statusLabel": "needs_review"
      }
    ],
    "flowAnalysis": {
      "repetitionScore": 58,
      "informationDensityScore": 42,
      "note": "Ringkasan singkat temuan alur/repetisi dalam satu-dua kalimat"
    }
  }
}
```

**Response — Audit Situs**
```json
{
  "requestId": "uuid-v4-string",
  "siteAudit": {
    "domain": "example.com",
    "aggregateScore": 74,
    "statusLabel": "high_slop",
    "scoreVariance": "low",
    "contentFarmFlag": true,
    "pages": [
      { "url": "https://example.com/artikel-y", "score": 76 },
      { "url": "https://example.com/artikel-z", "score": 71 },
      { "url": "https://example.com/artikel-w", "skipped": true, "reason": "authentication_required" }
    ]
  }
}
```

### 6.5 Skema Cache (chrome.storage.local)

```json
{
  "slopguard_cache_v1": {
    "<contentHash>": {
      "aiProbability": 78,
      "statusLabel": "high_slop",
      "flaggedPhrases": ["..."],
      "rewriteSuggestion": null,
      "cachedAt": 1734000000000,
      "ttl": 604800000
    }
  }
}
```

### 6.6 Skema Konfigurasi Pengguna

```json
{
  "slopguard_settings_v1": {
    "provider": "gemini",
    "apiKey": "encrypted-or-plain-per-storage-policy",
    "customEndpoint": null,
    "model": "gemini-2.5-flash",
    "thresholds": { "low": 30, "medium": 65 },
    "shortcutKey": "Alt+Shift+S",
    "domainList": {
      "whitelist": [],
      "blacklist": ["localhost", "internal.company.com"]
    },
    "cacheTtlMs": 604800000,
    "autoAuditOnNavigate": false,
    "includeCredentialsForSameDomainFetch": false
  }
}
```

---

## 7. Implementation Roadmap & Milestones

### 7.1 Fase 0 — Fondasi & Setup (Minggu 1–2)
- Setup project skeleton Manifest V3 (manifest.json, build pipeline dengan bundler — mis. Vite/esbuild — untuk compile Tailwind scoped ke Shadow DOM).
- Implementasi struktur dasar Service Worker, Content Script, Popup, Options Page (skeleton kosong, komunikasi dasar antar-komponen berfungsi).
- Setup Shadow DOM container dasar dengan style isolation teruji di berbagai situs (uji di 5+ situs dengan CSS berbeda-beda untuk validasi non-leakage).

### 7.2 Fase 1 — Inspector Mode MVP (Minggu 3–5)
- Implementasi hover detection + debounce.
- Implementasi floating modal (positioning, follow cursor, edge detection).
- Integrasi API BYOK untuk Gemini (provider pertama sebagai referensi implementasi).
- Implementasi caching lokal (content-hash based).
- Skema prompt & parsing response JSON untuk skor elemen tunggal.
- **Milestone:** Inspector Mode dapat memberikan skor real-time pada elemen teks yang di-hover, dengan caching berfungsi.

### 7.3 Fase 2 — Active Page Audit MVP (Minggu 6–8)
- Implementasi algoritma ekstraksi konten utama + boilerplate exclusion.
- Implementasi sidebar panel UI + outline overlay pada section bermasalah.
- Implementasi chunking untuk artikel panjang.
- Export laporan (JSON/Markdown).
- **Milestone:** Pengguna dapat mengaudit satu halaman penuh dan melihat rangkuman visual di sidebar.

### 7.4 Fase 3 — Overall Site Audit & Multi-Provider (Minggu 9–11)
- Implementasi sampling tautan internal + fetch background dengan rate limiting & robots.txt check.
- Implementasi agregasi skor domain + content farm flag logic.
- Tambahkan dukungan provider Groq dan Ollama (local) di Options Page, dengan abstraksi provider layer (interface umum agar mudah menambah provider baru).
- **Milestone:** Ketiga mode scan berfungsi penuh dengan minimal 3 provider LLM didukung.

### 7.5 Fase 4 — Polish, Aksesibilitas, & Optimasi (Minggu 12–13)
- Audit performa (memory footprint, latency) sesuai target Bagian 4.
- Audit aksesibilitas (keyboard nav, kontras warna, aria-label).
- Refinement UI/UX sesuai prinsip Zero UI Slop — review desain menyeluruh.
- Error handling & edge case testing (SPA dinamis, infinite scroll, halaman dengan iframe berat, dsb).
- Uji kompatibilitas Firefox (polyfill, penyesuaian manifest jika diperlukan).

### 7.6 Fase 5 — Beta & Rilis (Minggu 14–16)
- Closed beta dengan target persona (mis. komunitas editor/peneliti kecil) untuk feedback kualitatif.
- Perbaikan bug kritis dari feedback beta.
- Penyusunan dokumentasi pengguna (tanpa emoji, sesuai prinsip desain) & privacy policy terkait BYOK.
- Submission ke Chrome Web Store & Firefox Add-ons, termasuk penyesuaian terhadap kebijakan review masing-masing store (khususnya terkait permission scope dan disclosure penggunaan API eksternal).
- **Milestone:** Rilis publik v1.0.

### 7.7 Ringkasan Timeline

| Fase | Durasi | Output Utama |
|---|---|---|
| Fase 0 — Fondasi | 2 minggu | Skeleton project, Shadow DOM teruji |
| Fase 1 — Inspector Mode | 3 minggu | Mode hover-audit berfungsi (1 provider) |
| Fase 2 — Active Page Audit | 3 minggu | Audit halaman penuh + sidebar |
| Fase 3 — Site Audit & Multi-Provider | 3 minggu | Audit domain + 3 provider BYOK |
| Fase 4 — Polish & Optimasi | 2 minggu | Performa, aksesibilitas, refinement UI |
| Fase 5 — Beta & Rilis | 3 minggu | Rilis publik v1.0 |
| **Total** | **~16 minggu** | |

### 7.8 Metrik Keberhasilan (Success Metrics) Pasca-Rilis

| Metrik | Target Awal |
|---|---|
| Waktu rata-rata hover-to-score (cache miss) | < 2 detik (bergantung provider) |
| Cache hit rate setelah 1 minggu penggunaan aktif | > 40% |
| Crash/error rate content script | < 0.5% dari total sesi |
| Rating store (Chrome Web Store / Firefox Add-ons) | ≥ 4.2 dalam 3 bulan pertama |
| Retensi pengguna aktif mingguan (dari total instalasi) | ≥ 25% dalam 1 bulan pertama |

---

## Lampiran A — Daftar Permission Manifest V3 (Estimasi Awal)

```json
{
  "manifest_version": 3,
  "permissions": [
    "storage",
    "activeTab",
    "scripting",
    "contextMenus",
    "alarms"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "optional_host_permissions": [
    "https://generativelanguage.googleapis.com/*",
    "https://api.groq.com/*",
    "http://localhost:11434/*"
  ]
}
```

Catatan: `host_permissions` untuk `<all_urls>` diperlukan karena SlopGuard beroperasi di sembarang halaman yang dikunjungi pengguna; disclosure jelas mengenai hal ini wajib dicantumkan di deskripsi store dan Options Page demi transparansi dan kelolosan review.

---

*Dokumen ini adalah draft v1.0 dan terbuka untuk revisi berdasarkan hasil technical spike (khususnya validasi algoritma ekstraksi boilerplate dan uji akurasi model pada Fase 1).*
