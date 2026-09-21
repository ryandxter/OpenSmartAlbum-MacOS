---
last_mapped_commit: a7d32d2e29106b6263ac48059f328f6de747f7b8
last_mapped_at: 2026-09-21
---
# AFSNSmartAlbum — Technology Stack Specification

**Analysis Date:** 2026-09-21  
**Target Platform:** Windows x64 (Primary), macOS, Linux (Desktop)  
**Architecture:** Desktop Application (Tauri 2 Hybrid: Rust Backend + React/Konva Frontend)  
**Current Software Version:** `v1.0.77`

---

## 1. Executive Technology Summary

AFSNSmartAlbum is architected as a high-performance, local-first desktop application designed for professional wedding, portrait, and studio photo album layout. The application leverages a hybrid runtime combining:

- A compiled, memory-safe **Rust backend** (utilizing Tauri 2, `rusqlite`, and pure Rust image/text rasterization libraries) responsible for relational persistence, file system IO, image processing pipelines, and high-DPI export compositing.
- A reactive **React 18 / TypeScript frontend** driven by **Konva.js** (via `react-konva`) for hardware-accelerated 2D canvas manipulation, state management via **Zustand**, and a design token-based UI styling system.

The application operates completely offline with zero reliance on cloud authentication, remote storage, or telemetry tracking.

---

## 2. Languages & Runtimes

| Layer | Language / Runtime | Version / Specification | Role in Architecture |
|---|---|---|---|
| **Frontend Language** | TypeScript | `^5.6.0` (Target: `ES2021`) | Strict-typed client application logic, domain algorithms, canvas state, and UI components. |
| **Backend Language** | Rust | Edition `2021` (MSRV: `1.77.2`) | Native OS operations, embedded database management, concurrent image decoding, print-ready export. |
| **Styling** | CSS3 | Native CSS Custom Properties + CSS Modules | Component-scoped styling and unified design system token palette (`src/styles/tokens.css`). |
| **Installer Script** | NSIS (Nullsoft Scriptable Install System) | NSIS 3.x with `hooks.nsh` | Windows installer generation, desktop shortcuts, registry entries, and `.afsn` file association. |
| **Tooling Scripts** | PowerShell | Windows PowerShell 5.1+ / PS Core | Automated font face harvesting, license extraction, and checksum manifest creation (`scripts/bundle-album-fonts.ps1`). |
| **Build Runtime** | Node.js / npm | Node.js `>=20.x` | Frontend dependency resolution, TypeScript compilation, and Vite asset bundling. |
| **Webview Runtime** | WebView2 / WebKit | OS Dependent | Windows: Microsoft Edge WebView2 (Chromium 105+)<br>macOS: WebKit (Safari 14+)<br>Linux: WebKitGTK |

---

## 3. Frontend Architecture & Dependencies

The frontend lives entirely in `src/` and is bundled by Vite into static distribution assets (`dist/`) loaded by Tauri's webview.

### 3.1 Core Frameworks & Libraries (`package.json`)

| Package | Version | License | Architectural Purpose |
|---|---|---|---|
| `react` | `^18.3.0` | MIT | Declarative UI component tree, reconciliation, and hooks lifecycle. |
| `react-dom` | `^18.3.0` | MIT | DOM rendering and portal mounting for dialogs and modals. |
| `konva` | `^9.3.0` | MIT | 2D scene graph engine for 60fps canvas operations, shape rendering, and transformation handlers. |
| `react-konva` | `^18.2.0` | MIT | React declarative bindings for Konva stage, layers, shapes, transformers, and groups. |
| `zustand` | `^5.0.0` | MIT | Unopinionated, lightweight, modular global state stores (`projectStore`, `albumStore`, `photoStore`, `editorStore`, `appStore`, `historyStore`). |
| `qrcode.react` | `^4.2.0` | ISC | Generates high-contrast QRIS payment/donation QR codes (`src/features/support/SupportDonationModal.tsx`). |

### 3.2 Tauri Frontend Client Plugins (`package.json`)

