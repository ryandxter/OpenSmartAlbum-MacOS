# Plan 14-01 Summary: Canvas & WebKit Drag Interception, In-Bounds Ghost Badge & Slide Auto-Glide

## Execution Metadata
- **Phase:** 14 - Carousel Canvas Multi-Photo Drag-and-Drop & Filmstrip Context Routing
- **Plan:** 14-01
- **Domain:** Konva Canvas Lifecycle, WebKit Native Drag & RAF Viewport Panning
- **Requirements Covered:** `CAR-01`, `CAR-02`
- **Status:** Completed Successfully

---

## Changes Implemented

### Task 1: HTML5 Drag Listeners on `.stageWrapper` in `CarouselCanvas.tsx`
- Relocated HTML5 drag listeners (`onDragOver`, `onDragLeave`, `onDrop`) from outer `.canvasContainer` directly to `div.stageWrapper` to eliminate intermediate pointer interception in macOS WKWebView.
- In `handleDragOver`:
  - Called `e.preventDefault()` and `e.stopPropagation()`.
  - Set `e.dataTransfer.dropEffect = 'copy'` on every tick.
  - Calculated target slide index and detected candidate photo frames under cursor for replacement, updating `hoveredDropSlideIndex` and `hoveredDropReplaceFrameId`.
- In `handleDragLeave`:
  - Added child element flicker prevention: `if (e.currentTarget.contains(e.relatedTarget as Node)) return;`.
  - Reset drop state when leaving the wrapper.
- In `handleDrop`:
  - Computed pixel-accurate canvas continuous coordinates directly from `e.currentTarget.getBoundingClientRect()`.
  - Triggered replacement if dropping directly over an unlocked frame, or added photo frames proportionally.
- In Konva Layer 2:
  - Rendered a glowing cyan dashed indicator ring (`stroke: '#38bdf8'`, `dash: [6, 4]`, `strokeWidth: 2`, `shadowColor: '#38bdf8'`, `shadowBlur: 10`) when `hoveredDropReplaceFrameId === frame.id`.

### Task 2: Shared In-Bounds Drag Ghost Badge Helper
- Created `src/features/photos/dragGhostBadge.ts` containing `setInBoundsDragGhostBadge` and `cleanupDragGhostBadge`.
- Replaced `-1000px, -1000px` offscreen positioning with `fixed; top: 0px; left: 0px; pointer-events: none; z-index: 999999;`.
- Snapshotted the badge at `opacity: 1`, assigned `setDragImage(badge, 20, 16)`, then transitioned to `opacity: 0.01` via `requestAnimationFrame` so WebKit's graphics compositor maintains the layer backing store without culling or aborting the drag session (`NSDragOperationNone`).
- Replaced inline implementations in `FilmstripTray.tsx` and `BatchActionBar.tsx` with the centralized helper.
- Synchronized multi-dataTransfer payloads across both components (`application/x-afsn-photo-ids`, `application/x-afsn-multi-photo`, `application/json`, `text/plain`, and `usePhotoStore.draggedPhotoIds`).

### Task 3: Cancelable 60fps RAF Smooth Panning `smoothPanToSlide`
- Implemented cancelable 60fps RAF panning helper with exact horizontal and vertical centering:
  $$X_{target} = \text{round}\left(\frac{W_c}{2} - \left(X_s + \frac{W_s}{2}\right) \cdot S\right)$$
  $$Y_{target} = \text{round}\left(\frac{H_c}{2} - \frac{H_s}{2} \cdot S\right)$$
- Applied `easeOutCubic` timing curve over 280ms: `ease = 1 - Math.pow(1 - progress, 3)`.
- Invoked `smoothPanToSlide(targetSlideIdx, 280, true)` on drop completion (both for in-place photo replacement and new photo additions).
- Connected gesture cancellation (`cancelSmoothPan`) to `onMouseDown`, `handleWheel`, `fitToScreen`, and component unmount.
- Protected active RAF animations from conflicting with the `prevActiveSlideRef` auto-bring effect.

---

## Verification & Tests

1. **TypeScript Verification:**
   - Ran `npm test` (`tsc --noEmit`) - passed with 0 errors.
2. **Unit Tests:**
   - Added `src/features/carousel/__tests__/dragAndSmoothPan.test.ts` testing:
     - In-bounds ghost badge DOM positioning and RAF opacity lifecycle (`top: 0px, left: 0px`, snapshot at `1`, transitioned to `0.01`).
     - Viewport centering coordinate math for slide bounds across zoom levels.
     - `easeOutCubic` easing curve boundary values ($0 \to 0, 1 \to 1$) and strict monotonicity.
   - Executed via `npx tsx` - all 3 test suites passed.

---

## Git Commits
- `0995a3d` - `fix(photos): in-bounds WebKit drag ghost badge positioning and layer retention`
- `885d1cc` - `feat(carousel): stageWrapper drag interception, replacement ring, and cancelable 60fps RAF smooth panning`
- `1151ebb` - `test(carousel): unit tests for in-bounds ghost badge lifecycle and smooth pan math`
