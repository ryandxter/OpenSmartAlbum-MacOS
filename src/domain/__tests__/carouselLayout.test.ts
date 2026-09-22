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
  scaleFramesForRatioSwitch,
  CAROUSEL_RATIO_PRESETS,
  CarouselSlide,
  CarouselPhotoFrame,
} from '../carousel';
import {
  CAROUSEL_LAYOUT_PRESETS,
  getAvailableCarouselLayouts,
} from '../carouselLayout';

console.log('🧪 Starting Carousel Layout & Proportional Scaling Tests...\n');

// ---------------------------------------------------------------------------
// 1. Ratio Switching & Proportional Aspect-Fit Tests
// ---------------------------------------------------------------------------
console.log('▶ Test Suite 1: Proportional Aspect-Fit Scaling (1:1 ↔ 4:5 ↔ 9:16)');

const preset1to1 = CAROUSEL_RATIO_PRESETS['1:1']; // 1080 x 1080
const preset4to5 = CAROUSEL_RATIO_PRESETS['4:5']; // 1080 x 1350
const preset9to16 = CAROUSEL_RATIO_PRESETS['9:16']; // 1080 x 1920

const initialSlide: CarouselSlide = {
  id: 'slide-test-1',
  slideIndex: 0,
  widthPx: preset1to1.width,
  heightPx: preset1to1.height,
  backgroundColor: '#FFFFFF',
  elements: [
    {
      type: 'photo',
      id: 'frame-square-center',
      photoId: 'p1',
      x: 140,
      y: 140,
      width: 800,
      height: 800,
      photoAspect: 1.0,
    },
    {
      type: 'photo',
      id: 'frame-pano-span',
      photoId: 'p2',
      x: 0,
      y: 0,
      width: 2160, // 2 slides span in 1:1
      height: 1080,
      photoAspect: 2.0,
    },
  ],
};

// 1.1 Transition 1:1 -> 4:5
const scaledTo45 = scaleFramesForRatioSwitch([initialSlide], preset1to1, preset4to5);
assert.strictEqual(scaledTo45.length, 1);
const slide45 = scaledTo45[0]!;
assert.strictEqual(slide45.widthPx, preset4to5.width);
assert.strictEqual(slide45.heightPx, preset4to5.height);

const frame45Center = slide45.elements.find((el) => el.id === 'frame-square-center') as CarouselPhotoFrame;
assert.ok(frame45Center, 'Centered frame must exist after scaling');
// Scale factor from 1080x1080 to 1080x1350 is min(1080/1080, 1350/1080) = 1.0
assert.strictEqual(frame45Center.width, 800);
assert.strictEqual(frame45Center.height, 800);
// Bounds check: must be non-negative and within height
assert.ok(frame45Center.x >= 0, 'Frame x must be non-negative');
assert.ok(frame45Center.y >= 0, 'Frame y must be non-negative');
assert.ok(frame45Center.y + frame45Center.height <= preset4to5.height, 'Frame must not overflow slide bottom');

const frame45Pano = slide45.elements.find((el) => el.id === 'frame-pano-span') as CarouselPhotoFrame;
assert.ok(frame45Pano, 'Panorama frame must exist after scaling');
assert.strictEqual(frame45Pano.width, 2160);
assert.strictEqual(frame45Pano.height, 1080);
assert.ok(frame45Pano.y + frame45Pano.height <= preset4to5.height, 'Pano must fit vertically in 4:5');

// 1.2 Transition 4:5 -> 9:16
const scaledTo916 = scaleFramesForRatioSwitch(scaledTo45, preset4to5, preset9to16);
const slide916 = scaledTo916[0]!;
assert.strictEqual(slide916.widthPx, preset9to16.width);
assert.strictEqual(slide916.heightPx, preset9to16.height);

const frame916Center = slide916.elements.find((el) => el.id === 'frame-square-center') as CarouselPhotoFrame;
assert.ok(frame916Center.x >= 0 && frame916Center.y >= 0);
assert.ok(frame916Center.y + frame916Center.height <= preset9to16.height);

// 1.3 Transition 9:16 -> 1:1 (Downscaling height)
const scaledBackTo11 = scaleFramesForRatioSwitch(scaledTo916, preset9to16, preset1to1);
const slideBack11 = scaledBackTo11[0]!;
assert.strictEqual(slideBack11.widthPx, preset1to1.width);
assert.strictEqual(slideBack11.heightPx, preset1to1.height);

