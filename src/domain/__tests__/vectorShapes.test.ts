/**
 * Automated Verification Suite for Vector Shape Masking & In-Shape Crop Engine
 * Covers Plan 09-01 requirements:
 * - Suite 1: SVG Path Generation & Validation (M/Z bounds for all presets)
 * - Suite 2: Geometric 1:1 Centering (Option A) Invariant on Asymmetrical Frames
 * - Suite 3: Canvas 2D Path Tracing & Zero-Clip Invariant
 * - Suite 4: SVG Path Parser Invariant (M, L, H, V, C, S, Q, T, A, Z)
 * - Suite 5: Multi-Mode Cohesion & Carousel Store Dispatch
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
} from '../shapes';
import { useCarouselStore } from '../../stores/carouselStore';

console.log('🧪 Starting Vector Shape Masking & In-Shape Crop Engine Tests...\n');

// ---------------------------------------------------------------------------
// Suite 1: SVG Path Generation & Validation
// ---------------------------------------------------------------------------
console.log('▶ Test Suite 1: SVG Path Generation & Validation');

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

// Verify direct generator functions and preset registry
assert.ok(createPolygonSvgPath(6, 400, 400).startsWith('M'), 'Hexagon direct generator must produce M path');
assert.ok(createPolygonSvgPath(8, 400, 400).startsWith('M'), 'Octagon direct generator must produce M path');
assert.ok(createStarSvgPath(5, 400, 400).startsWith('M'), 'Star direct generator must produce M path');
assert.ok(createHeartSvgPath(400, 400).startsWith('M'), 'Heart direct generator must produce M path');
assert.ok(createScallopSvgPath(400, 400, 8).startsWith('M'), 'Scallop direct generator must produce M path');
assert.strictEqual(SHAPE_PRESETS.length, 9, 'SHAPE_PRESETS must register all 9 standard presets');

console.log('  ✔ All 10 shape types generate well-formed SVG paths starting with M and ending with Z.\n');

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

// ---------------------------------------------------------------------------
// Suite 2: Geometric 1:1 Centering (Option A) Invariant
// ---------------------------------------------------------------------------
console.log('▶ Test Suite 2: Geometric 1:1 Centering (Option A) Invariant');

const nonRectShapes: ShapeType[] = ['circle', 'hexagon', 'octagon', 'star', 'scallop', 'heart'];

// Test Case 2A: Landscape Frame (800x400) -> size=400, offsetX=200, offsetY=0
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

// Test Case 2B: Portrait Frame (300x600) -> size=300, offsetX=0, offsetY=150
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

console.log('  ✔ Non-rectangular shapes strictly enforce Option A (1:1 Centered) across asymmetrical frames.\n');

// ---------------------------------------------------------------------------
// Suite 3: Canvas 2D Path Tracing & Zero-Clip Invariant
// ---------------------------------------------------------------------------
console.log('▶ Test Suite 3: Canvas 2D Path Tracing & Zero-Clip Invariant');

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

console.log('  ✔ All shapes trace cleanly onto Canvas2D context with zero premature c.clip() calls.\n');

// ---------------------------------------------------------------------------
// Suite 4: SVG Path Parser Invariant
// ---------------------------------------------------------------------------
console.log('▶ Test Suite 4: SVG Path Parser Invariant (traceSvgPathToContext)');

// Test 4A: Basic M, L, H, V, Z
{
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
}

// Test 4B: Relative commands and negative coordinates without whitespace
{
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
}

// Test 4C: Smooth Cubic Beziers (C, S)
{
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
}

// Test 4D: Smooth Quadratic Beziers (Q, T)
{
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
}

// Test 4E: Elliptical Arc (A)
{
  const mockCtx = createMockContext();
  traceSvgPathToContext(mockCtx, 'M 0 0 A 25 25 0 0 0 50 0 Z');

  assert.strictEqual(mockCtx.calls[0]?.method, 'moveTo');
  // Arc is decomposed into cubic beziers
  const beziers = mockCtx.calls.filter((c) => c.method === 'bezierCurveTo');
  assert.ok(beziers.length >= 1, 'Arc command must be decomposed into bezierCurveTo segments');
  assert.strictEqual(mockCtx.calls[mockCtx.calls.length - 1]?.method, 'closePath');
}

console.log('  ✔ SVG Path Parser handles M, L, H, V, C, S, Q, T, A, Z and coordinate chaining.\n');

// ---------------------------------------------------------------------------
// Suite 5: Multi-Mode Cohesion & Carousel Store Dispatch
// ---------------------------------------------------------------------------
console.log('▶ Test Suite 5: Multi-Mode Cohesion & Carousel Store Dispatch');

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

const updatedFrame = useCarouselStore.getState().currentCarousel?.slides[0]?.elements[0];
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

console.log('  ✔ Carousel store correctly holds selectedFrameId, updates vector shapes/borders, and deselects on removal.\n');

console.log('🎉 ALL 5 TEST SUITES PASSED! Vector Shape Masking Engine is 100% verified.');
