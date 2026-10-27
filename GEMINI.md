<!-- GSD:project-start source:PROJECT.md -->

## Project

**OpenSmartAlbum macOS — v1.4.14 Feature Parity & Clean-Room Evolution**

OpenSmartAlbum (`albumaker`) adalah aplikasi desktop desain album foto cetak (*Print Album*) dan *Social Media Carousel* berbasis Tauri v2 (React 18 + Konva + Zustand + Rust + SQLite + Embedded ONNX AI) yang 100% *open-source* dan dioptimalkan secara native untuk macOS. Proyek ini merupakan jalur independen (*separate way*) dari repositori awal yang dulunya *open-source*, namun kemudian diubah menjadi *proprietary* oleh pemilik aslinya (`AFSNSmartAlbum`) dengan pembatasan donasi/lisensi. Milestone ini berfokus pada pelaksanaan *Full-Stack Reverse Engineering (REA)* terhadap biner rilis terbaru mereka (`AFSNSmartAlbum_1.4.14_x64-setup.exe`) guna memetakan seluruh penambahan fitur sejak baseline `v1.4.0` dan mengimplementasikan seluruh kapabilitas fungsional baru tersebut secara *clean-room* ke dalam OpenSmartAlbum macOS.

**Core Value:** Menghadirkan paritas fitur penuh dan keunggulan fungsional setara (atau melampaui) `AFSNSmartAlbum v1.4.14` secara native di macOS dengan tetap mempertahankan sifat 100% *open-source*, bebas *nagware* donasi, bebas DRM/telemetri tertutup, dan berkinerja tinggi.

### Constraints

- **Tech Stack**: Tauri v2 + React 18 + TypeScript 5.6 + Konva 9 + Zustand 5 + Rust (`rusqlite`, `image`, `tract-onnx`, `fontdue`) — Menjaga konsistensi arsitektur *Pure Domain + Reactive Store + Native Rust Engine*.
- **Platform Target**: macOS Native (`minimumSystemVersion: "13.0"`, `.app` & `.dmg`) — Fokus utama pada pengalaman pengguna macOS yang mulus dan cepat.
- **Compilation & Verification**: Wajib lolos `tsc --noEmit` (incremental) dan `cargo check` / `vitest` tanpa regresi pada fitur yang sudah tervalidasi.
- **Lisensi & Etika**: 100% *Open Source*, bebas *nagware* donasi, menggunakan pendekatan *clean-room implementation* berdasarkan analisis perilaku dan struktur dari `v1.4.14`.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- **TypeScript** `^5.6.0` — Frontend UI, domain geometry/layout engines, canvas rendering orchestration, and state management (`src/`, `tsconfig.json`, `tsconfig.node.json`).
- **Rust** `1.77.2` (Edition `2021`) — Native desktop backend, SQLite persistence, parallel image processing, ONNX face detection inference, font/text rasterization, and print/social export engines (`src-tauri/Cargo.toml`, `src-tauri/src/`).
- **CSS3 (Custom Properties + CSS Modules)** — Design tokens, dark-mode studio theme, and component-scoped styling (`src/styles/global.css`, `src/styles/tokens.css`, `src/styles/reset.css`, `src/**/*.module.css`).
- **SQL (SQLite Dialect)** — Embedded relational schema (16 incremental migrations) managed inside `src-tauri/src/db/mod.rs`.

## Runtime

- **Tauri v2 Desktop Runtime** (`tauri` `2.11.3`) — Hybrid native desktop shell using WebKit (`WKWebView`) on macOS (`minimumSystemVersion: "13.0"`) and Chromium (`WebView2`) on Windows (`src-tauri/tauri.conf.json`).
- **Node.js / ES Modules** (`"type": "module"` in `package.json`) — Build-time toolchain, Vite dev server, Vitest test runner, and `tsx` verification scripts.
- **npm** — Frontend dependency management (`package.json`, `package-lock.json`).
- **Cargo** — Rust crate management (`src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`).

## Frameworks

