import { useCarouselStore } from '../../../stores/carouselStore';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('🧪 Testing Carousel Multi-Selection & Undo/Redo Engine...\n');

// 1. Initialize Carousel
useCarouselStore.getState().initializeCarousel('proj-test-1', '1:1', 3);
const initialCarousel = useCarouselStore.getState().currentCarousel;
assert(Boolean(initialCarousel), 'Carousel should be initialized');
assert(useCarouselStore.getState().selectedFrameIds.length === 0, 'Initial selection should be empty');
assert(useCarouselStore.getState().canUndo === false, 'canUndo should initially be false');
assert(useCarouselStore.getState().canRedo === false, 'canRedo should initially be false');

// 2. Add Photo Frames
useCarouselStore.getState().addPhotoFrame(0, {
  type: 'photo',
  photoId: 'photo-1',
  filePath: '/test/photo1.jpg',
  width: 500,
  height: 500,
  x: 10,
  y: 10,
});

useCarouselStore.getState().addPhotoFrame(0, {
  type: 'photo',
  photoId: 'photo-2',
  filePath: '/test/photo2.jpg',
  width: 500,
  height: 500,
  x: 520,
  y: 10,
});

const currentCarousel = useCarouselStore.getState().currentCarousel!;
const frames = currentCarousel.slides[0]!.elements;
assert(frames.length === 2, 'Slide 0 should have 2 frames');
assert(useCarouselStore.getState().canUndo === true, 'canUndo should be true after adding frames');

const frame1Id = frames[0]!.id;
const frame2Id = frames[1]!.id;

// 3. Test Multi-Selection (Shift+Click toggle)
console.log('▶ Test 1: Shift+Click multi-selection toggle');
useCarouselStore.getState().toggleFrameSelection(frame1Id, false);
assert(useCarouselStore.getState().selectedFrameIds.length === 1 && useCarouselStore.getState().selectedFrameIds[0] === frame1Id, 'Single select should set frame1');
assert(useCarouselStore.getState().selectedFrameId === frame1Id, 'selectedFrameId should match frame1');

// Shift+click frame 2 -> should add frame 2
useCarouselStore.getState().toggleFrameSelection(frame2Id, true);
assert(useCarouselStore.getState().selectedFrameIds.length === 2, 'Shift+click should add frame2');
assert(useCarouselStore.getState().selectedFrameIds.includes(frame1Id) && useCarouselStore.getState().selectedFrameIds.includes(frame2Id), 'Both frames selected');
assert(useCarouselStore.getState().selectedFrameId === frame1Id, 'selectedFrameId should be first selected');

// Shift+click frame 1 again -> should remove frame 1, leaving frame 2
useCarouselStore.getState().toggleFrameSelection(frame1Id, true);
assert(useCarouselStore.getState().selectedFrameIds.length === 1 && useCarouselStore.getState().selectedFrameIds[0] === frame2Id, 'Shift+click on selected frame should deselect it');
assert(useCarouselStore.getState().selectedFrameId === frame2Id, 'selectedFrameId should update to frame2');

console.log('  ✔ Shift+click toggling verified.');

// 4. Test Select All Frames On Slide (Cmd+A)
console.log('▶ Test 2: Select All on Slide (Cmd+A)');
useCarouselStore.getState().selectAllFramesOnSlide(0);
assert(useCarouselStore.getState().selectedFrameIds.length === 2, 'Select all should select both frames');
console.log('  ✔ Cmd+A selectAllFramesOnSlide verified.');

// 5. Test Delete Selected Frames
console.log('▶ Test 3: Delete Selected Frames');
useCarouselStore.getState().deleteSelectedFrames();
const remainingFrames = useCarouselStore.getState().currentCarousel!.slides[0]!.elements;
assert(remainingFrames.length === 0, 'Both frames should be deleted');
assert(useCarouselStore.getState().selectedFrameIds.length === 0, 'Selection should be cleared on delete');
console.log('  ✔ Delete selected frames verified.');

// 6. Test Undo & Redo (Cmd+Z & Cmd+Shift+Z)
console.log('▶ Test 4: Undo & Redo History Stack');
assert(useCarouselStore.getState().canUndo === true, 'canUndo should be true after delete');
useCarouselStore.getState().undo();
const afterUndoFrames = useCarouselStore.getState().currentCarousel!.slides[0]!.elements;
assert(afterUndoFrames.length === 2, 'Undo should restore deleted frames');
assert(useCarouselStore.getState().canRedo === true, 'canRedo should be true after undo');

useCarouselStore.getState().redo();
const afterRedoFrames = useCarouselStore.getState().currentCarousel!.slides[0]!.elements;
assert(afterRedoFrames.length === 0, 'Redo should re-delete frames');

// Undo again to leave frames present
useCarouselStore.getState().undo();
assert(useCarouselStore.getState().currentCarousel!.slides[0]!.elements.length === 2, 'Undo again restores frames');
console.log('  ✔ Undo & Redo verified.');

console.log('\n🎉 ALL CAROUSEL SHORTCUTS & MULTI-SELECTION TESTS PASSED (100% GREEN)!\n');
