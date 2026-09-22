import assert from 'node:assert';
import {
  createInitialCarousel,
  createCarouselSlide,
  getCarouselTotalWidth,
  getSlideXOffset,
  getSlideIndexAtX,
  CAROUSEL_RATIO_PRESETS,
  MAX_CAROUSEL_SLIDES,
  MIN_CAROUSEL_SLIDES,
} from '../src/domain/carousel';
import { useCarouselStore } from '../src/stores/carouselStore';

console.log('Testing Carousel Domain & Store...');

// Test 1: Presets
assert.strictEqual(CAROUSEL_RATIO_PRESETS['1:1'].width, 1080);
assert.strictEqual(CAROUSEL_RATIO_PRESETS['1:1'].height, 1080);
assert.strictEqual(CAROUSEL_RATIO_PRESETS['4:5'].width, 1080);
assert.strictEqual(CAROUSEL_RATIO_PRESETS['4:5'].height, 1350);
assert.strictEqual(CAROUSEL_RATIO_PRESETS['9:16'].width, 1080);
assert.strictEqual(CAROUSEL_RATIO_PRESETS['9:16'].height, 1920);
console.log('✓ Carousel ratio presets verified.');

// Test 2: Initial Carousel Creation
const c1 = createInitialCarousel('test-project-1', '1:1', 3);
assert.strictEqual(c1.projectId, 'test-project-1');
assert.strictEqual(c1.ratio, '1:1');
assert.strictEqual(c1.slideWidthPx, 1080);
assert.strictEqual(c1.slideHeightPx, 1080);
assert.strictEqual(c1.slides.length, 3);
assert.strictEqual(c1.totalSlides, 3);
assert.strictEqual(c1.slides[0].slideIndex, 0);
assert.strictEqual(c1.slides[1].slideIndex, 1);
assert.strictEqual(c1.slides[2].slideIndex, 2);
console.log('✓ createInitialCarousel verified.');

// Test 3: Total Width & Offsets
assert.strictEqual(getCarouselTotalWidth(c1), 3240); // 3 * 1080
assert.strictEqual(getSlideXOffset(c1, 0), 0);
assert.strictEqual(getSlideXOffset(c1, 1), 1080);
assert.strictEqual(getSlideXOffset(c1, 2), 2160);

assert.strictEqual(getSlideIndexAtX(c1, 500), 0);
assert.strictEqual(getSlideIndexAtX(c1, 1080), 1);
assert.strictEqual(getSlideIndexAtX(c1, 1500), 1);
assert.strictEqual(getSlideIndexAtX(c1, 2500), 2);
assert.strictEqual(getSlideIndexAtX(c1, 9999), 2); // clamped
console.log('✓ Continuous stage offset and index math verified.');

// Test 4: Dynamic Slide Creation
const s4 = createCarouselSlide(c1, '#112233');
assert.strictEqual(s4.slideIndex, 3);
assert.strictEqual(s4.widthPx, 1080);
assert.strictEqual(s4.heightPx, 1080);
assert.strictEqual(s4.backgroundColor, '#112233');
console.log('✓ createCarouselSlide verified.');

// Test 5: Carousel Zustand Store Lifecycle
const store = useCarouselStore.getState();
store.initializeCarousel('proj-store-1', '4:5', 2);
const initial = useCarouselStore.getState().currentCarousel;
assert.ok(initial);
assert.strictEqual(initial?.ratio, '4:5');
assert.strictEqual(initial?.slideHeightPx, 1350);
assert.strictEqual(initial?.slides.length, 2);
assert.strictEqual(useCarouselStore.getState().activeSlideIndex, 0);

// Add slide
store.addSlide('#FAFAFA');
assert.strictEqual(useCarouselStore.getState().currentCarousel?.slides.length, 3);
assert.strictEqual(useCarouselStore.getState().activeSlideIndex, 2);

// Ratio Change
store.setRatio('9:16');
const updatedRatio = useCarouselStore.getState().currentCarousel;
assert.strictEqual(updatedRatio?.ratio, '9:16');
assert.strictEqual(updatedRatio?.slideHeightPx, 1920);
assert.strictEqual(updatedRatio?.slides[0].heightPx, 1920);

// Duplicate Slide
store.duplicateSlide(0);
assert.strictEqual(useCarouselStore.getState().currentCarousel?.slides.length, 4);

// Reorder Slide
store.reorderSlide(0, 2);
assert.strictEqual(useCarouselStore.getState().activeSlideIndex, 2);

// Delete Slide
store.deleteSlide(0);
assert.strictEqual(useCarouselStore.getState().currentCarousel?.slides.length, 3);

// Max slide constraint (10)
for (let i = 0; i < 15; i++) {
  useCarouselStore.getState().addSlide();
}
assert.strictEqual(useCarouselStore.getState().currentCarousel?.slides.length, MAX_CAROUSEL_SLIDES);

// Min slide constraint (1)
for (let i = 0; i < 15; i++) {
  useCarouselStore.getState().deleteSlide(0);
}
assert.strictEqual(useCarouselStore.getState().currentCarousel?.slides.length, MIN_CAROUSEL_SLIDES);

// Guide toggle
const initialGuides = useCarouselStore.getState().showSliceGuides;
store.toggleSliceGuides();
assert.strictEqual(useCarouselStore.getState().showSliceGuides, !initialGuides);

console.log('✓ All Carousel domain and store tests passed successfully!');
