# Phase 15 Explore & AAS Multi-Agent Debate: Social Carousel Full SQLite & Package Persistence

**Target:** OpenSmartAlbum-MacOS Milestone v1.3.0  
**Phase:** 15 (`PERS-01`, `PERS-02`, `PERS-03`, `PERS-04`)  
**Document Type:** AAS Architectural Exploration & Multi-Agent Consensus  
**Date:** September 29, 2026  

---

## 1. Executive Summary & Problem Space

During Milestone v1.2, Social Carousel was introduced as an in-memory Konva canvas feature (`src/domain/carousel.ts`, `src/stores/carouselStore.ts`, `src/features/carousel/CarouselCanvas.tsx`). While users can construct multi-slide carousels, apply R-BSP dynamic layouts, and preview seamless multi-slide panoramas, **none of the carousel state is persisted to SQLite or the `.afsn` project archive**. 

When a user presses `Cmd+S`, selects "File > Save", or triggers background autosave, the persistence pipeline in `src/stores/projectStore.ts` exclusively serializes `useAlbumStore.getState().currentAlbum` to SQLite tables `album_spreads` and `spread_elements`. For carousel projects:
1. `useCarouselStore` state exists solely in volatile RAM.
2. Quitting the application (`Cmd+Q`), closing the window, or reloading causes **100% data loss** of all carousel slides, photo placements, aspect ratios, custom backgrounds, and crop geometries.
3. The Tauri 2 window close safeguard (`src-tauri/src/lib.rs` and `src/App.tsx`) only checks `useAlbumStore.getState().saveStatus`, completely unaware of unsaved modifications in `useCarouselStore`. Users can accidentally terminate the application with dirty carousel state without any native warning prompt.
4. Older projects lack carousel schema tables, requiring backward-compatible, transaction-safe migrations.

This document executes an authoritative, multi-persona AAS debate across three specialized roles to lock the architecture, database schema, IPC contracts, hydration lifecycle, dirty state tracking, and macOS HIG window close safeguards.

---

## 2. Persona Profiles

| Persona | Domain Specialty | Focus & Philosophy |
|---------|------------------|-------------------|
| **Rust & SQLite Systems Architect** | SQLite Engine, rusqlite, WAL mode, transaction isolation, IPC serialization | Relational integrity, atomic commits, cascading deletes, zero dangling references, high-performance streaming I/O, binary & package stability. |
| **Frontend State & Lifecycle Engineer** | Zustand store mechanics, React lifecycle, debounced scheduling, hydration pipelines | Reactive predictability, atomic undo/redo, single-source-of-truth status indicators, transparent save lifecycle without UI hitching. |
| **macOS HIG & Window Guard Adversary** | macOS platform conventions, Tauri 2 event loops, crash resilience, edge-case falsification | Falsification of edge cases, prevention of data loss on unexpected exits (`kill -9`, power drop, `Cmd+Q`), strict Apple HIG dialog semantics, non-destructive backward compatibility. |

---

## 3. Structured AAS Multi-Agent Debate

```
+----------------------------------------------------------------------------------------------------+
|                                    AAS MULTI-AGENT DEBATE MATRIX                                    |
+------------------------------------+------------------------------------+--------------------------+
| 1. Systems Architect (Rust/SQLite) | 2. State & Lifecycle (Frontend)    | 3. HIG & Guard Adversary |
| - rusqlite v16 schema & indices    | - carouselStore persistence APIs   | - Close interception bug |
| - Transactional save/load IPC      | - Project load hydration pipeline  | - HIG 3-button sheet     |
| - ProjectPackagePayload .afsn spec | - Debounced autosave engine        | - Crash recovery snapshot|
| - Placed photos zip bundling       | - Titlebar amber/green status pill | - Backward compat guard  |
+------------------------------------+------------------------------------+--------------------------+
```

---

### Round 1: Relational SQLite Schema & Package Serialization Architecture

#### 🏛️ Rust & SQLite Systems Architect
"In `src-tauri/src/db/mod.rs`, our current schema version is 15 (`migrate_v15` added spread spacing). For Phase 15, we must introduce `migrate_v16` and increment `Database::expected_version()` to 16.

We need two normalized relational tables and one column addition to `projects`:
1. `projects.project_type`: `TEXT NOT NULL DEFAULT 'print'` with check constraint `'print' | 'carousel'`. Existing records with `canvas_unit = 'px'` are migrated to `'carousel'`.
2. `carousel_slides`:
   ```sql
   CREATE TABLE IF NOT EXISTS carousel_slides (
       id TEXT PRIMARY KEY,
       project_id TEXT NOT NULL,
       slide_index INTEGER NOT NULL,
       width_px INTEGER NOT NULL DEFAULT 1080,
       height_px INTEGER NOT NULL DEFAULT 1080,
       background_color TEXT NOT NULL DEFAULT '#FFFFFF',
       created_at TEXT NOT NULL DEFAULT (datetime('now')),
       updated_at TEXT NOT NULL DEFAULT (datetime('now')),
       FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
   );
   CREATE INDEX IF NOT EXISTS idx_carousel_slides_project ON carousel_slides(project_id);
   CREATE INDEX IF NOT EXISTS idx_carousel_slides_index ON carousel_slides(project_id, slide_index);
   ```
