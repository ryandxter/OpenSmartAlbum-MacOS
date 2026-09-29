# Execution Summary: Plan 15-02 - Frontend Store Persistence, Autosave Engine & Project Hydration

**Phase:** 15 - Social Carousel Full SQLite & Package Persistence  
**Plan:** 15-02  
**Status:** Completed  
**Requirements Covered:** `PERS-02`, `PERS-03`, `PERS-04`

---

## 1. Objectives & Overview
Plan 15-02 connects the SQLite database tables and IPC commands built in Plan 15-01 to the Zustand state layer and React user interface:
1. Extended `useCarouselStore` with persistence fields (`saveStatus`, `lastSavedAt`), action `markDirty()`, and asynchronous IPC actions `saveCarouselToDb()` and `loadCarouselFromDb()`.
2. Instrument every carousel mutation with `markDirty()`, switching state from `'saved'` to `'unsaved'`.
3. Upgraded `useProjectStore` to be mode-aware (`canvasUnit === 'px' || projectType === 'carousel'`), routing `createNewProject`, `openProjectById`, `saveProject`, `exportProjectAsAfsn`, `exportCompleteProjectPackageWithPhotos`, `importProjectFromAfsn`, `openProjectFromFile`, and `closeProject` to the appropriate store (`carouselStore` vs `albumStore`).
4. Overhauled `useAutoSave.ts` with carousel crash snapshot recovery (`afsn_carousel_snapshot_${id}`), dirty flag synchronization (`afsn_dirty_${id}`), 2.5-second debounced autosaves, and an immediate save trigger on window `blur`.
5. Updated `AppTitleBar.tsx` and `AppTitleBar.module.css` with a responsive status dot: glowing amber (`#F59E0B`) on unsaved changes, pulsing blue (`#3B82F6`) while saving, and solid green (`#10B981`) when all changes are saved.

---

## 2. Key Changes & Architecture

### A. Carousel State Management (`src/stores/carouselStore.ts`)
- Added `saveStatus: 'saved' | 'saving' | 'unsaved'` and `lastSavedAt: string | null` to `CarouselState`.
- Implemented `persistCarouselInOrder` write queue to prevent overlapping SQLite write operations.
- Added `markDirty()`: sets `saveStatus: 'unsaved'`.
- Added `setSaveStatus(status)`: updates `saveStatus` and timestamps `lastSavedAt` when status is `'saved'`.
- Added `saveCarouselToDb()`:
  - Sanitizes `CarouselPhotoFrame` properties (coordinates, dimensions, crop parameters, borders, border styles, corner radii, SVG paths, z-indexes).
  - Invokes Tauri command `'save_carousel_structure'` passing `{ carousel: sanitizedCarousel }`.
  - Serializes a crash snapshot to `localStorage.setItem('afsn_carousel_snapshot_' + id, ...)`.
  - Sets `saveStatus: 'saved'` on success.
- Added `loadCarouselFromDb(projectId)`:
  - Invokes Tauri command `'load_carousel_structure'`.
  - Falls back to localStorage snapshot if IPC fails or running in test/web environment.
  - Reconstructs domain `Carousel` structure, resets undo/redo history stacks, and sets `saveStatus: 'saved'`.
- Embedded `get().markDirty()` within `pushHistory()`, ensuring all 20+ mutations (`setRatio`, `addSlide`, `deleteSlide`, `duplicateSlide`, `reorderSlide`, `updateSlideBackground`, `addPhotoFrame`, `addPhotoFrames`, `updatePhotoFrame`, `removePhotoFrame`, `applyCarouselLayout`, `cycleSlideLayout`, `applyDynamicSlideLayoutByIndex`, `shuffleSlidePhotos`, `autoFlowPhotosToSlides`, `setPanoramaSpan`, `setHeroPhotoOnSlide`, `batchUpdateFrames`, `swapFrames`) automatically mark state dirty.
- Undo and redo transitions `saveStatus` to `'unsaved'`.

### B. Project Lifecycle & Store Routing (`src/stores/projectStore.ts`)
- Introduced mode detection: `const isCarousel = project.canvasUnit === 'px' || project.projectType === 'carousel'`.
- `createNewProject`: when creating pixel-based or carousel projects, sets `projectType: 'carousel'` in SQLite and initializes `useCarouselStore` with the selected ratio and slide count, immediately committing the initial state with `saveCarouselToDb()`.
- `openProjectById`: dynamically inspects project unit and type, hydrating `useCarouselStore.loadCarouselFromDb()` for social carousels and `useAlbumStore.loadAlbumFromDb()` for print albums.
- `saveProject`: branches between `carouselStore.saveCarouselToDb()` and `albumStore.saveAlbumToDb()`, updating active project `.afsn` files without creating duplicates.
- `exportProjectAsAfsn`: saves the active carousel before invoking `save_project_as_with_dialog` or `export_afsn_with_dialog`.
- `exportCompleteProjectPackageWithPhotos`: validates the active carousel and exports bundled `.zip` archive.
- `closeProject`: cleans up `useCarouselStore` state (`currentCarousel: null`, `saveStatus: 'saved'`, history cleared).

### C. Autosave & Visual Indicator (`src/features/persistence/useAutoSave.ts`, `AppTitleBar.tsx`)
- `useAutoSave`:
  - Listens to both `useAlbumStore` and `useCarouselStore`.
  - Manages localStorage keys `afsn_carousel_snapshot_${id}` and `afsn_dirty_${id}`.
  - Debounces autosaves at 2.5 seconds on unsaved edits.
  - Adds a window `blur` listener: when user leaves or blurs the app window, dirty carousel edits are flushed immediately to SQLite.
- `AppTitleBar`:
  - Dynamic status dot with tooltip:
    - Amber (`#F59E0B`, glowing): `"Unsaved changes (⌘S to save)"`
    - Blue (`#3B82F6`, pulsing): `"Saving changes..."`
    - Green (`#10B981`): `"All changes saved (HH:MM)"`
  - Mode-aware undo/redo controls reflecting history stack states for both modes.

---

## 3. Verification & Test Execution
- **TypeScript Static Verification:**
  - `npm test` (`tsc --noEmit`): 0 errors, 0 warnings.
- **Automated Test Suites:**
  - `npx tsx tests/persistence/carouselPersistence.test.ts`: 8/8 tests passed (100% green).
  - `npx tsx tests/carousel-persistence.test.ts`: 6/6 tests passed (100% green).
  - `cargo test --lib --manifest-path src-tauri/Cargo.toml`: 47 passed; 0 failed.
- **Git Commit Log:**
  - `3731a0f`: `feat(carousel): add persistence state, dirty tracking, and IPC save/load actions`
  - `1364777`: `feat(projectStore): branch project lifecycle, hydration, and packaging for carousel mode`
  - `f9615f5`: `feat(persistence, ui): implement carousel autosave, crash recovery snapshot, blur save, and titlebar status pill`
