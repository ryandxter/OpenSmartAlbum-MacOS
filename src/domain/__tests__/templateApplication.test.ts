import { describe, it, expect } from 'vitest';
import {
  assignPhotosToSlots,
  applyTemplateToSpread,
  applyTemplateToSlide,
  generateTemplateSvgPreview,
  LayoutTemplateSpec,
} from '../templates';
import type { PhotoFrameElement } from '../editor';
import type { Spread } from '../album';
import type { Project } from '../project';
import type { CarouselSlide, CarouselPhotoFrame } from '../carousel';

describe('Phase 3: Custom Layout Template Library Domain Logic & Application', () => {
  const dummyProject: Project = {
    id: 'proj-1',
    name: 'Test Album',
    canvasWidth: 200,
    canvasHeight: 100,
    canvasUnit: 'mm',
    canvasDpi: 300,
    spacingValue: 4,
    spacingUnit: 'mm',
    marginEnabled: true,
    marginValue: 10,
    marginUnit: 'mm',
    borderEnabled: false,
    borderWidth: 0,
    borderUnit: 'mm',
    borderColor: '#000000',
    backgroundType: 'solid',
    backgroundColor: '#ffffff',
    projectType: 'print',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleTemplate: LayoutTemplateSpec = {
    version: 1,
    id: 'tpl-1',
    name: '2-Photo Hero Duo',
    canvas: {
      kind: 'spread',
      width: 400,
      height: 200,
      pageWidth: 200,
      gutterWidth: 0,
      unit: 'mm',
      dpi: 300,
    },
    slots: [
      {
        id: 'slot-1',
        x: 20,
        y: 20,
        width: 160,
        height: 160, // 1:1 Square
        page: 'left',
        style: {
          borderEnabled: true,
          borderWidth: 2,
          borderColor: '#ff0000',
          cornerRadii: 8,
          shadowEnabled: true,
          shadowBlur: 12,
        },
      },
      {
        id: 'slot-2',
        x: 220,
        y: 30,
        width: 150,
        height: 100, // 1.5 Landscape
        page: 'right',
        style: {
          borderEnabled: false,
          borderWidth: 0,
          borderColor: '#000000',
          cornerRadii: 4,
        },
      },
    ],
  };

  describe('1. Kuhn-Munkres Hungarian Photo-to-Slot Matching (assignPhotosToSlots)', () => {
    it('optimally assigns portrait photo to portrait slot and landscape photo to landscape slot', () => {
      const photos = [
        { id: 'p-landscape', photoAspect: 1.8, width: 1800, height: 1000 },
        { id: 'p-portrait', photoAspect: 0.67, width: 1000, height: 1500 },
      ];

      const slots = [
        { x: 0, y: 0, width: 80, height: 120 }, // Portrait slot (aspect 0.67)
        { x: 100, y: 0, width: 180, height: 100 }, // Landscape slot (aspect 1.8)
      ];

      const assignments = assignPhotosToSlots(photos, slots);

      expect(assignments).toHaveLength(2);
      expect(assignments[0]?.photo?.id).toBe('p-portrait');
      expect(assignments[1]?.photo?.id).toBe('p-landscape');
    });

    it('generates empty ready-to-drop photo slot when slot count > photo count', () => {
      const photos = [
        { id: 'p-single', photoAspect: 1.5, width: 1500, height: 1000 },
      ];

      const slots = [
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 120, y: 0, width: 100, height: 100 },
        { x: 240, y: 0, width: 100, height: 100 },
      ];

      const assignments = assignPhotosToSlots(photos, slots);

      expect(assignments).toHaveLength(3);
      const assignedCount = assignments.filter((a) => a.photo !== undefined).length;
      const emptyCount = assignments.filter((a) => a.photo === undefined).length;

      expect(assignedCount).toBe(1);
      expect(emptyCount).toBe(2);
    });

    it('returns empty array when slots are empty', () => {
      const photos = [{ id: 'p1', photoAspect: 1.5 }];
      expect(assignPhotosToSlots(photos, [])).toEqual([]);
    });

    it('returns all slots with photo: undefined when photos array is empty', () => {
      const slots = [{ x: 10, y: 10, width: 100, height: 100 }];
      const res = assignPhotosToSlots([], slots);
      expect(res).toHaveLength(1);
      expect(res[0]?.photo).toBeUndefined();
    });
  });

  describe('2. applyTemplateToSpread: Layout Application & Geometry', () => {
    const baseSpread: Spread = {
      id: 'spread-1',
      spreadIndex: 1,
      type: 'interior',
      name: 'Spread 2-3',
      gutterWidth: 0,
      gutterUnit: 'mm',
      bleed: 0,
      safeArea: 10,
      backgroundColor: '#ffffff',
      leftPage: {
        id: 'page-l',
        pageNumber: 2,
        type: 'left',
        width: 200,
        height: 100,
        unit: 'mm',
        bleed: 0,
        safeArea: 10,
        backgroundColor: '#ffffff',
        backgroundType: 'solid',
      },
      rightPage: {
        id: 'page-r',
        pageNumber: 3,
        type: 'right',
        width: 200,
        height: 100,
        unit: 'mm',
        bleed: 0,
        safeArea: 10,
        backgroundColor: '#ffffff',
        backgroundType: 'solid',
      },
      elements: [
        {
          id: 'photo-1',
          type: 'photo',
          photoId: 'photo-asset-1',
          filePath: '/path/1.jpg',
          fileName: '1.jpg',
          previewPath: '/prev/1.jpg',
          thumbnailPath: '/thumb/1.jpg',
          x: 15,
          y: 15,
          width: 80,
          height: 60,
          rotation: 0,
          cropX: 0,
          cropY: 0,
          cropScale: 1,
          cropRotation: 0,
          borderEnabled: false,
          borderWidth: 0,
          borderColor: '#000000',
          opacity: 100,
          zIndex: 1,
          photoAspect: 1.5,
          excludeFromAdaptiveLayout: false,
        },
      ],
    };

    it('maps existing photos to best-fit aspect slots and generates empty frames for extra slots', () => {
      const updated = applyTemplateToSpread(
        sampleTemplate,
        baseSpread,
        dummyProject,
        'spread',
        'fit_safe_margin'
      );

      expect(updated.elements).toHaveLength(2);
      const photoElements = updated.elements as PhotoFrameElement[];

      const populated = photoElements.find((el) => el.filePath === '/path/1.jpg');
      const empty = photoElements.find((el) => el.filePath === '');

      expect(populated).toBeDefined();
      expect(populated?.photoId).toBe('photo-asset-1');

      expect(empty).toBeDefined();
      expect(empty?.photoId).toBeNull();
      expect(empty?.filePath).toBe('');
    });

    it('strictly preserves pinned frames with excludeFromAdaptiveLayout: true at their exact positions', () => {
      const pinnedFrame: PhotoFrameElement = {
        id: 'pinned-logo',
        type: 'photo',
        photoId: 'logo-asset',
        filePath: '/logo.png',
        fileName: 'logo.png',
        previewPath: '/prev/logo.png',
        thumbnailPath: '/thumb/logo.png',
        x: 350,
        y: 10,
        width: 30,
        height: 30,
        rotation: 0,
        cropX: 0,
        cropY: 0,
        cropScale: 1,
        cropRotation: 0,
        borderEnabled: false,
        borderWidth: 0,
        borderColor: '#000000',
        opacity: 80,
        zIndex: 10,
        excludeFromAdaptiveLayout: true,
      };

      const spreadWithPinned: Spread = {
        ...baseSpread,
        elements: [...baseSpread.elements, pinnedFrame],
      };

      const result = applyTemplateToSpread(
        sampleTemplate,
        spreadWithPinned,
        dummyProject,
        'spread',
        'fit_safe_margin'
      );

      const foundPinned = result.elements.find((el) => el.id === 'pinned-logo') as PhotoFrameElement;
      expect(foundPinned).toBeDefined();
      expect(foundPinned.x).toBe(350);
      expect(foundPinned.y).toBe(10);
      expect(foundPinned.width).toBe(30);
      expect(foundPinned.height).toBe(30);
      expect(foundPinned.excludeFromAdaptiveLayout).toBe(true);
      expect(foundPinned.filePath).toBe('/logo.png');
    });

    it('places slots at original coordinates when placementMode is original_position', () => {
      const result = applyTemplateToSpread(
        sampleTemplate,
        baseSpread,
        dummyProject,
        'spread',
        'original_position'
      );

      const slots = result.elements.filter((el) => el.id !== 'pinned-logo') as PhotoFrameElement[];
      const slot1 = slots.find((s) => s.width === 160 && s.height === 160);
      const slot2 = slots.find((s) => s.width === 150 && s.height === 100);

      expect(slot1).toBeDefined();
      expect(slot1?.x).toBe(20);
      expect(slot1?.y).toBe(20);

      expect(slot2).toBeDefined();
      expect(slot2?.x).toBe(220);
      expect(slot2?.y).toBe(30);
    });

    it('transfers granular styles (borders, shadows, cornerRadii) when style options are enabled', () => {
      const result = applyTemplateToSpread(
        sampleTemplate,
        baseSpread,
        dummyProject,
        'spread',
        'original_position',
        { borders: true, shadows: true, cornerRadii: true }
      );

      const slot1 = (result.elements as PhotoFrameElement[]).find((s) => s.width === 160);
      expect(slot1).toBeDefined();
      expect(slot1?.borderEnabled).toBe(true);
      expect(slot1?.borderWidth).toBe(2);
      expect(slot1?.borderColor).toBe('#ff0000');
      expect(slot1?.cornerRadius).toBe(8);
      expect(slot1?.shadowEnabled).toBe(true);
      expect(slot1?.shadowBlur).toBe(12);
    });

    it('leaves existing styles intact when geometryOnly is true', () => {
      const spreadWithStyledPhoto: Spread = {
        ...baseSpread,
        elements: [
          {
            ...baseSpread.elements[0]!,
            borderEnabled: true,
            borderWidth: 5,
            borderColor: '#00ff00',
            cornerRadius: 15,
          } as PhotoFrameElement,
        ],
      };

      const result = applyTemplateToSpread(
        sampleTemplate,
        spreadWithStyledPhoto,
        dummyProject,
        'spread',
        'original_position',
        { geometryOnly: true }
      );

      const mapped = (result.elements as PhotoFrameElement[]).find((s) => s.filePath === '/path/1.jpg');
      expect(mapped).toBeDefined();
      // Should preserve user's existing style, not overwrite with template slot style
      expect(mapped?.borderWidth).toBe(5);
      expect(mapped?.borderColor).toBe('#00ff00');
      expect(mapped?.cornerRadius).toBe(15);
    });

    it('applies to left page target area without disturbing right page elements', () => {
      const rightPagePhoto: PhotoFrameElement = {
        id: 'photo-right-existing',
        type: 'photo',
        photoId: 'photo-asset-r',
        filePath: '/path/right.jpg',
        fileName: 'right.jpg',
        previewPath: '',
        thumbnailPath: '',
        x: 250,
        y: 20,
        width: 100,
        height: 60,
        rotation: 0,
        cropX: 0,
        cropY: 0,
        cropScale: 1,
        cropRotation: 0,
        borderEnabled: false,
        borderWidth: 0,
        borderColor: '#000000',
        opacity: 100,
        zIndex: 1,
        excludeFromAdaptiveLayout: false,
      };

      const spreadTwoPages: Spread = {
        ...baseSpread,
        elements: [...baseSpread.elements, rightPagePhoto],
      };

      const result = applyTemplateToSpread(
        sampleTemplate,
        spreadTwoPages,
        dummyProject,
        'left',
        'fit_safe_margin'
      );

      // The right page element must still exist exactly as before
      const rightElement = result.elements.find((el) => el.id === 'photo-right-existing');
      expect(rightElement).toBeDefined();
      expect(rightElement?.x).toBe(250);
    });
  });

  describe('3. applyTemplateToSlide (Carousel Mode)', () => {
    const baseSlide: CarouselSlide = {
      id: 'slide-1',
      slideIndex: 0,
      widthPx: 1080,
      heightPx: 1080,
      backgroundColor: '#ffffff',
      elements: [
        {
          id: 'c-photo-1',
          type: 'photo',
          photoId: 'c-asset-1',
          filePath: '/slide/1.jpg',
          fileName: '1.jpg',
          previewPath: '',
          thumbnailPath: '',
          x: 100,
          y: 100,
          width: 400,
          height: 400,
          rotation: 0,
          cropX: 0,
          cropY: 0,
          cropScale: 1,
          borderEnabled: false,
          borderWidth: 0,
          borderColor: '#000000',
          excludeFromAdaptiveLayout: false,
        },
      ],
    };

    it('applies template slots to slide and preserves pinned carousel elements', () => {
      const pinnedCarouselEl: CarouselPhotoFrame = {
        id: 'c-pinned',
        type: 'photo',
        photoId: 'badge-asset',
        filePath: '/badge.png',
        fileName: 'badge.png',
        x: 900,
        y: 50,
        width: 100,
        height: 100,
        excludeFromAdaptiveLayout: true,
      };

      const slideWithPinned: CarouselSlide = {
        ...baseSlide,
        elements: [...baseSlide.elements, pinnedCarouselEl],
      };

      const result = applyTemplateToSlide(
        sampleTemplate,
        slideWithPinned,
        1080,
        1080,
        'fit_safe_margin'
      );

      const foundPinned = result.elements.find((el) => el.id === 'c-pinned');
      expect(foundPinned).toBeDefined();
      expect(foundPinned?.x).toBe(900);
      expect(foundPinned?.excludeFromAdaptiveLayout).toBe(true);
    });
  });

  describe('4. generateTemplateSvgPreview', () => {
    it('produces valid SVG containing rects and dashed spine line for spread canvas', () => {
      const svg = generateTemplateSvgPreview(sampleTemplate, 140, 70);
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('<rect');
      expect(svg).toContain('<line'); // Spine dashed line
      expect(svg).toContain('stroke-dasharray="2 2"');
    });
  });
});