3. `carousel_frames`:
   ```sql
   CREATE TABLE IF NOT EXISTS carousel_frames (
       id TEXT PRIMARY KEY,
       slide_id TEXT NOT NULL,
       photo_id TEXT,
       file_path TEXT NOT NULL DEFAULT '',
       file_name TEXT NOT NULL DEFAULT '',
       preview_path TEXT,
       thumbnail_path TEXT,
       x REAL NOT NULL DEFAULT 0.0,
       y REAL NOT NULL DEFAULT 0.0,
       width REAL NOT NULL DEFAULT 1080.0,
       height REAL NOT NULL DEFAULT 1080.0,
       rotation REAL NOT NULL DEFAULT 0.0,
       z_index INTEGER NOT NULL DEFAULT 1,
       photo_aspect REAL NOT NULL DEFAULT 1.0,
       crop_x REAL NOT NULL DEFAULT 0.0,
       crop_y REAL NOT NULL DEFAULT 0.0,
       crop_scale REAL NOT NULL DEFAULT 1.0,
       crop_rotation REAL NOT NULL DEFAULT 0.0,
       border_enabled INTEGER NOT NULL DEFAULT 0,
       border_width REAL NOT NULL DEFAULT 0.0,
       border_color TEXT NOT NULL DEFAULT '#FFFFFF',
       border_style TEXT NOT NULL DEFAULT 'solid',
       opacity REAL NOT NULL DEFAULT 1.0,
       locked INTEGER NOT NULL DEFAULT 0,
       shape_type TEXT NOT NULL DEFAULT 'rectangle',
       custom_svg_path TEXT,
       corner_radius_tl REAL NOT NULL DEFAULT 0.0,
       corner_radius_tr REAL NOT NULL DEFAULT 0.0,
       corner_radius_br REAL NOT NULL DEFAULT 0.0,
       corner_radius_bl REAL NOT NULL DEFAULT 0.0,
       created_at TEXT NOT NULL DEFAULT (datetime('now')),
       updated_at TEXT NOT NULL DEFAULT (datetime('now')),
       FOREIGN KEY(slide_id) REFERENCES carousel_slides(id) ON DELETE CASCADE
   );
   CREATE INDEX IF NOT EXISTS idx_carousel_frames_slide ON carousel_frames(slide_id);
   CREATE INDEX IF NOT EXISTS idx_carousel_frames_photo ON carousel_frames(photo_id);
   ```

Now regarding package serialization: `15-CONTEXT.md` mentions `carousel.json` inside a zip package. However, examining `src-tauri/src/db/package_io.rs` lines 237–256 and 390–405 reveals that `.afsn` files are actually **single JSON documents** serializing `ProjectPackagePayload` via `serde_json::to_vec_pretty(&package)`! Only the bundled export (`export_bundled_project_package_with_progress`) creates a `.zip` file.
Therefore, the most robust, backward-compatible design is adding `pub carousel: Option<CarouselPayload>` directly to `ProjectPackagePayload` with `#[serde(default)]`. Existing `.afsn` files deserialize with `carousel: None`, and newly saved carousel packages serialize `carousel: Some(...)`. In addition, when creating a bundled `.zip` archive, we package `project.afsn` (which contains `carousel`), and we scan `package.carousel.slides[].elements` to bundle all referenced frame photos into `photos/`!"

#### 🎨 Frontend State & Lifecycle Engineer
"I completely endorse adding `carousel: Option<CarouselPayload>` to `ProjectPackagePayload` and extending the SQLite schema. However, what about the carousel's global settings: ratio (`'1:1' | '4:5' | '9:16'`), slide dimensions, and total slides? Where are they stored in SQLite?
Do we add a `carousels` parent table, or do we store `ratio` on `projects` or `carousel_slides`?"

#### 🏛️ Rust & SQLite Systems Architect
"Good catch. In our domain model (`src/domain/carousel.ts`), a carousel has:
```ts
export interface Carousel {
  id: string;
  projectId: string;
  ratio: CarouselRatio; // '1:1' | '4:5' | '9:16'
  slideWidthPx: number;
  slideHeightPx: number;
  slides: CarouselSlide[];
  totalSlides: number;
}
```
In SQLite, `projects` already has `canvas_width`, `canvas_height`, `canvas_unit`, and `canvas_dpi`. When `canvas_unit == 'px'`, `canvas_width` and `canvas_height` represent `slideWidthPx` and `slideHeightPx`. But the ratio string itself (`'1:1'`, `'4:5'`, `'9:16'`) must not be lost or ambiguously reverse-calculated from floating-point ratios (e.g., $1080 / 1350 = 0.8$).
We will add `carousel_ratio TEXT NOT NULL DEFAULT '1:1'` to `projects` in `migrate_v16`. Alternatively, we can store it in a lightweight `carousels` table:
```sql
CREATE TABLE IF NOT EXISTS carousels (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE,
    ratio TEXT NOT NULL DEFAULT '1:1',
    slide_width_px INTEGER NOT NULL DEFAULT 1080,
    slide_height_px INTEGER NOT NULL DEFAULT 1080,
    total_slides INTEGER NOT NULL DEFAULT 3,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```
Having a dedicated `carousels` table mirrors `album_spreads` and keeps `projects` clean. `carousel_slides` then references `project_id` and optionally `carousel_id`. `save_carousel_structure` can then execute an atomic `UPSERT` on `carousels`, `DELETE FROM carousel_slides WHERE project_id = ?1`, and reinsert slides and frames in a single transaction."

#### 🛡️ macOS HIG & Window Guard Adversary
"The dedicated `carousels` table is much cleaner. But I must raise an immediate critical flag on `package_io.rs`!
In `export_bundled_project_package_with_progress` (lines 283–298 of `package_io.rs`), the codebase iterates through `package.photos` and then `package.album` to find unreferenced frame photos. If a user creates a Carousel project and exports a bundled zip package, **the current code only inspects `package.album`**! Any photo placed directly into a carousel frame without being in `package.photos` will be silently excluded from the zip!
Furthermore, what happens if an older `.afsn` file created in v1.2 is imported? It won't have `carousels`, `carousel_slides`, or `carousel_frames`. Does `load_carousel_structure` return `Ok(None)` without throwing, or does it crash? It must return `Ok(None)` cleanly."

