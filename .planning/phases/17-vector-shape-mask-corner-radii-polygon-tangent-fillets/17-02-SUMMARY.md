# Phase 17 Execution Summary: Plan 17-02

**Inspector UI Unlock, Oval Preset Button & Tip/Valley Star Controls**  
**Phase:** 17 — Vector Shape Mask Corner Radii & Polygon Tangent Fillets  
**Requirements:** VEC-01, VEC-04  
**Date:** 2026-09-29  
**Status:** Complete (100% Green, 0 Errors)

---

## 1. Accomplishments

### Task 1: Dedicated "Oval" Shape Preset Button in Inspector Grid
- Added an "Oval" preset button to [`src/features/inspector/sections/ShapesBordersSection.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/inspector/sections/ShapesBordersSection.tsx) in the Vector Shape Mask preset grid.
- Positioned immediately adjacent to "Circle" and before "Hexagon".
- Features an inline SVG ellipse icon (`rx="10" ry="6"`) for clear visual differentiation between Circle (1:1) and Oval (stretched ellipse frame).
- Selecting "Oval" updates `shapeType: 'oval'` across both Print and Carousel photo frames.

### Task 2: Unlock Corner Radius Section for All Polygon & Decorative Shapes
- Replaced the rectangle-only guard (`currentShape === 'rectangle' || currentShape === 'rounded'`) with an inclusive guard:
  ```tsx
  {currentShape !== 'circle' && currentShape !== 'oval' && currentShape !== 'custom_svg' && (
  ```
- Unlocks the Corner Radius slider and numeric input controls for Hexagon, Octagon, Star, Scallop, and Heart.
- Keeps continuous analytical curves (`circle`, `oval`) and custom SVG masks excluded to prevent non-functional UI states.

### Task 3: Fix Shape Preservation in `handleMasterRadiusChange`
- Fixed `handleMasterRadiusChange` to preserve the user's active shape:
  - If `currentShape === 'rectangle'` and radius > 0, switches to `'rounded'`.
  - If `currentShape === 'rounded'` and radius === 0, switches to `'rectangle'`.
  - For all other shapes (e.g., `'hexagon'`, `'octagon'`, `'star'`, `'scallop'`, `'heart'`), preserves their active `shapeType` while updating `cornerRadius`, `cornerRadiusTl`, `cornerRadiusTr`, `cornerRadiusBr`, and `cornerRadiusBl`.
  - Resolves the bug where scrubbing the radius slider on a polygon accidentally converted it to a `'rounded'` rectangle.

### Task 4: Independent Star Tips & Valleys UI Controls & NumberInput Title Tooltip
- Added `title?: string` prop to [`src/components/ui/NumberInput.tsx`](file:///Users/chiio/VSCode/albumaker/src/components/ui/NumberInput.tsx) for descriptive hover tooltips.
- Implemented specialized Star Unlinked Controls in [`src/features/inspector/sections/ShapesBordersSection.tsx`](file:///Users/chiio/VSCode/albumaker/src/features/inspector/sections/ShapesBordersSection.tsx):
  - When `currentShape === 'star'` and corners are unlinked (`!isCornersLinked`), renders a 2-column input grid (`propGrid2`):
    - **Tips Radius:** controls outer star vertices (`cornerRadiusTl`).
    - **Valleys Radius:** controls inner star vertices (`cornerRadiusTr`).
  - When `currentShape === 'rectangle' || currentShape === 'rounded'`, preserves the 4-corner grid (`TL`, `TR`, `BR`, `BL`).
  - Conditionally displays the Link/Unlink toggle button only when unlinking is supported (`rectangle`, `rounded`, `star`), hiding it for uniform regular polygons (`hexagon`, `octagon`, `scallop`, `heart`).

---

## 2. Verification & Test Output

### 2a. TypeScript Strict Compilation (`npx tsc --noEmit`)
```
npx tsc --noEmit
Exited with code 0 (0 errors, strict mode clean).
```

### 2b. Unit Test Verification (`npx tsx src/domain/__tests__/vectorShapes.test.ts`)
```
🧪 Starting Vector Shape Masking & In-Shape Crop Engine Tests...
▶ Test Suite 1: SVG Path Generation & Validation (All 10 shape types)
▶ Test Suite 2: Geometric 1:1 Centering (Option A) Invariant
▶ Test Suite 3: Canvas 2D Path Tracing & Zero-Clip Invariant
▶ Test Suite 4: SVG Path Parser Invariant (traceSvgPathToContext)
▶ Test Suite 5: Multi-Mode Cohesion & Carousel Store Dispatch
▶ Test Suite 6: Polygon Tangent Fillet Math & Dynamic Clamping
▶ Test Suite 7: Star Independent Tip & Valley Fillets
▶ Test Suite 8: Oval SVG Path and Context Tracing
▶ Test Suite 9: Stroke Contour & Mask Alignment Invariant
🎉 ALL 9 TEST SUITES COMPLETED! Vector Shape Masking & Fillet Engine is 100% verified.
```

---

## 3. Git Commits

1. `6be02da`: `feat(inspector): add oval preset button to shape borders section`
2. `a504703`: `feat(inspector): unlock corner radius section for all polygon shapes`
3. `e243886`: `fix(inspector): preserve active polygon shapeType in handleMasterRadiusChange`
4. `abab21d`: `feat(inspector): add star tips and valleys independent radius controls`

---

## 4. Next Steps
Plan 17-02 is complete. Proceed to:
- **Plan 17-03**: Custom SVG Path Sanitizer & Compound Shape Fill/Clip Engine (Non-zero winding compound path rendering).
