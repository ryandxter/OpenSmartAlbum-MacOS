---
last_mapped_commit: a7d32d2e29106b6263ac48059f328f6de747f7b8
last_mapped_at: 2026-09-21
---
# AFSNSmartAlbum — Codebase Structure & Directory Layout

**Analysis Date:** 2026-09-21  
**Target Platform:** Desktop (macOS, Windows, Linux)  
**Frameworks:** React 18, TypeScript 5.6, Tauri 2.11, Rust (2021 Edition), Konva.js 9

---

## 1. Directory Tree Layout

```text
albumaker/
├── .agents/                        # Specialized agent skills and workflow definitions
│   └── skills/                     # Domain-specific developer skills (ui-design, album-domain, etc.)
├── .github/                        # GitHub Actions CI/CD workflows
├── .planning/                      # Technical plans, roadmap status, and architecture mapping
│   └── codebase/                   # Comprehensive codebase architecture & structure docs
├── public/                         # Static assets served directly by Vite
├── scripts/                        # Automation & release helper scripts
├── src/                            # Frontend application source code (React + TypeScript)
│   ├── assets/                     # Packaged static image assets (logos, welcome artwork, QRIS)
│   ├── components/                 # Shared, atomic UI components and primitives
│   │   ├── ui/                     # Reusable design system controls (Button, Dialog, Select, etc.)
│   │   └── ErrorBoundary.tsx       # Root error boundary catching runtime React render crashes
│   ├── config/                     # Application metadata, licensing, and environment settings
│   │   └── app.ts                  # App configuration constants & third-party open-source credits
│   ├── domain/                     # Pure business logic, mathematics, models, and layout engines
│   │   ├── adaptiveLayout.ts       # Bipartite slot matching, BSP partitioning, layout cycling
│   │   ├── album.ts                # Spread and Page models, element merging, structure helpers
│   │   ├── appPreferences.ts       # User preference schema (autoSave, grid units, startup)
│   │   ├── bundledFonts.ts         # Typography font family definitions and weight metadata
│   │   ├── editor.ts               # Snapping math, multi-resize graph, crop bounds, alignments
│   │   ├── photo.ts                # Photo metadata models, filters, sorting, toast formatting
│   │   ├── photoPlacement.ts       # Batch photo placement grid calculations on canvas
│   │   ├── photoRemoval.ts         # Photo deletion and unlinking business logic
│   │   ├── presets.ts              # Preset album dimension configurations (Square, Landscape, etc.)
│   │   ├── previewGeometry.ts      # Geometry projection for spread preview thumbnails
│   │   ├── project.ts              # Project data models, validation, and defaults
│   │   ├── richTextParser.ts       # BBCode/markdown rich text token parser
│   │   ├── richTextRenderer.ts     # Rich text layout generator with line breaking and metrics
│   │   ├── styledRanges.ts         # Span-level text formatting ranges (font, color, decoration)
│   │   ├── templates.ts            # Classical template bounding boxes and usable area math
│   │   ├── text.ts                 # Text style presets, typography data structures, frame fitters
│   │   ├── units.ts                # Physical unit conversions (mm, cm, inch, pt, px at target DPI)
│   │   └── viewport.ts             # Screen-to-spread viewport math and pasteboard boundaries
│   ├── features/                   # Feature-sliced modules and panels
│   │   ├── about/                  # About dialog and system diagnostic information
│   │   ├── album/                  # Page navigator, spread switcher, album structure panels
│   │   ├── editor/                 # Konva canvas viewport, frame toolbar, typography, inline editor
│   │   ├── export/                 # High-resolution export dialog, progress modal, spread preview
│   │   ├── persistence/            # Autosave hooks and localStorage crash recovery protection
│   │   ├── photos/                 # Filmstrip tray, folder tabs, batch action bar, relink modal
│   │   ├── project/                # New project creation wizard and preset selector
│   │   ├── settings/               # Application preferences and settings configuration
│   │   ├── support/                # Creator support modal (QRIS donation banner)
│   │   ├── templates/              # Layout template picker panel
│   │   ├── updates/                # Background updater notifications and update download modal
│   │   └── workspace/              # Root workspace docked shell, welcome screen, exit guard
│   ├── hooks/                      # Custom shared React hooks
│   │   └── useTauriInfo.ts         # Runtime detection of Tauri desktop environment vs browser
│   ├── services/                   # Desktop integration services
│   │   └── updateService.ts        # Tauri Updater integration and version checking
│   ├── stores/                     # Zustand state management stores
│   │   ├── albumStore.ts           # Spreads, pages, layout persistence queue, guide toggles
│   │   ├── appStore.ts             # Modals, user preferences, update state
│   │   ├── editorStore.ts          # Canvas selection, interactive transforms, snapping state
│   │   ├── historyStore.ts         # Undo/redo stack and linear history transitions
│   │   ├── photoStore.ts           # Library assets, folder collections, import queue
│   │   └── projectStore.ts         # Active project settings, recent projects, file I/O operations
│   ├── styles/                     # Global styling and CSS design tokens
│   │   ├── design-tokens.css       # Central CSS variables (colors, typography, spacing, shadows)
│   │   ├── global.css              # Global baseline typography, scrollbars, and canvas styles
│   │   ├── reset.css               # Modern CSS box-sizing reset
│   │   └── tokens.css              # Legacy token aliases
│   ├── utils/                      # Cross-platform utility functions
│   │   └── platform.ts             # OS detection (macOS / Windows / Linux) and modifier keys
│   ├── App.tsx                     # Top-level React application root & startup routing
│   ├── main.tsx                    # React DOM mount entry point
│   └── vite-env.d.ts               # Vite TypeScript definitions
├── src-tauri/                      # Rust native desktop core (Tauri 2)
│   ├── capabilities/               # Tauri 2 permission sets
│   │   └── default.json            # Core capabilities (core, shell, os, dialog, updater)
│   ├── icons/                      # Multi-resolution application icons (.icns, .ico, .png)
│   ├── src/                        # Rust source code
│   │   ├── commands/               # Tauri IPC command entry points
│   │   │   ├── app_commands.rs     # Diagnostics, system info, exit guard, screen color picker
│   │   │   ├── export_commands.rs  # High-res export orchestration, preflight, cancel
│   │   │   ├── mod.rs              # Commands module declaration
│   │   │   ├── photo_commands.rs   # Photo file dialogs, background import pool, folder CRUD
│   │   │   └── project_commands.rs # Project CRUD, spacing/margin persistence, package IO
│   │   ├── db/                     # Embedded SQLite database and file serialization
│   │   │   ├── mod.rs              # Database connection, schema migrations (v1 to v15), queries
│   │   │   └── package_io.rs       # Atomic .afsn file publication, identity claim, ZIP packaging
│   │   ├── export_engine/          # High-resolution print compositor and rasterizer
│   │   │   ├── bundled_fonts.rs    # Embedded TrueType/OpenType font bytes
│   │   │   ├── mod.rs              # 300+ DPI compositor, page splitting, bleed, JFIF/pHYs insertion
│   │   │   └── text_rasterizer.rs  # fontdue text layout and RGBA glyph blitting
│   │   ├── photo_engine/           # High-performance image ingestion and derivative engine
│   │   │   └── mod.rs              # EXIF IFD1 thumbnail extraction, 1500px preview pipeline
│   │   ├── asset_cache.rs          # Image cache directory management and orphaned asset cleanup
│   │   ├── lib.rs                  # Tauri builder initialization, plugin registration, invoke handler
│   │   └── main.rs                 # Native binary entry point
│   ├── Cargo.lock                  # Pinned Rust dependencies
│   ├── Cargo.toml                  # Rust package manifest (dependencies, crate settings)
│   └── tauri.conf.json             # Tauri 2 configuration (window size, bundle id, security)
├── tests/                          # Automated test suites (TypeScript via tsx)
│   ├── adaptiveLayout.test.ts      # Bipartite matching, layout variation generation tests
│   ├── album.test.ts               # Spread and page layout invariant tests
│   ├── appPreferences.test.ts      # User preferences persistence tests
│   ├── domain.test.ts              # Physical unit conversions and core domain tests
│   ├── editor.test.ts              # Snapping math, multi-resize graph, crop invariant tests
│   ├── history.test.ts             # Undo/redo stack and snapshot limit tests
│   ├── importQueue.test.ts         # Batch photo ingestion queue tests
│   ├── objectOpacity.test.ts       # Element opacity calculations and legacy compatibility
│   ├── photoBatchPlacement.test.ts # Auto-grid placement geometry tests
│   ├── previewGeometry.test.ts     # Geometry calculations for spread thumbnails
│   ├── projectPersistence.test.ts  # .afsn format validation, atomic write, ownership tests
│   ├── richText.test.ts            # BBCode/markdown parsing tests
│   ├── styledRanges.test.ts        # Span formatting range calculation tests
│   ├── templates.test.ts           # Classical layout template bounds tests
│   ├── text.test.ts                # Typography models and style preset tests
│   ├── textHandling.test.ts        # Text box dimension fitting and line wrapping tests
│   └── updateDownload.test.ts      # Tauri updater mock tests
├── index.html                      # HTML host document
├── package.json                    # Node dependencies, build scripts, version info
├── tsconfig.json                   # TypeScript compiler configuration
└── vite.config.ts                  # Vite bundler configuration
```

