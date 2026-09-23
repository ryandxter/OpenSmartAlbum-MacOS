---
created: 2026-09-23T09:20:00Z
title: Explore and Architect Unlimited Layout Engine ala Pixellu SmartAlbums and Fundy Designer
area: layout
severity: blocker
files:
  - src/domain/carouselLayout.ts
  - src/domain/adaptiveLayout.ts
  - src/stores/carouselStore.ts
  - src/stores/albumStore.ts
  - src/features/templates/TemplatesPanel.tsx
  - src/features/carousel/CarouselCanvas.tsx
  - src/features/editor/KonvaEditorCanvas.tsx
screenshots:
  - /Users/chiio/Desktop/Screenshot 2026-09-23 at 09.12.43.png
  - /Users/chiio/Desktop/Screenshot 2026-09-23 at 09.13.32.png
  - /Users/chiio/Desktop/Screenshot 2026-09-23 at 09.13.47.png
---

## Problem

Kapabilitas layouting saat ini sangat terbatas, kaku, dan mengalami kecacatan fatal pada mode Social Carousel serta Print Album:
1. **Destructive Layout Switching & Blank Frames Bug**:
   - Ketika pengguna memiliki N foto (misal 7 foto seperti di Screenshot 09.12.43) dan memilih preset atau mengklik "Next Layout", layout saat ini menggunakan preset statis kaku (`CAROUSEL_LAYOUT_PRESETS`).
   - Jika beralih ke preset 1 foto, 6 foto lainnya langsung terbuang/hilang dari slide.
   - Jika kemudian beralih ke preset 2 foto, karena foto di slide tinggal 1, slot foto kedua dibuat dengan payload `undefined` (`filePath: ''`), menyebabkan kotak abu-abu/hitam blank tanpa gambar (Screenshot 09.13.32).
   - Hanya 1 gambar yang bisa berubah/tampil, sementara sisa foto pengguna lenyap atau blank.
2. **Keterbatasan Variasi Statis vs Dynamic Unlimited Possibilities**:
   - Carousel hanya memiliki 12 template hardcoded kaku (1-4 foto dan 4 panorama). Jika pengguna memasukkan 5, 6, 7, atau 8 foto, sistem tidak memiliki algoritma generatif dinamis untuk menata N foto secara estetis dan proporsional.
   - Sangat jauh tertinggal dari workflow standar industri fotografi profesional seperti **Pixellu SmartAlbums**, **Fundy Designer**, dan **AlbumStomp / Marqueteer**.

## Analisis Workflow Industri (Pixellu SmartAlbums & Fundy Designer)

1. **Non-Destructive Photo Pool & Dynamic Aspect-Driven Generation**:
   - Di Pixellu SmartAlbums & Fundy, ketika pengguna menempatkan sejumlah foto (1 sampai 15+ foto) di spread atau slide, algoritma generatif secara instan mensintesis puluhan hingga ratusan variasi tata letak (Recursive Partitioning, Golden Ratio Cuts, Editorial Asymmetry, Hero + Grid, Masonry) yang **secara eksak menampung seluruh foto tanpa pernah membuang satu foto pun atau menyisakan frame kosong**.
   - Menekan tombol `Next Layout` (atau tombol Space bar) memutar layout generatif tanpa merusak koleksi foto di slide/spread.
2. **Multi-Slide / Multi-Spread Auto-Flow (Storytelling Engine)**:
   - Jika pengguna men-drop foto dalam jumlah banyak (misal 10 - 30 foto dari Filmstrip), sistem menawarkan atau secara otomatis mengalirkan (auto-flow) foto ke slide/spread berurutan dengan ritme visual yang harmonis (misal kombinasi Hero, 2-photo split, 4-photo grid, dan seamless panorama).
3. **Adaptive Spacing, Dynamic Gaps, and In-Canvas Resizing**:
   - Pengguna dapat menyesuaikan padding, margin, dan gap antar foto secara interaktif dan real-time tanpa merusak rasio aspek gambar (selalu aspect-cover fit).
4. **Seamless Panorama Slicing across Carousels & Spreads**:
   - Foto lanskap lebar secara cerdas dapat dipotong membentang 2 atau 3 slide/halaman secara presisi tanpa merusak slide lainnya.

## Next Actions

1. Lakukan `/gsd-explore` mendalam terhadap arsitektur algoritma layouting generatif Pixellu SmartAlbums & Fundy Designer (Aspect-Ratio Aware Recursive Binary Partitioning, Treemap Mosaic, dan Non-Destructive Photo Slots).
2. Rancang Milestone Baru (`/gsd-new-milestone`) untuk **Next-Gen Studio Layouting Engine** (Milestone v1.2.0) yang mengimplementasikan sistem tata letak tanpa batas (*unlimited possibilities*) untuk Print Album dan Social Carousel.
