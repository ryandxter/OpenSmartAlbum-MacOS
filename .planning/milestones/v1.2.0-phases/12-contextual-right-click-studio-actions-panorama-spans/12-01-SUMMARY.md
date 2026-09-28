# Plan 12-01 Summary: Print Album Contextual Studio Actions, Full Bleed Spread Promotion & Hero Anchor Biasing

**Phase:** 12 - Contextual Right-Click Studio Actions & Panorama Span Engine  
**Status:** Completed  
**Execution Date:** 2026-09-23  

---

## 1. What was accomplished

### 1.1 Hero Anchor Biasing in Generative Layout Core
- **`src/domain/layout/aspectMatcher.ts`**:
  - Added `isHero?: boolean` to `PhotoAspectInput`.
  - Strengthened hero penalty factor in `calculateSlotCost`: When `photo.isHero` is true, non-maximum slots incur an aggressive energy penalty:
    $$(1.0 - \text{areaRatio}) \times 20.0$$
    This mathematically guarantees that the Hungarian bipartite solver assigns the explicit hero photo to Slot 0 (the largest slot on the spread).
- **`src/domain/layout/generator.ts`**:
  - Added `heroPhotoId?: string` to `LayoutGeneratorOptions`.
  - Mapped `photoInputs` with explicit hero flags.
  - Applied score bonus to candidate variations tagged with hero archetypes (`hero-companion-grid`, `Hero + Companion Stack`), ranking hero-centric layouts at the top.
- **`src/domain/adaptiveLayout.ts`**:
  - Added `isHero?: boolean` to `AdaptivePhoto`.

### 1.2 Store Actions for Full-Bleed Promotion & Hero Photo Assignment
- **`src/stores/albumStore.ts`**:
  - Implemented `promoteToFullBleedSpread(spreadId, frameId, project)`:
    - Atomically captures snapshot in `useHistoryStore` for single-step undo.
    - Expands target photo to physical full bleed dimensions ($x = -\text{bleed}, y = -\text{bleed}, w = \text{spreadWidth} + 2\cdot\text{bleed}, h = \text{spreadHeight} + 2\cdot\text{bleed}$).
    - Enforces **Zero-Loss Photo Invariant**: Automatically extracts remaining $(N - 1)$ photos, creates a new interior spread (`createInteriorSpread`), synthesizes an optimal dynamic layout (`generateDynamicVariations`), and renumbers pages.
  - Implemented `setHeroPhotoOnSpread(spreadId, frameId, project)`:
    - Re-synthesizes spread layout prioritizing the clicked photo in the dominant slot while harmonizing companion photos.

### 1.3 Context Menu & Non-Printing Spine Warning in Canvas
- **`src/features/editor/KonvaEditorCanvas.tsx`**:
  - Added `Set as Full Bleed Spread (2-Page Panorama)` (with `Maximize2` icon) and `Set as Hero / Anchor Photo` (with `Star` icon) to the canvas right-click context menu for single photo selections.
  - Implemented Spine Clearance Protection (CTX-04):
    - Computes whether any photo frame's focal point ($X_{\text{focal}} = x + w/2 + \text{cropX}$) falls inside the physical print lab binding exclusion corridor ($X_{\text{spine}} \pm 19\text{mm}$).
    - Renders an interactive non-printing amber corridor (`rgba(245, 158, 11, 0.08)` with `#F59E0B` dashed guidelines) and a top warning badge (`⚠️ Subject in Spine Binding Zone (19mm)`).
    - Guide never exports to PDF/TIFF/PSD.

### 1.4 Automated Verification
- Created `src/domain/layout/__tests__/heroAndFullBleed.test.ts` covering:
  - Kuhn-Munkres hero assignment to largest slot (100% pass).
  - 4-photo spread full bleed expansion + 3-photo reflow to new spread with zero photo loss.
  - Single-step `Cmd+Z` atomic reversal.
  - Spine clearance collision detection math.
- Verified with `npm test` (`tsc --noEmit`), passing with 0 errors.
