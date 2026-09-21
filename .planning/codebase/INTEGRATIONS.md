---
last_mapped_commit: a7d32d2e29106b6263ac48059f328f6de747f7b8
last_mapped_at: 2026-09-21
---
# AFSNSmartAlbum — System Integrations & Native Bridges

**Analysis Date:** 2026-09-21  
**Target Platform:** Windows x64 (Primary), macOS, Linux (Desktop)  
**Architecture:** Tauri 2 Native IPC Bridges, Embedded SQLite Engine, Progressive Image Pipeline, OS Bindings  
**Current Software Version:** `v1.0.77`

---

## 1. Executive Integration Architecture

AFSNSmartAlbum operates as a zero-cloud, strictly local-first desktop application. Its integration topology centers around:

1. **Tauri 2 Inter-Process Communication (IPC):** Asynchronous remote procedure calls (`invoke`) and bi-directional reactive event streams (`emit` / `listen`) bridging the React/Konva frontend and the Rust backend.
2. **Embedded Relational Persistence (SQLite via `rusqlite`):** Statically compiled SQLite database utilizing Write-Ahead Logging (`WAL`) mode, foreign key cascades, and 15 versioned schema migrations.
3. **Atomic Document Packaging (`.afsn` & `.zip`):** Custom document serialization with atomic rename staging, document ownership validation, and self-contained zip archives.
4. **Progressive Image & Asset Pipeline:** Multi-tier image extraction (embedded EXIF IFD1 thumbnail -> 1500px preview -> 320px thumbnail) served through the secure Tauri asset protocol (`$APPCACHE`) with strict concurrency and memory guards.
5. **Native Typography & High-Res Export Engine:** `fontdue` glyph rasterization, Win32 registry font discovery, two-pass rendering (photo layout -> print sharpening -> crisp text compositing), and zero-dependency PDF-1.4 generation.
6. **Native OS Hardware & Desktop Bridges:** Win32 GDI screen color sampling, Rusty File Dialogs (`rfd`), and NSIS shell integrations.
7. **Dual-Flow Auto-Update Engine:** Minisign cryptographically verified in-app updates via Tauri updater plugin with GitHub REST API fallback.

---

## 2. Tauri 2 IPC Command Catalog

All native backend capabilities are exposed to the frontend through strongly-typed Tauri 2 commands registered in `src-tauri/src/lib.rs` and dispatched via `@tauri-apps/api/core`.

### 2.1 Application Commands (`src-tauri/src/commands/app_commands.rs`)

| Command Name | Parameters | Return Type | Architectural Purpose |
|---|---|---|---|
| `get_app_info` | _None_ | `AppInfo` | Retrieves software version (`CARGO_PKG_VERSION`), platform OS name, and active SQLite schema version. |
| `get_db_status` | _None_ | `DbStatus` | Checks database connectivity, active schema version, and expected schema version (`15`). |
| `get_photo_cache_stats` | _None_ | `PhotoCacheStats` | Computes disk space utilization and file counts for `$APPCACHE/thumbnails` and `$APPCACHE/previews`. |
| `clean_unused_photo_cache`| _None_ | `CacheCleanupReport` | Purges orphaned preview/thumbnail files on disk not linked to any photo in the active SQLite database. |
| `restart_app` | _None_ | `()` | Gracefully restarts the application binary (invoked after successfully applying a software update). |
| `exit_app` | _None_ | `()` | Forcefully terminates the process runtime without prompting (used after user confirmation). |
| `set_unsaved_status` | `unsaved: bool` | `()` | Synchronizes frontend dirty/unsaved state to Rust `AppExitState` atomic boolean. |
| `sample_screen_color` | `x?: i32, y?: i32` | `String` (Hex `#RRGGBB`) | Direct Win32 GDI pixel sampling from screen DC at cursor or specified coordinates. |
| `get_system_fonts` | _None_ | `Vec<SystemFontInfo>` | Scans Windows Registry (`HKLM` & `HKCU`) for installed TrueType and OpenType font families. |

### 2.2 Project Management Commands (`src-tauri/src/commands/project_commands.rs`)

