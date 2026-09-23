---
id: todo-2026-09-23-fix-filmstrip-reuse-layout-shuffle-stretching
title: Fix Filmstrip Photo Reuse, Layout Shuffle Failure, and Image Stretching Distortion
created_at: 2026-09-23T08:02:00+07:00
area: ui
severity: blocker
status: pending
source: user_report
screenshots:
  - /Users/chiio/Desktop/Screenshot 2026-09-23 at 05.51.24.png
  - /Users/chiio/Desktop/Screenshot 2026-09-23 at 05.51.38.png
files:
  - src/features/workspace/WorkspaceLayout.tsx
  - src/features/carousel/CarouselCanvas.tsx
  - src/features/editor/KonvaEditorCanvas.tsx
  - src/features/photos/FilmstripTray.tsx
  - src/features/inspector/InspectorContainer.tsx
  - src/features/inspector/sections/LayoutSpacingSection.tsx
  - src/stores/carouselStore.ts
  - src/stores/editorStore.ts
---

# Issue: Filmstrip Photo Reuse, Layout Shuffle Failure, and Image Stretching Distortion

## 1. Context & User Evidence
Berdasarkan screenshot dari user pada aplikasi `.app`:
1. `/Users/chiio/Desktop/Screenshot 2026-09-23 at 05.51.24.png`:
   - Pengguna men-drag foto dari Filmstrip Tray untuk digunakan kembali (reuse) pada slide/spread.
   - Muncul toast error merah/gelap: `No supported image files or folders detected in drop`.
   - Ini menandakan Tauri 2 native `onDragDropEvent` listener pada `WorkspaceLayout.tsx` salah mencegat drag internal HTML5 dari FilmstripTray (yang tidak membawa filesystem paths native Finder) dan mengeksekusi error fallback.
2. `/Users/chiio/Desktop/Screenshot 2026-09-23 at 05.51.38.png`:
   - Foto Landscape (`RVMR9845.JPG`) ditaruh ke slide carousel 4:5 (`1080 x 1350 px`), namun gambar foto mengalami **stretching** (terdistorsi parah, gepeng horizontal/vertikal tanpa mempertahankan rasio aspek asli foto).
   - Panel Inspector kanan di mode `Social Carousel` menampilkan kontrol milik Print Album (`Spread Dimensions 2160 x 1350 px`, `Spread Photo Spacing`, `Safe Margins Spine/Inside`), padahal harusnya menampilkan konteks slide Carousel.
   - Shuffle layout tidak merespons atau membuat susunan foto makin terdistorsi saat di-trigger.

## 2. Root Causes Identified
1. **Tauri Native Drag vs HTML5 Internal Drag Collision**:
   - `onDragDropEvent` dari Tauri terpicu pada drag drop events di window. Ketika drop terjadi dengan payload internal React (dragged photo ID dari Filmstrip) tanpa file native OS, Tauri event mendeteksi `paths` kosong dan menampilkan toast `"No supported image files or folders detected in drop"`.
   - Drop handler native harus memverifikasi apakah drop benar-benar berasal dari Finder OS (`paths.length > 0`) sebelum menampilkan toast error, dan tidak mengganggu event HTML5 drag-and-drop bawaan web.
2. **Carousel & Album Frame Aspect Distortion (Stretching)**:
   - Pada `CarouselCanvas.tsx` (dan komponen rendering Konva terkait), saat foto ditambahkan melalui drag drop atau double click:
     - Dimensi frame foto diatur tanpa menyesuaikan aspect ratio asli dari foto (`naturalWidth / naturalHeight`).
     - Atau Konva Image rendering merender foto langsung memenuhi lebar dan tinggi frame (`width`, `height`) tanpa proporsional aspect-fill cover (`cropX, cropY, cropWidth, cropHeight`), sehingga foto terentang/terdistorsi (stretch) mengikuti dimensi frame.
3. **Inspector Layout & Spacing Mode Mismatch**:
   - `InspectorContainer.tsx` dan `LayoutSpacingSection.tsx` tidak menyembunyikan pengaturan Spread Margins/Dimensions ketika berada di mode Social Carousel, atau tidak mengarahkan tab layout ke pengaturan Carousel.
4. **Layout Shuffle Failure**:
   - Pada Carousel Mode, shuffle layout atau penataan ulang foto tidak meng-update posisi/dimensi frame dengan aspect-ratio yang aman, atau handler shuffle di `carouselStore` tidak sinkron dengan slide aktif.

## 3. Action Plan
1. **Perbaiki Tauri Native Drag-Drop**:
   - Jangan munculkan toast error jika event drop berasal dari internal drag atau jika `paths` kosong tanpa ada drop Finder yang valid.
2. **Kunci Aspect Ratio Preservation (Zero Stretch)**:
   - Pastikan setiap rendering foto di `CarouselCanvas.tsx` dan `KonvaEditorCanvas.tsx` menggunakan algoritma aspect-cover / aspect-fit murni, sehingga tidak ada foto yang terdistorsi/terentang apapun ukuran bingkai atau variasinya.
   - Saat foto di-drop, inisialisasi dimensi frame dengan rasio aspek asli foto atau pertahankan `cover` cropping yang benar.
3. **Perbaiki Inspector Context untuk Social Carousel**:
   - Di mode Carousel, tampilkan kontrol Carousel yang relevan (Slide spacing, padding, ratio presets) dan sembunyikan spread margins print album.
4. **Perbaiki Layout Shuffling di Carousel & Album**:
   - Pastikan shuffle layout menukar frame dan foto dengan mempertahankan rasio aspek tanpa distorsi visual.
5. **Verifikasi E2E & Rebuild .app/.dmg**:
   - Jalankan automated tests, verifikasi visual, dan rebuild binary macOS.
