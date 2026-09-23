# Roadmap: OpenSmartAlbum-MacOS

## Milestones

- ✅ **v1.0 MVP** - Foundation & Studio Canvas Core (Phases 01-05, Shipped)
- ✅ **v1.1 Core Workflow Hardening** - Ingestion, Hybrid Carousel & Vector Shapes (Phases 06-09, Shipped 2026-09-23)
- 🚧 **v1.2.0 Unlimited Studio Layout & Storytelling Engine** - Phases 10-13 (Active)

---

## Phases

<details>
<summary>✅ v1.0 & v1.1 Completed Milestones (Phases 01-09) - SHIPPED</summary>

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

</details>

---

### 🚧 Milestone v1.2.0: Unlimited Studio Layout & Storytelling Engine (In Progress)

**Milestone Goal:** Transform OpenSmartAlbum into an intelligent, generative studio layout and storytelling platform inspired by Pixellu SmartAlbums and Fundy Designer. Eliminates all static preset photo loss and phantom blanks, introduces automatic multi-spread batch ingestion, contextual panorama spans, and 60fps in-canvas divider dragging.

#### Phase 10: Dynamic Generative Layout Core & Non-Destructive Studio Cycling
**Goal**: Implement a pure TypeScript geometric partitioner and aspect-matching engine. Generate valid, aspect-preserving layouts for any $N \in [1..15]$ photos without static templates; provide non-destructive `Spacebar` / `Shift+Space` layout cycling with zero photo dropping and zero blank frames.
**Depends on**: Phase 08, Phase 09
**Requirements**: GEN-01, GEN-02, GEN-03, GEN-04, GEN-05, GEN-06
**Success Criteria** (what must be TRUE):
  1. Pressing `Spacebar` or clicking "Next Layout" cycles through dozens of mathematically valid aspect-preserving layouts for the exact $N$ active photos without dropping any photos.
  2. Switching layout variations never renders an unpopulated or blank/black placeholder frame (`filePath: ''`).
  3. Photos maintain proportional aspect-fill cover fit with zero geometric distortion or stretching across all aspect variations.
  4. Equal-height row normalization and equal-width column normalization eliminate sub-pixel gaps between adjacent photos.
  5. Single-tap `Spacebar` (cycle layout) is cleanly disambiguated from `Space + Drag` (canvas hand pan).
**Plans**: 3 plans (Completed)

Plans:
- [x] 10-01: Implement pure TypeScript R-BSP partitioning, row/column normalizers, and bipartite aspect-matching solver in `src/domain/layout/`.
- [x] 10-02: Eliminate destructive template application in Social Carousel mode; implement non-destructive `cycleSlideLayout` in `carouselStore.ts` and dynamic variation cards in `TemplatesPanel.tsx`.
- [x] 10-03: Implement non-destructive layout cycling in `editorStore.ts` and `albumStore.ts`, remove competing keydown listeners in `LayoutCycleHUD.tsx`, and establish authoritative Spacebar tap-vs-pan disambiguation in `WorkspaceLayout.tsx`.

#### Phase 11: Auto-Flow Multi-Spread Storytelling Engine
**Goal**: Ingest 10–50+ photos in a single batch, automatically cluster them into narrative chapters using EXIF timestamp bursts, and flow them across sequential spreads or slides with balanced visual cadence.
**Depends on**: Phase 10
**Requirements**: FLOW-01, FLOW-02, FLOW-03, FLOW-04, FLOW-05
**Success Criteria** (what must be TRUE):
  1. Dropping 10–50 photos onto the canvas auto-generates multiple sequential spreads (Print Album) or slides (Carousel) with optimal photo distribution (2–5 photos per spread).
  2. Photos taken closely in time (>5 min, >30 min gaps) cluster together in the same spread/chapter without unnatural fragmentation.
  3. Visual cadence alternates between breathing hero moments (1–2 photos) and detailed action moments (3–5 photos).
  4. Off-thread Web Worker (`layoutEngine.worker.ts`) processes batch combinatorial optimization without dropping frames or freezing the macOS UI.
  5. An entire 10-spread auto-flow action can be undone with a single `Cmd+Z` atomic transaction.