| Command Name | Parameters | Return Type | Architectural Purpose |
|---|---|---|---|
| `get_initial_open_path` | _None_ | `Option<String>` | Consumes any file path passed via command line arguments upon cold start. |
| `create_project` | `request: CreateProjectPayload` | `ProjectRow` | Initializes a new project record in SQLite with configured canvas dimensions, units, DPI, and defaults. |
| `get_project` | `id: String` | `Option<ProjectRow>` | Loads a project record by ID. |
| `list_recent_projects` | `limit: i64` | `Vec<ProjectRow>` | Lists projects ordered by `updated_at DESC`. |
| `delete_project` | `id: String` | `()` | Cascades deletion of a project, its spreads, elements, photos, and folder memberships. |
| `clear_recent_projects` | _None_ | `()` | Clears project records from SQLite. |
| `update_project_spacing` | `id: String, spacingValue: f64, spacingUnit: String` | `ProjectRow` | Updates default spacing between frames. |
| `update_project_margins` | `id: String, marginEnabled: bool, marginValue: f64, marginUnit: String, marginTop?: f64, marginBottom?: f64, marginOutside?: f64, marginSpine?: f64` | `ProjectRow` | Updates independent 4-side spread margins. |
| `update_project_name` | `id: String, name: String` | `ProjectRow` | Renames project in SQLite. |
| `update_project_name_and_path` | `id: String, name: String, filePath: String` | `ProjectRow` | Updates project name and associated file destination atomically. |
| `save_album_structure` | `album: AlbumPayload` | `()` | Serializes full album layout (spreads, pages, frames, text nodes) into SQLite relational tables. |
| `load_album_structure` | `projectId: String` | `Option<AlbumPayload>` | Reconstructs the complete album layout graph from SQLite for editor canvas loading. |
| `export_afsn_package` | `projectId: String, targetPath: String` | `()` | Serializes project to standalone `.afsn` JSON file with atomic staging. |
| `import_afsn_package` | `sourcePath: String` | `ProjectPackagePayload` | Parses an external `.afsn` document and re-hydrates project into SQLite. |
| `export_afsn_with_dialog` | `projectId: String, suggestedName?: String` | `Option<String>` | Opens native save dialog (`rfd`) to export `.afsn` project file. |
| `save_project_as_with_dialog`| `projectId: String, suggestedName?: String` | `Option<ProjectRow>` | Executes "Save As" flow: prompts user for destination, writes `.afsn`, and updates project file identity. |
| `export_bundled_package_with_dialog` | `projectId: String, suggestedName?: String` | `Option<String>` | Opens save dialog and creates complete `.zip` archive containing `project.afsn` and photo assets. |
| `import_afsn_with_dialog` | _None_ | `Option<ProjectPackagePayload>` | Opens file picker (`rfd`) to select and import `.afsn` project. |
| `duplicate_project` | `projectId: String, newName: String` | `ProjectRow` | Clones a project and its entire layout structure with freshly minted UUIDs. |
| `check_path_exists` | `path: String` | `bool` | Checks filesystem existence of a given file or directory path. |

### 2.3 Photo Ingestion & Library Commands (`src-tauri/src/commands/photo_commands.rs`)

