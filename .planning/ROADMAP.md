# Roadmap: OpenSmartAlbum-MacOS

## Milestones

- ✅ **v1.0 MVP** - Foundation & Studio Canvas Core (Phases 01-05, Shipped)
- ✅ **v1.1 Core Workflow Hardening** - Ingestion, Hybrid Carousel & Vector Shapes (Phases 06-09, Shipped 2026-09-23)
- ✅ **v1.2.0 Unlimited Studio Layout & Storytelling Engine** - Phases 10-13 (Shipped 2026-09-28)
- 🚧 **v1.3.0 Workspace Isolation, Carousel Persistence & Vector Shape Polish** - Phases 14-17 (Active)

---

## Phases

<details>
<summary>✅ Shipped Milestones (Phases 01-13) - COMPLETED</summary>

### Phase 01: Core Architecture & Canvas Foundation
- [x] 01-01: Tauri + Vite + React 18 Canvas Foundation

### Phase 02: Layout Engine & Templating
- [x] 02-01: Static grid layouts & spread management

### Phase 03: Photo Ingestion & Library Tray
- [x] 03-01: Asset pipeline, thumbnails, and filmstrip

### Phase 04: Inspector & Styling Controls
- [x] 04-01: Stroke, shadow, spacing, and typography controls

### Phase 05: Export & Print PDF Pipeline
- [x] 05-01: 300 DPI CMYK PDF generation & export

### Phase 06: Finder Drag-and-Drop Dual Ingestion Pipeline
- [x] 06-01: Native OS file drop to filmstrip or canvas with visual HUD

### Phase 07: Social Carousel Hybrid Layout & Photo Placement Engine
- [x] 07-01: HTML5 drop support, ratio switching, and slide panorama presets

### Phase 08: Studio Layout Preview Contrast & Zero-Lag Shuffling
- [x] 08-01: Studio silhouettes, 3-tier match score badge, and deterministic LRU cache

### Phase 09: Vector Shape Masking & In-Shape Crop Engine
- [x] 09-01: Pure Canvas 2D path clipping, 1:1 centering, and contour vector borders

### Phase 10: Dynamic Generative Layout Core & Non-Destructive Studio Cycling
- [x] 10-01: Pure TS R-BSP engine, row/col normalizers, non-destructive Spacebar cycling, zero blanks

### Phase 11: Auto-Flow Multi-Spread Storytelling Engine
- [x] 11-01: Chronological EXIF burst clustering, narrative pacing heuristics, and asynchronous streaming
- [x] 11-02: Canvas drop ingestion handler, batch action toolbar, atomic history transaction wrapper

### Phase 12: Contextual Right-Click Studio Actions & Panorama Span Engine
- [x] 12-01: Right-click studio actions menu, photo prominence rebalancing, spine exclusion
- [x] 12-02: Seamless carousel panorama span engine, virtual cut lines, export slicing

### Phase 13: Interactive In-Canvas Divider Dragging & Direct Photo Swapping
- [x] 13-01: Konva divider guideline layer, 60fps RAF dragging, min/max split clamping
- [x] 13-02: In-canvas direct photo swapping with visual hover rings, single-undo history commit

</details>

---

### 🚧 Milestone v1.3.0: Workspace Isolation, Carousel Persistence & Vector Shape Polish (In Progress)

**Milestone Goal:** Menghadirkan isolasi workspace Print Album vs Social Carousel yang solid, persistensi penuh Carousel ke SQLite dan `.afsn`, keandalan drag-and-drop batch multi-foto tanpa blank frame, perbaikan perutean context menu/double-click, serta fillet corner radius pada seluruh vector shape masks.

#### Phase 14: Carousel Canvas Multi-Photo Drag-and-Drop & Filmstrip Context Routing
**Goal**: Resolve WebKit drag session cancellations and coordinate desync during Filmstrip drags to Carousel Canvas; ensure atomic single-step history commits for batch drops and mode-aware context menu/double-click routing.
**Depends on**: Phase 13
**Requirements**: CAR-01, CAR-02, CAR-03, CAR-04
**Success Criteria** (what must be TRUE):
  1. Dragging 1 to 10+ selected photos (or using the batch drag handle) from Filmstrip Tray onto Carousel Canvas reliably places all photos onto the targeted slide without canvas blanking or WebKit drag cancellation.
  2. The drag ghost badge remains within visible viewport bounds with non-interfering opacity (`opacity: 0.01`, `pointer-events: none`), preventing macOS WebKit snapshot clipping.
  3. Dropping $N$ photos onto a slide batches frame creation into a single state update with a single atomic undo/redo history entry (`Cmd+Z` undoes the entire placement).
  4. Filmstrip context menu (`PhotoContextMenu`) and card double-click actions detect `activeMode`, routing photo placement to the active slide in Carousel mode and to the active spread in Print Album mode with mode-appropriate labels.
**Plans**: 2 plans
  - [x] 14-01: Canvas & WebKit Drag Interception, In-Bounds Ghost Badge & Slide Auto-Glide
  - [x] 14-02: Atomic Store Batch Placement with R-BSP Reflow & Mode-Aware Context Routing

#### Phase 15: Social Carousel Full SQLite & Package Persistence
**Goal**: Implement SQLite schema tables and `.afsn` archive serialization for Social Carousel projects, dirty state tracking, and window close safeguards to eliminate carousel data loss.
**Depends on**: Phase 14
**Requirements**: PERS-01, PERS-02, PERS-03, PERS-04
**Success Criteria** (what must be TRUE):
  1. Triggering `Cmd+S`, "File > Save", or background autosave persists all carousel slides, photo frames, aspect ratio, custom backgrounds, and slide order into SQLite and the `.afsn` project archive.
  2. Closing and reopening an `.afsn` project or restarting the application fully restores the complete carousel layout, frame positions, crop geometry, and customizations without data loss.
  3. Modifying any carousel slide or frame marks the project as dirty, updating the title bar status indicator to amber ("Unsaved Changes"), and clearing back to green upon saving.
  4. Attempting to close the window or quit the app with unsaved carousel modifications displays the native macOS unsaved changes confirmation dialog.
