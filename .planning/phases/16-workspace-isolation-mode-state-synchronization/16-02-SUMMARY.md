# Summary 16-02: AppTitleBar Mode-Guarding & Keyboard Shortcut Isolation

**Plan:** 16-02  
**Phase:** 16 — Workspace Isolation & Mode State Synchronization  
**Requirements:** ISO-03  
**Executed:** 2026-09-29  
**Status:** ✅ COMPLETE  

---

## Commits

| Hash | Message |
|------|---------|
| `bdd4907` | feat(ISO-03): add CarouselTextFrame union type and carouselStore.addTextFrame action |
| `ba6cd6a` | feat(ISO-03): mode-guard AppTitleBar controls and hoist carousel T shortcut |
| `cab80ed` | test(ISO-03): add unit tests for carouselStore.addTextFrame |

---

## Task 1 — `src/domain/carousel.ts` & `src/stores/carouselStore.ts`

### Changes Made

1. **`src/domain/carousel.ts`**:
   - Added `CarouselTextFrame` interface with fields: `type: 'text'`, `id`, `x`, `y`, `width`, `height`, `text`, `fontSize`, `fontFamily`, `fontWeight`, `color`, `align`, `locked`, `opacity?`, `rotation?`.
   - Updated `CarouselElement` union type: `export type CarouselElement = CarouselPhotoFrame | CarouselTextFrame;`.
   - `getSlideIntersectingFrames` already strictly filters `(el): el is CarouselPhotoFrame => el.type === 'photo'`, safely ignoring text frames for multi-slice calculations.

2. **`src/stores/carouselStore.ts`**:
   - Added `CarouselTextFrame` and `CarouselElement` imports.
   - Added `addTextFrame: () => void;` to `CarouselState` interface.
   - Updated `sanitizeFrame` inside `saveCarouselToDb` to serialize both `CarouselTextFrame` and `CarouselPhotoFrame` elements.
   - Refactored `setHeroPhotoOnSlide` to narrow to photo frames (`el.type === 'photo'`) and preserve any existing non-photo elements on the slide.
   - Implemented `addTextFrame()`:
     - Calls `pushHistory()` for atomic undo/redo support.
     - Calculates slide-relative bounds (`slideStartX + 0.1 * slideWidthPx`, `0.4 * slideHeightPx`, `0.8 * slideWidthPx`, height 80).
     - Appends new `CarouselTextFrame` to active slide's `elements`.
     - Sets `selectedFrameId` and `selectedFrameIds` to the newly created text frame ID.

3. **Domain & Export Alignment**:
   - Updated `ExportAlbumDialog.tsx` to safely handle photo and non-photo elements when mapping slices to the Rust backend payload.
   - Fixed test files `carousel-drag-context.test.ts`, `vectorShapes.test.ts`, and `autoFlowIntegration.test.ts` to type-narrow photo frames under the expanded `CarouselElement` union.
   - Installed `vitest` in devDependencies to support automated test runs.

---

## Task 2 — `src/features/workspace/AppTitleBar.tsx`

### Changes Made

1. **Project Type Badge (Read-Only)**:
   - Replaced interactive mode switcher segmented control buttons with a read-only project type indicator.
   - Non-active mode button is `disabled={activeMode !== ...}` with an informative tooltip (`To change type, use File > Duplicate as...`).
   - Active mode button displays active visual styling (`styles.modeActive`) while preventing accidental mode switching without project duplication.
   - Handled unused `onModeSelect` prop by aliasing to `_onModeSelect` to satisfy `noUnusedParameters`.

2. **Mode-Routed "Add Text" Button**:
   - In `'carousel'` mode: invokes `useCarouselStore.getState().addTextFrame()` and displays `'✓ Added Text Frame to Slide'`.
   - In `'print'` mode: preserves existing behavior calling `addTextToSpread(activeSpreadId)`.
   - Dynamic button tooltip: `'Add Text (T)'` in Carousel mode vs `'Add Text Box (T)'` in Print mode.

3. **Mode-Aware Export Tooltip**:
   - Updated tooltip: `'Export Carousel Slides (⌘E)'` when `activeMode === 'carousel'` vs `'Export Album for Print (⌘E)'` in Print mode.

---

## Task 3 — `src/features/workspace/WorkspaceLayout.tsx`

### Changes Made

1. **Hoisted Carousel Single-Key Shortcut (`T`)**:
   - Hoisted the single-key `T` shortcut block directly before the broad carousel suppression guard.
   - Evaluates `activeMode === 'carousel' && !cmdOrCtrl && !e.altKey && !e.shiftKey && (e.key === 't' || e.key === 'T')`.
   - Calls `e.preventDefault()`, invokes `useCarouselStore.getState().addTextFrame()`, and surfaces feedback via `showToast('✓ Added Text Frame to Slide')`.
   - Leaves room for future carousel-exclusive single-key shortcuts (e.g. `F`).

2. **Broad Suppression Guard Preserved**:
   - Retained suppression of remaining print-only single-key shortcuts (`Delete`, `L`, `G`, `R`, `S`, arrows, etc.) to prevent leakage into the album store during social carousel editing.
   - Global shortcuts (`Cmd+S`, `Cmd+Z`, `Cmd+E`, `F1`, zoom) remain fully operational across both modes.

---

## Tests — `src/stores/__tests__/carouselStore-addTextFrame.test.ts`

Created comprehensive unit test suite covering `carouselStore.addTextFrame` (ISO-03). All 7 tests **PASS** ✅:

| Test | Status |
|------|--------|
| creates a text frame centered on the active slide | ✅ |
| text frame has correct default text and font | ✅ |
| text frame x is within the active slide bounds | ✅ |
| sets selectedFrameId to the new text frame | ✅ |
| pushes history for undo support | ✅ |
| adds text frame to slide 1 when activeSlideIndex is 1 | ✅ |
| does nothing if currentCarousel is null | ✅ |

### Regression & Type Verification
- `npx vitest run src/stores/__tests__/`: 15/15 tests passed (8 from 16-01, 7 from 16-02).
- `npm run test` (`tsc --noEmit`): 0 errors across entire workspace.
- `npx tsx src/features/carousel/__tests__/carousel-drag-context.test.ts`: Passed (5/5).
- `npx tsx src/domain/__tests__/vectorShapes.test.ts`: Passed (5/5).
- `npx tsx src/domain/storytelling/__tests__/autoFlowIntegration.test.ts`: Passed (100%).

---

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| Pressing `T` in Carousel mode adds a text frame to the active slide | ✅ |
| Pressing `T` in Print mode adds a text box to the active print spread | ✅ |
| "Add Text" button in `AppTitleBar` calls `addTextFrame()` in Carousel mode and `addTextToSpread()` in Print mode | ✅ |
| Mode switcher segmented control renders both buttons but only the active mode button is enabled | ✅ |
| Export button tooltip reads "Export Carousel Slides (⌘E)" in Carousel mode and "Export Album for Print (⌘E)" in Print mode | ✅ |
| `carouselStore.addTextFrame()` creates a `CarouselTextFrame` with `type: 'text'`, registers undo history, and sets selection | ✅ |
| `CarouselElement` union type now includes `CarouselTextFrame` | ✅ |
| All Vitest tests pass | ✅ (15/15) |
| `npx tsc --noEmit` exits with 0 errors | ✅ |