| Command Name | Parameters | Return Type | Architectural Purpose |
|---|---|---|---|
| `select_and_import_files` | `projectId: String, folderId?: String` | `Vec<PhotoRow>` | Opens multi-file picker, registers photos in SQLite, and triggers background derivative generation. |
| `select_and_import_folder` | `projectId: String, folderId?: String` | `Vec<PhotoRow>` | Opens folder picker, recursively scans supported images, and begins batch ingestion. |
| `pick_photo_files_dialog` | _None_ | `Option<Vec<String>>` | Opens native file dialog filtered to supported image extensions (`jpg`, `png`, `webp`, `bmp`, `tiff`). |
| `pick_photo_folder_dialog`| _None_ | `Option<String>` | Opens native folder picker dialog. |
| `import_file_paths` | `projectId: String, paths: Vec<String>, folderId?: String` | `Vec<PhotoRow>` | Ingests explicit array of file paths into project library. |
| `get_project_photos` | `projectId: String` | `Vec<PhotoRow>` | Fetches all photo records belonging to a project. |
| `generate_missing_previews`| `projectId: String` | `Vec<PhotoRow>` | Background worker repairing missing thumbnails/previews. |
| `toggle_photo_favorite` | `photoId: String` | `PhotoRow` | Toggles favorite status in SQLite. |
| `remove_photo` | `projectId: String, photoId: String` | `()` | Removes a single photo record and purges cached assets. |
| `check_missing_photos` | `projectId: String` | `Vec<PhotoRow>` | Checks filesystem availability of source image paths; marks missing photos in SQLite. |
| `regenerate_single_thumbnail` | `photoId: String` | `PhotoRow` | Re-decodes source image and regenerates derivatives for one item. |
| `relink_photo` | `projectId: String, photoId: String` | `Option<PhotoRow>` | Prompts user to relocate a missing image file. |
| `relink_folder` | `projectId: String` | `RelinkResult` | Scans a newly designated directory to auto-relink missing project photos by file name. |
| `cancel_photo_import` | _None_ | `()` | Sets atomic cancellation flag for running import workers. |
| `batch_delete_photos` | `projectId: String, photoIds: Vec<String>` | `PhotoRemovalResult` | Batch deletion of photo records and associated cache files. |
| `batch_toggle_favorites` | `projectId: String, photoIds: Vec<String>, favorite: bool` | `Vec<PhotoRow>` | Batch update of favorite flags. |
| `create_photo_folder` | `projectId: String, name: String` | `PhotoFolderRow` | Creates a new organization folder. |
| `get_photo_folders` | `projectId: String` | `Vec<PhotoFolderRow>` | Lists all photo folders for a project with photo counts. |
| `rename_photo_folder` | `folderId: String, name: String` | `PhotoFolderRow` | Renames an organization folder. |
| `delete_photo_folder` | `folderId: String` | `()` | Deletes folder; photos remain safely in the general project pool. |
| `add_photos_to_folder` | `folderId: String, photoIds: Vec<String>` | `()` | Links photos to folder via `photo_folder_members`. |
| `remove_photos_from_folder`| `folderId: String, photoIds: Vec<String>` | `()` | Unlinks photos from folder. |
| `move_photos_between_folders` | `sourceId: String, targetId: String, photoIds: Vec<String>` | `()` | Atomic reassignment of photos between folders. |
| `get_photos_for_folder` | `folderId: String` | `Vec<PhotoRow>` | Retrieves photo records assigned to a specific folder. |

### 2.4 High-Res Export Commands (`src-tauri/src/commands/export_commands.rs`)

| Command Name | Parameters | Return Type | Architectural Purpose |
|---|---|---|---|
| `export_album_high_res` | `options: ExportOptions` | `ExportProgressEvent` | Spawns background worker rendering spreads at specified DPI, format (`jpeg`, `png`, `pdf`), and quality. |
| `cancel_export` | _None_ | `()` | Signals cancellation to the active export worker pool. |
| `preflight_check_export`| `options: ExportOptions` | `PreflightReport` | Pre-export validation checking missing photos, low-resolution warnings (<200 DPI), and empty frames. |
| `select_export_directory` | _None_ | `Option<String>` | Prompts user to pick output directory for rendered files. |
| `open_export_directory` | `dirPath: String` | `()` | Opens native OS file manager (Windows Explorer / macOS Finder) focused on export directory. |

---

## 3. Tauri Event Streams & Reactive Subsystems

The application relies on asynchronous event streaming (`app.emit(...)` in Rust, `listen(...)` in frontend) to deliver progress feedback and handle lifecycle alerts without blocking the UI thread.

```text
Rust Backend (Background Thread)              Frontend (React / Zustand)
       │                                                   │
       ├─── "photo-import-progress" ──────────────────────>│  (Updates ImportProgressModal)
       ├─── "photo-imported" ─────────────────────────────>│  (Appends item to Photo Library)
       ├─── "photo-preview-ready" ────────────────────────>│  (Refreshes filmstrip/canvas textures)
       ├─── "photo-import-complete" ──────────────────────>│  (Displays summary toast)
       │                                                   │
       ├─── "export-progress" ────────────────────────────>│  (Streams percentage, spread name)
       ├─── "export-zip-progress" ────────────────────────>│  (Archive packaging progress)
       │                                                   │
       ├─── "open-project-file" ──────────────────────────>│  (Single-instance argument forwarding)
       └─── "request-close-warning" ──────────────────────>│  (Unsaved changes modal on window exit)
```

### Event Payload Definitions

1. **`photo-import-progress` (`ImportProgressPayload`)**
   ```typescript
   { projectId: string; current: number; total: number; currentFile: string; percent: number }
   ```
2. **`photo-imported` (`PhotoRow`)**
   Emits immediately after metadata registration so items appear in the filmstrip tray with embedded thumbnails while high-resolution previews decode in the background.
3. **`photo-preview-ready` (`PhotoPreviewReadyPayload`)**
   ```typescript
   { projectId: string; id: string; thumbnailPath: string; previewPath: string }
   ```
   Notifies the UI that the 1500px canvas preview and 320px filmstrip thumbnail have been finalized on disk.