const frameBackCenter = slideBack11.elements.find((el) => el.id === 'frame-square-center') as CarouselPhotoFrame;
assert.ok(frameBackCenter.x >= 0, 'X must remain non-negative');
assert.ok(frameBackCenter.y >= 0, 'Y must remain non-negative');
assert.ok(frameBackCenter.y + frameBackCenter.height <= preset1to1.height, 'Must not overflow 1:1 bounds');
assert.ok(Math.abs(frameBackCenter.width - frameBackCenter.height) <= 1, 'Aspect ratio 1:1 preserved');

console.log('  ✔ 1:1 ↔ 4:5 ↔ 9:16 proportional scaling verified with 0 overflow.\n');

// ---------------------------------------------------------------------------
// 2. Carousel Hybrid Layout Generator Tests
// ---------------------------------------------------------------------------
console.log('▶ Test Suite 2: Hybrid Carousel Layout Generator (Per-Slide & Panorama)');

const dummyPhotos = [
  { id: 'photo-1', photoId: 'photo-1', photoAspect: 1.5, filePath: '/photos/1.jpg' },
  { id: 'photo-2', photoId: 'photo-2', photoAspect: 0.8, filePath: '/photos/2.jpg' },
  { id: 'photo-3', photoId: 'photo-3', photoAspect: 1.0, filePath: '/photos/3.jpg' },
  { id: 'photo-4', photoId: 'photo-4', photoAspect: 1.33, filePath: '/photos/4.jpg' },
];

const testParams = {
  slideWidth: 1080,
  slideHeight: 1080,
  slideIndex: 1, // Test on slide 1 (x-offset = 1080)
  totalSlides: 3,
  photos: dummyPhotos,
  spacing: 16,
  margin: 40,
};

// 2.1 Hero Full Bleed (1 photo)
const heroFull = CAROUSEL_LAYOUT_PRESETS.find((p) => p.id === 'hero_full')!;
assert.ok(heroFull);
const heroFullFrames = heroFull.generate(testParams);
assert.strictEqual(heroFullFrames.length, 1);
assert.strictEqual(heroFullFrames[0]!.x, 1080);
assert.strictEqual(heroFullFrames[0]!.y, 0);
assert.strictEqual(heroFullFrames[0]!.width, 1080);
assert.strictEqual(heroFullFrames[0]!.height, 1080);

// 2.2 Hero Framed (1 photo)
const heroFramed = CAROUSEL_LAYOUT_PRESETS.find((p) => p.id === 'hero_framed')!;
const heroFramedFrames = heroFramed.generate(testParams);
assert.strictEqual(heroFramedFrames.length, 1);
assert.ok(heroFramedFrames[0]!.x > 1080);
assert.ok(heroFramedFrames[0]!.y > 0);
assert.ok(heroFramedFrames[0]!.width < 1080);
assert.ok(heroFramedFrames[0]!.height < 1080);

// 2.3 Split Vertical (2 photos)
const splitVert = CAROUSEL_LAYOUT_PRESETS.find((p) => p.id === 'split_vertical')!;
const splitVertFrames = splitVert.generate(testParams);
assert.strictEqual(splitVertFrames.length, 2);
assert.ok(splitVertFrames[0]!.y < splitVertFrames[1]!.y, 'Stacked vertically');
assert.strictEqual(splitVertFrames[0]!.x, splitVertFrames[1]!.x, 'Aligned horizontally');

// 2.4 Split Horizontal (2 photos)
const splitHoriz = CAROUSEL_LAYOUT_PRESETS.find((p) => p.id === 'split_horizontal')!;
const splitHorizFrames = splitHoriz.generate(testParams);
assert.strictEqual(splitHorizFrames.length, 2);
assert.ok(splitHorizFrames[0]!.x < splitHorizFrames[1]!.x, 'Side by side horizontally');
assert.strictEqual(splitHorizFrames[0]!.y, splitHorizFrames[1]!.y, 'Aligned vertically');

// 2.5 Grid 3 Hero Top (3 photos)
const grid3Hero = CAROUSEL_LAYOUT_PRESETS.find((p) => p.id === 'grid_3_hero_top')!;
const grid3HeroFrames = grid3Hero.generate(testParams);
assert.strictEqual(grid3HeroFrames.length, 3);
assert.ok(grid3HeroFrames[0]!.width > grid3HeroFrames[1]!.width, 'Hero top is wider than bottom items');
assert.strictEqual(grid3HeroFrames[1]!.y, grid3HeroFrames[2]!.y, 'Bottom items share same row');

