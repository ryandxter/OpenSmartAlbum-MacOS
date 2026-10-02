import { describe, it, expect, beforeEach } from 'vitest';
import {
  canvasToUiLayers,
  uiLayersToCanvas,
  normalizeZIndices,
  reorderLayersMultiSelection,
  calculateDropSlotIndex,
} from '../../domain/layout/reorderLayers';
import { useAlbumStore } from '../albumStore';
import { useCarouselStore } from '../carouselStore';
import { useHistoryStore } from '../historyStore';
import { useEditorStore } from '../editorStore';
import { Album, Spread } from '../../domain/album';
import { PhotoFrameElement } from '../../domain/editor';
import { createInitialCarousel } from '../../domain/carousel';

describe('Plan 21-01: Visual Studio Layers Management & Reordering Store Suite', () => {
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

  describe('1. Layer Inversion & Math Utility Engine', () => {
    it('converts canvas array to UI layer list in reverse order', () => {
      const canvasElements = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
      const uiLayers = canvasToUiLayers(canvasElements);
      expect(uiLayers.map((e) => e.id)).toEqual(['C', 'B', 'A']);
    });

    it('converts UI layer list back to canvas array in reverse order', () => {
      const uiLayers = [{ id: 'C' }, { id: 'B' }, { id: 'A' }];
      const canvasElements = uiLayersToCanvas(uiLayers);
      expect(canvasElements.map((e) => e.id)).toEqual(['A', 'B', 'C']);
    });

    it('normalizes element z-indices monotonically from 1 to N', () => {
      const elements = [{ id: 'A', zIndex: 99 }, { id: 'B' }, { id: 'C', zIndex: 2 }];
      const normalized = normalizeZIndices(elements);
      expect(normalized).toEqual([
        { id: 'A', zIndex: 1 },
        { id: 'B', zIndex: 2 },
        { id: 'C', zIndex: 3 },
      ]);
    });
  });

  describe('2. Multi-Selection Unified Block Drag Algorithm', () => {
    const items = [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }, { id: 'E' }];

    it('moves single selected item to top (slot 0)', () => {
      const result = reorderLayersMultiSelection(items, ['C'], 0);
      expect(result.map((i) => i.id)).toEqual(['C', 'A', 'B', 'D', 'E']);
    });

    it('moves contiguous multi-selection [B, C] to bottom (slot 5)', () => {
      const result = reorderLayersMultiSelection(items, ['B', 'C'], 5);
      expect(result.map((i) => i.id)).toEqual(['A', 'D', 'E', 'B', 'C']);
    });

    it('moves discontiguous multi-selection [B, D] as unified block to top (slot 0)', () => {
      const result = reorderLayersMultiSelection(items, ['B', 'D'], 0);
      expect(result.map((i) => i.id)).toEqual(['B', 'D', 'A', 'C', 'E']);
    });

    it('moves discontiguous multi-selection [A, D] into middle between B and C', () => {
      // Slot 2 in initial [A, B, C, D, E] is before C
      const result = reorderLayersMultiSelection(items, ['A', 'D'], 2);
      expect(result.map((i) => i.id)).toEqual(['B', 'A', 'D', 'C', 'E']);
    });

    it('returns clean copy if selectedIds is empty or contains all items', () => {
      expect(reorderLayersMultiSelection(items, [], 2).map((i) => i.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
      expect(reorderLayersMultiSelection(items, ['A', 'B', 'C', 'D', 'E'], 2).map((i) => i.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
    });

    it('handles edge cases gracefully', () => {
      expect(reorderLayersMultiSelection([], ['A'], 0)).toEqual([]);
      expect(reorderLayersMultiSelection([{ id: 'A' }], ['A'], 0).map((i) => i.id)).toEqual(['A']);
    });
  });

  describe('3. Midpoint Crossing & Hysteresis Calculation', () => {
    const cardRect = { top: 100, height: 40 }; // midpoint = 120

    it('returns cardIndex when pointer is above upper hysteresis boundary', () => {
      // midpoint 120, upper boundary 118
      expect(calculateDropSlotIndex(110, 2, cardRect, undefined, 2)).toBe(2);
    });

    it('returns cardIndex + 1 when pointer is below lower hysteresis boundary', () => {
      // midpoint 120, lower boundary 122
      expect(calculateDropSlotIndex(125, 2, cardRect, undefined, 2)).toBe(3);
    });

    it('preserves existing slot index when pointer is within deadband hysteresis zone', () => {
      // 121 is within [118, 122]
      expect(calculateDropSlotIndex(121, 2, cardRect, 2, 2)).toBe(2);
      expect(calculateDropSlotIndex(121, 2, cardRect, 3, 2)).toBe(3);
    });

    it('handles array of card rectangles properly', () => {
      const rects = [
        { top: 0, height: 40, bottom: 40 },
        { top: 40, height: 40, bottom: 80 },
        { top: 80, height: 40, bottom: 120 },
      ];
      // Above first card
      expect(calculateDropSlotIndex(rects, -10)).toBe(0);
      // Below last card
      expect(calculateDropSlotIndex(rects, 150)).toBe(3);
      // In middle of card 1 (y = 50, midpoint is 60 -> upper half -> slot 1)
      expect(calculateDropSlotIndex(rects, 50)).toBe(1);
      // In lower half of card 1 (y = 70, midpoint is 60 -> lower half -> slot 2)
      expect(calculateDropSlotIndex(rects, 70)).toBe(2);
    });
  });

  describe('4. Print Album Store Layer State Actions & Single Undo Transaction', () => {
    const mockElements: PhotoFrameElement[] = [
      { id: 'frame-1', type: 'photo', photoId: 'p1', filePath: '/p1.jpg', previewPath: '', thumbnailPath: '', fileName: 'p1.jpg', x: 10, y: 10, width: 100, height: 100, rotation: 0, zIndex: 1, cropX: 0, cropY: 0, cropScale: 1, cropRotation: 0, borderEnabled: false, borderWidth: 0, borderColor: '#000', opacity: 1 },
      { id: 'frame-2', type: 'photo', photoId: 'p2', filePath: '/p2.jpg', previewPath: '', thumbnailPath: '', fileName: 'p2.jpg', x: 120, y: 10, width: 100, height: 100, rotation: 0, zIndex: 2, cropX: 0, cropY: 0, cropScale: 1, cropRotation: 0, borderEnabled: false, borderWidth: 0, borderColor: '#000', opacity: 1 },
      { id: 'frame-3', type: 'photo', photoId: 'p3', filePath: '/p3.jpg', previewPath: '', thumbnailPath: '', fileName: 'p3.jpg', x: 230, y: 10, width: 100, height: 100, rotation: 0, zIndex: 3, cropX: 0, cropY: 0, cropScale: 1, cropRotation: 0, borderEnabled: false, borderWidth: 0, borderColor: '#000', opacity: 1 },
    ];

    const mockSpread: Spread = {
      id: 'spread-1',
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
      id: 'album-1',
      projectId: 'proj-1',
      coverSpread: { ...mockSpread, id: 'cover-1', type: 'cover' },
      spreads: [mockSpread],
      totalSpreads: 1,
      totalPages: 2,
    };

    beforeEach(() => {
      useAlbumStore.setState({ currentAlbum: JSON.parse(JSON.stringify(mockAlbum)), activeSpreadId: 'spread-1' });
    });

    it('reorders elements via reorderLayers in UI order and pushes 1 undo entry', () => {
      // In UI layer order: Top is frame-3 (index 0), Middle is frame-2 (index 1), Bottom is frame-1 (index 2)
      // Drag frame-1 (slot 2) to top (slot 0)
      useAlbumStore.getState().reorderLayers('spread-1', ['frame-1'], 0);

      const updated = useAlbumStore.getState().currentAlbum?.spreads[0]?.elements;
      // New UI order: [frame-1, frame-3, frame-2]
      // New Canvas array: [frame-2, frame-3, frame-1]
      expect(updated?.map((e) => e.id)).toEqual(['frame-2', 'frame-3', 'frame-1']);
      expect(updated?.map((e) => e.zIndex)).toEqual([1, 2, 3]);

      // History verified
      expect(useHistoryStore.getState().past.length).toBe(1);
      useAlbumStore.getState().undo();
      const reverted = useAlbumStore.getState().currentAlbum?.spreads[0]?.elements;
      expect(reverted?.map((e) => e.id)).toEqual(['frame-1', 'frame-2', 'frame-3']);
    });

    it('reorders elements on cover spread', () => {
      useAlbumStore.getState().reorderLayers('cover-1', ['frame-1'], 0);
      const updatedCover = useAlbumStore.getState().currentAlbum?.coverSpread.elements;
      expect(updatedCover?.map((e) => e.id)).toEqual(['frame-2', 'frame-3', 'frame-1']);
      expect(updatedCover?.map((e) => e.zIndex)).toEqual([1, 2, 3]);
    });

    it('toggles visibility and locked flags atomically', () => {
      useAlbumStore.getState().toggleElementVisibility('spread-1', 'frame-2');
      expect(useAlbumStore.getState().currentAlbum?.spreads[0]?.elements[1]?.hidden).toBe(true);

      useAlbumStore.getState().toggleElementLock('spread-1', 'frame-2');
      expect(useAlbumStore.getState().currentAlbum?.spreads[0]?.elements[1]?.locked).toBe(true);

      useAlbumStore.getState().renameElement('spread-1', 'frame-2', 'Hero Photo');
      expect(useAlbumStore.getState().currentAlbum?.spreads[0]?.elements[1]?.name).toBe('Hero Photo');
    });

    it('toggles visibility and locked flags on cover spread', () => {
      useAlbumStore.getState().toggleElementVisibility('cover-1', 'frame-1');
      expect(useAlbumStore.getState().currentAlbum?.coverSpread.elements[0]?.hidden).toBe(true);

      useAlbumStore.getState().toggleElementLock('cover-1', 'frame-1');
      expect(useAlbumStore.getState().currentAlbum?.coverSpread.elements[0]?.locked).toBe(true);

      useAlbumStore.getState().renameElement('cover-1', 'frame-1', 'Cover Hero');
      expect(useAlbumStore.getState().currentAlbum?.coverSpread.elements[0]?.name).toBe('Cover Hero');
    });

    it('executes batch lock-all and hide-all in 1 history step', () => {
      useAlbumStore.getState().setAllElementsLock('spread-1', true);
      const allLocked = useAlbumStore.getState().currentAlbum?.spreads[0]?.elements.every((e) => e.locked);
      expect(allLocked).toBe(true);

      useAlbumStore.getState().setAllElementsVisibility('spread-1', false);
      const allHidden = useAlbumStore.getState().currentAlbum?.spreads[0]?.elements.every((e) => e.hidden);
      expect(allHidden).toBe(true);
    });

    it('deletes a single element and updates selection if deleted', () => {
      useEditorStore.setState({ selectedFrameIds: ['frame-2', 'frame-3'] });
      useAlbumStore.getState().deleteSingleElement('spread-1', 'frame-2');
      const elements = useAlbumStore.getState().currentAlbum?.spreads[0]?.elements;
      expect(elements?.map((e) => e.id)).toEqual(['frame-1', 'frame-3']);
      expect(useEditorStore.getState().selectedFrameIds).toEqual(['frame-3']);
    });

    it('delegates editorStore convenience actions to albumStore', () => {
      useEditorStore.getState().renameElement('spread-1', 'frame-1', 'Custom Title');
      expect(useAlbumStore.getState().currentAlbum?.spreads[0]?.elements[0]?.name).toBe('Custom Title');

      useEditorStore.getState().toggleElementVisibility('spread-1', 'frame-1', true);
      expect(useAlbumStore.getState().currentAlbum?.spreads[0]?.elements[0]?.hidden).toBe(false);

      useEditorStore.getState().deleteSingleElement('spread-1', 'frame-1');
      expect(useAlbumStore.getState().currentAlbum?.spreads[0]?.elements.map((e) => e.id)).toEqual(['frame-2', 'frame-3']);
    });
  });

  describe('5. Social Carousel Store Layer State Actions', () => {
    beforeEach(() => {
      const carousel = createInitialCarousel('proj-carousel-1', '1:1', 2);
      // Add 3 frames on slide 0
      carousel.slides[0]!.elements = [
        { type: 'photo', id: 'c-f1', x: 50, y: 50, width: 200, height: 200, zIndex: 1 },
        { type: 'photo', id: 'c-f2', x: 300, y: 50, width: 200, height: 200, zIndex: 2 },
        { type: 'photo', id: 'c-f3', x: 550, y: 50, width: 200, height: 200, zIndex: 3 },
      ];
      useCarouselStore.setState({ currentCarousel: carousel, activeSlideIndex: 0 });
    });

    it('reorders slide elements and pushes history', () => {
      useCarouselStore.getState().reorderLayers(0, ['c-f1'], 0);
      const elements = useCarouselStore.getState().currentCarousel?.slides[0]?.elements;
      expect(elements?.map((e) => e.id)).toEqual(['c-f2', 'c-f3', 'c-f1']);
      expect(elements?.map((e) => e.zIndex)).toEqual([1, 2, 3]);

      // Undo reverts
      expect(useCarouselStore.getState().past.length).toBe(1);
      useCarouselStore.getState().undo();
      const reverted = useCarouselStore.getState().currentCarousel?.slides[0]?.elements;
      expect(reverted?.map((e) => e.id)).toEqual(['c-f1', 'c-f2', 'c-f3']);
    });

    it('handles toggle visibility, lock, rename, and batch actions on carousel slide', () => {
      useCarouselStore.getState().toggleElementVisibility(0, 'c-f2');
      expect(useCarouselStore.getState().currentCarousel?.slides[0]?.elements[1]?.hidden).toBe(true);

      useCarouselStore.getState().toggleElementLock(0, 'c-f2');
      expect(useCarouselStore.getState().currentCarousel?.slides[0]?.elements[1]?.locked).toBe(true);

      useCarouselStore.getState().renameElement(0, 'c-f2', 'Title Card');
      expect(useCarouselStore.getState().currentCarousel?.slides[0]?.elements[1]?.name).toBe('Title Card');

      useCarouselStore.getState().setAllElementsLock(0, true);
      expect(useCarouselStore.getState().currentCarousel?.slides[0]?.elements.every((e) => e.locked)).toBe(true);

      useCarouselStore.getState().setAllElementsVisibility(0, false);
      expect(useCarouselStore.getState().currentCarousel?.slides[0]?.elements.every((e) => e.hidden)).toBe(true);
    });

    it('deletes a single element on carousel slide and cleans up selection', () => {
      useCarouselStore.setState({ selectedFrameId: 'c-f2', selectedFrameIds: ['c-f2', 'c-f3'] });
      useCarouselStore.getState().deleteSingleElement(0, 'c-f2');

      const elements = useCarouselStore.getState().currentCarousel?.slides[0]?.elements;
      expect(elements?.map((e) => e.id)).toEqual(['c-f1', 'c-f3']);
      expect(useCarouselStore.getState().selectedFrameId).toBeNull();
      expect(useCarouselStore.getState().selectedFrameIds).toEqual(['c-f3']);
    });
  });
});
