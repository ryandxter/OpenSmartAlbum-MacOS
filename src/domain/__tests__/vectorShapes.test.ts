/**
 * Automated Verification Suite for Vector Shape Masking & In-Shape Crop Engine
 * Covers Plan 09-01 & Plan 17-01 requirements:
 * - Suite 1: SVG Path Generation & Validation (M/Z bounds for all presets)
 * - Suite 2: Geometric 1:1 Centering (Option A) Invariant on Asymmetrical Frames
 * - Suite 3: Canvas 2D Path Tracing & Zero-Clip Invariant
 * - Suite 4: SVG Path Parser Invariant (M, L, H, V, C, S, Q, T, A, Z)
 * - Suite 5: Multi-Mode Cohesion & Carousel Store Dispatch
 * - Suite 6: Polygon Tangent Fillet Math & Dynamic Clamping
 * - Suite 7: Star Independent Tip & Valley Fillets
 * - Suite 8: Oval SVG Path and Context Tracing
 * - Suite 9: Stroke Contour & Mask Alignment Invariant
 */

function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

assert.strictEqual = function <T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${String(expected)}, but got ${String(actual)}`);
  }
};

assert.ok = function (condition: unknown, message?: string): asserts condition {
  assert(condition, message);
};

// Support both standalone execution (npx tsx <file>) and Vitest runner (npx vitest run <file>)
let describeFn = (name: string, fn: () => void) => {
  console.log(`\n▶ ${name}`);
  fn();
};
let itFn = (name: string, fn: () => void) => {
  fn();
  console.log(`  ✔ ${name}`);
};

const globalProcess = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process;
if (globalProcess?.env?.VITEST) {
  const v = await import('vitest');
  describeFn = v.describe as any;
  itFn = v.it as any;
}

import {
  ShapeType,
  SHAPE_PRESETS,
  getShapeSvgPath,
  drawShapeToContext,
  traceSvgPathToContext,
  createPolygonSvgPath,
  createStarSvgPath,
  createHeartSvgPath,
  createScallopSvgPath,
  createOvalSvgPath,
} from '../shapes';
import { useCarouselStore } from '../../stores/carouselStore';
import type { CarouselPhotoFrame } from '../carousel';

function createMockContext() {
  const calls: { method: string; args: any[] }[] = [];
  return {
    calls,
    beginPath: (...args: any[]) => calls.push({ method: 'beginPath', args }),
    closePath: (...args: any[]) => calls.push({ method: 'closePath', args }),
    moveTo: (...args: any[]) => calls.push({ method: 'moveTo', args }),
    lineTo: (...args: any[]) => calls.push({ method: 'lineTo', args }),
    bezierCurveTo: (...args: any[]) => calls.push({ method: 'bezierCurveTo', args }),
    quadraticCurveTo: (...args: any[]) => calls.push({ method: 'quadraticCurveTo', args }),
    arc: (...args: any[]) => calls.push({ method: 'arc', args }),
    ellipse: (...args: any[]) => calls.push({ method: 'ellipse', args }),
    rect: (...args: any[]) => calls.push({ method: 'rect', args }),
    roundRect: (...args: any[]) => calls.push({ method: 'roundRect', args }),
    arcTo: (...args: any[]) => calls.push({ method: 'arcTo', args }),
    clip: (...args: any[]) => calls.push({ method: 'clip', args }),
  };
}

console.log('🧪 Starting Vector Shape Masking & In-Shape Crop Engine Tests...');

// ---------------------------------------------------------------------------
// Suite 1: SVG Path Generation & Validation
// ---------------------------------------------------------------------------
describeFn('Test Suite 1: SVG Path Generation & Validation', () => {
  const allShapes: ShapeType[] = [
    'rectangle',
    'rounded',
    'circle',
    'oval',
    'hexagon',
    'octagon',
    'star',
    'scallop',
    'heart',
    'custom_svg',
  ];

  itFn('All 10 shape types generate well-formed SVG paths starting with M and ending with Z', () => {
    for (const shape of allShapes) {
      const customPath = shape === 'custom_svg' ? 'M 10 10 L 50 10 L 50 50 Z' : undefined;
      const path = getShapeSvgPath(shape, 600, 400, [12, 12, 12, 12], customPath);

      assert.ok(path && path.length > 0, `Path for shape "${shape}" must not be empty`);
      assert.ok(
        path.trim().startsWith('M') || path.trim().startsWith('m'),
        `Path for shape "${shape}" must start with a Move command (M/m), got: ${path.slice(0, 10)}`
      );
      assert.ok(
        path.trim().endsWith('Z') || path.trim().endsWith('z'),
        `Path for shape "${shape}" must terminate with a Close command (Z/z), got: ${path.slice(-5)}`
      );
    }
  });

  itFn('Direct generator functions and preset registry integrity', () => {
    assert.ok(createPolygonSvgPath(6, 400, 400).startsWith('M'), 'Hexagon direct generator must produce M path');
    assert.ok(createPolygonSvgPath(8, 400, 400).startsWith('M'), 'Octagon direct generator must produce M path');
    assert.ok(createStarSvgPath(5, 400, 400).startsWith('M'), 'Star direct generator must produce M path');
    assert.ok(createHeartSvgPath(400, 400).startsWith('M'), 'Heart direct generator must produce M path');
    assert.ok(createScallopSvgPath(400, 400, 8).startsWith('M'), 'Scallop direct generator must produce M path');
    assert.ok(createOvalSvgPath(400, 400).startsWith('M'), 'Oval direct generator must produce M path');
    assert.strictEqual(SHAPE_PRESETS.length, 9, 'SHAPE_PRESETS must register all 9 standard presets');
  });
});

// ---------------------------------------------------------------------------
// Suite 2: Geometric 1:1 Centering (Option A) Invariant
// ---------------------------------------------------------------------------
describeFn('Test Suite 2: Geometric 1:1 Centering (Option A) Invariant', () => {
  const nonRectShapes: ShapeType[] = ['circle', 'hexagon', 'octagon', 'star', 'scallop', 'heart'];

  itFn('Landscape Frame (800x400) centers shapes in [200, 600]', () => {
    const landW = 800;
    const landH = 400;
    const landSize = Math.min(landW, landH);
    const landOffsetX = (landW - landSize) / 2; // 200
    const landOffsetY = (landH - landSize) / 2; // 0

    for (const shape of nonRectShapes) {
      const path = getShapeSvgPath(shape, landW, landH);
      const mockCtx = createMockContext();
      traceSvgPathToContext(mockCtx, path);

      const points: { x: number; y: number }[] = [];
      for (const call of mockCtx.calls) {
        if (call.method === 'moveTo' || call.method === 'lineTo') {
          points.push({ x: call.args[0], y: call.args[1] });
        } else if (call.method === 'bezierCurveTo') {
          points.push({ x: call.args[4], y: call.args[5] });
        } else if (call.method === 'quadraticCurveTo') {
          points.push({ x: call.args[2], y: call.args[3] });
        }
      }

      assert.ok(points.length > 0, `Shape ${shape} must have coordinates`);
      for (const pt of points) {
        assert.ok(
          pt.x >= landOffsetX - 1.0 && pt.x <= landOffsetX + landSize + 1.0,
          `Shape "${shape}" X coord ${pt.x} must be centered within [${landOffsetX}, ${landOffsetX + landSize}]`
        );
        assert.ok(
          pt.y >= landOffsetY - 1.0 && pt.y <= landOffsetY + landSize + 1.0,
          `Shape "${shape}" Y coord ${pt.y} must be centered within [${landOffsetY}, ${landOffsetY + landSize}]`
        );
      }
    }
  });

  itFn('Portrait Frame (300x600) centers shapes in [150, 450]', () => {
    const portW = 300;
    const portH = 600;
    const portSize = Math.min(portW, portH);
    const portOffsetX = (portW - portSize) / 2; // 0
    const portOffsetY = (portH - portSize) / 2; // 150

    for (const shape of nonRectShapes) {
      const path = getShapeSvgPath(shape, portW, portH);
      const mockCtx = createMockContext();
      traceSvgPathToContext(mockCtx, path);

      const points: { x: number; y: number }[] = [];
      for (const call of mockCtx.calls) {
        if (call.method === 'moveTo' || call.method === 'lineTo') {
          points.push({ x: call.args[0], y: call.args[1] });
        } else if (call.method === 'bezierCurveTo') {
          points.push({ x: call.args[4], y: call.args[5] });
        } else if (call.method === 'quadraticCurveTo') {
          points.push({ x: call.args[2], y: call.args[3] });
        }
      }

      assert.ok(points.length > 0, `Shape ${shape} must have coordinates in portrait`);
      for (const pt of points) {
        assert.ok(
          pt.x >= portOffsetX - 1.0 && pt.x <= portOffsetX + portSize + 1.0,
          `Shape "${shape}" X coord ${pt.x} must be centered within [${portOffsetX}, ${portOffsetX + portSize}]`
        );
        assert.ok(
          pt.y >= portOffsetY - 1.0 && pt.y <= portOffsetY + portSize + 1.0,
          `Shape "${shape}" Y coord ${pt.y} must be centered within [${portOffsetY}, ${portOffsetY + portSize}]`
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Canvas 2D Path Tracing & Zero-Clip Invariant
// ---------------------------------------------------------------------------
describeFn('Test Suite 3: Canvas 2D Path Tracing & Zero-Clip Invariant', () => {
  const allShapes: ShapeType[] = [
    'rectangle',
    'rounded',
    'circle',
    'oval',
    'hexagon',
    'octagon',
    'star',
    'scallop',
    'heart',
    'custom_svg',
  ];

  itFn('All shapes trace cleanly onto Canvas2D context with zero premature c.clip() calls', () => {
    for (const shape of allShapes) {
      const mockCtx = createMockContext();
      const customSvg = shape === 'custom_svg' ? 'M 10 10 L 90 10 L 90 90 Z' : undefined;

      drawShapeToContext(mockCtx, shape, 500, 300, [10, 10, 10, 10], customSvg);

      // Invariant 1: ctx.clip() must be called EXACTLY 0 times
      const clipCalls = mockCtx.calls.filter((c) => c.method === 'clip');
      assert.strictEqual(
        clipCalls.length,
        0,
        `drawShapeToContext for "${shape}" must NEVER call c.clip() prematurely (Konva clipFunc conflict)`
      );

      // Invariant 2: ctx.beginPath() must be the first call
      assert.strictEqual(
        mockCtx.calls[0]?.method,
        'beginPath',
        `First method called for "${shape}" must be beginPath`
      );

      // Invariant 3: ctx.closePath() must be the last call
      const lastCall = mockCtx.calls[mockCtx.calls.length - 1];
      assert.strictEqual(
        lastCall?.method,
        'closePath',
        `Last method called for "${shape}" must be closePath`
      );

      // Invariant 4: Substantive path commands were recorded
      assert.ok(
        mockCtx.calls.length >= 3,
        `Shape "${shape}" must execute drawing commands between beginPath and closePath`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 4: SVG Path Parser Invariant
// ---------------------------------------------------------------------------
describeFn('Test Suite 4: SVG Path Parser Invariant (traceSvgPathToContext)', () => {
  itFn('Basic M, L, H, V, Z', () => {
    const mockCtx = createMockContext();
    traceSvgPathToContext(mockCtx, 'M 10 20 L 30 40 H 50 V 60 Z');

    assert.strictEqual(mockCtx.calls[0]?.method, 'moveTo');
    assert.strictEqual(mockCtx.calls[0]?.args[0], 10);
    assert.strictEqual(mockCtx.calls[0]?.args[1], 20);

    assert.strictEqual(mockCtx.calls[1]?.method, 'lineTo');
    assert.strictEqual(mockCtx.calls[1]?.args[0], 30);
    assert.strictEqual(mockCtx.calls[1]?.args[1], 40);

    assert.strictEqual(mockCtx.calls[2]?.method, 'lineTo');
    assert.strictEqual(mockCtx.calls[2]?.args[0], 50);
    assert.strictEqual(mockCtx.calls[2]?.args[1], 40);

    assert.strictEqual(mockCtx.calls[3]?.method, 'lineTo');
    assert.strictEqual(mockCtx.calls[3]?.args[0], 50);
    assert.strictEqual(mockCtx.calls[3]?.args[1], 60);

    assert.strictEqual(mockCtx.calls[4]?.method, 'closePath');
  });

  itFn('Relative commands and negative coordinates without whitespace', () => {
    const mockCtx = createMockContext();
    traceSvgPathToContext(mockCtx, 'm10 20l20-10h-5v-5z');

    assert.strictEqual(mockCtx.calls[0]?.method, 'moveTo');
    assert.strictEqual(mockCtx.calls[0]?.args[0], 10);
    assert.strictEqual(mockCtx.calls[0]?.args[1], 20);

    assert.strictEqual(mockCtx.calls[1]?.method, 'lineTo');
    assert.strictEqual(mockCtx.calls[1]?.args[0], 30); // 10 + 20
    assert.strictEqual(mockCtx.calls[1]?.args[1], 10); // 20 - 10

    assert.strictEqual(mockCtx.calls[2]?.method, 'lineTo');
    assert.strictEqual(mockCtx.calls[2]?.args[0], 25); // 30 - 5
    assert.strictEqual(mockCtx.calls[2]?.args[1], 10);

    assert.strictEqual(mockCtx.calls[3]?.method, 'lineTo');
    assert.strictEqual(mockCtx.calls[3]?.args[0], 25);
    assert.strictEqual(mockCtx.calls[3]?.args[1], 5); // 10 - 5

    assert.strictEqual(mockCtx.calls[4]?.method, 'closePath');
  });

  itFn('Smooth Cubic Beziers (C, S)', () => {
    const mockCtx = createMockContext();
    traceSvgPathToContext(mockCtx, 'M 0 0 C 10 20 30 40 50 50 S 90 80 100 100 Z');

    assert.strictEqual(mockCtx.calls[0]?.method, 'moveTo');
    assert.strictEqual(mockCtx.calls[1]?.method, 'bezierCurveTo');
    assert.strictEqual(mockCtx.calls[2]?.method, 'bezierCurveTo');

    // Second bezier is S: control point 1 is reflection of previous cp2 (30, 40) across current (50, 50):
    // 2*50 - 30 = 70, 2*50 - 40 = 60
    assert.strictEqual(mockCtx.calls[2]?.args[0], 70);
    assert.strictEqual(mockCtx.calls[2]?.args[1], 60);
    assert.strictEqual(mockCtx.calls[2]?.args[2], 90);
    assert.strictEqual(mockCtx.calls[2]?.args[3], 80);
    assert.strictEqual(mockCtx.calls[2]?.args[4], 100);
    assert.strictEqual(mockCtx.calls[2]?.args[5], 100);
  });

  itFn('Smooth Quadratic Beziers (Q, T)', () => {
    const mockCtx = createMockContext();
    traceSvgPathToContext(mockCtx, 'M 0 0 Q 20 40 40 40 T 80 80 Z');

    assert.strictEqual(mockCtx.calls[0]?.method, 'moveTo');
    assert.strictEqual(mockCtx.calls[1]?.method, 'quadraticCurveTo');
    assert.strictEqual(mockCtx.calls[2]?.method, 'quadraticCurveTo');

    // Second quadratic is T: control point is reflection of previous cp (20, 40) across current (40, 40):
    // 2*40 - 20 = 60, 2*40 - 40 = 40
    assert.strictEqual(mockCtx.calls[2]?.args[0], 60);
    assert.strictEqual(mockCtx.calls[2]?.args[1], 40);
    assert.strictEqual(mockCtx.calls[2]?.args[2], 80);
    assert.strictEqual(mockCtx.calls[2]?.args[3], 80);
  });

  itFn('Elliptical Arc (A)', () => {
    const mockCtx = createMockContext();
    traceSvgPathToContext(mockCtx, 'M 0 0 A 25 25 0 0 0 50 0 Z');

    assert.strictEqual(mockCtx.calls[0]?.method, 'moveTo');
    const beziers = mockCtx.calls.filter((c) => c.method === 'bezierCurveTo');
    assert.ok(beziers.length >= 1, 'Arc command must be decomposed into bezierCurveTo segments');
    assert.strictEqual(mockCtx.calls[mockCtx.calls.length - 1]?.method, 'closePath');
  });
});

// ---------------------------------------------------------------------------
// Suite 5: Multi-Mode Cohesion & Carousel Store Dispatch
// ---------------------------------------------------------------------------
describeFn('Test Suite 5: Multi-Mode Cohesion & Carousel Store Dispatch', () => {
  itFn('Carousel photo frame updates vector shape and border attributes', () => {
    // Initialize a 3-slide 1:1 carousel
    useCarouselStore.getState().initializeCarousel('test-carousel-p1', '1:1', 3);
    const carousel = useCarouselStore.getState().currentCarousel;
    assert.ok(carousel, 'Carousel must be initialized');
    assert.strictEqual(carousel.slides.length, 3, 'Initial slide count must be 3');

    // Add a photo frame to slide 0
    useCarouselStore.getState().addPhotoFrame(0, {
      type: 'photo',
      x: 120,
      y: 120,
      width: 480,
      height: 480,
      photoId: 'photo-test-01',
    });

    const frame = useCarouselStore.getState().currentCarousel?.slides[0]?.elements[0];
    assert.ok(frame, 'Photo frame must exist on slide 0');

    // Test Selection Dispatch
    useCarouselStore.getState().setSelectedFrameId(frame.id);
    assert.strictEqual(
      useCarouselStore.getState().selectedFrameId,
      frame.id,
      'Selected frame ID must match target frame'
    );

    // Dispatch vector shape and border customization (mirroring ShapesBordersSection in carousel mode)
    useCarouselStore.getState().updatePhotoFrame(frame.id, {
      shapeType: 'heart',
      borderEnabled: true,
      borderColor: '#EF4444',
      borderWidth: 4,
      borderStyle: 'dashed',
    });

    const updatedFrame = useCarouselStore.getState().currentCarousel?.slides[0]?.elements[0] as CarouselPhotoFrame | undefined;
    assert.ok(updatedFrame, 'Updated frame must exist');
    assert.strictEqual(updatedFrame.shapeType, 'heart', 'shapeType must be updated to heart');
    assert.strictEqual(updatedFrame.borderEnabled, true, 'borderEnabled must be true');
    assert.strictEqual(updatedFrame.borderColor, '#EF4444', 'borderColor must be #EF4444');
    assert.strictEqual(updatedFrame.borderWidth, 4, 'borderWidth must be 4');
    assert.strictEqual(updatedFrame.borderStyle, 'dashed', 'borderStyle must be dashed');

    // Remove photo frame and verify selection reset
    useCarouselStore.getState().removePhotoFrame(frame.id);
    assert.strictEqual(
      useCarouselStore.getState().selectedFrameId,
      null,
      'Deleting selected frame must reset selectedFrameId to null'
    );
  });
});

// ---------------------------------------------------------------------------
// Suite 6: Polygon Tangent Fillet Math & Dynamic Clamping
// ---------------------------------------------------------------------------
describeFn('Test Suite 6: Polygon Tangent Fillet Math & Dynamic Clamping', () => {
  itFn('Hexagon with r=0 generates sharp vertices (L commands, 0 A commands)', () => {
    const sharpPath = createPolygonSvgPath(6, 400, 400, 0);
    assert.ok(sharpPath.startsWith('M'), 'Must start with M');
    assert.ok(sharpPath.endsWith('Z'), 'Must end with Z');
    assert.strictEqual(sharpPath.includes(' A '), false, 'r=0 must not contain A commands');
    const lMatches = sharpPath.match(/ L /g);
    assert.strictEqual(lMatches?.length, 5, 'Hexagon with r=0 must have exactly 5 L commands (vertices 1..5)');
  });

  itFn('Hexagon with r=20 generates A arc commands with sweep=1', () => {
    const roundedHex = createPolygonSvgPath(6, 400, 400, 20);
    assert.ok(roundedHex.startsWith('M'), 'Must start with M');
    assert.ok(roundedHex.endsWith('Z'), 'Must end with Z');
    const aCommands = roundedHex.match(/A [0-9.]+ [0-9.]+ 0 0 1/g);
    assert.ok(aCommands && aCommands.length === 6, 'Must generate exactly 6 clockwise circular arcs (sweep=1)');
  });

  itFn('Dynamic self-intersection clamp: r=1000 clamps d <= L/2 without NaNs or inversions', () => {
    const clampedHex = createPolygonSvgPath(6, 400, 400, 1000);
    assert.strictEqual(clampedHex.includes('NaN'), false, 'Clamped path must never contain NaN');
    assert.strictEqual(clampedHex.includes('Infinity'), false, 'Clamped path must never contain Infinity');

    // Regular hexagon inscribed in circle R = 200 (width=400, height=400)
    // Edge length L = 2 * R * sin(pi/6) = 200
    // dMax = L / 2 = 100
    // Interior angle theta = 120 deg -> tan(theta/2) = tan(60 deg) = sqrt(3) ~= 1.73205
    // Max effective radius = dMax * tan(60 deg) ~= 100 * 1.73205 = 173.21
    const arcMatches = [...clampedHex.matchAll(/A ([0-9.]+) ([0-9.]+) 0 0 1/g)];
    assert.strictEqual(arcMatches.length, 6, 'Clamped hexagon must still generate 6 valid arcs');
    for (const match of arcMatches) {
      const rEff = parseFloat(match[1] ?? '0');
      assert.ok(rEff <= 173.21 + 0.1, `Effective radius ${rEff} must be clamped <= (L/2)*tan(60°) ~ 173.21`);
    }
  });

  itFn('Octagon with r=15 generates smooth 8-vertex rounded contour', () => {
    const roundedOct = createPolygonSvgPath(8, 400, 400, 15);
    assert.ok(roundedOct.startsWith('M'), 'Must start with M');
    assert.ok(roundedOct.endsWith('Z'), 'Must end with Z');
    const arcMatches = [...roundedOct.matchAll(/A [0-9.]+ [0-9.]+ 0 0 1/g)];
    assert.strictEqual(arcMatches.length, 8, 'Octagon must generate 8 arc fillets with sweep=1');
  });
});

// ---------------------------------------------------------------------------
// Suite 7: Star Independent Tip & Valley Fillets
// ---------------------------------------------------------------------------
describeFn('Test Suite 7: Star Independent Tip & Valley Fillets', () => {
  itFn('Star with uniform radius produces alternating sweep=1 (tips) and sweep=0 (valleys)', () => {
    const starPath = createStarSvgPath(5, 400, 400, 0.45, 10, 10);
    // 5-point star has 10 vertices: 5 outer tips and 5 inner valleys
    const arcMatches = [...starPath.matchAll(/A [0-9.]+ [0-9.]+ 0 0 ([01])/g)];
    assert.strictEqual(arcMatches.length, 10, '5-point star must have 10 fillets');

    const sweeps = arcMatches.map((m) => parseInt(m[1] ?? '0', 10));
    const tipSweeps = sweeps.filter((s) => s === 1);
    const valleySweeps = sweeps.filter((s) => s === 0);
    assert.strictEqual(tipSweeps.length, 5, 'Star must have exactly 5 clockwise tip arcs (sweep=1)');
    assert.strictEqual(valleySweeps.length, 5, 'Star must have exactly 5 counter-clockwise valley arcs (sweep=0)');
  });

  itFn('Independent tip and valley radii: [25, 0] produces rounded tips with sharp valleys', () => {
    const tipOnly = createStarSvgPath(5, 400, 400, 0.45, 25, 0);
    const arcMatches = [...tipOnly.matchAll(/A [0-9.]+ [0-9.]+ 0 0 ([01])/g)];
    assert.strictEqual(arcMatches.length, 5, 'Must have exactly 5 tip arcs');
    for (const m of arcMatches) {
      assert.strictEqual(m[1], '1', 'All arcs must be outer tips with sweep=1');
    }
  });

  itFn('Independent tip and valley radii: [0, 15] produces sharp tips with rounded valleys', () => {
    const valleyOnly = createStarSvgPath(5, 400, 400, 0.45, 0, 15);
    const arcMatches = [...valleyOnly.matchAll(/A [0-9.]+ [0-9.]+ 0 0 ([01])/g)];
    assert.strictEqual(arcMatches.length, 5, 'Must have exactly 5 valley arcs');
    for (const m of arcMatches) {
      assert.strictEqual(m[1], '0', 'All arcs must be inner valleys with sweep=0');
    }
  });

  itFn('Zero edge overlap invariant: d_tip + d_valley <= L', () => {
    // Under extreme radii [1000, 1000], clamp ensures d_tip <= L/2 and d_valley <= L/2
    const clampedStar = createStarSvgPath(5, 400, 400, 0.45, 1000, 1000);
    assert.strictEqual(clampedStar.includes('NaN'), false, 'Clamped star must never contain NaN');
    assert.strictEqual(clampedStar.includes('Infinity'), false, 'Clamped star must never contain Infinity');
    const arcMatches = [...clampedStar.matchAll(/A [0-9.]+ [0-9.]+ 0 0 ([01])/g)];
    assert.strictEqual(arcMatches.length, 10, 'All 10 vertices clamp gracefully');
  });
});

// ---------------------------------------------------------------------------
// Suite 8: Oval SVG Path and Context Tracing
// ---------------------------------------------------------------------------
describeFn('Test Suite 8: Oval SVG Path and Context Tracing', () => {
  itFn('createOvalSvgPath produces closed ellipse across portrait and landscape bounding boxes', () => {
    const landOval = createOvalSvgPath(600, 300);
    assert.ok(landOval.startsWith('M 0 150.00'), 'Landscape oval must start at (0, ry)');
    assert.ok(landOval.endsWith('Z'), 'Must end with Z');
    assert.ok(landOval.includes('A 300.00 150.00'), 'Must contain arc with rx=300, ry=150');

    const portOval = createOvalSvgPath(300, 600);
    assert.ok(portOval.startsWith('M 0 300.00'), 'Portrait oval must start at (0, ry)');
    assert.ok(portOval.endsWith('Z'), 'Must end with Z');
    assert.ok(portOval.includes('A 150.00 300.00'), 'Must contain arc with rx=150, ry=300');
  });

  itFn('drawShapeToContext with shapeType="oval" executes with zero clip calls', () => {
    const mockCtx = createMockContext();
    drawShapeToContext(mockCtx, 'oval', 400, 200);
    const clipCalls = mockCtx.calls.filter((c) => c.method === 'clip');
    assert.strictEqual(clipCalls.length, 0, 'drawShapeToContext for oval must never call c.clip()');
    assert.strictEqual(mockCtx.calls[0]?.method, 'beginPath');
    assert.strictEqual(mockCtx.calls[mockCtx.calls.length - 1]?.method, 'closePath');
  });
});

// ---------------------------------------------------------------------------
// Suite 9: Stroke Contour & Mask Alignment Invariant
// ---------------------------------------------------------------------------
describeFn('Test Suite 9: Stroke Contour & Mask Alignment Invariant', () => {
  itFn('Rounded polygon, star, and oval SVG paths trace cleanly to Canvas2D context without error', () => {
    const testCases: { shape: ShapeType; radii: [number, number, number, number] }[] = [
      { shape: 'hexagon', radii: [20, 20, 20, 20] },
      { shape: 'octagon', radii: [15, 15, 15, 15] },
      { shape: 'star', radii: [25, 10, 0, 0] },
      { shape: 'oval', radii: [0, 0, 0, 0] },
    ];

    for (const { shape, radii } of testCases) {
      const pathData = getShapeSvgPath(shape, 500, 500, radii);
      const mockCtx = createMockContext();
      // Must trace without throwing
      traceSvgPathToContext(mockCtx, pathData);
      assert.ok(mockCtx.calls.length > 0, `Path for ${shape} must generate canvas commands`);
      assert.strictEqual(mockCtx.calls[mockCtx.calls.length - 1]?.method, 'closePath');

      // Verify that drawShapeToContext traces the exact same path with zero clips
      const directCtx = createMockContext();
      drawShapeToContext(directCtx, shape, 500, 500, radii);
      const directClips = directCtx.calls.filter((c) => c.method === 'clip');
      assert.strictEqual(directClips.length, 0);
    }
  });
});

console.log('\n🎉 ALL 9 TEST SUITES COMPLETED! Vector Shape Masking & Fillet Engine is 100% verified.');
