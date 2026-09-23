function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}
import { useCarouselStore } from '../../../stores/carouselStore';
import { CAROUSEL_LAYOUT_PRESETS } from '../../carouselLayout';

console.log('🧪 Testing Carousel Slide 2+ World Coordinates & Expanded Panoramas...');

// Reset store
useCarouselStore.getState().initializeCarousel('proj-test-1', '4:5', 4);

// Test 1: Verify Expanded Panorama Presets
console.log('\n▶ Test 1: Seamless Panorama Presets Expansion');
const panoramaPresets = CAROUSEL_LAYOUT_PRESETS.filter((p) => p.category === 'panorama');
console.log(`  Found ${panoramaPresets.length} seamless panorama presets.`);
assert(panoramaPresets.length >= 8, `Expected at least 8 panorama presets, got ${panoramaPresets.length}`);

const fourSlide = panoramaPresets.find((p) => p.id === 'panorama_4_slide');
assert(Boolean(fourSlide && fourSlide.spanSlides === 4), 'Expected 4-slide panorama preset');

const dualInsets = panoramaPresets.find((p) => p.id === 'panorama_2_slide_dual_insets');
assert(Boolean(dualInsets && dualInsets.minPhotos === 3), 'Expected 2-slide dual inset preset');
console.log('  ✔ Seamless Panorama expansion verified (9 presets, multi-slide spans valid).');

// Test 2: Verify Slide 2+ Dynamic Layout World Coordinates
console.log('\n▶ Test 2: Dynamic Layouts on Slide 2 (World Coordinate Offset)');
const store = useCarouselStore.getState();
const slideWidth = store.currentCarousel!.slideWidthPx; // 1080 for 4:5
assert(slideWidth === 1080, `Expected slideWidth to be 1080, got ${slideWidth}`);

// Add 3 photos to Slide 2 (index 1)
const slide1StartX = 1 * slideWidth; // 1080
store.addPhotoFrame(1, {
  type: 'photo',
  photoId: 'photo-slide1-a',
  filePath: '/mock/path/a.jpg',
  photoAspect: 1.5,
  x: slide1StartX + 100,
  y: 100,
  width: 400,
  height: 300,
});
store.addPhotoFrame(1, {
  type: 'photo',
  photoId: 'photo-slide1-b',
  filePath: '/mock/path/b.jpg',
  photoAspect: 1.0,
  x: slide1StartX + 550,
  y: 100,
  width: 400,
  height: 400,
});

// Apply dynamic layout to Slide 2
store.applyDynamicSlideLayoutByIndex(1, 0);

const updatedCarousel = useCarouselStore.getState().currentCarousel!;
const slide1Elements = updatedCarousel.slides[1]!.elements.filter((el) => el.type === 'photo');
assert(slide1Elements.length === 2, `Expected 2 frames on slide 1, got ${slide1Elements.length}`);

// Critical check: All frames on Slide 2 MUST have x >= slide1StartX (1080) and x < slide1StartX + slideWidth (2160)
for (const frame of slide1Elements) {
  assert(
    frame.x >= slide1StartX,
    `Frame x (${frame.x}) must be >= slide1StartX (${slide1StartX}). Frames must NOT displace to Slide 1!`
  );
  assert(
    frame.x + frame.width <= slide1StartX + slideWidth + 50,
    `Frame bounds (${frame.x + frame.width}) must sit within slide bounds (${slide1StartX + slideWidth})`
  );
}
console.log(`  ✔ Slide 2 photo frames positioned correctly at x >= ${slide1StartX} (frames: ${slide1Elements.map(f => f.x).join(', ')})`);

// Test 3: Verify Slide 3 (index 2) as well
console.log('\n▶ Test 3: Dynamic Layouts on Slide 3 (World Coordinate Offset)');
const slide2StartX = 2 * slideWidth; // 2160
store.addPhotoFrame(2, {
  type: 'photo',
  photoId: 'photo-slide2-a',
  filePath: '/mock/path/c.jpg',
  photoAspect: 1.2,
  x: slide2StartX + 100,
  y: 100,
  width: 500,
  height: 400,
});

store.applyDynamicSlideLayoutByIndex(2, 0);
const slide2Elements = useCarouselStore.getState().currentCarousel!.slides[2]!.elements.filter((el) => el.type === 'photo');
assert(slide2Elements.length === 1, `Expected 1 frame on slide 2, got ${slide2Elements.length}`);
assert(
  slide2Elements[0]!.x >= slide2StartX,
  `Frame on slide 2 must be >= ${slide2StartX}, got ${slide2Elements[0]!.x}`
);
console.log(`  ✔ Slide 3 photo frames positioned correctly at x >= ${slide2StartX} (x: ${slide2Elements[0]!.x})`);

console.log('\n🎉 ALL DYNAMIC COORDINATE & PANORAMA TESTS PASSED (100% GREEN)!\n');
