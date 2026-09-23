# Phase 13 Code Review: Interactive In-Canvas Divider Dragging & Direct Photo Swapping

**Reviewer:** gsd-code-reviewer (automated)
**Phase:** 13
**Date:** 2026-09-23
**Overall:** ✅ APPROVED — no blocking issues

---

## Summary of Changes

| File | Type | Lines |
|------|------|-------|
| `src/domain/layout/dividerGraph.ts` | Created | ~320 |
| `src/domain/layout/__tests__/dividerGraph.test.ts` | Created | ~210 |
| `src/domain/layout/__tests__/dividerInteractionIntegration.test.ts` | Created | ~150 |
| `src/features/editor/DividerOverlayLayer.tsx` | Created | ~200 |
| `src/features/editor/KonvaEditorCanvas.tsx` | Modified | +40 |
| `src/features/carousel/CarouselCanvas.tsx` | Modified | +90 |
| `src/stores/carouselStore.ts` | Modified | +40 |

---

## Strengths

### 1. Zero-setState Drag Loop
`DividerOverlayLayer` correctly avoids React state during drag. The RAf-coalesced imperative Konva mutation (`node.setAttrs()` + `layer.batchDraw()`) is the right pattern for 60fps canvas interactions. No re-render pressure during drag.

### 2. Pure Domain Engine
`dividerGraph.ts` is entirely pure TypeScript with no Konva or React imports. All geometry math (pairwise adjacency, colinear merging, clamping bounds) is testable in isolation — confirmed by 6 passing test suites.

### 3. Swap Snap-Back Pattern
The carousel drag-swap imperatively snaps the Konva node back before calling `swapFrames()`. This prevents ghost positioning where the node visually sits at the wrong position between the store update and the next React render cycle.

### 4. Scale-Invariant Rendering
All pixel coordinates pass through `scaleFactor` division correctly. Divider hit areas and visual lines render correctly at any zoom level (5%–350%).

### 5. Conservation Invariant
`batchUpdateFrames` integration test confirms total frame width is conserved post-divider drag (800px = 480 + 320). The `minCoord`/`maxCoord` clamping in `extractCanvasDividers` guarantees no frame collapses below `minDimension`.

---

## Issues Found

### Minor — No Horizontal Divider Glow Ring in Carousel
The cyan swap target ring in `CarouselCanvas.tsx` renders as a Rect with a fixed `cornerRadius={4}`. This looks correct for rectangular frames. No issue for current milestone scope.

### Informational — DividerOverlayLayer not in Layer 3 (intentional)
`DividerOverlayLayer` is mounted inside Layer 2 in both canvases (not a dedicated top layer). This means divider lines can be obscured by Transformer handles. This is acceptable — the divider visuals appear on hover only and the Transformer is typically inactive when hovering a divider.

---

## Verification Checklist

- [x] `npm test` → 0 TypeScript errors
- [x] `dividerGraph.test.ts` → 6 suites, 100% green
- [x] `dividerInteractionIntegration.test.ts` → 4 suites, 100% green
- [x] `generativeLayout.test.ts` → 5 suites, 100% green
- [x] `heroAndFullBleed.test.ts` → 4 suites, 100% green
- [x] `panoramaSpan.test.ts` → 6 suites, 100% green

**Decision: APPROVED — Ready to merge and mark Phase 13 COMPLETE.**
