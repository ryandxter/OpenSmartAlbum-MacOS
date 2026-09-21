---
last_mapped_commit: a7d32d2e29106b6263ac48059f328f6de747f7b8
last_mapped_at: 2026-09-21
---
# AFSNSmartAlbum — System Architecture

**Analysis Date:** 2026-09-21  
**Target Platform:** macOS, Windows, Linux (Desktop)  
**Core Technologies:** Tauri 2, Rust (2021 Edition), React 18, TypeScript 5.6, Konva.js 9, Zustand 5, SQLite (rusqlite 0.34 WAL), Image Crate 0.25, Fontdue 0.9.

---

## 1. Executive Architectural Summary

AFSNSmartAlbum is a professional, local-first, offline desktop photo album design application built for professional photographers and creative studios. Inspired by industry-standard layout solutions (such as Pixellu SmartAlbums, Adobe InDesign, and Adobe Lightroom), the software allows rapid, mathematically precise spread design, smart magnetic snapping, automated adaptive layout partitioning, and print-ready high-resolution rendering at arbitrary DPI.

### Architectural Tenets

1. **100% Local-First & Completely Offline**: Zero external server dependencies, cloud authentication, telemetry gateways, or web service requirements.
2. **Dual-Layer Separation**:
   - **Frontend**: High-framerate interactive presentation, stage rendering via hardware-accelerated 2D canvas (`react-konva`), and state orchestration (`zustand`).
   - **Backend**: Native OS operations, embedded relational persistence (`rusqlite` WAL mode), thread-safe asset caching, image decoding pipelines, and CPU-intensive export compositing (`rayon`, `image`, `fontdue`).
3. **Progressive Image Pipeline**: Original full-resolution image binaries are **never** held in SQLite or loaded unnecessarily into frontend DOM/canvas memory. Decoded textures are strictly governed through progressive downscaled derivatives (320px thumbnails, 1500px canvas previews) and bounded LRU cache evictions.
4. **Physical Precision at Configured DPI**: Pure domain mathematical models separate physical spread dimensions (`mm`, `cm`, `inch`) from logical viewport coordinates and export device pixels.
5. **Fail-Safe Atomic Persistence**: Multi-tier save architecture combining crash recovery snapshots (`localStorage`), structured relational transactions (`SQLite`), and staged atomic writes with destination identity validation for the native `.afsn` format.

---

## 2. High-Level System Topology

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│                                PRESENTATION TIER                                  │
│   React 18 UI (Vite 6)  •  Zustand 5 State Stores  •  CSS Modules Tokens          │
│   ├── WorkspaceLayout, FilmstripTray, Properties Inspector, PageNavigator         │
│   └── Dialogs: ExportAlbumDialog, NewProjectDialog, SettingsDialog, ConfirmDialog  │
└────────────────────────────────────────┬──────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────┴──────────────────────────────────────────┐
│                                CANVAS ENGINE TIER                                 │
│   React-Konva 18  •  Konva.js 9  •  Custom Canvas LRU Image Texture Cache (Max 24) │
│   ├── Stage / Pasteboard Viewport Engine (Zoom, Pan, Screen-to-Spread Projection) │
│   ├── Spread Layer: Paper Sheet, Safe Margins, Crease Gutter, Bleed Guides        │
│   ├── Frame & Text Nodes: Transforms, Crops, Radii, Borders, Rich Text Renderers  │
│   └── Interactive HUD: Magnetic Snap Lines, Gap Matching, Distance Overlays       │
└────────────────────────────────────────┬──────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────┴──────────────────────────────────────────┐
│                           PURE DOMAIN LOGIC TIER (TypeScript)                     │
│   Isolated, side-effect-free business algorithms with zero framework dependencies │
│   ├── 2D Topological Spatial Neighbor Graph Multi-Resize Engine                   │
│   ├── Bipartite Hungarian/Greedy Adaptive Layout Slot Matcher                     │
│   ├── Smart Snapping & Magnetic Guide Alignment Geometry                          │
│   ├── Physical Unit Dimension Converter (mm, cm, inch, pt, px at target DPI)      │
│   └── Rich Text Parser, Styled Ranges, & Line Break Formatter                     │
└────────────────────────────────────────┬──────────────────────────────────────────┘
                                         │
                         Tauri 2 IPC Bridge (`invoke` / `emit`)
                                         │