---

### Round 2: IPC Commands & Transaction Boundaries

#### 🏛️ Rust & SQLite Systems Architect
"Here are the exact IPC command signatures and transaction semantics we will implement in `src-tauri/src/commands/project_commands.rs`:

1. `save_carousel_structure(db: State<'_, Database>, carousel: CarouselPayload) -> Result<(), String>`
2. `load_carousel_structure(db: State<'_, Database>, project_id: String) -> Result<Option<CarouselPayload>, String>`

Let's examine the transaction boundary inside `Database::save_carousel_structure`:
```rust
pub fn save_carousel_structure(&self, carousel: &CarouselPayload) -> SqliteResult<()> {
    let mut conn = self.conn.lock().unwrap();
    let tx = conn.transaction()?;

    // 1. Ensure project exists (or create fallback shell)
    let project_exists: bool = tx.query_row(
        "SELECT 1 FROM projects WHERE id = ?1",
        [&carousel.project_id],
        |_| Ok(true),
    ).unwrap_or(false);

    if !project_exists {
        tx.execute(
            "INSERT OR IGNORE INTO projects (
                id, name, canvas_width, canvas_height, canvas_unit, canvas_dpi,
                spacing_value, spacing_unit, margin_enabled, margin_value, margin_unit,
                border_enabled, border_width, border_unit, border_color,
                background_type, background_color, project_type, created_at, updated_at
            ) VALUES (?1, 'Untitled Carousel', ?2, ?3, 'px', 96, 0.0, 'px', 0, 0.0, 'px', 0, 0.0, 'px', '#FFFFFF', 'solid', '#FFFFFF', 'carousel', datetime('now'), datetime('now'))",
            rusqlite::params![carousel.project_id, carousel.slide_width_px, carousel.slide_height_px],
        )?;
    }

    // 2. Upsert carousels metadata row
    tx.execute(
        "INSERT INTO carousels (id, project_id, ratio, slide_width_px, slide_height_px, total_slides, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))
         ON CONFLICT(project_id) DO UPDATE SET
             ratio = excluded.ratio,
             slide_width_px = excluded.slide_width_px,
             slide_height_px = excluded.slide_height_px,
             total_slides = excluded.total_slides,
             updated_at = datetime('now')",
        rusqlite::params![
            carousel.id,
            carousel.project_id,
            carousel.ratio,
            carousel.slide_width_px,
            carousel.slide_height_px,
            carousel.total_slides,
        ],
    )?;

    // 3. Delete existing carousel_slides for this project (CASCADE deletes carousel_frames)
    tx.execute("DELETE FROM carousel_slides WHERE project_id = ?1", [&carousel.project_id])?;

    // 4. Insert slides and frames
    for slide in &carousel.slides {
        tx.execute(
            "INSERT INTO carousel_slides (id, project_id, slide_index, width_px, height_px, background_color, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'), datetime('now'))",
            rusqlite::params![
                slide.id,
                carousel.project_id,
                slide.slide_index,
                slide.width_px,
                slide.height_px,
                slide.background_color,
            ],
        )?;

        for frame in &slide.elements {
            // Verify photo existence in library to prevent dangling references on delete
            let mut verified_frame = frame.clone();
            if let Some(ref photo_id) = verified_frame.photo_id {
                let live: bool = tx.query_row(
                    "SELECT EXISTS(SELECT 1 FROM photos WHERE id = ?1 AND project_id = ?2)",
                    rusqlite::params![photo_id, carousel.project_id],
                    |row| row.get(0),
                )?;
                if !live {
                    verified_frame.photo_id = None;
                    verified_frame.file_path.clear();
                    verified_frame.file_name.clear();
                    verified_frame.preview_path = None;
                    verified_frame.thumbnail_path = None;
                }
            }

            tx.execute(
                "INSERT INTO carousel_frames (
                    id, slide_id, photo_id, file_path, file_name, preview_path, thumbnail_path,
                    x, y, width, height, rotation, z_index, photo_aspect,
                    crop_x, crop_y, crop_scale, crop_rotation,
                    border_enabled, border_width, border_color, border_style,
                    locked, shape_type, custom_svg_path,
                    corner_radius_tl, corner_radius_tr, corner_radius_br, corner_radius_bl,
                    created_at, updated_at
                ) VALUES (
                    ?1, ?2, ?3, ?4, ?5, ?6, ?7,
                    ?8, ?9, ?10, ?11, ?12, ?13, ?14,
                    ?15, ?16, ?17, ?18,
                    ?19, ?20, ?21, ?22,
                    ?23, ?24, ?25,
                    ?26, ?27, ?28, ?29,
                    datetime('now'), datetime('now')
                )",
                rusqlite::params![
                    verified_frame.id,
                    slide.id,
                    verified_frame.photo_id,
                    verified_frame.file_path,
                    verified_frame.file_name,
                    verified_frame.preview_path,
                    verified_frame.thumbnail_path,
                    verified_frame.x,
                    verified_frame.y,
                    verified_frame.width,
                    verified_frame.height,
                    verified_frame.rotation,
                    1, // z_index
                    verified_frame.photo_aspect.unwrap_or(1.0),
                    verified_frame.crop_x.unwrap_or(0.0),
                    verified_frame.crop_y.unwrap_or(0.0),
                    verified_frame.crop_scale.unwrap_or(1.0),
                    0.0, // crop_rotation
                    verified_frame.border_enabled.unwrap_or(false) as i32,
                    verified_frame.border_width.unwrap_or(0.0),
                    verified_frame.border_color.as_deref().unwrap_or("#FFFFFF"),
                    verified_frame.border_style.as_deref().unwrap_or("solid"),
                    verified_frame.locked.unwrap_or(false) as i32,
                    verified_frame.shape_type.as_deref().unwrap_or("rectangle"),
                    verified_frame.custom_svg_path,
                    verified_frame.corner_radius_tl.unwrap_or(0.0),
                    verified_frame.corner_radius_tr.unwrap_or(0.0),
                    verified_frame.corner_radius_br.unwrap_or(0.0),
                    verified_frame.corner_radius_bl.unwrap_or(0.0),
                ],
            )?;
        }
    }

    // Update project updated_at timestamp
    tx.execute("UPDATE projects SET updated_at = datetime('now') WHERE id = ?1", [&carousel.project_id])?;

    tx.commit()
}
```
This guarantees complete ACID transactional consistency."

