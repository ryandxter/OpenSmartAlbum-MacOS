# Comprehensive Code Review: Workspace Switcher, Carousel Canvas, Filmstrip & Vector Shapes

**Date:** September 28, 2026  
**Auditor:** GSD Code Review Subagent  
**Scope:**  
- `src/features/workspace/WorkspaceLayout.tsx`
- `src/features/carousel/CarouselCanvas.tsx`
- `src/features/photos/FilmstripTray.tsx`
- `src/features/photos/PhotoContextMenu.tsx`
- `src/features/photos/BatchActionBar.tsx`
- `src/features/inspector/sections/ShapesBordersSection.tsx`
- `src/domain/shapes.ts`
- `src/stores/carouselStore.ts`
- `src/stores/editorStore.ts`
- `src/stores/appStore.ts`

---

## 1. Executive Summary & Architecture Overview

The OpenSmartAlbum codebase features a dual-mode workflow: traditional physical **Print Album** mode (spread-based, physical millimeter/inch coordinate space with safe margins and spine gutters) and **Social Carousel** mode (continuous multi-slide panoramic stage in pixel space for Instagram 1:1, 4:5, and 9:16 slices).

While both modes share foundational services (photo library ingestion, project metadata, vector shape paths, and the floating inspector container), several architectural fractures and critical state synchronization issues were uncovered during this review:

1. **Complete Absence of Carousel Persistence**: Carousel state exists exclusively in volatile memory within `useCarouselStore`. Saving the project (`Cmd+S`), autosave, export package, and window close handlers only persist `albumStore`. All carousel slides, layout structures, and customizations are silently discarded upon application exit or project reload.
2. **Fatal Slide Reorder / Deletion / Duplication Coordinate Desync**: Photo frames in the carousel canvas use absolute stage coordinates (`frame.x`). Reordering, deleting, or duplicating slides modifies slide index boundaries without updating the contained frames' `x` coordinates, completely detaching photo frames from their slides.
3. **Cross-Mode State Leakage & Missing Guards**: Multiple UI controls—including the Photo Context Menu ("Place on Canvas"), Title Bar Undo/Redo/Add-Text buttons, and the Inspector's Background Color picker—operate unconditionally on `albumStore`, silently mutating hidden album spreads when the user is working in Carousel mode.
4. **Custom SVG Mask Scaling Failure**: Custom SVG vector masks uploaded through the inspector are parsed without viewBox normalization or dimension scaling, causing them to clip unpredictably unless the SVG dimensions happen to match the target frame exactly.

---

## 2. Severity-Rated Findings Summary

| ID | Severity | File(s) | Summary |
|---|---|---|---|
| **CRIT-01** | 🔴 Critical | `carouselStore.ts`, `projectStore.ts`, `App.tsx` | Carousel state is never persisted to SQLite or `.afsn` packages; total data loss on project save/close. |
| **CRIT-02** | 🔴 Critical | `carouselStore.ts` | `deleteSlide`, `duplicateSlide`, and `reorderSlide` do not offset contained frames' absolute `x` coordinates, breaking canvas layout. |
| **CRIT-03** | 🔴 Critical | `PhotoContextMenu.tsx`, `FilmstripTray.tsx` | "Place on Canvas" ignores `activeMode`; mutates hidden album spreads while in Carousel mode. |
| **WARN-01** | 🟡 Warning | `AppTitleBar.tsx` | Titlebar Undo/Redo and "Add Text" buttons ignore `activeMode`, dispatching to `albumStore` in Carousel mode. |
| **WARN-02** | 🟡 Warning | `ShapesBordersSection.tsx`, `EffectsShadowsSection.tsx` | Inspector sections leak mutations to `albumStore`; multi-selection in Carousel mode is ignored. |
| **WARN-03** | 🟡 Warning | `carouselStore.ts` | Dynamic layout cycling, auto-flow, and hero photo assignment strip all border styling and shape masks. |
| **WARN-04** | 🟡 Warning | `carouselStore.ts` | `swapFrames` sets `selectedFrameId` but leaves `selectedFrameIds` stale, causing Transformer state desync. |
| **WARN-05** | 🟡 Warning | `ShapesBordersSection.tsx`, `domain/shapes.ts` | Custom SVG mask upload lacks viewBox normalization and only captures the first `<path>` tag. |
| **WARN-06** | 🟡 Warning | `FilmstripTray.tsx` | `usedPhotoIdSet` only checks `currentAlbum.spreads`, omitting `currentAlbum.coverSpread`. Cover photos appear as "Unused". |
| **WARN-07** | 🟡 Warning | `WorkspaceLayout.tsx` | External Finder drop in Carousel mode ignores drop coordinates, active slide targeting, and photo replacement. |
| **WARN-08** | 🟡 Warning | `CarouselCanvas.tsx`, `dividerGraph.ts` | Photo swap target detection ignores frame rotation; Konva center calculation ignores group rotation. |
| **WARN-09** | 🟡 Warning | `CarouselCanvas.tsx` | `carouselImageCache` eviction sets `src = ''` on active images, causing visual flashes and render errors. |
| **INFO-01** | 🔵 Info | `CarouselCanvas.tsx`, `FilmstripTray.tsx` | High-frequency mousemove, trackpad wheel, and marquee pointer events lack RAF coalescing. |
| **INFO-02** | 🔵 Info | `domain/shapes.ts` | `traceSvgArc` lacks division-by-zero guard for coincident points, risking `NaN` propagation. |
| **INFO-03** | 🔵 Info | `ShapesBordersSection.tsx` | `oval` shape preset exists in domain model and canvas renderer but lacks a UI button. |

