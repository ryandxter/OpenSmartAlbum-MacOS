---
last_mapped_commit: 062f35d6547282c170023250f1409998265c0269
last_mapped_at: 2026-09-28
---
# Technical Debt, Architectural Concerns & Known Issues

**Analysis Date:** 2026-09-28  
**Scope:** OpenSmartAlbum-MacOS (`afsn-smart-album` v1.2.4)  
**Focus:** Workspace Switcher & State Separation, Drag-and-Drop Reliability, Vector Shape Masking, and Performance & Memory Scaling.

---

## Executive Overview

OpenSmartAlbum operates as a dual-engine creative suite combining a traditional physical **Print Album Designer** (spreads/pages in physical units, high-resolution 300 PPI export, C-Type/Press print profiles) and a modern **Social Carousel Creator** (continuous multi-slide canvas in fixed pixel dimensions, seamless panorama spanning, mobile simulation).

While both engines share underlying capabilities—such as the photo catalog, vector shape masking, and Tauri IPC—architectural divergence and incremental feature layering have introduced cross-mode state leakage, platform-specific WebKit quirks, UI inconsistencies, and performance bottlenecks under production loads.

This document systematically catalogs existing technical concerns, grounded directly in the codebase and forensic reports (`.planning/forensics/`).

---

## 1. Workspace Switcher & State Separation

### 1.1 Dual Domain Models & Coordinate Disparity

| Dimension | Print Album Designer | Social Carousel Creator |
|---|---|---|
| **Primary Store** | `albumStore.ts` & `editorStore.ts` | `carouselStore.ts` |
| **History System** | `historyStore.ts` (Album snapshots) | `carouselStore.ts` internal past/future stack |
| **Canvas Architecture** | Spread-based (single spread / cover in viewport) | Continuous multi-slide horizontal stage |
| **Coordinate System** | Physical units (`mm`, `cm`, `inch`) via `convertUnit` | Fixed pixel space (`px`), e.g., 1080×1080, 1080×1350 |
| **Canvas Transform** | Scaled via `scaleFactor = screenSpreadW / spreadWidth` | Direct pan/zoom stage transform (`scale`, `stagePos`) |
| **Element Types** | `AlbumElement` (`PhotoFrameElement`, `TextNodeElement`) | `CarouselPhotoFrame` (strict photo frame elements) |
| **Export Profile** | High-DPI raster / multi-page PDF / CMYK PSD (300 PPI) | 1:1, 4:5, or 9:16 PNG/JPEG slide slices (72/96 DPI screen) |

### 1.2 Hybrid State Leakage Risks

#### A. Context Menu Hardcoded to Album Store

* **File:** `src/features/photos/PhotoContextMenu.tsx` (lines 125–136)
* **Code Defect:**
  ```tsx
  // PhotoContextMenu.tsx:125-136
  <button
    type="button"
    className={styles.menuItem}
    onClick={() => {
      onClose();
      const { currentAlbum, activeSpreadId } = useAlbumStore.getState();
      if (currentAlbum) {
        const allSpreads = getAllAlbumSpreads(currentAlbum);
        const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];
        if (activeSpread) {
          const toPlace = isMulti ? selectedPhotos : [targetPhoto];
          useEditorStore.getState().addPhotosToSpread(activeSpread.id, toPlace);
        }
      }
    }}
  >
    <span className={styles.menuIcon}><Image size={14} strokeWidth={1.5} /></span>
    <span>{isMulti ? `Place ${count} Photos on Spread` : 'Place on Spread Canvas'}</span>
  </button>
  ```
* **Concern:**
  `PhotoContextMenu` does not receive or check `activeMode`. When working inside the Social Carousel workspace, clicking "Place on Spread Canvas" or "Place N Photos on Spread" accesses `useAlbumStore.getState()` and `useEditorStore.getState().addPhotosToSpread(...)`.
* **Impact:** Photos are silently placed onto dormant album spreads in the background without affecting the visible carousel slide. The UI label is also misleading in carousel mode.

#### B. Double-Click Ingestion Mode Dependency

* **File:** `src/features/photos/FilmstripTray.tsx` (lines 760–818)
* **Status:** Partially patched with `if (activeMode === 'carousel')`, but tightly coupled to the `activeMode` prop passed from `WorkspaceLayout.tsx:1106`. If `FilmstripTray` is rendered in any other context or if `activeMode` becomes desynchronized from the global UI state, double-clicks fail silently or route to the wrong store.

#### C. Finder Drop Coordinate Disregard in Carousel Mode

