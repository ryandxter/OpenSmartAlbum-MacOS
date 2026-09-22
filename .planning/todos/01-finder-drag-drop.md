# TODO: Native macOS Finder Direct Drag-and-Drop Photo Import

- **ID:** CRIT-01
- **Status:** Pending
- **Severity:** High
- **Category:** OS Integration / Core Desktop Ergonomics
- **References:** `FORENSICS.md#incident-1`, `CODE-REVIEW.md#1-drag--drop-pipeline`

## Problem Description
Dragging image files (JPEG, PNG, TIFF, WebP, HEIC, RAW) or folders from macOS Finder directly onto the application window or photo tray does nothing. Users must manually open "+ Import -> Batch Files / Folder".

## Root Cause
1. `src-tauri/tauri.conf.json` has `"dragDropEnabled": false`, disabling native OS file drop events in Tauri 2.
2. No Tauri window drag-drop event listener is registered in `WorkspaceLayout.tsx` or `App.tsx`.

## Tasks
1. Set `"dragDropEnabled": true` in `src-tauri/tauri.conf.json`.
2. Register Tauri 2 drag-drop listener in `WorkspaceLayout.tsx`.
3. Filter dropped paths for supported image extensions and folders.
4. Pass valid paths to `usePhotoStore.getState().importPaths(currentProject.id, paths)`.
5. Add visual drop-overlay HUD with frosted glass blur and upload icon.