| Package | Version | License | Architectural Purpose |
|---|---|---|---|
| `@tauri-apps/api` | `^2.0.0` | Apache-2.0 / MIT | Core Tauri 2 IPC bindings (`invoke`), asset URL resolver (`convertFileSrc`), and application info APIs. |
| `@tauri-apps/plugin-os` | `^2.0.0` | Apache-2.0 / MIT | Platform detection (`platform()`) for OS-tailored keyboard shortcut prompts and UI hints. |
| `@tauri-apps/plugin-shell` | `^2.0.0` | Apache-2.0 / MIT | Safe external URL navigation (`open`) delegating to the host operating system's default browser. |
| `@tauri-apps/plugin-updater` | `^2.11.0` | Apache-2.0 / MIT | In-app update check, chunked download, and atomic cryptographic signature verification. |

### 3.3 Development & Test Tooling (`package.json`)

| Package | Version | License | Purpose |
|---|---|---|---|
| `vite` | `^6.0.0` | MIT | High-speed frontend development server (port `1420`) and production bundler. |
| `@vitejs/plugin-react` | `^4.3.0` | MIT | Fast Refresh and JSX transformation support for React 18. |
| `typescript` | `^5.6.0` | Apache-2.0 | Static typing, interface definitions, and compile-time contract enforcement. |
| `tsx` | `^4.23.12` | MIT | Zero-config TypeScript execution engine for CLI-based automated test suites (`tests/*.test.ts`). |
| `@tauri-apps/cli` | `^2.0.0` | Apache-2.0 / MIT | Tauri 2 CLI orchestrating dev servers, binary builds, and installer packaging. |
| `@types/react` | `^18.3.0` | MIT | Type definitions for React. |
| `@types/react-dom` | `^18.3.0` | MIT | Type definitions for React DOM. |

---

## 4. Backend Architecture & Dependencies (`src-tauri/Cargo.toml`)

The native backend is a monolithic Rust crate (`afsn-smart-album` / `afsn_smart_album_lib`) located in `src-tauri/`. It compiles into an executable binary linking Tauri runtime components and embedded C libraries.

### 4.1 Native Crate Dependency Manifest

| Crate | Version | Features / Flags | Purpose & Subsystem |
|---|---|---|---|
| `tauri` | `2.11.3` | `["protocol-asset"]` | Core Tauri 2 desktop application runtime, IPC dispatcher, window management, and custom `asset:` protocol handler. |
| `tauri-build` | `2.6.3` | Default | Build-time script integration (`src-tauri/build.rs`) generating IPC command bindings and manifest metadata. |
| `tauri-plugin-single-instance` | `2.0` | Default | Prevents duplicate running instances; forwards second-instance launch arguments (`.afsn` file paths) to the running window. |
| `tauri-plugin-os` | `2.0` | Default | Rust backend OS identification plugin. |
| `tauri-plugin-shell` | `2.0` | Default | Sandboxed OS shell execution plugin. |
| `tauri-plugin-updater` | `2.0` | Default | Native updater backend verifying cryptographic minisign signatures from GitHub releases. |
| `tauri-plugin-log` | `2.0` | Default | File and stdout logging plugin activated during debug builds (`cfg!(debug_assertions)`). |
| `rusqlite` | `0.34` | `["bundled"]` | Embedded relational database engine. Statically links the SQLite C amalgamation; configured with Write-Ahead Logging (`WAL`). |
| `image` | `0.25` | `default-features = false`, `["jpeg", "png", "webp", "bmp", "tiff"]` | Pure Rust image decoding, progressive downsampling, EXIF orientation re-alignment, and format encoding. |
| `kamadak-exif` | `0.6` | Default | Low-overhead EXIF metadata parsing directly from image headers without full pixel bitmap decompression. |
| `fontdue` | `0.9` | Default | High-performance, pure Rust TrueType/OpenType font parser and sub-pixel glyph rasterizer. |
| `rfd` | `0.15` | Default | Rusty File Dialogs. Invokes native OS file/directory pickers (`FileFilter`, multi-selection, folder dialogs). |
| `rayon` | `1.10` | Default | Work-stealing CPU parallelism; drives multi-threaded batch photo imports and multi-spread export rendering. |
| `zip` | `2.2` | `default-features = false`, `["deflate"]` | Zip archive compression and decompression for complete bundled project packages (`.zip`). |
| `uuid` | `1.0` | `["v4"]` | Secure random UUID generation for spread elements, projects, photos, and temporary atomic swap files. |
| `serde` | `1.0` | `["derive"]` | Serialization/deserialization framework connecting Rust data structures with frontend JSON payloads. |
| `serde_json` | `1.0` | Default | JSON parser and serializer utilized for IPC message payloads and `.afsn` document storage. |
| `base64` | `0.22` | Default | Base64 encoding/decoding for embedded thumbnail transport and legacy data conversions. |
| `log` | `0.4` | Default | Standard logging facade used throughout the Rust codebase. |

