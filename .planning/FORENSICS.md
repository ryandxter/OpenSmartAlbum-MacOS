# FORENSICS REPORT: OpenSmartAlbum-MacOS (Post-v1.0.77 Diagnostic)

**Incident Date:** September 22, 2026  
**Investigator:** Antigravity Autonomous Agent (GSD Forensics)  
**Target:** OpenSmartAlbum macOS Port (`ryandxter/OpenSmartAlbum-MacOS`)  
**Scope:** 4 Critical Defects Reported in Production / Testing:
1. Finder direct drag-and-drop file import failure.
2. Carousel Mode photo placement and layouting failure.
3. Templates / Smart Layout preview grid visual blackout and shuffling lag.
4. Vector shape clipping mask failure across Album and Carousel modes.

---

## Executive Summary

A forensic audit of the codebase following the release of v1.0.77 reveals that while the pure Rust backend engine, PSD writer, TIFF encoder, and native titlebar architecture are functional, the integration layer between the frontend stores (`albumStore` vs `carouselStore`) and the OS/canvas rendering pipelines suffers from 4 distinct architectural and UI disconnects. 

All 4 defects have been fully isolated, traced to exact source lines, and documented below with actionable remediation blueprints for the upcoming milestone.

---

## Incident 1: Finder Direct Drag-and-Drop Photo Import Fails

### Symptoms
Users dragging image files or folders directly from macOS Finder onto the application window or photo filmstrip tray observe no drop feedback, no import trigger, and no photos added to the project. Users are forced to open the manual import dialog via "+ Import -> Batch Files / Folder".

### Root Cause Analysis
1. **Disabled Native Drag-Drop in Tauri Configuration:**
   In `src-tauri/tauri.conf.json` (line 27):
   ```json
   "app": {
     "windows": [
       {
         ...
         "dragDropEnabled": false
       }
     ]
   }
   ```
   In Tauri 2, setting `"dragDropEnabled": false` explicitly instructs the native macOS `WKWebView` window controller to reject all OS-level file drag-and-drop events (`NSDraggingDestination` / `onDragDropEvent`).
2. **Missing Window Drop Event Listener:**
   `src/stores/photoStore.ts` already implements a complete, robust file-path import method:
   ```ts
   importPaths: async (projectId: string, paths: string[]) => { ... }
   ```
   However, neither `src/App.tsx` nor `src/features/workspace/WorkspaceLayout.tsx` registers a listener for Tauri's window drag-drop event (`getCurrentWebview().onDragDropEvent(...)` or `getCurrentWindow().onDragDropEvent(...)`). 
3. **Missing Visual Drop Zone HUD:**
   There is no full-window drop overlay component with visual feedback (e.g. "Drop photos or folders here to import into project").

### Impact
High friction on desktop onboarding; breaks standard macOS desktop drag-and-drop conventions.

### Remediation Blueprint
1. In `src-tauri/tauri.conf.json`: Set `"dragDropEnabled": true`.
2. In `src/features/workspace/WorkspaceLayout.tsx`: Hook `getCurrentWindow().onDragDropEvent` (or Tauri 2 window drag-drop listener). When an event of type `drop` is received with `event.payload.paths`, filter for supported image extensions (`jpg`, `jpeg`, `png`, `tiff`, `tif`, `webp`, `heic`, `heif`, `raw`) or directory paths, and invoke `usePhotoStore.getState().importPaths(currentProject.id, paths)`.
3. Add a global drag-over overlay HUD: "Drop Photos or Folders to Import".

---

## Incident 2: Carousel Mode Photo Placement & Layouting Disconnected

### Symptoms
Reference: `/Users/chiio/Desktop/Screenshot 2026-09-22 at 22.02.45.png`  
When switching to or creating a "Social Carousel" project:
- Photos in the filmstrip tray cannot be added to carousel slides.
- Dragging photos from tray onto `CarouselCanvas` does nothing.
- Double-clicking a photo in the tray does nothing (or attempts to modify a hidden album spread).
- The right sidebar remains in Print Album mode ("Active: Spread 1 (Pages 1-2)") and only shows 2-page physical spread templates.
- Placed photos do not reflect "Used" indicators in Carousel Mode.

### Root Cause Analysis
1. **Zero HTML5 Drag-and-Drop Listeners on `CarouselCanvas.tsx`:**
   In `src/features/editor/KonvaEditorCanvas.tsx`, `onDragOver` and `onDrop` handlers exist to parse `e.dataTransfer.getData('application/json')` and place photos. In `src/features/carousel/CarouselCanvas.tsx`, lines 280–310 show container `div` and `Stage` with **zero** `onDragOver`, `onDragEnter`, or `onDrop` handlers. Dragged photos are completely ignored.