* **File:** `src/features/workspace/WorkspaceLayout.tsx` (lines 500–565)
* **Code Defect:**
  In `handleCanvasFinderDrop`:
  - When `activeMode === 'print'`, the handler converts `clientX, clientY` to stage physical coordinates (`physicalPt`) and invokes `findPhotoSwapTarget` to support dropping photos directly over existing frames to replace them.
  - When `activeMode === 'carousel'`, `clientX` and `clientY` are completely discarded. The handler always computes placement against `activeSlideIndex`, centering the new photo frame on the slide regardless of where the cursor was positioned, and completely lacks frame replacement capability for external file drops.

---

## 2. Drag-and-Drop Mechanisms

### 2.1 macOS WebKit (Tauri WKWebView) Incompatibilities

Forensic investigation `report-20260923-164800.md` and `report-2026-09-23-0520.md` detailed severe platform-level edge cases in macOS Tauri WKWebView:

```
[HTML5 Drag Event]
        │
        ├── macOS NSPasteboard (WebKit Sanitization)
        │     └── Drops custom MIME type 'application/x-afsn-photo-ids'
        │
        ├── WebKit Bug #70845: setDragImage(unattachedCanvas)
        │     └── Instantly aborts OS drag gesture when multi-dragging
        │
        └── Event Lifecycle Desync: onDragEnd fires before onDrop
              └── Clears draggedPhotoIds prematurely
```

#### A. Detached Drag Image Instability

* **File:** `src/features/photos/FilmstripTray.tsx` (lines 366–381)
* **Mechanism:** Generating a canvas via `document.createElement('canvas')` and passing it to `e.dataTransfer.setDragImage(dragImage, ...)` without appending it to `document.body` triggers WebKit Bug #70845 in macOS WKWebView. Single-photo dragging worked because `ids.length === 1` bypassed `setDragImage`, while multi-photo drags failed completely until patched.
* **Mitigation in Code:** In `BatchActionBar.tsx:110-128`, a persistent `#afsn-drag-ghost-badge` DOM node is attached to `document.body`. However, `FilmstripTray.tsx` must maintain synchronized fallback handling.

#### B. DataTransfer Payload Sanitization & Fallback Chain

* **File:** `src/features/carousel/CarouselCanvas.tsx` (lines 695–725) vs `src/features/editor/KonvaEditorCanvas.tsx` (lines 2190–2220)
* **Risk:** macOS pasteboard filters non-standard MIME types (`application/x-afsn-photo-ids`).
* **Current Fallback Hierarchy:**
  1. `e.dataTransfer.getData('application/x-afsn-photo-ids')`
  2. `e.dataTransfer.getData('application/json')`
  3. Comma-separated or single ID in `e.dataTransfer.getData('text/plain')`
  4. Global Zustand store state: `usePhotoStore.getState().draggedPhotoIds`
  5. Selected fallback: `usePhotoStore.getState().selectedPhotoIds`
* **Fragility:** If a user selects 4 photos, starts dragging, and WebKit fires `dragend` before `drop`, `draggedPhotoIds` can be emptied. `FilmstripTray.tsx:824` uses a `setTimeout(() => usePhotoStore.setState({ draggedPhotoIds: [] }), 400)` debounce. This race-condition workaround is vulnerable under heavy main-thread UI operations.

### 2.2 Coordinate Translation in Carousel Canvas

* **File:** `src/features/carousel/CarouselCanvas.tsx` (lines 728–734)
* **Formula:**
  ```tsx
  const box = stageRef.current?.container().getBoundingClientRect() || containerRef.current?.getBoundingClientRect();
  const canvasX = (e.clientX - (box?.left ?? 0) - stagePos.x) / scale;
  const canvasY = (e.clientY - (box?.top ?? 0) - stagePos.y) / scale;
  const targetSlideIdx = getSlideIndexAtX(currentCarousel, canvasX);
  ```
* **Vulnerabilities:**
  - If the stage is zoomed (`scale !== 1`) or panned (`stagePos.x !== 0`), any disparity between `stageRef.current.container()` bounds and `containerRef.current` creates an offset error.
  - Multi-photo drops partition photos across the target slide using fixed 40px margins and 16px gutters, overwriting existing spatial arrangements rather than appending intelligently or respecting existing layout variations.

---

## 3. Vector Shape Masking & Corner Radius

### 3.1 Hardcoded Shape Restriction in Inspector

* **File:** `src/features/inspector/sections/ShapesBordersSection.tsx` (lines 300–374)
* **Code Defect:**
  ```tsx
  // ShapesBordersSection.tsx:302
  {/* 2. Corner Radii (For Rectangle / Rounded) */}
  {(currentShape === 'rectangle' || currentShape === 'rounded') && (
    <>
      <div className={styles.divider} />
      <div className={styles.propGroup}>
        <div className={styles.groupHeader}>
          <span className={styles.label}>Corner Radius</span>
          ...
        </div>
        ...
      </div>
    </>
  )}
  ```
