# Plan 14-02 Summary: Atomic Store Batch Placement with R-BSP Reflow & Mode-Aware Context Routing

## Execution Metadata
- **Phase:** 14 - Carousel Canvas Multi-Photo Drag-and-Drop & Filmstrip Context Routing
- **Plan:** 14-02
- **Domain:** Zustand Store Architecture, R-BSP Layout Reflow & Mode-Aware Context Routing
- **Requirements Covered:** `CAR-03`, `CAR-04`
- **Status:** Completed Successfully

---

## Changes Implemented

### Task 1: Atomic `addPhotoFrames` in `src/stores/carouselStore.ts` & Canvas Drop Wiring
- Added `addPhotoFrames(slideIndex, photos, options)` to `CarouselState` interface and implementation in `carouselStore.ts`:
  - **Single History Commit:** Invokes `pushHistory()` exactly **once** at transaction start, preventing undo stack pollution when dropping $N$ photos.
  - **Case A (In-Place Frame Replacement):** When `photos.length === 1 && (options?.isReplace || options?.targetFrameId)`: locates the targeted frame (by ID or fallback search), replaces photo references (`photoId`, `filePath`, `fileName`, `previewPath`, `thumbnailPath`, `photoAspect`), resets crop (`cropX: 0, cropY: 0, cropScale: 1.0`), and strictly preserves geometry (`x, y, width, height, rotation, locked`), borders (`borderEnabled, borderWidth, borderColor, borderStyle`), corner radii (`cornerRadius, cornerRadiusTl, cornerRadiusTr, cornerRadiusBr, cornerRadiusBl`), and shape masks (`shapeType, customSvgPath`).
  - **Case B (Adaptive Multi-Photo Drop & Smart Reflow):** Combines existing photo frames on the target slide with newly dropped photos. Generates non-destructive dynamic layout partitions via `generateDynamicVariations({ containerWidth, containerHeight, spacing: 16, isSpread: false }, combinedPhotos)`. Re-applies cached styling metadata to existing frames while generating fresh IDs for newly placed frames.
- Replaced the unbatched loop and naive grid calculation in `handleDrop` (`src/features/carousel/CarouselCanvas.tsx`) with `addPhotoFrames`, maintaining smooth pan centering (`smoothPanToSlide`) and library `usedCount` synchronization.

### Task 2: Mode-Aware Routing in `PhotoContextMenu.tsx` & `FilmstripTray.tsx`
- Extended `PhotoContextMenuProps` with `activeMode?: 'print' | 'carousel'`.
- Dynamic microcopy:
  - Carousel mode: renders `"Place on Active Slide"` (or `"Place X Photos on Slide"` for multi-photo selections).
  - Print mode: renders `"Place on Spread Canvas"` (or `"Place X Photos on Spread"`).
- Placement routing:
  - When `activeMode === 'carousel'`, queries `useCarouselStore.getState()` and dispatches to `addPhotoFrames(activeSlideIndex, toPlace)`, updating `photoStore.usedCount`.
  - When `activeMode === 'print'`, preserves `useEditorStore.getState().addPhotosToSpread(activeSpread.id, toPlace)`.
- Passed `activeMode={activeMode}` from `FilmstripTray.tsx` into `<PhotoContextMenu ... />`.

### Task 3: In-Canvas Selected Frame Replacement on Double-Click & Test Suite
- Updated `onDoubleClick` in `FilmstripTray.tsx`:
  - Evaluates `activeMode === 'carousel'`.
  - Inspects whether `selectedFrameId` belongs to a photo frame on the active slide.
  - If a frame is selected: replaces the photo in-place via `addPhotoFrames(slideIdx, [photo], { targetFrameId: selectedFrameId, isReplace: true })`.
  - If no frame is selected: dynamically appends/reflows the photo via `addPhotoFrames(slideIdx, [photo])`.
  - Increments `photoStore.usedCount` for placed photos.
- Created automated test suites:
  - `src/features/carousel/__tests__/carousel-drag-context.test.ts`
  - `tests/carousel-drag-context.test.ts`
  - Verifies:
    1. 3-photo batch placement creates 3 proportional non-overlapping frames in a single update.
    2. Single `undo()` (`Cmd+Z`) atomically rolls back batch frames in one step; `redo()` restores them.
    3. Smart reflow combines existing slide photos with new photos and preserves custom styling attributes (borders, corner radius, shapes).
    4. Frame replacement preserves target frame geometry and updates photo references.
    5. Context routing in Carousel mode dispatches to `carouselStore` and updates `photoStore` without touching `albumStore`.

---

## Verification & Tests

1. **Type Checking:**
   - Ran `npm test` (`tsc --noEmit`) - passed with 0 errors.
2. **Automated Unit & Integration Tests:**
   - Ran `npx tsx tests/carousel-drag-context.test.ts`:
     - Test 1: Passed.
     - Test 2: Passed.
     - Test 3: Passed.
     - Test 4: Passed.
     - Test 5: Passed.
   - Ran `npx tsx src/features/carousel/__tests__/dragAndSmoothPan.test.ts`:
     - Test 1: Passed.
     - Test 2: Passed.
     - Test 3: Passed.

---

## Git Commits
- `e8ccb6f` - `feat(carousel): atomic addPhotoFrames with R-BSP layout reflow, style retention, and canvas drop wiring`
- `7f631e6` - `feat(photos): mode-aware placement labels and routing to carouselStore in PhotoContextMenu`
- `b2489a6` - `feat(filmstrip): in-canvas selected frame replacement on double click and comprehensive test suite`
