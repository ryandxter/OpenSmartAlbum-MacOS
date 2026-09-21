---
last_mapped_commit: a7d32d2e29106b6263ac48059f328f6de747f7b8
last_mapped_at: 2026-09-21
---
# Coding Conventions and Quality Standards

**Analysis Date:** 2026-09-21  
**Project:** AFSNSmartAlbum (`afsn-smart-album` v1.0.77)  
**Target Environments:** Tauri 2 (`@tauri-apps/api` ^2.0.0, Tauri core 2.11), macOS (WebKit), Windows (Chromium / WebView2)

---

## 1. Architectural Overview & System Stack

AFSNSmartAlbum is a professional desktop photo album layout software modeled after creative desktop suites (Adobe InDesign, Pixellu SmartAlbums, Adobe Lightroom). The application architecture strictly separates UI interaction, state coordination, client domain math, native system operations, and heavy graphics processing:

- **Frontend Application Layer:** React 18 (`react`, `react-dom`) with TypeScript 5.6 running in Vite 6 bundler mode.
- **State Management & Coordination:** Zustand 5 (`zustand`) multi-store architecture with deep snapshot undo/redo history.
- **Canvas & Visual Layout Engine:** Konva 9 (`konva`, `react-konva`) with hardware-accelerated 2D stage rendering, custom contextual transformers, and dynamic pasteboard viewports.
- **Native Desktop Shell & IPC:** Tauri 2 (`tauri` 2.11.3, `@tauri-apps/api` 2.0) utilizing platform webviews (WebKit on macOS, WebView2 on Windows).
- **Embedded Database & Package Persistence:** SQLite 3 via `rusqlite` (v0.34 bundled) running WAL mode with schema migrations (v1 to v15) and portable `.afsn` archive packaging via `zip` (v2.2).
- **Photo Processing & Export Engine:** Multi-threaded image processing in Rust using `image` (0.25), `kamadak-exif`, and `fontdue` font rasterization, scheduled across CPU threads using `rayon`. *(Note: Architectural notes mention libvips, but active production implementation uses the pure-Rust `image` crate with a concurrency mutex to manage decode memory footprint).*

---

## 2. TypeScript & Frontend Idioms

### 2.1 Compiler Configuration (`tsconfig.json`)