2. **Double-Click Hardcoded to Album Store:**
   In `src/features/photos/FilmstripTray.tsx` (lines 617–627):
   ```tsx
   onDoubleClick={() => {
     if (isUsed) return;
     const { currentAlbum, activeSpreadId } = useAlbumStore.getState();
     ...
     useEditorStore.getState().addPhotoToSpread(activeSpread.id, photo);
   }}
   ```
   It checks only `useAlbumStore.getState()` and delegates to `useEditorStore.getState().addPhotoToSpread`. It has no conditional logic for `activeMode === 'carousel'` to invoke `useCarouselStore.getState().addPhotoFrame(activeSlideIndex, ...)`.
3. **Used Photo Detection Excludes Carousel:**
   In `FilmstripTray.tsx` (line 610):
   ```tsx
   const isUsed = usedPhotoIdSet.has(photo.id) || photo.usedCount > 0;
   ```
   `usedPhotoIdSet` only traverses `currentAlbum.spreads`. It does not query `currentCarousel.slides[*].elements`.
4. **Inspector / Layout Panel Unaware of Mode:**
   `InspectorContainer.tsx` and `TemplatesPanel.tsx` always inspect `currentAlbum` and `activeSpreadId`. In Carousel Mode, `activeSpreadId` is either undefined or points to Spread 1 of a placeholder album. No carousel layout templates exist.

### Impact
Social Carousel Mode is effectively read-only and unusable for actual photo layout creation.

### Remediation Blueprint
1. Add `onDragOver` and `onDrop` to `CarouselCanvas.tsx`: Compute drop coordinate `(x, y)` in canvas space, identify target slide via `getSlideIndexAtX(currentCarousel, x)`, and call `addPhotoFrame`.
2. Update `FilmstripTray.tsx` double-click: If `activeMode === 'carousel'`, add photo centered on the currently active slide.
3. Update `usedPhotoIdSet`: Include all photo IDs present in `currentCarousel.slides`.
4. Create Carousel Smart Layout generator: Support 1, 2, 3, 4 photo arrangements tailored for 1:1, 4:5, and 9:16 vertical/horizontal feed slides.

---

## Incident 3: Smart Layout Tiles Preview Contrast Defect & Shuffling Lag

### Symptoms
Reference: `/Users/chiio/Desktop/Screenshot 2026-09-22 at 22.06.11.png` and `22.06.00.png`  
In the Smart Layout panel:
- Inactive layout tiles appear completely black/blank.
- Only the currently active/selected layout tile displays blue rectangles.
- Clicking "Shuffle" or changing photos causes the panel to hesitate/lag before showing preview tiles.

### Root Cause Analysis
1. **Severe Color Contrast Defect in Inactive SVG Rects:**
   In `src/features/templates/TemplatesPanel.tsx` (lines 170–179):
   ```tsx
   const svgRects = variation.rects
     .map(
       (r) =>
         `<rect x="${...}" y="${...}" width="${...}" height="${...}" rx="2" 
          fill="${isCurrent ? 'rgba(59,130,246,0.4)' : 'var(--color-surface, #27272a)'}" 
          stroke="${isCurrent ? 'var(--color-accent, #3b82f6)' : 'var(--color-border, #3f3f46)'}" 
          stroke-width="${isCurrent ? '1.5' : '1'}"/>`
     )
     .join('');
   
   const svg = `<svg ...><rect width="140" height="70" rx="4" fill="var(--color-bg-secondary, #18181b)"/>${spine}${svgRects}</svg>`;
   ```
   - The card background fill is `#18181b`.
   - The inactive rect fill is `#27272a`.
   - The inactive stroke is `#3f3f46` (1px).
   - **Contrast Ratio:** `#27272a` against `#18181b` yields a contrast ratio of **1.14:1** (WCAG failure threshold is < 3:1). On Apple Retina and OLED displays, this renders the rectangles indistinguishable from the background. Inactive tiles appear completely blank.
2. **Synchronous Main-Thread Generation of 84 Layout Variations:**
   `generateAdaptiveLayoutVariations` runs synchronously inside `useMemo` on every spread change, photo selection change, and shuffle click, computing 2D geometric aspect-ratio scores across dozens of permutations on the UI thread without web worker or pagination.

### Impact
Users perceive the smart layout feature as broken or blank; disorientation during shuffling.

### Remediation Blueprint
1. **Contrast Correction:**
   - Inactive rect fill: `rgba(228, 228, 231, 0.12)` or `#3f3f46`.
   - Inactive rect stroke: `rgba(228, 228, 231, 0.35)` or `#71717a` (strokeWidth: 1).
   - Active rect fill: `rgba(59, 130, 246, 0.45)`.
   - Active rect stroke: `#3b82f6` (strokeWidth: 1.5).
   This provides instantaneous visual recognition of layout structures across all 84 variations.
