# Summary 16-03: Slide Coordinate Preservation & Layout Style Retention

**Plan:** 16-03  
**Phase:** 16 — Workspace Isolation & Mode State Synchronization  
**Requirements:** ISO-04, ISO-05  
**Executed:** 2026-09-29  
**Status:** ✅ COMPLETE  

---

## Commits

| Hash | Message |
|------|---------|
| `09baead` | fix(carousel): slide coordinate preservation and layout style retention (ISO-04, ISO-05) |

---

## Task 1 — `src/domain/carousel.ts`

### Changes Made

1. **`FrameStyleSnapshot` Type**:
   - Defined snapshot type containing visual properties:
     - `shapeType?: ShapeType;`
     - `customSvgPath?: string;`
     - `borderEnabled?: boolean;`
     - `borderWidth?: number;`
     - `borderColor?: string;`
     - `borderStyle?: 'solid' | 'dashed' | 'double';`
     - `opacity?: number;`
     - `rotation?: number;`
     - `locked?: boolean;`
     - `cornerRadius?: number;`
     - `cornerRadiusTl?: number;`
     - `cornerRadiusTr?: number;`
     - `cornerRadiusBr?: number;`
     - `cornerRadiusBl?: number;`

2. **`extractFrameStyle` Utility**:
   - Implemented function taking `frame: CarouselPhotoFrame` and returning `FrameStyleSnapshot`.
   - Uses strict explicit guards (`if (frame.prop !== undefined) snap.prop = frame.prop`) to ensure no default values are overwritten with undefined.
   - Exported both `FrameStyleSnapshot` and `extractFrameStyle` from `src/domain/carousel.ts`.

---

## Task 2 — `src/stores/carouselStore.ts` (ISO-04 Coordinate Preservation)

### Changes Made

Addressed the root cause where frames previously detached visually from slides on reorder, deletion, or duplication due to unadjusted absolute canvas `x` coordinates.

1. **`reorderSlide(fromIndex, toIndex)`**:
   - Builds `oldIndexById = new Map(currentCarousel.slides.map((s, i) => [s.id, i]))` prior to array splicing.
   - For every moved or shifted slide, calculates `deltaX = (newIdx - oldIdx) * slideWidthPx`.
   - Shifts all element `x` coordinates (`Math.round(el.x + deltaX)`) for both photo frames and text frames.
   - Leaves elements unchanged (`deltaX === 0 ? slide.elements : ...`) when no movement occurred.

2. **`deleteSlide(index)`**:
   - For slides at or after the deleted index, computes `originalIdx = newIdx >= index ? newIdx + 1 : newIdx`.
   - Calculates `deltaX = (newIdx - originalIdx) * slideWidthPx` (shifting subsequent slides left by `slideWidthPx`).
   - Shifts contained photo and text frames by `deltaX`.

3. **`duplicateSlide(index)`**:
   - The duplicated slide's elements are cloned with `x: Math.round(el.x + slideWidthPx)`.
   - Pre-computes `originalIndexById` before array assembly.
   - For subsequent slides (`newIdx > index + 1`), shifts all contained elements right by `+slideWidthPx`.

---

## Task 3 — `src/stores/carouselStore.ts` (ISO-05 Layout Style Retention)

### Changes Made

Addressed the root cause where layout cycling discarded custom shapes, borders, corner radii, opacity, rotation, and locked state.

1. **`cycleSlideLayout`**:
   - Before generating new variations, maps existing styles:
     `styleByPhotoId = new Map(activeFrames.map((f) => [f.photoId || f.id, extractFrameStyle(f)]));`
   - Spreads `...existingStyle` onto newly generated `CarouselPhotoFrame` elements after geometry calculations.
   - Preserves visual styling per photo across layout cycling.

2. **`applyDynamicSlideLayoutByIndex`**:
   - Uses the identical `styleByPhotoId` map extraction and spreading pattern.
   - Preserves visual styles across direct preset/variation selection.

---

## Verification & Testing

1. **Unit Test Suite (`src/stores/__tests__/carouselStore-iso04-iso05.test.ts`)**:
   - 14 automated unit tests covering:
     - `reorderSlide`: moving slide 2 to 0 shifts frames and text frames by `deltaX = (toIndex - fromIndex) * slideWidthPx`.
     - `reorderSlide`: same index is a no-op; history is pushed.
     - `deleteSlide`: shifts subsequent slides left by `slideWidthPx`; preceding slides unaffected.
     - `duplicateSlide`: duplicated slide elements offset by `+slideWidthPx`; following slides shifted right by `slideWidthPx`.
     - `cycleSlideLayout`: preserves `shapeType`, borders (`borderEnabled`, `borderWidth`, `borderColor`), corner radii (`cornerRadius`, `cornerRadiusTl/Tr/Br/Bl`), opacity, rotation, locked status.
     - `cycleSlideLayout`: verifies that layout geometry (`x`, `y`, `width`, `height`) correctly changes while visual styling is retained.
     - `applyDynamicSlideLayoutByIndex`: preserves `shapeType` across direct layout application.
     - `extractFrameStyle`: only extracts non-undefined fields; returns empty object for unstyled frames.
   - Result: **14/14 tests passing** in `carouselStore-iso04-iso05.test.ts`.
   - Full store suite: **29/29 tests passing** across `src/stores/__tests__/`.

2. **TypeScript Strict Type Check**:
   - `npx tsc --noEmit` exits with **0 errors**.

3. **Regression Testing**:
   - Ran `npx tsx src/domain/carousel/__tests__/carouselDynamicCoordsAndPanoramas.test.ts`: **100% green**.
   - Ran `npx tsx src/domain/carousel/__tests__/carouselHistorySelection.test.ts`: **100% green**.
   - Ran `npx tsx src/domain/__tests__/carouselAspectCover.test.ts`: **100% green**.

---

*Phase 16 is now complete.*
