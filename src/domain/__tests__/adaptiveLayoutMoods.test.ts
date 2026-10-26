import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateAdaptiveLayoutVariations,
  clearAdaptiveLayoutCache,
  MOOD_PRESETS,
  type AdaptivePhoto,
} from '../adaptiveLayout';
import type { TemplateParams } from '../templates';
import type { PhotoFrameElement } from '../editor';

describe('Plan 03-03: Adaptive Layout Balanced vs Dynamic & 5 Mood Presets', () => {
  const baseParams: TemplateParams = {
    spreadWidth: 2000,
    spreadHeight: 1000,
    isSpread: true,
    safeMargin: 50,
    gutterWidth: 20,
    spacing: 15,
  };

  const samplePhotos: AdaptivePhoto[] = [
    { id: 'p1', photoAspect: 1.5, rating: 5, isHero: true },
    { id: 'p2', photoAspect: 0.67, rating: 3 },
    { id: 'p3', photoAspect: 1.0, rating: 4 },
  ];

  beforeEach(() => {
    clearAdaptiveLayoutCache();
  });

  describe('1. Balanced vs Dynamic Generator Modes', () => {
    it('generates standard balanced variations in Clean/Balanced mode', () => {
      const variations = generateAdaptiveLayoutVariations(baseParams, samplePhotos, {
        styleMode: 'clean',
        mood: 'balanced',
      });
      expect(variations.length).toBeGreaterThan(0);
      // In clean mode, the focus hero card is not forced to index 0 unless explicit
      const first = variations[0]!;
      expect(first.rects.length).toBe(samplePhotos.length);
    });

    it('generates a prominent Focus hero variation at index 0 in Dynamic mode', () => {
      const variations = generateAdaptiveLayoutVariations(baseParams, samplePhotos, {
        styleMode: 'dynamic',
      });
      expect(variations.length).toBeGreaterThan(0);
      const heroVar = variations[0]!;
      expect(heroVar.isHero).toBe(true);
      expect(heroVar.badge).toBe('Focus');
      expect(heroVar.rects.length).toBe(samplePhotos.length);
      expect(heroVar.photoAssignments?.[0]).toBe(0); // Top photo assigned to hero slot
    });
  });

  describe('2. Five Mood Presets', () => {
    const moods = ['balanced', 'airy', 'compact', 'hero', 'uniform'] as const;

    moods.forEach((mood) => {
      it(`generates valid non-empty layouts under '${mood}' mood preset`, () => {
        const preset = MOOD_PRESETS[mood];
        const variations = generateAdaptiveLayoutVariations(baseParams, samplePhotos, {
          mood,
          ...preset,
        });
        expect(variations.length).toBeGreaterThan(0);
        variations.forEach((v) => {
          expect(v.rects.length).toBe(samplePhotos.length);
          v.rects.forEach((r) => {
            expect(r.width).toBeGreaterThanOrEqual(10);
            expect(r.height).toBeGreaterThanOrEqual(10);
          });
        });
      });
    });

    it('Airy mood generates smaller density than Compact mood', () => {
      const airyPreset = MOOD_PRESETS.airy;
      const compactPreset = MOOD_PRESETS.compact;
      expect(airyPreset.canvasDensity).toBeLessThan(compactPreset.canvasDensity!);
      expect(airyPreset.spacingMode).toBe('breathing');
    });

    it('Uniform mood preset has zero size contrast for harmonious grid sizing', () => {
      expect(MOOD_PRESETS.uniform.sizeContrast).toBe(0);
    });
  });

  describe('3. Pinned Element Collision Invariance', () => {
    it('never places generated frames over locked/pinned elements', () => {
      const lockedFrame = {
        id: 'locked-pin-1',
        type: 'photo',
        x: 100,
        y: 100,
        width: 300,
        height: 300,
        rotation: 0,
        locked: true,
        excludeFromAdaptiveLayout: true,
      } as unknown as PhotoFrameElement;

      const paramsWithLocked: TemplateParams = {
        ...baseParams,
        lockedElements: [lockedFrame],
      };

      const variations = generateAdaptiveLayoutVariations(paramsWithLocked, samplePhotos, {
        styleMode: 'dynamic',
      });

      expect(variations.length).toBeGreaterThan(0);
      variations.forEach((v) => {
        v.rects.forEach((r) => {
          const intersects = !(
            r.x >= lockedFrame.x + lockedFrame.width ||
            r.x + r.width <= lockedFrame.x ||
            r.y >= lockedFrame.y + lockedFrame.height ||
            r.y + r.height <= lockedFrame.y
          );
          expect(intersects).toBe(false);
        });
      });
    });
  });
});