- **React** `^18.3.0` & **React DOM** `^18.3.0` — Component hierarchy, dialogs, inspector panels, and workspace shell (`src/main.tsx`, `src/App.tsx`).
- **Konva** `^9.3.0` & **react-konva** `^18.2.0` — Hardware-accelerated 2D HTML5 Canvas scene graph for interactive print album spreads (`src/features/editor/KonvaEditorCanvas.tsx`) and panoramic social media carousels (`src/features/carousel/CarouselCanvas.tsx`).
- **Zustand** `^5.0.0` — Reactive client-side state stores (`src/stores/projectStore.ts`, `src/stores/albumStore.ts`, `src/stores/carouselStore.ts`, `src/stores/photoStore.ts`, `src/stores/editorStore.ts`, `src/stores/appStore.ts`, `src/stores/historyStore.ts`).
- **Tauri v2** (`@tauri-apps/api` `^2.0.0`, `tauri` `2.11.3`) — Cross-platform application lifecycle, window management, native IPC command bridge, and custom `asset:` protocol (`src-tauri/src/lib.rs`).
- **Tauri Plugins:**
- **Lucide React** `^1.47.0` — Vector iconography across toolbars, layers, and inspectors (`package.json`).
- **qrcode.react** `^4.2.0` — QR code rendering inside about/support UI (`package.json`).
- **Custom CSS Token Architecture** — Neutral charcoal/graphite dark-mode studio palette (`#18181b` primary background, zero chromatic bias for photo color accuracy) using CSS variables (`src/styles/tokens.css`) and CSS Modules (no Tailwind runtime dependency).
- **Vitest** `^5.0.2` — Unit and domain logic test suite (`src/domain/*.test.ts`, `src/features/**/*.test.tsx`).
- **Playwright** `^1.63.0` — Headless browser and E2E layout verification (`package.json`, `scripts/verify_e2e_layouting.ts`).
- **tsx** `^4.23.12` — Direct TypeScript script execution for E2E verification (`scripts/`).

## Rust Crates & Native Engines

- **rusqlite** `0.34` (`features = ["bundled"]`) — Self-contained SQLite C engine compiled directly into the binary with WAL journal mode and foreign key enforcement (`src-tauri/src/db/mod.rs`).
- **zip** `2.2` (`features = ["deflate"]`) — Portable bundled project archive (`.zip` containing `project.afsn` and `photos/`) reading and writing (`src-tauri/src/db/package_io.rs`).
- **uuid** `1.0` (`features = ["v4"]`) — Unique entity and temporary atomic file ID generation (`src-tauri/Cargo.toml`).
- **image** `0.25` (`features = ["jpeg", "png", "webp", "bmp", "tiff"]`) — Bitmap decoding, cropping, bilinear rotation, thumbnail/preview downsampling, and JPEG/PNG encoding (`src-tauri/src/photo_engine/mod.rs`, `src-tauri/src/export_engine/mod.rs`).
- **tiff** `0.11` (`features = ["lzw", "deflate"]`) — 8-bit (`RGB8`) and 16-bit (`RGB16`) LZW-compressed TIFF export with physical DPI rational tags (`src-tauri/src/export_engine/mod.rs`).
- **Custom Native PDF/X-3 & PDF 1.4 Writer** — Zero-external-crate PDF assembler (`assemble_pdf_from_jpegs` in `src-tauri/src/export_engine/mod.rs`) that embeds `DCTDecode` JPEG streams directly into PDF XObjects with `/MediaBox`, `/BleedBox`, `/TrimBox`, vector hairline crop marks, spine fold ticks, and `PDF/X-3:2002` `sRGB IEC61966-2.1` output intents.
- **Custom Native Layered PSD Writer** — Zero-external-crate Adobe Photoshop `.psd` binary encoder (`src-tauri/src/export_engine/psd_writer.rs`) supporting PackBits RLE compression, individual photo/text layers, and non-destructive grayscale shape masks (`Channel ID -2`).
- **kamadak-exif** `0.6` — Fast EXIF header and IFD1 embedded thumbnail extraction (`src-tauri/src/photo_engine/mod.rs`, `src-tauri/src/export_engine/mod.rs`).
- **base64** `0.22` — Base64 encoding/decoding for instant micro-thumbnails and canvas snapshots (`src-tauri/Cargo.toml`).
- **tract-onnx** `0.21.8` & **ndarray** `0.16` — Pure-Rust ONNX inference engine executing the embedded YuNet face detection model (`src-tauri/models/face_detection_yunet_2023mar.onnx` via `include_bytes!`) at `640x640` resolution (`src-tauri/src/photo_engine/face_detector.rs`). Computes 5-point facial landmarks, roll angle, eye-aspect-ratio blink detection, Laplacian face sharpness, and hero-shot scoring.
- **fontdue** `0.9` & **ttf-parser** `0.25` — Native glyph outline parsing and sub-pixel anti-aliased text rasterization for high-DPI print and PSD exports, utilizing bundled TTF fonts (`Inter`, `Playfair Display`, `Lora`, `Montserrat`, `Oswald`, `Dancing Script`) in `src-tauri/src/export_engine/text_rasterizer.rs` and `src-tauri/src/export_engine/bundled_fonts.rs`.
- **rayon** `1.10` — Data-parallel thread pools for batch photo importing, unsharp mask print sharpening (`apply_print_sharpening`), and batch face detection (`src-tauri/src/commands/photo_commands.rs`, `src-tauri/src/export_engine/mod.rs`).
- **rfd** `0.15` — Native macOS/Windows file/folder pickers and confirmation message dialogs (`src-tauri/src/commands/project_commands.rs`, `src-tauri/src/commands/photo_commands.rs`).
- **serde** `1.0` & **serde_json** `1.0` — Type-safe serialization across Tauri IPC payloads and `.afsn` JSON project packages.

