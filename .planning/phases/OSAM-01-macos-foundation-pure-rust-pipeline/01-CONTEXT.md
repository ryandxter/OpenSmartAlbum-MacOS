# Phase 1: macOS Foundation & Pure Rust Pipeline — Context

## Implementation Decisions

### 1. Win32 Purge & Cross-Platform System Bridges
- **Memory Management**: Replace Win32 `EmptyWorkingSet` with automatic Darwin memory management; memory cycle handled natively by the OS allocator. Application-level LRU texture cache maintains bounds without forcing system page trimming.
- **Color Dropper**: Replace Win32 GDI pixel sampling with modern Web Native EyeDropper API in the webview, ensuring zero-dependency, smooth color picking on macOS.
- **System Fonts**: Replace Windows Registry font scanner with cross-platform font enumeration using `fontdue` and macOS standard font paths (`/System/Library/Fonts`, `/Library/Fonts`).

### 2. Pure Rust Pipeline & Zero C-Dylib Coupling
- Remove all references, documentation, and build scripts assuming `libvips` C dynamic library.
- Consolidate on pure-Rust image decoding and rasterization crates:
  - `image 0.25` (JPEG, PNG, WebP, BMP, TIFF)
  - `rayon 1.10` (multi-threaded tile processing)
  - `kamadak-exif 0.6` (EXIF orientation and metadata)
  - `fontdue 0.9` (pure-Rust TrueType/OpenType rasterizer)
- Guarantees 100% stable compilation and packaging without dynamic library loading errors on Apple Silicon and Intel macOS.

### 3. macOS Target & Tauri 2 Configuration
- Target minimum macOS: **macOS 13 (Ventura) and above**.
- Target architectures: Universal binary (`aarch64-apple-darwin` Apple Silicon M-series & `x86_64-apple-darwin` Intel).
- Bundle identifier: `com.opensmartalbum.app`.
- Packaging output: `.app` bundle and `.dmg` installer.

---
*Created: 2026-09-22 via /gsd-discuss-phase*
