import assert from 'node:assert';
import {
  SHAPE_PRESETS,
  createPolygonSvgPath,
  createStarSvgPath,
  createHeartSvgPath,
  createScallopSvgPath,
  getShapeSvgPath,
} from '../src/domain/shapes';
import { calculateMultiFrameResize, RectBounds } from '../src/domain/editor';

console.log('Testing Vector Shape Presets & Clipping Masks...');

// Test 1: Preset catalog
assert.strictEqual(SHAPE_PRESETS.length, 9);
const hexPreset = SHAPE_PRESETS.find((p) => p.id === 'hexagon');
assert.ok(hexPreset);
assert.strictEqual(hexPreset?.category, 'polygon');
console.log('✓ Preset catalog verified.');

// Test 2: Polygon SVG Path Generators
const hexPath = createPolygonSvgPath(6, 200, 200);
assert.ok(hexPath.startsWith('M'));
assert.ok(hexPath.endsWith('Z'));
assert.strictEqual(hexPath.split('L').length, 6); // 1 M + 5 L = 6 vertices

const octPath = createPolygonSvgPath(8, 200, 200);
assert.strictEqual(octPath.split('L').length, 8);
console.log('✓ Polygon (Hexagon/Octagon) paths verified.');

// Test 3: Star SVG Path Generator
const starPath = createStarSvgPath(5, 200, 200, 0.45);
assert.ok(starPath.startsWith('M'));
assert.ok(starPath.endsWith('Z'));
assert.strictEqual(starPath.split('L').length, 10); // 5 points * 2 vertices
console.log('✓ 5-point Star path verified.');

// Test 4: Heart & Scallop Paths
const heartPath = createHeartSvgPath(200, 200);
assert.ok(heartPath.includes('C'));
assert.ok(heartPath.trim().endsWith('Z'));

const scallopPath = createScallopSvgPath(200, 200, 8);
assert.ok(scallopPath.includes('Q'));
assert.ok(scallopPath.trim().endsWith('Z'));
console.log('✓ Heart and Scallop decorative paths verified.');

// Test 5: getShapeSvgPath for all types
assert.ok(getShapeSvgPath('rectangle', 100, 100).includes('L'));
assert.ok(getShapeSvgPath('circle', 100, 100).includes('A'));
assert.ok(getShapeSvgPath('oval', 150, 100).includes('A'));
assert.ok(getShapeSvgPath('rounded', 100, 100, [10, 10, 10, 10]).includes('Q'));
assert.strictEqual(getShapeSvgPath('custom_svg', 100, 100, [0, 0, 0, 0], 'M 10 10 Z'), 'M 10 10 Z');
console.log('✓ getShapeSvgPath unified generator verified.');

// Test 6: 2D Topological Resize Compatibility
// Ensure non-rectangular shapes (which use outer bounding boxes) maintain exact gap spacing
console.log('Testing 2D Topological Resize with Shape Frames...');
const frame1: RectBounds & { id: string } = { id: 'f1', x: 0, y: 0, width: 100, height: 100 };
const frame2: RectBounds & { id: string } = { id: 'f2', x: 120, y: 0, width: 100, height: 100 }; // 20mm gap
const initialFrames = [frame1, frame2];

// Resize selection wider
const resized = calculateMultiFrameResize(
  initialFrames,
  { x: 0, y: 0, width: 220, height: 100 }, // initialGroupBounds
  { x: 0, y: 0, width: 260, height: 120 }, // newGroupBounds
  'bottom-right',
  'fixed_gap'
);

// Gap must remain strictly 20 between frame1 right and frame2 left
const f1Resized = resized.find((f) => f.id === 'f1');
const f2Resized = resized.find((f) => f.id === 'f2');
const actualGap = f2Resized.geometry.x - (f1Resized.geometry.x + f1Resized.geometry.width);
assert.strictEqual(Math.round(actualGap * 100) / 100, 20);
console.log('✓ Topological gap preservation verified for multi-frame shapes!');

console.log('✓ All Shape Engine tests passed successfully!');