---

## 5. Build Configurations & Tooling

### 5.1 Vite Configuration (`vite.config.ts`)

- **Port:** Fixed on `http://localhost:1420` (`strictPort: true`) to ensure deterministic Tauri webview communication.
- **Path Aliasing:** `@/` resolves to `./src/`.
- **FS Watching:** Specifically ignores `**/src-tauri/**` to prevent recursive reloads during Rust compilation.
- **Environment Variables:** Prefix filtering includes `VITE_` and `TAURI_ENV_*`.
- **Target Compilation:**
  ```typescript
  target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari14'
  ```
  Generates modern, optimized ES syntax matching the exact browser engine of the target host platform.
- **Source Maps & Minification:** Minification is enabled via `esbuild` for release builds, while source maps are generated only when `TAURI_ENV_DEBUG` is active.

### 5.2 TypeScript Configuration (`tsconfig.json` & `tsconfig.node.json`)

- **Target:** `ES2021` with `moduleResolution: "bundler"`.
- **Strictness:** Full strict mode (`"strict": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true`, `"noUncheckedIndexedAccess": true`).
- **Emission:** `"noEmit": true` (type validation only; bundling handled by Vite).
- **JSX:** `"react-jsx"` (React 17+ transform without manual `React` import).

### 5.3 Tauri Configuration (`src-tauri/tauri.conf.json`)

- **Identifier:** `com.afsn.smartalbum`
- **Application Window:** Single window labelled `"main"`, dimensions `1280x800` (minimum `1024x768`), centered, background `#18181b`.
- **Security & CSP:**
  ```text
  default-src 'self';
  connect-src 'self' https://api.github.com https://github.com https://objects.githubusercontent.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' asset: http://asset.localhost https://asset.localhost data: blob: https://avatars.githubusercontent.com;
  ```
- **Asset Protocol:** Active with scope restricted to `$APPCACHE/thumbnails/**` and `$APPCACHE/previews/**`.
- **File Association:** Associates `.afsn` extension with the application as `"Editor"`.
- **Packaging:** NSIS target for Windows with LZMA compression and custom NSIS hook script (`src-tauri/hooks.nsh`).

---

## 6. Operating System Targets & Native Platform Bindings

### 6.1 Target Support Matrix

| OS Target | Architecture | Primary Webview Engine | Distribution Package | Status |
|---|---|---|---|---|
| **Windows 10 / 11** | `x86_64` (`x64`) | Microsoft Edge WebView2 (Chromium) | NSIS Installer (`.exe`) | **Tier 1 (Primary Production Target)** |
| **macOS (Sonoma / Sequoia)** | `x86_64`, `aarch64` (Apple Silicon) | WebKit (Safari engine) | DMG / App Bundle | **Tier 2 (Supported via cross-platform core)** |
| **Linux (Ubuntu / Fedora)** | `x86_64` | WebKitGTK | AppImage / deb | **Tier 2 (Headless / Dev compatible)** |

### 6.2 OS-Specific Native Bindings & System Calls

The codebase contains tailored conditional compilation blocks (`#[cfg(target_os = "windows")]`) to provide deep native Windows integration while maintaining graceful fallbacks for other platforms:

#### 1. Native Screen Eyedropper Color Picker (`src-tauri/src/commands/app_commands.rs`)

- **Windows Implementation:** Calls Win32 Graphics Device Interface (GDI) via FFI:
  - `user32::GetDC(null)` retrieves the device context of the primary monitor screen.
  - `user32::GetCursorPos(&point)` samples coordinates at the active cursor position.
  - `gdi32::GetPixel(hdc, x, y)` reads raw 32-bit `COLORREF` (BGR format), converting to hex `#RRGGBB`.
  - `user32::ReleaseDC` frees the screen context immediately.
- **Non-Windows Fallback:** Returns `#FFFFFF` safely without throwing an IPC exception.

#### 2. Windows System Font Enumeration (`src-tauri/src/commands/app_commands.rs`)

