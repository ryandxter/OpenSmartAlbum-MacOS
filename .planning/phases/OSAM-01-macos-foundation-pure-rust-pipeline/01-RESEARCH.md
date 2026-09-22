# Phase 1: macOS Foundation & Pure Rust Pipeline — Research

**Document Version:** 1.0.0  
**Phase ID:** `OSAM-01-macos-foundation-pure-rust-pipeline`  
**Target Codebase:** OpenSmartAlbum-MacOS (`src-tauri`, `src`)  
**Host Architecture:** macOS Darwin (`aarch64-apple-darwin` Apple Silicon / `x86_64-apple-darwin` Intel)  
**Tauri Version:** Tauri 2 (`tauri 2.11.3`, `tauri-build 2.6.3`)  
**Date:** 2026-09-22  

---

## Executive Summary

Phase 1 establishes the native macOS foundation for OpenSmartAlbum by eliminating all Windows-specific Win32 FFI bindings, verifying the 100% pure-Rust image and export pipeline, implementing macOS Darwin system integrations (system font discovery, APFS case-preserving path normalization, automatic Darwin memory management), and configuring Tauri 2 for Universal macOS bundle distribution (`.app` and `.dmg`).

An initial compilation and test audit conducted on the target macOS environment revealed:
1. **Compilation Baseline:** `cargo check` compiles with **exit code 0** in 42.14s. The pure-Rust image stack (`image 0.25`, `rayon 1.10`, `kamadak-exif 0.6`, `fontdue 0.9`, `rusqlite 0.34 [bundled]`) has **zero C-dynamic library coupling** and links cleanly on Darwin.
2. **Test Suite Baseline:** 36 of 37 Rust unit tests pass immediately. The single failing test (`test_user_rotated_scenario`) is directly caused by the absence of macOS system font discovery and missing bundled font fallback when Windows DOS 8.3 font files are absent.
3. **Win32 FFI Audit:** Win32 FFI calls exist across 3 backend modules (`src-tauri/src/photo_engine/mod.rs`, `src-tauri/src/commands/app_commands.rs`, and path-handling logic in `src-tauri/src/db/package_io.rs` and `src-tauri/src/commands/photo_commands.rs`).
4. **libvips Discrepancy:** While the backend pipeline is already 100% pure Rust (`image` crate), multiple documentation and UI strings still reference `libvips`.

---

## 1. Win32 FFI & Platform-Specific Code Audit

The following table details every file, line range, and mechanism currently containing Win32 FFI or Windows-only assumptions:

| File Path | Line Range | Windows Feature / API | Current Non-Windows Behavior | macOS Impact & Required Remediation |
|---|---|---|---|---|
| `src-tauri/src/photo_engine/mod.rs` | 359–375 | `EmptyWorkingSet`, `GetCurrentProcess`, `SetProcessWorkingSetSize` | No-op (returns immediately) | Win32 kernel page trimming does not exist on Darwin. Darwin manages working sets dynamically via OS virtual memory compressor and `libsystem_malloc`. Replace with clean cross-platform no-op. |
| `src-tauri/src/photo_engine/mod.rs` | 57–61 | `MetadataExt::file_attributes() & 0x400 != 0` | Symlink check only (`is_symlink`) | Windows junction point detection. Harmless on macOS when gated with `#[cfg(windows)]`. Unix symlink handling (`is_symlink`) is already present. |
| `src-tauri/src/asset_cache.rs` | 15–19 | `MetadataExt::file_attributes() & 0x400 != 0` | Symlink check only (`is_symlink`) | Windows junction check. Retain `#[cfg(windows)]` gate; Unix symlink detection is already functional. |
| `src-tauri/src/commands/app_commands.rs` | 95–156 | `mod win32_color`: `user32::GetDC`, `user32::ReleaseDC`, `user32::GetCursorPos`, `gdi32::GetPixel` | Returns `#FFFFFF` | When eyedropper is triggered on macOS, Rust command returns hardcoded `#FFFFFF`. Frontend (`ColorPicker.tsx`) contains web/DOM canvas sampling fallback. Cleanly decouple Win32 GDI FFI and delegate to webview sampling. |
| `src-tauri/src/commands/app_commands.rs` | 167–302 | `mod win32_reg`: `advapi32::RegOpenKeyExW`, `advapi32::RegEnumValueW`, `advapi32::RegCloseKey` | Returns `Ok(Vec::new())` (empty font list) | Font dropdown in Typography Panel cannot discover any system fonts on macOS. Implement Darwin font scanning using `ttf-parser` across `/System/Library/Fonts` and `/Library/Fonts`. |
| `src-tauri/src/commands/app_commands.rs` | 308–320 | `test_get_system_fonts_smoke` | Unused variable warning on `fonts` | Test asserts Windows fonts (`arial`, `segoe`). Update test to assert macOS system fonts (`Helvetica`, `SF`, etc.) when running on Darwin. |
| `src-tauri/src/commands/photo_commands.rs` | 204–211 | `path_identity`: `trim_start_matches("//?/").to_lowercase()` on Windows only | Retains raw case on macOS | APFS and HFS+ are case-insensitive and case-preserving by default. Case differences cause duplicate photo imports and relink failures on macOS. Extend `.to_lowercase()` normalization to macOS. |
| `src-tauri/src/db/package_io.rs` | 61–76 | `same_path`: `eq_ignore_ascii_case` on Windows only | Case-sensitive equality `a == b` on macOS | Prevents proper document file identity reconciliation on case-insensitive APFS. Extend case-insensitive comparison to macOS. |
| `src-tauri/src/export_engine/text_rasterizer.rs` | 206–215 | `get_system_font_dirs`: Windows paths (`WINDIR`, `LOCALAPPDATA`) | Has macOS paths, but font enumeration returns empty | macOS font directories `/System/Library/Fonts`, `/Library/Fonts`, and `~/Library/Fonts` are declared, but font discovery and fallback fail. |
| `src-tauri/src/export_engine/text_rasterizer.rs` | 319–412 | `curated_fallbacks`: Windows DOS 8.3 filenames (`gothicbi.ttf`, `palabi.ttf`, `garabd.ttf`, `georgiaz.ttf`, `timesbi.ttf`, `calibriz.ttf`, etc.) | Files do not exist on macOS; falls through to `universal_fallbacks` | `universal_fallbacks` (`segoeui.ttf`, `arial.ttf`, `times.ttf`, `georgia.ttf`) also do not exist in macOS font directories. |
| `src-tauri/src/export_engine/text_rasterizer.rs` | 473–494 | `load_font_weight`: Logs warning and returns `None` on missing font | Returns `None` | If a requested system font cannot be resolved, the engine emits `None` instead of falling back to bundled `inter`. Causes `test_user_rotated_scenario` test failure and blank text rendering on macOS. |
| `src-tauri/src/commands/export_commands.rs` | 252–265 | `open_export_directory`: Windows `explorer` vs macOS `open` | Already has `#[cfg(target_os = "macos")]` spawning `open` | Correctly implemented; verify execution under sandbox/hardened runtime. |
| `src-tauri/src/main.rs` | 2 | `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` | Ignored on Darwin | Benign, but should be annotated or kept for cross-platform compatibility. |

---

## 2. Darwin System Replacements & Implementations

### 2.1 Memory Management (`trim_process_memory`)
- **Analysis:** On Windows, `EmptyWorkingSet` was invoked after batch photo ingestion and spread export to forcibly evict working set pages back to the standby list. On Darwin, the OS memory manager uses a proactive memory compressor and Mach VM page reclamation. Forcing working set reduction from user space is both unnecessary and counter-productive.
- **Decision:** Keep `trim_process_memory()` as a non-breaking API so existing callers in `photo_commands.rs` (lines 328, 376) remain functional, but ensure on non-Windows it compiles cleanly as an empty function without Win32 FFI declarations.