┌────────────────────────────────────────┴──────────────────────────────────────────┐
│                            RUST BACKEND CORE TIER                                 │
│   Tauri 2.11 Core  •  Native Plugins (Single-Instance, OS, Shell, Updater, Log)   │
│   ├── commands/                                                                   │
│   │   ├── project_commands.rs (CRUD, Spacing, Margins, Package IO)                │
│   │   ├── photo_commands.rs (Pickers, Background Batch Ingestion, Relinking)      │
│   │   ├── export_commands.rs (High-res export orchestrator, Preflight checks)     │
│   │   └── app_commands.rs (System info, DB diagnostics, Color sampler, Fonts)     │
│   ├── photo_engine/                                                               │
│   │   ├── Fast EXIF IFD1 JPEG Thumbnail Extraction (First 128KB Header Scan)      │
│   │   ├── Memory-Bounded Worker Pool (Rayon + image crate 0.25)                   │
│   │   └── Progressive 1500px Preview & 320px Filmstrip Thumbnail Generator        │
│   ├── export_engine/                                                              │
│   │   ├── Multi-threaded High-Res Compositor (300+ DPI, Bleed, Page Splitting)    │
│   │   ├── Bundled & System Font Rasterizer (fontdue 0.9)                          │
│   │   └── Metadata Inserters: JFIF APP0 (JPEG) & pHYs Chunk (PNG)                 │
│   └── db/                                                                         │
│       ├── SQLite Manager (rusqlite bundled, WAL mode, Schema Migrations v1-v15)   │
│       └── package_io.rs (Staged atomic writes, Identity checks, ZIP packager)     │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Entry Points & Application Lifecycle

### 3.1 Backend Entry (`src-tauri/src/main.rs` & `src-tauri/src/lib.rs`)

1. **CLI Argument & File Association Inspection**:
   - Inspects startup arguments (`std::env::args()`). If a `.afsn` file path is passed (e.g., double-clicked in Finder/Explorer), it is captured into `commands::project_commands::LaunchState`.
2. **Single-Instance Plugin Enforcement**:
   - `tauri-plugin-single-instance` intercepts secondary launches, unminimizes and focuses the primary window, and emits the `open-project-file` event to the frontend.
3. **Window Close Interception**:
   - `WindowEvent::CloseRequested` inspects `commands::app_commands::AppExitState`. If `is_unsaved` is atomic true, the window close is prevented (`api.prevent_close()`), and a `request-close-warning` event triggers the frontend modal (`ExitWarningModal.tsx`).
4. **Embedded Database Initialization**:
   - Resolves system app data directory (`{app_data_dir}/afsn_smart_album.db`).
   - Runs `Database::init`, enabling SQLite WAL mode (`PRAGMA journal_mode=WAL`) and foreign keys (`PRAGMA foreign_keys=ON`).
   - Executes incremental schema migrations (`migrate_v1` through `migrate_v15`).
5. **Asset Cache Boot Hygiene**:
   - Calls `asset_cache::cleanup_orphaned_photo_assets`, scanning the cache directory against registered database photo IDs and purging lingering temporary or orphaned files.
6. **Managed State Registration**:
   - Injects `Database`, `LaunchState`, `ImportState`, `ExportState`, and `AppExitState` into Tauri's managed dependency container.

### 3.2 Frontend Entry (`src/main.tsx` & `src/App.tsx`)

1. **DOM Mount**: Mounts the React 18 root inside `#root` defined in `index.html`.
2. **Global System Hygiene**:
   - Suppresses the browser's default context menu (`window.addEventListener('contextmenu', e => e.preventDefault())`) to enforce desktop software conventions.
   - Registers unhandled rejection and error listeners, logging diagnostic traces to `localStorage.afsn_last_window_error`.
3. **Startup Workflow Routing**:
   - Invokes Tauri command `get_initial_open_path`.
   - If an initial path was provided via file association, `openProjectFromFile` is invoked.
   - Otherwise, if user preference `startupBehavior === 'reopen_last'`, the store reopens the top project in `recentProjects`.
   - Otherwise, presents the `WelcomeScreen.tsx` with recent projects, templates, and project creation actions.
4. **Background Non-Blocking Services**:
   - Initiates a silent 4-second delayed update check (`checkForAppUpdates`) using `tauri-plugin-updater`.

---

## 4. State Management Architecture

