import { describe, it, expect } from 'vitest';
import { computeContextDockPosition, DockScreenRect } from '../FrameToolbar';

describe('computeContextDockPosition', () => {
  const viewportWidth = 1200;
  const viewportHeight = 800;
  const dockWidth = 38;
  const dockHeight = 280;

  it('positions dock to the right of frame under standard conditions', () => {
    const frameRect: DockScreenRect = {
      left: 200,
      right: 500,
      top: 150,
      bottom: 450,
    };

    const pos = computeContextDockPosition(frameRect, viewportWidth, viewportHeight, dockWidth, dockHeight);

    // Preferred: right + 14 = 514, top = 150
    expect(pos.x).toBe(514);
    expect(pos.y).toBe(150);
  });

  it('automatically flips to the left when frame is near the right edge of viewport', () => {
    // dockX would be 1160 + 14 = 1174.
    // 1174 + 38 = 1212 > viewportWidth - 14 (1186), so it flips to left.
    const frameRect: DockScreenRect = {
      left: 850,
      right: 1160,
      top: 100,
      bottom: 400,
    };

    const pos = computeContextDockPosition(frameRect, viewportWidth, viewportHeight, dockWidth, dockHeight);

    // Flipped: left - dockWidth - 14 = 850 - 38 - 14 = 798
    expect(pos.x).toBe(798);
    expect(pos.y).toBe(100);
  });

  it('clamps dockY within viewport top boundary when frame top is negative or offscreen', () => {
    const frameRect: DockScreenRect = {
      left: 200,
      right: 400,
      top: -50,
      bottom: 250,
    };

    const pos = computeContextDockPosition(frameRect, viewportWidth, viewportHeight, dockWidth, dockHeight);

    expect(pos.x).toBe(414);
    expect(pos.y).toBe(14); // Clamped to minimum margin of 14px
  });

  it('clamps dockY within viewport bottom boundary when frame is near the bottom edge', () => {
    const frameRect: DockScreenRect = {
      left: 200,
      right: 400,
      top: 650,
      bottom: 750,
    };

    const pos = computeContextDockPosition(frameRect, viewportWidth, viewportHeight, dockWidth, dockHeight);

    // Max Y is viewportHeight - dockHeight - 14 = 800 - 280 - 14 = 506
    expect(pos.x).toBe(414);
    expect(pos.y).toBe(506);
  });

  it('clamps dockX when full-bleed frame causes both right and left to overflow', () => {
    const fullBleedRect: DockScreenRect = {
      left: 5,
      right: 1195,
      top: 20,
      bottom: 780,
    };

    const pos = computeContextDockPosition(fullBleedRect, viewportWidth, viewportHeight, dockWidth, dockHeight);

    // Preferred right (1209) overflows -> flips to left: 5 - 38 - 14 = -47.
    // Clamped to minX = 14.
    expect(pos.x).toBe(14);
    expect(pos.y).toBe(20);
  });

  it('respects custom dockWidth and dockHeight parameters', () => {
    const frameRect: DockScreenRect = {
      left: 300,
      right: 600,
      top: 200,
      bottom: 500,
    };

    const customWidth = 50;
    const customHeight = 350;

    const pos = computeContextDockPosition(frameRect, viewportWidth, viewportHeight, customWidth, customHeight);

    expect(pos.x).toBe(614);
    expect(pos.y).toBe(200);
  });
});