#### 🛡️ macOS HIG & Window Guard Adversary
"What happens if `load_carousel_structure` is called for a Print Album project that has no carousel records?
It must return `Ok(None)` cleanly without throwing an SQL error. Let's see `Database::load_carousel_structure`:
```rust
pub fn load_carousel_structure(&self, project_id: &str) -> SqliteResult<Option<CarouselPayload>> {
    let conn = self.conn.lock().unwrap();
    let carousel_opt: Option<(String, String, i32, i32, i32)> = conn.query_row(
        "SELECT id, ratio, slide_width_px, slide_height_px, total_slides FROM carousels WHERE project_id = ?1",
        [project_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
    ).optional()?;

    let (carousel_id, ratio, width_px, height_px, total_slides) = match carousel_opt {
        Some(c) => c,
        None => return Ok(None),
    };
    // ... load slides and frames ...
}
```
Using `rusqlite::OptionalExtension::optional()` ensures that zero rows returns `Ok(None)`, so Print projects or older unmigrated projects never trigger a panic or unhandled error!"

---

### Round 3: Frontend Store Integration & Hydration Lifecycle

#### 🎨 Frontend State & Lifecycle Engineer
"Let's trace the frontend lifecycle in `src/stores/carouselStore.ts` and `src/stores/projectStore.ts`.
Right now, `carouselStore` lacks persistence actions and dirty state. We must add:
```ts
export interface CarouselState {
  currentCarousel: Carousel | null;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  lastSavedAt: string | null;
  // ... existing fields ...
  saveCarouselToDb: () => Promise<boolean>;
  loadCarouselFromDb: (projectId: string) => Promise<boolean>;
  markDirty: () => void;
  setSaveStatus: (status: 'saved' | 'saving' | 'unsaved') => void;
}
```
Every mutating action in `carouselStore` (e.g. `setRatio`, `addSlide`, `deleteSlide`, `reorderSlide`, `updateSlideBackground`, `addPhotoFrame`, `addPhotoFrames`, `updatePhotoFrame`, `removePhotoFrame`, `applyCarouselLayout`, `batchUpdateFrames`, `swapFrames`) must invoke `markDirty()`.

Now let's examine `projectStore.ts`. Currently, `saveProject`, `openProjectById`, `openProjectFromFile`, and `createNewProject` are hardcoded to `albumStore`!
Here is how we adjust `saveProject`:
```ts
saveProject: async (options = {}) => {
  const current = get().currentProject;
  // ... checks ...
  const isCarousel = current.canvasUnit === 'px' || (current as any).projectType === 'carousel';

  if (isCarousel) {
    const { useCarouselStore } = await import('./carouselStore');
    const cs = useCarouselStore.getState();
    if (!cs.currentCarousel || cs.currentCarousel.projectId !== current.id) {
      throw new Error('Carousel project is not initialized.');
    }
    cs.setSaveStatus('saving');
    const ok = await cs.saveCarouselToDb();
    if (!ok) {
      cs.setSaveStatus('unsaved');
      throw new Error('Failed to save carousel to SQLite recovery database.');
    }
    // Write .afsn file
    if (workingPath) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('export_afsn_package', { projectId: current.id, targetPath: workingPath });
    }
    cs.setSaveStatus('saved');
    return { success: true, filePath: workingPath, isSaveAs: false };
  } else {
    // Existing Print Album save logic
  }
}
```
And in `openProjectById`:
```ts
if (project) {
  // ...
  const isCarousel = project.canvasUnit === 'px' || (project as any).projectType === 'carousel';
  if (isCarousel) {
    const { useCarouselStore } = await import('./carouselStore');
    const loaded = await useCarouselStore.getState().loadCarouselFromDb(project.id);
    if (!loaded) {
      useCarouselStore.getState().initializeCarousel(project.id);
    }
    useCarouselStore.getState().setSaveStatus('saved');
  } else {
    const { useAlbumStore } = await import('./albumStore');
    const loaded = await useAlbumStore.getState().loadAlbumFromDb(project.id);
    if (!loaded) {
      useAlbumStore.getState().initializeAlbum(project);
    }
    useAlbumStore.getState().setSaveStatus('saved');
  }
}
```
And when creating a project in `NewProjectDialog`:
When `projectMode === 'carousel'`, `createNewProject` creates the project record, calls `initializeCarousel`, and **immediately awaits `saveCarouselToDb()`** so the initial template is immediately written to SQLite with `saveStatus = 'saved'`!"

#### 🛡️ macOS HIG & Window Guard Adversary
"Hold on! What if the user switches modes using the Mode Switcher in `AppTitleBar`?
In `15-CONTEXT.md` Section 1.1, there is a **Locked Implementation Decision**:
> **Exclusive Mode Projects** — Projects are established at creation time as either `'print'` (Print Album) or `'carousel'` (Social Carousel). This fundamentally simplifies state synchronization, persistence boundaries, and UI chrome.

