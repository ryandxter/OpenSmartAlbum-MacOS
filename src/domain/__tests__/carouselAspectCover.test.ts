import { calculateImageOffset, calculateCoverDimensions } from '../editor';
import { useCarouselStore } from '../../stores/carouselStore';

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

console.log('🧪 Testing Carousel Aspect-Cover Fit and Zero-Stretch Invariants...\n');

// 1. Invariant: A 3:2 landscape photo (e.g. 6000x4000) inside a 4:5 portrait frame (1080x1350)
// MUST expand height to 1350, calculate width to 1350 * 1.5 = 2025, and center horizontally (negative offsetX).
{
  const photoAspect = 6000 / 4000; // 1.5
  const frameW = 1080;
  const frameH = 1350;

  const cover = calculateCoverDimensions(frameW, frameH, photoAspect, 1.0);
  assert.strictEqual(cover.height, 1350, 'Height must match frame height exactly');
  assert.strictEqual(cover.width, 2025, 'Width must scale proportionally to 2025');

  const offset = calculateImageOffset(frameW, frameH, photoAspect, 1.0, 0, 0);
  assert.strictEqual(offset.width, 2025);
  assert.strictEqual(offset.height, 1350);
  assert.strictEqual(offset.offsetX, -(2025 - 1080) / 2, 'Image must be horizontally centered');
  assert.strictEqual(offset.offsetY, 0, 'Image vertical offset must be 0');

  console.log('  ✔ [Landscape in Portrait Frame] 3:2 photo properly cover-fits 4:5 frame centered without stretch.');
}

// 2. Invariant: A 2:3 portrait photo (e.g. 4000x6000) inside a 1:1 square frame (1080x1080)
// MUST expand width to 1080, calculate height to 1080 / (2/3) = 1620, and center vertically (negative offsetY).
{
  const photoAspect = 4000 / 6000; // 0.6667
  const frameW = 1080;
  const frameH = 1080;

  const offset = calculateImageOffset(frameW, frameH, photoAspect, 1.0, 0, 0);
  assert.strictEqual(offset.width, 1080, 'Width matches frame width');
  assert(Math.abs(offset.height - 1620) < 0.1, 'Height must scale proportionally');
  assert.strictEqual(offset.offsetX, 0, 'Horizontal offset is 0');
  assert(Math.abs(offset.offsetY - (-270)) < 0.1, 'Image must be vertically centered');

  console.log('  ✔ [Portrait in Square Frame] 2:3 photo properly cover-fits 1:1 frame centered without stretch.');
}

// 3. Invariant: Shuffle slide photos resets crop coordinates so images re-center cleanly.
{
  const store = useCarouselStore.getState();
  store.initializeCarousel('test-aspect', '4:5', 3);

  // Add 2 frames with customized crops
  store.addPhotoFrame(0, {
    type: 'photo',
    photoId: 'p1',
    filePath: '/tmp/p1.jpg',
    fileName: 'p1.jpg',
    photoAspect: 1.5,
    x: 0,
    y: 0,
    width: 500,
    height: 500,
    cropX: 0.5,
    cropY: -0.5,
    cropScale: 1.8,
  });

  store.addPhotoFrame(0, {
    type: 'photo',
    photoId: 'p2',
    filePath: '/tmp/p2.jpg',
    fileName: 'p2.jpg',
    photoAspect: 0.67,
    x: 520,
    y: 0,
    width: 500,
    height: 500,
    cropX: -0.2,
    cropY: 0.3,
    cropScale: 1.4,
  });

  store.shuffleSlidePhotos(0);

  const carousel = useCarouselStore.getState().currentCarousel;
  assert(carousel && carousel.slides[0], 'Carousel slide 0 must exist');
  const updatedFrames = carousel.slides[0].elements;
  for (const f of updatedFrames) {
    if (f.type === 'photo') {
      assert.strictEqual(f.cropX, 0, 'cropX must be reset to 0 upon shuffle');
      assert.strictEqual(f.cropY, 0, 'cropY must be reset to 0 upon shuffle');
      assert.strictEqual(f.cropScale, 1.0, 'cropScale must be reset to 1.0 upon shuffle');
    }
  }

  console.log('  ✔ [Shuffle Re-centering] cropX, cropY, and cropScale cleanly reset to 0 and 1.0 upon shuffle.');
}

console.log('\n🎉 ALL CAROUSEL ASPECT COVER TESTS PASSED (100% GREEN)!\n');
