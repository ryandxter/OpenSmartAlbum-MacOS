# TODO: Vector Shape Masking & Non-Rectangular Clipping Engine

- **ID:** CRIT-04
- **Status:** Pending
- **Severity:** High
- **Category:** Graphics Engine / Vector Masks
- **References:** `FORENSICS.md#incident-4`, `CODE-REVIEW.md#4-vector-shape-masking-engine`

## Problem Description
Selecting shape presets (Circle, Oval, Hexagon, Octagon, Star, Heart, Scallop, Custom SVG) fails to clip photos. In Album mode, photos remain rectangular or clipping fails. In Carousel mode, shapes are not supported.

## Root Cause
1. `drawShapeToContext` in `src/domain/shapes.ts` calls `c.clip(p)` directly, bypassing Konva's context path accumulation. Konva's subsequent `ctx.clip()` on an empty path breaks clipping.
2. Fallback manual tracing in `shapes.ts` only handles circle, oval, rounded, and hexagon/octagon; stars, hearts, scallops, and SVG paths fall through to a plain rectangle.
3. `CarouselCanvas.tsx` (`CarouselFrameNode`) has zero clipping logic or shapeType support.
4. `ShapesBordersSection.tsx` only updates `editorStore` for album spreads, ignoring carousel frames.

## Tasks
1. Refactor `drawShapeToContext` to strictly trace commands (`moveTo`, `lineTo`, `arcTo`, `bezierCurveTo`) onto `ctx` without calling `ctx.clip()`.
2. Implement SVG path command parser for star, heart, scallop, and custom SVG paths.
3. Add `<Group clipFunc={...}>` to `CarouselFrameNode` in `CarouselCanvas.tsx`.
4. Update `ShapesBordersSection.tsx` to call `useCarouselStore.getState().updatePhotoFrame` when in Carousel Mode.