If projects are strictly exclusive:
1. When opening a carousel project (`canvasUnit === 'px'`), `activeMode` is forced to `'carousel'`. The mode switcher in `AppTitleBar` should either reflect the fixed mode or disable switching modes on an existing project.
2. In Phase 16, workspace isolation will formally hoist `activeMode` to `appStore`. For Phase 15, we must ensure that whether a project is opened via `openProjectById`, `openProjectFromFile`, or `importProjectFromAfsn`, it initializes the correct store without attempting to save dummy album spreads for carousel projects!"

---

### Round 4: Autosave Engine, Dirty State Tracking & Titlebar Status Indicator

#### 🎨 Frontend State & Lifecycle Engineer
"Let's look at `src/features/persistence/useAutoSave.ts`.
Currently:
```ts
export function useAutoSave() {
  const currentAlbum = useAlbumStore((s) => s.currentAlbum);
  const saveStatus = useAlbumStore((s) => s.saveStatus);
  // ...
}
```
It only listens to `currentAlbum` and `useAlbumStore.saveStatus`!
We must upgrade `useAutoSave.ts` to detect the project type and bind to `useCarouselStore`:
```ts
export function useAutoSave() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const isCarousel = currentProject?.canvasUnit === 'px' || (currentProject as any)?.projectType === 'carousel';

  const albumSaveStatus = useAlbumStore((s) => s.saveStatus);
  const carouselSaveStatus = useCarouselStore((s) => s.saveStatus);
  const currentCarousel = useCarouselStore((s) => s.currentCarousel);

  const saveStatus = isCarousel ? carouselSaveStatus : albumSaveStatus;

  // 1. Crash snapshot recovery
  useEffect(() => {
    if (!currentProject) return;
    if (isCarousel && currentCarousel && currentCarousel.projectId === currentProject.id) {
      try {
        localStorage.setItem(
          `afsn_carousel_snapshot_${currentProject.id}`,
          JSON.stringify({
            projectId: currentProject.id,
            savedAt: new Date().toISOString(),
            carousel: currentCarousel,
          })
        );
      } catch {}
    }
  }, [isCarousel, currentCarousel, currentProject]);

  // 2. Dirty tracking flag
  useEffect(() => {
    if (!currentProject) return;
    try {
      const key = `afsn_dirty_${currentProject.id}`;
      if (saveStatus === 'saved') localStorage.removeItem(key);
      else localStorage.setItem(key, '1');
    } catch {}
  }, [currentProject, saveStatus]);

  // 3. Debounced Autosave (2.5s)
  useEffect(() => {
    if (!autoSaveEnabled || saveStatus !== 'unsaved') return;
    debounceTimerRef.current = window.setTimeout(() => {
      void useProjectStore.getState().saveProject({ automatic: true });
    }, 2500); // 2.5 second debounce per 15-CONTEXT

    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    };
  }, [autoSaveEnabled, saveStatus, isCarousel, currentCarousel, currentProject]);
}
```
And in `src/features/workspace/AppTitleBar.tsx`:
```tsx
const isCarousel = currentProject?.canvasUnit === 'px' || (currentProject as any)?.projectType === 'carousel';
const albumSaveStatus = useAlbumStore((s) => s.saveStatus);
const carouselSaveStatus = useCarouselStore((s) => s.saveStatus);
const saveStatus = isCarousel ? carouselSaveStatus : albumSaveStatus;

const albumLastSavedAt = useAlbumStore((s) => s.lastSavedAt);
const carouselLastSavedAt = useCarouselStore((s) => s.lastSavedAt);
const lastSavedAt = isCarousel ? carouselLastSavedAt : albumLastSavedAt;
```
When `saveStatus === 'unsaved'`, `AppTitleBar` displays an amber glowing status dot (`#F59E0B`, CSS class `statusDotUnsaved`), and tooltip `"Unsaved changes (⌘S to save)"`. Once saved, it switches to green (`#10B981`) with `"All changes saved"`."

#### 🛡️ macOS HIG & Window Guard Adversary
"What about immediate autosave on window blur or deactivation?
In `15-CONTEXT.md` Section 1.2:
> Autosave Timing: Debounced 2–3 seconds after any slide/frame alteration, plus **immediate persistence on `Cmd+S`, menu Save, or application window blur/deactivation**."

#### 🎨 Frontend State & Lifecycle Engineer
"Yes! We can add a window blur listener inside `useAutoSave.ts`:
```ts
useEffect(() => {
  const handleBlur = () => {
    const isDirty = isCarousel 
      ? useCarouselStore.getState().saveStatus === 'unsaved' 
      : useAlbumStore.getState().saveStatus === 'unsaved';
    if (isDirty) {
      void useProjectStore.getState().saveProject({ automatic: true });
    }
  };
  window.addEventListener('blur', handleBlur);
  return () => window.removeEventListener('blur', handleBlur);
}, [isCarousel]);
```
When the user switches to Finder, Slack, or another app, any pending edits are flushed immediately to SQLite without waiting for the 2.5s timer!"

---

### Round 5: macOS HIG Window Close Safeguards & Crash Resilience

#### 🛡️ macOS HIG & Window Guard Adversary
"Now we come to the most critical bug in the existing codebase: **Window Close Interception**!
Look at `src/App.tsx` lines 151–175:
```ts
const syncUnsavedStatus = () => {
  import('@tauri-apps/api/core').then(({ invoke }) => {
    const project = useProjectStore.getState().currentProject;
    const saveStatus = useAlbumStore.getState().saveStatus; // <--- BUG!
    const isUnsaved = Boolean(project && (saveStatus !== 'saved' || ...));
    invoke('set_unsaved_status', { unsaved: isUnsaved }).catch(() => {});
  });
};
```
Because `syncUnsavedStatus` ONLY inspects `useAlbumStore.getState().saveStatus`, `AppExitState.is_unsaved` in Rust is `false` when editing a carousel!
When a user presses `Cmd+Q`, clicks the red traffic light, or presses `Cmd+W`:
In `src-tauri/src/lib.rs` line 58:
```rust
if state.is_unsaved.load(std::sync::atomic::Ordering::Relaxed) {
    api.prevent_close();
    let _ = window.emit("request-close-warning", ());
}
```
Because `is_unsaved` is false, Tauri does NOT call `api.prevent_close()`! The window closes instantly, destroying all carousel edits!

