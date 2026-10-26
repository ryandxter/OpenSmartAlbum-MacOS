import { describe, it, expect } from 'vitest';
import {
  CAROUSEL_RATIO_PRESETS,
  CarouselSlide,
  CarouselPhotoFrame,
  resizeCarouselPost,
} from '../carousel';

describe('Social Media Presets and Live Canvas Resize (FX-06, D-08)', () => {
  describe('Extended Social Media Presets Inventory', () => {
    it('provides all 5 required extended platform presets with exact dimensions', () => {
      // 1. Facebook Post (1200x630)
      const fb = CAROUSEL_RATIO_PRESETS['fb-post'];
      expect(fb).toBeDefined();
      expect(fb.width).toBe(1200);
      expect(fb.height).toBe(630);
      expect(fb.aspectRatio).toBeCloseTo(1200 / 630);

      // 2. Pinterest Pin (1000x1500)
      const pin = CAROUSEL_RATIO_PRESETS['pinterest-pin'];
      expect(pin).toBeDefined();
      expect(pin.width).toBe(1000);
      expect(pin.height).toBe(1500);
      expect(pin.aspectRatio).toBeCloseTo(1000 / 1500);

      // 3. YouTube Thumbnail (1280x720)
      const yt = CAROUSEL_RATIO_PRESETS['yt-thumb'];
      expect(yt).toBeDefined();
      expect(yt.width).toBe(1280);
      expect(yt.height).toBe(720);
      expect(yt.aspectRatio).toBeCloseTo(1280 / 720);

      // 4. X / Twitter Post (1600x900)
      const xPost = CAROUSEL_RATIO_PRESETS['x-post'];
      expect(xPost).toBeDefined();
      expect(xPost.width).toBe(1600);
      expect(xPost.height).toBe(900);
      expect(xPost.aspectRatio).toBeCloseTo(1600 / 900);

      // 5. LinkedIn Post (1200x627)
      const linkedin = CAROUSEL_RATIO_PRESETS['linkedin-post'];
      expect(linkedin).toBeDefined();
      expect(linkedin.width).toBe(1200);
      expect(linkedin.height).toBe(627);
      expect(linkedin.aspectRatio).toBeCloseTo(1200 / 627);
    });

    it('retains standard Instagram presets 1:1, 4:5, 9:16', () => {
      expect(CAROUSEL_RATIO_PRESETS['1:1'].width).toBe(1080);
      expect(CAROUSEL_RATIO_PRESETS['1:1'].height).toBe(1080);

      expect(CAROUSEL_RATIO_PRESETS['4:5'].width).toBe(1080);
      expect(CAROUSEL_RATIO_PRESETS['4:5'].height).toBe(1350);

      expect(CAROUSEL_RATIO_PRESETS['9:16'].width).toBe(1080);
      expect(CAROUSEL_RATIO_PRESETS['9:16'].height).toBe(1920);
    });
  });

  describe('Live Resize: Reflow with Adaptive Layout (mode = "reflow")', () => {
    const createMockSlides = (): CarouselSlide[] => [
      {
        id: 'slide-0',
        slideIndex: 0,
        widthPx: 1080,
        heightPx: 1080,
        backgroundColor: '#ffffff',
        elements: [
          {
            type: 'photo',
            id: 'photo-1',
            x: 90,
            y: 90,
            width: 900,
            height: 900,
            photoAspect: 1.0,
            excludeFromAdaptiveLayout: false,
          } as CarouselPhotoFrame,
          {
            type: 'photo',
            id: 'photo-pinned',
            x: 800,
            y: 800,
            width: 180,
            height: 180,
            photoAspect: 1.0,
            excludeFromAdaptiveLayout: true, // Pinned/excluded
          } as CarouselPhotoFrame,
        ],
      },
    ];

    it('refits participating photo frames adaptively to match the new aspect ratio', () => {
      const slides = createMockSlides();
      const oldDims = { width: 1080, height: 1080 };
      const newDims = { width: 1200, height: 630 }; // Facebook Post (landscape)

      const resized = resizeCarouselPost(slides, oldDims, newDims, 'reflow');

      expect(resized[0]!.widthPx).toBe(1200);
      expect(resized[0]!.heightPx).toBe(630);

      const photo1 = resized[0]!.elements.find((el) => el.id === 'photo-1') as CarouselPhotoFrame;
      expect(photo1).toBeDefined();
      // In reflow mode, participating frame width and height adapt to new bounds
      expect(photo1.width).toBe(Math.round((900 / 1080) * 1200)); // 1000
      expect(photo1.height).toBe(Math.round((900 / 1080) * 630)); // 525
      expect(photo1.x).toBe(Math.round((90 / 1080) * 1200)); // 100
      expect(photo1.y).toBe(Math.round((90 / 1080) * 630)); // 53
    });

    it('preserves proportional aspect ratio for frames with excludeFromAdaptiveLayout: true', () => {
      const slides = createMockSlides();
      const oldDims = { width: 1080, height: 1080 };
      const newDims = { width: 1200, height: 630 };

      const resized = resizeCarouselPost(slides, oldDims, newDims, 'reflow');
      const pinned = resized[0]!.elements.find((el) => el.id === 'photo-pinned') as CarouselPhotoFrame;

      expect(pinned).toBeDefined();
      // Uniform scale = min(1200/1080, 630/1080) = 630/1080 = 0.58333...
      const uniformScale = 630 / 1080;
      expect(pinned.width).toBe(Math.round(180 * uniformScale));
      expect(pinned.height).toBe(Math.round(180 * uniformScale));
      // Aspect ratio of pinned element is strictly preserved (1:1 -> 1:1)
      expect(pinned.width).toBe(pinned.height);
    });

    it('keeps all elements within new slide boundaries', () => {
      const slides = createMockSlides();
      const oldDims = { width: 1080, height: 1080 };
      const newDims = { width: 1000, height: 1500 }; // Pinterest Pin (tall portrait)

      const resized = resizeCarouselPost(slides, oldDims, newDims, 'reflow');
      for (const el of resized[0]!.elements) {
        expect(el.x).toBeGreaterThanOrEqual(0);
        expect(el.y).toBeGreaterThanOrEqual(0);
        expect(el.x + el.width).toBeLessThanOrEqual(1000);
        expect(el.y + el.height).toBeLessThanOrEqual(1500);
      }
    });
  });

  describe('Live Resize: Scale Proportionally (mode = "scale")', () => {
    it('scales all frames using uniform aspect-fit scaling factor', () => {
      const slides: CarouselSlide[] = [
        {
          id: 'slide-0',
          slideIndex: 0,
          widthPx: 1080,
          heightPx: 1080,
          backgroundColor: '#000000',
          elements: [
            {
              type: 'photo',
              id: 'photo-1',
              x: 100,
              y: 100,
              width: 800,
              height: 600,
            } as CarouselPhotoFrame,
          ],
        },
      ];

      const oldDims = { width: 1080, height: 1080 };
      const newDims = { width: 1600, height: 900 }; // X/Twitter post

      const resized = resizeCarouselPost(slides, oldDims, newDims, 'scale');
      const photo = resized[0]!.elements[0] as CarouselPhotoFrame;

      // Scale factor: min(1600/1080, 900/1080) = 900/1080 = 0.8333...
      const scaleFactor = 900 / 1080;
      expect(photo.width).toBe(Math.round(800 * scaleFactor));
      expect(photo.height).toBe(Math.round(600 * scaleFactor));
      // Ratio between width and height is exactly preserved (800 / 600 = 4 / 3)
      expect(photo.width / photo.height).toBeCloseTo(800 / 600, 2);
    });

    it('returns unchanged slides when dimensions match', () => {
      const slides: CarouselSlide[] = [
        {
          id: 'slide-0',
          slideIndex: 0,
          widthPx: 1080,
          heightPx: 1080,
          backgroundColor: '#ffffff',
          elements: [],
        },
      ];
      const dims = { width: 1080, height: 1080 };
      const resized = resizeCarouselPost(slides, dims, dims, 'reflow');
      expect(resized).toBe(slides);
    });
  });
});