State is managed by specialized Zustand 5 stores located in `src/stores/`. State stores are partitioned strictly by domain responsibility and maintain unidirectional synchronization with the Rust backend.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ZUSTAND 5 STORES                               │
├──────────────────┬──────────────────────────────────────────────────────────┤
│ Store            │ Key Responsibilities                                     │
├──────────────────┼──────────────────────────────────────────────────────────┤
│ `projectStore`   │ Current project settings (dimensions, unit, DPI,         │
│                  │ margins, spacing, borders, background), recent projects, │
│                  │ and high-level file persistence (.afsn / .zip packages). │
├──────────────────┼──────────────────────────────────────────────────────────┤
│ `albumStore`     │ Complete album document structure: cover spread,         │
│                  │ interior spreads list, active spread ID, guide toggles,  │
│                  │ serialized database write queue (`persistInOrder`).      │
├──────────────────┼──────────────────────────────────────────────────────────┤
│ `editorStore`    │ Canvas interaction state: selection (`selectedFrameIds`), │
│                  │ crop editing mode, text inline editor, active snap lines,│
│                  │ multi-resize mode, clipboard, group rotation angles.     │
├──────────────────┼──────────────────────────────────────────────────────────┤
│ `photoStore`     │ Library assets: imported photos, folders, album-wide     │
│                  │ usage counts, favorite flags, background import queue    │
│                  │ status, missing photos detection, relink state.          │
├──────────────────┼──────────────────────────────────────────────────────────┤
│ `historyStore`   │ Linear undo/redo stack (max 50 snapshots of `Album`).    │
│                  │ Debounced capture for slider-based adjustments.          │
├──────────────────┼──────────────────────────────────────────────────────────┤
│ `appStore`       │ Global application state: active modals (Settings, About,│
│                  │ Support, Update), user preferences, update download state│
└──────────────────┴──────────────────────────────────────────────────────────┘
```

### 4.1 Persistence Queue & Store Synchronization

To prevent race conditions during rapid user edits (e.g. keyboard nudging, slider scrubbing, snapping adjustments), `src/stores/albumStore.ts` routes all native SQLite persistence calls through a promise sequence:

```typescript
let databaseWriteQueue: Promise<unknown> = Promise.resolve();
export function persistInOrder<T>(write: () => Promise<T>): Promise<T> {
  const result = databaseWriteQueue.then(write, write);
  databaseWriteQueue = result.catch(() => false);
  return result;
}
```

Edits immediately update the in-memory Zustand store and trigger Konva canvas rerenders synchronously at 60 FPS, while SQLite serialization executes safely in background sequence.

---

## 5. Canvas Coordinate Systems & Spatial Transformation Pipeline

AFSNSmartAlbum maintains four distinct coordinate reference systems. Mixing coordinate spaces without conversion is strictly disallowed by the domain architecture.

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ 1. Physical Canvas Coordinates (Spread Physical Space)                    │
│    Units: mm | cm | inch | px                                             │
│    Defined by: Project settings (e.g., 600mm x 300mm Spread at 300 DPI)   │
│    Stored in: `AlbumElement.x, y, width, height, borderWidth`             │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
               `calculateSpreadViewport` & `calculatePasteboardViewport`
               in `src/domain/viewport.ts`
                                      │
┌─────────────────────────────────────▼─────────────────────────────────────┐
│ 2. Logical Editor Screen Coordinates (Konva Viewport Space)               │
│    Units: Screen Display Pixels                                           │
│    Calculated by: `physical_value * scaleFactor`                          │
│    Interactive features: Drag handles, Transformers, HUD guidelines      │
└───────────────────────────────────────────────────────────────────────────┘
                                      │
               Crop Pan & Zoom Calculations in `src/domain/editor.ts`
                                      │
┌─────────────────────────────────────▼─────────────────────────────────────┐
│ 3. In-Frame Normalized Crop Coordinates (UV Texture Space)                │
│    Pan Offset: `cropX, cropY` normalized in range [-1.0 ... 1.0]          │
│    Zoom Scale: `cropScale` >= 1.0 (clamped up to 3.5x maximum)            │
│    Rotation: `cropRotation` (0° to 360°)                                  │
│    Derived image bounds: `calculateImageOffset(...)`                      │
└───────────────────────────────────────────────────────────────────────────┘
                                      │
               `calculate_export_scale` in `src-tauri/src/export_engine`
                                      │
┌─────────────────────────────────────▼─────────────────────────────────────┐
│ 4. Print Export Coordinates (Device Print Pixels)                         │
│    Scale: `export_dpi / 25.4` (for mm) or `export_dpi` (for inches)       │
│    Full spread at 300 DPI: e.g. 600mm -> 7087 pixels wide                  │
│    Rendered by: Rust `export_engine` onto RGBA bitmap buffers             │
└───────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Dual Entity Frame Invariant

Every photo frame on a spread is modeled as two decoupled coordinate entities:

1. **Frame Window Geometry**: Outer boundary position $(x, y)$, dimensions $(w, h)$, rotation $(\theta)$, and corner radii on the spread canvas.
2. **In-Frame Image Transformation**: Inner viewport crop pan offset $(cx, cy)$, crop zoom $(s \ge 1.0)$, and crop rotation inside the frame window.

This separation powers the non-destructive actions:

- **`↺ Reset Ratio`**: Recomputes frame $(w, h)$ to match the original photo asset aspect ratio ($w_{orig} / h_{orig}$) while keeping image crop centered and unaltered.
- **`↺ Reset Crop`**: Resets $(cx, cy) \to (0, 0)$ and $s \to 1.0$, snapping the image to a centered cover fit without altering frame position or dimensions on the spread.

### 5.2 Konva Render Tree Architecture

In `src/features/editor/KonvaEditorCanvas.tsx`, the canvas render tree is structured hierarchically:

- **`Stage`**: Global event listener for stage drag, zoom wheel, marquee selection, and background click deselect.
  - **`Layer`** (Hardware Accelerated):
    - **Spread Paper Sheet**: Background fill, shadow, boundary stroke.
    - **Guidelines & Crease**:
      - Gutter Crease (center folding line).
      - Safe Margin Guides (dashed blue inward boundaries, supporting independent top, bottom, outside, and spine margins).
      - Bleed Guides (dashed red outward cut lines).
    - **Elements Container**:
      - **Photo Frame Group**:
        - Clipping path implementing uniform or per-corner rounded radii (`cornerRadiusTl, tr, br, bl`).
        - `KonvaImage` rendering the 1500px preview texture with `calculateImageOffset`.
        - Outline border stroke with project/frame border settings.
      - **Text Node Group**:
        - Text block or rich-text spans rendered via `src/domain/richTextRenderer.ts`.
    - **Interactive HUD Overlays**:
      - `Transformer`: Handles for multi-selection resize and rotation.
      - Magnetic alignment snap guidelines and distance badge labels.

---

## 6. Core Domain Algorithms & Mathematical Models

The application houses advanced geometric engines inside `src/domain/`, completely decoupled from UI rendering.

### 6.1 2D Topological Spatial Neighbor Graph Multi-Resize Engine

*Implementation:* `calculateMultiFrameResize` in `src/domain/editor.ts`.

When a multi-selection of photo frames is resized on canvas, standard linear affine scaling ($\Delta x \cdot s, \Delta y \cdot s$) distorts inter-frame spacing: shrinking frames widens gaps, while enlarging frames crushes gaps. AFSNSmartAlbum implements a **Topological Spatial Neighbor Graph**:

1. **Neighbor Identification**:
   - For every frame $B$, finds its immediate left neighbor $A$ where $A$'s right edge is adjacent to $B$'s left edge, requiring orthogonal projection overlap ($\Delta y = \min(y_{A2}, y_{B2}) - \max(y_{A1}, y_{B1}) > 0.5$).
   - Similarly identifies top neighbor $C$ with horizontal overlap ($\Delta x > 0.5$).
2. **Longest Topological Chain Path**:
   - Computes maximum cumulative path gaps along X ($\text{maxPathGapX}$) and Y ($\text{maxPathGapY}$) across all traversal chains.
3. **Pure Dimension Scaling**:
   - Determines frame span: $\text{frameSpanX} = \text{initialWidth} - \text{maxPathGapX}$.
   - Computes uniform scale factor:
     $$s = \frac{\text{newBoundsWidth} - \text{maxPathGapX}}{\text{frameSpanX}}$$
4. **Topological Position Re-Anchoring**:
   - Iterates through frames in topological order (sorted by visual coordinate $x$).
   - If frame has a left neighbor, positions it at:
     $$\text{pos}_{B} = \text{pos}_{A} + (\text{width}_{A} \cdot s) + \text{gap}_{\text{constant}}$$
   - Guarantees **100% preservation of physical inter-frame gaps** across simple rows, 2x2 grids, and complex asymmetrical collages.

### 6.2 Adaptive Layout Bipartite Slot Matching Engine

*Implementation:* `src/domain/adaptiveLayout.ts`.

When cycling spread layouts or applying auto-templates, the layout engine executes:

1. **Geometric Partitioning**: Generates candidate bounding rectangles via Recursive Binary Space Partitioning (BSP) or proportional grid division (`partitionPageBoxIntoKRects`), respecting active margins and project gap spacing.
2. **Orientation Fingerprinting**: Classifies photos into landscape (`L`), portrait (`P`), or square (`S`) to create a layout signature (e.g. `1L+2P`).
3. **Cost Matrix Construction**:
   - Computes crop penalty for photo $p$ in slot $s$:
     $$\text{penalty}(p, s) = 1 - \min\left(\frac{\text{aspect}_p}{\text{aspect}_s}, \frac{\text{aspect}_s}{\text{aspect}_p}\right)$$
   - Weights user star ratings and favorites ($rating \ge 4$ or $isFavorite$) to assign hero photos to the largest slot area with a 30% cost discount.
4. **Optimal Bipartite Assignment**:
   - Evaluates minimal-cost matching (exhaustive permutation for $N \le 7$, greedy heuristic for $N > 7$) to select the layout variation with maximum visual balance.

### 6.3 Smart Magnetic Snapping Engine

*Implementation:* `src/domain/editor.ts` (`calculateSelectionDragSnapping`, `calculateResizeSnapping`).

- Projects candidate snap points (centers, corners, edges) against:
  1. Spread boundaries and spine gutter crease.
  2. Safe margins (top, bottom, outside, spine).
  3. Neighboring frames on the active spread.
  4. Equidistant dynamic gap spacing guides.
- Implements a hysteresis snap threshold (default: 6 logical screen pixels).

---

## 7. Rust Backend Architecture & Threading Model

The Rust backend (`src-tauri/`) handles native operations using safe concurrency abstractions.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONCURRENCY & WORKER GUARDS                         │
├───────────────────┬─────────────────────────────────────────────────────────┤
│ Lock              │ Responsibility                                          │
├───────────────────┼─────────────────────────────────────────────────────────┤
│ `PHOTO_ASSET_JOB` │ Global mutex in `asset_cache.rs`. Synchronizes cache    │
│                   │ measurements, directory purges, and disk operations.    │
├───────────────────┼─────────────────────────────────────────────────────────┤
│ `PROJECT_FILE_JOB`│ Global mutex in `project_commands.rs`. Serializes       │
│                   │ `.afsn` document file identity checks and atomic writes.│
├───────────────────┼─────────────────────────────────────────────────────────┤
│ `ORIGINAL_DECODE` │ Global mutex in `photo_engine/mod.rs`. Restricts raw    │
│                   │ high-resolution camera bitmap decodes to 1 at a time,   │
│                   │ eliminating memory spikes during bulk import.           │
├───────────────────┼─────────────────────────────────────────────────────────┤
│ `Database.conn`   │ `Mutex<Connection>` wrapping SQLite connection,         │
│                   │ ensuring thread-safe transactional execution.           │
└───────────────────┴─────────────────────────────────────────────────────────┘
```

