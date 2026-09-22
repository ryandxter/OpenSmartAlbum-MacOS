# Phase 09: Vector Shape Masking & In-Shape Crop Engine - Context

**Gathered:** 2026-09-22  
**Status:** Ready for planning  

<domain>
## Phase Boundary

Phase 09 restores, hardens, and unifies non-rectangular vector shape clipping across the entire application (both Print Album and Social Carousel modes). It refactors Konva context path tracing, implements an SVG path command parser for decorative shapes (Star, Heart, Scallop, Custom SVG), introduces In-Shape Pan & Zoom Crop, and renders contour-following vector borders.

</domain>

<decisions>
## Implementation Decisions

### 1. Elimination of Konva `clipFunc` Context Conflict
- **D-01:** Refactor `drawShapeToContext` in `src/domain/shapes.ts`:
  - **Remove all calls to `c.clip(p)` inside `drawShapeToContext`.**
  - Traces path commands directly onto the active `Konva.Context` parameter (`ctx`):
    - `circle` / `oval`: `ctx.ellipse(...)` or `ctx.arc(...)`.
    - `rounded`: `ctx.roundRect(...)` or manual corner arcTo fallback.
    - `hexagon` / `octagon`: geometric polygon loop with `ctx.moveTo` and `ctx.lineTo`.
    - `star`, `heart`, `scallop`, `custom_svg`: parse SVG path commands (`M`, `L`, `C`, `Q`, `Z`, `A`) and execute matching canvas 2D path methods directly onto `ctx`.
  - Ensure the path is explicitly closed (`ctx.closePath()`) so that Konva's outer `_clip` can execute `ctx.clip()` cleanly.
  — **Reversibility:** costly — core vector geometry rendering.

### 2. Geometric 1:1 Centered Aspect Ratio
- **D-02:** When applying non-rectangular shapes (Heart, Star, Circle) to an asymmetrical rectangular frame (e.g. 3:2 landscape or 4:5 portrait):
  - Execute **Option A (Geometric 1:1 Centered)**:
  - The vector shape maintains a strictly undistorted 1:1 geometric proportion centered within the frame's bounding box.
  - The shape scales to the minimum dimension `Math.min(width, height)` to prevent aesthetic distortion.
  — **Reversibility:** costly — defines shape coordinate calculation.

### 3. In-Shape Pan & Zoom Interactive Crop
- **D-03:** Double-clicking a shape-masked photo frame enters **In-Shape Interactive Crop Mode**:
  - The vector silhouette remains visible as a high-contrast guide.
  - The user can drag (pan) and scroll (zoom) the photo image inside the shape mask.
  - Snapping and zoom limits (1.0x to 5.0x) apply consistently.
  — **Reversibility:** costly — touches frame interaction and editorStore.

### 4. Contour-Following Vector Borders
- **D-04:** When `frame.borderEnabled` is true:
  - Generate the stroke path using `KonvaPath` with `data={getShapeSvgPath(...)}`.
  - The border follows the exact contours of the shape (including heart curves, star points, and scallop ripples) with precise stroke alignment.
  — **Reversibility:** reversible

### 5. Multi-Mode Cohesion
- **D-05:** Implement `<Group clipFunc={...}>` in `CarouselCanvas.tsx` (`CarouselFrameNode`) mirroring `KonvaEditorCanvas.tsx`.
- **D-06:** Wire `src/features/inspector/sections/ShapesBordersSection.tsx` to inspect `activeMode`. If in Carousel Mode, dispatch updates via `useCarouselStore.getState().updatePhotoFrame`.
  — **Reversibility:** costly

### Folded Todos
- Folded `04-vector-shape-masks.md` into this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing:**

- `.planning/FORENSICS.md` — Section 4: Vector Shape Clipping Masks Fail Across Album & Carousel Modes
- `.planning/CODE-REVIEW.md` — Section 4: Vector Shape Masking Engine
- `.planning/UI-REVIEW.md` — Section 4: Visual Feedback for Vector Shapes
- `src/domain/shapes.ts` — Vector shape generator and canvas context drawing
- `src/features/editor/KonvaEditorCanvas.tsx` — Frame rendering, clipFunc, and border contour
- `src/features/carousel/CarouselCanvas.tsx` — Carousel frame rendering node
- `src/features/inspector/sections/ShapesBordersSection.tsx` — Shapes inspector panel

</canonical_refs>
