# Phase 23 Context: On-Device AI Face Detection & Studio Framing Engine (YuNet)

## Phase Goal
Empower OpenSmartAlbum with offline, ultra-fast on-device face & landmark detection via YuNet ONNX in the Tauri Rust backend, enabling Rule-of-Thirds portrait framing, smart auto-centering on drag & shape clipping, and intelligent photo culling.

## User Decisions & Locked Scope

### 1. On-Device YuNet Inference Engine (<10ms)
- **Model Architecture:** Menggunakan model open-source ringan **YuNet** (ONNX format, ~400KB), model deteksi wajah resmi dari OpenCV dengan akurasi tinggi dan dukungan 5 titik landmark (mata kiri, mata kanan, ujung hidung, sudut mulut kiri, sudut mulut kanan).
- **Offline & Private:** Seluruh proses inferensi dieksekusi 100% lokal pada CPU/Apple Metal di backend Rust (`src-tauri`), tanpa mengirim foto ke server eksternal apa pun.

### 2. Auto-Centering on Drag & Clipping Shapes
- **Drag-to-Frame Auto-Centering:** Saat foto ditarik dari filmstrip ke frame kanvas atau vector mask shape (bintang, poligon, oval), sistem secara otomatis menghitung titik tengah wajah (*face focal point*) dan memusatkan crop foto pada wajah daripada sekadar titik tengah matematis gambar.
- **Headroom & Shoulder Clearance:** Menjaga margin ruang di atas kepala (*headroom* ~10%) dan mencegah terpotongnya dagu/wajah saat crop framing.

### 3. Rule-of-Thirds Portrait Framing
- **Studio Portrait Alignment:** Mendukung mode auto-align di mana garis mata (*eye-level line*) ditempatkan secara harmonis pada sepertiga atas frame layout.

### 4. Smart Photo Culling
- **Quality & Focus Detection:** Menilai deteksi wajah (apakah mata terbuka/fokus, arah hadap wajah, ekspresi tersenyum) untuk memberikan badge rekomendasi (*Hero Photo / Recommended Shot*) di Photo Tray / Filmstrip.
- **Auto-Flow Integration:** Pada Storytelling / Auto-Flow Multi-Spread, foto dengan wajah terbaik diprioritaskan mengisi slot hero utama dalam layout.

## Verification Criteria
- [ ] Backend Rust memuat model YuNet ONNX dan mengeksekusi deteksi wajah dalam waktu <10ms.
- [ ] Drag foto portrait ke frame kanvas atau clipping mask otomatis memusatkan crop pada wajah.
- [ ] Opsi framing portrait menempatkan garis mata pada rule-of-thirds.
- [ ] Fitur culling memberikan indikator kualitas pada foto berwajah tajam di filmstrip.
- [ ] Integrasi dengan `adaptiveLayout.ts` mencegah pemotongan kepala saat variasi layout di-generate.
