# ROADMAP: OpenSmartAlbum-MacOS Milestone v1.1.0

## Milestone v1.1.0: End-to-End Workflow & Core Canvas Hardening

### Phase 06: Finder Drag-and-Drop Dual Ingestion Pipeline
- **Goal:** Enable users to drag photos and folders directly from macOS Finder into the application with automatic dual ingestion (import to library + place on target spread/slide).
- **Deliverables:**
  - `tauri.conf.json` `"dragDropEnabled": true`.
  - Global window drag-drop event hook with frosted glass visual drop HUD.
  - Contextual drop resolution: dropping on Filmstrip Tray imports only; dropping on canvas spread/slide/frame imports and instantly places or replaces photo.
- **Success Criteria:** Dragging files/folders from Finder onto tray imports photos; dragging onto a slide/spread places them immediately.

---

### Phase 07: Social Carousel Hybrid Layout & Photo Placement Engine
- **Goal:** Complete the Social Carousel workflow so users can drag photos, double-click to place, arrange with hybrid layouts (per-slide & seamless panorama spans), and inspect slide metrics.
- **Deliverables:**
  - HTML5 drag-over and drop handlers on `CarouselCanvas.tsx`.
  - Filmstrip double-click handler branching for Carousel Mode.
  - Used-photo tracking reflecting carousel slide contents.
  - Hybrid Carousel Smart Layout presets (1-4 photos per slide + seamless panoramic swipe spans).
  - Context-aware inspector displaying `Active: Slide X (W × H px)`.
- **Success Criteria:** Dragging or double-clicking photos adds them to active carousel slides; hybrid layouts generate clean 1:1, 4:5, and 9:16 arrangements.

---

### Phase 08: Studio Layout Preview Contrast & Zero-Lag Shuffling
- **Goal:** Transform the Smart Layout variations grid into high-contrast studio silhouettes compliant with WCAG and optimize shuffling for instant zero-lag responsiveness.
- **Deliverables:**
  - Inactive card SVG rect redesign with visible studio silhouette (`rgba(255,255,255,0.08)` fill, `rgba(255,255,255,0.22)` stroke).
  - Active card highlighted with vibrant blue accent (`#3b82f6`).
  - Layout variation memoization key based on photo aspect fingerprint to eliminate main-thread freeze.
- **Success Criteria:** All 84 layout preview tiles are clearly visible with high contrast; clicking "Shuffle" updates the canvas and previews instantly without blanking.

---

### Phase 09: Vector Shape Masking & In-Shape Crop Engine
- **Goal:** Restore and harden non-rectangular vector shape clipping (Circle, Oval, Hexagon, Octagon, Star, Heart, Scallop, Custom SVG) across both Album and Carousel modes with in-shape crop and contour borders.
- **Deliverables:**
  - Refactored `drawShapeToContext` in `shapes.ts` tracing commands directly to Konva context without premature `ctx.clip()` calls.
  - Robust vector path parser for Star, Heart, Scallop, and custom SVG paths.
  - In-Shape Pan & Zoom Crop mode inside vector silhouettes on double-click.
  - Accurate contour-following vector borders matching shape outline.
  - Full support in `CarouselCanvas.tsx` and `ShapesBordersSection.tsx`.
- **Success Criteria:** Applying any of the 8 shape presets or SVG files cleanly clips photos with smooth antialiasing in both modes; double-click allows panning and zooming within the shape.
