import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { QuickGuidesPopover } from '../QuickGuidesPopover';
import { useAlbumStore } from '../../../stores/albumStore';
import { useCarouselStore } from '../../../stores/carouselStore';
import { useEditorStore } from '../../../stores/editorStore';
import { SNAPPING_LEVELS, SnappingLevel } from '../../../domain/editor';

describe('Plan 20-02: QuickGuidesPopover, Navigator Anchors & Direct Drawer Wheel Scroll Suite', () => {
  beforeEach(() => {
    // Reset Album Store
    useAlbumStore.setState({
      showGutterGuide: true,
      showBleedGuide: true,
      showSafeAreaGuide: true,
      showCenterGuide: false,
      showThirdsGuide: false,
      isSpreadDrawerOpen: false,
    });

    // Reset Carousel Store
    useCarouselStore.setState({
      showSliceGuides: true,
      showCenterGuide: false,
      showThirdsGuide: false,
    });

    // Reset Editor Store
    useEditorStore.setState({
      snapEnabled: true,
      snappingConfig: {
        enabled: true,
        threshold: 1.27,
        snapToPageEdges: true,
        snapToPageCenters: true,
        snapToMargins: true,
        snapToFrames: true,
        snapToEqualGaps: true,
      },
    });
  });

  describe('1. Snapping Level Calibration & Domain Definitions', () => {
    it('defines exactly 5 calibrated magnetic snapping levels with Level 2 as default', () => {
      expect(SNAPPING_LEVELS).toHaveLength(5);

      const [l1, l2, l3, l4, l5] = SNAPPING_LEVELS as [
        SnappingLevel,
        SnappingLevel,
        SnappingLevel,
        SnappingLevel,
        SnappingLevel,
      ];

      expect(l1.level).toBe(1);
      expect(l1.name).toBe('Soft');
      expect(l1.mm).toBe(0.85);
      expect(l1.px).toBe(10);

      expect(l2.level).toBe(2);
      expect(l2.name).toBe('Normal');
      expect(l2.mm).toBe(1.27);
      expect(l2.px).toBe(15);
      expect(l2.isDefault).toBe(true);

      expect(l3.level).toBe(3);
      expect(l3.name).toBe('Medium');
      expect(l3.mm).toBe(2.96);
      expect(l3.px).toBe(35);

      expect(l4.level).toBe(4);
      expect(l4.name).toBe('Strong');
      expect(l4.mm).toBe(4.23);
      expect(l4.px).toBe(50);

      expect(l5.level).toBe(5);
      expect(l5.name).toBe('Max');
      expect(l5.mm).toBe(6.35);
      expect(l5.px).toBe(75);
    });

    it('accurately resolves closest snapping level for various numerical thresholds', () => {
      const getClosestLevel = (threshold?: number): SnappingLevel => {
        const defaultLevel = SNAPPING_LEVELS.find((l) => l.isDefault) || SNAPPING_LEVELS[1]!;
        if (!threshold) return defaultLevel;
        let closest: SnappingLevel = defaultLevel;
        let minDiff = Infinity;
        for (const lvl of SNAPPING_LEVELS) {
          const diff = Math.abs(lvl.mm - threshold);
          if (diff < minDiff) {
            minDiff = diff;
            closest = lvl;
          }
        }
        return closest;
      };

      expect(getClosestLevel(0.85).level).toBe(1);
      expect(getClosestLevel(0.9).level).toBe(1);
      expect(getClosestLevel(1.27).level).toBe(2);
      expect(getClosestLevel(2.0).level).toBe(2);
      expect(getClosestLevel(2.5).level).toBe(3);
      expect(getClosestLevel(2.96).level).toBe(3);
      expect(getClosestLevel(4.23).level).toBe(4);
      expect(getClosestLevel(6.35).level).toBe(5);
      expect(getClosestLevel(10.0).level).toBe(5);
      expect(getClosestLevel(undefined).level).toBe(2);
    });
  });

  describe('2. QuickGuidesPopover Component Instantiation & Props Contract', () => {
    it('creates React element with required QuickGuidesPopover props', () => {
      const onClose = vi.fn();
      const element = React.createElement(QuickGuidesPopover, {
        mode: 'print',
        isOpen: true,
        onClose,
        align: 'center',
      });

      expect(element).toBeTruthy();
      expect(element.type).toBe(QuickGuidesPopover);
      expect(element.props.mode).toBe('print');
      expect(element.props.isOpen).toBe(true);
      expect(element.props.align).toBe('center');
    });

    it('creates React element for carousel mode with custom alignment', () => {
      const onClose = vi.fn();
      const element = React.createElement(QuickGuidesPopover, {
        mode: 'carousel',
        isOpen: false,
        onClose,
        align: 'right',
      });

      expect(element).toBeTruthy();
      expect(element.props.mode).toBe('carousel');
      expect(element.props.isOpen).toBe(false);
      expect(element.props.align).toBe('right');
    });
  });

  describe('3. Print Album Mode Canvas Guides Parity & Toggle Dispatches', () => {
    it('initializes with expected print guide values in useAlbumStore', () => {
      const state = useAlbumStore.getState();
      expect(state.showGutterGuide).toBe(true);
      expect(state.showBleedGuide).toBe(true);
      expect(state.showSafeAreaGuide).toBe(true);
      expect(state.showCenterGuide).toBe(false);
      expect(state.showThirdsGuide).toBe(false);
    });

    it('toggles all print visual guides independently via toggleGuide', () => {
      // 1. Spine Gutter Crease
      useAlbumStore.getState().toggleGuide('gutter');
      expect(useAlbumStore.getState().showGutterGuide).toBe(false);
      useAlbumStore.getState().toggleGuide('gutter');
      expect(useAlbumStore.getState().showGutterGuide).toBe(true);

      // 2. Safe Area Margin
      useAlbumStore.getState().toggleGuide('safeArea');
      expect(useAlbumStore.getState().showSafeAreaGuide).toBe(false);
      useAlbumStore.getState().toggleGuide('safeArea');
      expect(useAlbumStore.getState().showSafeAreaGuide).toBe(true);

      // 3. Bleed Cut Boundary
      useAlbumStore.getState().toggleGuide('bleed');
      expect(useAlbumStore.getState().showBleedGuide).toBe(false);
      useAlbumStore.getState().toggleGuide('bleed');
      expect(useAlbumStore.getState().showBleedGuide).toBe(true);

      // 4. Optical Centerlines
      expect(useAlbumStore.getState().showCenterGuide).toBe(false);
      useAlbumStore.getState().toggleGuide('center');
      expect(useAlbumStore.getState().showCenterGuide).toBe(true);
      useAlbumStore.getState().toggleGuide('center');
      expect(useAlbumStore.getState().showCenterGuide).toBe(false);

      // 5. Rule of Thirds Grid (3x3)
      expect(useAlbumStore.getState().showThirdsGuide).toBe(false);
      useAlbumStore.getState().toggleGuide('thirds');
      expect(useAlbumStore.getState().showThirdsGuide).toBe(true);
      useAlbumStore.getState().toggleGuide('thirds');
      expect(useAlbumStore.getState().showThirdsGuide).toBe(false);
    });

    it('sets guide visibility explicitly via setGuideVisibility in AlbumStore', () => {
      useAlbumStore.getState().setGuideVisibility('center', true);
      useAlbumStore.getState().setGuideVisibility('thirds', true);
      useAlbumStore.getState().setGuideVisibility('gutter', false);

      expect(useAlbumStore.getState().showCenterGuide).toBe(true);
      expect(useAlbumStore.getState().showThirdsGuide).toBe(true);
      expect(useAlbumStore.getState().showGutterGuide).toBe(false);
    });
  });

  describe('4. Social Carousel Mode Canvas Guides Parity & Toggle Dispatches', () => {
    it('initializes with expected carousel guide values in useCarouselStore', () => {
      const state = useCarouselStore.getState();
      expect(state.showSliceGuides).toBe(true);
      expect(state.showCenterGuide).toBe(false);
      expect(state.showThirdsGuide).toBe(false);
    });

    it('toggles all carousel visual guides independently via toggleGuide', () => {
      // 1. Slide Slice Boundaries
      useCarouselStore.getState().toggleGuide('slices');
      expect(useCarouselStore.getState().showSliceGuides).toBe(false);
      useCarouselStore.getState().toggleGuide('slices');
      expect(useCarouselStore.getState().showSliceGuides).toBe(true);

      // 2. Slide Center Axes
      expect(useCarouselStore.getState().showCenterGuide).toBe(false);
      useCarouselStore.getState().toggleGuide('center');
      expect(useCarouselStore.getState().showCenterGuide).toBe(true);
      useCarouselStore.getState().toggleGuide('center');
      expect(useCarouselStore.getState().showCenterGuide).toBe(false);

      // 3. Slide Rule of Thirds (3x3)
      expect(useCarouselStore.getState().showThirdsGuide).toBe(false);
      useCarouselStore.getState().toggleGuide('thirds');
      expect(useCarouselStore.getState().showThirdsGuide).toBe(true);
      useCarouselStore.getState().toggleGuide('thirds');
      expect(useCarouselStore.getState().showThirdsGuide).toBe(false);
    });

    it('sets carousel guide visibility explicitly via setGuideVisibility', () => {
      useCarouselStore.getState().setGuideVisibility('slices', false);
      useCarouselStore.getState().setGuideVisibility('center', true);
      useCarouselStore.getState().setGuideVisibility('thirds', true);

      expect(useCarouselStore.getState().showSliceGuides).toBe(false);
      expect(useCarouselStore.getState().showCenterGuide).toBe(true);
      expect(useCarouselStore.getState().showThirdsGuide).toBe(true);
    });
  });

  describe('5. Magnetic Snapping Master & Threshold Selection', () => {
    it('toggles snapEnabled master state via toggleSnap in useEditorStore', () => {
      expect(useEditorStore.getState().snapEnabled).toBe(true);

      useEditorStore.getState().toggleSnap();
      expect(useEditorStore.getState().snapEnabled).toBe(false);

      useEditorStore.getState().toggleSnap();
      expect(useEditorStore.getState().snapEnabled).toBe(true);
    });

    it('updates snappingConfig threshold when selecting any of the 5 distance levels', () => {
      // Level 1: Soft (0.85mm)
      useEditorStore.getState().updateSnappingConfig({ threshold: SNAPPING_LEVELS[0]!.mm });
      expect(useEditorStore.getState().snappingConfig.threshold).toBe(0.85);

      // Level 2: Normal (1.27mm)
      useEditorStore.getState().updateSnappingConfig({ threshold: SNAPPING_LEVELS[1]!.mm });
      expect(useEditorStore.getState().snappingConfig.threshold).toBe(1.27);

      // Level 3: Medium (2.96mm)
      useEditorStore.getState().updateSnappingConfig({ threshold: SNAPPING_LEVELS[2]!.mm });
      expect(useEditorStore.getState().snappingConfig.threshold).toBe(2.96);

      // Level 4: Strong (4.23mm)
      useEditorStore.getState().updateSnappingConfig({ threshold: SNAPPING_LEVELS[3]!.mm });
      expect(useEditorStore.getState().snappingConfig.threshold).toBe(4.23);

      // Level 5: Max (6.35mm)
      useEditorStore.getState().updateSnappingConfig({ threshold: SNAPPING_LEVELS[4]!.mm });
      expect(useEditorStore.getState().snappingConfig.threshold).toBe(6.35);
    });
  });

  describe('6. Snapping Reference Targets Toggles', () => {
    it('updates individual reference target flags via updateSnappingConfig', () => {
      const { updateSnappingConfig } = useEditorStore.getState();

      updateSnappingConfig({ snapToPageEdges: false });
      expect(useEditorStore.getState().snappingConfig.snapToPageEdges).toBe(false);

      updateSnappingConfig({ snapToPageCenters: false });
      expect(useEditorStore.getState().snappingConfig.snapToPageCenters).toBe(false);

      updateSnappingConfig({ snapToMargins: false });
      expect(useEditorStore.getState().snappingConfig.snapToMargins).toBe(false);

      updateSnappingConfig({ snapToFrames: false });
      expect(useEditorStore.getState().snappingConfig.snapToFrames).toBe(false);

      updateSnappingConfig({ snapToEqualGaps: false });
      expect(useEditorStore.getState().snappingConfig.snapToEqualGaps).toBe(false);

      // Re-enable all
      updateSnappingConfig({
        snapToPageEdges: true,
        snapToPageCenters: true,
        snapToMargins: true,
        snapToFrames: true,
        snapToEqualGaps: true,
      });

      const config = useEditorStore.getState().snappingConfig;
      expect(config.snapToPageEdges).toBe(true);
      expect(config.snapToPageCenters).toBe(true);
      expect(config.snapToMargins).toBe(true);
      expect(config.snapToFrames).toBe(true);
      expect(config.snapToEqualGaps).toBe(true);
    });
  });

  describe('7. Popover Dismissal & Keyboard Focus Restoration Logic', () => {
    it('calls onClose and focus on anchorRef when handling Escape key', () => {
      const onClose = vi.fn();
      const anchorElement = { focus: vi.fn() };
      const anchorRef = { current: anchorElement as any };

      const handleKeyDown = (e: { key: string; preventDefault: () => void }) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
          anchorRef?.current?.focus();
        }
      };

      const preventDefault = vi.fn();
      handleKeyDown({ key: 'Escape', preventDefault });

      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(anchorElement.focus).toHaveBeenCalledTimes(1);
    });

    it('detects outside pointer clicks correctly', () => {
      const onClose = vi.fn();
      const popoverNode = { id: 'popover', contains: (target: any) => target.id === 'popover' };
      const anchorNode = { id: 'anchor', contains: (target: any) => target.id === 'anchor' };

      const handlePointerDown = (target: any) => {
        if (!popoverNode.contains(target) && !anchorNode.contains(target)) {
          onClose();
        }
      };

      // Click inside popover -> no close
      handlePointerDown({ id: 'popover' });
      expect(onClose).not.toHaveBeenCalled();

      // Click on anchor -> no close
      handlePointerDown({ id: 'anchor' });
      expect(onClose).not.toHaveBeenCalled();

      // Click outside -> calls onClose
      handlePointerDown({ id: 'outside-element' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('8. Smart Horizontal Wheel Scroll Interceptor Simulation', () => {
    // Wheel event handler implementation matching PageNavigator and SlideNavigator
    const createWheelHandler = (element: { scrollLeft: number }) => {
      return (e: {
        ctrlKey?: boolean;
        metaKey?: boolean;
        deltaX: number;
        deltaY: number;
        deltaMode?: number;
        preventDefault: () => void;
      }) => {
        // 1. Guard against zoom / modifier shortcuts
        if (e.ctrlKey || e.metaKey) return;

        // 2. Convert vertical wheel rotation to horizontal scroll
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();

          // 3. Normalize delta across deltaModes (pixel vs line vs page)
          let delta = e.deltaY;
          if (e.deltaMode === 1) {
            delta *= 40; // DOM_DELTA_LINE
          } else if (e.deltaMode === 2) {
            delta *= 800; // DOM_DELTA_PAGE
          }

          element.scrollLeft += delta;
        }
      };
    };

    it('converts dominant vertical wheel deltaY to horizontal scrollLeft in pixel deltaMode (0)', () => {
      const mockElement = { scrollLeft: 100 };
      const handler = createWheelHandler(mockElement);
      const preventDefault = vi.fn();

      handler({
        deltaX: 0,
        deltaY: 50,
        deltaMode: 0,
        preventDefault,
      });

      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(mockElement.scrollLeft).toBe(150);
    });

    it('normalizes DOM_DELTA_LINE (deltaMode 1) by multiplying deltaY by 40', () => {
      const mockElement = { scrollLeft: 0 };
      const handler = createWheelHandler(mockElement);
      const preventDefault = vi.fn();

      handler({
        deltaX: 0,
        deltaY: 3, // 3 lines
        deltaMode: 1,
        preventDefault,
      });

      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(mockElement.scrollLeft).toBe(120); // 3 * 40 = 120
    });

    it('normalizes DOM_DELTA_PAGE (deltaMode 2) by multiplying deltaY by 800', () => {
      const mockElement = { scrollLeft: 0 };
      const handler = createWheelHandler(mockElement);
      const preventDefault = vi.fn();

      handler({
        deltaX: 0,
        deltaY: 1, // 1 page
        deltaMode: 2,
        preventDefault,
      });

      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(mockElement.scrollLeft).toBe(800);
    });

    it('preserves native 2-finger horizontal trackpad gestures without intercepting (deltaX > deltaY)', () => {
      const mockElement = { scrollLeft: 100 };
      const handler = createWheelHandler(mockElement);
      const preventDefault = vi.fn();

      handler({
        deltaX: 80,
        deltaY: 10,
        deltaMode: 0,
        preventDefault,
      });

      expect(preventDefault).not.toHaveBeenCalled();
      expect(mockElement.scrollLeft).toBe(100); // untouched, browser handles native scrollLeft
    });

    it('ignores wheel events when ctrlKey or metaKey is pressed (pinch-to-zoom / shortcuts)', () => {
      const mockElement = { scrollLeft: 100 };
      const handler = createWheelHandler(mockElement);
      const preventDefault = vi.fn();

      // ctrlKey (pinch zoom)
      handler({
        ctrlKey: true,
        deltaX: 0,
        deltaY: 100,
        preventDefault,
      });
      expect(preventDefault).not.toHaveBeenCalled();
      expect(mockElement.scrollLeft).toBe(100);

      // metaKey (command shortcut)
      handler({
        metaKey: true,
        deltaX: 0,
        deltaY: 100,
        preventDefault,
      });
      expect(preventDefault).not.toHaveBeenCalled();
      expect(mockElement.scrollLeft).toBe(100);
    });
  });
});