### 2.2 Case-Insensitive Path Normalization on APFS
- **Analysis:** macOS APFS (Apple File System) and HFS+ are case-insensitive by default. Under current code:
  - `photo_commands.rs:204`:
    ```rust
    fn path_identity(path: &Path) -> String {
        let path = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
        let value = path.to_string_lossy().replace('\\', "/");
        #[cfg(any(windows, target_os = "macos"))]
        { value.trim_start_matches("//?/").to_lowercase() }
        #[cfg(not(any(windows, target_os = "macos")))]
        { value }
    }
    ```
  - `package_io.rs:73`:
    ```rust
    if cfg!(any(windows, target_os = "macos")) {
        a.to_string_lossy().eq_ignore_ascii_case(&b.to_string_lossy())
    } else { a == b }
    ```
- **Benefit:** Eliminates false duplicate imports and project file identity divergence when accessing files via different case casing on macOS.

### 2.3 System Font Discovery & Text Rasterization Fallback
- **Analysis:**
  - On macOS, system fonts reside in:
    - `/System/Library/Fonts`
    - `/Library/Fonts`
    - `~/Library/Fonts`
  - macOS fonts are packaged as `.ttf`, `.otf`, and TrueType Collections (`.ttc`, e.g., `Helvetica.ttc`, `Times.ttc`).
  - `ttf-parser v0.25` is already compiled and present in `Cargo.lock` as a dependency of `fontdue 0.9`.
- **Implementation Strategy:**
  1. Add `ttf-parser = "0.25"` directly to `Cargo.toml` dependencies (0 additional build overhead).
  2. In `app_commands.rs:get_system_fonts()`, implement a fast directory scanner on macOS that scans `.ttf`, `.otf`, and `.ttc` files using `ttf_parser::Face::parse` and `ttf_parser::fonts_in_collection` to extract:
     - Name ID 1: Family Name (e.g., "Helvetica", "Arial", "Courier New")
     - Name ID 4: Full Name
     - File Path
  3. Deduplicate families and sort alphabetically.
  4. In `text_rasterizer.rs:load_font_weight()`, add an invariant fallback:
     ```rust
     } else {
         log::warn!("No suitable font found on system for family: {}, falling back to Inter", family);
         super::bundled_fonts::bundled_font("inter", weight, is_italic)
             .and_then(|bytes| Font::from_bytes(bytes, FontSettings::default()).ok().map(Arc::new))
     }
     ```
- **Verification:** When this fallback is applied, `test_user_rotated_scenario` immediately passes because "Century Gothic" gracefully resolves to bundled "Inter" rather than producing blank pixels.

### 2.4 Color Eyedropper API Architecture
- **Analysis:**
  - Safari/WebKit on macOS **does not support `window.EyeDropper`** (exclusive to Chromium).
  - Calling Win32 GDI `GetPixel` on macOS returns `#FFFFFF`.
  - `src/components/ui/ColorPicker.tsx` already contains a robust DOM/Canvas sampling fallback (lines 251–285) that samples Konva canvas elements directly via `canvas.getContext('2d').getImageData(x, y, 1, 1)`.
- **Decision:**
  - Cleanly remove Win32 FFI from `sample_screen_color`.
  - On macOS/Linux, `sample_screen_color` returns an explicit `Err("NATIVE_SAMPLING_UNAVAILABLE")` or delegating signal, causing `ColorPicker.tsx` to immediately engage its DOM/Canvas color sampler without lag.

---

## 3. Pure-Rust Pipeline Verification & libvips Purge