---

## 3. Detailed Findings by File & System

### 3.1 `src/stores/carouselStore.ts` & `src/stores/projectStore.ts`

#### [CRIT-01] Ephemeral Carousel State / Zero Persistence Pipeline
- **Location:** `src/stores/carouselStore.ts`, `src/stores/projectStore.ts`, `src/App.tsx:151-167`
- **Issue:** `useCarouselStore` maintains the full data model for Instagram and Social Media Carousels (`slides`, `elements`, `ratio`, `slideWidthPx`, `slideHeightPx`). However, unlike `albumStore`, there is **no SQLite schema, no Tauri IPC command (`save_carousel_structure` or `load_carousel_structure`), and no serialization into the `.afsn` archive**.
- **Impact:** When a user creates a 10-slide carousel, designs layouts, applies borders, and clicks "Save" (`Cmd+S`), `projectStore.saveProject()` only writes `albumStore.saveAlbumToDb()` and exports the album spreads into the `.afsn` zip. If the application is closed or another project is opened, **the entire carousel is permanently lost**. Furthermore, `syncUnsavedStatus` in `App.tsx` does not subscribe to `useCarouselStore`, so the window close protection dialog never fires when only carousel edits exist.
- **Remediation:** 
  1. Add carousel payload serialization to the `.afsn` package (`carousel.json`).
  2. Implement SQLite tables (`carousel_projects`, `carousel_slides`, `carousel_elements`) or store a serialized JSON payload in SQLite.
  3. Include `useCarouselStore` in the dirty check inside `App.tsx` (`syncUnsavedStatus`).

#### [CRIT-02] Absolute Coordinate Desynchronization in Slide Reorder, Deletion, and Duplication
- **Location:** `src/stores/carouselStore.ts:267-347`
- **Issue:** In the Carousel Canvas, photo frame `x` positions represent continuous horizontal coordinates across the whole stage (`x = slideIndex * slideWidthPx + localX`).
  - `deleteSlide(index)` removes slide `index` and decrements `slideIndex` for subsequent slides, but leaves all `element.x` coordinates intact. Frames that belonged to Slide 2 remain at `x = 2160` even though Slide 2 has moved to `x = 1080`.
  - `duplicateSlide(index)` clones slide `index` and inserts it at `index + 1`. The duplicated frames retain the original `x` coordinates (stacking directly on top of the original slide), while slides following `index + 1` are not shifted right by `slideWidthPx`.
  - `reorderSlide(fromIndex, toIndex)` moves a slide without adjusting any `x` coordinates.
- **Impact:** Reordering or deleting slides visually breaks the canvas. Frames float over incorrect slides or extend beyond canvas boundaries.
- **Remediation:** When slides are shifted or reordered, update every contained frame's `x` position by `(newSlideIndex - oldSlideIndex) * slideWidthPx`. For spanning frames that cross a deleted slide, clamp their width or delete the span cleanly.

#### [WARN-04] `swapFrames` State Desynchronization Between `selectedFrameId` and `selectedFrameIds`
- **Location:** `src/stores/carouselStore.ts:1120-1126`
- **Issue:**
  ```typescript
  set({
    currentCarousel: { ...currentCarousel, slides: updatedSlides },
    selectedFrameId: frameIdB,
  });
  ```
  `selectedFrameId` is updated to `frameIdB`, but `selectedFrameIds` is omitted from the state patch, leaving `selectedFrameIds = [frameIdA]`.
