import {
  Carousel,
  CarouselPhotoFrame,
  getSlideIntersectingFrames,
  createInitialCarousel,
} from '../../carousel';
import { useCarouselStore } from '../../../stores/carouselStore';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('--- Testing Carousel Panorama Span & Virtual Slicing Engine ---');

function createMockCarousel(): Carousel {
  const c = createInitialCarousel('test-proj', '1:1', 2);
  c.slides[0]!.elements = [
    {
      id: 'frame-1',
      type: 'photo',
      photoId: 'photo-1',
      filePath: '/photos/pano.jpg',
      x: 0,
      y: 0,
      width: 1080,
      height: 1080,
      photoAspect: 2.0,
      cropX: 0,
      cropY: 0,
      cropScale: 1.0,
    } as CarouselPhotoFrame,
  ];
  return c;
}

// Test 1: getSlideIntersectingFrames single-slide frame
{
  const carousel = createMockCarousel();
  const slide0Frames = getSlideIntersectingFrames(carousel, 0);
  assert(slide0Frames.length === 1, 'Slide 0 must have 1 intersecting frame');
  assert(slide0Frames[0]!.frame.id === 'frame-1', 'Frame id must match frame-1');
  assert(slide0Frames[0]!.frame.width === 1080, 'Frame width must be 1080');
  assert(slide0Frames[0]!.localX === 0, 'Local X offset must be 0');

  const slide1Frames = getSlideIntersectingFrames(carousel, 1);
  assert(slide1Frames.length === 0, 'Slide 1 should have 0 frames initially');
  console.log('✓ Test 1: getSlideIntersectingFrames single slide passed');
}

// Test 2: getSlideIntersectingFrames with spanning frame
{
  const carousel = createMockCarousel();
  // Frame spans slide 0 and slide 1 (width = 2160)
  carousel.slides[0]!.elements[0] = {
    ...carousel.slides[0]!.elements[0]!,
    width: 2160,
    height: 1080,
  } as CarouselPhotoFrame;

  const slide0Frames = getSlideIntersectingFrames(carousel, 0);
  assert(slide0Frames.length === 1, 'Slide 0 must have 1 frame');
  assert(slide0Frames[0]!.frame.width === 2160, 'Frame width on slide 0 is 2160');
  assert(slide0Frames[0]!.localX === 0, 'Local X on slide 0 is 0');

  const slide1Frames = getSlideIntersectingFrames(carousel, 1);
  assert(slide1Frames.length === 1, 'Slide 1 must intersect spanning frame from slide 0');
  assert(slide1Frames[0]!.frame.id === 'frame-1', 'Frame id must match frame-1');
  assert(slide1Frames[0]!.frame.width === 2160, 'Frame width on slide 1 is 2160');
  assert(slide1Frames[0]!.localX === -1080, 'Local X on slide 1 is -1080');

  console.log('✓ Test 2: getSlideIntersectingFrames 2-slide span passed');
}

// Test 3: setPanoramaSpan in carouselStore (2 slides)
{
  const carousel = createMockCarousel();
  useCarouselStore.setState({
    currentCarousel: carousel,
    activeSlideIndex: 0,
    selectedFrameId: 'frame-1',
  });

  useCarouselStore.getState().setPanoramaSpan('frame-1', 2);

  const updatedCarousel = useCarouselStore.getState().currentCarousel!;
  const updatedFrame = updatedCarousel.slides[0]!.elements[0] as CarouselPhotoFrame;

  assert(updatedFrame.width === 2160, 'Frame width must equal 2 * slideWidth');
  assert(updatedFrame.height === 1080, 'Frame height must equal slideHeight');
  assert(updatedFrame.x === 0, 'Frame x must snap to slide boundary');
  assert(updatedFrame.y === 0, 'Frame y must snap to 0');
  console.log('✓ Test 3: setPanoramaSpan (2 slides) passed');
}

// Test 4: setPanoramaSpan auto-appends missing slide if spanning beyond end
{
  const carousel = createMockCarousel();
  // Put frame on slide 1 (last slide)
  const frameOnSlide1: CarouselPhotoFrame = {
    id: 'frame-last',
    type: 'photo',
    photoId: 'photo-2',
    filePath: '/photos/pano2.jpg',
    x: 1080,
    y: 0,
    width: 1080,
    height: 1080,
    photoAspect: 2.0,
  };
  carousel.slides[1]!.elements = [frameOnSlide1];

  useCarouselStore.setState({
    currentCarousel: carousel,
    activeSlideIndex: 1,
    selectedFrameId: 'frame-last',
  });

  assert(carousel.slides.length === 2, 'Initial carousel must have 2 slides');

  // Span 2 slides starting on slide 1 -> needs slide index 1 and 2 (so 3 slides total)
  useCarouselStore.getState().setPanoramaSpan('frame-last', 2);

  const updatedCarousel = useCarouselStore.getState().currentCarousel!;
  assert(updatedCarousel.slides.length === 3, 'Must auto-append 1 slide to fit 2-slide span from slide 1');
  const spanned = updatedCarousel.slides[1]!.elements[0] as CarouselPhotoFrame;
  assert(spanned.width === 2160, 'Spanned frame width must be 2160');
  assert(spanned.x === 1080, 'Spanned frame x must be 1080');
  console.log('✓ Test 4: setPanoramaSpan auto-appends slides passed');
}

// Test 5: setPanoramaSpan 3 slides
{
  const carousel = createMockCarousel();
  useCarouselStore.setState({
    currentCarousel: carousel,
    activeSlideIndex: 0,
    selectedFrameId: 'frame-1',
  });

  useCarouselStore.getState().setPanoramaSpan('frame-1', 3);

  const updatedCarousel = useCarouselStore.getState().currentCarousel!;
  assert(updatedCarousel.slides.length === 3, 'Must auto-append slide 2 so total slides = 3');
  const spanned = updatedCarousel.slides[0]!.elements[0] as CarouselPhotoFrame;
  assert(spanned.width === 3240, 'Width must equal 3 * 1080 = 3240');
  console.log('✓ Test 5: setPanoramaSpan (3 slides) passed');
}

// Test 6: setHeroPhotoOnSlide re-synthesizes slide with hero photo in primary slot
{
  const carousel = createMockCarousel();
  carousel.slides[0]!.elements = [
    {
      id: 'photo-a',
      type: 'photo',
      photoId: 'p-a',
      filePath: '/photos/a.jpg',
      x: 0,
      y: 0,
      width: 500,
      height: 500,
      photoAspect: 1.0,
    } as CarouselPhotoFrame,
    {
      id: 'photo-b',
      type: 'photo',
      photoId: 'p-b',
      filePath: '/photos/b.jpg',
      x: 520,
      y: 0,
      width: 500,
      height: 500,
      photoAspect: 1.5,
    } as CarouselPhotoFrame,
  ];

  useCarouselStore.setState({
    currentCarousel: carousel,
    activeSlideIndex: 0,
  });

  useCarouselStore.getState().setHeroPhotoOnSlide(0, 'photo-b');

  const updated = useCarouselStore.getState().currentCarousel!;
  const frames = updated.slides[0]!.elements as CarouselPhotoFrame[];
  assert(frames.length === 2, 'Must retain all 2 photos (zero-loss)');
  const paths = frames.map((f) => f.filePath);
  assert(paths.includes('/photos/a.jpg'), 'Must retain photo A');
  assert(paths.includes('/photos/b.jpg'), 'Must retain photo B');
  console.log('✓ Test 6: setHeroPhotoOnSlide zero-loss preservation passed');
}

console.log('All 6 Carousel Panorama & Hero tests passed successfully!');