* **Concern:**
  The corner radius slider (master radius) and individual corner controls (TL, TR, BR, BL) are conditionally rendered **only** when `currentShape` is `'rectangle'` or `'rounded'`.
* **Impact:** For all other shapes (`circle`, `oval`, `hexagon`, `octagon`, `star`, `scallop`, `heart`, `custom_svg`), the entire Corner Radius UI is hidden from the user.

### 3.2 Lack of Vertex Rounding in Shape Geometry Engine

* **File:** `src/domain/shapes.ts` (lines 38–93, 650–726)
* **Code Defect:**
  ```ts
  // shapes.ts:42-63
  export function createPolygonSvgPath(sides: number, width: number, height: number): string {
    ...
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
      const x = cx + rx * Math.cos(angle);
      const y = cy + ry * Math.sin(angle);
      if (i === 0) path += `M ${x.toFixed(2)} ${y.toFixed(2)}`;
      else path += ` L ${x.toFixed(2)} ${y.toFixed(2)}`; // Sharp straight lines
    }
    path += ' Z';
    return path;
  }
  ```
  ```ts
  // shapes.ts:699-712
  } else if (shapeType === 'hexagon' || shapeType === 'octagon') {
    ...
    for (let i = 0; i < sides; i++) {
      ...
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y); // Sharp straight lines
    }
  }
  ```
* **Analysis:**
  1. `createPolygonSvgPath` and `drawShapeToContext` implement sharp, unfilleted polygonal vertices (`c.lineTo(x, y)`).
  2. The `radii: [number, number, number, number]` argument passed into `drawShapeToContext` and `getShapeSvgPath` is completely ignored for `hexagon`, `octagon`, `star`, and other geometric shapes.
  3. There is no polygon vertex rounding algorithm (e.g. replacing sharp corner vertices with tangent arcs / quadratic bezier curves `arcTo` / `bezierCurveTo` based on a radius parameter).
  4. Even if the UI restriction in `ShapesBordersSection.tsx` were removed, applying a corner radius to a hexagon or octagon has zero visual effect because the geometry generator lacks rounding logic.

---

## 4. Performance & Memory Scaling

### 4.1 In-Memory Canvas Image Caching (Konva)

#### A. Thrashing Under Large Multi-Slide / Multi-Spread Views

* **Locations:**
  - `src/features/editor/KonvaEditorCanvas.tsx` (lines 80–120): `MAX_CANVAS_IMAGE_CACHE = 24`
  - `src/features/carousel/CarouselCanvas.tsx` (lines 28–45): `MAX_CAROUSEL_CACHE = 32`
* **Mechanism:**
  Both canvases implement an in-memory LRU cache storing decoded `HTMLImageElement` instances. When the cache limit is exceeded, the oldest entry is evicted:
  ```ts
  // KonvaEditorCanvas.tsx:103
  evicted.src = ''; // Release decoded bitmap texture immediately from GPU/RAM!
  ```
* **Concern & Impact:**
  - A 10-slide continuous Social Carousel with 4 photos per slide contains 40 active photo frames rendered simultaneously across the horizontal stage.
  - Because `MAX_CAROUSEL_CACHE = 32` is less than 40, panning horizontally across the carousel guarantees cache churn: previously decoded images are evicted, have their `src` wiped, and must be re-requested and re-decoded when scrolled back into view.
  - If `evicted.src = ''` runs on an image currently drawn inside an active Konva `Image` node, it can cause visible flashing or blank textures until the next render cycle reloads the asset.

### 4.2 High-Resolution Print Rendering & Export Memory Spikes

* **Files:**
  - `src-tauri/src/commands/export_commands.rs`
  - `src-tauri/src/export_engine/mod.rs`
  - `src-tauri/src/photo_engine/mod.rs` (lines 360–380)
* **Memory Arithmetic:**
  - Standard 12×12 inch print album spread (24×12 inches total spread):
    $$\text{Width} = 24 \text{ in} \times 300 \text{ PPI} = 7200 \text{ px}$$
    $$\text{Height} = 12 \text{ in} \times 300 \text{ PPI} = 3600 \text{ px}$$
  - A single uncompressed 8-bit RGBA raster buffer requires:
    $$7200 \times 3600 \times 4 \text{ bytes} \approx 103.68 \text{ MB}$$
  - During batch export, `export_commands.rs` utilizes `rayon::par_iter()` across CPU cores. On an 8-core Apple Silicon chip, rendering 8 spreads concurrently allocates ~830 MB of raw pixel memory simultaneously, plus intermediate rotation/crop buffers, font rasters, and sharpening matrices.
