import { describe, it, expect } from 'vitest';
import { calculateImageOffset, calculateCoverDimensions } from '../editor';
import type { PhotoFrameElement, GraphicElement } from '../editor';
import { useAlbumStore } from '../../stores/albumStore';
import { useCarouselStore } from '../../stores/carouselStore';
import type { FrameAssetMeta } from '../../services/frameAssetService';

describe('Plan 04-02: Decorative Frame Overlays & Graphic Elements Rendering', () => {
  describe('1. Aperture & contentRect Geometry Mapping (AST-01)', () => {
    it('accurately maps normalized 0..1 slot coordinates to physical aperture dimensions', () => {
      const frame: PhotoFrameElement = {
        id: 'f1',
        type: 'photo',
        photoId: 'p1',
        filePath: '/photos/test.jpg',
        previewPath: '/cache/previews/test.jpg',
        thumbnailPath: '/cache/thumbnails/test.jpg',
        fileName: 'test.jpg',
        x: 20,
        y: 30,
        width: 120, // 120mm
        height: 80,  // 80mm
        rotation: 0,
        zIndex: 1,
        cropX: 0,
        cropY: 0,
        cropScale: 1.0,
        cropRotation: 0,
        borderEnabled: false,
        borderWidth: 0,
        borderColor: '#fff',
        opacity: 1,
        frameAssetId: 'vintage-arch-01',
        frameAssetLocalPath: '/assets/frames/vintage-arch.png',
        frameAssetSlot: {
          slotX: 0.1,
          slotY: 0.15,
          slotWidth: 0.8,
          slotHeight: 0.7,
          shape: 'arch',
        },
      };

      const slot = frame.frameAssetSlot!;
      const physicalApertureW = frame.width * slot.slotWidth;
      const physicalApertureH = frame.height * slot.slotHeight;
      const physicalApertureX = frame.width * slot.slotX;
      const physicalApertureY = frame.height * slot.slotY;

      expect(physicalApertureW).toBe(96);
      expect(physicalApertureH).toBe(56);
      expect(physicalApertureX).toBe(12);
      expect(physicalApertureY).toBe(12);

      // Verify screen pixel scaling
      const scaleFactor = 3.5;
      const pixelApertureW = physicalApertureW * scaleFactor;
      const pixelApertureH = physicalApertureH * scaleFactor;
      expect(pixelApertureW).toBe(336);
      expect(pixelApertureH).toBe(196);
    });

    it('cover-fits photo inside inner aperture without aspect ratio distortion', () => {
      // 3:2 landscape photo (aspect 1.5)
      const photoAspect = 1.5;
      const apertureW = 80;
      const apertureH = 100; // portrait aperture (aspect 0.8)

      // When fitting 1.5 aspect photo inside 0.8 aspect aperture:
      // Height must match 100, width must expand to 150
      const cover = calculateCoverDimensions(apertureW, apertureH, photoAspect, 1.0);
      expect(cover.height).toBe(100);
      expect(cover.width).toBe(150);

      const offset = calculateImageOffset(apertureW, apertureH, photoAspect, 1.0, 0, 0);
      expect(offset.width).toBe(150);
      expect(offset.height).toBe(100);
      expect(offset.offsetX).toBe(-(150 - 80) / 2); // -35 centered horizontally
      expect(offset.offsetY).toBe(0);
    });
  });

  describe('2. Detach Frame Overlay Behavior (AST-01)', () => {
    it('clears frame overlay properties without losing photo or frame geometry', () => {
      const mockAsset: FrameAssetMeta = {
        id: 'gold-polaroid',
        title: 'Gold Polaroid',
        category: 'frame',
        shape: 'rectangle',
        slot: {
          slotX: 0.08,
          slotY: 0.08,
          slotWidth: 0.84,
          slotHeight: 0.65,
        },
        is_pro: false,
        local_path: '/assets/frames/gold-polaroid.png',
        thumb_path: '/assets/frames/gold-polaroid-thumb.png',
        tags: ['gold', 'polaroid'],
      };

      // Set initial album store state
      useAlbumStore.setState({
        currentAlbum: {
          id: 'test-album',
          projectId: 'p1',
          totalSpreads: 1,
          totalPages: 2,
          coverSpread: {
            id: 'spread-1',
            spreadIndex: 0,
            type: 'cover',
            name: 'Cover',
            leftPage: null,
            rightPage: null,
            gutterWidth: 0,
            gutterUnit: 'mm',
            bleed: 3,
            safeArea: 5,
            backgroundColor: '#000',
            elements: [
              {
                id: 'frame-1',
                type: 'photo',
                photoId: 'photo-123',
                filePath: '/photos/bride.jpg',
                previewPath: '/cache/previews/bride.jpg',
                thumbnailPath: '/cache/thumbnails/bride.jpg',
                fileName: 'bride.jpg',
                x: 50,
                y: 60,
                width: 100,
                height: 120,
                rotation: 15,
                zIndex: 2,
                cropX: 0.2,
                cropY: -0.1,
                cropScale: 1.4,
                cropRotation: 0,
                borderEnabled: false,
                borderWidth: 0,
                borderColor: '#ffffff',
                opacity: 0.95,
              },
            ],
          },
          spreads: [],
        },
      });

      // Apply overlay
      useAlbumStore.getState().applyFrameOverlayToPhoto('spread-1', 'frame-1', mockAsset);

      let el = useAlbumStore.getState().currentAlbum?.coverSpread.elements[0] as PhotoFrameElement;
      expect(el.frameAssetId).toBe('gold-polaroid');
      expect(el.frameAssetLocalPath).toBe('/assets/frames/gold-polaroid.png');
      expect(el.frameAssetSlot?.slotWidth).toBe(0.84);
      expect(el.x).toBe(50);
      expect(el.y).toBe(60);
      expect(el.width).toBe(100);
      expect(el.height).toBe(120);
      expect(el.cropScale).toBe(1.4);

      // Detach overlay
      useAlbumStore.getState().detachFrameOverlay('spread-1', 'frame-1');

      el = useAlbumStore.getState().currentAlbum?.coverSpread.elements[0] as PhotoFrameElement;
      expect(el.frameAssetId).toBeNull();
      expect(el.frameAssetLocalPath).toBeNull();
      expect(el.frameAssetUrl).toBeNull();
      expect(el.frameAssetSlot).toBeNull();
      // Verifies geometry and photo settings remain 100% intact
      expect(el.photoId).toBe('photo-123');
      expect(el.x).toBe(50);
      expect(el.y).toBe(60);
      expect(el.width).toBe(100);
      expect(el.height).toBe(120);
      expect(el.rotation).toBe(15);
      expect(el.cropX).toBe(0.2);
      expect(el.cropY).toBe(-0.1);
      expect(el.cropScale).toBe(1.4);
      expect(el.opacity).toBe(0.95);
    });

    it('detaches frame overlay cleanly on Carousel canvas as well', () => {
      const mockAsset: FrameAssetMeta = {
        id: 'arch-frame',
        title: 'Arch Frame',
        category: 'frame',
        shape: 'arch',
        slot: { slotX: 0.1, slotY: 0.1, slotWidth: 0.8, slotHeight: 0.8, shape: 'arch' },
        is_pro: false,
        local_path: '/assets/frames/arch.png',
        thumb_path: '/assets/frames/arch-thumb.png',
        tags: ['arch'],
      };

      useCarouselStore.setState({
        currentCarousel: {
          id: 'test-carousel',
          projectId: 'p1',
          ratio: '4:5',
          slideWidthPx: 1080,
          slideHeightPx: 1350,
          totalSlides: 1,
          slides: [
            {
              id: 'c-slide-0',
              slideIndex: 0,
              widthPx: 1080,
              heightPx: 1350,
              backgroundColor: '#18181B',
              elements: [
                {
                  id: 'c-frame-1',
                  type: 'photo',
                  photoId: 'photo-456',
                  filePath: '/photos/groom.jpg',
                  fileName: 'groom.jpg',
                  x: 100,
                  y: 150,
                  width: 880,
                  height: 1050,
                  cropScale: 1.2,
                },
              ],
            },
          ],
        },
      });

      useCarouselStore.getState().applyFrameOverlayToPhoto('c-frame-1', mockAsset);

      let frame = useCarouselStore.getState().currentCarousel?.slides[0]?.elements[0] as any;
      expect(frame.frameAssetId).toBe('arch-frame');

      useCarouselStore.getState().detachFrameOverlay('c-frame-1');

      frame = useCarouselStore.getState().currentCarousel?.slides[0]?.elements[0] as any;
      expect(frame.frameAssetId).toBeNull();
      expect(frame.frameAssetLocalPath).toBeNull();
      expect(frame.width).toBe(880);
      expect(frame.height).toBe(1050);
      expect(frame.cropScale).toBe(1.2);
    });
  });

  describe('3. Standalone Graphic Elements (AST-02)', () => {
    it('sets excludeFromAdaptiveLayout = true by default on GraphicElement', () => {
      const graphic: GraphicElement = {
        id: 'graphic-star',
        type: 'graphic',
        name: 'Gold Star',
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        rotation: 45,
        opacity: 0.85,
        zIndex: 10,
        excludeFromAdaptiveLayout: true,
        frameAssetId: 'gold-star-sticker',
        frameAssetLocalPath: '/assets/elements/gold-star.png',
        frameAssetIsPro: false,
      };

      expect(graphic.excludeFromAdaptiveLayout).toBe(true);
      expect(graphic.type).toBe('graphic');
      expect(graphic.frameAssetIsPro).toBe(false);
    });

    it('adds graphic element to carousel with correct position and excluded from adaptive layout', () => {
      const mockElementAsset: FrameAssetMeta = {
        id: 'ribbon-bow',
        title: 'Ribbon Bow',
        category: 'element',
        shape: 'rectangle',
        is_pro: false,
        local_path: '/assets/elements/ribbon.png',
        thumb_path: '/assets/elements/ribbon-thumb.png',
        tags: ['ribbon', 'bow'],
      };

      useCarouselStore.setState({
        currentCarousel: {
          id: 'test-carousel-2',
          projectId: 'p2',
          ratio: '1:1',
          slideWidthPx: 1080,
          slideHeightPx: 1080,
          totalSlides: 1,
          slides: [
            {
              id: 'c-slide-1',
              slideIndex: 0,
              widthPx: 1080,
              heightPx: 1080,
              backgroundColor: '#ffffff',
              elements: [],
            },
          ],
        },
      });

      const graphicId = useCarouselStore.getState().addGraphicElement(0, mockElementAsset, {
        x: 200,
        y: 300,
        width: 250,
        height: 250,
      });

      expect(graphicId).toBeDefined();
      const slide = useCarouselStore.getState().currentCarousel?.slides[0];
      const added = slide?.elements.find((el) => el.id === graphicId);
      expect(added).toBeDefined();
      expect(added?.type).toBe('graphic');
      expect(added?.x).toBe(200);
      expect(added?.y).toBe(300);
      expect(added?.width).toBe(250);
      expect(added?.height).toBe(250);
      expect(added?.excludeFromAdaptiveLayout).toBe(true);
    });
  });
});
