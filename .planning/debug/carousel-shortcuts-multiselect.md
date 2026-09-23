---
status: resolved
trigger: "Fix Social Carousel keyboard shortcuts (Cmd+Z, Cmd+Shift+Z, Cmd+A, etc.) and Shift+click multi-selection"
created: 2026-09-23T14:45:00+07:00
updated: 2026-09-23T14:52:00+07:00
root_cause: |
  1. Multi-selection was unsupported in carousel mode: carouselStore previously only declared `selectedFrameId: string | null`, with no multi-element state, no Shift+click toggling, and the Konva Transformer in CarouselCanvas only attached a single node.
  2. Undo/Redo was completely missing in Social Carousel: carouselStore had no history stack (`past`/`future`), and WorkspaceLayout.tsx routed global Cmd+Z / Cmd+Shift+Z / Cmd+Y shortcuts exclusively to useAlbumStore.
  3. Cmd+A in WorkspaceLayout.tsx defaulted to selecting album spread elements instead of carousel elements when activeMode === 'carousel', and CarouselCanvas's own Cmd+A handler only selected the first frame due to single-selection constraints.
fix: |
  1. In carouselStore.ts: Added `selectedFrameIds: string[]`, `setSelectedFrameIds`, `toggleFrameSelection`, `selectAllFramesOnSlide`, and `deleteSelectedFrames`. Synced `selectedFrameId` for full backward compatibility.
  2. In carouselStore.ts: Implemented authoritative 50-step undo/redo history stack (`past: Carousel[]`, `future: Carousel[]`, `canUndo`, `canRedo`, `pushHistory`, `undo`, `redo`, `clearHistory`). Injected `pushHistory()` before all carousel state mutations (ratio switch, slide addition/duplication/deletion/reorder, background change, frame add/update/remove/delete, layout cycling, shuffle, panorama span, hero photo, batch updates, frame swapping).
  3. In WorkspaceLayout.tsx: Routed Cmd+Z, Cmd+Shift+Z, Cmd+Y, and Cmd+A to useCarouselStore when activeMode === 'carousel'.
  4. In CarouselCanvas.tsx:
     - Supported Shift+click multi-selection on CarouselFrameNode.
     - Wired multi-node Konva Transformer (`trRef.current.nodes(selectedNodes)`) with `onTransformEnd` batch updates.
     - Implemented multi-frame drag coordination so dragging any selected frame translates all selected frames together.
     - Updated keyboard handlers: Delete/Backspace removes all selected frames, Escape clears selection, Cmd+A selects all slide frames, Cmd+Z/Cmd+Shift+Z triggers undo/redo, Arrow keys nudge all selected frames.
     - Canvas background click deselects all frames.
  5. Added comprehensive test suite `src/domain/carousel/__tests__/carouselHistorySelection.test.ts` (100% green).
verification: |
  - npx tsx src/domain/carousel/__tests__/carouselHistorySelection.test.ts: PASS (100% green across 4 suites)
  - npx tsx src/domain/carousel/__tests__/panoramaSpan.test.ts: PASS (6/6 tests)
  - npx tsx src/domain/__tests__/carouselGenerativeCycling.test.ts: PASS
  - npx tsx src/domain/__tests__/carouselAspectCover.test.ts: PASS
  - npx tsx src/domain/__tests__/carouselLayout.test.ts: PASS
  - npm run test (tsc --noEmit): PASS (0 errors)
  - npm run build (Vite bundle): PASS (2.94s)
files_changed:
  - src/stores/carouselStore.ts
  - src/features/workspace/WorkspaceLayout.tsx
  - src/features/carousel/CarouselCanvas.tsx
  - src/domain/carousel/__tests__/carouselHistorySelection.test.ts
---

# Resolution: Social Carousel Keyboard Shortcuts & Shift+Click Multi-Selection

All reported issues have been fully resolved and verified. Social Carousel now has full first-class multi-selection support, multi-node Transformer transformations, synchronized multi-frame dragging, complete 50-step undo/redo history, and seamless keyboard shortcut routing.
