# CODE REVIEW REPORT: OpenSmartAlbum-MacOS

**Audit Date:** September 22, 2026  
**Review Type:** Targeted Defect Analysis & Architectural Integrity  
**Reviewers:** Antigravity Autonomous Code Reviewer (GSD Code Review)  
**Status:** Findings Documented for Next Milestone  

---

## 1. Drag & Drop Pipeline (`tauri.conf.json`, `photoStore.ts`, `WorkspaceLayout.tsx`)

### Findings

#### CR-01: `dragDropEnabled: false` Disables Native OS Window Drop Events
- **File:** `src-tauri/tauri.conf.json:27`
- **Severity:** High (Functional Blocker)
- **Code:**
  ```json
  "windows": [
    {
      "label": "main",
      ...
      "dragDropEnabled": false
    }
  ]
  ```
- **Analysis:** In Tauri v2, setting `dragDropEnabled: false` shuts down macOS `NSDraggingDestination` registration on the webview window. Tauri's native layer drops any drag event before it reaches JavaScript.
- **Correction:** Set `"dragDropEnabled": true` in `tauri.conf.json`.

#### CR-02: Absence of Window Drop Handlers in Application Shell
- **File:** `src/features/workspace/WorkspaceLayout.tsx`
- **Severity:** High (Missing Implementation)
- **Analysis:** While `photoStore.importPaths(projectId, paths)` exists and is production-ready, no component listens for:
  ```ts
  import { getCurrentWebview } from '@tauri-apps/api/webview';
  // or window drag-drop event
  ```
- **Recommendation:** Implement a custom hook `useWindowFileDrop(onPathsDropped)` that registers the Tauri 2 drag-drop listener on mount and unregisters on unmount, filtering for valid image extensions (`.jpg`, `.jpeg`, `.png`, `.tiff`, `.tif`, `.webp`, `.heic`, `.raw`) or directories.

---

## 2. Carousel Mode Integration (`CarouselCanvas.tsx`, `FilmstripTray.tsx`, `carouselStore.ts`)

### Findings

#### CR-03: Zero Drag-and-Drop Handlers on `CarouselCanvas`
- **File:** `src/features/carousel/CarouselCanvas.tsx:280-315`
- **Severity:** High (Functional Blocker)
- **Code:**
  ```tsx
  return (
    <div
      ref={containerRef}
      className={`${styles.canvasContainer} ...`}
      onMouseDown={...}
      onMouseMove={...}
      onMouseUp={...}
    >
      <div className={styles.stageWrapper}>
        <Stage ...>
  ```
- **Analysis:** `KonvaEditorCanvas.tsx` implements `onDragOver` (with `e.preventDefault()`) and `onDrop`. In `CarouselCanvas.tsx`, dragging a photo from `FilmstripTray` triggers standard browser drop cancellation because there is no `onDragOver` allowing the drop and no `onDrop` parsing `e.dataTransfer.getData('application/json')`.
- **Correction:** Add `onDragOver` and `onDrop` to the container div. Translate viewport `(clientX, clientY)` to canvas coordinates:
  ```ts
  const canvasX = (e.clientX - stagePos.x) / scale;
  const canvasY = (e.clientY - stagePos.y) / scale;
  const slideIdx = getSlideIndexAtX(currentCarousel, canvasX);
  ```
  Then invoke `useCarouselStore.getState().addPhotoFrame(slideIdx, { ... })`.

#### CR-04: Filmstrip Photo Double-Click Is Hardcoded to Album Store
- **File:** `src/features/photos/FilmstripTray.tsx:617-627`
- **Severity:** Medium (UX Breakdown)
- **Code:**
  ```tsx
  onDoubleClick={() => {
    if (isUsed) return;
    const { currentAlbum, activeSpreadId } = useAlbumStore.getState();
    if (currentAlbum) {
      const allSpreads = getAllAlbumSpreads(currentAlbum);
      const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];
      if (activeSpread) {
        useEditorStore.getState().addPhotoToSpread(activeSpread.id, photo);
      }
    }
  }}
  ```
- **Analysis:** The handler ignores the project's `activeMode`. In Carousel Mode, it silently adds the photo to an inactive album spread instead of the visible active carousel slide.
- **Correction:** Inject `activeMode` check. If `activeMode === 'carousel'`, read `activeSlideIndex` from `useCarouselStore` and add a new photo frame centered on that slide.

#### CR-05: Filmstrip "Used" Indicator Disregards Carousel Slides
- **File:** `src/features/photos/FilmstripTray.tsx:610`
- **Severity:** Medium (Visual State Discrepancy)
- **Analysis:** `usedPhotoIdSet` only checks elements inside `currentAlbum.spreads`. Photos placed onto carousel slides remain marked as unused, or conversely album-used photos are marked as used while the carousel canvas is empty.
- **Correction:** When `activeMode === 'carousel'`, compute `usedPhotoIdSet` by mapping photo IDs present in `currentCarousel.slides[*].elements`.