- **Impact:** `CarouselCanvas.tsx` determines visual selection via `selectedFrameIds.includes(frame.id)` and drives `Transformer.nodes()` from `selectedFrameIds`. After swapping, the Konva Transformer remains anchored to `frameIdA` while the Inspector inspects `frameIdB`.
- **Remediation:** Update both fields synchronously:
  ```typescript
  set({
    currentCarousel: { ...currentCarousel, slides: updatedSlides },
    selectedFrameId: frameIdB,
    selectedFrameIds: [frameIdB],
  });
  ```

#### [WARN-03] Dynamic Layouts and Auto-Flow Strip Vector Shapes and Border Styling
- **Location:** `src/stores/carouselStore.ts:472-495, 560-583, 807-824, 997-1020`
- **Issue:** When `cycleSlideLayout`, `applyDynamicSlideLayoutByIndex`, `autoFlowPhotosToSlides`, or `setHeroPhotoOnSlide` reconstruct photo frames, they construct new objects containing only geometric properties (`x`, `y`, `width`, `height`, `cropScale`, etc.). Existing frame styling—such as `borderEnabled`, `borderWidth`, `borderColor`, `borderStyle`, `cornerRadius`, `shapeType`, and `customSvgPath`—is dropped.
- **Impact:** Cycling a layout immediately strips all custom border colors, rounded corners, and vector mask shapes previously applied by the user.
- **Remediation:** Carry forward existing frame styling attributes from the source frame before replacing the layout.

---

### 3.2 `src/features/photos/PhotoContextMenu.tsx` & `src/features/photos/FilmstripTray.tsx`

#### [CRIT-03] Photo Context Menu Bypasses Active Mode and Mutates Hidden Album Spreads
- **Location:** `src/features/photos/PhotoContextMenu.tsx:125-136`, `src/features/photos/FilmstripTray.tsx:982-1005`
- **Issue:** `FilmstripTray` receives `activeMode` as a prop (`'print' | 'carousel'`), but does not pass it down to `PhotoContextMenu`. In `PhotoContextMenu`, clicking "Place on Spread Canvas" unconditionally executes:
  ```typescript
  const { currentAlbum, activeSpreadId } = useAlbumStore.getState();
  if (currentAlbum) {
    // ...
    useEditorStore.getState().addPhotosToSpread(activeSpread.id, toPlace);
  }
  ```
- **Impact:** A user in Social Carousel mode who right-clicks a photo and selects "Place on Spread Canvas" will see nothing happen on screen. In the background, the photo is added to the hidden print album spread. Additionally, `usedCount` in `usePhotoStore` is not updated.
- **Remediation:**
  1. Pass `activeMode` into `PhotoContextMenu`.
  2. Update the label conditionally: `"Place on Slide"` vs `"Place on Spread Canvas"`.
  3. Route placement to `useCarouselStore.getState().addPhotoFrame` when in Carousel mode, and update `photoStore.usedCount`.

#### [WARN-06] `FilmstripTray.tsx` Ignores Cover Spread When Computing Used Photos
- **Location:** `src/features/photos/FilmstripTray.tsx:218-223`
- **Issue:**
  ```typescript
  // Print album mode
  if (!currentAlbum) return set;
  (currentAlbum.spreads || []).forEach((spread) => {
    (spread.elements || []).forEach((el) => {
      if (el.type === 'photo' && el.photoId) set.add(el.photoId);
    });
  });
  ```
  `currentAlbum.coverSpread` is a standalone property distinct from `currentAlbum.spreads`. By looping only over `currentAlbum.spreads`, photos placed on the front, back, or spine of the cover spread are omitted from `usedPhotoIdSet`.
- **Impact:** Cover photos display as "Unused" in the filmstrip. They appear when filtering by "Unused" and disappear when filtering by "Used".
- **Remediation:** Use `getAllAlbumSpreads(currentAlbum)` instead of `currentAlbum.spreads || []`.

#### [INFO-01] Filmstrip Marquee Selection Layout Thrashing
- **Location:** `src/features/photos/FilmstripTray.tsx:474-493`
- **Issue:** In `handleBodyPointerMove`, the marquee drag selection iterates over every `.photoCard` element in the DOM and calls `card.getBoundingClientRect()` on each pointer event.
- **Impact:** In libraries with 500+ photos, calling `getBoundingClientRect()` hundreds of times per second causes severe browser layout thrashing, main-thread blocking, and noticeable pointer stutter.
- **Remediation:** Cache card bounding rectangles once in `handleBodyPointerDown` or throttle `handleBodyPointerMove` using `requestAnimationFrame`.

