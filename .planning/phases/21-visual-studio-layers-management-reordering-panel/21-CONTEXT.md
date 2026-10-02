# Phase 21 Context: Visual Studio Layers Management & Reordering Panel

## Phase Goal
Introduce a comprehensive Studio Layers panel located as a tab in the Right Inspector for intuitive z-index reordering, multi-selection batch management, and layer visibility controls.

## User Decisions & Locked Scope

### 1. Panel Placement & Header
- **Tab in Right Inspector:** Ditempatkan sebagai Tab di sebelah tab "Design / Properties" pada [InspectorContainer.tsx](file:///Users/chiio/VSCode/albumaker/src/features/inspector/InspectorContainer.tsx), sehingga desainer dapat beralih antara inspeksi properti dan manajemen susunan layer dengan cepat.
- **Header Actions:** Indikator total layer pada spread/slide aktif, tombol lock-all / unlock-all.

### 2. Layer Cards & Element Types
- **Card Items:**
  - Thumbnail preview mini (untuk foto), ikon tipe (Type T untuk teks, Vector shape untuk poligon/mask).
  - Nama elemen yang dapat di-rename atau deskripsi otomatis (misal `Photo: IMG_0123.jpg`, `Text: Heading`, `Mask: 6-Point Star`).
  - Quick action buttons per card: Toggle Hide/Show (Eye icon), Toggle Lock/Unlock (Lock icon), Delete (Trash icon).
- **Selection Sync:** Mengklik layer card di panel otomatis memilih frame bersangkutan di canvas, begitu juga sebaliknya.

### 3. Drag & Drop Reordering Engine
- **Midpoint Crossing Feedback:** Indikator garis penyisipan (insertion line) hanya berpindah saat pointer kursor melewati titik tengah (*midpoint*) dari kartu target, mencegah jumping / flickering.
- **Multi-Selection Unified Block Drag:** Jika pengguna memilih 2 atau lebih layer (via Shift/Cmd click), semua layer terpilih akan bergerak bersama sebagai satu blok saat di-drag ke posisi z-index baru.
- **Single History Transaction:** Operasi reordering z-index direkam sebagai 1 entri undo/redo.

## Verification Criteria
- [ ] Tab "Layers" muncul di Inspector kanan dan menampilkan semua elemen spread aktif.
- [ ] Reorder layer dengan drag-and-drop mengubah urutan z-index di kanvas secara real-time.
- [ ] Multi-select card reordering memindahkan sekelompok layer sekaligus.
- [ ] Toggle hide/show dan lock/unlock berfungsi instan.
- [ ] Undo mengembalikan susunan layer ke kondisi sebelumnya.
