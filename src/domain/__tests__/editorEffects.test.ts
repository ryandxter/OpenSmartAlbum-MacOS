import { describe, it, expect } from 'vitest';
import {
  permuteCornerRadiiOnFlip,
  permuteCornerRadiiForFlip,
  effectSliderToPhysical,
  physicalToEffectSlider,
  EFFECT_MAX_MM,
  EFFECT_MAX_CAROUSEL_PX,
} from '../editor';

describe('editorEffects.ts - Geometry Permutation & Physical Unit Mappings (FX-01, FX-02, D-02, D-03)', () => {
  describe('Corner Radii Permutation on Flip (D-03, FX-02)', () => {
    // Clockwise order: [TL, TR, BR, BL]
    const initialRadii: [number, number, number, number] = [10, 20, 30, 40];

    it('permutes corner radii on Horizontal flip: swaps Left <-> Right ([TL, TR, BR, BL] -> [TR, TL, BL, BR])', () => {
      const flippedH = permuteCornerRadiiOnFlip(initialRadii, 'horizontal');
      expect(flippedH).toEqual([20, 10, 40, 30]);

      // Boolean flipH overload
      const flippedHBool = permuteCornerRadiiOnFlip(initialRadii, true, false);
      expect(flippedHBool).toEqual([20, 10, 40, 30]);
    });

    it('permutes corner radii on Vertical flip: swaps Top <-> Bottom ([TL, TR, BR, BL] -> [BL, BR, TR, TL])', () => {
      const flippedV = permuteCornerRadiiOnFlip(initialRadii, 'vertical');
      expect(flippedV).toEqual([40, 30, 20, 10]);

      // Boolean flipV overload
      const flippedVBool = permuteCornerRadiiOnFlip(initialRadii, false, true);
      expect(flippedVBool).toEqual([40, 30, 20, 10]);
    });

    it('permutes corner radii when both Horizontal and Vertical flips are active ([TL, TR, BR, BL] -> [BR, BL, TL, TR])', () => {
      const flippedBoth = permuteCornerRadiiOnFlip(initialRadii, true, true);
      expect(flippedBoth).toEqual([30, 40, 10, 20]);
    });

    it('handles individual corner object inputs and returns named object with permuteCornerRadiiForFlip', () => {
      const objRadii = {
        cornerRadiusTl: 5,
        cornerRadiusTr: 15,
        cornerRadiusBr: 25,
        cornerRadiusBl: 35,
      };

      const permutedH = permuteCornerRadiiOnFlip(objRadii, 'horizontal');
      expect(permutedH).toEqual([15, 5, 35, 25]);

      const namedResult = permuteCornerRadiiForFlip([5, 15, 25, 35], 'vertical');
      expect(namedResult).toEqual({
        cornerRadiusTl: 35,
        cornerRadiusTr: 25,
        cornerRadiusBr: 15,
        cornerRadiusBl: 5,
      });
    });
  });

  describe('Slider 0..100 <-> Physical Unit Conversion (D-02, FX-01)', () => {
    it('maps 0..100 blur slider to mm units accurately (Print Mode)', () => {
      expect(EFFECT_MAX_MM.blurRadius).toBe(10);
      expect(EFFECT_MAX_CAROUSEL_PX.blurRadius).toBe(40);
      // 100% blur = EFFECT_MAX_MM.blurRadius = 10mm
      const physicalAt100 = effectSliderToPhysical(100, 'blurRadius', 'mm', false);
      expect(physicalAt100).toBe(10);

      // 50% blur = 5mm
      const physicalAt50 = effectSliderToPhysical(50, 'blurRadius', 'mm', false);
      expect(physicalAt50).toBe(5);

      // Roundtrip back to slider
      expect(physicalToEffectSlider(5, 'blurRadius', 'mm', false)).toBe(50);
      expect(physicalToEffectSlider(10, 'blurRadius', 'mm', false)).toBe(100);
      expect(physicalToEffectSlider(0, 'blurRadius', 'mm', false)).toBe(0);
    });

    it('maps 0..100 blur slider to px in Carousel Mode', () => {
      // Carousel max blur = EFFECT_MAX_CAROUSEL_PX.blurRadius = 40px
      const pxAt100 = effectSliderToPhysical(100, 'blurRadius', 'px', true);
      expect(pxAt100).toBe(40);

      const pxAt25 = effectSliderToPhysical(25, 'blurRadius', 'px', true);
      expect(pxAt25).toBe(10);

      expect(physicalToEffectSlider(10, 'blurRadius', 'px', true)).toBe(25);
    });

    it('handles negative and positive shadow offsets (-100..+100)', () => {
      // Shadow offset max mm = 15mm
      const offsetNeg = effectSliderToPhysical(-50, 'shadowOffset', 'mm', false);
      expect(offsetNeg).toBe(-7.5);

      const offsetPos = effectSliderToPhysical(100, 'shadowOffset', 'mm', false);
      expect(offsetPos).toBe(15);

      expect(physicalToEffectSlider(-7.5, 'shadowOffset', 'mm', false)).toBe(-50);
      expect(physicalToEffectSlider(15, 'shadowOffset', 'mm', false)).toBe(100);
    });

    it('supports direct maxPhysical argument signature', () => {
      const val1 = effectSliderToPhysical(80, 'mm', 25);
      expect(val1).toBe(20);

      const slider1 = physicalToEffectSlider(20, 'mm', 25);
      expect(slider1).toBe(80);
    });
  });
});