**Plans**: 3 plans
  - [x] 15-01: SQLite Schema Migration `migrate_v16` & Rust IPC Persistence Layer
  - [x] 15-02: Frontend Store Persistence, Autosave Engine & Project Hydration
  - [x] 15-03: macOS Window Close Guard, Native Confirmation Sheet, and Thumbnail Caching

#### Phase 16: Workspace Isolation & Mode State Synchronization
**Goal**: Establish clean workspace isolation between Print Album and Social Carousel environments by hoisting `activeMode` to global state, isolating zoom levels, mode-guarding title bar controls and keyboard shortcuts, and preventing frame coordinate detachment during slide reordering or layout cycling.
**Depends on**: Phase 15
**Requirements**: ISO-01, ISO-02, ISO-03, ISO-04, ISO-05
**Success Criteria** (what must be TRUE):
  1. Opening a project auto-selects the appropriate workspace mode based on project configuration (`canvas.unit === 'px'` activates Carousel mode, physical units activate Print mode), with `activeMode` globally available across all components.
  2. Switching back and forth between Print Album and Social Carousel preserves each mode's individual viewport zoom level and pan coordinates without scaling jumps (`printZoom` vs `carouselZoom`).
  3. Title bar controls (Undo/Redo, "Add Text", Export) and single-key shortcuts (`T`, `L`, `G`, `P`) dispatch strictly to the active mode's store, preventing silent mutations on background spreads.
  4. Reordering, duplicating, or deleting slides in `carouselStore` automatically recalculates and shifts contained frames' absolute `x` coordinates, keeping photo frames attached to their respective slides.
  5. Cycling layouts (`Spacebar`) or applying auto-flow on carousel slides preserves custom frame borders, corner radii, and vector shape masks.
**Plans**: 3 plans
  - [x] 16-01: `appStore` Mode & Viewport Hoisting + `projectStore` Auto-Mode Detection (ISO-01, ISO-02)
  - [x] 16-02: AppTitleBar Mode-Guarding & Keyboard Shortcut Isolation (ISO-03)
  - [x] 16-03: Slide Coordinate Preservation & Layout Style Retention (ISO-04, ISO-05)

#### Phase 17: Vector Shape Mask Corner Radii & Polygon Tangent Fillets
**Goal**: Implement mathematical vertex tangent fillet arcs for smooth corner rounding on all polygon and star shapes in Canvas 2D and SVG, unlock Inspector corner radius controls for all shapes, normalize custom SVG viewBox dimensions, and expose the Oval shape preset.
**Depends on**: Phase 16
**Requirements**: VEC-01, VEC-02, VEC-03, VEC-04
**Success Criteria** (what must be TRUE):
  1. Selecting any polygon shape preset (Hexagon, Octagon, Star, Scallop, Heart) in the Inspector displays active Corner Radius slider and numeric input controls, removing the rectangle-only restriction.
  2. Adjusting corner radius on polygons and stars computes smooth mathematical vertex fillet curves (`c.arcTo` in Canvas 2D and quadratic bezier/arc in SVG) in `src/domain/shapes.ts` rather than sharp, unrounded vertices.
  3. Uploading a custom SVG vector mask automatically normalizes `viewBox` coordinates and dimensions, fitting the mask properly to the photo frame aspect ratio without clipping groups failing.
  4. The Inspector's shape preset grid provides an "Oval" button alongside Circle that applies an elliptical vector mask with full contour border and pan/zoom crop support.
**Plans**: 3 plans
  - [ ] 17-01: Mathematical Polygon & Star Fillet Generator + Unified SVG Path Engine (VEC-02, VEC-04)
  - [ ] 17-02: Inspector UI Unlock, Oval Preset Button & Tip/Valley Star Controls (VEC-01, VEC-04)
  - [ ] 17-03: Compound SVG Mask Parser, ViewBox Normalization & Rust Export Engine Parity (VEC-03)

---

## Progress

**Execution Order:**
Phases execute in numeric order: 14 → 15 → 16 → 17

| Phase | Milestone | Plans Complete | Status | Completed |
|---|---|---|---|---|
| 10. Dynamic Generative Layout Core | v1.2.0 | 3/3 | COMPLETED | 2026-09-28 |
| 11. Auto-Flow Storytelling Engine | v1.2.0 | 2/2 | COMPLETED | 2026-09-28 |
| 12. Contextual Actions & Panorama Spans | v1.2.0 | 2/2 | COMPLETED | 2026-09-28 |
| 13. Interactive Divider Dragging & Swapping | v1.2.0 | 2/2 | COMPLETED | 2026-09-28 |
| 14. Carousel Multi-Photo Drag & Context Routing | v1.3.0 | 2/2 | COMPLETED | 2026-09-28 |
| 15. Social Carousel SQLite & Package Persistence | v1.3.0 | 3/3 | COMPLETED | 2026-09-29 |
| 16. Workspace Isolation & Mode State Sync | v1.3.0 | 3/3 | COMPLETED | 2026-09-29 |
| 17. Vector Shape Mask Corner Radii & Fillets | v1.3.0 | 0/3 | READY | — |

---
*Roadmap generated: 2026-09-28*
*Milestone: v1.3.0 Workspace Isolation, Carousel Persistence & Vector Shape Polish*