---

## 3. Smart Layout Rendering & Performance (`TemplatesPanel.tsx`)

### Findings

#### CR-06: Severely Depressed Contrast Ratio in Inactive Variation Cards
- **File:** `src/features/templates/TemplatesPanel.tsx:173`
- **Severity:** Medium (Aesthetic & Usability Defect)
- **Code:**
  ```tsx
  fill="${isCurrent ? 'rgba(59,130,246,0.4)' : 'var(--color-surface, #27272a)'}"
  stroke="${isCurrent ? 'var(--color-accent, #3b82f6)' : 'var(--color-border, #3f3f46)'}"
  ```
- **Analysis:** The SVG card background is `#18181b`. Inactive rects are drawn with `#27272a`. The contrast delta is $\Delta E \approx 4$, rendering them virtually invisible to the user.
- **Correction:**
  ```tsx
  fill="${isCurrent ? 'rgba(59, 130, 246, 0.35)' : 'rgba(255, 255, 255, 0.08)'}"
  stroke="${isCurrent ? 'var(--color-accent, #3b82f6)' : 'rgba(255, 255, 255, 0.22)'}"
  ```

#### CR-07: Uncached Synchronous Partition Generation on Main Thread
- **File:** `src/features/templates/TemplatesPanel.tsx:62-90`
- **Severity:** Medium (UI Latency)
- **Analysis:** Every shuffle or photo count modification recalculates up to 84 layout permutations synchronously on the render cycle.
- **Recommendation:** Memoize variations with a layout cache key based on photo IDs, orientations, and aspect ratios. Use requestIdleCallback or paginate list rendering.

---

## 4. Vector Shape Masking Engine (`shapes.ts`, `KonvaEditorCanvas.tsx`, `CarouselCanvas.tsx`)

### Findings

#### CR-08: Konva `clipFunc` Context Conflict via Immediate `ctx.clip(Path2D)`
- **File:** `src/domain/shapes.ts:211-224`
- **Severity:** High (Functional Blocker)
- **Code:**
  ```ts
  const c = ctx._context || ctx;
  const pathData = getShapeSvgPath(shapeType, width, height, radii, customSvgPath);

  if (typeof Path2D !== 'undefined' && typeof c.fill === 'function' && ...) {
    try {
      if (typeof c.clip === 'function') {
        const p = new Path2D(pathData);
        c.clip(p);
        return;
      }
    } catch {}
  }
  ```
- **Analysis:** In Konva, `clipFunc` expects the callback to create an open subpath on the provided `ctx` parameter. Konva automatically wraps this call in:
  ```js
  ctx.beginPath();
  clipFunc.call(this, ctx, this);
  ctx.closePath();
  ctx.clip();
  ```
  When `drawShapeToContext` immediately invokes `c.clip(p)` on the native 2D context, it bypasses Konva's path accumulation. Konva then immediately executes `ctx.clip()` on an empty path, destroying the clipping mask.
- **Correction:** Trace the vector path directly into `ctx` using standard path drawing instructions:
  - For Circles/Ovals: `ctx.ellipse(...)` or `ctx.arc(...)`
  - For Polygons (Hexagon/Octagon): `ctx.moveTo(...)` and `ctx.lineTo(...)`
  - For Stars, Hearts, Scallops, Custom SVG: Parse the SVG path string commands (`M, L, C, Q, Z`) and execute matching methods on `ctx` directly.

#### CR-09: Complete Absence of Shape Clipping in `CarouselFrameNode`
- **File:** `src/features/carousel/CarouselCanvas.tsx:54-100`
- **Severity:** High (Functional Omission)
- **Analysis:** `CarouselCanvas.tsx` renders images directly without any `<Group clipFunc={...}>` wrapper. Any `shapeType` attribute set on a `CarouselPhotoFrame` is ignored.
- **Correction:** Mirror the `<Group clipFunc={...}>` pattern from `KonvaEditorCanvas.tsx` inside `CarouselFrameNode`.

#### CR-10: Shapes & Borders Inspector Disconnect in Carousel Mode
- **File:** `src/features/inspector/sections/ShapesBordersSection.tsx:72-82`
- **Severity:** High (State Disconnect)
- **Analysis:** `ShapesBordersSection` only updates `editorStore` (`updateFrameGeometry(activeSpreadId, ...)`). In Carousel Mode, selected carousel frames receive no shape updates.
- **Correction:** In `ShapesBordersSection.tsx`, check `activeMode`. If `carousel`, call `useCarouselStore.getState().updatePhotoFrame(selectedFrameId, updates)`.