We must fix this immediately:
```ts
const syncUnsavedStatus = () => {
  import('@tauri-apps/api/core').then(({ invoke }) => {
    const project = useProjectStore.getState().currentProject;
    const isCarousel = project?.canvasUnit === 'px' || (project as any)?.projectType === 'carousel';
    const albumStatus = useAlbumStore.getState().saveStatus;
    const carouselStatus = useCarouselStore.getState().saveStatus;
    const currentStatus = isCarousel ? carouselStatus : albumStatus;

    const isUnsaved = Boolean(
      project && (
        currentStatus !== 'saved' ||
        useProjectStore.getState().isSaving ||
        usePhotoStore.getState().isRemoving ||
        usePhotoStore.getState().isRelinking
      )
    );
    invoke('set_unsaved_status', { unsaved: isUnsaved }).catch(() => {});
  });
};

const unsubAlbum = useAlbumStore.subscribe(syncUnsavedStatus);
const unsubCarousel = useCarouselStore.subscribe(syncUnsavedStatus); // <--- REQUIRED
const unsubProject = useProjectStore.subscribe(syncUnsavedStatus);
```
With this fix, whenever a carousel slide or frame is modified, Rust is immediately informed that `is_unsaved` is `true`. Any window close attempt will trigger `api.prevent_close()` and emit `request-close-warning`."

#### 🎨 Frontend State & Lifecycle Engineer
"And what dialog should be shown when `request-close-warning` fires?
In `src/features/workspace/WorkspaceLayout.tsx`, we already have `ConfirmDialog`:
```tsx
<ConfirmDialog
  isOpen={pendingSafeAction !== null}
  title="Unsaved Changes"
  message={`You have unsaved changes in "${currentProject?.name}". Do you want to save them before leaving?`}
  detail="If you leave without saving, your recent layouts and edits since the last save will be lost."
  confirmText="Save & Continue"
  secondaryText="Don't Save"
  cancelText="Cancel"
  variant="warning"
  onConfirm={async () => {
    const result = await saveProject();
    if (!result.success) return;
    const act = pendingSafeAction;
    setPendingSafeAction(null);
    if (act) await act();
  }}
  onSecondary={async () => {
    const act = pendingSafeAction;
    setPendingSafeAction(null);
    if (act) await act();
  }}
  onCancel={() => setPendingSafeAction(null)}
/>
```
In `src/App.tsx`, `useAppStore.getState().openExitWarning()` opens the modal.
When the user clicks:
1. **Save & Continue**: executes `saveProject()`, clears unsaved status, and invokes `exit_app` or closes window.
2. **Don't Save**: clears dirty state, and invokes `exit_app`.
3. **Cancel**: closes the dialog and keeps the application open.
This strictly follows Apple Human Interface Guidelines for document-based macOS apps."

#### 🏛️ Rust & SQLite Systems Architect
"What about Thumbnail Caching mentioned in `15-CONTEXT.md` Section 1.3?
> 'On save, the application renders and caches a high-fidelity PNG thumbnail of slide 1 (`cover`) to disk for instant preview in the Recent Projects browser.'

How should this be structured?"

#### 🎨 Frontend State & Lifecycle Engineer
"On the frontend, when `saveProject()` succeeds, we can grab Konva's stage reference or export slide 0 as a data URL:
```ts
const dataUrl = stage.toDataURL({
  x: 0,
  y: 0,
  width: currentCarousel.slideWidthPx,
  height: currentCarousel.slideHeightPx,
  pixelRatio: 0.25, // e.g. 270x270 or 270x337
});
```
Then invoke a Tauri command `save_project_thumbnail(projectId, base64Png)` that writes it to `app_cache_dir/project_thumbnails/{projectId}.png`.
Then `WelcomeScreen.tsx` can render `<img src={thumbnailUrl} />` instead of the generic `<Image />` icon! If the thumbnail is not yet generated, it falls back to the generic icon."

---

## 4. Architecture Contracts & Specifications

### 4.1 SQLite Schema DDL (`migrate_v16`)