- **Windows Implementation:** Direct Windows Registry traversal using `advapi32.dll` FFI:
  - `advapi32::RegOpenKeyExW` opens `SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts` across both `HKEY_LOCAL_MACHINE` (system fonts) and `HKEY_CURRENT_USER` (per-user installed fonts).
  - `advapi32::RegEnumValueW` enumerates all registered font families and physical file paths.
  - Sanitizes TrueType (`.ttf`) and OpenType (`.otf`) family names.
- **Non-Windows Fallback:** Returns an empty vector `Vec::new()`; frontend relies on bundled Google Fonts.

#### 3. Virtual Working Set Memory Trimming (`src-tauri/src/photo_engine/mod.rs`)

- **Windows Implementation:** Calls Windows Kernel memory management APIs:
  - `GetCurrentProcess()`
  - `EmptyWorkingSet(process)`
  - `SetProcessWorkingSetSize(process, usize::MAX, usize::MAX)`
  - Invoked immediately following memory-intensive operations (batch photo ingestion and spread export rendering) to return unmapped heap pages to the OS and prevent working-set bloat.
- **Non-Windows Fallback:** No-op; relies on standard OS jemalloc/malloc paging.

#### 4. NSIS Custom Pre-Install & Post-Install Hooks (`src-tauri/hooks.nsh`)

- Embeds offline privacy disclosure and EULA acceptance directly into the Windows installer flow.
- Configures desktop shortcuts, Start Menu entries, and registers `.afsn` document extension with the Windows Shell.

---

## 7. The Image Engine: libvips vs. Rust `image` Crate

### Historical Context & Current Reality

- **Historical Documentation & UI References:** Early architectural documentation (`ARCHITECTURE.md`, `ROADMAP.md`) and the About Dialog credits (`src/config/app.ts`, `src-tauri/LICENSE.txt`) mention `libvips` as the planned image processing engine due to its multi-threaded tile-based execution model.
- **Current Audited Implementation:** The active, production pipeline uses the pure Rust **`image` crate (v0.25)** in tandem with **`rayon`** (2-thread worker pool) and a global mutex lock (`ORIGINAL_DECODE`).
- **Architectural Rationale:**
  1. **Zero External C Dependencies:** Eliminates the need to distribute complex, OS-specific compiled C dynamic libraries (`libvips-42.dll`, `glib-2.0.dll`, etc.) inside the NSIS installer.
  2. **Deterministic Cross-Platform Compilation:** Compiles natively via standard `cargo build` on any platform without requiring `vpkg`, `pkg-config`, or manual header linking.
  3. **Strict Memory Concurrency Guard:** The Rust backend enforces bounded concurrency:
     - `ORIGINAL_DECODE` mutex ensures that **only one full-resolution uncompressed bitmap** exists in RAM during the decode/resize phase across all background threads.
     - Canvas previews are capped at `1500px`, and thumbnails at `320px`. Full bitmaps are dropped (`drop(img)`) immediately before encoding.

---

## 8. Typography Stack

AFSNSmartAlbum employs a hybrid dual-tier typography architecture:

1. **Statically Bundled Fonts (Offline Core):**
   Compiled directly into the Rust backend executable via `include_bytes!` (`src-tauri/src/export_engine/bundled_fonts.rs`) and loaded in the frontend via CSS `@font-face` (`public/fonts/fonts.css`):
   - **Inter** (Regular, SemiBold, Bold, Italics) — SIL Open Font License
   - **Playfair Display** (Regular, SemiBold, Bold, Italics) — SIL Open Font License
   - **Montserrat** (Regular, SemiBold, Bold, Italics) — SIL Open Font License
   - **Cormorant Garamond** (Regular, SemiBold, Bold, Italics) — SIL Open Font License
   - **Cinzel** (Regular, SemiBold, Bold) — SIL Open Font License
   - **Great Vibes** (Regular) — SIL Open Font License
2. **System Font Harvesting:**
   On Windows, queries the OS registry to expose installed TrueType/OpenType faces in the Typography Panel (`src/features/editor/TypographyPanel.tsx`).
3. **Rasterization Engine:**
   High-speed font parsing and sub-pixel glyph rasterization in Rust is powered by **`fontdue` (v0.9)**, supporting complex styled ranges, tokenized layouts, underline, and strike-through formatting during high-DPI export.
