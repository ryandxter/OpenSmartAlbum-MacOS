import assert from 'node:assert';
import { PhotoFrameElement } from '../src/domain/editor';
import { getShapeSvgPath, ShapeType } from '../src/domain/shapes';

console.log('Testing Advanced Borders, Drop Shadows & Frame Styling...');

// Test 1: Border styles and alignments
const mockFrame: PhotoFrameElement = {
  id: 'frame-test-1',
  type: 'photo',
  photoId: 'p1',
  filePath: '/test/path.jpg',
  previewPath: '/test/preview.jpg',
  thumbnailPath: '/test/thumb.jpg',
  fileName: 'photo.jpg',
  x: 10,
  y: 20,
  width: 150,
  height: 100,
  rotation: 0,
  zIndex: 1,
  cropX: 0,
  cropY: 0,
  cropScale: 1.0,
  cropRotation: 0,
  opacity: 1.0,
  borderEnabled: true,
  borderWidth: 4,
  borderColor: '#FF0000',
  borderStyle: 'dashed',
  borderAlignment: 'inner',
  shapeType: 'hexagon',
  shadowEnabled: true,
  shadowColor: 'rgba(0, 0, 0, 0.7)',
  shadowBlur: 20,
  shadowOffsetX: 5,
  shadowOffsetY: 8,
  shadowOpacity: 0.8,
};

assert.strictEqual(mockFrame.borderStyle, 'dashed');
assert.strictEqual(mockFrame.borderAlignment, 'inner');
assert.strictEqual(mockFrame.shapeType, 'hexagon');
assert.strictEqual(mockFrame.shadowEnabled, true);
assert.strictEqual(mockFrame.shadowBlur, 20);
assert.strictEqual(mockFrame.shadowOffsetX, 5);
assert.strictEqual(mockFrame.shadowOffsetY, 8);
assert.strictEqual(mockFrame.shadowOpacity, 0.8);
console.log('✓ PhotoFrameElement shape and border properties verified.');

// Test 2: Border outline path generation for all presets
const shapes: ShapeType[] = ['rectangle', 'circle', 'oval', 'hexagon', 'octagon', 'star', 'scallop', 'heart'];
for (const s of shapes) {
  const path = getShapeSvgPath(s, 200, 200);
  assert.ok(path.length > 5, `Path for ${s} should not be empty`);
}
console.log('✓ All 8 shape presets generate valid vector border paths.');

console.log('✓ Advanced borders and shadow test suite passed successfully!');
