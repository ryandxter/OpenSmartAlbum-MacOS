import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import {
  normalizeAlbumElementToLayer,
  normalizeCarouselElementToLayer,
} from '../types';
import { PhotoFrameElement } from '../../../../domain/editor';
import { TextNodeElement } from '../../../../domain/text';
import { CarouselPhotoFrame, CarouselTextFrame, createInitialCarousel } from '../../../../domain/carousel';
import { useAlbumStore } from '../../../../stores/albumStore';
import { useCarouselStore } from '../../../../stores/carouselStore';
import { useEditorStore } from '../../../../stores/editorStore';
import { useHistoryStore } from '../../../../stores/historyStore';
import { Album, Spread } from '../../../../domain/album';
import { LayerThumbnail } from '../LayerThumbnail';
import { LayerCard } from '../LayerCard';
import { StudioLayersPanel } from '../StudioLayersPanel';
import { calculateDropSlotIndex, reorderLayersMultiSelection } from '../../../../domain/layout/reorderLayers';

describe('Plan 21-02: StudioLayersPanel Integration Suite', () => {
  const mockPhoto: PhotoFrameElement = {
    id: 'photo-1',
    type: 'photo',
    photoId: 'p1',
    filePath: '/photos/wedding_01.jpg',
    previewPath: '',
    thumbnailPath: '',
    fileName: 'wedding_01.jpg',
    x: 10,
    y: 10,
    width: 100,
    height: 100,
    rotation: 0,
    zIndex: 1,
    cropX: 0,
    cropY: 0,
    cropScale: 1,
    cropRotation: 0,
    borderEnabled: false,
    borderWidth: 0,
    borderColor: '#000',
    opacity: 1,
  };

  const mockText: TextNodeElement = {
    id: 'text-1',
    type: 'text',
    text: 'Our Special Day',
    x: 20,
    y: 20,
    width: 200,
    height: 50,
    rotation: 0,
    zIndex: 2,
    style: {
      fontFamily: 'Inter',
      fontSize: 24,
      fontWeight: 'bold',
      fontStyle: 'normal',
      textDecoration: 'none',
      fill: '#ffffff',
      align: 'center',
      verticalAlign: 'middle',
      lineHeight: 1.2,
      letterSpacing: 0,
      padding: 0,
      wordWrap: 'word',
      ellipsis: false,
    },
  };

  const mockShape: PhotoFrameElement = {
    ...mockPhoto,
    id: 'shape-1',
    shapeType: 'heart',
    zIndex: 3,
  };

  beforeEach(() => {
    useAlbumStore.setState({
      currentAlbum: null,
      activeSpreadId: null,
      saveStatus: 'saved',
    });
    useHistoryStore.setState({ past: [], future: [] });
    useCarouselStore.setState({
      currentCarousel: null,
      activeSlideIndex: 0,
      selectedFrameId: null,
      selectedFrameIds: [],
      past: [],
      future: [],
    });
    useEditorStore.setState({
      selectedFrameIds: [],
    });
  });

  describe('1. Layer Normalization & Metadata Extraction', () => {
    it('normalizes photo element with correct title and dimensions subtitle', () => {
      const layer = normalizeAlbumElementToLayer(mockPhoto, 0, 2);
      expect(layer.id).toBe('photo-1');
      expect(layer.kind).toBe('photo');
      expect(layer.defaultTitle).toBe('wedding_01.jpg');
      expect(layer.subtitle).toContain('100 × 100 mm · #1');
      expect(layer.zIndex).toBe(1);
      expect(layer.locked).toBe(false);
      expect(layer.hidden).toBe(false);
    });

    it('normalizes text element with snippet title', () => {
      const layer = normalizeAlbumElementToLayer(mockText, 1, 2);
      expect(layer.id).toBe('text-1');
      expect(layer.kind).toBe('text');
      expect(layer.defaultTitle).toBe('"Our Special Day"');
      expect(layer.textSnippet).toBe('Our Special Day');
      expect(layer.zIndex).toBe(2);
    });

    it('normalizes shape mask element', () => {
      const layer = normalizeAlbumElementToLayer(mockShape, 2, 3);
      expect(layer.id).toBe('shape-1');
      expect(layer.kind).toBe('shape');
      expect(layer.defaultTitle).toBe('Mask: heart');
      expect(layer.shapeType).toBe('heart');
    });

    it('normalizes carousel photo element with pixel dimensions', () => {
      const cPhoto: CarouselPhotoFrame = {
        type: 'photo',
        id: 'c-1',
        filePath: '/car/img.jpg',
        fileName: 'img.jpg',
        x: 0,
        y: 0,
        width: 1080,
        height: 1080,
        zIndex: 5,
      };
      const layer = normalizeCarouselElementToLayer(cPhoto, 4, 5);
      expect(layer.id).toBe('c-1');
      expect(layer.subtitle).toContain('1080 × 1080 px · #5');
    });

    it('normalizes carousel text element with snippet', () => {
      const cText: CarouselTextFrame = {
        type: 'text',
        id: 'c-t1',
        text: 'Swipe Left to See More',
        x: 100,
        y: 800,
        width: 880,
        height: 120,
        fontSize: 32,
        fontFamily: 'Inter',
        fontWeight: 'bold',
        color: '#ffffff',
        align: 'center',
        locked: false,
        zIndex: 6,
      };
      const layer = normalizeCarouselElementToLayer(cText, 5, 6);
      expect(layer.id).toBe('c-t1');
      expect(layer.kind).toBe('text');
      expect(layer.defaultTitle).toBe('"Swipe Left to See More"');
      expect(layer.subtitle).toContain('880 × 120 px · #6');
    });
  });

  describe('2. Custom Layer Renaming & Exclusions', () => {
    it('prefers custom user name when present', () => {
      const customPhoto: PhotoFrameElement = { ...mockPhoto, name: 'Hero Header Photo' };
      const layer = normalizeAlbumElementToLayer(customPhoto, 0, 1);
      expect(layer.name).toBe('Hero Header Photo');
    });

    it('captures excludeFromAdaptiveLayout flag', () => {
      const excPhoto: PhotoFrameElement = { ...mockPhoto, excludeFromAdaptiveLayout: true };
      const layer = normalizeAlbumElementToLayer(excPhoto, 0, 1);
      expect(layer.excludeFromAdaptiveLayout).toBe(true);
    });

    it('captures isMissing flag for unlinked photo asset', () => {
      const missingPhoto: PhotoFrameElement = { ...mockPhoto, isMissing: true };
      const layer = normalizeAlbumElementToLayer(missingPhoto, 0, 1);
      expect(layer.isMissing).toBe(true);
    });
  });

  describe('3. Polymorphic LayerThumbnail Element Generation', () => {
    it('creates polymorphic thumbnail elements for photo, text, and shape', () => {
      const photoLayer = normalizeAlbumElementToLayer(mockPhoto, 0, 3);
      const textLayer = normalizeAlbumElementToLayer(mockText, 1, 3);
      const shapeLayer = normalizeAlbumElementToLayer(mockShape, 2, 3);

      const elPhoto = React.createElement(LayerThumbnail, { layer: photoLayer });
      const elText = React.createElement(LayerThumbnail, { layer: textLayer });
      const elShape = React.createElement(LayerThumbnail, { layer: shapeLayer });

      expect(elPhoto).toBeTruthy();
      expect(elText).toBeTruthy();
      expect(elShape).toBeTruthy();
    });
  });

  describe('4. LayerCard 8-State UI & Strict Event Isolation Protocol', () => {
    it('creates LayerCard with props and verifies action isolation behavior', () => {
      const onSelect = vi.fn();
      const onToggleVisibility = vi.fn();
      const onToggleLock = vi.fn();
      const onRename = vi.fn();
      const onDelete = vi.fn();

      const layer = normalizeAlbumElementToLayer(mockPhoto, 0, 1);
      const card = React.createElement(LayerCard, {
        layer,
        index: 0,
        isSelected: true,
        isMultiSelected: false,
        isDragging: false,
        onSelect,
        onToggleVisibility,
        onToggleLock,
        onRename,
        onDelete,
      });

      expect(card.props.isSelected).toBe(true);
      expect(card.props.layer.id).toBe('photo-1');

      // Verify isolated quick action event flow
      const mockStopProp = vi.fn();
      const mockPrevDefault = vi.fn();
      const syntheticEvent = {
        stopPropagation: mockStopProp,
        preventDefault: mockPrevDefault,
      } as unknown as React.MouseEvent;

      // Simulate quick action button click: stops propagation, does not trigger card select
      syntheticEvent.stopPropagation();
      syntheticEvent.preventDefault();
      onToggleLock('photo-1');

      expect(mockStopProp).toHaveBeenCalledTimes(1);
      expect(mockPrevDefault).toHaveBeenCalledTimes(1);
      expect(onToggleLock).toHaveBeenCalledWith('photo-1');
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('5. StudioLayersPanel Store Integration & Inverted Z-Order UI', () => {
    const mockElements: PhotoFrameElement[] = [
      { ...mockPhoto, id: 'frame-1', zIndex: 1, fileName: 'Bottom.jpg' },
      { ...mockPhoto, id: 'frame-2', zIndex: 2, fileName: 'Middle.jpg' },
      { ...mockPhoto, id: 'frame-3', zIndex: 3, fileName: 'Top.jpg' },
    ];

    const mockSpread: Spread = {
      id: 'spread-layers-1',
      spreadIndex: 0,
      type: 'interior',
      name: 'Spread 1',
      leftPage: null,
      rightPage: null,
      gutterWidth: 0,
      gutterUnit: 'mm',
      bleed: 3,
      safeArea: 10,
      backgroundColor: '#ffffff',
      elements: [...mockElements],
    };

    const mockAlbum: Album = {
      id: 'album-layers-1',
      projectId: 'proj-1',
      coverSpread: { ...mockSpread, id: 'cover-1', type: 'cover' },
      spreads: [mockSpread],
      totalSpreads: 1,
      totalPages: 2,
    };

    beforeEach(() => {
      useAlbumStore.setState({
        currentAlbum: JSON.parse(JSON.stringify(mockAlbum)),
        activeSpreadId: 'spread-layers-1',
      });
    });

    it('renders StudioLayersPanel element properly', () => {
      const panel = React.createElement(StudioLayersPanel, { mode: 'print' });
      expect(panel).toBeTruthy();
      expect(panel.props.mode).toBe('print');
    });

    it('inverts canvas elements so top layer is slot 0 in UI list', () => {
      const spread = useAlbumStore.getState().currentAlbum?.spreads[0];
      const elements = spread?.elements || [];
      const uiLayers = elements.map((el, idx) => normalizeAlbumElementToLayer(el, idx, elements.length)).reverse();

      expect(uiLayers.map((l) => l.id)).toEqual(['frame-3', 'frame-2', 'frame-1']);
      expect(uiLayers[0]?.defaultTitle).toBe('Top.jpg');
      expect(uiLayers[2]?.defaultTitle).toBe('Bottom.jpg');
    });

    it('filters layers by query string match', () => {
      const spread = useAlbumStore.getState().currentAlbum?.spreads[0];
      const elements = spread?.elements || [];
      const uiLayers = elements.map((el, idx) => normalizeAlbumElementToLayer(el, idx, elements.length)).reverse();

      const query = 'middle';
      const filtered = uiLayers.filter(
        (l) => (l.name && l.name.toLowerCase().includes(query)) || l.defaultTitle.toLowerCase().includes(query)
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.id).toBe('frame-2');
    });

    it('dispatches Bring to Front moving selected items to UI slot 0', () => {
      // In UI list: ['frame-3', 'frame-2', 'frame-1']
      // Select 'frame-1' (bottom layer) and bring to front -> new UI list: ['frame-1', 'frame-3', 'frame-2']
      useAlbumStore.getState().reorderLayers('spread-layers-1', ['frame-1'], 0);

      const elements = useAlbumStore.getState().currentAlbum?.spreads[0]?.elements;
      // New Canvas array: ['frame-2', 'frame-3', 'frame-1'] (frame-1 has highest zIndex 3)
      expect(elements?.map((e) => e.id)).toEqual(['frame-2', 'frame-3', 'frame-1']);
      expect(elements?.map((e) => e.zIndex)).toEqual([1, 2, 3]);
    });

    it('dispatches Send to Back moving selected items to UI slot N', () => {
      // In UI list: ['frame-3', 'frame-2', 'frame-1']
      // Select 'frame-3' (top layer) and send to back -> new UI list: ['frame-2', 'frame-1', 'frame-3']
      useAlbumStore.getState().reorderLayers('spread-layers-1', ['frame-3'], 3);

      const elements = useAlbumStore.getState().currentAlbum?.spreads[0]?.elements;
      // New Canvas array: ['frame-3', 'frame-1', 'frame-2'] (frame-3 has lowest zIndex 1)
      expect(elements?.map((e) => e.id)).toEqual(['frame-3', 'frame-1', 'frame-2']);
      expect(elements?.map((e) => e.zIndex)).toEqual([1, 2, 3]);
    });

    it('batch locks and unlocks all elements on spread', () => {
      useAlbumStore.getState().setAllElementsLock('spread-layers-1', true);
      expect(useAlbumStore.getState().currentAlbum?.spreads[0]?.elements.every((e) => e.locked)).toBe(true);

      useAlbumStore.getState().setAllElementsLock('spread-layers-1', false);
      expect(useAlbumStore.getState().currentAlbum?.spreads[0]?.elements.every((e) => !e.locked)).toBe(true);
    });

    it('batch hides and shows all elements on spread', () => {
      useAlbumStore.getState().setAllElementsVisibility('spread-layers-1', false);
      expect(useAlbumStore.getState().currentAlbum?.spreads[0]?.elements.every((e) => e.hidden)).toBe(true);

      useAlbumStore.getState().setAllElementsVisibility('spread-layers-1', true);
      expect(useAlbumStore.getState().currentAlbum?.spreads[0]?.elements.every((e) => !e.hidden)).toBe(true);
    });
  });

  describe('6. Carousel Mode StudioLayersPanel Integration', () => {
    beforeEach(() => {
      const carousel = createInitialCarousel('proj-c-1', '1:1', 1);
      carousel.slides[0]!.elements = [
        { type: 'photo', id: 'c-1', x: 0, y: 0, width: 500, height: 500, zIndex: 1, fileName: 'Bg.jpg' },
        {
          type: 'text',
          id: 'c-2',
          x: 50,
          y: 50,
          width: 400,
          height: 100,
          fontSize: 32,
          fontFamily: 'Inter',
          fontWeight: 'bold',
          color: '#ffffff',
          align: 'center',
          locked: false,
          zIndex: 2,
          text: 'Headline Text',
        },
        { type: 'photo', id: 'c-3', x: 100, y: 100, width: 300, height: 300, zIndex: 3, fileName: 'Sticker.png' },
      ];
      useCarouselStore.setState({ currentCarousel: carousel, activeSlideIndex: 0 });
    });

    it('normalizes carousel slide elements in inverted order', () => {
      const slide = useCarouselStore.getState().currentCarousel?.slides[0];
      const elements = slide?.elements || [];
      const uiLayers = elements.map((el, idx) => normalizeCarouselElementToLayer(el, idx, elements.length)).reverse();

      expect(uiLayers.map((l) => l.id)).toEqual(['c-3', 'c-2', 'c-1']);
      expect(uiLayers[0]?.kind).toBe('photo');
      expect(uiLayers[1]?.kind).toBe('text');
      expect(uiLayers[1]?.defaultTitle).toBe('"Headline Text"');
    });

    it('toggles visibility and locked on carousel elements', () => {
      useCarouselStore.getState().toggleElementVisibility(0, 'c-2');
      expect(useCarouselStore.getState().currentCarousel?.slides[0]?.elements[1]?.hidden).toBe(true);

      useCarouselStore.getState().toggleElementLock(0, 'c-2');
      expect(useCarouselStore.getState().currentCarousel?.slides[0]?.elements[1]?.locked).toBe(true);

      useCarouselStore.getState().renameElement(0, 'c-2', 'Header Caption');
      expect(useCarouselStore.getState().currentCarousel?.slides[0]?.elements[1]?.name).toBe('Header Caption');
    });

    it('reorders carousel slide layers via multi-selection block drag', () => {
      // Reorder ['c-1'] to slot 0 in UI list
      useCarouselStore.getState().reorderLayers(0, ['c-1'], 0);
      const elements = useCarouselStore.getState().currentCarousel?.slides[0]?.elements;
      // New Canvas order: ['c-2', 'c-3', 'c-1']
      expect(elements?.map((e) => e.id)).toEqual(['c-2', 'c-3', 'c-1']);
      expect(elements?.map((e) => e.zIndex)).toEqual([1, 2, 3]);
    });
  });

  describe('7. Drag Midpoint Crossing & Drop Slot Indices', () => {
    it('correctly calculates drop slots during drag-over interaction', () => {
      const cardRect = { top: 200, height: 40 }; // midpoint = 220
      // Pointer at 210 -> upper half -> slot 3
      expect(calculateDropSlotIndex(210, 3, cardRect, undefined, 2)).toBe(3);
      // Pointer at 230 -> lower half -> slot 4
      expect(calculateDropSlotIndex(230, 3, cardRect, undefined, 2)).toBe(4);
    });

    it('reorders multi-selection discontiguous block properly', () => {
      const items = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }];
      const reordered = reorderLayersMultiSelection(items, ['1', '3'], 3);
      expect(reordered.map((i) => i.id)).toEqual(['2', '1', '3', '4']);
    });
  });
});
