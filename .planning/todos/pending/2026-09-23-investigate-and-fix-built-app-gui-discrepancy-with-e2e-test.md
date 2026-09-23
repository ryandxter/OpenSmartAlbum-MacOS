---
created: 2026-09-23T08:00:29Z
title: Investigate and Fix Built App GUI Discrepancy with E2E Test
area: ui
severity: blocker
files:
  - src/features/workspace/WorkspaceLayout.tsx
  - src/features/carousel/CarouselCanvas.tsx
  - src/features/editor/KonvaEditorCanvas.tsx
  - src/features/photos/FilmstripTray.tsx
  - src/features/templates/TemplatesPanel.tsx
  - src-tauri/tauri.conf.json
---

## Problem

Meskipun pengujian backend dan domain script E2E (`scripts/verify_e2e_layouting.ts` dan `src-tauri/tests/e2e_live_export.rs`) berhasil memvalidasi algoritma partisi layout dan sukses mengekspor file JPEG 300 DPI & Carousel slices ke `/Users/chiio/Downloads/album test app`, pengguna melaporkan bahwa saat menjalankan aplikasi built `.app` secara nyata di macOS (`/Applications/OpenSmartAlbum.app`), perilakunya tidak sesuai dan tidak berfungsi seperti hasil pengujian tersebut.

Ada disparitas fungsionalitas (discrepancy) antara pengujian headless/node/rust backend dengan runtime WebKit WKWebView pada built macOS application, terutama terkait:
1. Interaksi drag-and-drop foto dari Filmstrip dan Finder ke dalam kanvas (Print Album dan Social Carousel).
2. Perilaku kanvas saat interaksi manual, zoom, pan, dan pemilihan frame.
3. Fungsi randomize dan reshuffle layout di panel template / inspector pada antarmuka pengguna interaktif.

## Solution

1. Lakukan investigasi forensik langsung pada environment built `.app` di macOS (WKWebView runtime).
2. Periksa apakah ada unhandled exception, WebKit security/pasteboard restriction, atau event trapping Konva di WKWebView yang menghambat drag-drop dan layouting.
3. Pastikan koordinat drop dari Tauri 2 (`onDragDropEvent`) terkonversi dengan presisi terhadap Retina display scaling (`window.devicePixelRatio`).
4. Uji interaksi secara end-to-end langsung pada UI GUI: impor foto dari Finder, penempatan dari Filmstrip, klik variasi template, reshuffle, serta ekspor melalui dialog modal.
5. Terapkan perbaikan pada layer UI/Tauri WebKit wrapper, rebuild `.dmg` dan `.app`, lalu verifikasi langsung.
