---
created: 2026-10-02T08:30:05.773Z
title: Integrasi YuNet Face Detection & AI Framing Rules
area: ai
severity: minor
files:
  - src-tauri/src/export_engine/mod.rs
  - src/domain/adaptiveLayout.ts
  - src/features/editor/KonvaEditorCanvas.tsx
---

## Problem

Saat ini penempatan dan pemotongan foto dalam frame layout album maupun social carousel masih mengandalkan focal center standar atau penyesuaian manual (pan/zoom crop). Pada foto portrait / wisuda / pasfoto formal (seperti referensi sistem Reflection Studio / UNY), diperlukan penentuan komposisi otomatis (*smart auto-framing*) seperti batas atas kepala (*headroom*), aturan framing pundak (misal: ketat 50% pundak), deteksi mata/wajah, serta pencegahan pemotongan wajah penting saat foto dimasukkan ke dalam variasi layout.

## Solution

Mengintegrasikan model deteksi wajah ringan **YuNet** (ONNX format / `libfacedetection`) via Tauri Rust backend:
1. **On-Device Face & Landmark Detection:** Menjalankan YuNet ONNX runtime (via `ort` atau `tract` di Rust) untuk mendeteksi bounding box wajah dan 5 landmark titik utama (mata kiri/kanan, hidung, sudut mulut) secara lokal tanpa koneksi internet (<10ms/foto).
2. **AI Smart Framing & Focal Centering:** Menghitung bounding box ideal berdasarkan aturan framing (misal: 50% pundak, 10% headroom, eye-level rule) untuk auto-crop / auto-pan di [adaptiveLayout.ts](file:///Users/chiio/VSCode/albumaker/src/domain/adaptiveLayout.ts) dan [KonvaEditorCanvas.tsx](file:///Users/chiio/VSCode/albumaker/src/features/editor/KonvaEditorCanvas.tsx).
3. **Preset Framing Rules:** Mendukung konfigurasi preset formal portrait (seperti pasfoto, wisuda institusi, wedding hero shot).