4. **`export-progress` (`ExportProgressEvent`)**
   ```typescript
   {
     current: number; total: number; currentPhotos: number; totalPhotos: number;
     percent: number; spreadName: string; status: string; isFinished: boolean; outputFiles: string[];
   }
   ```
5. **`export-zip-progress` (`ExportZipProgressPayload`)**
   ```typescript
   {
     current: number; total: number; percent: number; status: string;
     isFinished: boolean; targetPath?: string; error?: string;
   }
   ```
6. **`request-close-warning` (`()`)**
   Intercepted by `App.tsx` when `window.on_window_event(WindowEvent::CloseRequested)` fires while `AppExitState.is_unsaved` is `true`, preventing immediate window closure and prompting the user to save.
7. **`open-project-file` (`String`)**
   Fired by `tauri_plugin_single_instance` when a second instance of the application is launched by double-clicking an `.afsn` file in Windows Explorer. The active window restores, focuses, and loads the specified project.

---

## 4. Embedded SQLite Relational Persistence

### 4.1 Storage Architecture & Pragmas

- **Physical Path:** Located in the user's OS application data directory:
  - Windows: `%APPDATA%\com.afsn.smartalbum\afsn_smart_album.db`
  - macOS: `~/Library/Application Support/com.afsn.smartalbum/afsn_smart_album.db`
- **Reliability Pragmas:**
  ```sql
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  ```
  - **WAL (Write-Ahead Logging):** Permits non-blocking concurrent reads while write transactions are being committed.
  - **Foreign Key Cascades:** Ensures that deleting a project automatically cleans up associated spreads, elements, photos, and folder memberships.

### 4.2 Migration Pipeline (`src-tauri/src/db/mod.rs`)

Managed through a dedicated `schema_version` table. On startup, `Database::init()` checks `MAX(version)` and applies pending migrations within atomic SQL transactions:

| Version | Migration Focus | Schema Modifications |
|---|---|---|
| **v1** | Core Configuration | `settings` table (key-value store for app configuration). |
| **v2** | Project Management | `projects` table (canvas dimensions, DPI, units, spacing, borders, background). |
| **v3** | Project Margins | Added `margin_enabled`, `margin_value`, `margin_unit` to `projects`. |
| **v4** | Photo Library | `photos` table (file path, dimensions, format, thumbnail/preview paths, favorite/used flags). |
| **v5** | Collections / Folders | `photo_folders` and `photo_folder_members` tables (many-to-many relationship). |
| **v6** | Spreads & Elements | `album_spreads` and `spread_elements` (frames, transforms, aspect ratios, crops, radii, borders). |
| **v7** | Grouping | Added `group_id` to `spread_elements` (supporting multi-frame grouped transformations). |
| **v8** | Frame Locking | Added `locked` column to `spread_elements`. |
| **v9** | Page Backgrounds | Added `left_page_background_color` and `right_page_background_color` to `album_spreads`. |
| **v10** | Rich Text | Added `text_payload` JSON column to `spread_elements`. |
| **v11** | Crop Rotation | Added `crop_rotation` column to `spread_elements`. |
| **v12** | Independent Corner Radii | Added `corner_radius_tl`, `corner_radius_tr`, `corner_radius_br`, `corner_radius_bl` to `spread_elements`. |
| **v13** | Independent Margins & Safe Areas | Added 4-side margin columns (`margin_top`, `margin_bottom`, `margin_outside`, `margin_spine`) to `projects` and `safe_area_*` to `album_spreads`. |
| **v14** | Project File Identity | Created `project_file_identity` table linking `project_id` to external `document_id`. |
| **v15** | Per-Spread Spacing | Added `spacing_value` and `spacing_unit` to `album_spreads`. |

---

## 5. Persistence Formats & File System IO

### 5.1 Native `.afsn` Document Packaging

The `.afsn` file is a human-readable, pretty-printed JSON document containing complete project geometry and metadata:

```json
{
  "version": 1,
  "project": { "id": "...", "name": "Wedding_Album", "canvasWidth": 600, ... },
  "photos": [ ... ],
  "folders": [ ... ],
  "folderMembers": [ ... ],
  "album": {
    "id": "album-...",
    "coverSpread": { ... },
    "spreads": [ ... ]
  }
}
```

#### Atomic Write Staging (`src-tauri/src/db/package_io.rs`)

To prevent corruption from power loss or disk write interruptions, all `.afsn` writes utilize atomic staging:

1. Data is written to a temporary sibling file: `.afsn-<uuid>.tmp` in the target directory.
2. `flush()` and `sync_all()` force OS buffers to physical disk.
3. `fs::rename()` atomically replaces the destination file on the same filesystem.
4. Symbolic links are strictly rejected (`is_symlink()`) to prevent link-redirection attacks.

#### Document Identity & Safe Reconciliation

To avoid accidental overwrite of another project with the same name:

- Each project possesses an immutable internal document identity (`project_file_identity`).
- Prior to saving, `validate_file_owner()` inspects the existing target file's embedded identity. If a mismatch is detected, the operation aborts with a protective error prompting the user to use "Save As".

### 5.2 Bundled Project Archive (`.zip`)

For transferring projects between workstations complete with original photo files:

- Built via `zip::ZipWriter` (`src-tauri/src/db/package_io.rs`).
- Mode: `CompressionMethod::Stored` (0 compression) to maximize IO throughput on multi-gigabyte RAW/JPEG collections.
- Layout inside archive:
  - `project.afsn` (root manifest with photo paths remapped relative to archive).
  - `photos/<filename>` (contained original image files).

---

## 6. Progressive Image Pipeline & Tauri Asset Protocol

```text
Original High-Res Photo (Disk: 24-100 MP)
               │
               ▼
   [Phase 1: Metadata Fast Scan]  ──> Dimensions & EXIF Orientation (Header Only, No Bitmap Allocation)
               │
               ▼
  [Phase 2: Embedded Thumbnail]  ──> EXIF APP1 / IFD1 JPEG Extraction (Instant ~160px First Look)
               │
               ▼
   [Phase 3: Controlled Decode]   ──> Guarded by `ORIGINAL_DECODE` Mutex (Only 1 Full Bitmap in RAM)
               │
               ├─────────────────────────────────────────┐
               ▼                                         ▼
   [Canvas Preview: Max 1500px]               [Filmstrip Thumb: Max 320px]
   Stored in `$APPCACHE/previews/`             Stored in `$APPCACHE/thumbnails/`
               │                                         │
               └────────────────────┬────────────────────┘
                                    │
                                    ▼
                         [Memory Working Set Trim] ──> Win32 `EmptyWorkingSet()`
                                    │
                                    ▼
                        [Tauri Asset Protocol]
                        `convertFileSrc(cachePath)`
                                    │
                                    ▼
                     [React-Konva Stage Viewport]
                     Bounded LRU Cache (Max 24 Images)
```

### 6.1 Bounded Ingestion Mechanics (`src-tauri/src/photo_engine/mod.rs`)

1. **Dimension Upper Bound:** Photos exceeding 100 megapixels are rejected (`100_000_000` pixels) to protect system memory.
2. **Decoder Memory Limit:** `image::Limits::default().max_alloc` is restricted to `512 MB`.
3. **Concurrency Bottleneck Protection:** An internal `ORIGINAL_DECODE` Mutex ensures that even when `rayon` processes imports across background worker threads, **only one uncompressed full-resolution source bitmap exists in memory at any point**. Once downscaled to `1500px`, the source bitmap is immediately dropped (`drop(img)`).
4. **Transparent PNG Handling:** If the source format is transparent (`png`, `webp`, `gif`), derivatives are generated as `.png` with alpha channel preserved. Opaque formats generate optimized JPEGs.
5. **Memory Working Set Trimming:** Following batch imports, `trim_process_memory()` executes `EmptyWorkingSet()` on Windows to release unused virtual memory pages back to the OS allocator.

### 6.2 Frontend Asset Protocol & LRU Texture Caching

- **Protocol:** Previews and thumbnails are requested via `convertFileSrc(path)` resolving to `asset://localhost/...` (macOS) or `http://asset.localhost/...` (Windows).
- **Cache Busting:** Cache URLs append version hashes: `${convertFileSrc(path)}?v=${encodeURIComponent(updatedAt)}`.
- **Canvas LRU Texture Cache (`src/features/editor/KonvaEditorCanvas.tsx`):**
  - Web browsers/WebViews do not eagerly free GPU textures.
  - The canvas engine implements a strict LRU Map (`MAX_CANVAS_IMAGE_CACHE = 24`).
  - When the 25th image is loaded, the oldest `HTMLImageElement` is evicted and its `.src` is cleared to empty string `""` to allow instantaneous garbage collection.

---

## 7. Typography & High-Res Export Engine

### 7.1 Text Engine (`src-tauri/src/export_engine/text_rasterizer.rs`)