---

## 2. Key Locations & Responsibilities

| File Path | Layer | Responsibility | Primary Exports / Handlers |
| :--- | :--- | :--- | :--- |
| `src-tauri/src/lib.rs` | Rust Core | Native application builder, plugin lifecycle, state injection, and invoke router. | `run()` |
| `src-tauri/src/db/mod.rs` | Rust DB | Embedded SQLite connection (`rusqlite`), schema migration runner (v1–v15), project/photo/spread queries. | `Database`, `ProjectRow`, `PhotoRow`, `SpreadPayload`, `ElementPayload` |
| `src-tauri/src/db/package_io.rs` | Rust IO | Staged atomic writing for `.afsn` documents, file identity validation, and bundled `.zip` archive creation. | `export_project_package`, `import_project_package`, `export_bundled_project_package` |
| `src-tauri/src/photo_engine/mod.rs` | Rust Image | Ingestion pipeline: fast dimension probing, EXIF IFD1 header thumbnail extraction, 1500px preview generation. | `extract_photo_metadata`, `extract_embedded_thumbnail`, `generate_photo_preview` |
| `src-tauri/src/export_engine/mod.rs` | Rust Export | High-resolution print compositor (300+ DPI), page splitting, bleed margins, JFIF/pHYs density injection. | `export_album_high_res`, `encode_jpeg_with_dpi`, `calculate_export_scale` |
| `src-tauri/src/export_engine/text_rasterizer.rs` | Rust Export | Subpixel text rasterization using `fontdue 0.9` with kerning and style span formatting. | `rasterize_rich_text_to_rgba` |
| `src/stores/projectStore.ts` | State | Current project metadata, settings, recent projects list, high-level file persistence operations. | `useProjectStore` |
| `src/stores/albumStore.ts` | State | Full album document tree, cover/spread layouts, active spread pointer, guide toggles, serialized SQLite queue. | `useAlbumStore`, `persistInOrder` |
| `src/stores/editorStore.ts` | State | Active canvas selection, transform state, crop edit mode, text editor mode, snapping guidelines, clipboard. | `useEditorStore` |
| `src/stores/photoStore.ts` | State | Photo catalog, folder collections, background import queue, search/sort/filter, relink coordinator. | `usePhotoStore` |
| `src/stores/historyStore.ts` | State | Linear undo/redo stack (50 album snapshots max), debounced history capture for sliders. | `useHistoryStore` |
| `src/stores/appStore.ts` | State | Modals visibility (Settings, About, Support, Update), user preferences, updater download progress. | `useAppStore` |
| `src/domain/editor.ts` | Domain Math | 2D Topological Spatial Neighbor Graph multi-resize engine, magnetic snapping, crop bounds, alignments. | `calculateMultiFrameResize`, `calculateSelectionDragSnapping`, `clampCropTransform` |
| `src/domain/adaptiveLayout.ts` | Domain Math | Bipartite optimal photo-to-slot matching, BSP page partitioning, layout variation cycling. | `findOptimalPhotoSlotMapping`, `generateAdaptiveLayoutVariations`, `partitionPageBoxIntoKRects` |
| `src/domain/viewport.ts` | Domain Math | Coordinate transformation between physical units, screen pixels, and scrollable pasteboard extent. | `calculateSpreadViewport`, `calculatePasteboardViewport`, `screenToSpreadPoint` |
| `src/domain/units.ts` | Domain Math | Unit conversion engine (`mm`, `cm`, `inch`, `pt`, `px`) supporting arbitrary user-defined DPI. | `convertUnit`, `convertPtToUnit`, `formatDimensions` |
| `src/domain/text.ts` | Domain Math | Typography style models, text preset definitions, automatic text frame fitting algorithms. | `DEFAULT_TEXT_STYLE`, `TEXT_PRESETS`, `fitTextFrame` |
| `src/features/workspace/WorkspaceLayout.tsx` | UI Shell | Main docked desktop window (Header, Canvas Viewport, Properties Panel, Filmstrip Tray, Spread Navigator). | `WorkspaceLayout` |
| `src/features/editor/KonvaEditorCanvas.tsx` | Canvas UI | Hardware-accelerated Konva stage, image texture LRU cache, photo frames, text nodes, transform handles, HUD. | `KonvaEditorCanvas` |
| `src/features/photos/FilmstripTray.tsx` | Library UI | Bottom tray containing photo filmstrip cards, folder collection tabs, filters, sorting, and batch actions. | `FilmstripTray` |
| `src/features/export/ExportAlbumDialog.tsx` | Export UI | Print export configuration dialog (DPI, JPEG quality, bleed, page splitting, sharpen, page range). | `ExportAlbumDialog` |
| `src/features/persistence/useAutoSave.ts` | Persistence | Background autosave hook, dirty state tracking, and localStorage crash snapshot manager. | `useAutoSave`, `getCrashSnapshot`, `clearCrashSnapshot` |