```sql
-- Migration v16: Social Carousel Schema & Project Discriminator
BEGIN;

-- 1. Add project_type discriminator to projects
ALTER TABLE projects ADD COLUMN project_type TEXT NOT NULL DEFAULT 'print';
UPDATE projects SET project_type = 'carousel' WHERE canvas_unit = 'px';

-- 2. Carousels parent table
CREATE TABLE IF NOT EXISTS carousels (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE,
    ratio TEXT NOT NULL DEFAULT '1:1',
    slide_width_px INTEGER NOT NULL DEFAULT 1080,
    slide_height_px INTEGER NOT NULL DEFAULT 1080,
    total_slides INTEGER NOT NULL DEFAULT 3,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_carousels_project ON carousels(project_id);

-- 3. Carousel Slides table
CREATE TABLE IF NOT EXISTS carousel_slides (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    slide_index INTEGER NOT NULL,
    width_px INTEGER NOT NULL DEFAULT 1080,
    height_px INTEGER NOT NULL DEFAULT 1080,
    background_color TEXT NOT NULL DEFAULT '#FFFFFF',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_carousel_slides_project ON carousel_slides(project_id);
CREATE INDEX IF NOT EXISTS idx_carousel_slides_index ON carousel_slides(project_id, slide_index);

-- 4. Carousel Photo Frames table
CREATE TABLE IF NOT EXISTS carousel_frames (
    id TEXT PRIMARY KEY,
    slide_id TEXT NOT NULL,
    photo_id TEXT,
    file_path TEXT NOT NULL DEFAULT '',
    file_name TEXT NOT NULL DEFAULT '',
    preview_path TEXT,
    thumbnail_path TEXT,
    x REAL NOT NULL DEFAULT 0.0,
    y REAL NOT NULL DEFAULT 0.0,
    width REAL NOT NULL DEFAULT 1080.0,
    height REAL NOT NULL DEFAULT 1080.0,
    rotation REAL NOT NULL DEFAULT 0.0,
    z_index INTEGER NOT NULL DEFAULT 1,
    photo_aspect REAL NOT NULL DEFAULT 1.0,
    crop_x REAL NOT NULL DEFAULT 0.0,
    crop_y REAL NOT NULL DEFAULT 0.0,
    crop_scale REAL NOT NULL DEFAULT 1.0,
    crop_rotation REAL NOT NULL DEFAULT 0.0,
    border_enabled INTEGER NOT NULL DEFAULT 0,
    border_width REAL NOT NULL DEFAULT 0.0,
    border_color TEXT NOT NULL DEFAULT '#FFFFFF',
    border_style TEXT NOT NULL DEFAULT 'solid',
    opacity REAL NOT NULL DEFAULT 1.0,
    locked INTEGER NOT NULL DEFAULT 0,
    shape_type TEXT NOT NULL DEFAULT 'rectangle',
    custom_svg_path TEXT,
    corner_radius_tl REAL NOT NULL DEFAULT 0.0,
    corner_radius_tr REAL NOT NULL DEFAULT 0.0,
    corner_radius_br REAL NOT NULL DEFAULT 0.0,
    corner_radius_bl REAL NOT NULL DEFAULT 0.0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(slide_id) REFERENCES carousel_slides(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_carousel_frames_slide ON carousel_frames(slide_id);
CREATE INDEX IF NOT EXISTS idx_carousel_frames_photo ON carousel_frames(photo_id);

-- 5. Bump schema version
INSERT INTO schema_version (version) VALUES (16);

COMMIT;
```

---

