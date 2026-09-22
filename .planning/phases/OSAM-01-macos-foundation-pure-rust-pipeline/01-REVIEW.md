# Code Review: Phase 1 — macOS Foundation & Pure Rust Pipeline

**Reviewer:** gsd-code-reviewer  
**Date:** 2026-09-22  
**Status:** Clean (Approved)

---

## 1. Executive Summary

Phase 1 establishes the foundational cross-platform configuration and pure Rust processing pipeline required to run OpenSmartAlbum natively on macOS (Apple Silicon / Intel) alongside Windows. 

All modifications across Rust backend crates, macOS configuration bundles, and TypeScript frontend components have been thoroughly inspected. No memory safety risks, no dangling pointers, no unsafe blocks, and zero accidental platform leaks (Win32 APIs on macOS) were found. All 37 Rust unit/integration tests pass cleanly, and TypeScript type checking passes without errors.

---

## 2. Scope of Reviewed Files

| File | Change Summary | Status |
| :--- | :--- | :--- |
| `src-tauri/tauri.conf.json` | Rebranded identifiers, added `app` and `dmg` bundle targets, configured macOS entitlements and DMG layout | Clean |
| `src-tauri/Entitlements.plist` | Created macOS entitlements for hardened runtime (JIT, unsigned memory, user-selected files, networking) | Clean |
| `src-tauri/Cargo.toml` | Added pure-Rust dependency `ttf-parser = "0.25"` for font header parsing | Clean |
| `src-tauri/src/photo_engine/mod.rs` | Cross-platform virtual memory trimming documentation and `#[cfg(target_os = "windows")]` isolation | Clean |
| `src-tauri/src/commands/app_commands.rs` | Implemented macOS native font enumeration (`/System/Library/Fonts`, `/Library/Fonts`, `~/Library/Fonts`) with `ttf-parser`; proper error return on non-Windows eyedropper | Clean |
| `src-tauri/src/commands/photo_commands.rs` | Path canonicalization and normalization updated to support macOS APFS case-insensitivity | Clean |
| `src-tauri/src/db/package_io.rs` | Case-insensitive path comparison support for macOS APFS/HFS+ | Clean |
| `src-tauri/src/export_engine/text_rasterizer.rs` | Fallback to bundled Inter font when system font lookup fails | Clean |
| `src/features/export/ExportAlbumDialog.tsx` | Clarified UI text to state pure Rust image engine rather than libvips | Clean |
| `src/config/app.ts` | Updated third-party attribution list to reflect `image` crate (MIT/Apache-2.0) | Clean |

---

## 3. Detailed Audit by Category

### 3.1 Security & Memory Safety
- **Unsafe Code:** No new `unsafe` blocks were introduced in this phase. The pre-existing Windows memory trimming routine in `src/photo_engine/mod.rs` remains strictly gated behind `#[cfg(target_os = "windows")]`.
- **Parsing Memory Safety:** The newly introduced font parsing mechanism uses `ttf_parser::Face::parse(&data, 0)` in `src/commands/app_commands.rs`. `ttf-parser` is a zero-allocation, 100% safe Rust library that validates table bounds without unaligned memory access or buffer overruns.
- **Entitlements:** `Entitlements.plist` properly grants `com.apple.security.files.user-selected.read-write` (required for file dialog import/export) and hardened runtime JIT permissions for WebKit/Tauri 2 webview execution.

### 3.2 Platform Compatibility (macOS & Cross-Platform)
- **Zero Win32 Leakage:** Verified that all Windows-specific code (`SetProcessWorkingSetSize`, `EmptyWorkingSet`, `gdi32`/`user32` calls) is strictly conditionalized via `#[cfg(target_os = "windows")]`.
- **macOS Font Enumeration:** `get_system_fonts` scans macOS standard system and user directories:
  - `/System/Library/Fonts`
  - `/Library/Fonts`
  - `$HOME/Library/Fonts`
  It ignores inaccessible paths, gracefully parses `.ttf`, `.otf`, and `.ttc` collections, and filters duplicate font family names.
- **Filesystem Case-Sensitivity:** On macOS, APFS and HFS+ volumes are case-preserving but case-insensitive by default. Both `path_identity` in `photo_commands.rs` and `same_path` in `package_io.rs` have been updated to treat paths case-insensitively on both Windows and macOS (`#[cfg(any(windows, target_os = "macos"))]`), preventing phantom duplicates or false relinking failures.

### 3.3 Error Handling & Robustness
- **Screen Color Eyedropper:** In `src/commands/app_commands.rs`, `sample_screen_color` on non-Windows targets returns `Err("NATIVE_SAMPLING_UNAVAILABLE".to_string())` instead of a misleading mock value (`#FFFFFF`). This cleanly signals the frontend to employ the standard HTML5 `EyeDropper` API.
- **Text Rasterization Fallback:** In `src/export_engine/text_rasterizer.rs`, missing system fonts fall back to bundled Inter font assets (`super::bundled_fonts::bundled_font("inter", ...)`), eliminating crashes or invisible text renders during export.

### 3.4 Type Correctness & Compilation
- **Clippy:** Ran `cargo clippy` on the macOS host; all new Phase 1 code compiles with zero warnings.
- **Test Suite:** Ran `cargo test` covering all 37 backend tests; all passed successfully (including `test_get_system_fonts_smoke` validating macOS font discovery).
- **TypeScript:** Ran `npx tsc --noEmit`; 0 errors reported.

---

## 4. Conclusion & Recommendations

The implementation for Phase 1 is clean, safe, and meets all requirements. No regressions or security issues were found. The codebase is ready to proceed to Phase 2.