---

## 3. Component Hierarchy & Visual Tree

The visual composition of the interface follows a desktop creative workstation hierarchy:

```text
App.tsx
├── ErrorBoundary
├── ExitWarningModal (Close interception)
├── AboutDialog (Modal)
├── SettingsDialog (Modal)
├── NewProjectDialog (Modal)
├── SupportDonationModal (Modal)
├── UpdateModal (Modal)
├── BackgroundUpdateIndicator (Floating pill)
└── WorkspaceLayout
    ├── Top App Header
    │   ├── Brand & Project Title (Inline rename)
    │   ├── Dimension & DPI Badge
    │   ├── Quick Action Buttons (Save, Undo, Redo, Export)
    │   └── Menu Buttons (File Menu, Preferences, About)
    ├── Center Work Area (Split Pane)
    │   ├── Center Canvas Viewport
    │   │   ├── Floating Top Toolbar (Zoom In/Out, Fit-to-Screen, Hand/Select Tool, Snap Toggle)
    │   │   ├── KonvaEditorCanvas (React-Konva Stage)
    │   │   │   └── Layer
    │   │   │       ├── Spread Paper Sheet (Background, Shadow, Spine Crease)
    │   │   │       ├── Guide Overlays (Safe Margins, Bleed Cut Lines)
    │   │   │       ├── PhotoFrameNode []
    │   │   │       │   ├── Konva Group (Position, Rotation, Opacity, Rounded Clip Path)
    │   │   │       │   ├── KonvaImage (Preview Texture, Crop Pan/Zoom Matrix)
    │   │   │       │   └── Rect (Border Stroke)
    │   │   │       ├── TextNode []
    │   │   │       │   ├── Konva Group (Position, Rotation, Opacity)
    │   │   │       │   └── RichTextRenderer / KonvaText Spans
    │   │   │       ├── Transformer (Interactive Resize/Rotation Handles)
    │   │   │       └── Snapping Guidelines & Distance Badges
    │   │   ├── FrameToolbar (Floating HUD above selected frame: Reset Ratio, Reset Crop, Opacity, Lock)
    │   │   ├── TextInlineEditor (HTML overlay for rich text editing when double-clicked)
    │   │   └── LayoutCycleHUD (Cycling badge when pressing Spacebar to change layout)
    │   └── Right Properties Inspector (Collapsible Panel)
    │       ├── Tab Bar (Properties | Smart Layout | Locks)
    │       ├── Properties Tab:
    │       │   ├── Frame Geometry (Position X/Y, Width, Height, Rotation, Aspect Lock)
    │       │   ├── Corner Radii (Uniform or Individual Per-Corner TL/TR/BR/BL)
    │       │   ├── Border Styling (Toggle, Width, Color Picker)
    │       │   ├── OpacityControl (Slider 0–100%)
    │       │   ├── Spacing & Gap (Project Default Gap, Custom Gap, Apply Gap H/V)
    │       │   ├── Margins & Safe Guides (Top, Bottom, Outside, Spine)
    │       │   ├── Spread Background Color (Spread, Left Page, Right Page scope)
    │       │   └── Multi-Selection Alignment (Left, Center, Right, Top, Middle, Bottom, Distribute)
    │       ├── Smart Layout Tab:
    │       │   └── TemplatesPanel (Layout variations, auto-partitioning presets)
    │       └── Locks Tab:
    │           └── LockedPhotosPanel (Overview and unlock controls for locked frames)
    ├── Photo Filmstrip Tray (Bottom Collapsible Dock)
    │   ├── Tray Header Bar:
    │   │   ├── FolderTabs (All Photos, User Collections, Add Collection)
    │   │   ├── Search Input & Filter (All, Unused, Used, Favorites)
    │   │   ├── Sort Dropdown (Name, Date, Size)
    │   │   └── Import Buttons (+ Add Photos, + Add Folder)
    │   ├── BatchActionBar (Appears when 2+ photos selected: Favorite, Add to Folder, Delete)
    │   ├── Filmstrip Photo Grid (Virtual scroll of photo cards):
    │   │   └── PhotoCard (Thumbnail, Filename, Used Count Badge, Favorite Star, Missing Flag)
    │   └── PhotoContextMenu (Right-click menu: Reveal on Canvas, Add to Spread, Relink, Delete)
    └── Bottom Spread Navigator Bar
        ├── Spreads Drawer Toggle
        ├── Previous Spread Button
        ├── Spread Thumbnail Carousel (Miniature spread previews)
        ├── Jump Selector (Spread Index / Total Spreads)
        ├── Next Spread Button
        └── + Add Spread / Duplicate Spread Controls
```

