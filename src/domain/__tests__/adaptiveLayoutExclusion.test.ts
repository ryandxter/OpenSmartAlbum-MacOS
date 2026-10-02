import { describe, it, expect, beforeEach } from 'vitest';
import {
  getRotatedAABB,
  getClampedIntersection,
  computeFreePageSubBoxes,
  generateAdaptiveLayoutVariations,
  shuffleElementsPhotos,
  clearAdaptiveLayoutCache,
} from '../adaptiveLayout';
import { PhotoFrameElement } from '../editor';
import { TemplateParams, RectBounds } from '../templates';
import { useCarouselStore } from '../../stores/carouselStore';
import { createInitialCarousel, CarouselPhotoFrame } from '../carousel';

describe('Plan 19-01: Adaptive Layout Decorative Exclusion & Photo Swap Invariants', () => {
  beforeEach(() => {
    clearAdaptiveLayoutCache();
  });

  describe('1. Rotated AABB Projection (getRotatedAABB)', () => {
    it('returns exact bounding box for 0 degree rotation', () => {
      const elem = { x: 50, y: 100, width: 200, height: 150, rotation: 0 };
      const aabb = getRotatedAABB(elem);
      expect(aabb.x).toBe(50);
      expect(aabb.y).toBe(100);
      expect(aabb.width).toBe(200);
      expect(aabb.height).toBe(150);
    });

    it('returns rotated bounding box for 90 degree rotation (width and height swapped)', () => {
      const elem = { x: 100, y: 100, width: 200, height: 100, rotation: 90 };
      const aabb = getRotatedAABB(elem);
      // Center is (200, 150). Rotated 90 deg -> width 100, height 200.
      // New top-left: cx - 50 = 150, cy - 100 = 50.
      expect(Math.round(aabb.width)).toBe(100);
      expect(Math.round(aabb.height)).toBe(200);
      expect(Math.round(aabb.x)).toBe(150);
      expect(Math.round(aabb.y)).toBe(50);
    });

    it('returns expanded enclosing bounding box for 45 degree rotation with positive dimensions', () => {
      const elem = { x: 100, y: 100, width: 100, height: 100, rotation: 45 };
      const aabb = getRotatedAABB(elem);
      const expectedSize = Math.round(100 * Math.SQRT2);
      expect(Math.round(aabb.width)).toBe(expectedSize);
      expect(Math.round(aabb.height)).toBe(expectedSize);
      expect(aabb.width).toBeGreaterThan(100);
      expect(aabb.height).toBeGreaterThan(100);
    });
  });

  describe('2. Clamped Spatial Subtraction & Obstacle Intersection', () => {
    const pageArea: RectBounds = { x: 10, y: 10, width: 200, height: 200 };

    it('clamps obstacle crossing boundary without negative slice width', () => {
      // Obstacle crossing the right boundary (e.g. spine at x=210)
      const obstacle: RectBounds = { x: 180, y: 50, width: 60, height: 80 };
      const clamped = getClampedIntersection(pageArea, obstacle);
      expect(clamped).not.toBeNull();
      expect(clamped!.x).toBe(180);
      expect(clamped!.y).toBe(50);
      expect(clamped!.width).toBe(30); // 210 - 180
      expect(clamped!.height).toBe(80);
    });

    it('returns null when obstacle is completely outside the page box', () => {
      const obstacle: RectBounds = { x: 250, y: 50, width: 50, height: 50 };
      const clamped = getClampedIntersection(pageArea, obstacle);
      expect(clamped).toBeNull();
    });

    it('slices pageArea into non-overlapping maximal sub-boxes around internal obstacle', () => {
      // Obstacle in center of page (x=80..130, y=80..130)
      const lockedFrames: PhotoFrameElement[] = [
        {
          id: 'locked-1',
          type: 'photo',
          photoId: 'photo-1',
          filePath: '/p1.jpg',
          previewPath: '',
          thumbnailPath: '',
          fileName: 'p1.jpg',
          x: 80,
          y: 80,
          width: 50,
          height: 50,
          rotation: 0,
          zIndex: 1,
          cropX: 0,
          cropY: 0,
          cropScale: 1.0,
          cropRotation: 0,
          borderEnabled: false,
          borderWidth: 0,
          borderColor: '#fff',
          opacity: 1.0,
          locked: true,
        },
      ];

      const subBoxes = computeFreePageSubBoxes(pageArea, lockedFrames, 4);
      expect(subBoxes.length).toBeGreaterThanOrEqual(1);

      // Verify no sub-box overlaps the locked frame
      for (const box of subBoxes) {
        const intersects = !(
          box.x >= 80 + 50 ||
          box.x + box.width <= 80 ||
          box.y >= 80 + 50 ||
          box.y + box.height <= 80
        );
        expect(intersects).toBe(false);
      }
    });

    it('handles rotated obstacle slicing cleanly', () => {
      const rotatedObstacle: PhotoFrameElement = {
        id: 'excluded-rotated',
        type: 'photo',
        photoId: 'photo-rot',
        filePath: '/rot.jpg',
        previewPath: '',
        thumbnailPath: '',
        fileName: 'rot.jpg',
        x: 80,
        y: 80,
        width: 40,
        height: 40,
        rotation: 45,
        zIndex: 1,
        cropX: 0,
        cropY: 0,
        cropScale: 1.0,
        cropRotation: 0,
        borderEnabled: false,
        borderWidth: 0,
        borderColor: '#fff',
        opacity: 1.0,
        excludeFromAdaptiveLayout: true,
      };

      const subBoxes = computeFreePageSubBoxes(pageArea, [rotatedObstacle], 4);
      expect(subBoxes.length).toBeGreaterThanOrEqual(1);

      const aabb = getRotatedAABB(rotatedObstacle);
      for (const box of subBoxes) {
        const intersects = !(
          box.x >= aabb.x + aabb.width ||
          box.x + box.width <= aabb.x ||
          box.y >= aabb.y + aabb.height ||
          box.y + box.height <= aabb.y
        );
        expect(intersects).toBe(false);
      }
    });
  });

  describe('3. Adaptive Layout Variations with Excluded & Locked Frames', () => {
    it('generates layout variations where no rect collides with excludeFromAdaptiveLayout frame', () => {
      const excludedFrame: PhotoFrameElement = {
        id: 'frame-excl',
        type: 'photo',
        photoId: 'photo-excl',
        filePath: '/excluded.jpg',
        previewPath: '',
        thumbnailPath: '',
        fileName: 'excluded.jpg',
        x: 20,
        y: 20,
        width: 100,
        height: 100,
        rotation: 0,
        zIndex: 1,
        cropX: 0,
        cropY: 0,
        cropScale: 1.0,
        cropRotation: 0,
        borderEnabled: false,
        borderWidth: 0,
        borderColor: '#fff',
        opacity: 1.0,
        excludeFromAdaptiveLayout: true,
      };

      const params: TemplateParams = {
        spreadWidth: 400,
        spreadHeight: 300,
        isSpread: true,
        safeMargin: 10,
        safeMarginTop: 10,
        safeMarginBottom: 10,
        safeMarginOutside: 10,
        safeMarginSpine: 10,
        gutterWidth: 0,
        spacing: 4,
        lockedElements: [excludedFrame],
      };

      const photos = [
        { id: 'p1', photoId: 'p1', filePath: '/p1.jpg', photoAspect: 1.5 },
        { id: 'p2', photoId: 'p2', filePath: '/p2.jpg', photoAspect: 1.0 },
      ];

      const variations = generateAdaptiveLayoutVariations(params, photos);
      expect(variations.length).toBeGreaterThan(0);

      // Check that EVERY variation has rects that do not collide with excludedFrame
      for (const v of variations) {
        for (const rect of v.rects) {
          const collides = !(
            rect.x >= excludedFrame.x + excludedFrame.width - 0.01 ||
            rect.x + rect.width <= excludedFrame.x + 0.01 ||
            rect.y >= excludedFrame.y + excludedFrame.height - 0.01 ||
            rect.y + rect.height <= excludedFrame.y + 0.01
          );
          expect(collides).toBe(false);
        }
      }
    });

    it('returns empty variations array without throwing when photo count is 0', () => {
      const params: TemplateParams = {
        spreadWidth: 400,
        spreadHeight: 300,
        isSpread: true,
        safeMargin: 10,
        gutterWidth: 0,
        spacing: 4,
        lockedElements: [],
      };
      const variations = generateAdaptiveLayoutVariations(params, []);
      expect(variations).toEqual([]);
    });
  });

  describe('4. Fisher-Yates Content Shuffle Invariance (shuffleElementsPhotos)', () => {
    it('preserves photo content of excluded and locked frames across 50 consecutive shuffles', () => {
      const elements: PhotoFrameElement[] = [
        {
          id: 'unlocked-1',
          type: 'photo',
          photoId: 'u1',
          filePath: '/u1.jpg',
          fileName: 'u1.jpg',
          previewPath: '',
          thumbnailPath: '',
          x: 10,
          y: 10,
          width: 80,
          height: 80,
          rotation: 0,
          zIndex: 1,
          cropX: 0,
          cropY: 0,
          cropScale: 1.0,
          cropRotation: 0,
          borderEnabled: false,
          borderWidth: 0,
          borderColor: '#fff',
          opacity: 1.0,
        },
        {
          id: 'excluded-frame',
          type: 'photo',
          photoId: 'excl-static',
          filePath: '/static-excluded.jpg',
          fileName: 'static-excluded.jpg',
          previewPath: '',
          thumbnailPath: '',
          x: 100,
          y: 10,
          width: 80,
          height: 80,
          rotation: 0,
          zIndex: 2,
          cropX: 0,
          cropY: 0,
          cropScale: 1.0,
          cropRotation: 0,
          borderEnabled: false,
          borderWidth: 0,
          borderColor: '#fff',
          opacity: 1.0,
          excludeFromAdaptiveLayout: true,
        },
        {
          id: 'locked-frame',
          type: 'photo',
          photoId: 'locked-static',
          filePath: '/static-locked.jpg',
          fileName: 'static-locked.jpg',
          previewPath: '',
          thumbnailPath: '',
          x: 200,
          y: 10,
          width: 80,
          height: 80,
          rotation: 0,
          zIndex: 3,
          cropX: 0,
          cropY: 0,
          cropScale: 1.0,
          cropRotation: 0,
          borderEnabled: false,
          borderWidth: 0,
          borderColor: '#fff',
          opacity: 1.0,
          locked: true,
        },
        {
          id: 'unlocked-2',
          type: 'photo',
          photoId: 'u2',
          filePath: '/u2.jpg',
          fileName: 'u2.jpg',
          previewPath: '',
          thumbnailPath: '',
          x: 300,
          y: 10,
          width: 80,
          height: 80,
          rotation: 0,
          zIndex: 4,
          cropX: 0,
          cropY: 0,
          cropScale: 1.0,
          cropRotation: 0,
          borderEnabled: false,
          borderWidth: 0,
          borderColor: '#fff',
          opacity: 1.0,
        },
      ];

      for (let i = 0; i < 50; i++) {
        const shuffled = shuffleElementsPhotos(elements);
        // Excluded element must stay intact at index 1
        expect(shuffled[1]?.photoId).toBe('excl-static');
        expect(shuffled[1]?.filePath).toBe('/static-excluded.jpg');
        // Locked element must stay intact at index 2
        expect(shuffled[2]?.photoId).toBe('locked-static');
        expect(shuffled[2]?.filePath).toBe('/static-locked.jpg');
        // Total elements count remains 4
        expect(shuffled.length).toBe(4);
      }
    });
  });

  describe('5. Carousel Store Parity: Shuffle & Swap Guard', () => {
    it('shuffleSlidePhotos shuffles unlocked photos while preserving excluded frames', () => {
      const carousel = createInitialCarousel('test-carousel', '1:1', 1);
      const slide = carousel.slides[0]!;

      slide.elements = [
        {
          type: 'photo',
          id: 'c-unlocked-1',
          photoId: 'c-p1',
          filePath: '/c-p1.jpg',
          fileName: 'c-p1.jpg',
          x: 50,
          y: 50,
          width: 400,
          height: 400,
        },
        {
          type: 'photo',
          id: 'c-excluded-1',
          photoId: 'c-excl',
          filePath: '/c-excl.jpg',
          fileName: 'c-excl.jpg',
          x: 500,
          y: 50,
          width: 400,
          height: 400,
          excludeFromAdaptiveLayout: true,
        },
        {
          type: 'photo',
          id: 'c-unlocked-2',
          photoId: 'c-p2',
          filePath: '/c-p2.jpg',
          fileName: 'c-p2.jpg',
          x: 50,
          y: 500,
          width: 400,
          height: 400,
        },
      ];

      useCarouselStore.setState({ currentCarousel: carousel, activeSlideIndex: 0 });

      useCarouselStore.getState().shuffleSlidePhotos(0);

      const updated = useCarouselStore.getState().currentCarousel!.slides[0]!;
      const excl = updated.elements.find((el) => el.id === 'c-excluded-1') as CarouselPhotoFrame;
      expect(excl).toBeDefined();
      expect(excl.photoId).toBe('c-excl');
      expect(excl.filePath).toBe('/c-excl.jpg');
    });

    it('swapFrames rejects swapping when either frame is locked: true', () => {
      const carousel = createInitialCarousel('test-carousel-swap', '1:1', 1);
      const slide = carousel.slides[0]!;

      slide.elements = [
        {
          type: 'photo',
          id: 'swap-locked-a',
          photoId: 'photo-locked-a',
          filePath: '/locked-a.jpg',
          x: 50,
          y: 50,
          width: 400,
          height: 400,
          locked: true,
        },
        {
          type: 'photo',
          id: 'swap-unlocked-b',
          photoId: 'photo-unlocked-b',
          filePath: '/unlocked-b.jpg',
          x: 500,
          y: 50,
          width: 400,
          height: 400,
          locked: false,
        },
      ];

      useCarouselStore.setState({ currentCarousel: carousel, activeSlideIndex: 0 });

      // Attempt to swap locked frame A with unlocked frame B
      useCarouselStore.getState().swapFrames('swap-locked-a', 'swap-unlocked-b');

      const updated = useCarouselStore.getState().currentCarousel!.slides[0]!;
      const frameA = updated.elements.find((el) => el.id === 'swap-locked-a') as CarouselPhotoFrame;
      const frameB = updated.elements.find((el) => el.id === 'swap-unlocked-b') as CarouselPhotoFrame;

      // Swapping should have been blocked
      expect(frameA.filePath).toBe('/locked-a.jpg');
      expect(frameB.filePath).toBe('/unlocked-b.jpg');
    });

    it('swapFrames successfully swaps photo payloads when neither frame is locked', () => {
      const carousel = createInitialCarousel('test-carousel-swap-valid', '1:1', 1);
      const slide = carousel.slides[0]!;

      slide.elements = [
        {
          type: 'photo',
          id: 'swap-valid-a',
          photoId: 'photo-valid-a',
          filePath: '/valid-a.jpg',
          fileName: 'valid-a.jpg',
          x: 50,
          y: 50,
          width: 400,
          height: 400,
        },
        {
          type: 'photo',
          id: 'swap-valid-b',
          photoId: 'photo-valid-b',
          filePath: '/valid-b.jpg',
          fileName: 'valid-b.jpg',
          x: 500,
          y: 50,
          width: 400,
          height: 400,
        },
      ];

      useCarouselStore.setState({ currentCarousel: carousel, activeSlideIndex: 0 });

      useCarouselStore.getState().swapFrames('swap-valid-a', 'swap-valid-b');

      const updated = useCarouselStore.getState().currentCarousel!.slides[0]!;
      const frameA = updated.elements.find((el) => el.id === 'swap-valid-a') as CarouselPhotoFrame;
      const frameB = updated.elements.find((el) => el.id === 'swap-valid-b') as CarouselPhotoFrame;

      expect(frameA.filePath).toBe('/valid-b.jpg');
      expect(frameB.filePath).toBe('/valid-a.jpg');
    });
  });
});
