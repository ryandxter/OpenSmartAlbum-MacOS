import { describe, it, expect, beforeEach } from 'vitest';
import { useCarouselStore } from '../carouselStore';
import { createInitialCarousel, CarouselPhotoFrame, CarouselTextFrame } from '../../domain/carousel';

describe('ISO-04: Slide coordinate preservation on reorder/delete/duplicate', () => {
  const SLIDE_WIDTH = 1080;

  beforeEach(() => {
    // Create a 3-slide carousel with known frame positions
    const carousel = createInitialCarousel('test-project', '1:1', 3);
    // Slide 0: frame at x=0..1080
    // Slide 1: frame at x=1080..2160
    // Slide 2: frame at x=2160..3240
    carousel.slides[0]!.elements = [
      {
        type: 'photo',
        id: 'frame-0',
        photoId: 'photo-0',
        filePath: '/p0.jpg',
        x: 10,
        y: 10,
        width: 1060,
        height: 1060,
      },
      {
        type: 'text',
        id: 'text-0',
        text: 'Slide 0 Text',
        x: 50,
        y: 50,
        width: 200,
        height: 50,
        fontSize: 24,
        fontFamily: 'Inter',
        fontWeight: 'normal',
        color: '#000000',
        align: 'left',
        locked: false,
      },
    ];
    carousel.slides[1]!.elements = [
      {
        type: 'photo',
        id: 'frame-1',
        photoId: 'photo-1',
        filePath: '/p1.jpg',
        x: SLIDE_WIDTH + 10,
        y: 10,
        width: 1060,
        height: 1060,
      },
      {
        type: 'text',
        id: 'text-1',
        text: 'Slide 1 Text',
        x: SLIDE_WIDTH + 50,
        y: 50,
        width: 200,
        height: 50,
        fontSize: 24,
        fontFamily: 'Inter',
        fontWeight: 'normal',
        color: '#000000',
        align: 'left',
        locked: false,
      },
    ];
    carousel.slides[2]!.elements = [
      {
        type: 'photo',
        id: 'frame-2',
        photoId: 'photo-2',
        filePath: '/p2.jpg',
        x: SLIDE_WIDTH * 2 + 10,
        y: 10,
        width: 1060,
        height: 1060,
      },
    ];

    useCarouselStore.setState({
      currentCarousel: carousel,
      activeSlideIndex: 0,
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
  });

  describe('reorderSlide', () => {
    it('moves slide 2 to position 0 and shifts all frame x coords (photo and text)', () => {
      useCarouselStore.getState().reorderSlide(2, 0);
      const { currentCarousel } = useCarouselStore.getState();
      const slides = currentCarousel!.slides;

      // Slide now at index 0 was slide 2: frame was at x=2160+10=2170, deltaX = (0-2)*1080 = -2160
      const frame0 = slides[0]!.elements[0] as CarouselPhotoFrame;
      expect(frame0.x).toBe(10); // 2170 - 2160 = 10

      // Slide now at index 1 was slide 0: photo was at x=10, deltaX = (1-0)*1080 = +1080
      const frame1 = slides[1]!.elements[0] as CarouselPhotoFrame;
      expect(frame1.x).toBe(SLIDE_WIDTH + 10); // 10 + 1080 = 1090
      // Text frame on slide 0 was at x=50, deltaX = +1080
      const text1 = slides[1]!.elements[1] as CarouselTextFrame;
      expect(text1.x).toBe(SLIDE_WIDTH + 50); // 50 + 1080 = 1130

      // Slide now at index 2 was slide 1: frame was at x=1080+10=1090, deltaX = (2-1)*1080 = +1080
      const frame2 = slides[2]!.elements[0] as CarouselPhotoFrame;
      expect(frame2.x).toBe(SLIDE_WIDTH * 2 + 10); // 1090 + 1080 = 2170
      const text2 = slides[2]!.elements[1] as CarouselTextFrame;
      expect(text2.x).toBe(SLIDE_WIDTH * 2 + 50);
    });

    it('does not change frame x when slide does not move (same index)', () => {
      const before = useCarouselStore.getState().currentCarousel!.slides[0]!.elements[0] as CarouselPhotoFrame;
      useCarouselStore.getState().reorderSlide(0, 0); // no-op
      const after = useCarouselStore.getState().currentCarousel!.slides[0]!.elements[0] as CarouselPhotoFrame;
      expect(after.x).toBe(before.x);
    });

    it('pushes history for undo support', () => {
      useCarouselStore.getState().reorderSlide(0, 2);
      expect(useCarouselStore.getState().canUndo).toBe(true);
    });
  });

  describe('deleteSlide', () => {
    it('deletes slide 0 and shifts remaining slides left by slideWidthPx', () => {
      useCarouselStore.getState().deleteSlide(0);
      const { currentCarousel } = useCarouselStore.getState();
      const slides = currentCarousel!.slides;

      // Was slide 1 (photo x=1090, text x=1130), now at index 0: deltaX = (0 - 1) * 1080 = -1080
      const frame0 = slides[0]!.elements[0] as CarouselPhotoFrame;
      expect(frame0.x).toBe(10); // 1090 - 1080 = 10
      const text0 = slides[0]!.elements[1] as CarouselTextFrame;
      expect(text0.x).toBe(50); // 1130 - 1080 = 50

      // Was slide 2 (x=2170), now at index 1: deltaX = (1 - 2) * 1080 = -1080
      const frame1 = slides[1]!.elements[0] as CarouselPhotoFrame;
      expect(frame1.x).toBe(SLIDE_WIDTH + 10); // 2170 - 1080 = 1090
    });

    it('deletes middle slide and does not shift preceding slides', () => {
      useCarouselStore.getState().deleteSlide(1); // Delete slide 1
      const { currentCarousel } = useCarouselStore.getState();
      const slides = currentCarousel!.slides;

      // Slide 0 unchanged
      const frame0 = slides[0]!.elements[0] as CarouselPhotoFrame;
      expect(frame0.x).toBe(10);
      const text0 = slides[0]!.elements[1] as CarouselTextFrame;
      expect(text0.x).toBe(50);

      // Was slide 2 (x=2170), now at index 1: deltaX = (1 - 2) * 1080 = -1080
      const frame1 = slides[1]!.elements[0] as CarouselPhotoFrame;
      expect(frame1.x).toBe(SLIDE_WIDTH + 10);
    });
  });

  describe('duplicateSlide', () => {
    it('duplicates slide 0 and shifts all following slides right by slideWidthPx', () => {
      useCarouselStore.getState().duplicateSlide(0);
      const { currentCarousel } = useCarouselStore.getState();
      const slides = currentCarousel!.slides;

      // Slide 0 unchanged: x=10, text x=50
      const frame0 = slides[0]!.elements[0] as CarouselPhotoFrame;
      expect(frame0.x).toBe(10);
      const text0 = slides[0]!.elements[1] as CarouselTextFrame;
      expect(text0.x).toBe(50);

      // Duplicated slide at index 1: original frame x=10, shifted by +slideWidthPx
      const frameDup = slides[1]!.elements[0] as CarouselPhotoFrame;
      expect(frameDup.x).toBe(SLIDE_WIDTH + 10);
      const textDup = slides[1]!.elements[1] as CarouselTextFrame;
      expect(textDup.x).toBe(SLIDE_WIDTH + 50);

      // Was slide 1 at index 1 (x=1090, text x=1130), now at index 2: deltaX = +1080
      const frame2 = slides[2]!.elements[0] as CarouselPhotoFrame;
      expect(frame2.x).toBe(SLIDE_WIDTH * 2 + 10); // 1090 + 1080 = 2170
      const text2 = slides[2]!.elements[1] as CarouselTextFrame;
      expect(text2.x).toBe(SLIDE_WIDTH * 2 + 50); // 1130 + 1080 = 2210

      // Was slide 2 at index 2 (x=2170), now at index 3: deltaX = +1080
      const frame3 = slides[3]!.elements[0] as CarouselPhotoFrame;
      expect(frame3.x).toBe(SLIDE_WIDTH * 3 + 10); // 2170 + 1080 = 3250
    });
  });
});

describe('ISO-05: Style preservation during layout cycling', () => {
  const SLIDE_WIDTH = 1080;
  const SLIDE_HEIGHT = 1080;

  beforeEach(() => {
    const carousel = createInitialCarousel('test-project', '1:1', 1);
    // Add 2 photo frames with custom styles to slide 0
    carousel.slides[0]!.elements = [
      {
        type: 'photo',
        id: 'frame-a',
        photoId: 'photo-a',
        filePath: '/photo-a.jpg',
        fileName: 'photo-a.jpg',
        x: 0,
        y: 0,
        width: SLIDE_WIDTH / 2,
        height: SLIDE_HEIGHT,
        shapeType: 'hexagon',
        borderEnabled: true,
        borderWidth: 4,
        borderColor: '#FF0000',
        cornerRadius: 24,
        opacity: 0.9,
        rotation: 5,
        locked: true,
      } as CarouselPhotoFrame,
      {
        type: 'photo',
        id: 'frame-b',
        photoId: 'photo-b',
        filePath: '/photo-b.jpg',
        fileName: 'photo-b.jpg',
        x: SLIDE_WIDTH / 2,
        y: 0,
        width: SLIDE_WIDTH / 2,
        height: SLIDE_HEIGHT,
        shapeType: 'circle',
        cornerRadiusTl: 12,
        cornerRadiusTr: 12,
        cornerRadiusBr: 0,
        cornerRadiusBl: 0,
      } as CarouselPhotoFrame,
    ];

    useCarouselStore.setState({
      currentCarousel: carousel,
      activeSlideIndex: 0,
      slideLayoutIndices: {},
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
  });

  it('cycleSlideLayout preserves shapeType for each photo', () => {
    useCarouselStore.getState().cycleSlideLayout('next');
    const { currentCarousel } = useCarouselStore.getState();
    const photoFrames = currentCarousel!.slides[0]!.elements.filter(
      (el) => el.type === 'photo'
    ) as CarouselPhotoFrame[];

    const frameA = photoFrames.find((f) => f.photoId === 'photo-a');
    const frameB = photoFrames.find((f) => f.photoId === 'photo-b');

    expect(frameA?.shapeType).toBe('hexagon');
    expect(frameB?.shapeType).toBe('circle');
  });

  it('cycleSlideLayout preserves borderEnabled and borderColor for photo-a', () => {
    useCarouselStore.getState().cycleSlideLayout('next');
    const { currentCarousel } = useCarouselStore.getState();
    const photoFrames = currentCarousel!.slides[0]!.elements.filter(
      (el) => el.type === 'photo'
    ) as CarouselPhotoFrame[];

    const frameA = photoFrames.find((f) => f.photoId === 'photo-a');
    expect(frameA?.borderEnabled).toBe(true);
    expect(frameA?.borderWidth).toBe(4);
    expect(frameA?.borderColor).toBe('#FF0000');
  });

  it('cycleSlideLayout preserves cornerRadius and opacity for photo-a', () => {
    useCarouselStore.getState().cycleSlideLayout('next');
    const { currentCarousel } = useCarouselStore.getState();
    const photoFrames = currentCarousel!.slides[0]!.elements.filter(
      (el) => el.type === 'photo'
    ) as CarouselPhotoFrame[];

    const frameA = photoFrames.find((f) => f.photoId === 'photo-a');
    expect(frameA?.cornerRadius).toBe(24);
    expect(frameA?.opacity).toBe(0.9);
    expect(frameA?.rotation).toBe(5);
    expect(frameA?.locked).toBe(true);
  });

  it('cycleSlideLayout preserves individual cornerRadius per-corner for photo-b', () => {
    useCarouselStore.getState().cycleSlideLayout('next');
    const { currentCarousel } = useCarouselStore.getState();
    const photoFrames = currentCarousel!.slides[0]!.elements.filter(
      (el) => el.type === 'photo'
    ) as CarouselPhotoFrame[];

    const frameB = photoFrames.find((f) => f.photoId === 'photo-b');
    expect(frameB?.cornerRadiusTl).toBe(12);
    expect(frameB?.cornerRadiusTr).toBe(12);
    expect(frameB?.cornerRadiusBr).toBe(0);
    expect(frameB?.cornerRadiusBl).toBe(0);
  });

  it('cycleSlideLayout still changes frame geometry (x, y, width, height)', () => {
    const beforeFrameB = useCarouselStore.getState().currentCarousel!.slides[0]!.elements.find(
      (el) => el.type === 'photo' && (el as CarouselPhotoFrame).photoId === 'photo-b'
    ) as CarouselPhotoFrame;

    useCarouselStore.getState().cycleSlideLayout('next');

    const { currentCarousel } = useCarouselStore.getState();
    const afterFrameB = currentCarousel!.slides[0]!.elements.find(
      (el) => el.type === 'photo' && (el as CarouselPhotoFrame).photoId === 'photo-b'
    ) as CarouselPhotoFrame;

    // Geometry of unlocked frame must change (layout cycling changes positions around locked photo-a)
    const geometryChanged =
      afterFrameB.x !== beforeFrameB.x ||
      afterFrameB.y !== beforeFrameB.y ||
      afterFrameB.width !== beforeFrameB.width ||
      afterFrameB.height !== beforeFrameB.height;
    expect(geometryChanged).toBe(true);
  });

  it('applyDynamicSlideLayoutByIndex also preserves shapeType', () => {
    useCarouselStore.getState().applyDynamicSlideLayoutByIndex(0, 0);
    const { currentCarousel } = useCarouselStore.getState();
    const photoFrames = currentCarousel!.slides[0]!.elements.filter(
      (el) => el.type === 'photo'
    ) as CarouselPhotoFrame[];

    const frameA = photoFrames.find((f) => f.photoId === 'photo-a');
    expect(frameA?.shapeType).toBe('hexagon');
  });
});

describe('extractFrameStyle utility (ISO-05)', () => {
  it('extracts only explicitly-set fields', async () => {
    const { extractFrameStyle } = await import('../../domain/carousel');
    const frame: CarouselPhotoFrame = {
      type: 'photo',
      id: 'test',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      shapeType: 'hexagon',
      borderEnabled: true,
      borderWidth: 4,
      // borderColor is NOT set — should not appear in snapshot
    };
    const snap = extractFrameStyle(frame);
    expect(snap.shapeType).toBe('hexagon');
    expect(snap.borderEnabled).toBe(true);
    expect(snap.borderWidth).toBe(4);
    expect(snap.borderColor).toBeUndefined();
    expect(snap.opacity).toBeUndefined();
  });

  it('returns empty object for a frame with no style properties', async () => {
    const { extractFrameStyle } = await import('../../domain/carousel');
    const frame: CarouselPhotoFrame = {
      type: 'photo',
      id: 'test',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    };
    const snap = extractFrameStyle(frame);
    expect(Object.keys(snap)).toHaveLength(0);
  });
});