---

## 4. Key Data Flows & Cross-Cutting Interactions

### 4.1 Photo Import Workflow

```text
[User clicks "Add Photos" or "Add Folder"]
       │
       ▼
`photo_commands::select_and_import_files` (Rust)
       │  ├── Spawns native OS picker (`rfd`)
       │  └── Captures candidate image paths
       ▼
`photo_engine::scan_directory` & `extract_photo_metadata`
       │  ├── Inspects header dimensions without full bitmap decode
       │  └── Scans EXIF IFD1 header (first 128KB) for instant camera thumbnails
       ▼
Database Transaction (`db.insert_photos`)
       │  └── Writes photo rows to SQLite (is_missing = 0, used_count = 0)
       ▼
Emits Tauri Event: `import-progress` & `photo-preview-ready`
       │
       ▼
`usePhotoStore.setupListeners` (Frontend)
       │  ├── Ingests photo records into memory
       │  └── Updates Filmstrip thumbnails instantly
       ▼
Background Thread Pool (Rayon)
       └── Generates 1500px canvas preview JPEG in `.tmp` file and commits to cache
```

### 4.2 Canvas Placement & Drag-and-Drop Workflow

```text
[User drags photo from Filmstrip Tray onto Konva Canvas]
       │
       ▼
`KonvaEditorCanvas.handleDrop`
       │  ├── Computes screen-to-spread physical coordinates (`screenToSpreadPoint`)
       │  └── Detects drop target:
       │       ├── Case A: Dropped over empty canvas space
       │       │    └── `editorStore.addPhotoToSpread` (Creates new PhotoFrameElement)
       │       └── Case B: Dropped over existing photo frame
       │            └── `photoSwapDrag.ts` (Swaps photo references or replaces frame content)
       ▼
`albumStore.updateSpreadElements`
       │  ├── Updates spread element array in in-memory store (triggers 60 FPS re-render)
       │  └── Enqueues native update into `persistInOrder`
       ▼
Rust SQLite DB: Transaction commits element changes to `spread_elements`
```

