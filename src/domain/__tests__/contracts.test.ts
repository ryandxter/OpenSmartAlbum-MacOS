import { describe, it, expect } from 'vitest';
import {
  permuteCornerRadiiOnFlip,
  isElementDesignEqual,
  isSpreadDesignEqual,
  type AlbumElement,
  type Spread,
} from '../album';
import { normalizeProjectType, type Project } from '../project';
import { getProjectDimensionsInCanvasUnit } from '../templates';
import { hydrateElement, sanitizeElement } from '../../stores/albumStore';

describe('TypeScript Domain Contracts (DB-04)', () => {
  describe('1. permuteCornerRadiiOnFlip math', () => {
    const original: [number, number, number, number] = [10, 20, 30, 40]; // [tl, tr, br, bl]

    it('returns exact original radii when neither horizontal nor vertical flip is active', () => {
      const result = permuteCornerRadiiOnFlip(original, false, false);
      expect(result).toEqual([10, 20, 30, 40]);
    });

    it('permutes horizontally: [tl, tr, br, bl] -> [tr, tl, bl, br] = [20, 10, 40, 30]', () => {
      const resultBool = permuteCornerRadiiOnFlip(original, true, false);
      expect(resultBool).toEqual([20, 10, 40, 30]);

      const resultAxis = permuteCornerRadiiOnFlip(original, 'horizontal');
      expect(resultAxis).toEqual([20, 10, 40, 30]);
    });

    it('permutes vertically: [tl, tr, br, bl] -> [bl, br, tr, tl] = [40, 30, 20, 10]', () => {
      const resultBool = permuteCornerRadiiOnFlip(original, false, true);
      expect(resultBool).toEqual([40, 30, 20, 10]);

      const resultAxis = permuteCornerRadiiOnFlip(original, 'vertical');
      expect(resultAxis).toEqual([40, 30, 20, 10]);
    });

    it('permutes both H + V: [tl, tr, br, bl] -> [br, bl, tl, tr] = [30, 40, 10, 20]', () => {
      const result = permuteCornerRadiiOnFlip(original, true, true);
      expect(result).toEqual([30, 40, 10, 20]);
    });
  });

  describe('2. normalizeProjectType canonicalization', () => {
    it('normalizes legacy v1.4.14 raw project types', () => {
      expect(normalizeProjectType('album')).toBe('print');
      expect(normalizeProjectType('print')).toBe('print');
      expect(normalizeProjectType('social_media')).toBe('carousel');
      expect(normalizeProjectType('social')).toBe('carousel');
      expect(normalizeProjectType('carousel')).toBe('carousel');
    });

    it('falls back according to canvas unit when type is missing or unknown', () => {
      expect(normalizeProjectType(null, 'px')).toBe('carousel');
      expect(normalizeProjectType(undefined, 'cm')).toBe('print');
      expect(normalizeProjectType('', 'mm')).toBe('print');
    });
  });

  describe('3. hydrateElement and sanitizeElement lossless fidelity', () => {
    it('preserves GraphicElement with type: "graphic" without coercing to "photo"', () => {
      const rawGraphic = {
        id: 'graphic-test-1',
        type: 'graphic',
        x: 45,
        y: 60,
        width: 80,
        height: 80,
        rotation: 15,
        opacity: 0.9,
        zIndex: 5,
        locked: false,
        name: 'Heart Sticker',
        graphicId: 'asset-sticker-101',
        fileUrl: 'asset://assets/stickers/heart.png',
        filePath: '/tmp/stickers/heart.png',
        fileName: 'heart.png',
        flipHorizontal: true,
        flipVertical: false,
        blurRadius: 2.5,
        grayscaleAmount: 0.5,
        noiseAmount: 12,
        shadowEnabled: true,
        shadowBlur: 14,
        shadowOffsetX: 2,
        shadowOffsetY: 6,
        shadowOpacity: 45,
        shadowColor: '#222222',
        frameAssetId: 'asset-sticker-101',
      };

      const hydrated = hydrateElement(rawGraphic);
      expect(hydrated.type).toBe('graphic');
      expect(hydrated.id).toBe('graphic-test-1');
      if (hydrated.type === 'graphic') {
        expect(hydrated.flipHorizontal).toBe(true);
        expect(hydrated.blurRadius).toBe(2.5);
        expect(hydrated.grayscaleAmount).toBe(0.5);
        expect(hydrated.noiseAmount).toBe(12);
        expect(hydrated.shadowEnabled).toBe(true);
        expect(hydrated.shadowBlur).toBe(14);
        expect(hydrated.shadowColor).toBe('#222222');
        expect(hydrated.excludeFromAdaptiveLayout).toBe(true);
      }

      const sanitized = sanitizeElement(hydrated);
      expect(sanitized.type).toBe('graphic');
      expect(sanitized.flipHorizontal).toBe(true);
      expect(sanitized.blurRadius).toBe(2.5);
      expect(sanitized.grayscaleAmount).toBe(0.5);
      expect(sanitized.noiseAmount).toBe(12);
      expect(sanitized.shadowEnabled).toBe(true);
    });

    it('preserves PhotoFrameElement with visual effects, flip, noise, and shadows', () => {
      const rawPhoto = {
        id: 'photo-test-1',
        type: 'photo',
        photoId: 'p-12345',
        filePath: '/photos/wedding_01.jpg',
        fileName: 'wedding_01.jpg',
        x: 10,
        y: 20,
        width: 150,
        height: 100,
        rotation: 0,
        opacity: 1.0,
        zIndex: 2,
        flipHorizontal: true,
        flipVertical: false,
        blurRadius: 5.0,
        grayscaleAmount: 0.2,
        noiseAmount: 20.0,
        shadowEnabled: true,
        shadowBlur: 12.0,
        shadowOffsetX: 4.0,
        shadowOffsetY: 8.0,
        shadowOpacity: 40.0,
        shadowColor: '#111111',
        excludeFromAdaptiveLayout: false,
        cornerRadiusTl: 8,
        cornerRadiusTr: 8,
        cornerRadiusBr: 0,
        cornerRadiusBl: 0,
      };

      const hydrated = hydrateElement(rawPhoto);
      expect(hydrated.type).toBe('photo');
      if (hydrated.type === 'photo') {
        expect(hydrated.flipHorizontal).toBe(true);
        expect(hydrated.blurRadius).toBe(5.0);
        expect(hydrated.noiseAmount).toBe(20.0);
        expect(hydrated.shadowEnabled).toBe(true);
        expect(hydrated.shadowBlur).toBe(12.0);
        expect(hydrated.shadowOffsetX).toBe(4.0);
        expect(hydrated.shadowOffsetY).toBe(8.0);
        expect(hydrated.shadowOpacity).toBe(40.0);
        expect(hydrated.shadowColor).toBe('#111111');
      }

      const sanitized = sanitizeElement(hydrated);
      expect(sanitized.type).toBe('photo');
      expect(sanitized.flipHorizontal).toBe(true);
      expect(sanitized.blurRadius).toBe(5.0);
      expect(sanitized.noiseAmount).toBe(20.0);
      expect(sanitized.shadowEnabled).toBe(true);
      expect(sanitized.shadowBlur).toBe(12.0);
    });
  });

  describe('4. Per-spread dimension overrides in getProjectDimensionsInCanvasUnit', () => {
    const baseProject: Project = {
      id: 'proj-1',
      name: 'Wedding Album',
      canvasWidth: 30,
      canvasHeight: 20,
      canvasUnit: 'cm',
      canvasDpi: 300,
      spacingValue: 4,
      spacingUnit: 'mm',
      projectType: 'print',
      borderEnabled: false,
      borderWidth: 0,
      borderUnit: 'cm',
      borderColor: '#FFFFFF',
      backgroundType: 'solid',
      backgroundColor: '#FFFFFF',
      marginEnabled: true,
      marginValue: 10,
      marginUnit: 'mm',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    it('uses project default dimensions when spread has no dimension override', () => {
      const spreadWithoutOverride: Spread = {
        id: 'spread-1',
        spreadIndex: 1,
        type: 'interior',
        name: 'Spread 1',
        leftPage: null,
        rightPage: null,
        gutterWidth: 0,
        gutterUnit: 'cm',
        bleed: 0,
        safeArea: 10,
        backgroundColor: '#FFFFFF',
        elements: [],
      };

      const dims = getProjectDimensionsInCanvasUnit(baseProject, spreadWithoutOverride);
      expect(dims.pageWidth).toBe(30);
      expect(dims.pageHeight).toBe(20);
      expect(dims.unit).toBe('cm');
    });

    it('overrides dimensions with per-spread values when specified', () => {
      const spreadWithOverride: Spread = {
        id: 'spread-cover',
        spreadIndex: 0,
        type: 'cover',
        name: 'Cover Spread',
        leftPage: null,
        rightPage: null,
        gutterWidth: 0,
        gutterUnit: 'cm',
        bleed: 0,
        safeArea: 10,
        backgroundColor: '#FFFFFF',
        elements: [],
        pageWidth: 35,
        pageHeight: 22,
        pageUnit: 'cm',
      };

      const dims = getProjectDimensionsInCanvasUnit(baseProject, spreadWithOverride);
      expect(dims.pageWidth).toBe(35);
      expect(dims.pageHeight).toBe(22);
    });

    it('converts units properly when per-spread unit differs from project canvasUnit', () => {
      const spreadWithMmOverride: Spread = {
        id: 'spread-custom-mm',
        spreadIndex: 2,
        type: 'interior',
        name: 'Spread 2',
        leftPage: null,
        rightPage: null,
        gutterWidth: 0,
        gutterUnit: 'cm',
        bleed: 0,
        safeArea: 10,
        backgroundColor: '#FFFFFF',
        elements: [],
        pageWidth: 250, // 250 mm = 25 cm
        pageHeight: 250, // 250 mm = 25 cm
        pageUnit: 'mm',
      };

      const dims = getProjectDimensionsInCanvasUnit(baseProject, spreadWithMmOverride);
      expect(dims.pageWidth).toBe(25);
      expect(dims.pageHeight).toBe(25);
      expect(dims.unit).toBe('cm');
    });
  });

  describe('5. Design equality comparisons (isElementDesignEqual & isSpreadDesignEqual)', () => {
    it('detects visual effect and shadow differences on photo elements', () => {
      const elemA: AlbumElement = {
        id: 'p1',
        type: 'photo',
        photoId: 'photo-1',
        filePath: '/test.jpg',
        fileName: 'test.jpg',
        previewPath: '/prevA.jpg',
        thumbnailPath: '/thumbA.jpg',
        x: 10,
        y: 10,
        width: 100,
        height: 100,
        rotation: 0,
        zIndex: 1,
        cropX: 0,
        cropY: 0,
        cropScale: 1,
        cropRotation: 0,
        borderEnabled: false,
        borderWidth: 0,
        borderColor: '',
        opacity: 1,
        flipHorizontal: false,
      };

      const elemB: AlbumElement = {
        ...elemA,
        previewPath: '/prevB.jpg', // Runtime cache path differences must be ignored
        thumbnailPath: '/thumbB.jpg',
      };

      expect(isElementDesignEqual(elemA, elemB)).toBe(true);

      const elemWithFlip: AlbumElement = {
        ...elemA,
        flipHorizontal: true,
      };
      expect(isElementDesignEqual(elemA, elemWithFlip)).toBe(false);

      const elemWithShadow: AlbumElement = {
        ...elemA,
        shadowEnabled: true,
        shadowBlur: 15,
      };
      expect(isElementDesignEqual(elemA, elemWithShadow)).toBe(false);
    });

    it('correctly compares GraphicElement instances', () => {
      const g1: AlbumElement = {
        id: 'g1',
        type: 'graphic',
        x: 20,
        y: 20,
        width: 50,
        height: 50,
        rotation: 0,
        opacity: 1,
        zIndex: 2,
        filePath: '/graphics/icon.svg',
        fileName: 'icon.svg',
        blurRadius: 0,
      };

      const g2: AlbumElement = {
        ...g1,
        previewPath: '/cached/prev.png',
      };

      expect(isElementDesignEqual(g1, g2)).toBe(true);

      const g3: AlbumElement = {
        ...g1,
        blurRadius: 3.5,
      };
      expect(isElementDesignEqual(g1, g3)).toBe(false);
    });

    it('detects per-spread dimension differences in isSpreadDesignEqual', () => {
      const spreadA: Spread = {
        id: 's1',
        spreadIndex: 1,
        type: 'interior',
        name: 'Spread 1',
        leftPage: null,
        rightPage: null,
        gutterWidth: 0,
        gutterUnit: 'cm',
        bleed: 0,
        safeArea: 10,
        backgroundColor: '#FFFFFF',
        elements: [],
        pageWidth: 30,
        pageHeight: 20,
      };

      const spreadB: Spread = {
        ...spreadA,
        pageWidth: 35,
      };

      expect(isSpreadDesignEqual(spreadA, spreadA)).toBe(true);
      expect(isSpreadDesignEqual(spreadA, spreadB)).toBe(false);
    });
  });
});
