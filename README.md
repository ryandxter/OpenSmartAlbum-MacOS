# OpenSmartAlbum — macOS

[![Release](https://img.shields.io/badge/Release-v1.0.77-blue.svg?style=flat-square)](https://github.com/ryandxter/OpenSmartAlbum-MacOS/releases)
[![Platform](https://img.shields.io/badge/Platform-macOS%2013%2B%20(Apple%20Silicon)-000000.svg?style=flat-square&logo=apple)](https://github.com/ryandxter/OpenSmartAlbum-MacOS/releases)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131.svg?style=flat-square&logo=tauri)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-Pure%20Engine-DEA584.svg?style=flat-square&logo=rust)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg?style=flat-square&logo=react)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-Proprietary-gray.svg?style=flat-square)](https://github.com/ryandxter/OpenSmartAlbum-MacOS)

> **Professional offline photo album layout software — now native on macOS.**  
> Originally built for wedding photographers and print studios. This fork brings the full experience to Apple Silicon and Intel Macs.

---

## Background

AFSNSmartAlbum was created by [Asrofims / Afsunmedia](https://github.com/asrofims) as a Windows-native professional album design tool. The original codebase is a genuinely solid piece of work — tight Rust image engine, real magnetic snapping math, proper spread geometry. I picked it up because my studio runs on Macs and I got tired of running it through a VM.

This repo is the macOS port. The core architecture is unchanged — same Tauri 2 + Rust image engine, same Konva canvas, same SQLite project format. What changed is everything platform-specific: Win32 FFI removed, macOS entitlements wired up properly, overlay titlebar, native ⌘ shortcuts, proper DMG packaging. Also added the Instagram Carousel export mode since that came up constantly in our own workflow.

---

## What's different from the original

- **No Windows dependencies** — Win32 `EmptyWorkingSet`, GDI color sampling, and Registry font enumeration are all gone. Pure Rust everywhere.
- **macOS overlay titlebar** — traffic light buttons sit properly in the chrome, window is draggable by the title area
- **Native shortcuts** — `⌘C / ⌘V / ⌘Z` instead of Ctrl
- **Instagram Carousel mode** — create multi-slide social media layouts (1:1, 4:5, 9:16) from the New Project dialog, export as individual slices
- **DMG installer** — standard macOS `.dmg` distribution, no NSIS Windows installer cruft
- **Layered PSD export** — export spreads as proper multi-layer Photoshop files with per-photo channel masks

---

## Features

### Smart Layout Engine
Drop 1–12 photos onto a spread and the engine generates mathematically valid layout variations that respect each photo's native aspect ratio. It's not template matching — it's actual 2D bin packing with aspect-ratio scoring. Layouts rank themselves by how little they crop each photo.

### Magnetic Snapping
Sub-millimeter snapping to spread spine, safe margin boundaries, bleed edges, and inter-frame equal-spacing guides. The HUD indicators update live as you drag.

### Multi-Frame Resize Without Gap Distortion
Resize a selection of frames and the spacing between them stays exact. Uses a 2D spatial neighbor graph to figure out which frames share edges and adjusts them proportionally. Most software just scales positions and gaps blow out.

### Dual Reset Controls
- **↺ Reset Ratio** — snaps the frame back to the photo's native aspect ratio (3:2, 4:3, etc.) without touching your crop pan or zoom
- **↺ Reset Crop** — re-centers the photo inside the frame and resets to 1.0× zoom, keeps the frame geometry

### Export Suite
- High-res JPEG / lossless PNG / lossless TIFF at project DPI (up to 1200 DPI)
- Print-ready PDF/X with trim marks, bleed box, and slug
- Layered PSD with discrete photo layers and vector channel masks for all 8 shape presets
- Instagram Carousel — numbered slides + full panorama JPEG

---

## System Requirements

| | Minimum | Recommended |
| :--- | :--- | :--- |
| **macOS** | 13.0 Ventura | 14.0 Sonoma or 15.0 Sequoia |
| **Chip** | Apple M1 | M2 / M3 or Intel Core i7 (2020+) |
| **RAM** | 8 GB | 16 GB for large RAW libraries |
| **Storage** | 300 MB free | SSD, 1 GB+ for project caching |
| **Display** | 1440 × 900 | Retina / HiDPI (2560 × 1664 or higher) |

---

## Keyboard Shortcuts (macOS)

### Canvas

| Shortcut | Action |
| :--- | :--- |
| `Space` + Drag | Pan canvas |
| `⌘` + Scroll | Zoom in / out |
| `⌘ 0` | Fit spread to window |
| `←` / `→` | Previous / next spread |
| Pinch gesture | Continuous zoom (trackpad) |

### Frames

| Shortcut | Action |
| :--- | :--- |
| `Click` | Select frame |
| `⇧ Click` | Add to selection |
| `⌘ A` | Select all |
| `⇧` + Drag | Constrain drag to axis |
| Arrow keys | Nudge 1 mm |
| `⇧` + Arrow | Nudge 10 mm |
| `⌘ C` / `⌘ V` | Copy / paste |
| `⌘ ⇧ V` | Paste in place |
| `⌘ ⌥ V` | Paste to all spreads |
| `⌘ D` | Duplicate |
| `⌫` | Delete |
| `⌘ L` | Lock |
| `⌥ L` | Unlock |
| `⌘ G` / `⌘ ⇧ G` | Group / ungroup |
| `R` / `⇧ R` | Rotate 90° CW / CCW |
| `S` | Swap two selected photos |
| `T` | Add text box |

### Crop Mode (double-click a frame to enter)

| Action | Description |
| :--- | :--- |
| Drag | Pan photo inside frame |
| Scroll | Zoom crop |
| `↺ Reset Ratio` | Restore frame to photo's native aspect ratio |
| `↺ Reset Crop` | Re-center and reset zoom to 1× |
| `Enter` / `Esc` | Exit crop mode |

---

## Tech Stack

- **Tauri 2** — Rust-based desktop shell, no Electron
- **React 18 + TypeScript** — frontend, Vite build
- **Konva.js** — hardware-accelerated canvas rendering
- **SQLite + Rusqlite** — project database, embedded in `.afsn` archive
- **Zustand** — frontend state
- **Rust `image` + `rayon`** — pure Rust image decode, sharpening, and export (no libvips dependency)

---

## Building from Source

```bash
# Prerequisites: Node 20+, Rust 1.77+, Xcode CLT
npm install
npm run tauri build -- --target aarch64-apple-darwin
# DMG output: src-tauri/target/release/bundle/dmg/
```

For development:

```bash
npm run tauri dev
```

---

## Credits

Original author: **[Asrofims](https://github.com/asrofims)** / Afsunmedia  
The core application — album domain model, layout engine, Rust image pipeline, export system — is his work. This macOS port exists because the original is genuinely good enough to be worth the effort.

macOS port and feature additions: **[chiio](https://github.com/ryandxter)**  
— Win32 removal and macOS platform wiring  
— Overlay titlebar + macOS native shortcut layer  
— Instagram Carousel mode (domain model, Zustand store, export pipeline)  
— Layered PSD serializer + PDF/X print marks  
— DMG packaging and macOS bundle configuration  

---

## Open Source Foundations

- [Tauri](https://tauri.app/) (MIT / Apache-2.0)
- [React](https://reactjs.org/) (MIT)
- [Konva](https://konvajs.org/) (MIT)
- [SQLite](https://www.sqlite.org/) (Public Domain)
- [Rayon](https://github.com/rayon-rs/rayon) (MIT / Apache-2.0)
- [image crate](https://github.com/image-rs/image) (MIT)

---

Copyright © 2026 Afsunmedia / Asrofims (original) · macOS port by chiio