### 4.3 Multi-Frame Topological Resize Workflow

```text
[User selects 3 frames and drags Transformer bottom-right corner]
       │
       ▼
`KonvaEditorCanvas.onTransform`
       │
       ▼
`calculateMultiFrameResize` (`src/domain/editor.ts`)
       │  ├── Step 1: Builds 2D Spatial Neighbor Graph from visual bounds
       │  │           (Detects horizontal & vertical overlaps among frames)
       │  ├── Step 2: Calculates longest path gaps along X and Y axes
       │  ├── Step 3: Computes pure dimension scale factor for photo frames
       │  └── Step 4: Re-anchors frame coordinates topologically:
       │              pos_target = pos_anchor + (dim_prev * scale) + constant_gap
       ▼
`editorStore.batchUpdateFrames`
       │  └── Updates frame positions and dimensions simultaneously
       ▼
`KonvaEditorCanvas` updates Transformer bounding box and draws canvas frames
(100% of inter-frame gap distances are physically preserved)
```

### 4.4 Save & Autosave Workflow

```text
[Ctrl+S / Autosave Timer Triggered]
       │
       ▼
`useProjectStore.saveProject`
       │  ├── Checks if current project has bound `filePath`
       │  │    ├── If null: Opens native Save Dialog to select `.afsn` destination
       │  │    └── If bound: Proceeds to atomic write
       │  ▼
Tauri IPC: `project_commands::export_afsn_package`
       │
       ▼
`db/package_io.rs::write_project_package`
       │  ├── 1. Validates destination extension is `.afsn`
       │  ├── 2. Takes `PROJECT_FILE_JOB` synchronization mutex
       │  ├── 3. Validates file ownership against `project_file_identity` table
       │  ├── 4. Writes JSON payload to adjacent `.afsn-{uuid}.tmp` file
       │  ├── 5. Flushes and syncs file to disk (`sync_all()`)
       │  ├── 6. Atomically renames temporary file over destination
       │  └── 7. Updates `file_path` and `updated_at` in SQLite transaction
       ▼
Frontend `useAlbumStore.setSaveStatus('saved')`
       └── Clears dirty flag in `localStorage.afsn_dirty_{projectId}`
```

