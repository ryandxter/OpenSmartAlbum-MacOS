# Phase 14 Context: Carousel Canvas Multi-Photo Drag-and-Drop & Filmstrip Context Routing

**Phase Goal:** Resolve WebKit drag session cancellations and coordinate desync during Filmstrip drags to Carousel Canvas; ensure atomic single-step history commits for batch drops and mode-aware context menu/double-click routing.

---

## 1. Locked Implementation Decisions

### 1.1 Drop Target & Viewport Behavior
- **Drop Target Area Routing:** Dropping photos onto the Carousel Canvas (including `.stageWrapper` or the gap between slides) auto-routes to the nearest slide or the currently active slide, positioning the photos centered within that slide's boundaries.
- **Viewport Auto-Scroll:** When a drop lands on a slide that is near the viewport boundary or inactive, the canvas smoothly pans (`smooth pan`) to center the target slide in the viewport and marks it as active (`setActiveSlide`).

### 1.2 Multi-Photo Placement & Content Collision
- **Placement Algorithm:** Multi-photo drops (2–10+ photos) utilize the Dynamic Generative Layout Engine (R-BSP) to generate proportional, aspect-preserving partitions with zero geometric distortion or stretching.
- **Collision with Existing Photos:** If the target slide already contains photos, the engine performs a smart re-flow: existing photos + newly dropped photos are merged into a fresh, proportional layout partition.
- **Direct Replacement on Double-Click:** If a photo frame on the active slide is currently selected and the user double-clicks a filmstrip card, the system replaces the photo inside that selected frame; otherwise, it appends the photo to the active slide's layout.

### 1.3 Context Menu & Double-Click Routing
- **Mode-Aware Labels:** In Social Carousel Mode, `PhotoContextMenu` displays contextual labels: `"Place on Active Slide"` (or `"Place X Photos on Slide N"`) instead of print-oriented "Place on Spread".
- **Filmstrip Tray Routing:** Context menu actions and double-click handlers inspect `activeMode`. When in Carousel mode, they invoke `carouselStore.addPhotoFrames` rather than `editorStore.addPhotosToSpread`.

### 1.4 Native Drag Ghost & WebKit Safeguards
- **Drag Badge / Feedback:** Native macOS drag cursor with standard OS indicator badge, ensuring DOM element positioning remains in-bounds (`display: block; opacity: 0.01; pointer-events: none` or native drag image) so macOS WebKit WKWebView does not cancel the drag session.
- **Canvas Drop Listeners:** Attach `onDragOver`, `onDragLeave`, and `onDrop` directly to `.stageWrapper` with explicit `e.preventDefault()`, matching `KonvaEditorCanvas.tsx`.

### 1.5 History & Undo/Redo Granularity
- **Atomic Batch Transaction:** Dropping multiple photos onto a slide commits as exactly **one** undo history entry. Pressing `Cmd+Z` rolls back the entire batch drop and restores the previous slide layout in a single step.

---

## 2. Requirements Mapped to Phase 14
- `CAR-01`: Drag multiple photos onto CarouselCanvas without blank canvas or WebKit cancellation.
- `CAR-02`: In-bounds drag ghost badge preventing WebKit session cancellation.
- `CAR-03`: Batch photo drop creates all frames in a single update with single atomic undo transaction.
- `CAR-04`: Filmstrip context menu and double-click actions detect `activeMode` and route to Carousel slide.