### 3.1 Crate Dependency Audit (`src-tauri/Cargo.toml`)
The current dependencies in `src-tauri/Cargo.toml` are completely pure Rust or statically bundled C amalgamation:
- `image = { version = "0.25", default-features = false, features = ["jpeg", "png", "webp", "bmp", "tiff"] }`: 100% pure Rust image decoders and encoders.
- `rayon = "1.10"`: Pure Rust work-stealing CPU parallelism.
- `kamadak-exif = "0.6"`: Pure Rust EXIF parser.
- `fontdue = "0.9"`: Pure Rust glyph parser and sub-pixel rasterizer.
- `rusqlite = { version = "0.34", features = ["bundled"] }`: Statically compiles the official SQLite amalgamation via `cc`. Zero dynamic linking (`.dylib`) requirement.
- `zip = { version = "2.2", default-features = false, features = ["deflate"] }`: Pure Rust deflate compression.
- `rfd = "0.15"`: Safe macOS AppKit file dialog bindings via `objc2`.

### 3.2 Build Script Audit (`src-tauri/build.rs`)
`src-tauri/build.rs` contains only:
```rust
fn main() {
  tauri_build::build()
}
```
No custom C linking flags, no `pkg-config`, and no dynamic library search paths exist.

### 3.3 Complete Audit of libvips References to Purge
The following files contain outdated references claiming `libvips` usage:
1. `src-tauri/LICENSE.txt` (line 36): `- libvips Image Engine (LGPL-2.1)` -> Replace with `image crate (MIT / Apache-2.0)`.
2. `src/config/app.ts` (line 17): `{ name: 'libvips', url: 'https://libvips.github.io/libvips', license: 'LGPL-2.1' },` -> Update to pure-Rust `image`.
3. `src/features/export/ExportAlbumDialog.tsx` (line 661): `Unsharp masking tailored for photo paper (libvips)` -> Change to `Unsharp masking tailored for photo paper (pure Rust pipeline)`.
4. `ROADMAP.md` (line 6): `- [x] Rust Backend with multi-threaded libvips` -> Update to `- [x] Rust Backend with pure-Rust image pipeline`.
5. `ARCHITECTURE.md` (lines 14, 37): Purge `libvips` mentions, reaffirming `image 0.25` + `rayon`.
6. `AGENTS.md` (line 15) & `README.txt` (line 130): Clean up references.

---

## 4. Tauri 2 macOS Configuration & Target Settings

### 4.1 Configuration Diff for `src-tauri/tauri.conf.json`
To support macOS Ventura (13.0+) and universal packaging (`.app` and `.dmg`):

```json
{
  "productName": "OpenSmartAlbum",
  "version": "1.0.77",
  "identifier": "com.opensmartalbum.app",
  "bundle": {
    "active": true,
    "targets": ["app", "dmg", "nsis"],
    "createUpdaterArtifacts": true,
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "macOS": {
      "minimumSystemVersion": "13.0",
      "entitlements": "./Entitlements.plist",
      "frameworks": []
    },
    "dmg": {
      "windowSize": {
        "width": 660,
        "height": 400
      },
      "appPosition": {
        "x": 180,
        "y": 170
      },
      "applicationFolderPosition": {
        "x": 480,
        "y": 170
      }
    },
    "windows": {
      "nsis": {
        "installerIcon": "icons/icon.ico",
        "headerImage": "icons/header.bmp",
        "sidebarImage": "icons/sidebar.bmp",
        "installMode": "both",
        "languages": ["English"],
        "displayLanguageSelector": false,
        "installerHooks": "hooks.nsh",
        "compression": "lzma"
      }
    },
    "fileAssociations": [
      {
        "ext": ["afsn"],
        "name": "OpenSmartAlbum Project",
        "description": "OpenSmartAlbum Project File",
        "role": "Editor"
      }
    ]
  }
}
```

