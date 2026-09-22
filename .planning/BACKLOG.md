# MILESTONE BACKLOG: OpenSmartAlbum macOS v1.1.0

**Milestone Objective:** Fix Finder drag-drop, enable complete photo placement & layouting in Carousel Mode, resolve layout preview contrast & shuffling lag, and restore vector shape clipping masks.  
**Diagnostic Status:** Forensics (`FORENSICS.md`), Code Review (`CODE-REVIEW.md`), and UI Audit (`UI-REVIEW.md`) fully completed.  
**Next GSD Steps Remaining:** `/gsd-explore` & `/gsd-research` -> `/gsd-plan-phase` -> `/gsd-execute-phase`.

---

## 📋 Prioritized Backlog Items

### 1. [CRIT-01] Native macOS Finder Direct Drag-and-Drop Photo & Folder Import
- **Ref:** `FORENSICS.md#incident-1`, `CODE-REVIEW.md#1-drag--drop-pipeline`
- **Goal:** Users can drag images or folders directly from Finder into any part of the app window to trigger non-blocking import.
- **Key Tasks:**
  - [ ] Set `"dragDropEnabled": true` in `src-tauri/tauri.conf.json`.
  - [ ] Add Tauri 2 window drag-drop event listener (`onDragDropEvent`) in `WorkspaceLayout.tsx`.
  - [ ] Route dropped paths to `usePhotoStore.getState().importPaths(currentProject.id, paths)`.
  - [ ] Implement a full-screen semi-transparent glass Drop Zone Overlay with HIG visual feedback.

### 2. [CRIT-02] Social Carousel Mode Full Photo Placement & Smart Layout Engine
- **Ref:** `FORENSICS.md#incident-2`, `CODE-REVIEW.md#2-carousel-mode-integration`, `Screenshot 2026-09-22 at 22.02.45.png`
- **Goal:** Social Carousel Mode supports effortless photo placement (drag & drop, double-click) and adaptive slide layouts.
- **Key Tasks:**
  - [ ] Implement `onDragOver` and `onDrop` in `CarouselCanvas.tsx` to accept dragged photos from `FilmstripTray`.
  - [ ] Update `FilmstripTray.tsx` double-click handler to support `activeMode === 'carousel'` by adding photos centered on active slide.
  - [ ] Update `usedPhotoIdSet` in `FilmstripTray.tsx` to include photos placed in `currentCarousel.slides`.
  - [ ] Build Carousel Smart Layout generator for vertical feed ratios (1:1, 4:5, 9:16) with 1, 2, 3, 4 photo arrangements.
  - [ ] Adapt `InspectorContainer.tsx` header to show `Active: Slide X (1080 × 1350 px)` in Carousel Mode.

### 3. [CRIT-03] Smart Layout Preview Grid Contrast Correction & Shuffling Performance
- **Ref:** `FORENSICS.md#incident-3`, `CODE-REVIEW.md#3-smart-layout-rendering--performance`, `Screenshot 2026-09-22 at 22.06.11.png`
- **Goal:** Inactive layout preview tiles must be immediately recognizable with crisp contrast; eliminate lag during photo shuffling.
- **Key Tasks:**
  - [ ] In `TemplatesPanel.tsx`, replace invisible `#27272a` fill with high-contrast studio silhouette: `rgba(255, 255, 255, 0.08)` fill and `rgba(255, 255, 255, 0.22)` stroke.
  - [ ] Keep active card highlighted with vibrant blue accent (`#3b82f6`).
  - [ ] Memoize layout variation generation with caching key to prevent lag on rapid shuffle / photo selection.
  - [ ] Add smooth opacity transition when switching layout variations.

### 4. [CRIT-04] Vector Shape Masking & Non-Rectangular Clipping Engine
- **Ref:** `FORENSICS.md#incident-4`, `CODE-REVIEW.md#4-vector-shape-masking-engine`
- **Goal:** Restore vector shape clipping masks (Circle, Oval, Hexagon, Octagon, Star, Heart, Scallop, Custom SVG) across both Album and Carousel modes.
- **Key Tasks:**
  - [ ] Refactor `drawShapeToContext` in `src/domain/shapes.ts` to trace commands directly onto Konva's context without premature `c.clip(p)` calls.
  - [ ] Implement complete vector path parsing (`M, L, C, Q, Z`) for stars, hearts, scallops, and custom SVG paths.
  - [ ] Wrap `CarouselFrameNode` in `CarouselCanvas.tsx` with `<Group clipFunc={...}>` to support shapes in Carousel Mode.
  - [ ] Wire `ShapesBordersSection.tsx` to call `useCarouselStore.getState().updatePhotoFrame` when in Carousel Mode.