* **macOS Memory Allocator Inaction:**
  In `src-tauri/src/photo_engine/mod.rs:370`:
  ```rust
  pub fn trim_process_memory() {
      #[cfg(target_os = "windows")]
      { ... EmptyWorkingSet ... }
      #[cfg(not(target_os = "windows"))]
      {
          // On macOS (Darwin) and Linux, memory page compression and paging
          // are managed automatically by the OS virtual memory allocator.
      }
  }
  ```
  On macOS, `trim_process_memory()` is an empty stub. The default system allocator (`libmalloc`) retains allocated virtual memory arenas after large batches of image decoding/rendering, causing macOS Activity Monitor to report elevated RSS memory usage (often >2 GB) long after export completion.

### 4.3 Large Photo Library Scaling in UI

* **File:** `src/features/photos/FilmstripTray.tsx` (lines 750–825)
* **Code Defect:**
  ```tsx
  // FilmstripTray.tsx:752-753
  <div className={styles.photoList}>
    {sortedPhotos.map((photo) => { ... })}
  </div>
  ```
* **Concern:**
  `FilmstripTray` renders every photo in `sortedPhotos` directly into the DOM as an individual card element without virtual windowing (e.g. `react-window` or `@tanstack/react-virtual`).
* **Scale Limits:**
  - Professional photography shoots (weddings, galas, events) routinely involve 1,000 to 5,000 photos.
  - Rendering 3,000 DOM card nodes—each with nested wrappers, thumbnail `<img>` tags, badges, tooltip attributes, and event listeners—causes high DOM memory overhead, main-thread garbage collection pauses, and scroll jank in the filmstrip.
  - In `src/stores/photoStore.ts:464-490`, all library photos are held as a flat JavaScript array in memory (`photos: Photo[]`). Sorting or filtering 5,000 photos on every keystroke runs directly on the frontend main thread.

---

## 5. Architectural Pain Points & Risk Matrix

| Risk ID | Domain | Severity | Impact | Code Location |
|---|---|---|---|---|
| **RSK-01** | State Separation | HIGH | Context menu "Place on Spread" executes album actions when in Carousel mode | `PhotoContextMenu.tsx:125-136` |
| **RSK-02** | Drag & Drop | MEDIUM | External Finder drops in Carousel mode ignore mouse drop coordinates | `WorkspaceLayout.tsx:505-555` |
| **RSK-03** | Vector Masking | MEDIUM | Corner radius controls hidden for all polygon and decorative vector shapes | `ShapesBordersSection.tsx:302` |
| **RSK-04** | Vector Masking | MEDIUM | Polygon path generator lacks vertex rounding algorithms (radii ignored) | `shapes.ts:42-63, 699-712` |
| **RSK-05** | Performance | MEDIUM | Konva LRU image cache (32 items) thrashes on full 10-slide carousels (40+ frames) | `CarouselCanvas.tsx:28-45` |
| **RSK-06** | Performance | HIGH | Filmstrip lacks DOM virtualization, risking UI freeze on libraries >1,500 photos | `FilmstripTray.tsx:752-753` |
| **RSK-07** | Memory | MEDIUM | macOS lacks explicit heap/arena trimming after large export or import batches | `src-tauri/src/photo_engine/mod.rs:370` |

---

## 6. Recommended Remediation Strategies

1. **Context Menu Mode Awareness**:
   Pass `activeMode` into `PhotoContextMenu`. If `activeMode === 'carousel'`, label the action "Place on Slide" and invoke `useCarouselStore.getState().addPhotoFrame(...)` against `activeSlideIndex`.

2. **Carousel Finder Drop Coordinate Translation**:
   In `WorkspaceLayout.tsx:handleCanvasFinderDrop`, when `activeMode === 'carousel'`, use `clientX` and `clientY` with stage bounds to determine the exact slide and position under the cursor, enabling single-photo frame replacement and localized placement.

3. **Universal Vertex Filleting in `shapes.ts`**:
   Implement a polygon vertex rounding function (calculating fillet arc tangents or quadratic beziers for each polygon corner) and expose the radius slider in `ShapesBordersSection.tsx` for `hexagon`, `octagon`, and `star`.

4. **Dynamic Canvas Image Cache Sizing**:
   Calculate `MAX_CAROUSEL_CACHE` dynamically based on total active frames on canvas:
   $$\text{CacheSize} = \max(32, \text{totalActiveFrames} + 8)$$
   Prevent `evicted.src = ''` from executing on images currently mounted in the active render tree.

5. **Filmstrip Virtualization**:
   Integrate a lightweight horizontal virtualizer (`react-window` or native offset slicing) in `FilmstripTray.tsx` to ensure only visible cards are mounted in the DOM.
