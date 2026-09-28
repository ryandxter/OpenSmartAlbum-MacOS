# Phase 13: Interactive In-Canvas Divider Dragging & Direct Photo Swapping - Context & Scope

## Overview
Phase 13 delivers the premier tactile experience of Pixellu SmartAlbums and Fundy Designer:
1. **Interactive In-Canvas Divider Dragging (DIV-01..03, DIV-05):**
   - Between any two or more adjacent photos that share a boundary (vertical column divider or horizontal row divider), an invisible hit-zone detects hover.
   - On hover, a sleek high-contrast accent line (`#38BDF8`) appears and cursor changes to `col-resize` or `row-resize`.
   - On drag, adjacent frames resize dynamically in real time. To maintain 60fps without React re-render thrashing, drag updates are handled imperatively on Konva nodes (`node.width(...)`, `node.x(...)`, `layer.batchDraw()`) with `requestAnimationFrame` coalescing.
   - Min/max split clamping enforces that no photo collapses below 1.0 inch (25.4mm) or outside the 0.15–0.85 ratio range.
   - On drag end, the final layout dimensions are committed to `albumStore` / `editorStore` / `carouselStore` as a single atomic undo/redo history entry.

2. **Direct Photo Drag Swapping (DIV-04):**
   - When a user drags a photo frame directly over another frame in the canvas, a glowing target ring highlights the hovered frame.
   - On drop, the photos swap places instantly: their `photoId`, `filePath`, `previewPath`, and `photoAspect` are swapped while their frame container geometries remain rock solid.
   - Focal points and crop settings are recalculated to maintain proportional aspect-fill cover fit.
   - Committed with a single undo/redo snapshot.

## Architecture Guidelines
- **Hit Detection:** Pure geometric analysis of adjacent bounding boxes within distance tolerance ($\le 8\text{px}$ in screen space or $\le 3\text{mm}$ in canvas space).
- **Imperative Konva Drag vs React State:** During active dragging, bypass React state updates. Update Konva node dimensions directly and schedule `layer.batchDraw()` via `requestAnimationFrame`. Only commit to Zustand store on `dragend` / `pointerup`.
- **Zero-Loss Guarantee:** Swapping preserves both photos completely. Divider resizing changes dimensions without losing images or cropping beyond aspect bounds.