2. **Performance Optimization:**
   - Virtualize or lazy-render the `gridList` (render top 12 cards, then paginate on scroll).
   - Cache precomputed SVG string templates by photo count and aspect fingerprints.

---

## Incident 4: Vector Shape Clipping Masks Fail Across Album & Carousel Modes

### Symptoms
When a user selects a photo frame and chooses a vector shape preset (Circle, Oval, Hexagon, Octagon, Star, Heart, Scallop, or Custom SVG) from the Inspector's "Shapes & Borders" section:
- In Print Album mode: The photo remains rectangular or clipping fails/renders blank.
- In Social Carousel mode: Shapes cannot be applied at all; frames remain plain rectangles.

### Root Cause Analysis
1. **Konva `clipFunc` Context Conflict in `src/domain/shapes.ts`:**
   In `KonvaEditorCanvas.tsx` (lines 615–617):
   ```tsx
   <Group
     clipFunc={(ctx) => {
       if (frame.shapeType && frame.shapeType !== 'rectangle') {
         drawShapeToContext(ctx, frame.shapeType, pixelW, pixelH, cornerRadiiArray, frame.customSvgPath);
       } ...
     }}
   ```
   In `src/domain/shapes.ts` (lines 214–225):
   ```ts
   export function drawShapeToContext(...) {
     const c = ctx._context || ctx;
     const pathData = getShapeSvgPath(...);
     if (typeof Path2D !== 'undefined' && typeof c.clip === 'function' && ...) {
       try {
         if (typeof c.clip === 'function') {
           const p = new Path2D(pathData);
           c.clip(p); // <-- CRITICAL DEFECT
           return;
         }
       } catch {}
     }
   ```
   - **How Konva handles `clipFunc`:** Konva's internal `_clip(context)` method does:
     ```js
     context.beginPath();
     clipFunc.call(this, context, this);
     context.closePath();
     context.clip();
     ```
   - By calling `c.clip(p)` *inside* `clipFunc`, the native context is clipped immediately to `p`, but no path is left on Konva's `context`. Konva immediately follows with `context.closePath(); context.clip();` on the empty path, which clears or breaks the clipping region!
2. **Incomplete Fallback Path Tracing:**
   In `shapes.ts` (lines 228–265), the manual tracing code only implements `circle`, `oval`, `rounded`, `hexagon`, and `octagon`. Shapes like `star`, `heart`, `scallop`, and `custom_svg` fall through to `c.rect(0, 0, width, height)`.
3. **CarouselCanvas Lacks Shape Support:**
   `CarouselCanvas.tsx` (`CarouselFrameNode`) has zero reference to `frame.shapeType`. It renders unclipped standard `Rect` and `KonvaImage`.
4. **Shapes Inspector Ignores Carousel State:**
   In `ShapesBordersSection.tsx` (line 72):
   ```ts
   updateFrameGeometry(activeSpreadId, firstElem.id, updates);
   ```
   It only interacts with `editorStore` for album spreads. It never calls `carouselStore.updatePhotoFrame`.

### Impact
Shape presets and custom SVG clipping masks are completely non-functional.

### Remediation Blueprint
1. In `src/domain/shapes.ts`: Refactor `drawShapeToContext` to strictly trace commands (`moveTo`, `lineTo`, `arcTo`, `bezierCurveTo`) onto `ctx` without calling `ctx.clip()`. For SVG paths (`star`, `heart`, `scallop`, `custom_svg`), parse SVG path commands (`M, L, C, Q, Z`) and trace them directly onto the active canvas context.
2. In `CarouselCanvas.tsx`: Wrap `CarouselFrameNode` image in a `<Group clipFunc={...}>` identical to `KonvaEditorCanvas.tsx`.
3. In `ShapesBordersSection.tsx`: Check `activeMode`. If `carousel`, dispatch updates via `useCarouselStore.getState().updatePhotoFrame`.

---

## Action Items Summary Table

| ID | Issue | Affected Files | Severity | Target Milestone |
|---|---|---|---|---|
| **BUG-01** | Finder Drag-and-Drop file import blocked | `tauri.conf.json`, `WorkspaceLayout.tsx`, `App.tsx` | P1 (High) | Next Milestone |
| **BUG-02** | Carousel mode photo drop & layouting failure | `CarouselCanvas.tsx`, `FilmstripTray.tsx`, `TemplatesPanel.tsx` | P1 (High) | Next Milestone |
| **BUG-03** | Smart Layout preview tiles invisible & laggy | `TemplatesPanel.tsx`, `TemplatesPanel.module.css` | P2 (Medium) | Next Milestone |
| **BUG-04** | Vector shape masks failing to clip photos | `shapes.ts`, `KonvaEditorCanvas.tsx`, `CarouselCanvas.tsx`, `ShapesBordersSection.tsx` | P1 (High) | Next Milestone |