## Build Configuration

- **Vite** `^6.0.0` with `@vitejs/plugin-react` `^4.3.0`.
- Path alias `@` mapped to `./src`.
- Fixed dev server port `http://localhost:1420` (`strictPort: true`), ignoring `src-tauri/**`.
- Build target dynamically selects `safari14` on macOS/Linux (`WebKit`) and `chrome105` on Windows (`Chromium`), with `esbuild` minification in release builds.
- Target `ES2021`, `module: "ESNext"`, `moduleResolution: "bundler"`, `jsx: "react-jsx"`.
- Strict typechecking enabled (`strict: true`, `noUncheckedIndexedAccess: true`, `noUnusedLocals: true`, `noUnusedParameters: true`).
- Incremental compilation enabled (`"incremental": true`) with non-source/workflow directories excluded (`node_modules`, `dist`, `build`, `.planning`, `graphify-out`, etc.).
- **Product Identifier:** `com.opensmartalbum.app` (`OpenSmartAlbum` `v1.4.0`).
- **Bundle Targets:** `["app", "dmg", "nsis"]` with `createUpdaterArtifacts: true`.
- **macOS Specifics:** `minimumSystemVersion: "13.0"`, entitlements at `src-tauri/Entitlements.plist` (`allow-jit`, `allow-unsigned-executable-memory`, `files.user-selected.read-write`, `network.client`).
- **Windows Specifics:** NSIS installer (`installMode: "both"`, `compression: "lzma"`, custom `hooks.nsh`).
- **File Associations:** Registers `.afsn` and `.opensmartalbum` extensions with role `Editor`.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Overview

## TypeScript Configuration & Style

### Compiler Strictness (`tsconfig.json`)

- `"target": "ES2021"`, `"module": "ESNext"`, `"moduleResolution": "bundler"`, `"jsx": "react-jsx"`
- **Strictness flags:**
- **Fast Incremental Verification:**
- **Path Aliases:**

### Formatting & Syntax Conventions

- **Quotes & Semicolons:** Single quotes (`'...'`) for strings and imports; trailing semicolons required; 2-space indentation in TypeScript/TSX, 4-space indentation in Rust.
- **Type-Only Imports:** `import type { ... }` or inline `import { getCornerRadii, type PhotoFrameElement }` is used in pure domain modules (`src/domain/album.ts`, `src/domain/adaptiveLayout.ts`) to respect `"isolatedModules": true`.
- **Component & Styling Co-location:** Every UI primitive in `src/components/ui/` and feature view in `src/features/*/` pairs a `.tsx` component with a co-located CSS Modules stylesheet (`*.module.css`), e.g., `src/components/ui/Button.tsx` + `src/components/ui/Button.module.css` and `src/features/editor/KonvaEditorCanvas.tsx` + `src/features/editor/KonvaEditorCanvas.module.css`.
- **Design Tokens:** Global CSS custom properties live in `src/styles/tokens.css`, `src/styles/reset.css`, and `src/styles/global.css`.

## Naming Conventions

### TypeScript & React (`src/`)

