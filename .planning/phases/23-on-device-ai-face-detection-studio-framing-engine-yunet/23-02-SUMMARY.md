# Plan Summary: 23-02 — Frontend Studio Framing Engine, Store Integration, Inspector UI & Canvas Reticles

**Phase:** Phase 23 — On-Device AI Face Detection & Studio Framing Engine (YuNet)  
**Milestone:** v1.4.0 (Workflow & Canvas Precision Suite)  
**Status:** Completed  

---

## Executive Summary

Plan 23-02 delivered the complete frontend AI Face Framing & Studio Intelligence system for OpenSmartAlbum. Powered by on-device YuNet face & 5-landmark telemetry, it provides closed-form mathematical inversion for pan offsets (`cropX`, `cropY`) and auto-zoom scale (`cropScale`), 4 studio framing presets (Pasfoto Formal, Wisuda UNY 50% Shoulder, Portrait Rule of Thirds, Natural Center), real-time face detection caching in `photoStore`, face-protection in `adaptiveLayout`, a dedicated `AIFramingSection` in the Inspector, non-interactive Konva canvas reticle overlays (`⌜ ⌝ ⌞ ⌟`, landmark points, eye line horizon) with `Shift+F` toggling, and filmstrip quality badges (`✨ HERO`, `🎯 SHARP`, `👤 1`).

---

## Delivered Key Changes

1. **AI Domain Contracts & IPC Client (`src/domain/ai/faceDetection.ts`)**:
   - `PhotoFaceLandmarks`, `DetectedFace`, `PhotoFaceData`, `StudioFramingPreset`, `FramingConfig`.
   - IPC client wrappers for `detectPhotoFaces` and `detectPhotosFacesBatch`.
   - `STUDIO_PRESET_CONFIGS` formalizing standard studio framing parameters.

2. **Closed-Form Framing Mathematics (`src/domain/ai/framingMath.ts`)**:
   - `calculateCoverDimensions`, `solveCropPanOffsets`, `calculateOptimalStudioCrop`.
   - Yaw asymmetry and directional gaze compensation for rule-of-thirds framing.
   - Vector shape mask face crop centering (`calculateShapeMaskFaceCrop`).

3. **Store State & Telemetry Caching**:
   - `src/stores/photoStore.ts`: `faceDataMap` telemetry cache, background batch analysis queue (`analyzePhotoFaces`, `analyzePhotosBatch`).
   - `src/domain/editor.ts` & `src/domain/carousel.ts`: Added AI framing fields to `PhotoFrameElement` and `CarouselPhotoFrame`.
   - `src/stores/albumStore.ts` & `src/stores/carouselStore.ts`: Added `applyStudioFramingPreset` actions with single-transaction undo/redo.

4. **Adaptive Layout Reflow Integration (`src/domain/adaptiveLayout.ts`)**:
   - Bipartite slot matching prevents placing portrait faces into extreme landscape slots.
   - `buildSpreadElementsFromVariation` and `shuffleElementsPhotos` preserve face-aware crops on Spacebar shuffle.

5. **Inspector Section (`src/features/inspector/sections/AIFramingSection.tsx` & `.module.css`)**:
   - Dynamic telemetry header badge (`👤 1 Face • 98% conf`), preset selector, fine-tuning sliders (Headroom, Eye-Level, Shoulder clearance), and reticle toggle.

6. **Canvas Reticles & Context Menu**:
   - `KonvaFaceReticleOverlay.tsx`: Non-interactive vector layer with camera brackets, 5 landmark dots, and eye line horizon with `listening={false}` (0ms drag overhead).
   - Global shortcut `Shift+F` (`⇧F`) for reticle visibility.
   - Contextual right-click submenu `"🪄 AI Face Auto-Frame"` across canvas and filmstrip.

7. **Filmstrip Smart Culling (`FilmstripTray.tsx` & `PhotoContextMenu.tsx`)**:
   - Quality badges: `✨ HERO` (score >= 85), `🎯 SHARP`, `👤 N`.
   - Filter dropdown by Hero Shots / Faces Detected, and sort by AI Quality Score.

8. **TDD Unit & Integration Test Suite**:
   - `src/domain/ai/__tests__/framingMath.test.ts` (12 tests).
   - `src/features/inspector/sections/__tests__/AIFramingSection.test.tsx` (9 tests).

---

## Verification

```bash
npx vitest run src/domain/ai/__tests__/framingMath.test.ts src/features/inspector/sections/__tests__/AIFramingSection.test.tsx # Passed (21/21)
npm test (tsc --noEmit) # Passed (0 errors)
```