- High-speed glyph rasterization powered by **`fontdue` (v0.9)**.
- **Font Resolution Hierarchy:**
  1. Statically bundled fonts (`bundled_fonts.rs`): Inter, Playfair Display, Montserrat, Cormorant Garamond, Cinzel, Great Vibes.
  2. Operating system fonts: Discovered via Windows Registry (`advapi32.dll`), loaded dynamically from `C:\Windows\Fonts`.
- **Formatting Support:** Handles rich text token layouts, styled ranges, font size, weight, slant, underline, strike-through, character spacing (letter-spacing), line height, and text frame vertical/horizontal alignments.

### 7.2 Two-Pass High-DPI Rendering Pipeline (`src-tauri/src/export_engine/mod.rs`)

When exporting high-resolution spreads (typically 300 DPI for offset and silver halide photographic printing):

```text
[Pass 1: Photo & Background Compositing]

- Renders page backgrounds, borders, and margins.
- Decodes source photos at full resolution; crops and scales to physical target DPI.
- Computes per-corner radii and image rotation transforms.
               │
               ▼
[Pass 1b: Print Sharpening (Optional)]

- Applies custom 3x3 Laplacian unsharp masking tuned for photo paper.
- Photo pixels are sharpened; text has NOT been drawn yet.
               │
               ▼
[Pass 2: Vector Text Rasterization]

- Rasterizes text tokens via `fontdue` directly onto the sharpened canvas.
- CRITICAL BENEFIT: Text edges remain razor-sharp without halos, ringing, or sharpening artifacts.
               │
               ▼
[Output Encoder Stage]

- JPEG: Encodes image and injects custom JFIF APP0 header (`0xFFE0`) with explicit DPI.
- PNG: Injects `pHYs` chunk with calculated pixels-per-meter density and IEEE 802.3 CRC32.
- PDF: Passes rendered pages into zero-dependency PDF-1.4 stream assembler.

```

### 7.3 Zero-Dependency PDF-1.4 Assembler (`assemble_pdf_from_jpegs`)

AFSNSmartAlbum constructs valid print-ready multi-page PDF documents without linking external heavy PDF libraries:

- Writes PDF header (`%PDF-1.4`).
- Generates `/Catalog` and `/Pages` dictionary tree.
- Embeds each spread/page as a distinct `/Page` object with `/Contents` stream setting `/MediaBox` based on physical dimensions.
- Embeds JPEG streams directly as `/XObject /Subtype /Image` with `/Filter /DCTDecode` (avoiding re-compression quality loss).
- Generates cross-reference table (`xref`) with exact byte offsets and trailer dictionary.

---

## 8. External Services & Licensing/Update System

### 8.1 Dual-Flow Update Architecture (`src/services/updateService.ts`)

```text
                               Check For Updates
                                       │
                     ┌─────────────────┴─────────────────┐
                     ▼                                   ▼
        [Primary: Desktop Tauri]             [Fallback: Web/Direct API]
      `tauri-plugin-updater::check()`         Fetch GitHub Releases REST API
                     │                                   │
      Reads `latest.json` endpoint            Reads `/repos/.../releases/latest`
                     │                                   │
      Verifies Minisign Signature             Parses Semver & Assets
                     │                                   │
                     ├─────────────────┬─────────────────┘
                     │                 │
                     ▼                 ▼
          [Auto-Update Flow]     [Manual Download Flow]
          - In-app chunked       - Opens default browser
            download & verify      to release download URL
          - Streams progress to    via `plugin-shell`
            `useAppStore`
          - Restarts via
            `app.restart()`
```

#### Update Configuration

- **Updater Endpoint:** `https://github.com/asrofims/AFSNSmartAlbum/releases/latest/download/latest.json`
- **Public Key (Minisign):**
  `dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IENFRUNEM0VDREYyQjk1NkYKUldSdmxTdmY3TlBzemltaWxGQm8wczFVa29wMVcxRGNkRGtaWTU2c3p5RURDZ1Q2YUxHdWIvaE0K`
- **Background Download Execution:** `startUpdateDownload()` executes asynchronously, persisting progress into `useAppStore` even if the update dialog is closed by the user.

### 8.2 Privacy & Offline Integrity

- **Zero Telemetry:** The application contains no Google Analytics, Sentry, Mixpanel, or cloud telemetry SDKs.
- **Local License:** Software operates under a proprietary offline license model (`Afsunmedia - Asrofims`).
- **Optional Support:** A QRIS QR code modal (`src/features/support/SupportDonationModal.tsx`) provides an optional, voluntary support channel rendered locally using SVG without external network calls.