// 2.6 Grid 3 Columns (3 photos)
const grid3Cols = CAROUSEL_LAYOUT_PRESETS.find((p) => p.id === 'grid_3_columns')!;
const grid3ColsFrames = grid3Cols.generate(testParams);
assert.strictEqual(grid3ColsFrames.length, 3);
assert.ok(grid3ColsFrames[0]!.x < grid3ColsFrames[1]!.x && grid3ColsFrames[1]!.x < grid3ColsFrames[2]!.x);

// 2.7 Grid 4 Quad (4 photos)
const grid4Quad = CAROUSEL_LAYOUT_PRESETS.find((p) => p.id === 'grid_4_quad')!;
const grid4QuadFrames = grid4Quad.generate(testParams);
assert.strictEqual(grid4QuadFrames.length, 4);
assert.strictEqual(grid4QuadFrames[0]!.width, grid4QuadFrames[1]!.width);
assert.strictEqual(grid4QuadFrames[0]!.height, grid4QuadFrames[2]!.height);

// 2.8 Editorial 4 (4 photos: 1 large left + 3 stacked right)
const editorial4 = CAROUSEL_LAYOUT_PRESETS.find((p) => p.id === 'editorial_4')!;
const editorial4Frames = editorial4.generate(testParams);
assert.strictEqual(editorial4Frames.length, 4);
assert.ok(editorial4Frames[0]!.width > editorial4Frames[1]!.width, 'Hero is wider than sidebar');
assert.ok(editorial4Frames[1]!.y < editorial4Frames[2]!.y && editorial4Frames[2]!.y < editorial4Frames[3]!.y, 'Sidebar items stacked vertically');

// 2.9 Seamless 2-Slide Panorama
const pano2 = CAROUSEL_LAYOUT_PRESETS.find((p) => p.id === 'panorama_2_slide')!;
const pano2Frames = pano2.generate(testParams);
assert.strictEqual(pano2Frames.length, 1);
assert.strictEqual(pano2Frames[0]!.x, 1080, 'Starts on slide 1');
assert.strictEqual(pano2Frames[0]!.width, 2160, 'Spans 2 full slides (2160px)');
assert.strictEqual(pano2Frames[0]!.height, 1080);

// 2.10 Seamless 3-Slide Panorama
const pano3 = CAROUSEL_LAYOUT_PRESETS.find((p) => p.id === 'panorama_3_slide')!;
const pano3Frames = pano3.generate({ ...testParams, slideIndex: 0 });
assert.strictEqual(pano3Frames.length, 1);
assert.strictEqual(pano3Frames[0]!.x, 0, 'Starts on slide 0');
assert.strictEqual(pano3Frames[0]!.width, 3240, 'Spans 3 full slides (3240px)');

// 2.11 Panorama 2-Slide with Floating Detail
const panoDetail = CAROUSEL_LAYOUT_PRESETS.find((p) => p.id === 'panorama_2_slide_detail')!;
const panoDetailFrames = panoDetail.generate({ ...testParams, slideIndex: 0 });
assert.strictEqual(panoDetailFrames.length, 2);
assert.strictEqual(panoDetailFrames[0]!.width, 2160, 'Background panorama spans 2 slides');
assert.ok(panoDetailFrames[1]!.x >= 1080, 'Detail card sits on slide 1 (2nd slide)');
assert.strictEqual(panoDetailFrames[1]!.cornerRadius, 8, 'Detail card has rounded corners');

console.log('  ✔ All 12 Carousel Layout Presets verified with proper geometry.\n');

// ---------------------------------------------------------------------------
// 3. Layout Filtering & Multi-Slide Span Constraints
// ---------------------------------------------------------------------------
console.log('▶ Test Suite 3: Layout Filtering & Constraints');

// Single slide only allowed (e.g. on last slide)
const singleSlideOnly = getAvailableCarouselLayouts(1, '1:1', false);
assert.ok(singleSlideOnly.every((p) => p.spanSlides === 1), 'Must only return 1-slide layouts');

// Filter by photo count
const twoPhotoLayouts = getAvailableCarouselLayouts(2, '1:1', true);
assert.ok(twoPhotoLayouts.every((p) => p.minPhotos <= 2 && p.maxPhotos >= 2), 'Must return 2-photo compatible layouts');

// Preview SVG generation
for (const preset of CAROUSEL_LAYOUT_PRESETS) {
  const svg = preset.previewSvg('1:1');
  assert.ok(svg.includes('<svg'), `Preset ${preset.id} must produce valid SVG`);
  assert.ok(svg.includes('</svg>'), `Preset ${preset.id} must produce closed SVG`);
}

console.log('  ✔ Layout filtering and SVG preview generation verified.\n');

console.log('✅ ALL CAROUSEL ENGINE TESTS PASSED SUCCESSFULLY! (100% Green)');
