---
status: resolved
trigger: "6 deficiencies reported in Social Carousel & Workspace: missing slide previews, broken dynamic layouts on slide 2+, limited panoramas, broken keyboard shortcuts, used photos greyed out, broken phone simulator"
created: 2026-09-23T16:16:00+07:00
updated: 2026-09-23T16:26:00+07:00
slug: carousel-suite-deficiencies
---

# Current Focus
hypothesis: "All 6 issues have isolated, proven root causes: (1) SlideNavigator lacks MiniSlidePreview component; (2) carouselStore layout generator omits slideStartX offset; (3) carouselLayout.ts hardcodes 4 presets; (4) WorkspaceLayout handleKeyDown omits activeMode from useCallback dependencies; (5) cardUsed CSS grayscales and dims photos, plus canvas lacks drop-to-replace; (6) PhoneSwipeSimulator TSX classes mismatch CSS module names."
test: "Apply targeted fixes across the 6 components and verify with unit tests, typecheck, and production build."
expecting: "All 6 issues resolved cleanly with zero regressions."
next_action: "All 6 issues resolved and verified. Ready for commit."

## Evidence
- timestamp: 2026-09-23T16:12:00+07:00
  observation: "Forensic report in .planning/forensics/report-20260923-161200.md fully documented root causes with line numbers and screenshots."
- timestamp: 2026-09-23T16:25:00+07:00
  observation: "Unit tests in src/domain/carousel/__tests__/carouselDynamicCoordsAndPanoramas.test.ts passed 100% green."
- timestamp: 2026-09-23T16:26:00+07:00
  observation: "Typecheck (tsc --noEmit) and Vite production build passed in 2.92s with 0 errors."

## Eliminated
- None (diagnoses confirmed by direct code inspection and runtime visual evidence).

## Resolution
root_cause: "1. SlideNavigator had no thumbnail rendering. 2. carouselStore layout actions lacked slideStartX horizontal world coordinate translation. 3. carouselLayout had only 4 hardcoded panorama presets. 4. WorkspaceLayout handleKeyDown had a stale closure on activeMode. 5. FilmstripTray applied grayscale and dimming to used photos without drop-to-replace. 6. PhoneSwipeSimulator class names did not match CSS module names."
fix: "1. Added MiniSlidePreview component to SlideNavigator with dynamic aspect ratio and photo projection. 2. Added slideStartX offset to x coordinates in cycleSlideLayout, applyDynamicSlideLayoutByIndex, and autoFlowPhotosToSlides. 3. Added 5 new seamless panorama presets (4-slide, dual-insets, asymmetric, 3-slide dual focus, vertical header split) bringing total to 9. 4. Added activeModeRef to WorkspaceLayout and unified keyboard event dispatching. 5. Removed grayscale and opacity dimming from cardUsed, enhanced Used tag with count, and added drop-to-replace on existing canvas frames. 6. Rewrote PhoneSwipeSimulator.module.css to align with JSX and provide realistic iPhone 16 Pro styling."
verification: "Tested with npx tsx unit tests for coordinates and presets; verified with tsc --noEmit and npm run build (built in 2.92s)."
files_changed:
  - src/features/carousel/SlideNavigator.tsx
  - src/features/carousel/SlideNavigator.module.css
  - src/stores/carouselStore.ts
  - src/domain/carouselLayout.ts
  - src/features/workspace/WorkspaceLayout.tsx
  - src/features/carousel/CarouselCanvas.tsx
  - src/features/photos/FilmstripTray.tsx
  - src/features/photos/FilmstripTray.module.css
  - src/features/carousel/PhoneSwipeSimulator.tsx
  - src/features/carousel/PhoneSwipeSimulator.module.css
  - src/domain/carousel/__tests__/carouselDynamicCoordsAndPanoramas.test.ts