### 4.2 Rust Data Types (`src-tauri/src/db/mod.rs`)

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CarouselFramePayload {
    pub id: String,
    pub photo_id: Option<String>,
    #[serde(default)]
    pub file_path: String,
    #[serde(default)]
    pub file_name: String,
    pub preview_path: Option<String>,
    pub thumbnail_path: Option<String>,
    #[serde(default)]
    pub x: f64,
    #[serde(default)]
    pub y: f64,
    #[serde(default)]
    pub width: f64,
    #[serde(default)]
    pub height: f64,
    #[serde(default)]
    pub rotation: f64,
    #[serde(default)]
    pub z_index: Option<i32>,
    #[serde(default)]
    pub photo_aspect: Option<f64>,
    #[serde(default)]
    pub crop_x: Option<f64>,
    #[serde(default)]
    pub crop_y: Option<f64>,
    #[serde(default)]
    pub crop_scale: Option<f64>,
    #[serde(default)]
    pub border_enabled: Option<bool>,
    #[serde(default)]
    pub border_width: Option<f64>,
    pub border_color: Option<String>,
    pub border_style: Option<String>,
    #[serde(default)]
    pub locked: Option<bool>,
    pub shape_type: Option<String>,
    pub custom_svg_path: Option<String>,
    #[serde(default)]
    pub corner_radius_tl: Option<f64>,
    #[serde(default)]
    pub corner_radius_tr: Option<f64>,
    #[serde(default)]
    pub corner_radius_br: Option<f64>,
    #[serde(default)]
    pub corner_radius_bl: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CarouselSlidePayload {
    pub id: String,
    pub slide_index: i32,
    pub width_px: i32,
    pub height_px: i32,
    pub background_color: String,
    #[serde(default)]
    pub elements: Vec<CarouselFramePayload>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CarouselPayload {
    pub id: String,
    pub project_id: String,
    pub ratio: String,
    pub slide_width_px: i32,
    pub slide_height_px: i32,
    pub total_slides: i32,
    #[serde(default)]
    pub slides: Vec<CarouselSlidePayload>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectPackagePayload {
    pub version: i32,
    pub project: ProjectRow,
    pub photos: Vec<PhotoRow>,
    pub folders: Vec<PhotoFolderRow>,
    pub album: Option<AlbumPayload>,
    #[serde(default)]
    pub folder_members: Vec<FolderMemberPayload>,
    #[serde(default)]
    pub carousel: Option<CarouselPayload>,
}
```

---

### 4.3 IPC Tauri Commands (`src-tauri/src/commands/project_commands.rs`)

| Command Name | Arguments | Return Type | Description |
|--------------|-----------|-------------|-------------|
| `save_carousel_structure` | `carousel: CarouselPayload` | `Result<(), String>` | Persists slides and frames into SQLite tables within an atomic transaction. |
| `load_carousel_structure` | `project_id: String` | `Result<Option<CarouselPayload>, String>` | Reads carousel, slides, and frames for a project; returns `Ok(None)` if no carousel exists. |
| `save_project_thumbnail` | `project_id: String, base64_png: String` | `Result<String, String>` | Writes base64 PNG cover preview to cache dir for Recent Projects browser. |

---

### 4.4 Data Flow Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Canvas as CarouselCanvas
    participant CStore as useCarouselStore
    participant ASave as useAutoSave
    participant PStore as useProjectStore
    participant Title as AppTitleBar
    participant App as App.tsx
    participant Rust as Tauri 2 Backend (Rust/SQLite)
    participant Disk as SQLite / .afsn

    User->>Canvas: Drag photo / move frame
    Canvas->>CStore: updatePhotoFrame(...)
    CStore->>CStore: markDirty() (saveStatus = 'unsaved')
    CStore-->>Title: Re-render: Amber dot (#F59E0B) "Unsaved Changes"
    CStore-->>App: Subscriber triggers syncUnsavedStatus()
    App->>Rust: invoke('set_unsaved_status', { unsaved: true })
    
    par Debounced Autosave (2.5s)
        ASave->>PStore: saveProject({ automatic: true })
    and Immediate Cmd+S
        User->>PStore: Cmd+S (saveProject())
    end

    PStore->>CStore: setSaveStatus('saving')
    CStore-->>Title: Re-render: Spinner / 'Saving changes...'
    PStore->>Rust: invoke('save_carousel_structure', { carousel })
    Rust->>Disk: BEGIN; UPSERT carousels; REPLACE slides/frames; COMMIT;
    Disk-->>Rust: Ok(())
    Rust-->>PStore: Ok(())
    
    opt If .afsn file exists
        PStore->>Rust: invoke('export_afsn_package', { projectId, targetPath })
        Rust->>Disk: Atomic write project.afsn with carousel payload
    end

    PStore->>CStore: setSaveStatus('saved')
    CStore-->>Title: Re-render: Green dot (#10B981) "All changes saved"
    CStore-->>App: Subscriber triggers syncUnsavedStatus()
    App->>Rust: invoke('set_unsaved_status', { unsaved: false })
```

---

## 5. Unanimous Consensus & Implementation Plan

### 5.1 Consensus Points
1. **Schema Migration 16:** Implement `migrate_v16` in `src-tauri/src/db/mod.rs` to create `carousels`, `carousel_slides`, and `carousel_frames` tables with `ON DELETE CASCADE`. Bump `Database::expected_version()` to 16.
2. **Unified `.afsn` Package:** Add `pub carousel: Option<CarouselPayload>` to `ProjectPackagePayload`. Ensure `export_bundled_project_package_with_progress` packages carousel frame photos into `photos/`.
3. **Frontend Store Integration:** Add `saveStatus`, `lastSavedAt`, `saveCarouselToDb`, `loadCarouselFromDb`, and `markDirty` to `src/stores/carouselStore.ts`.
4. **Hydration in `projectStore.ts`:** Branch `saveProject`, `openProjectById`, `openProjectFromFile`, and `createNewProject` to handle Carousel vs Print mode exclusively.
5. **Autosave Engine Overhaul:** Update `src/features/persistence/useAutoSave.ts` to track carousel dirty state, debounce autosave at 2.5s, save `afsn_carousel_snapshot_${id}` to localStorage, and immediately flush on window `blur`.
6. **macOS HIG Window Guard Fix:** Update `src/App.tsx` `syncUnsavedStatus` to subscribe to `carouselStore` and synchronize `is_unsaved` with Rust. Confirm `WindowEvent::CloseRequested` blocks close when dirty and prompts the 3-button confirmation sheet.
7. **Titlebar Status Indicator:** Render amber dot (`#F59E0B`) with `"Unsaved Changes"` when dirty and green dot (`#10B981`) when saved.
8. **Thumbnail Caching:** Implement thumbnail PNG generation and caching for slide 1 for fast Recent Projects preview.

---

### 5.2 Phased Task Plan for Phase 15

- [ ] **Plan 15-01: SQLite Schema Migration & Rust IPC Persistence Layer**
  - Implement `migrate_v16` in `src-tauri/src/db/mod.rs` (`carousels`, `carousel_slides`, `carousel_frames`, and `projects.project_type`).
  - Add `CarouselPayload`, `CarouselSlidePayload`, and `CarouselFramePayload` structs.
  - Extend `ProjectPackagePayload` with `pub carousel: Option<CarouselPayload>`.
  - Implement `save_carousel_structure` and `load_carousel_structure` in `src-tauri/src/db/mod.rs` and `src-tauri/src/commands/project_commands.rs`.
  - Update `export_bundled_project_package_with_progress` and `store_project_package_with_identity` in `package_io.rs` to serialize/deserialize carousel data and bundle placed frame photos.
  - Register new commands in `src-tauri/src/lib.rs`.
  - Add Rust unit tests in `src-tauri/src/db/tests.rs` for carousel CRUD, migration, and package roundtrip.

- [ ] **Plan 15-02: Frontend Store Persistence, Autosave & Project Hydration**
  - Add `saveStatus`, `lastSavedAt`, `saveCarouselToDb`, `loadCarouselFromDb`, and `markDirty` to `src/stores/carouselStore.ts`.
  - Hook all carousel mutations to invoke `markDirty()`.
  - Overhaul `src/stores/projectStore.ts` (`saveProject`, `openProjectById`, `openProjectFromFile`, `importProjectFromAfsn`, `createNewProject`) to branch on project mode.
  - Overhaul `src/features/persistence/useAutoSave.ts` for carousel autosave, localStorage crash snapshot, and window blur trigger.
  - Wire `AppTitleBar.tsx` status indicator to reflect active carousel save status.

- [ ] **Plan 15-03: macOS Window Close Interception Guard, HIG Sheet & Thumbnail Caching**
  - Fix `src/App.tsx` `syncUnsavedStatus` to subscribe to `useCarouselStore`.
  - Wire window close warning handler to present `ConfirmDialog` with Save / Don't Save / Cancel.
  - Implement cover slide thumbnail rendering on save and cache to disk.
  - Update `WelcomeScreen.tsx` to display cached project thumbnail in recent list.
  - End-to-end verification of `Cmd+S`, autosave, project reopen, and dirty close protection.