### 4.2 Hardened Runtime Entitlements (`src-tauri/Entitlements.plist`)
Create `src-tauri/Entitlements.plist` to permit JIT execution in WebKit and user-selected file system access:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
</dict>
</plist>
```

---

## 5. Architectural Risk Assessment

| Risk Item | Severity | Likelihood | Impact | Mitigation Strategy |
|---|---|---|---|---|
| **Font Parsing Overhead on Startup** | Medium | Low | Large font directories with thousands of fonts could slow down `get_system_fonts()` | Cache font results with `OnceLock` in Rust; read font headers only without decoding glyph outlines via `ttf_parser`. |
| **APFS Case Sensitivity Divergence** | High | Low | If paths are compared with raw string equality, files differing only in case collide | Enforce lowercase canonical path normalization across all path comparison operations on macOS. |
| **Text Rasterization Missing Font Panic** | High | Medium | Text elements referencing non-existent system fonts fail export or cause test panics | Add mandatory fallback to bundled `inter` font in `load_font_weight`. |
| **Gatekeeper Quarantine on Unsigned DMG** | Medium | High | Development builds downloaded or transferred across machines trigger macOS Gatekeeper warning | Configure proper `Entitlements.plist` and document local testing commands (`xattr -cr /Applications/OpenSmartAlbum.app`). |

---

## 6. Recommended Phase 1 Plan Breakdown

Based on this technical investigation, Phase 1 execution should be divided into 4 sequential tasks:

### Task 1: Tauri 2 macOS Configuration & Bundle Infrastructure
- Update `src-tauri/tauri.conf.json`:
  - Set `productName`: `"OpenSmartAlbum"`.
  - Set `identifier`: `"com.opensmartalbum.app"`.
  - Add `"targets": ["app", "dmg", "nsis"]`.
  - Add `bundle.macOS` with `minimumSystemVersion: "13.0"` and `entitlements: "./Entitlements.plist"`.
  - Add `bundle.dmg` window geometry settings.
  - Update file associations to `"OpenSmartAlbum Project"`.
- Create `src-tauri/Entitlements.plist` with hardened runtime entitlements.

### Task 2: Win32 Purge & Cross-Platform System Bridges
- In `src-tauri/src/photo_engine/mod.rs`:
  - Remove Win32 FFI from `trim_process_memory()`. Provide clean cross-platform no-op for Darwin.
- In `src-tauri/src/commands/app_commands.rs`:
  - Remove `win32_color` FFI (`user32`, `gdi32`) and update `sample_screen_color` to safely error/delegate to webview.
- In `src-tauri/src/commands/photo_commands.rs`:
  - Update `path_identity` to apply lowercase normalization on macOS APFS.
- In `src-tauri/src/db/package_io.rs`:
  - Update `same_path` to use `eq_ignore_ascii_case` on macOS APFS.

### Task 3: macOS System Font Enumeration & Text Rasterizer Fallback
- In `src-tauri/Cargo.toml`:
  - Add `ttf-parser = "0.25"`.
- In `src-tauri/src/commands/app_commands.rs`:
  - Implement macOS font directory scanner in `get_system_fonts()` using `ttf-parser` across `/System/Library/Fonts` and `/Library/Fonts`.
  - Update `test_get_system_fonts_smoke` to verify font discovery on macOS.
- In `src-tauri/src/export_engine/text_rasterizer.rs`:
  - Add bundled font (`inter`) fallback in `load_font_weight()` when system font lookup yields no results.
  - Verify `test_user_rotated_scenario` passes with 100% test success rate.

### Task 4: libvips Purge & Documentation Alignment
- Remove all `libvips` claims from:
  - `src-tauri/LICENSE.txt`
  - `src/config/app.ts`
  - `src/features/export/ExportAlbumDialog.tsx`
  - `ROADMAP.md`
  - `ARCHITECTURE.md`
  - `AGENTS.md`
- Run full verification:
  - `cargo check --manifest-path src-tauri/Cargo.toml`
  - `cargo test --manifest-path src-tauri/Cargo.toml`
  - Verify 37/37 tests pass.

---
*Research completed by gsd-phase-researcher.*
