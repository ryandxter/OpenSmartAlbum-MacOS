import {
  extractCanvasDividers,
  findPhotoSwapTarget,
  RectFrameInput,
} from '../dividerGraph';
import { useCarouselStore } from '../../../stores/carouselStore';
import { createInitialCarousel, CarouselPhotoFrame } from '../../carousel';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('🧪 Starting Plan 13-01: Divider Graph & Adjacency Engine Tests...');

// Suite 1: Two side-by-side frames (Vertical divider)
{
  const frames: RectFrameInput[] = [
    { id: 'f1', x: 20, y: 20, width: 100, height: 160 },
    { id: 'f2', x: 130, y: 20, width: 100, height: 160 },
  ];

  const dividers = extractCanvasDividers(frames, { minDimension: 25.4, minOverlap: 5, maxGap: 20 });
  assert(dividers.length === 1, `Expected 1 vertical divider, got ${dividers.length}`);
  const vDiv = dividers[0]!;
  assert(vDiv.orientation === 'vertical', 'Divider orientation must be vertical');
  // Centerline between 120 and 130 is 125
  assert(Math.abs(vDiv.coord - 125) < 0.1, `Divider coord expected 125, got ${vDiv.coord}`);
  assert(vDiv.firstSideFrameIds.includes('f1'), 'First side must include f1');
  assert(vDiv.secondSideFrameIds.includes('f2'), 'Second side must include f2');
  assert(vDiv.startCoord === 20, `startCoord expected 20, got ${vDiv.startCoord}`);
  assert(vDiv.endCoord === 180, `endCoord expected 180, got ${vDiv.endCoord}`);

  // Clamping checks: both frames have width 100, combined 200
  // min allowed width for either frame: max(25.4, 0.15 * 200 = 30) = 30
  // delta range: f1 min width 30 -> delta >= -70; f2 min width 30 -> delta <= 70
  assert(vDiv.minDelta === -70, `Expected minDelta -70, got ${vDiv.minDelta}`);
  assert(vDiv.maxDelta === 70, `Expected maxDelta 70, got ${vDiv.maxDelta}`);
  console.log('  ✓ Suite 1: Side-by-side vertical divider extraction & clamping passed.');
}

// Suite 2: Two stacked frames (Horizontal divider)
{
  const frames: RectFrameInput[] = [
    { id: 'top', x: 30, y: 30, width: 200, height: 80 },
    { id: 'bottom', x: 30, y: 120, width: 200, height: 80 }, // gap = 10
  ];

  const dividers = extractCanvasDividers(frames, { minDimension: 25.4, minOverlap: 10, maxGap: 20 });
  assert(dividers.length === 1, `Expected 1 horizontal divider, got ${dividers.length}`);
  const hDiv = dividers[0]!;
  assert(hDiv.orientation === 'horizontal', 'Orientation must be horizontal');
  // Centerline between 110 and 120 is 115
  assert(Math.abs(hDiv.coord - 115) < 0.1, `Expected coord 115, got ${hDiv.coord}`);
  assert(hDiv.firstSideFrameIds.includes('top'), 'Top frame on first side');
  assert(hDiv.secondSideFrameIds.includes('bottom'), 'Bottom frame on second side');
  console.log('  ✓ Suite 2: Stacked horizontal divider extraction passed.');
}

// Suite 3: 2x2 Grid (Colinear through-divider merging)
{
  const frames: RectFrameInput[] = [
    { id: 'tl', x: 10, y: 10, width: 100, height: 100 },
    { id: 'tr', x: 120, y: 10, width: 100, height: 100 },
    { id: 'bl', x: 10, y: 120, width: 100, height: 100 },
    { id: 'br', x: 120, y: 120, width: 100, height: 100 },
  ];

  const dividers = extractCanvasDividers(frames, { minDimension: 25.4, minOverlap: 5, maxGap: 20 });
  // Should merge the two vertical segments (tl-tr and bl-br) into 1 continuous vertical through-divider
  const vDividers = dividers.filter((d) => d.orientation === 'vertical');
  assert(vDividers.length === 1, `Expected 1 merged vertical divider, got ${vDividers.length}`);
  const mergedV = vDividers[0]!;
  assert(mergedV.firstSideFrameIds.length === 2, 'Merged V divider must control 2 left frames (tl, bl)');
  assert(mergedV.secondSideFrameIds.length === 2, 'Merged V divider must control 2 right frames (tr, br)');
  assert(mergedV.startCoord === 10, 'Merged V divider must span from y=10');
  assert(mergedV.endCoord === 220, 'Merged V divider must span to y=220');

  // Also should have 1 merged horizontal divider
  const hDividers = dividers.filter((d) => d.orientation === 'horizontal');
  assert(hDividers.length === 1, `Expected 1 merged horizontal divider, got ${hDividers.length}`);
  console.log('  ✓ Suite 3: 2x2 Grid colinear through-divider merging passed.');
}

