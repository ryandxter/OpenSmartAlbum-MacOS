# Phase 06: Finder Drag-and-Drop Dual Ingestion Pipeline - Context

**Gathered:** 2026-09-22  
**Status:** Ready for planning  

<domain>
## Phase Boundary

Phase 06 delivers native macOS Finder direct drag-and-drop ingestion of images and folders into the OpenSmartAlbum application window. It implements a Pixellu SmartAlbums-compliant dual-target drop model (importing to library vs direct spread/slide placement) and provides an interactive visual drop HUD overlay.

</domain>

<decisions>
## Implementation Decisions

### 1. Dual Ingestion Routing (Pixellu SmartAlbums Model)
- **D-01:** When files/folders are dropped from macOS Finder onto the **Filmstrip Tray**:
  - The files/folders are imported into the project library via `usePhotoStore.getState().importPaths(projectId, paths)`.
  - Photos are marked as unused and thumbnails are generated in the background.
  — **Reversibility:** reversible
- **D-02:** When files/folders are dropped from macOS Finder onto the **Canvas (Album Spread or Carousel Slide)**:
  - Files are automatically ingested into the library in the background.
  - The dropped photos are immediately **placed on the targeted spread or slide** (marked with "Used" status).
  - If dropped on an existing frame: the frame's content is replaced/swapped with the dropped photo.
  - If dropped on an empty spread/slide: the photos are placed directly into the spread/slide.
  — **Reversibility:** costly — touches drag-drop hit-testing on Konva and photo import pipeline.

### 2. Multi-Photo Drop Behavior on Canvas
- **D-03:** When multiple photos (e.g. 2 to 6 photos) are dropped simultaneously onto an empty canvas spread or carousel slide:
  - The engine executes **Smart Auto-Partitioning** (Option A — SmartAlbums standard).
  - It mathematically arranges the dropped photos using optimal aspect-ratio matching into a clean multi-frame layout on the target spread/slide.
  — **Reversibility:** costly — integrates `adaptiveLayout` with drop events.

### 3. Tauri 2 Webview Configuration & Visual Feedback
- **D-04:** Enable native OS window drop events by setting `"dragDropEnabled": true` in `src-tauri/tauri.conf.json`.
- **D-05:** Implement a full-screen semi-transparent glass Drop Zone Overlay (`DropZoneHUD.tsx`) with frosted blur and high-contrast dashed border (`#3b82f6`) whenever external files are dragged over the application window. Text: *"Drop Photos to Add to Slide & Library"*.
  — **Reversibility:** reversible

### Folded Todos
- Folded `01-finder-drag-drop.md` into this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing:**

- `.planning/FORENSICS.md` — Section 1: Finder Direct Drag-and-Drop Photo Import Fails
- `.planning/CODE-REVIEW.md` — Section 1: Drag & Drop Pipeline (`tauri.conf.json`, `photoStore.ts`, `WorkspaceLayout.tsx`)
- `.planning/UI-REVIEW.md` — Section 3: Desktop Drag-and-Drop Ergonomics
- `src-tauri/tauri.conf.json` — Window configuration (`dragDropEnabled`)
- `src/stores/photoStore.ts` — `importPaths` function and queue orchestration
- `src/features/workspace/WorkspaceLayout.tsx` — Window level composition and canvas container

</canonical_refs>