The TypeScript configuration enforces high strictness and safety:

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "useDefineForClassFields": true,
    "lib": ["ES2021", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Key compiler settings to uphold:

- **`noUncheckedIndexedAccess: true`**: Array index lookups (e.g. `items[i]`) and dictionary lookups return `T | undefined`. Code must explicitly guard or provide fallbacks when accessing indexed values (e.g., `const item = items[i]; if (!item) return;`).
- **`strict: true`**: No implicit `any`, strict null checks, strict function types, and strict property initialization.
- **Path Aliases**: Path alias `@/*` maps to `src/*`, configured in both `tsconfig.json` and `vite.config.ts`.
- **Bundler Mode**: `moduleResolution: "bundler"` with `allowImportingTsExtensions: true` allowing ES module resolution across source and test scripts.

### 2.2 Domain Modeling & Discriminated Unions

Elements on spreads are represented as a discriminated union in `src/domain/album.ts`:

```typescript
export type AlbumElement = PhotoFrameElement | TextNodeElement;
```

Each element shares common geometric and z-ordering fields but is strictly discriminated on `type`:

- `PhotoFrameElement` (`type: 'photo'` in `src/domain/editor.ts`):
  - Physical coordinates and dimensions: `x`, `y`, `width`, `height`, `rotation`, `zIndex`.
  - Multi-selection grouping: `groupId?: string | null`, `groupRotation?: number`.
  - Asset linkages: `photoId: string | null`, `filePath: string`, `previewPath: string`, `thumbnailPath: string`.
  - In-frame crop transformations: `cropX`, `cropY`, `cropScale`, `cropRotation`.
  - Styling & boundaries: `borderEnabled`, `borderWidth`, `borderColor`, `cornerRadius`, `opacity`, `locked`.
- `TextNodeElement` (`type: 'text'` in `src/domain/text.ts`):
  - Physical coordinates and dimensions: `x`, `y`, `width`, `height`, `rotation`, `zIndex`, `opacity`, `locked`.
  - Typography properties: `text: string`, `style: TextStyle`, `styledRanges?: StyledRange[]`, `textRuns?: TextRun[]`.

### 2.3 Physical Units & Precision Math

AFSNSmartAlbum works with real-world print units (`mm`, `cm`, `inch`, `px`) defined in `src/domain/units.ts`:

```typescript
export type Unit = 'mm' | 'cm' | 'inch' | 'px';
```

- **Unit Conversions:** Always use `convertUnit(value, fromUnit, toUnit, dpi)` or `toPixels` / `fromPixels`.
- **Resolution Handling:** Standard print baseline is 300 DPI (`canvasDpi: 300`).
- **Geometry Coordinates:** Elements are stored in document canvas units (typically `mm`). Display conversion to screen pixels occurs in the viewport calculation layer (`src/domain/viewport.ts`), never in stored element records.
- **Dynamic Limits:** Gap limits are unit-aware (`getMaxGapForUnit`): 2000px, 500mm, 50cm, 20in.

---

## 3. Zustand State Management Patterns

The application divides global client state into focused stores located in `src/stores/`:

- `useProjectStore` (`src/stores/projectStore.ts`): Active project metadata, file paths, recent projects, loading/saving state, Save / Save As workflows.
- `useAlbumStore` (`src/stores/albumStore.ts`): Active album hierarchy, spreads, pages, active spread index, guides, adaptive layouts, database sync.
- `useEditorStore` (`src/stores/editorStore.ts`): Active canvas selection (`selectedFrameIds`), snapping lines, crop editing mode, clipboard, group rotations.
- `usePhotoStore` (`src/stores/photoStore.ts`): Imported photos catalog, folder collections, background import queue, thumbnail caching, relinking.
- `useHistoryStore` (`src/stores/historyStore.ts`): Undo/redo past and future stacks of deep-cloned `Album` snapshots (capped at 50 levels).
- `useAppStore` (`src/stores/appStore.ts`): App version info, auto-update progress, preferences, modals.

### 3.1 Selector Usage in React Components

React components subscribe to fine-grained state slices via selector functions to avoid unnecessary re-renders:

```typescript
// Correct: Granular selectors
const projectError = useProjectStore((s) => s.error);
const isSaving = useProjectStore((s) => s.isSaving);
const activeSpreadId = useAlbumStore((s) => s.activeSpreadId);

// Avoid: Subscribing to the entire store object
const store = useProjectStore(); // Triggers re-renders on ANY state change
```

### 3.2 Action Calling & Cross-Store Communication

When actions are invoked outside React lifecycle hooks (or inside event handlers, utility functions, and inter-store workflows), access stores directly using `.getState()` or `.setState()`:

```typescript
// Accessing store state outside React render
const { currentAlbum, saveAlbumToDb } = useAlbumStore.getState();

// Updating store state directly
useAlbumStore.setState({ saveStatus: 'unsaved' });
```

#### Dynamic Imports for Circular Store Dependencies

Because `projectStore`, `albumStore`, `photoStore`, and `editorStore` cross-coordinate, static top-level imports between them can lead to circular reference initialization hazards. The codebase consistently uses dynamic `import()` within action methods:

```typescript
// Example from src/stores/projectStore.ts
export const useProjectStore = create<ProjectState>((set, get) => ({
  closeProject: async () => {
    // ...
    const { useAlbumStore } = await import('./albumStore');
    const { usePhotoStore } = await import('./photoStore');
    const { useEditorStore } = await import('./editorStore');
    useAlbumStore.setState({ currentAlbum: null, saveStatus: 'saved' });
    // ...
  }
}));
```

### 3.3 Database Write Serialization & Optimistic Updates

Database mutations are serialized via a promise queue to guarantee FIFO execution and avoid SQLite lock contention (`src/stores/albumStore.ts`):

```typescript
let databaseWriteQueue: Promise<unknown> = Promise.resolve();

export function persistInOrder<T>(write: () => Promise<T>): Promise<T> {
  const result = databaseWriteQueue.then(write, write);
  databaseWriteQueue = result.catch(() => false);
  return result;
}
```

- Optimistic state updates (e.g. updating element position or border in memory) apply immediately for 60fps canvas performance.
- Database writes queue asynchronously in the background.
- If native persistence fails, error flags are raised in `useProjectStore` (`error: string | null`) and `saveStatus` drops to `'unsaved'`.

---

## 4. Konva Canvas & React-Konva Conventions

The center workspace canvas (`src/features/editor/KonvaEditorCanvas.tsx`) renders the album spread using hardware-accelerated Konva 2D stages.

### 4.1 Stage & Layer Architecture

```text
<Stage ref={stageRef}>
  <Layer id="spread-background-layer">
    {/* Page base rects, backgrounds, spine crease, center gutter */}
  </Layer>
  <Layer id="elements-layer">
    {/* Photo Frames, In-frame Images, Corner Radius clip paths, Text Nodes */}
  </Layer>
  <Layer id="guides-and-overlays-layer">
    {/* Safe margin lines, Bleed lines, Magnetic Snap guides, Gap distance badges */}
  </Layer>
  <Layer id="transform-layer">
    {/* Multi-Selection Proxy Rect & Contextual Konva Transformer */}
  </Layer>
</Stage>
```

### 4.2 Transformer Synchronization & Mode Switching

1. **Ref Management:** The `Konva.Transformer` instance is held via `trRef = useRef<Konva.Transformer>(null)`.
2. **Synchronous Detachment via `useLayoutEffect`:** When entering text editing mode (`editingTextElementId`) or crop mode (`editingCropFrameId`), the transformer must immediately detach *before* the browser paints to prevent visual artifacts:
   ```typescript
   useLayoutEffect(() => {
     if ((editingTextElementId || editingCropFrameId) && trRef.current) {
       trRef.current.nodes([]);
       trRef.current.forceUpdate();
       trRef.current.getLayer()?.batchDraw();
     }
   }, [editingTextElementId, editingCropFrameId]);
   ```
3. **Single vs Multi-Selection Proxy:**
   - Single element: Transformer attaches directly to the node (`findOne('#' + id)`).
   - Multi-selection: Instead of binding multiple nodes directly (which can distort relative spacing during rotation/scaling), a synthetic invisible proxy node (`#multi-selection-proxy`) represents the group's rotated bounding box (`multiGroupInfo`). Transformations on the proxy calculate proportional updates to child frames via `computeMultiFrameGroupBounds` and `unprojectGroupChildToWorld`.
4. **Transform Protection:** If `trRef.current.isTransforming()` is true, viewport or store re-renders skip re-attaching nodes to avoid cancelling in-flight mouse gestures.

### 4.3 Performance Optimizations

- **`batchDraw()` over `draw()`:** Call `layer.batchDraw()` to coalesce draw requests to `requestAnimationFrame`.
- **Canvas Clamping to Visible Pasteboard:** `calculatePasteboardViewport` (`src/domain/viewport.ts`) dynamically bounds the scrollable workspace extent around the active spread and off-spread content, preventing oversized canvas buffers.
- **Hit Detection Caching:** Interactive nodes set explicit `id` attributes matching their domain IDs for fast `stage.findOne('#' + id)` lookups.

---

## 5. Rust Backend & Tauri Conventions

The native backend resides in `src-tauri/` and is organized modularly:

- `src-tauri/src/lib.rs`: Tauri builder setup, plugin registrations, command handlers.
- `src-tauri/src/commands/`: Tauri IPC invoke commands partitioned by domain:
  - `project_commands.rs`: Project CRUD, file export, Save As dialogs.
  - `photo_commands.rs`: Photo scan, metadata extraction, import cancellation, relinking.
  - `export_commands.rs`: High-resolution print export (JPEG, PNG, PDF).
  - `app_commands.rs`: System fonts enumeration, file associations.
- `src-tauri/src/db/`: SQLite initialization, migrations, SQL queries, `.afsn` packaging (`package_io.rs`).
- `src-tauri/src/photo_engine/`: Image decoding, thumbnail/preview creation, EXIF handling.
- `src-tauri/src/export_engine/`: Production print rendering, split-page PDF generation, DPI scaling, font rasterization (`text_rasterizer.rs`).
- `src-tauri/src/asset_cache.rs`: Thumbnail & preview cache management, orphan cleanup.

### 5.1 Tauri Commands & Error Handling (`Result<T, String>`)

Tauri IPC commands exposed to the frontend MUST return `Result<T, String>` or `Result<(), String>`. Never panic in production command handlers:

```rust
// Standard Tauri Command Convention (src-tauri/src/commands/project_commands.rs)
#[tauri::command]
pub fn create_project(
    db: State<'_, Database>,
    request: CreateProjectRequest,
) -> Result<ProjectRow, String> {
    log::info!("create_project received request: {:?}", request);

    // 1. Validation
    if request.name.trim().is_empty() {
        return Err("Project name cannot be empty".to_string());
    }
    if request.canvas_width <= 0.0 || request.canvas_height <= 0.0 {
        return Err("Canvas dimensions must be positive numbers".to_string());
    }

    // 2. Execution & Error Mapping
    db.create_project(&id, ...)
      .map_err(|e| {
          log::error!("Database create_project error: {:?}", e);
          format!("Database error: {}", e)
      })
}
```

### 5.2 Serde Serialization Conventions

- Structs shared with TypeScript must use `#[serde(rename_all = "camelCase")]` to match frontend naming conventions:
  ```rust
  #[derive(Debug, Clone, Serialize, Deserialize)]
  #[serde(rename_all = "camelCase")]
  pub struct ProjectRow {
      pub id: String,
      pub canvas_width: f64,
      pub canvas_height: f64,
      pub canvas_unit: String,
      pub canvas_dpi: i32,
      // ...
  }
  ```
- Optional or nullable fields must specify `#[serde(default)]` or `Option<T>` to ensure graceful deserialization of older database or package payloads.

### 5.3 Atomic File Operations

Writing `.afsn` files or project archives MUST follow atomic write patterns (`src-tauri/src/db/package_io.rs`):

1. Create a unique adjacent temporary file: `.afsn-{UUID}.tmp` in the target directory.
2. Write content, call `file.flush()?`, then `file.sync_all()?`.
3. Close/drop file handle.
4. Atomically rename temporary file over target: `fs::rename(&temporary, path)?`.
5. On any error, delete temporary file (`fs::remove_file(&temporary)`). Existing user project files remain untouched.

### 5.4 Database Concurrency & SQLite Migrations

- The database instance is wrapped in a thread-safe mutex:
  ```rust
  pub struct Database {
      conn: Mutex<Connection>,
  }
  ```
- WAL (Write-Ahead Logging) is enabled upon connection init:
  `conn.pragma_update(None, "journal_mode", "WAL")?;`
  `conn.pragma_update(None, "foreign_keys", "ON")?;`
- Schema versioning is tracked via a dedicated `schema_version` table. Incremental migrations (`migrate_v1` through `migrate_v15`) execute inside transactional batches (`BEGIN; ... COMMIT;`).

### 5.5 Image Pipeline Concurrency & Memory Safeguards

- High-resolution photo decoding can consume substantial RAM. The codebase employs a static mutex (`ORIGINAL_DECODE` in `src-tauri/src/photo_engine/mod.rs`) ensuring only one master RAW/JPEG image decodes into memory simultaneously, while encoding resized derivatives (320px thumbnails, 1500px canvas previews) executes across Rayon threads:
  ```rust
  static ORIGINAL_DECODE: std::sync::Mutex<()> = std::sync::Mutex::new(());
  ```
- Directory scans protect against circular symlinks, Windows junction points (`0x400`), and enforce an upper limit of 100,000 files to avoid unbounded heap growth.

---

## 6. CSS, Styling & Theming Conventions

### 6.1 Design Tokens (`src/styles/tokens.css`)

All styling is built on CSS custom properties (design tokens) anchored to dark mode:

```css
:root {
  color-scheme: dark;
  /* Canonical Colors */
  --color-bg-primary: #1a1a1e;
  --color-bg-secondary: #222226;
  --color-bg-tertiary: #2a2a2e;
  --color-surface: #303036;
  --color-surface-hover: #38383e;
  --color-surface-active: #404046;
  --color-border: #3a3a40;
  --color-border-subtle: #2e2e34;
  --color-text-primary: #e8e8ec;
  --color-text-secondary: #a0a0a8;
  --color-text-muted: #6a6a72;
  --color-text-inverse: #1a1a1e;
  --color-accent: #38bdf8;
  --color-accent-hover: #0ea5e9;
  --color-accent-active: #0284c7;
  --color-accent-subtle: rgba(56, 189, 248, 0.15);
  --color-accent-glow: rgba(56, 189, 248, 0.35);

  --color-danger: #ef4444;
  --color-success: #22c55e;
  --color-warning: #f59e0b;

  /* Spacing Scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  /* Typography */
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-size-xs: 11px;
  --font-size-sm: 12px;
  --font-size-base: 13px;
  --font-size-lg: 14px;

  /* Layout Constants */
  --toolbar-height: 42px;
  --statusbar-height: 28px;
  --panel-width: 260px;
}
```

### 6.2 CSS Modules

Component-specific styling uses CSS Modules (`Component.module.css`):

- Guarantees class name scoping without global selector clashes.
- References canonical design tokens via `var(--color-bg-primary)`.
- Reusable UI primitives reside in `src/components/ui/` (`Button.module.css`, `Input.module.css`, `Modal.module.css`).

### 6.3 Standard UI Vocabulary (`DESIGN_SYSTEM.md`)

All user-facing dialogs, tooltips, panels, and toast alerts MUST adhere to standard creative desktop vocabulary:

- Use `Spread` (not "slide" or "sheet").
- Use `Center Gutter Crease` & `Spine Width` (not "middle line").
- Use `Safe Zone Margin` (inward boundary) & `Bleed Allowance / Cut Line` (outward trim).
- Use `Photo Spacing` (not "gap size").
- Use `Smart Magnetic Snapping` (guideline alignment).
- Use `Match Width` / `Match Height` (neighbor alignment badges).
- Use `↺ Reset Ratio` and `↺ Reset Crop`.

---

## 7. Quality Standards & Linting Checklist

Before submitting code changes, verify compliance against the following standards:

1. **Type Safety:**
   - Run `npx tsc --noEmit`. There must be 0 TypeScript diagnostics or warnings.
   - Do not use `@ts-ignore` or explicit `any` without exhaustive inline documentation.
   - Guard all indexed access checks triggered by `noUncheckedIndexedAccess`.
2. **Error Handling:**
   - Every async native invoke call must be wrapped in `try/catch` with clear user feedback (`set({ error: ... })` or fallback logic).
   - Rust commands must return explicit error messages via `Err(String)`.
3. **Immutability:**
   - Never mutate state objects directly in Zustand stores or domain functions. Use shallow or deep spreads (`{ ...spread, elements: spread.elements.map(...) }`).
4. **Platform Isolation:**
   - Desktop-specific features must verify `isTauri()` before calling native APIs to preserve browser preview functionality during rapid iteration.
5. **No Broken Links or Silent Failures:**
   - Native file operations must maintain atomic safety (`atomic_write`), clean up temporary files, and log failures with `log::error!`.

---
*Document maintained under AFSNSmartAlbum Quality Guidelines.*  
*Date of verification: 2026-09-21*
