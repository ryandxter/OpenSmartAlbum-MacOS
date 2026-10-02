import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEditorStore } from '../../../stores/editorStore';
import { useAlbumStore } from '../../../stores/albumStore';
import { useCarouselStore } from '../../../stores/carouselStore';
import { useHistoryStore } from '../../../stores/historyStore';
import { PhotoFrameElement } from '../../../domain/editor';
import { CarouselPhotoFrame } from '../../../domain/carousel';

describe('PhotoSwapShortcut & Layout Exclusion Suite', () => {
  const spreadId = 'test-spread-1';

  beforeEach(() => {
    // Reset stores
    useEditorStore.setState({
      selectedFrameIds: [],
      editingCropFrameId: null,
      editingTextElementId: null,
    });

    useAlbumStore.setState({
      currentAlbum: {
        id: 'album-1',
        projectId: 'project-1',
        title: 'Test Album',
        coverSpread: {
          id: 'cover-spread-1',
          spreadIndex: 0,
          type: 'cover',
          name: 'Cover',
          leftPage: null,
          rightPage: null,
          elements: [],
        },
        spreads: [
          {
            id: spreadId,
            spreadIndex: 1,
            type: 'interior',
            name: 'Spread 1',
            leftPage: null,
            rightPage: null,
            elements: [
              {
                id: 'frame-photo-1',
                type: 'photo',
                photoId: 'photo-a',
                filePath: '/photos/a.jpg',
                fileName: 'a.jpg',
                x: 100,
                y: 100,
                width: 300,
                height: 200,
                rotation: 0,
                locked: false,
                excludeFromAdaptiveLayout: false,
              } as PhotoFrameElement,
              {
                id: 'frame-photo-2',
                type: 'photo',
                photoId: 'photo-b',
                filePath: '/photos/b.jpg',
                fileName: 'b.jpg',
                x: 500,
                y: 100,
                width: 300,
                height: 200,
                rotation: 0,
                locked: false,
                excludeFromAdaptiveLayout: false,
              } as PhotoFrameElement,
              {
                id: 'frame-locked-photo',
                type: 'photo',
                photoId: 'photo-locked',
                filePath: '/photos/locked.jpg',
                fileName: 'locked.jpg',
                x: 100,
                y: 400,
                width: 300,
                height: 200,
                rotation: 0,
                locked: true,
                excludeFromAdaptiveLayout: false,
              } as PhotoFrameElement,
              {
                id: 'frame-text-1',
                type: 'text',
                text: 'Hello World',
                x: 500,
                y: 400,
                width: 300,
                height: 80,
                rotation: 0,
                locked: false,
              } as any,
            ],
          },
        ],
      } as any,
      activeSpreadId: spreadId,
    });

    useCarouselStore.getState().initializeCarousel('project-1', '1:1', 2);
    const cc = useCarouselStore.getState().currentCarousel;
    if (cc && cc.slides[0]) {
      const slide0 = cc.slides[0];
      slide0.elements = [
        {
          id: 'c-frame-1',
          type: 'photo',
          photoId: 'photo-c1',
          filePath: '/photos/c1.jpg',
          fileName: 'c1.jpg',
          x: 50,
          y: 50,
          width: 400,
          height: 400,
          rotation: 0,
          locked: false,
          excludeFromAdaptiveLayout: false,
        } as CarouselPhotoFrame,
        {
          id: 'c-frame-2',
          type: 'photo',
          photoId: 'photo-c2',
          filePath: '/photos/c2.jpg',
          fileName: 'c2.jpg',
          x: 500,
          y: 50,
          width: 400,
          height: 400,
          rotation: 0,
          locked: false,
          excludeFromAdaptiveLayout: false,
        } as CarouselPhotoFrame,
        {
          id: 'c-frame-locked',
          type: 'photo',
          photoId: 'photo-c-locked',
          filePath: '/photos/clocked.jpg',
          fileName: 'clocked.jpg',
          x: 50,
          y: 500,
          width: 400,
          height: 400,
          rotation: 0,
          locked: true,
          excludeFromAdaptiveLayout: false,
        } as CarouselPhotoFrame,
      ];
      useCarouselStore.setState({ currentCarousel: { ...cc } });
    }
  });

  describe('1. Print Mode: Shortcut S Photo Swap Invariants', () => {
    it('swaps photos between two unlocked selected photo frames while preserving geometry', () => {
      const { swapFrames } = useEditorStore.getState();
      const spread = useAlbumStore.getState().currentAlbum?.spreads[0]!;

      const f1Before = spread.elements.find((e) => e.id === 'frame-photo-1') as PhotoFrameElement;
      const f2Before = spread.elements.find((e) => e.id === 'frame-photo-2') as PhotoFrameElement;

      expect(f1Before.photoId).toBe('photo-a');
      expect(f2Before.photoId).toBe('photo-b');

      swapFrames(spreadId, 'frame-photo-1', 'frame-photo-2');

      const spreadAfter = useAlbumStore.getState().currentAlbum?.spreads[0]!;
      const f1After = spreadAfter.elements.find((e) => e.id === 'frame-photo-1') as PhotoFrameElement;
      const f2After = spreadAfter.elements.find((e) => e.id === 'frame-photo-2') as PhotoFrameElement;

      // Photo assignments swapped
      expect(f1After.photoId).toBe('photo-b');
      expect(f1After.filePath).toBe('/photos/b.jpg');
      expect(f2After.photoId).toBe('photo-a');
      expect(f2After.filePath).toBe('/photos/a.jpg');

      // Geometry preserved
      expect(f1After.x).toBe(100);
      expect(f1After.y).toBe(100);
      expect(f2After.x).toBe(500);
      expect(f2After.y).toBe(100);
    });

    it('rejects swapping when either photo frame is locked', () => {
      const { swapFrames } = useEditorStore.getState();
      swapFrames(spreadId, 'frame-photo-1', 'frame-locked-photo');

      const spread = useAlbumStore.getState().currentAlbum?.spreads[0]!;
      const f1 = spread.elements.find((e) => e.id === 'frame-photo-1') as PhotoFrameElement;
      const fLocked = spread.elements.find((e) => e.id === 'frame-locked-photo') as PhotoFrameElement;

      expect(f1.photoId).toBe('photo-a');
      expect(fLocked.photoId).toBe('photo-locked');
    });

    it('undo restores original photo assignments in editor store', () => {
      useHistoryStore.getState().clearHistory();
      const { swapFrames } = useEditorStore.getState();
      swapFrames(spreadId, 'frame-photo-1', 'frame-photo-2');

      expect(useHistoryStore.getState().canUndo).toBe(true);
      useAlbumStore.getState().undo();

      const spread = useAlbumStore.getState().currentAlbum?.spreads[0]!;
      const f1 = spread.elements.find((e) => e.id === 'frame-photo-1') as PhotoFrameElement;
      const f2 = spread.elements.find((e) => e.id === 'frame-photo-2') as PhotoFrameElement;

      expect(f1.photoId).toBe('photo-a');
      expect(f2.photoId).toBe('photo-b');
    });
  });

  describe('2. Shortcut S Keydown Handler Simulation & Text Input Guards (Print Mode)', () => {
    function simulatePrintKeyDown(options: {
      key: string;
      ctrlKey?: boolean;
      metaKey?: boolean;
      altKey?: boolean;
      shiftKey?: boolean;
      target?: any;
      editingTextElementId?: string | null;
      selectedFrameIds: string[];
      onToast?: (msg: string) => void;
    }) {
      const target = options.target || { tagName: 'DIV', isContentEditable: false };
      const isEditingText = Boolean(
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable ||
        target?.closest?.('[contenteditable="true"]') ||
        options.editingTextElementId !== null && options.editingTextElementId !== undefined
      );
      if (isEditingText) return;

      const activeSpread = useAlbumStore.getState().currentAlbum?.spreads[0]!;
      const { selectedFrameIds } = options;

      if (options.key.toLowerCase() === 's' && !options.ctrlKey && !options.metaKey && !options.altKey && !options.shiftKey) {
        const selectedPhotos = (activeSpread.elements || []).filter(
          (el): el is PhotoFrameElement =>
            selectedFrameIds.includes(el.id) && el.type === 'photo' && Boolean(el.photoId) && !el.locked
        );

        if (selectedFrameIds.length === 2) {
          if (selectedPhotos.length === 2 && selectedPhotos[0] && selectedPhotos[1]) {
            useEditorStore.getState().swapFrames(activeSpread.id, selectedPhotos[0].id, selectedPhotos[1].id);
            options.onToast?.('✓ Swapped 2 photos');
          } else {
            options.onToast?.('⚠️ Select 2 unlocked photo frames to swap');
          }
        } else if (selectedFrameIds.length === 1) {
          if (selectedPhotos.length === 1) {
            options.onToast?.('⇄ Photo swap handle active — drag to another photo to swap');
          } else {
            options.onToast?.('⚠️ Photo swap handle is only available on unlocked photo frames');
          }
        }
      }
    }

    it('single unlocked photo selection activates swap handle and emits feedback toast', () => {
      const onToast = vi.fn();
      simulatePrintKeyDown({
        key: 's',
        selectedFrameIds: ['frame-photo-1'],
        onToast,
      });

      expect(onToast).toHaveBeenCalledWith('⇄ Photo swap handle active — drag to another photo to swap');
    });

    it('single locked photo selection displays warning and does not activate swap handle', () => {
      const onToast = vi.fn();
      simulatePrintKeyDown({
        key: 's',
        selectedFrameIds: ['frame-locked-photo'],
        onToast,
      });

      expect(onToast).toHaveBeenCalledWith('⚠️ Photo swap handle is only available on unlocked photo frames');
    });

    it('single text frame selection displays warning and does not activate swap handle', () => {
      const onToast = vi.fn();
      simulatePrintKeyDown({
        key: 's',
        selectedFrameIds: ['frame-text-1'],
        onToast,
      });

      expect(onToast).toHaveBeenCalledWith('⚠️ Photo swap handle is only available on unlocked photo frames');
    });

    it('dual unlocked photo selection triggers instant swap and emits toast', () => {
      const onToast = vi.fn();
      simulatePrintKeyDown({
        key: 's',
        selectedFrameIds: ['frame-photo-1', 'frame-photo-2'],
        onToast,
      });

      expect(onToast).toHaveBeenCalledWith('✓ Swapped 2 photos');

      const spread = useAlbumStore.getState().currentAlbum?.spreads[0]!;
      const f1 = spread.elements.find((e) => e.id === 'frame-photo-1') as PhotoFrameElement;
      const f2 = spread.elements.find((e) => e.id === 'frame-photo-2') as PhotoFrameElement;
      expect(f1.photoId).toBe('photo-b');
      expect(f2.photoId).toBe('photo-a');
    });

    it('dual selection with 1 photo and 1 text node rejects swap with warning', () => {
      const onToast = vi.fn();
      simulatePrintKeyDown({
        key: 's',
        selectedFrameIds: ['frame-photo-1', 'frame-text-1'],
        onToast,
      });

      expect(onToast).toHaveBeenCalledWith('⚠️ Select 2 unlocked photo frames to swap');
      const spread = useAlbumStore.getState().currentAlbum?.spreads[0]!;
      const f1 = spread.elements.find((e) => e.id === 'frame-photo-1') as PhotoFrameElement;
      expect(f1.photoId).toBe('photo-a');
    });

    it('dual selection with 1 locked photo rejects swap with warning', () => {
      const onToast = vi.fn();
      simulatePrintKeyDown({
        key: 's',
        selectedFrameIds: ['frame-photo-1', 'frame-locked-photo'],
        onToast,
      });

      expect(onToast).toHaveBeenCalledWith('⚠️ Select 2 unlocked photo frames to swap');
    });

    it('ignores shortcut S when typing inside input or textarea', () => {
      const onToast = vi.fn();
      simulatePrintKeyDown({
        key: 's',
        target: { tagName: 'INPUT', isContentEditable: false },
        selectedFrameIds: ['frame-photo-1', 'frame-photo-2'],
        onToast,
      });

      expect(onToast).not.toHaveBeenCalled();
    });

    it('ignores shortcut S when target has isContentEditable true', () => {
      const onToast = vi.fn();
      simulatePrintKeyDown({
        key: 's',
        target: { tagName: 'DIV', isContentEditable: true },
        selectedFrameIds: ['frame-photo-1', 'frame-photo-2'],
        onToast,
      });

      expect(onToast).not.toHaveBeenCalled();
    });

    it('ignores shortcut S when editingTextElementId is active', () => {
      const onToast = vi.fn();
      simulatePrintKeyDown({
        key: 's',
        editingTextElementId: 'frame-text-1',
        selectedFrameIds: ['frame-photo-1', 'frame-photo-2'],
        onToast,
      });

      expect(onToast).not.toHaveBeenCalled();
    });
  });

  describe('3. Carousel Mode: Dual-Engine Parity & Shortcut S', () => {
    function simulateCarouselKeyDown(options: {
      key: string;
      ctrlKey?: boolean;
      metaKey?: boolean;
      altKey?: boolean;
      shiftKey?: boolean;
      target?: any;
      editingTextId?: string | null;
      selectedFrameIds: string[];
      onToast?: (msg: string) => void;
    }) {
      const target = options.target || { tagName: 'DIV', isContentEditable: false };
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable ||
        target?.closest?.('[contenteditable="true"]') ||
        options.editingTextId !== null && options.editingTextId !== undefined
      ) return;

      const mac = false;
      const cmdOrCtrl = mac ? options.metaKey : options.ctrlKey;

      if (options.key.toLowerCase() === 's' && !cmdOrCtrl && !options.altKey && !options.shiftKey) {
        const { currentCarousel: cc } = useCarouselStore.getState();
        if (!cc) return;

        const activeSlide = cc.slides[0];
        const selectedPhotos = (activeSlide?.elements || []).filter(
          (el): el is CarouselPhotoFrame =>
            options.selectedFrameIds.includes(el.id) && el.type === 'photo' && Boolean(el.filePath) && !el.locked
        );

        if (options.selectedFrameIds.length === 2) {
          if (selectedPhotos.length === 2 && selectedPhotos[0] && selectedPhotos[1]) {
            useCarouselStore.getState().swapFrames(selectedPhotos[0].id, selectedPhotos[1].id);
            options.onToast?.('✓ Swapped 2 photos');
          } else {
            options.onToast?.('⚠️ Select 2 unlocked photo frames to swap');
          }
        } else if (options.selectedFrameIds.length === 1) {
          if (selectedPhotos.length === 1) {
            options.onToast?.('⇄ Photo swap handle active — drag to another photo to swap');
          } else {
            options.onToast?.('⚠️ Photo swap handle is only available on unlocked photo frames');
          }
        }
      }
    }

    it('swaps photos between two unlocked carousel frames with full parity', () => {
      const { swapFrames } = useCarouselStore.getState();
      swapFrames('c-frame-1', 'c-frame-2');

      const cc = useCarouselStore.getState().currentCarousel!;
      const f1 = cc.slides[0]?.elements.find((e) => e.id === 'c-frame-1') as CarouselPhotoFrame;
      const f2 = cc.slides[0]?.elements.find((e) => e.id === 'c-frame-2') as CarouselPhotoFrame;

      expect(f1.photoId).toBe('photo-c2');
      expect(f1.filePath).toBe('/photos/c2.jpg');
      expect(f2.photoId).toBe('photo-c1');
      expect(f2.filePath).toBe('/photos/c1.jpg');

      // Preserves geometry
      expect(f1.x).toBe(50);
      expect(f2.x).toBe(500);
    });

    it('carousel store undo restores previous photo assignments', () => {
      const { swapFrames } = useCarouselStore.getState();
      swapFrames('c-frame-1', 'c-frame-2');

      expect(useCarouselStore.getState().canUndo).toBe(true);
      useCarouselStore.getState().undo();

      const cc = useCarouselStore.getState().currentCarousel!;
      const f1 = cc.slides[0]?.elements.find((e) => e.id === 'c-frame-1') as CarouselPhotoFrame;
      const f2 = cc.slides[0]?.elements.find((e) => e.id === 'c-frame-2') as CarouselPhotoFrame;

      expect(f1.photoId).toBe('photo-c1');
      expect(f2.photoId).toBe('photo-c2');
    });

    it('pressing S with 2 carousel photo frames executes swap and emits toast', () => {
      const onToast = vi.fn();
      simulateCarouselKeyDown({
        key: 's',
        selectedFrameIds: ['c-frame-1', 'c-frame-2'],
        onToast,
      });

      expect(onToast).toHaveBeenCalledWith('✓ Swapped 2 photos');
    });

    it('pressing S with 1 carousel photo frame activates swap handle', () => {
      const onToast = vi.fn();
      simulateCarouselKeyDown({
        key: 's',
        selectedFrameIds: ['c-frame-1'],
        onToast,
      });

      expect(onToast).toHaveBeenCalledWith('⇄ Photo swap handle active — drag to another photo to swap');
    });

    it('pressing S with 1 locked carousel frame displays warning', () => {
      const onToast = vi.fn();
      simulateCarouselKeyDown({
        key: 's',
        selectedFrameIds: ['c-frame-locked'],
        onToast,
      });

      expect(onToast).toHaveBeenCalledWith('⚠️ Photo swap handle is only available on unlocked photo frames');
    });

    it('carousel shortcut S is immune to inline text editing', () => {
      const onToast = vi.fn();
      simulateCarouselKeyDown({
        key: 's',
        editingTextId: 'text-editing-id',
        selectedFrameIds: ['c-frame-1', 'c-frame-2'],
        onToast,
      });

      expect(onToast).not.toHaveBeenCalled();
    });
  });

  describe('4. Inspector Layout Constraints & Decorative Exclusion', () => {
    it('updates excludeFromAdaptiveLayout on single photo frame in Print mode', () => {
      const { updateFrameGeometry } = useEditorStore.getState();
      updateFrameGeometry(spreadId, 'frame-photo-1', { excludeFromAdaptiveLayout: true });

      const spread = useAlbumStore.getState().currentAlbum?.spreads[0]!;
      const f1 = spread.elements.find((e) => e.id === 'frame-photo-1') as PhotoFrameElement;
      expect(f1.excludeFromAdaptiveLayout).toBe(true);

      updateFrameGeometry(spreadId, 'frame-photo-1', { excludeFromAdaptiveLayout: false });
      const f1Updated = useAlbumStore.getState().currentAlbum?.spreads[0]!.elements.find(
        (e) => e.id === 'frame-photo-1'
      ) as PhotoFrameElement;
      expect(f1Updated.excludeFromAdaptiveLayout).toBe(false);
    });

    it('batch updates excludeFromAdaptiveLayout for multi-selected photo frames in Print mode', () => {
      const { updateFrameGeometry } = useEditorStore.getState();
      const photoIds = ['frame-photo-1', 'frame-photo-2'];

      for (const id of photoIds) {
        updateFrameGeometry(spreadId, id, { excludeFromAdaptiveLayout: true });
      }

      const spread = useAlbumStore.getState().currentAlbum?.spreads[0]!;
      const f1 = spread.elements.find((e) => e.id === 'frame-photo-1') as PhotoFrameElement;
      const f2 = spread.elements.find((e) => e.id === 'frame-photo-2') as PhotoFrameElement;
      expect(f1.excludeFromAdaptiveLayout).toBe(true);
      expect(f2.excludeFromAdaptiveLayout).toBe(true);
    });

    it('updates excludeFromAdaptiveLayout on single photo frame in Carousel mode', () => {
      const { updatePhotoFrame } = useCarouselStore.getState();
      updatePhotoFrame('c-frame-1', { excludeFromAdaptiveLayout: true });

      const cc = useCarouselStore.getState().currentCarousel!;
      const f1 = cc.slides[0]?.elements.find((e) => e.id === 'c-frame-1') as CarouselPhotoFrame;
      expect(f1.excludeFromAdaptiveLayout).toBe(true);
    });

    it('batch updates excludeFromAdaptiveLayout in Carousel mode using batchUpdateFrames', () => {
      const { batchUpdateFrames } = useCarouselStore.getState();
      batchUpdateFrames([
        { id: 'c-frame-1', updates: { excludeFromAdaptiveLayout: true } },
        { id: 'c-frame-2', updates: { excludeFromAdaptiveLayout: true } },
      ]);

      const cc = useCarouselStore.getState().currentCarousel!;
      const f1 = cc.slides[0]?.elements.find((e) => e.id === 'c-frame-1') as CarouselPhotoFrame;
      const f2 = cc.slides[0]?.elements.find((e) => e.id === 'c-frame-2') as CarouselPhotoFrame;
      expect(f1.excludeFromAdaptiveLayout).toBe(true);
      expect(f2.excludeFromAdaptiveLayout).toBe(true);
    });
  });
});