### 4.5 High-Resolution Print Export Workflow

```text
[User opens Export Dialog and clicks "Export Album"]
       │
       ▼
`export_commands::preflight_check_export` (Rust)
       │  ├── Checks for missing photo original source files
       │  └── Warns if any low-resolution images will drop below 150 effective DPI
       ▼
`export_commands::export_album_high_res`
       │  ├── Computes export scale: `calculate_export_scale(unit, base_dpi, target_dpi)`
       │  │    (e.g., 300 DPI for 300mm x 300mm = 3543 x 3543 pixels per page)
       │  ▼
Rayon Parallel Thread Pool
       │  ├── Spawns worker per spread
       │  ├── Composites solid/gradient background
       │  ├── Reads original high-resolution photo from disk
       │  ├── Decodes, crops, rotates, applies corner radii, and composites onto RGBA buffer
       │  ├── Renders rich text using `fontdue` text rasterizer
       │  ├── If `split_pages` enabled: Splits spread into Left and Right page cut images
       │  └── If `include_bleed` enabled: Expands boundary cut lines
       ▼
Metadata Insertion & Encoding
       │  ├── JPEG: Injects JFIF APP0 density header (300 DPI density markers)
       │  └── PNG: Injects pHYs chunk with CRC32 checksum
       ▼
Writes final print files into selected output directory
Emits `export-progress` events updating frontend `ExportProgressModal.tsx`
```

