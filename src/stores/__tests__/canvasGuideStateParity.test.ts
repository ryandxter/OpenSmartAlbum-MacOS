import { describe, it, expect, beforeEach } from 'vitest';
import { useAlbumStore } from '../albumStore';
import { useCarouselStore } from '../carouselStore';

describe('Plan 20-01: Canvas Guides State Parity & Actions', () => {
  beforeEach(() => {
    // Reset AlbumStore guides to initial defaults
    useAlbumStore.setState({
      showGutterGuide: true,
      showBleedGuide: true,
      showSafeAreaGuide: true,
      showCenterGuide: false,
      showThirdsGuide: false,
    });

    // Reset CarouselStore guides to initial defaults
    useCarouselStore.setState({
      showSliceGuides: true,
      showCenterGuide: false,
      showThirdsGuide: false,
    });
  });

  describe('Print Album Canvas Guides (useAlbumStore)', () => {
    it('initializes with correct default visibility states', () => {
      const state = useAlbumStore.getState();
      expect(state.showGutterGuide).toBe(true);
      expect(state.showBleedGuide).toBe(true);
      expect(state.showSafeAreaGuide).toBe(true);
      expect(state.showCenterGuide).toBe(false);
      expect(state.showThirdsGuide).toBe(false);
    });

    it('toggles optical centerlines guide independently', () => {
      useAlbumStore.getState().toggleGuide('center');
      expect(useAlbumStore.getState().showCenterGuide).toBe(true);

      useAlbumStore.getState().toggleGuide('center');
      expect(useAlbumStore.getState().showCenterGuide).toBe(false);
    });

    it('toggles Rule of Thirds grid guide independently', () => {
      useAlbumStore.getState().toggleGuide('thirds');
      expect(useAlbumStore.getState().showThirdsGuide).toBe(true);

      useAlbumStore.getState().toggleGuide('thirds');
      expect(useAlbumStore.getState().showThirdsGuide).toBe(false);
    });

    it('sets guide visibility explicitly via setGuideVisibility', () => {
      useAlbumStore.getState().setGuideVisibility('center', true);
      useAlbumStore.getState().setGuideVisibility('thirds', true);
      useAlbumStore.getState().setGuideVisibility('bleed', false);

      expect(useAlbumStore.getState().showCenterGuide).toBe(true);
      expect(useAlbumStore.getState().showThirdsGuide).toBe(true);
      expect(useAlbumStore.getState().showBleedGuide).toBe(false);
    });
  });

  describe('Social Carousel Canvas Guides (useCarouselStore)', () => {
    it('initializes with correct default visibility states', () => {
      const state = useCarouselStore.getState();
      expect(state.showSliceGuides).toBe(true);
      expect(state.showCenterGuide).toBe(false);
      expect(state.showThirdsGuide).toBe(false);
    });

    it('toggles optical centerlines guide independently', () => {
      useCarouselStore.getState().toggleGuide('center');
      expect(useCarouselStore.getState().showCenterGuide).toBe(true);

      useCarouselStore.getState().toggleGuide('center');
      expect(useCarouselStore.getState().showCenterGuide).toBe(false);
    });

    it('toggles Rule of Thirds grid guide independently', () => {
      useCarouselStore.getState().toggleGuide('thirds');
      expect(useCarouselStore.getState().showThirdsGuide).toBe(true);

      useCarouselStore.getState().toggleGuide('thirds');
      expect(useCarouselStore.getState().showThirdsGuide).toBe(false);
    });

    it('sets guide visibility explicitly via setGuideVisibility', () => {
      useCarouselStore.getState().setGuideVisibility('slices', false);
      useCarouselStore.getState().setGuideVisibility('center', true);
      useCarouselStore.getState().setGuideVisibility('thirds', true);

      expect(useCarouselStore.getState().showSliceGuides).toBe(false);
      expect(useCarouselStore.getState().showCenterGuide).toBe(true);
      expect(useCarouselStore.getState().showThirdsGuide).toBe(true);
    });
  });
});