### 7.1 Image Pipeline Engine

*File:* `src-tauri/src/photo_engine/mod.rs`.

*Note on Architecture vs Production:* Early documentation referenced `libvips`. Production uses the pure-Rust `image` crate (v0.25) configured with explicit memory allocation ceilings (`limits.max_alloc = 64MB`) and custom fast headers:

1. **Fast Header Inspection**: Uses `image::image_dimensions` to read dimensions and EXIF metadata without decoding the original bitmap. Enforces a 100 megapixel safety limit.
2. **Instant EXIF Thumbnail Extraction**: Scans the first 128 KB of the file header for `APP1` EXIF data. Directly parses the TIFF `IFD1` JPEG pointer tags (`0x0201` and `0x0202`). If an embedded camera preview exists, decodes only that miniature stream, applies EXIF orientation, and writes the 320px thumbnail immediately without touching the multi-megabyte source image.
3. **Canvas Preview Generation**: Decodes source image through the `ORIGINAL_DECODE` gate, resizes to a maximum 1500px dimension (`imageops::FilterType::Triangle`), and saves an optimized JPEG/PNG canvas preview via an atomic `.tmp` file.

### 7.2 High-Resolution Export Engine

*Files:* `src-tauri/src/export_engine/mod.rs` & `text_rasterizer.rs`.

