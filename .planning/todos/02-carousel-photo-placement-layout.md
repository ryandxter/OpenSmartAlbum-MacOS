# TODO: Social Carousel Mode Photo Placement & Layouting

- **ID:** CRIT-02
- **Status:** Pending
- **Severity:** High
- **Category:** Feature Completeness / Carousel Engine
- **References:** `FORENSICS.md#incident-2`, `CODE-REVIEW.md#2-carousel-mode-integration`, Screenshot `22.02.45.png`

## Problem Description
In Social Carousel Mode, photos cannot be added to slides. Dragging from filmstrip tray onto canvas fails. Double-clicking a photo in the tray fails. The inspector remains locked to print album mode showing 2-page spreads.

## Root Cause
1. `CarouselCanvas.tsx` has zero `onDragOver` or `onDrop` handlers.
2. `FilmstripTray.tsx` double-click only targets `albumStore` / `editorStore`.
3. `FilmstripTray.tsx` used-photo detection ignores `carouselStore`.
4. `InspectorContainer.tsx` and `TemplatesPanel.tsx` do not adapt to Carousel Mode.

## Tasks
1. Implement `onDragOver` and `onDrop` in `CarouselCanvas.tsx`.
2. Map drop coordinate to slide index and call `carouselStore.addPhotoFrame`.
3. Update `FilmstripTray.tsx` double-click to check `activeMode === 'carousel'` and add photo to active slide.
4. Update `usedPhotoIdSet` to include photos on carousel slides.
5. Create Carousel layout presets (1-4 photo arrangements per slide ratio).
6. Adapt inspector sidebar header to show `Active: Slide N of X`.
