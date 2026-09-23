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

import { generateDynamicVariations } from '../layout/generator';
import { useCarouselStore } from '../../stores/carouselStore';
import { AdaptivePhoto } from '../adaptiveLayout';

console.log('🧪 Starting Plan 10-02: Carousel Generative Layout & Non-Destructive Cycling Verification...\n');

// Suite 1: Single slide generative variations generate strictly N slots for N photos
{
  console.log('Running Suite 1: Single slide generative variations strictly generate N slots...');
  const counts = [1, 2, 3, 4, 5, 7, 10, 12];
  const slideW = 1080;
  const slideH = 1080;

  for (const count of counts) {
    const mockPhotos: AdaptivePhoto[] = Array.from({ length: count }, (_, i) => ({
      id: `photo-${i + 1}`,
      photoId: `pid-${i + 1}`,
      filePath: `/photos/img_${i + 1}.jpg`,
      photoAspect: i % 2 === 0 ? 1.5 : 0.67,
    }));

    const variations = generateDynamicVariations(
      {
        containerWidth: slideW,
        containerHeight: slideH,
        spacing: 16,
        isSpread: false,
      },
      mockPhotos
    );

    assert.ok(variations.length > 0, `Must generate at least 1 variation for ${count} photos`);

    for (const variation of variations) {
      assert.strictEqual(
        variation.rects.length,
        count,
        `Variation ${variation.name} must contain strictly ${count} rects for ${count} photos`
      );

      for (const rect of variation.rects) {
        assert.ok(rect.x >= -0.5, `Rect x must be non-negative: ${rect.x}`);
        assert.ok(rect.y >= -0.5, `Rect y must be non-negative: ${rect.y}`);
        assert.ok(
          rect.x + rect.width <= slideW + 0.5,
          `Rect right must not exceed slide width: ${rect.x + rect.width} > ${slideW}`
        );
        assert.ok(
          rect.y + rect.height <= slideH + 0.5,
          `Rect bottom must not exceed slide height: ${rect.y + rect.height} > ${slideH}`
        );
      }
    }
  }
  console.log('  ✅ Suite 1 Passed: Single slide variations valid for all N in [1..12]');
}

// Suite 2: Non-Destructive Cycle Invariant - Zero-Loss and Zero-Blank guarantees across 50 cycles
{
  console.log('\nRunning Suite 2: Non-Destructive Cycle Invariant across 50 cycles...');
  const store = useCarouselStore.getState();
  store.initializeCarousel('proj-test-1', '1:1', 3);

  const initialPhotoIds = ['p-alpha', 'p-beta', 'p-gamma', 'p-delta', 'p-epsilon'];
  const initialFilePaths = [
    '/images/wedding_01.jpg',
    '/images/wedding_02.jpg',
    '/images/wedding_03.jpg',
    '/images/wedding_04.jpg',
    '/images/wedding_05.jpg',
  ];

  // Add 5 photos onto slide index 0
  for (let i = 0; i < initialPhotoIds.length; i++) {
    store.addPhotoFrame(0, {
      type: 'photo',
      photoId: initialPhotoIds[i],
      filePath: initialFilePaths[i],
      fileName: `wedding_0${i + 1}.jpg`,
      photoAspect: 1.5,
      x: i * 100,
      y: i * 50,
      width: 200,
      height: 200,
    });
  }

  // Verify 5 photos exist initially
  const state0 = useCarouselStore.getState();
  const slide0 = state0.currentCarousel?.slides[0];
  assert.ok(slide0, 'Slide 0 must exist');
  assert.strictEqual(slide0.elements.length, 5);

  // Run 50 consecutive cycles (simulating Spacebar cycling)
  for (let cycle = 1; cycle <= 50; cycle++) {
    useCarouselStore.getState().cycleSlideLayout('next');

    const currentState = useCarouselStore.getState();
    const currentSlide = currentState.currentCarousel?.slides[0];
    assert.ok(currentSlide, `Slide must exist on cycle ${cycle}`);

    const photoFrames = currentSlide.elements.filter((el) => el.type === 'photo');

    // 1. Zero-Loss Invariant: Count must remain exactly 5
    assert.strictEqual(
      photoFrames.length,
      5,
      `Cycle ${cycle}: Must preserve all 5 photos without dropping any`
    );

    // 2. Zero-Blank Invariant: Every photo must have non-empty filePath
    for (const frame of photoFrames) {
      assert.ok(
        frame.filePath && frame.filePath.length > 0,
        `Cycle ${cycle}: Photo frame must have non-empty filePath, got: '${frame.filePath}'`
      );
      assert.ok(
        frame.width > 20 && frame.height > 20,
        `Cycle ${cycle}: Frame dimensions must be valid: ${frame.width}x${frame.height}`
      );
    }

    // 3. Photo Pool Preservation: All initial photoIds must still be present
    const currentPhotoIds = new Set(photoFrames.map((f) => f.photoId));
    for (const id of initialPhotoIds) {
      assert.ok(
        currentPhotoIds.has(id),
        `Cycle ${cycle}: PhotoId ${id} must still exist on slide (Zero-Loss invariant)`
      );
    }
  }
  console.log('  ✅ Suite 2 Passed: 50 consecutive cycles preserved zero-loss and zero-blank guarantees');
}