- **Multi-Threaded Compositor**: Uses Rayon parallel iterators (`par_iter`) across spreads.
- **Color Buffer Compositing**: Allocates an `RgbaImage` for each spread at target DPI. Renders backgrounds, photo layers (applying normalized crop pan, crop zoom, rotation, corner clipping, and opacity), borders, and text overlays.
- **Typography Engine**: Uses `fontdue` (v0.9) to rasterize bundled fonts (`Playfair Display`, `Inter`, `Montserrat`, `Cormorant Garamond`, `Great Vibes`, etc.) and system fonts directly into the RGBA buffer with subpixel positioning and kerning.
- **Print Metadata Injection**:
  - **JPEG**: Injects custom JFIF `APP0` header density bytes (Xdensity, Ydensity) for true 300 DPI print software detection.
  - **PNG**: Injects standard IEEE 802.3 CRC32-validated `pHYs` chunks (pixels per meter).
- **Spread Splitting & Bleed**: Supports splitting double-page spreads into individual left and right page cut files with configurable outward bleed margins.

---

## 8. Persistence Architecture & Crash Resilience

The project implements a resilient multi-tier persistence model:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                            SAVE PIPELINE LAYERS                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ 1. In-Memory Store (Zustand)                                                 │
│    Active edits update immediately (60 FPS UI).                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ 2. Browser LocalStorage Snapshot                                             │
│    Automatic JSON snapshot (`afsn_snapshot_{projectId}`) updated on change   │
│    for instant crash recovery if process terminates unexpectedly.            │
├──────────────────────────────────────────────────────────────────────────────┤
│ 3. Local SQLite Embedded DB (`afsn_smart_album.db`)                          │
│    Transactional ACID checkpoint via `save_album_structure`.                 │
│    Serialized via `persistInOrder`.                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│ 4. Native Document Publication (`.afsn`)                                     │
│    Staged atomic write: Writes to adjacent `.afsn-{uuid}.tmp`, flushes,      │
│    syncs to disk (`sync_all()`), and renames over destination.               │
│    Enforces ownership validation via `project_file_identity`.                │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 8.1 SQLite Schema & Versioning