| Construct | Convention | Examples |
|-----------|------------|----------|
| React Components (`.tsx`) | `PascalCase` file & export | `src/features/editor/KonvaEditorCanvas.tsx`, `src/components/ui/ColorPicker.tsx` |
| CSS Modules | `PascalCase.module.css` | `src/features/album/PageNavigator.module.css` |
| Domain & Utility Modules (`.ts`) | `camelCase.ts` | `src/domain/adaptiveLayout.ts`, `src/domain/richTextSelection.ts`, `src/utils/shortcuts.ts` |
| Zustand Store Files | `<domain>Store.ts` in `src/stores/` | `src/stores/albumStore.ts`, `src/stores/carouselStore.ts`, `src/stores/projectStore.ts` |
| Zustand Store Hooks | `use<Domain>Store` | `useAlbumStore`, `useCarouselStore`, `useProjectStore`, `usePhotoStore`, `useEditorStore`, `useHistoryStore`, `useAppStore` |
| React Custom Hooks | `use<Name>.ts` | `src/hooks/useTauriInfo.ts`, `src/features/persistence/useAutoSave.ts`, `src/features/inspector/useAccordionState.ts` |
| Interfaces & Discriminated Unions | `PascalCase` | `AlbumElement`, `PhotoFrameElement`, `TextNodeElement`, `CarouselElement`, `Spread`, `Project` |
| Constants & Presets | `UPPER_SNAKE_CASE` | `BUILTIN_ALBUM_PRESETS` (`src/domain/presets.ts`), `CAROUSEL_RATIO_PRESETS` (`src/domain/carousel.ts`), `DEFAULT_TEXT_STYLE` (`src/domain/text.ts`) |
| Functions & Methods | `camelCase` | `generateAdaptiveLayoutVariations`, `calculateOptimalStudioCrop`, `syncAlbumPhotoAssets` |

### Rust (`src-tauri/src/`)

| Construct | Convention | Examples |
|-----------|------------|----------|
| Modules & Files | `snake_case.rs` | `src-tauri/src/asset_cache.rs`, `src-tauri/src/commands/photo_commands.rs`, `src-tauri/src/export_engine/psd_writer.rs` |
| Tauri Commands | `snake_case` `#[tauri::command]` | `create_project`, `save_album_structure`, `detect_photos_faces_batch`, `export_album_high_res` |
| Structs & Enums | `PascalCase` (`*Row`, `*Payload`, `*Request`, `*Result`, `*State`) | `ProjectRow`, `PhotoRow`, `AlbumPayload`, `SpreadPayload`, `ElementPayload`, `CreateProjectRequest` |
| Global Locks & Atomics | `UPPER_SNAKE_CASE` | `PROJECT_FILE_JOB` (`src-tauri/src/commands/project_commands.rs`), `PHOTO_ASSET_JOB` (`src-tauri/src/asset_cache.rs`), `IS_FILE_PICKER_OPEN` (`src-tauri/src/commands/photo_commands.rs`) |

## Pure Domain Function Patterns (`src/domain/`)

## Zustand Store Patterns (`src/stores/`)

- `src/stores/projectStore.ts` — Active `Project` metadata, recent projects list, `.afsn` package import/export, margin/spacing/bleed persistence.
- `src/stores/albumStore.ts` — Print `Album` state (`coverSpread`, interior `spreads`), active spread selection, element CRUD, adaptive layout application, auto-flow generation, and SQLite structure persistence.
- `src/stores/carouselStore.ts` — Social `Carousel` state (`slides`, `ratio`, `slideWidthPx`, `slideHeightPx`), panorama-spanning frame coordinate math, per-slide layout cycling, and built-in undo/redo stack (`past`, `future`).
- `src/stores/editorStore.ts` — Ephemeral canvas interaction state (multi-frame selection `selectedFrameIds`, active crop mode `croppingFrameId`, inline text editing id, snap guides, canvas guide visibility).
- `src/stores/photoStore.ts` — Project photo library (`Photo[]`), folder/collection tabs, filtering/sorting, import progress listener, and face detection metadata cache (`faceDataMap`).
- `src/stores/historyStore.ts` — Dedicated deep-cloned snapshot undo/redo stack (`past: Album[]`, `future: Album[]`, `maxHistory: 50`) for print albums, deduplicating consecutive identical snapshots via `JSON.stringify`.
- `src/stores/appStore.ts` — Application shell state: modal visibility flags, updater state, `AppPreferences`, active workspace mode (`activeMode: 'print' | 'carousel'`), and isolated per-mode viewport state (`printZoom`, `carouselZoom`, `printPan`, `carouselPan`).

### Key Store Conventions

## Tauri IPC & Serialization Conventions

### Rust ↔ TypeScript Boundary

## Error Handling & Resilience

### Frontend (TypeScript / React)

- **Dual-Mode Runtime Fallbacks (Tauri vs. Browser Dev):**
- **Global Error Capture & Recovery UI:**

