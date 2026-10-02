# Phase 22 Context: Sub-Pixel Hairline Border Scaling Parity

## Phase Goal
Ensure exact sub-pixel border rendering and proportional scaling fidelity for ultra-thin borders (0.02 - 0.1 mm/pt) across Editor Canvas, Page Navigator thumbnails, and Native Print/Export Preview.

## User Decisions & Locked Scope

### 1. Removal of Artificial Pixel Floor
- **Export Preview Scaling:** Menghapus clamp `Math.max(2, borderPx)` atau minimum 2-device-pixel di [ExportSpreadPreview.tsx](file:///Users/chiio/VSCode/albumaker/src/features/export/ExportSpreadPreview.tsx) dan [PageNavigator.tsx](file:///Users/chiio/VSCode/albumaker/src/features/album/PageNavigator.tsx).
- **Proportional Geometry:** Nilai border tipis (seperti 0.05 mm pada foto album) diskalakan secara proporsional sesuai rasio zoom viewport, sehingga terlihat presisi setipis rambut (*hairline*) tanpa menebal secara artifisial.

### 2. High-DPI & Native Export Alignment
- **Native PDF/TIFF/JPEG Export Parity:** Output resolusi tinggi (300 DPI) di backend Rust ([export_engine](file:///Users/chiio/VSCode/albumaker/src-tauri/src/export_engine/mod.rs)) menggunakan rumus kalkulasi titik fisik yang identik dengan visual preview frontend.

## Verification Criteria
- [ ] Border foto 0.05 mm tampil halus dan proporsional di canvas editor.
- [ ] Export Preview menampilkan hairline border tanpa distorsi tebal.
- [ ] Ekspor cetak 300 DPI mempertahankan ketebalan border asli dari project.