---

## 5. Coding & Naming Conventions

### 5.1 TypeScript & React Conventions

- **Component File Names**: PascalCase (e.g. `KonvaEditorCanvas.tsx`, `FilmstripTray.tsx`, `ConfirmDialog.tsx`).
- **CSS Modules**: Colocated with matching PascalCase name and `.module.css` extension (e.g. `KonvaEditorCanvas.module.css`).
- **Domain & Utility Files**: camelCase (e.g. `adaptiveLayout.ts`, `photoPlacement.ts`, `viewport.ts`, `units.ts`).
- **Zustand Store Files**: camelCase with `Store` suffix (e.g. `albumStore.ts`, `projectStore.ts`, `editorStore.ts`).
- **Interface & Type Declarations**: PascalCase (e.g. `PhotoFrameElement`, `TextNodeElement`, `Spread`, `Page`, `Unit`).
- **Pure Functions**: Business algorithms in `src/domain/` must remain pure functions without DOM access, Tauri dependencies, or store side-effects, ensuring complete testability in isolation.

### 5.2 Rust Backend Conventions

- **Modules & File Names**: snake_case (e.g. `photo_commands.rs`, `export_engine/text_rasterizer.rs`, `package_io.rs`).
- **Structs & Enums**: PascalCase with Serde camelCase rename attribute for frontend parity:
  ```rust
  #[derive(Debug, Clone, Serialize, Deserialize)]
  #[serde(rename_all = "camelCase")]
  pub struct SpreadPayload { ... }
  ```
- **Tauri IPC Command Names**: snake_case matching invoke handlers (e.g. `save_album_structure`, `export_album_high_res`, `select_and_import_files`).
- **Concurrency Locks**: UPPER_SNAKE_CASE static mutexes (e.g. `PHOTO_ASSET_JOB`, `PROJECT_FILE_JOB`, `ORIGINAL_DECODE`).

### 5.3 Domain Terminology Invariants

To maintain consistency across UI panels, code symbols, database columns, and documentation, strict terminology rules apply:

- **`Spread` vs `Page`**: An album is composed of **Spreads**. A spread contains a `leftPage`, an optional center `gutterWidth` (spine crease), and a `rightPage`. Individual page numberings are derived.
- **`Safe Margin` vs `Bleed` vs `Spine`**:
  - `Safe Margin` (`safeArea` / `safeAreaTop, bottom, outside, spine`): Inward safety boundary (blue guide) inside which all essential subject matter must remain.
  - `Bleed` (`bleed`): Outward margin (red guide) trimmed during bookbinding.
  - `Spine / Gutter`: The center folding crease between facing pages.
- **`↺ Reset Ratio` vs `↺ Reset Crop`**:
  - `↺ Reset Ratio`: Restores outer frame dimensions $(w, h)$ to match the original photo's native aspect ratio (3:2, 4:3) without modifying internal crop coordinates.
  - `↺ Reset Crop`: Re-centers the image inside the frame window and resets zoom scale to 1.0x without modifying frame position or dimensions.
