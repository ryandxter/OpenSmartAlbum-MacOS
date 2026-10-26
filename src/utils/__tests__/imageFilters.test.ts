import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  hashSeed,
  mulberry32,
  createNoisePatternCanvas,
  getSeededGrainTile,
  renderFilteredPhotoToCanvas,
  clearImageFilterCache,
} from '../imageFilters';

// Provide lightweight canvas DOM shim if running in node environment without jsdom
if (typeof document === 'undefined') {
  const createMockCtx = () => ({
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    filter: 'none',
    globalCompositeOperation: 'source-over',
    globalAlpha: 1,
    fillStyle: '',
    createImageData: (w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    }),
    putImageData: vi.fn(),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    }),
    createPattern: vi.fn(() => ({})),
  });

  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        const ctx = createMockCtx();
        return {
          width: 0,
          height: 0,
          getContext: (type: string) => (type === '2d' ? ctx : null),
        };
      }
      return {};
    },
  };
}

describe('imageFilters.ts - Deterministic PRNG & Film-Grain Filter Pipeline (FX-01, D-01)', () => {
  beforeEach(() => {
    clearImageFilterCache();
  });

  describe('hashSeed', () => {
    it('produces identical unsigned 32-bit integers for the same input string', () => {
      const h1 = hashSeed('element-photo-123');
      const h2 = hashSeed('element-photo-123');
      expect(h1).toBe(h2);
      expect(h1).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(h1)).toBe(true);
    });

    it('produces different seeds for different strings', () => {
      const h1 = hashSeed('photo-frame-A');
      const h2 = hashSeed('photo-frame-B');
      expect(h1).not.toBe(h2);
    });
  });

  describe('mulberry32 PRNG', () => {
    it('generates deterministic float sequence in [0, 1) for the same seed', () => {
      const randA = mulberry32(1337);
      const randB = mulberry32(1337);

      const seqA = [randA(), randA(), randA(), randA(), randA()];
      const seqB = [randB(), randB(), randB(), randB(), randB()];

      expect(seqA).toEqual(seqB);
      for (const val of seqA) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });

    it('generates different sequences for different seeds', () => {
      const randA = mulberry32(1001);
      const randB = mulberry32(2002);

      expect(randA()).not.toBe(randB());
    });
  });

  describe('createNoisePatternCanvas & getSeededGrainTile', () => {
    it('creates a canvas with requested dimensions and deterministic pattern', () => {
      const canvas = createNoisePatternCanvas(42, 100, 64, 64);
      expect(canvas.width).toBe(64);
      expect(canvas.height).toBe(64);

      if (typeof canvas.getContext === 'function') {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const imgData = ctx.createImageData(64, 64);
          expect(imgData.data.length).toBe(64 * 64 * 4);
        }
      }
    });

    it('caches grain tiles across calls with the same seed key', () => {
      const tile1 = getSeededGrainTile('spread-noise-seed', 256);
      const tile2 = getSeededGrainTile('spread-noise-seed', 256);
      expect(tile1).toBe(tile2);
    });
  });

  describe('renderFilteredPhotoToCanvas & LRU Caching', () => {
    it('renders filtered output and returns cached instance on identical parameters', () => {
      const mockCanvas = document.createElement('canvas') as HTMLCanvasElement;
      mockCanvas.width = 100;
      mockCanvas.height = 100;

      const filtered1 = renderFilteredPhotoToCanvas(mockCanvas, 200, 150, {
        grayscale: 50,
        noise: 25,
        blur: 5,
        seed: 'frame-100',
      });

      expect(filtered1).toBeDefined();
      expect(filtered1.width).toBe(200);
      expect(filtered1.height).toBe(150);

      const filtered2 = renderFilteredPhotoToCanvas(mockCanvas, 200, 150, {
        grayscale: 50,
        noise: 25,
        blur: 5,
        seed: 'frame-100',
      });

      // Should return exact cached canvas instance
      expect(filtered2).toBe(filtered1);

      // Altering parameter should produce new canvas
      const filtered3 = renderFilteredPhotoToCanvas(mockCanvas, 200, 150, {
        grayscale: 80,
        noise: 25,
        blur: 5,
        seed: 'frame-100',
      });
      expect(filtered3).not.toBe(filtered1);
    });

    it('respects supplied targetCanvas when provided', () => {
      const source = document.createElement('canvas') as HTMLCanvasElement;
      source.width = 50;
      source.height = 50;

      const target = document.createElement('canvas') as HTMLCanvasElement;
      const result = renderFilteredPhotoToCanvas(source, 120, 80, {
        grayscale: 0,
        noise: 0,
        blur: 0,
        targetCanvas: target,
      });

      expect(result).toBe(target);
      expect(target.width).toBe(120);
      expect(target.height).toBe(80);
    });
  });
});
