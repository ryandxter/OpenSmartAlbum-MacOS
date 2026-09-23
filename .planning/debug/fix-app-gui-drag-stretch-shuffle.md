---
status: resolved
trigger: "Fix all captured todo issues: Filmstrip reuse drag error toast, photo aspect stretching, layout shuffle failure, and inspector mismatch in built app"
created: 2026-09-23T08:04:00+07:00
updated: 2026-09-23T08:11:00+07:00
root_cause: |
  1. Tauri 2 native onDragDropEvent listener in WorkspaceLayout.tsx intercepted internal HTML5 drag-drop events (from FilmstripTray cards) which had empty paths [], triggering the Finder error fallback toast "No supported image files or folders detected in drop".
  2. CarouselCanvas.tsx rendered photos inside KonvaImage with hardcoded width={frame.width} and height={frame.height} without calculating proportional cover-fit (calculateImageOffset), causing landscape and portrait photos to stretch/distort unnaturally to frame dimensions.
  3. shuffleSlidePhotos in carouselStore.ts did not reset crop offsets and zoom when remapping photo payloads into new frame slots.
  4. InspectorContainer and LayoutSpacingSection only rendered print album spread dimensions and margins, ignoring activeMode === 'carousel' and failing to provide carousel slide properties and frame geometry controls.
fix: |
  1. In WorkspaceLayout.tsx onDragDropEvent: explicitly ignore events where paths is empty (internal DOM drag-and-drop), preventing false Finder error toasts and HUD flicker.
  2. In CarouselCanvas.tsx: integrated calculateImageOffset from domain/editor, calculating natural photo aspect ratio from loaded HTML Image or frame metadata, and rendering KonvaImage with proportional cover-fit centered offset (zero stretch).
  3. In carouselStore.ts shuffleSlidePhotos: reset cropX: 0, cropY: 0, cropScale: 1.0 when photos are swapped into new frames.
  4. In InspectorContainer.tsx and LayoutSpacingSection.tsx: added activeMode === 'carousel' support with frame dimensions/rotation controls and slide background settings, omitting album margins.
verification: |
  - npm run test (tsc --noEmit): PASS (0 type errors)
  - npm run build (Vite bundle): PASS (2.80s)
  - npx tsx src/domain/__tests__/carouselAspectCover.test.ts: PASS (100% green)
  - npx tsx scripts/verify_e2e_layouting.ts: PASS (100% green across 11 album presets and 3 carousel ratios)
  - npx tauri build: Built OpenSmartAlbum.app and OpenSmartAlbum_1.0.80_aarch64.dmg
  - Installed latest release to /Applications/OpenSmartAlbum.app
files_changed:
  - src/features/workspace/WorkspaceLayout.tsx
  - src/features/carousel/CarouselCanvas.tsx
  - src/features/inspector/InspectorContainer.tsx
  - src/features/inspector/sections/LayoutSpacingSection.tsx
  - src/stores/carouselStore.ts
  - src/domain/__tests__/carouselAspectCover.test.ts
---

# Resolution: Built App GUI Drag, Stretch, Shuffle, and Inspector Issues

All reported issues have been fully resolved, verified via automated test suites, and compiled into the production `.app` and `.dmg` release bundles.
