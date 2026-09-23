# Phase 07: Social Carousel Hybrid Layout & Photo Placement Engine - Context

**Gathered:** 2026-09-22  
**Status:** Ready for planning  

<domain>
## Phase Boundary

Phase 07 transforms Social Carousel Mode from a static viewer into an interactive layout design powerhouse. It implements drag-and-drop and double-click photo placement into carousel slides, hybrid layouts (per-slide arrangements and seamless swipeable panoramic spans), proportional scaling when switching ratios (1:1 ↔ 4:5 ↔ 9:16), and contextual inspector integration.

</domain>

<decisions>
## Implementation Decisions

### 1. Canvas Interactive Drop & Placement
- **D-01:** Implement `onDragOver` and `onDrop` in `src/features/carousel/CarouselCanvas.tsx`.
  - Translate screen drop coordinates `(clientX, clientY)` to continuous carousel canvas space: `canvasX = (clientX - stagePos.x) / scale`.
  - Calculate target slide index using `getSlideIndexAtX(currentCarousel, canvasX)`.
  - Add photo frame centered on that slide via `useCarouselStore.getState().addPhotoFrame(slideIdx, ...)`.
  — **Reversibility:** costly
- **D-02:** Update `FilmstripTray.tsx` double-click handler:
  - If `activeMode === 'carousel'`, add photo to the currently active carousel slide (`activeSlideIndex`).
  — **Reversibility:** reversible
- **D-03:** Update `FilmstripTray.tsx` used-photo detection:
  - When in Carousel Mode, map photo IDs present in `currentCarousel.slides[*].elements` into `usedPhotoIdSet`.
  — **Reversibility:** reversible

### 2. Hybrid Carousel Layout Engine
- **D-04:** The layout generator in Carousel Mode must support a **Hybrid model**:
  - **Per-Slide Layouts:** 1-photo full-bleed, 2-photo vertical/horizontal split, 3-4 photo modern grid within the active slide.
  - **Seamless Panorama Spans:** Multi-slide panoramic photos spanning across adjacent slides (e.g. Slide 1 to 2, or Slide 2 to 3) with exact slicing coordinate alignment for seamless Instagram swipe posts.
  — **Reversibility:** costly — touches carousel domain and layout generator.

### 3. Proportional Scaling on Aspect Ratio Switch
- **D-05:** When the user switches carousel aspect ratio (e.g. `1:1` ↔ `4:5` ↔ `9:16`):
  - Execute **Option A (Proportional Aspect-Fit)**:
  - All existing photo frames on all slides are scaled and repositioned proportionally to fit the new slide dimensions without clipping or going off-canvas.
  — **Reversibility:** costly — touches `carouselStore.setRatio`.

### 4. Contextual Inspector Sidebar
- **D-06:** In `InspectorContainer.tsx` and `TemplatesPanel.tsx`, when `activeMode === 'carousel'`:
  - The header context badge displays `Active: Slide {idx + 1} of {total} ({width} × {height} px)`.
  - The layout panel switches to display Carousel Hybrid presets instead of print album spreads.
  — **Reversibility:** costly — refactors layout panel to accept carousel context.

### Folded Todos
- Folded `02-carousel-photo-placement-layout.md` into this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing:**

- `.planning/FORENSICS.md` — Section 2: Carousel Mode Photo Placement & Layouting Disconnected
- `.planning/CODE-REVIEW.md` — Section 2: Carousel Mode Integration
- `.planning/UI-REVIEW.md` — Section 2: Mode Cohesion & Context Awareness
- `src/domain/carousel.ts` — Carousel domain model, presets, and coordinate helpers
- `src/stores/carouselStore.ts` — Carousel state and action mutations
- `src/features/carousel/CarouselCanvas.tsx` — Canvas rendering and stage coordinates
- `src/features/photos/FilmstripTray.tsx` — Photo card interaction handlers

</canonical_refs>