---

### 3.3 `src/features/workspace/WorkspaceLayout.tsx` & `src/features/workspace/AppTitleBar.tsx`

#### [WARN-01] App Title Bar Undo/Redo & Add-Text Actions Ignore Carousel Mode
- **Location:** `src/features/workspace/AppTitleBar.tsx:347-366, 483-500`
- **Issue:**
  - The Title Bar renders Undo and Redo buttons whose `disabled` state is bound to `useHistoryStore.canUndo` / `canRedo` (album history), and whose `onClick` calls `albumStore.undo()` / `redo()`. In Carousel mode, clicking these buttons executes undo/redo on the hidden album spread, ignoring `carouselStore`'s history stack.
  - The "Add Text" button in `AppTitleBar.tsx` calls `addTextToSpread(activeSpreadId)` regardless of `activeMode`.
- **Impact:** Visual buttons in the macOS title bar desync from keyboard shortcuts (`Cmd+Z` is properly routed to `carouselStore` in `WorkspaceLayout.tsx`, but clicking the title bar Undo button mutates `albumStore`).
- **Remediation:** Bind the Title Bar buttons to `activeMode`:
  ```typescript
  const isCarousel = activeMode === 'carousel';
  const handleUndo = isCarousel ? useCarouselStore.getState().undo : undo;
  const canUndoResolved = isCarousel ? useCarouselStore((s) => s.canUndo) : canUndo;
  ```
  Hide or adapt the "Add Text" button when in Carousel mode if text nodes are not yet supported for carousels.

#### [WARN-07] External Finder Drop in Carousel Mode Ignores Drop Coordinates and Replacement
- **Location:** `src/features/workspace/WorkspaceLayout.tsx:465-565`
- **Issue:** When image files are dragged from macOS Finder onto the canvas:
  - In Print mode (`activeMode === 'print'`), `clientX` and `clientY` are converted to canvas coordinates to detect whether the file was dropped over an existing frame (replacing the photo) or onto empty canvas.
  - In Carousel mode (`activeMode === 'carousel'`), `clientX` and `clientY` are ignored. Dropping photos onto Slide 3 always places them onto `activeSlideIndex` (which could be Slide 0). Hovering over an existing frame never triggers a photo replace.
- **Impact:** Finder drag-and-drop does not respect target slide placement or photo swapping in Carousel mode.
- **Remediation:** In `handleCanvasFinderDrop`, convert `clientX` to continuous stage `x` using the Konva stage transform, resolve `targetSlideIndex = getSlideIndexAtX(currentCarousel, stageX)`, and hit-test existing frames for replacement before appending new frames.

#### [WARN-09] Memory Leak: Uncleaned Global Toast Timeout
- **Location:** `src/features/workspace/WorkspaceLayout.tsx:181-187`
- **Issue:** `toastTimeoutRef` is stored in a ref and cleared when a new toast arrives, but there is no cleanup hook on unmount.
- **Remediation:** Add `return () => { if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current); }` in an unmount `useEffect`.

---

### 3.4 `src/features/carousel/CarouselCanvas.tsx`

#### [WARN-08] Inaccurate Photo Swap Hit-Testing Due to Frame Rotation and Center Calculation
- **Location:** `src/features/carousel/CarouselCanvas.tsx:1025-1029`, `src/domain/layout/dividerGraph.ts:311-329`
- **Issue:**
  1. `CarouselCanvas.tsx` computes the dragged frame's center as:
     ```typescript
     const cx = node.x() + node.width() / 2;
     const cy = node.y() + node.height() / 2;
     ```
     In Konva, when a Group has `rotation !== 0`, `node.x()` is the origin/pivot point. Computing `x + width/2` does not account for the rotation angle, yielding an incorrect stage coordinate.
  2. `findPhotoSwapTarget` in `dividerGraph.ts` uses an unrotated AABB test (`point.x >= f.x && point.x <= f.x + f.width && ...`). If target frames are rotated, swap hit-testing is geometrically inaccurate.
- **Impact:** Dragging photos over rotated frames fails to trigger swap targets, or triggers unintended swaps.
- **Remediation:** Use `node.getAbsoluteTransform().point({ x: node.width() / 2, y: node.height() / 2 })` to compute the visual center, and use `photoSwapDrag.ts`'s rotated `containsPoint` implementation instead of `dividerGraph.ts`'s AABB check.

