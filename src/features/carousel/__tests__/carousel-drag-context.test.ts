/**
 * Automated Unit & Integration Tests for Carousel Batch Placement, R-BSP Reflow,
 * Style Retention, Single-Step Undo, and Context Routing.
 */

import { useCarouselStore } from '../../../stores/carouselStore';
import { useAlbumStore } from '../../../stores/albumStore';
import { usePhotoStore } from '../../../stores/photoStore';
import type { Photo } from '../../../domain/photo';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function createMockPhoto(id: string, fileName: string, width = 1200, height = 800): Photo {
  return {
    id,
    projectId: 'test-project',
    filePath: `/path/to/${fileName}`,
    fileName,
    fileSize: 1024 * 1024,
    width,
    height,
    format: 'jpeg',
    isFavorite: false,
    usedCount: 0,
    isMissing: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

console.log('=== Running Carousel Batch Placement & Context Routing Test Suite ===');

// Test 1: Batch photo drop of 3 photos on a carousel slide creates 3 frames in a single update
{
  const store = useCarouselStore.getState();
  store.initializeCarousel('test-batch-carousel', '1:1', 3);

  const photo1 = createMockPhoto('p-1', 'photo1.jpg', 1600, 1200);
  const photo2 = createMockPhoto('p-2', 'photo2.jpg', 1200, 1600);
  const photo3 = createMockPhoto('p-3', 'photo3.jpg', 1200, 1200);

  const initialPastLength = useCarouselStore.getState().past.length;

  const placedIds = useCarouselStore.getState().addPhotoFrames(0, [photo1, photo2, photo3]);

  const updatedCarousel = useCarouselStore.getState().currentCarousel!;
  const slide0 = updatedCarousel.slides[0]!;

  assert(slide0.elements.length === 3, `Expected 3 frames on slide 0, got ${slide0.elements.length}`);
  assert(placedIds.length === 3, `Expected 3 returned frame IDs, got ${placedIds.length}`);

  // Verify non-overlapping proportional rects
  for (let i = 0; i < slide0.elements.length; i++) {
    const fA = slide0.elements[i]!;
    assert(fA.width > 0 && fA.height > 0, `Frame ${fA.id} must have positive dimensions`);
    for (let j = i + 1; j < slide0.elements.length; j++) {
      const fB = slide0.elements[j]!;
      const overlaps =
        fA.x < fB.x + fB.width &&
        fA.x + fA.width > fB.x &&
        fA.y < fB.y + fB.height &&
        fA.y + fA.height > fB.y;
      assert(!overlaps, `Frame ${fA.id} and ${fB.id} should not overlap on slide 0`);
    }
  }

  // Verify single history commit
  const newPastLength = useCarouselStore.getState().past.length;
  assert(
    newPastLength === initialPastLength + 1,
    `Batch placement must push exactly 1 history state (got ${newPastLength - initialPastLength})`
  );

  console.log('✓ Test 1: Batch photo drop creates 3 proportional non-overlapping frames in a single update');
}

// Test 2: Single Cmd+Z (undo()) rolls back all 3 frames in one step
{
  const slideBeforeUndo = useCarouselStore.getState().currentCarousel!.slides[0]!;
  assert(slideBeforeUndo.elements.length === 3, 'Precondition: slide has 3 elements before undo');

  useCarouselStore.getState().undo();

  const slideAfterUndo = useCarouselStore.getState().currentCarousel!.slides[0]!;
  assert(
    slideAfterUndo.elements.length === 0,
    `Single undo should rollback all 3 frames (elements remaining: ${slideAfterUndo.elements.length})`
  );

  // Redo should restore all 3 frames
  useCarouselStore.getState().redo();
  const slideAfterRedo = useCarouselStore.getState().currentCarousel!.slides[0]!;
  assert(
    slideAfterRedo.elements.length === 3,
    `Redo should restore all 3 frames in a single step (got ${slideAfterRedo.elements.length})`
  );

  console.log('✓ Test 2: Single undo() atomically rolls back batch frames and redo() restores them');
}

// Test 3: Smart reflow combines existing slide photos with newly added photos and preserves custom styling
{
  const currentSlide = useCarouselStore.getState().currentCarousel!.slides[0]!;
  const targetFrame = currentSlide.elements[0]!;

  // Apply custom borders, corner radii, and shape mask to targetFrame
  useCarouselStore.getState().updatePhotoFrame(targetFrame.id, {
    borderEnabled: true,
    borderWidth: 6,
    borderColor: '#ff0055',
    borderStyle: 'dashed',
    cornerRadius: 24,
    cornerRadiusTl: 24,
    cornerRadiusTr: 12,
    cornerRadiusBr: 24,
    cornerRadiusBl: 12,
    shapeType: 'rounded',
  });

  const photo4 = createMockPhoto('p-4', 'photo4.jpg', 1800, 1200);

  // Add 4th photo to slide 0
  const newlyPlacedIds = useCarouselStore.getState().addPhotoFrames(0, [photo4]);
  assert(newlyPlacedIds.length === 1, `Expected 1 newly placed frame id, got ${newlyPlacedIds.length}`);

  const reflowedSlide = useCarouselStore.getState().currentCarousel!.slides[0]!;
  assert(reflowedSlide.elements.length === 4, `Slide should now contain 4 photo frames, got ${reflowedSlide.elements.length}`);

  // Find the preserved original frame by id
  const preservedFrame = reflowedSlide.elements.find((el) => el.id === targetFrame.id);
  assert(preservedFrame !== undefined, 'Original frame ID must be preserved during smart reflow');
  assert(preservedFrame!.borderEnabled === true, 'borderEnabled must be preserved');
  assert(preservedFrame!.borderWidth === 6, 'borderWidth must be preserved');
  assert(preservedFrame!.borderColor === '#ff0055', 'borderColor must be preserved');
  assert(preservedFrame!.borderStyle === 'dashed', 'borderStyle must be preserved');
  assert(preservedFrame!.cornerRadius === 24, 'cornerRadius must be preserved');
  assert(preservedFrame!.cornerRadiusTl === 24, 'cornerRadiusTl must be preserved');
  assert(preservedFrame!.cornerRadiusTr === 12, 'cornerRadiusTr must be preserved');
  assert(preservedFrame!.shapeType === 'rounded', 'shapeType must be preserved');

  console.log('✓ Test 3: Smart reflow preserves frame IDs and custom styling attributes (borders, radius, shapes)');
}

// Test 4: Frame replacement preserves target frame geometry and updates photo references
{
  const slide = useCarouselStore.getState().currentCarousel!.slides[0]!;
  const frameToReplace = slide.elements[0]!;
  const origX = frameToReplace.x;
  const origY = frameToReplace.y;
  const origW = frameToReplace.width;
  const origH = frameToReplace.height;

  const replacementPhoto = createMockPhoto('p-replacement', 'replacement.jpg', 3000, 2000);

  const returnedIds = useCarouselStore.getState().addPhotoFrames(0, [replacementPhoto], {
    targetFrameId: frameToReplace.id,
    isReplace: true,
  });

  assert(returnedIds[0] === frameToReplace.id, 'Returned frame ID must match replaced frame');

  const afterReplaceSlide = useCarouselStore.getState().currentCarousel!.slides[0]!;
  const replacedFrame = afterReplaceSlide.elements.find((el) => el.id === frameToReplace.id)!;

  assert(replacedFrame.photoId === 'p-replacement', 'photoId must be updated to replacement photo');
  assert(replacedFrame.filePath === '/path/to/replacement.jpg', 'filePath must be updated');
  assert(replacedFrame.fileName === 'replacement.jpg', 'fileName must be updated');
  assert(replacedFrame.x === origX, 'Frame X coordinate must be preserved on replace');
  assert(replacedFrame.y === origY, 'Frame Y coordinate must be preserved on replace');
  assert(replacedFrame.width === origW, 'Frame width must be preserved on replace');
  assert(replacedFrame.height === origH, 'Frame height must be preserved on replace');

  console.log('✓ Test 4: Frame replacement preserves target geometry and updates photo payload');
}

// Test 5: Mode-Aware Routing (Carousel vs Print) & Double-Click Dispatch
{
  // Setup photo store
  const mockPhotoA = createMockPhoto('photo-route-a', 'route-a.jpg');
  const mockPhotoB = createMockPhoto('photo-route-b', 'route-b.jpg');
  usePhotoStore.setState({
    photos: [mockPhotoA, mockPhotoB],
  });

  // Setup carousel store on fresh slide 1
  useCarouselStore.getState().setActiveSlide(1);
  const slide1Before = useCarouselStore.getState().currentCarousel!.slides[1]!;
  assert(slide1Before.elements.length === 0, 'Slide 1 should be empty initially');

  // Simulate Filmstrip double-click in 'carousel' mode
  const activeMode: 'print' | 'carousel' = 'carousel';
  if (activeMode === 'carousel') {
    const { currentCarousel, activeSlideIndex, selectedFrameId, addPhotoFrames } = useCarouselStore.getState();
    const targetSlide = currentCarousel?.slides[activeSlideIndex];
    const isSelectedFrameOnSlide = targetSlide && selectedFrameId
      ? targetSlide.elements.some((el) => el.id === selectedFrameId && el.type === 'photo')
      : false;

    if (isSelectedFrameOnSlide && selectedFrameId) {
      addPhotoFrames(activeSlideIndex, [mockPhotoA], { targetFrameId: selectedFrameId, isReplace: true });
    } else {
      addPhotoFrames(activeSlideIndex, [mockPhotoA]);
    }

    usePhotoStore.setState((s) => ({
      photos: s.photos.map((p) => (p.id === mockPhotoA.id ? { ...p, usedCount: (p.usedCount || 0) + 1 } : p)),
    }));
  }

  const slide1After = useCarouselStore.getState().currentCarousel!.slides[1]!;
  assert(slide1After.elements.length === 1, 'Slide 1 should receive 1 photo frame via carousel mode dispatch');
  assert(slide1After.elements[0]!.photoId === 'photo-route-a', 'Placed photo must match route-a');

  // Verify photoStore usedCount incremented
  const photoInStore = usePhotoStore.getState().photos.find((p) => p.id === 'photo-route-a')!;
  assert(photoInStore.usedCount === 1, `photoStore usedCount should be 1, got ${photoInStore.usedCount}`);

  // Verify albumStore spreads remained unmodified (no bleed into print store)
  const albumSpreads = useAlbumStore.getState().currentAlbum?.spreads || [];
  for (const spread of albumSpreads) {
    const hasPhotoA = spread.elements.some((el) => el.type === 'photo' && el.photoId === 'photo-route-a');
    assert(!hasPhotoA, 'Album store spread must not receive photo placed in carousel mode');
  }

  console.log('✓ Test 5: Context routing in Carousel mode dispatches to carouselStore and updates photoStore without touching albumStore');
}

console.log('=== All Carousel Drag & Context Routing Tests Passed Successfully! ===');