**Plans**: 2 plans (Completed)

Plans:
- [x] 11-01: Implement chronological EXIF burst clustering, narrative pacing heuristics, and asynchronous streaming pipeline.
- [x] 11-02: Implement multi-spread auto-flow canvas drop handler, batch action toolbar integration, and atomic history transaction wrapper.

#### Phase 12: Contextual Right-Click Studio Actions & Panorama Span Engine
**Goal**: Enable contextual right-click studio commands on any photo to promote it as a full-bleed spread, seamless panorama span, or hero anchor, dynamically rebalancing remaining photos while honoring spine gutters.
**Depends on**: Phase 10
**Requirements**: CTX-01, CTX-02, CTX-03, CTX-04
**Success Criteria** (what must be TRUE):
  1. Right-clicking any photo in Print Album mode provides `Set as Full Bleed Spread (2-Page Panorama)`, expanding it across both pages and automatically reflowing other photos to adjacent spreads.
  2. Right-clicking any photo in Social Carousel mode provides `Set as Seamless Panorama Span` across 2 or 3 slides with virtual split cut guides.
  3. Right-clicking any photo provides `Set as Hero / Anchor Photo`, giving it dominant layout weighting while re-partitioning remaining slots.
  4. Print album panoramas respect print lab safe spine exclusion zones ($X_{\text{spine}} \pm 0.75\text{ in}$) to protect faces from the binding seam.
**Plans**: 2 plans

Plans:
- [x] 12-01: Implement contextual right-click studio menu and photo prominence rebalancing engine in `src/domain/layout/` and canvas components.
- [x] 12-02: Implement multi-slide seamless panorama spanning with virtual cut lines, spine gutter clearance, and export slicing support.

#### Phase 13: Interactive In-Canvas Divider Dragging & Direct Photo Swapping
**Goal**: Allow real-time dragging of partition divider lines between photos at 60fps using imperative Konva node manipulation, and enable direct drag-and-drop photo swapping between frames.
**Depends on**: Phase 10, Phase 12
**Requirements**: DIV-01, DIV-02, DIV-03, DIV-04, DIV-05
**Success Criteria** (what must be TRUE):
  1. Hovering between adjacent photo frames highlights interactive divider guide lines with appropriate cursor feedback (`col-resize` / `row-resize`).
  2. Dragging a divider line recalculates adjacent frame dimensions smoothly at 60fps without React virtual DOM lag or frame drops.
  3. Drag gestures enforce min/max split clamping (0.15–0.85, $\ge 1.0\text{ in}$) to prevent layout collapse.
  4. Dragging a photo directly onto another frame in the canvas swaps their positions while preserving aspect-fill cover and normalized focal points.
  5. Divider release commits final geometry to store as exactly one undo/redo history entry.
**Plans**: 2 plans

Plans:
- [ ] 13-01: Implement Konva divider guideline layer, hit-testing, imperative ref dragging with RAF coalescing, and split-ratio clamping.
- [ ] 13-02: Implement in-canvas direct photo swapping with visual hover rings, focal point preservation, and atomic history integration.

---

## Progress

**Execution Order:**
Phases execute in numeric order: 10 → 11 → 12 → 13

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 10. Dynamic Generative Layout Core | v1.2.0 | 2/2 | COMPLETED | 2026-09-23 |
| 11. Auto-Flow Storytelling Engine | v1.2.0 | 2/2 | COMPLETED | 2026-09-23 |
| 12. Contextual Actions & Panorama Spans | v1.2.0 | 2/2 | COMPLETED | 2026-09-23 |
| 13. Interactive Divider Dragging & Swapping | v1.2.0 | 2/2 | COMPLETED | 2026-09-23 |

---
*Roadmap generated: 2026-09-23*
*Milestone: v1.2.0 Unlimited Studio Layout & Storytelling Engine*