#### [WARN-09] Destructive LRU Cache Eviction Causes Stage Visual Glitches
- **Location:** `src/features/carousel/CarouselCanvas.tsx:45-56`
- **Issue:**
  ```typescript
  if (evicted) {
    evicted.onload = null;
    evicted.onerror = null;
    evicted.src = '';
  }
  ```
  `carouselImageCache` stores HTML `Image` instances. When cache size exceeds 32, the oldest image has `evicted.src = ''` called on it. However, `CarouselFrameNode` holds this exact `imageObj` in its React state. If that frame is still mounted on the stage (e.g. on Slide 1 while user is viewing Slide 10), setting `src = ''` clears the image buffer, causing a black box or render crash.
- **Remediation:** Remove `evicted.src = ''`. Allow the browser garbage collector to reclaim the Image buffer when references drop naturally, or only evict images whose URL is not mounted on the visible stage.

#### [INFO-01] Missing RequestAnimationFrame Coalescing for Continuous Panning and Wheel
- **Location:** `src/features/carousel/CarouselCanvas.tsx:553-557, 865-872`
- **Issue:** Continuous panning in `onMouseMove` and trackpad 2D scrolling in `handleWheel` dispatch `setStagePos` directly on every native event. High-frequency gaming mice (500–1000Hz) and macOS trackpads fire hundreds of events per second, causing excessive React re-renders.
- **Remediation:** Coalesce position updates into `requestAnimationFrame`.

---

### 3.5 `src/features/inspector/sections/ShapesBordersSection.tsx` & `src/domain/shapes.ts`

#### [WARN-02] Inspector Properties Leak to Album Store & Fail on Multi-Selection in Carousel Mode
- **Location:** `src/features/inspector/sections/ShapesBordersSection.tsx:53-58, 104-120`
- **Issue:**
  1. In Carousel mode, `ShapesBordersSection` only reads `selectedCarouselFrameId`. If the user selects 3 frames on a slide (via shift-click or `Cmd+A`), `selectedElements` is empty and `carouselFrame` only resolves the primary frame. Adjusting stroke width or border color only updates that single frame, ignoring the other selected frames.
  2. In `EffectsShadowsSection.tsx`, `activeMode` is not checked. Changing background color modifies `albumStore.updateSpreadBackgroundColor`, leaving the carousel slide background unchanged while mutating the hidden album spread.
- **Remediation:**
  - In `ShapesBordersSection.tsx`, read `selectedFrameIds` from `useCarouselStore` and invoke `useCarouselStore.getState().batchUpdateFrames(...)` when in Carousel mode.
  - Pass `activeMode` to `EffectsShadowsSection` and invoke `updateSlideBackground(activeSlideIndex, color)` when `activeMode === 'carousel'`.

#### [WARN-05] Custom SVG Vector Mask Upload Lacks Scaling, Normalization, and Multi-Path Support
- **Location:** `src/features/inspector/sections/ShapesBordersSection.tsx:160-183`, `src/domain/shapes.ts:189-193, 341-643`
- **Issue:**
  1. `text.match(/<path[^>]*d=["']([^"']+)["']/i)` only matches the first `<path>` element. Compound paths or SVGs using `<polygon>`, `<rect>`, or `<circle>` fail.
  2. The raw path `d` string is stored directly as `customSvgPath` without normalizing against the SVG's `viewBox` or scaling to the frame's `width` and `height`.
- **Impact:** An SVG with `viewBox="0 0 1024 1024"` drawn on a 300×300 photo frame will be clipped to a tiny fraction of its vector, while an icon with `viewBox="0 0 24 24"` will only mask a 24×24 pixel corner.
- **Remediation:** Parse the SVG's `viewBox` or compute path bounds (`DOMParser` / `Path2D`), calculate scale factors `sx = width / viewBoxWidth` and `sy = height / viewBoxHeight`, and scale coordinates during tokenization or context tracing.

#### [INFO-02] SVG Arc Converter Division by Zero Guard Missing
- **Location:** `src/domain/shapes.ts:273-285`
- **Issue:** In `traceSvgArc`, `angleBetween` calculates `uLen = Math.hypot(ux, uy)` and `vLen = Math.hypot(vx, vy)`. If `x1p === cxp` and `y1p === cyp`, `uLen` or `vLen` evaluates to 0. `dot / (uLen * vLen)` yields `NaN`, causing all subsequent bezier coordinates to become `NaN`.
- **Remediation:** Guard against zero length:
  ```typescript
  if (uLen === 0 || vLen === 0) return 0;
  ```