### Backend (Rust)

- **Command Error Return Signature:**
- **Upfront Input Validation:**
- **Non-Fatal Cache Cleanup:**

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## Pattern Overview

- **Dual Studio Mode Architecture (`print` vs `carousel`):** Unified desktop application supporting two distinct layout paradigms—physical print albums (double-page spreads in `mm`/`cm`/`inch`/`px` with spine, bleed, and safe margins) and digital social carousels (multi-slide continuous canvases in `px` with seamless cross-slide panorama frames).
- **Strict Separation of Domain Logic and UI State:** Pure, deterministic TypeScript algorithms in `src/domain/` handle layout generation (BSP tree partitioning, Hungarian slot-matching, divider graphs), storytelling auto-flow, rich-text styling, unit conversions, and AI crop math, while Zustand stores in `src/stores/` orchestrate reactive UI state and Tauri IPC persistence.
- **High-Performance Canvas Rendering:** Interactive WYSIWYG editing uses `react-konva` (`src/features/editor/KonvaEditorCanvas.tsx` for print spreads and `src/features/carousel/CarouselCanvas.tsx` for social carousels) with custom overlays for divider dragging, snapping lines, crop reticles, and inline rich-text editing.
- **Native Rust Compute & Storage Layer:** Heavy I/O, image decoding/resizing (including RAW/HEIC/TIFF), local SQLite persistence (`afsn_smart_album.db`), `.afsn` project packaging, YuNet ONNX face detection (`tract-onnx`), and high-DPI print/carousel rendering (`JPEG`, `PNG`, `TIFF`, `PDF`, `PSD`) run natively in Rust (`src-tauri/src/`) with multi-threaded `rayon` workers.

## Layers

- Purpose: Renders the desktop workspace shell, interactive Konva canvases, property inspectors, filmstrip photo tray, and modal dialogs.
- Location: `src/features/`, `src/components/`
- Contains: Feature-scoped React components, CSS Modules (`*.module.css`), Konva node wrappers (`TextNode.tsx`, `CarouselTextNode.tsx`), and reusable UI primitives (`src/components/ui/`).
- Depends on: `src/stores/`, `src/domain/`, `@tauri-apps/api`.
- Used by: `src/App.tsx` and `src/main.tsx`.
- Purpose: Manages client-side application state, undo/redo history stacks, selection state, per-mode viewport state, and serialized IPC write queues to the Rust SQLite backend.
- Location: `src/stores/`
- Contains: Seven focused Zustand stores (`appStore.ts`, `projectStore.ts`, `albumStore.ts`, `carouselStore.ts`, `editorStore.ts`, `photoStore.ts`, `historyStore.ts`).
- Depends on: `src/domain/`, `@tauri-apps/api/core`, `@tauri-apps/api/event`.
- Used by: React components in `src/features/` and `src/App.tsx`.
- Purpose: Encapsulates zero-UI business rules, geometric math, generative layout engines, storytelling cadence, rich-text run models, and AI face-framing calculations.
- Location: `src/domain/`
- Contains: Pure TypeScript modules (`album.ts`, `carousel.ts`, `editor.ts`, `adaptiveLayout.ts`, `text.ts`, `units.ts`, `shapes.ts`, `layout/*`, `storytelling/*`, `ai/*`).
- Depends on: Standard TypeScript types (only `src/domain/ai/faceDetection.ts` bridges to Tauri `invoke` with an in-memory LRU cache).
- Used by: `src/stores/`, `src/features/`, and headless verification scripts (`scripts/`).
- Purpose: Exposes strongly typed `#![tauri::command]` handlers and asynchronous progress events between the WebView frontend and Rust subsystems.
- Location: `src-tauri/src/commands/`
- Contains: `app_commands.rs`, `project_commands.rs`, `photo_commands.rs`, `export_commands.rs`.
- Depends on: `src-tauri/src/db/`, `src-tauri/src/asset_cache.rs`, `src-tauri/src/photo_engine/`, `src-tauri/src/export_engine/`.
- Used by: Registered in `src-tauri/src/lib.rs` via `tauri::generate_handler![]`.
- Purpose: Performs SQLite relational + JSON structure persistence, portable `.afsn` archive I/O, thumbnail/preview caching, ONNX face & landmark inference, and pixel-accurate high-resolution export rendering.
- Location: `src-tauri/src/db/`, `src-tauri/src/export_engine/`, `src-tauri/src/photo_engine/`, `src-tauri/src/asset_cache.rs`
- Depends on: `rusqlite`, `image`, `rayon`, `tract-onnx`, `ab_glyph`, `tiff`, `zip`.
- Used by: `src-tauri/src/commands/` and startup lifecycle hooks in `src-tauri/src/lib.rs`.

