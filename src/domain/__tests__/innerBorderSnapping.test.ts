import { describe, it, expect } from 'vitest';
import {
  computeInnerBorderRects,
  calculateSnapping,
  calculateResizeSnapping,
} from '../editor';

describe('Inner Page / Spread Borders & Magnetic Snapping (FX-04, D-05)', () => {
  const spreadWidth = 400; // mm
  const spreadHeight = 200; // mm
  const gutterWidth = 0; // mm
  const safeArea = {
    top: 12,
    bottom: 12,
    outside: 12,
    spine: 6,
  };

  describe('computeInnerBorderRects', () => {
    it('computes unified outer perimeter for target="full"', () => {
      const rects = computeInnerBorderRects({
        spreadWidth,
        spreadHeight,
        safeArea,
        gutterWidth,
        target: 'full',
        isSpread: true,
      });

      expect(rects).toHaveLength(1);
      expect(rects[0]).toEqual({
        x: 12,
        y: 12,
        width: 400 - 24, // 376
        height: 200 - 24, // 176
      });
    });

    it('computes 2 page border rects for target="both" respecting spine safe margin', () => {
      const rects = computeInnerBorderRects({
        spreadWidth,
        spreadHeight,
        safeArea,
        gutterWidth,
        target: 'both',
        isSpread: true,
      });

      expect(rects).toHaveLength(2);
      // Single page width = 200
      // Left rect: x = 12, width = 200 - 12 - 6 = 182
      expect(rects[0]).toEqual({
        x: 12,
        y: 12,
        width: 182,
        height: 176,
      });

      // Right rect: x = 200 + 6 = 206, width = 200 - 6 - 12 = 182
      expect(rects[1]).toEqual({
        x: 206,
        y: 12,
        width: 182,
        height: 176,
      });
    });

    it('computes single page border for target="left" or target="right"', () => {
      const leftRects = computeInnerBorderRects({
        spreadWidth,
        spreadHeight,
        safeArea,
        gutterWidth,
        target: 'left',
        isSpread: true,
      });
      expect(leftRects).toHaveLength(1);
      expect(leftRects[0]?.x).toBe(12);

      const rightRects = computeInnerBorderRects({
        spreadWidth,
        spreadHeight,
        safeArea,
        gutterWidth,
        target: 'right',
        isSpread: true,
      });
      expect(rightRects).toHaveLength(1);
      expect(rightRects[0]?.x).toBe(206);
    });

    it('computes slide border for single slide / carousel (isSpread = false)', () => {
      const rects = computeInnerBorderRects({
        spreadWidth: 1080,
        spreadHeight: 1080,
        safeArea: { top: 40, bottom: 40, outside: 40, spine: 40 },
        isSpread: false,
      });

      expect(rects).toHaveLength(1);
      expect(rects[0]).toEqual({
        x: 40,
        y: 40,
        width: 1000,
        height: 1000,
      });
    });
  });

  describe('calculateSnapping with active Inner Borders', () => {
    const innerBorderRects = computeInnerBorderRects({
      spreadWidth,
      spreadHeight,
      safeArea,
      gutterWidth,
      target: 'both',
      isSpread: true,
    });

    it('magnetically snaps dragged frame to inner border left edge', () => {
      // Left border x is 12. Dragged frame placed at x=13 (within threshold=2)
      const result = calculateSnapping(
        { x: 13, y: 50, width: 60, height: 40 },
        spreadWidth,
        spreadHeight,
        safeArea,
        gutterWidth,
        [],
        { enabled: true, threshold: 2.0, snapToMargins: true },
        'mm',
        undefined,
        innerBorderRects
      );

      expect(result.snappedX).toBe(12);
      expect(result.snapLines.some((l) => l.type === 'vertical' && l.label?.includes('Inner Border Left'))).toBe(true);
    });

    it('magnetically snaps dragged frame to inner border right edge', () => {
      // Left border right edge is 12 + 182 = 194.
      // Frame right edge = x + 60. When x = 133.5, frame right = 193.5 (within threshold of 194)
      const result = calculateSnapping(
        { x: 133.5, y: 50, width: 60, height: 40 },
        spreadWidth,
        spreadHeight,
        safeArea,
        gutterWidth,
        [],
        { enabled: true, threshold: 2.0, snapToMargins: true },
        'mm',
        undefined,
        innerBorderRects
      );

      expect(result.snappedX + 60).toBe(194);
      expect(result.snapLines.some((l) => l.type === 'vertical' && l.label?.includes('Inner Border Right'))).toBe(true);
    });

    it('magnetically snaps dragged frame to inner border top and bottom edges', () => {
      // Top edge is 12. Frame at y=13 snaps to 12
      const resTop = calculateSnapping(
        { x: 30, y: 13, width: 60, height: 40 },
        spreadWidth,
        spreadHeight,
        safeArea,
        gutterWidth,
        [],
        { enabled: true, threshold: 2.0, snapToMargins: true },
        'mm',
        undefined,
        innerBorderRects
      );
      expect(resTop.snappedY).toBe(12);
      expect(resTop.snapLines.some((l) => l.type === 'horizontal' && l.label?.includes('Inner Border Top'))).toBe(true);

      // Bottom edge is 12 + 176 = 188. Frame bottom at y + 40. When y = 147.2, bottom = 187.2 -> snaps to 188 (y=148)
      const resBottom = calculateSnapping(
        { x: 30, y: 147.2, width: 60, height: 40 },
        spreadWidth,
        spreadHeight,
        safeArea,
        gutterWidth,
        [],
        { enabled: true, threshold: 2.0, snapToMargins: true },
        'mm',
        undefined,
        innerBorderRects
      );
      expect(resBottom.snappedY).toBe(148);
      expect(resBottom.snapLines.some((l) => l.type === 'horizontal' && l.label?.includes('Inner Border Bottom'))).toBe(true);
    });
  });

  describe('calculateResizeSnapping with active Inner Borders', () => {
    const innerBorderRects = computeInnerBorderRects({
      spreadWidth,
      spreadHeight,
      safeArea,
      gutterWidth,
      target: 'both',
      isSpread: true,
    });

    it('snaps right edge during resize to inner border right edge', () => {
      // Left border right edge is 194. Frame x=30, width=163 (right=193) -> snaps right to 194 (width=164)
      const result = calculateResizeSnapping(
        { x: 30, y: 50, width: 163, height: 50 },
        spreadWidth,
        spreadHeight,
        safeArea,
        gutterWidth,
        [],
        2.0,
        'mm',
        'middle-right',
        innerBorderRects
      );

      expect(result.snappedBounds.width).toBe(164);
      expect(result.snapLines.some((l) => l.type === 'vertical' && l.label?.includes('Inner Border Right'))).toBe(true);
    });
  });
});