#### [INFO-03] Missing `oval` Preset Button in Shapes Inspector
- **Location:** `src/features/inspector/sections/ShapesBordersSection.tsx:201-291`, `src/domain/shapes.ts:12, 175-178`
- **Issue:** The `oval` shape preset is implemented in `domain/shapes.ts` (`getShapeSvgPath` and `drawShapeToContext`), but there is no corresponding button in `ShapesBordersSection.tsx`.
- **Remediation:** Add an Oval button alongside Circle in the preset grid.

---

## 4. Architectural Cohesion & State Flow Analysis

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Application State                              │
├──────────────────────────────────────┬──────────────────────────────────────┤
│           Print Album Mode           │         Social Carousel Mode         │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ • useAlbumStore (spreads, cover)     │ • useCarouselStore (slides, frames)  │
│ • useEditorStore (selection, crops)  │ • (Missing persistent storage)       │
│ • useHistoryStore (album undo/redo)  │ • CarouselStore past/future (isolated)│
│ • SQLite & .afsn persistence         │ • Ephemeral in-memory only           │
└──────────────────────────────────────┴──────────────────────────────────────┘
                                  ▲
                                  │ Cross-Mode Leaks Detected
┌─────────────────────────────────┴───────────────────────────────────────────┐
│                               Shared Surfaces                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ ⚠️ AppTitleBar: Undo/Redo & Add-Text route exclusively to albumStore         │
│ ⚠️ PhotoContextMenu: "Place on Canvas" routes exclusively to albumStore      │
│ ⚠️ EffectsShadowsSection: Background color picker routes to albumStore       │
│ ⚠️ FilmstripTray: usedPhotoIdSet ignores coverSpread photos                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Actionable Remediation Checklist

### Priority 1: Critical (Data Loss & Layout Corruption)
- [ ] **Carousel Persistence**: Add a JSON field or dedicated tables to SQLite and include `carousel.json` in the `.afsn` archive export and import workflows.
- [ ] **Carousel Dirty State**: Hook `useCarouselStore` into `App.tsx`'s `syncUnsavedStatus` so window closure warns of unsaved carousel work.
- [ ] **Slide Coordinate Shifts**: Update `deleteSlide`, `duplicateSlide`, and `reorderSlide` in `carouselStore.ts` to adjust contained frames' `x` positions by `deltaIndex * slideWidthPx`.
- [ ] **Context Menu Mode Awareness**: Pass `activeMode` into `PhotoContextMenu.tsx` and implement carousel frame placement when `activeMode === 'carousel'`.

### Priority 2: High (UI State Desync & Mode Leaks)
- [ ] **Title Bar Mode Routing**: In `AppTitleBar.tsx`, route Undo/Redo actions to `carouselStore` when in Carousel mode, and disable "Add Text" if carousel text is unhandled.
- [ ] **Inspector Multi-Selection & Backgrounds**: In `ShapesBordersSection.tsx`, update all selected carousel frames via `batchUpdateFrames`. Pass `activeMode` to `EffectsShadowsSection.tsx` and call `updateSlideBackground`.
- [ ] **Preserve Styling on Layout Cycle**: Update `cycleSlideLayout`, `applyDynamicSlideLayoutByIndex`, and `autoFlowPhotosToSlides` to carry over existing border, radius, and shape mask properties.
- [ ] **Selection Sync on Swap**: In `carouselStore.swapFrames`, update both `selectedFrameId` and `selectedFrameIds`.
- [ ] **Filmstrip Cover Photos**: In `FilmstripTray.tsx`, compute `usedPhotoIdSet` using `getAllAlbumSpreads(currentAlbum)` to include `coverSpread`.

### Priority 3: Medium (Math Accuracy & Performance)
- [ ] **Rotated Swap Detection**: In `CarouselCanvas.tsx`, use the Konva absolute transform for the dragged node center, and use rotated point containment for swap targets.
- [ ] **SVG Mask Normalization**: Scale uploaded SVG `<path>` vectors according to the SVG `viewBox` and frame dimensions.
- [ ] **Cache Eviction Safety**: Remove `evicted.src = ''` in `CarouselCanvas.tsx` to prevent blanking visible frames.
- [ ] **Marquee Throttling**: Throttle `FilmstripTray` marquee selection using `requestAnimationFrame`.
- [ ] **Expose Oval Shape**: Add the `oval` button to `ShapesBordersSection.tsx`.