Embedded database schema is tracked in `schema_version` table (Version 15):

- `projects`: Canvas dimensions, DPI, units, spacing, margins (top, bottom, outside, spine), borders, backgrounds, and file binding.
- `photos`: Photo file records, dimensions, format, thumbnail/preview cache paths, favorite/used counters, missing status.
- `photo_folders` & `photo_folder_members`: Folder collections and photo associations.
- `album_spreads`: Spread geometry, spread-specific safe margins, spacing, and left/right page associations.
- `spread_elements`: Elements on spread, positioning, crops, rotations, corner radii, opacity, lock status, and rich text payloads.
- `project_file_identity`: Maps local `project_id` to on-disk `document_id` to prevent cross-project destination hijacking.

### 8.2 The `.afsn` File Format

The `.afsn` document format is a portable, human-readable UTF-8 JSON file (Payload Version 1). It encapsulates complete project settings, photo metadata references, folder collections, and spread layouts. It **never** embeds raw photo binaries, keeping files lightweight and portable.

Transport packages (`.zip`) bundle `project.afsn` alongside a `photos/` directory. By architectural invariant, ZIP packages must be extracted before editing to ensure atomic writes never overwrite archives.

---

## 9. Security & Sandboxing Architecture

- **Principle of Least Privilege**: Filesystem read access is strictly scoped via Tauri 2 security configurations (`src-tauri/capabilities/default.json`).
- **Asset Protocol Isolation**: Local photo assets are served to the webview through Tauri's registered custom asset protocol (`convertFileSrc`), preventing direct `file://` protocol vulnerabilities.
- **Cache Path Sanitization**: Cache identifiers are strictly validated (`asset_cache::validate_cache_id`) ensuring IDs contain only alphanumeric characters, dashes, and underscores, preventing directory traversal attacks.
- **Symlink & Junction Guards**: The cache manager explicitly rejects symbolic links and Windows reparse junctions to protect system directories from unintended deletion during cleanup jobs.

---

## 10. Architectural Invariants Checklist

When extending or modifying the codebase, the following invariants **must never be violated**:

1. **No Original Image Bitmaps in SQLite or Canvas Memory**: Full-resolution originals must only be read during initial thumbnail generation and final export compositing.
2. **Topological Graph Gap Preservation**: Multi-frame resizing must use `calculateMultiFrameResize` to maintain physical inter-frame gaps.
3. **No Direct ZIP Editing**: `.zip` files are transport packages only; editing operates exclusively on `.afsn` documents.
4. **Standard English UI**: All user-facing controls, menus, snapping HUD badges, and dialogs must adhere to standard professional desktop English (matching Pixellu SmartAlbums and Adobe InDesign).
5. **Completely Local & Offline**: No network APIs, external telemetry, or cloud database dependencies may be introduced.