// Suite 4: T-Junction Layout (1 Hero Left, 2 Stacked Right)
{
  const frames: RectFrameInput[] = [
    { id: 'hero-left', x: 20, y: 20, width: 180, height: 200 },
    { id: 'top-right', x: 210, y: 20, width: 120, height: 95 },
    { id: 'bot-right', x: 210, y: 125, width: 120, height: 95 },
  ];

  const dividers = extractCanvasDividers(frames, { minDimension: 25.4, minOverlap: 5, maxGap: 20 });
  const vDivs = dividers.filter((d) => d.orientation === 'vertical');
  const hDivs = dividers.filter((d) => d.orientation === 'horizontal');

  assert(vDivs.length === 1, `Expected 1 vertical divider, got ${vDivs.length}`);
  assert(hDivs.length === 1, `Expected 1 horizontal divider, got ${hDivs.length}`);

  const v = vDivs[0]!;
  assert(v.firstSideFrameIds.includes('hero-left'), 'Left side has hero');
  assert(v.secondSideFrameIds.includes('top-right') && v.secondSideFrameIds.includes('bot-right'), 'Right side has top and bottom');

  const h = hDivs[0]!;
  assert(h.firstSideFrameIds.includes('top-right'), 'Top side of horizontal shelf');
  assert(h.secondSideFrameIds.includes('bot-right'), 'Bottom side of horizontal shelf');
  assert(h.startCoord === 210, `Shelf start coord expected 210, got ${h.startCoord}`);
  assert(h.endCoord === 330, `Shelf end coord expected 330, got ${h.endCoord}`);
  console.log('  ✓ Suite 4: T-Junction layout divider topology passed.');
}

// Suite 5: findPhotoSwapTarget hit detection
{
  const frames: RectFrameInput[] = [
    { id: 'f-left', x: 0, y: 0, width: 100, height: 100 },
    { id: 'f-right', x: 120, y: 0, width: 100, height: 100 },
  ];

  const target1 = findPhotoSwapTarget(frames, { x: 50, y: 50 }, 'f-left');
  assert(target1 === null, 'Should exclude dragging frame itself');

  const target2 = findPhotoSwapTarget(frames, { x: 150, y: 50 }, 'f-left');
  assert(target2 !== null && target2.id === 'f-right', 'Should detect f-right when hovering over it');

  const target3 = findPhotoSwapTarget(frames, { x: 110, y: 50 }, 'f-left');
  assert(target3 === null, 'Should return null when in empty space between frames');
  console.log('  ✓ Suite 5: findPhotoSwapTarget hit testing passed.');
}

// Suite 6: carouselStore batchUpdateFrames & swapFrames
{
  const carousel = createInitialCarousel('test-carousel-swap', '1:1', 1);
  carousel.slides[0]!.elements = [
    {
      id: 'frame-a',
      type: 'photo',
      photoId: 'photo-1',
      filePath: '/path/1.jpg',
      x: 0,
      y: 0,
      width: 500,
      height: 1000,
      photoAspect: 0.5,
    } as CarouselPhotoFrame,
    {
      id: 'frame-b',
      type: 'photo',
      photoId: 'photo-2',
      filePath: '/path/2.jpg',
      x: 520,
      y: 0,
      width: 500,
      height: 1000,
      photoAspect: 0.5,
    } as CarouselPhotoFrame,
  ];

  useCarouselStore.setState({ currentCarousel: carousel });

  // Test batchUpdateFrames
  useCarouselStore.getState().batchUpdateFrames([
    { id: 'frame-a', updates: { width: 600 } },
    { id: 'frame-b', updates: { x: 620, width: 400 } },
  ]);

  const afterBatch = useCarouselStore.getState().currentCarousel!.slides[0]!.elements as CarouselPhotoFrame[];
  assert(afterBatch[0]!.width === 600, 'frame-a width should be updated to 600');
  assert(afterBatch[1]!.x === 620 && afterBatch[1]!.width === 400, 'frame-b should be updated');

  // Test swapFrames
  useCarouselStore.getState().swapFrames('frame-a', 'frame-b');
  const afterSwap = useCarouselStore.getState().currentCarousel!.slides[0]!.elements as CarouselPhotoFrame[];

  assert(afterSwap[0]!.id === 'frame-a', 'frame-a geometry container id retained');
  assert(afterSwap[0]!.filePath === '/path/2.jpg', 'frame-a now holds photo 2');
  assert(afterSwap[0]!.width === 600, 'frame-a width retained');

  assert(afterSwap[1]!.id === 'frame-b', 'frame-b geometry container id retained');
  assert(afterSwap[1]!.filePath === '/path/1.jpg', 'frame-b now holds photo 1');
  assert(afterSwap[1]!.width === 400, 'frame-b width retained');
  console.log('  ✓ Suite 6: carouselStore batchUpdateFrames & swapFrames passed.');
}

console.log('🎉 All Plan 13-01 Tests Passed (100%)!');
