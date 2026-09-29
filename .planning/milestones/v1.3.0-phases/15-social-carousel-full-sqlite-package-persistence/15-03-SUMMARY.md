# Plan 15-03 Execution Summary: macOS Window Close Guard, Native Confirmation Sheet, and Thumbnail Caching

## Execution Metadata
- **Phase:** 15 - Social Carousel Full SQLite & Package Persistence
- **Plan:** 15-03
- **Status:** ✅ Completed
- **Requirements Covered:** `PERS-02`, `PERS-04`
- **Executed:** 2026-09-29

---

## Deliverables

### Task 1: Fix `syncUnsavedStatus` in `src/App.tsx` & Bridge to Rust `AppExitState` (Commit `72dacc5`)
- Updated `syncUnsavedStatus` to detect `isCarousel` from active project (`canvasUnit === 'px' || projectType === 'carousel'`).
- Reads `carouselStatus` from `useCarouselStore.getState().saveStatus` alongside `albumStatus`.
- Synchronizes the correct status to Rust `AppExitState.is_unsaved` via `invoke('set_unsaved_status', { unsaved: isUnsaved })`.
- Added `useCarouselStore.subscribe(syncUnsavedStatus)` with proper cleanup in unmount.
- Result: Tauri's `WindowEvent::CloseRequested` now intercepts dirty carousel projects and emits `request-close-warning`.

### Task 2: Wire Native macOS Confirmation Sheet in `ExitWarningModal.tsx` (Commit `cd3f36f`)
- Updated `ExitWarningModal.tsx` to detect active mode (`isCarousel`) before confirming save on "Save & Exit".
- "Save & Exit" calls `useProjectStore.getState().saveProject()` then validates `isSaved` against the active mode's store.
- "Exit Without Saving" clears `afsn_dirty_${projectId}` from localStorage before calling `handleForceExit()`.
- Copy follows Apple HIG:
  - Title: **"Unsaved Changes"**
  - Message: **"Save your changes before exiting?"**
  - Detail: **"If you exit without saving, recent carousel slides and photo placements will be lost."**
  - Buttons: `Save & Exit` (primary/default), `Exit Without Saving` (destructive/secondary), `Cancel` (dismiss).

### Task 3: Cover Slide Thumbnail Caching (Commits `17edab5`, `13b2a5d`)
- **Rust `save_project_thumbnail` command** in `src-tauri/src/commands/project_commands.rs`:
  - Accepts `projectId` and `base64Png`.
  - Strips `data:image/png;base64,` prefix.
  - Decodes base64 via `base64::engine::general_purpose::STANDARD`.
  - Writes PNG file to `{app_cache_dir}/project_thumbnails/{projectId}.png`.
  - Registered in `tauri::generate_handler!` in `src-tauri/src/lib.rs`.
- **Frontend `captureAndCacheCarouselThumbnail(projectId)`** helper in `src/stores/projectStore.ts`:
  - Looks for `window.__konvaStage__` (Konva stage reference) with `toDataURL({ mimeType: 'image/png', pixelRatio: 0.25 })`.
  - Falls back to `document.querySelector('.stageWrapper canvas')?.toDataURL()`.
  - Caches dataUrl to `localStorage.setItem('afsn_thumb_${projectId}', dataUrl)`.
  - Calls `invoke('save_project_thumbnail', { projectId, base64Png: dataUrl })`.
  - Triggered fire-and-forget after every successful carousel save (never blocks save result).
- **`WelcomeScreen.tsx` thumbnail display:**
  - Added `useMemo`-based `thumbnailMap` reading `afsn_thumb_${id}` from localStorage for all recent projects.
  - Replaced static `<Image />` icon with `<img src={thumbnailMap[proj.id]} className={styles.projectThumbnailImg} />` when thumbnail is available.
  - Added `.projectThumbnailImg` CSS class: `object-fit: cover; width: 100%; height: 100%; border-radius: inherit;`.
  - Badge container updated with `overflow: hidden` to contain rounded thumbnail corners.

---

## Verification Results
- **`tsc --noEmit`:** ✅ 0 TypeScript errors
- **`cargo test --lib`:** ✅ 47 passed; 0 failed (includes `test_migrate_v16_and_schema_version`, `test_carousel_save_and_load_roundtrip`, `test_carousel_cascading_delete`)
- **`cargo check`:** ✅ 0 warnings, 0 errors

---

## Atomic Commits
| Commit | Message |
|--------|---------|
| `72dacc5` | `fix(window): bridge carousel unsaved status to native AppExitState` |
| `cd3f36f` | `feat(workspace): wire mode-aware save and discard in ExitWarningModal per Apple HIG` |
| `17edab5` | `feat(thumbnail): implement save_project_thumbnail Rust command and register in IPC` |
| `13b2a5d` | `feat(thumbnail): capture carousel slide-0 thumbnail on save and display in recent projects` |