// Suite 3: Ratio switching (1:1 -> 4:5 -> 9:16) recalculates dynamic bounds cleanly
{
  console.log('\nRunning Suite 3: Ratio switching dynamic bounds recalculation...');
  const store = useCarouselStore.getState();
  store.initializeCarousel('proj-test-2', '1:1', 1);

  store.addPhotoFrame(0, {
    type: 'photo',
    photoId: 'p1',
    filePath: '/img/1.jpg',
    photoAspect: 1.0,
    x: 0,
    y: 0,
    width: 500,
    height: 500,
  });
  store.addPhotoFrame(0, {
    type: 'photo',
    photoId: 'p2',
    filePath: '/img/2.jpg',
    photoAspect: 1.5,
    x: 520,
    y: 0,
    width: 500,
    height: 500,
  });

  // Switch to 4:5 (1080 x 1350)
  store.setRatio('4:5');
  const state45 = useCarouselStore.getState();
  assert.strictEqual(state45.currentCarousel?.slideWidthPx, 1080);
  assert.strictEqual(state45.currentCarousel?.slideHeightPx, 1350);

  // Apply dynamic layout variation
  store.applyDynamicSlideLayoutByIndex(0, 0);
  const slide45 = useCarouselStore.getState().currentCarousel?.slides[0];
  const frames45 = slide45?.elements.filter((el) => el.type === 'photo') || [];
  assert.strictEqual(frames45.length, 2);
  for (const f of frames45) {
    assert.ok(f.x + f.width <= 1080 + 0.5);
    assert.ok(f.y + f.height <= 1350 + 0.5);
    assert.ok(Boolean(f.filePath));
  }

  // Switch to 9:16 (1080 x 1920)
  store.setRatio('9:16');
  const state916 = useCarouselStore.getState();
  assert.strictEqual(state916.currentCarousel?.slideWidthPx, 1080);
  assert.strictEqual(state916.currentCarousel?.slideHeightPx, 1920);

  store.applyDynamicSlideLayoutByIndex(0, 1);
  const slide916 = useCarouselStore.getState().currentCarousel?.slides[0];
  const frames916 = slide916?.elements.filter((el) => el.type === 'photo') || [];
  assert.strictEqual(frames916.length, 2);
  for (const f of frames916) {
    assert.ok(f.x + f.width <= 1080 + 0.5);
    assert.ok(f.y + f.height <= 1920 + 0.5);
    assert.ok(Boolean(f.filePath));
  }
  console.log('  ✅ Suite 3 Passed: Dynamic bounds correctly computed for 1:1, 4:5, and 9:16 ratios');
}

console.log('\n🎉 All Plan 10-02 Carousel Generative Layout tests passed successfully!\n');