## Dual Studio Mode (Print Album vs Social Carousel)

## Data Flow

## Key Abstractions

- Purpose: Central state and domain model for Print Album projects.
- Represents an album as `coverSpread`, `innerSpreads[]`, and `backSpread`, where each `Spread` contains `elements: AlbumElement[]` (`PhotoFrameElement | TextNodeElement`).
- Purpose: Central state and domain model for Social Carousel projects.
- Represents a multi-slide horizontal strip (`slides: CarouselSlide[]`, `ratio: CarouselRatio`) where frames can belong to a single slide or span across 2–3 adjacent slides (`spanSlides`).
- Purpose: Interactive canvas selection, multi-frame transform math, snapping (`SnapLine`, `GapGuide`), clipboard, and frame/crop manipulation for the active spread.
- Purpose: Project-level metadata (canvas dimensions, unit, DPI, spacing, margins, bleed, `.afsn` file path) and lifecycle orchestration across stores.
- Purpose: Project photo library, custom folders/collections, filtering/sorting, missing-file detection/relinking, and AI face telemetry orchestration.
- Purpose: Thread-safe `Mutex<Connection>` wrapper around SQLite managing `projects`, `photos`, `photo_folders`, `photo_folder_items`, `album_structures`, `carousel_structures`, and `photo_faces`, plus portable `.afsn` package import/export (`src-tauri/src/db/package_io.rs`).

## Entry Points

- Location: `src/main.tsx`, `src/App.tsx`
- Triggers: WebView initialization by Tauri or Vite dev server.
- Responsibilities: Loads global CSS tokens (`src/styles/tokens.css`, `src/styles/reset.css`, `src/styles/global.css`), wraps the app in `ErrorBoundary` (`src/components/ErrorBoundary.tsx`), registers global window error and context-menu handlers, checks CLI file-open arguments (`get_initial_open_path`) and single-instance events (`open-project-file`), runs silent background update checks (`src/services/updateService.ts`), and mounts `WorkspaceLayout` (`src/features/workspace/WorkspaceLayout.tsx`).
- Location: `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`
- Triggers: Native OS process launch (`afsn_smart_album_lib::run()`).
- Responsibilities: Parses CLI `.afsn` arguments, configures `tauri_plugin_single_instance`, `tauri_plugin_os`, `tauri_plugin_shell`, and `tauri_plugin_updater`, initializes `afsn_smart_album.db` in the OS app data directory, runs startup orphaned cache cleanup (`asset_cache::cleanup_orphaned_photo_assets`), registers managed states (`Database`, `LaunchState`, `ImportState`, `ExportState`, `AppExitState`), and mounts all IPC command handlers.

## Error Handling

- **React Error Boundary & Window Diagnostics:** `src/components/ErrorBoundary.tsx` catches render crashes and provides an interactive reset, while `src/App.tsx` persists unhandled window errors to `localStorage` (`afsn_last_window_error`).
- **Serialized Persistence Queues:** Both `persistInOrder` (`src/stores/albumStore.ts`) and `persistCarouselInOrder` (`src/stores/carouselStore.ts`) chain asynchronous IPC database writes so concurrent UI edits and auto-save ticks never race or corrupt SQLite JSON blobs.
- **Unsaved Exit & Switch Guards:** `AppExitState` (`src-tauri/src/commands/app_commands.rs`) intercepts native OS window close events (`tauri::WindowEvent::CloseRequested`) when unsaved changes exist and emits `request-close-warning` to display `src/features/workspace/ExitWarningModal.tsx`.

## Cross-Cutting Concerns

- All physical print dimensions (`mm`, `cm`, `inch`) and pixel coordinates (`px`) are converted deterministically via `convertUnit()` on the frontend and `calculate_export_scale()` on the Rust export engine so screen layout ratios and 300+ DPI print renders match to sub-pixel accuracy.
- Curated TTF fonts (`public/fonts/` and `src-tauri/resources/fonts/`) are shared between the browser CSS `@font-face` renderer and the Rust `ab_glyph` text rasterizer (`src-tauri/src/export_engine/text_rasterizer.rs`) to guarantee WYSIWYG text fidelity upon export.

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.agents/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
