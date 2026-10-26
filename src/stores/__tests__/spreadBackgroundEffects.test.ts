import { describe, it, expect, beforeEach } from 'vitest';
import { useAlbumStore } from '../albumStore';
import { useCarouselStore } from '../carouselStore';
import { useHistoryStore } from '../historyStore';
import { createInitialAlbum } from '../../domain/album';
import { createInitialCarousel } from '../../domain/carousel';
import { Project } from '../../domain/project';

const mockProject: Project = {
  id: 'test-project-fx',
  name: 'Test Project',
  canvasWidth: 400,
  canvasHeight: 200,
  canvasUnit: 'mm',
  canvasDpi: 300,
  spacingValue: 2,
  spacingUnit: 'mm',
  backgroundColor: '#FFFFFF',
  backgroundType: 'solid',
  backgroundColorNoise: 0,
  marginEnabled: true,
  marginValue: 12,
  marginUnit: 'mm',
  marginTop: 12,
  marginBottom: 12,
  marginOutside: 12,
  marginSpine: 0,
  borderEnabled: false,
  borderWidth: 1,
  borderUnit: 'mm',
  borderColor: '#000000',
  bleed: 3,
  createdAt: '2026-10-26T00:00:00Z',
  updatedAt: '2026-10-26T00:00:00Z',
};

describe('Spread Background Image & Background Noise Store Mutations (FX-03, FX-04)', () => {
  beforeEach(() => {
    useHistoryStore.getState().clearHistory();

    const initialAlbum = createInitialAlbum(mockProject);
    useAlbumStore.setState({
      currentAlbum: initialAlbum,
      activeSpreadId: initialAlbum.spreads[0]?.id || initialAlbum.coverSpread.id,
      activeSpreadIndex: 0,
      saveStatus: 'saved',
    });

    const initialCarousel = createInitialCarousel('test-carousel-fx', '1:1', 3);
    useCarouselStore.setState({
      currentCarousel: initialCarousel,
      activeSlideIndex: 0,
    });
  });

  describe('Album Store (Print Spread)', () => {
    it('sets background image on spread with scope targeting', () => {
      const activeSpreadId = useAlbumStore.getState().activeSpreadId!;
      expect(activeSpreadId).toBeDefined();

      useAlbumStore.getState().setSpreadBackgroundImage(
        activeSpreadId,
        {
          photoId: 'photo-1',
          filePath: '/photos/bg1.jpg',
          fileName: 'bg1.jpg',
          fit: 'fill',
          opacity: 85,
          blurRadius: 5,
          grayscaleAmount: 20,
          noiseAmount: 15,
        },
        'spread'
      );

      let spread = useAlbumStore.getState().currentAlbum?.spreads.find((s) => s.id === activeSpreadId);
      expect(spread?.backgroundImage).toBeDefined();
      expect(spread?.backgroundImage?.photoId).toBe('photo-1');
      expect(spread?.backgroundImage?.opacity).toBe(85);
      expect(spread?.backgroundImage?.target).toBe('full');
      expect(spread?.backgroundImage?.blurRadius).toBe(5);

      // Change target scope to left
      useAlbumStore.getState().setSpreadBackgroundImage(
        activeSpreadId,
        { photoId: 'photo-1', filePath: '/photos/bg1.jpg', fileName: 'bg1.jpg' },
        'left'
      );
      spread = useAlbumStore.getState().currentAlbum?.spreads.find((s) => s.id === activeSpreadId);
      expect(spread?.backgroundImage?.target).toBe('left');
    });

    it('updates and clears background image on spread', () => {
      const activeSpreadId = useAlbumStore.getState().activeSpreadId!;
      useAlbumStore.getState().setSpreadBackgroundImage(activeSpreadId, {
        photoId: 'photo-1',
        filePath: '/photos/bg1.jpg',
        fileName: 'bg1.jpg',
        opacity: 100,
      });

      useAlbumStore.getState().updateSpreadBackgroundImage(activeSpreadId, {
        opacity: 50,
        flipHorizontal: true,
      });

      let spread = useAlbumStore.getState().currentAlbum?.spreads.find((s) => s.id === activeSpreadId);
      expect(spread?.backgroundImage?.opacity).toBe(50);
      expect(spread?.backgroundImage?.flipHorizontal).toBe(true);

      useAlbumStore.getState().clearSpreadBackgroundImage(activeSpreadId);
      spread = useAlbumStore.getState().currentAlbum?.spreads.find((s) => s.id === activeSpreadId);
      expect(spread?.backgroundImage).toBeNull();
    });

    it('sets background color noise and applies to all spreads', () => {
      const activeSpreadId = useAlbumStore.getState().activeSpreadId!;
      useAlbumStore.getState().setSpreadBackgroundColorNoise(activeSpreadId, 45, 'spread');

      let spread = useAlbumStore.getState().currentAlbum?.spreads.find((s) => s.id === activeSpreadId);
      expect(spread?.backgroundColorNoise).toBe(45);

      // Per-page left noise
      useAlbumStore.getState().setSpreadBackgroundColorNoise(activeSpreadId, 25, 'left');
      spread = useAlbumStore.getState().currentAlbum?.spreads.find((s) => s.id === activeSpreadId);
      expect(spread?.leftPageBackgroundColorNoise).toBe(25);

      // Apply to all spreads
      useAlbumStore.getState().applyBackgroundNoiseToAllSpreads(30);
      const allSpreads = useAlbumStore.getState().currentAlbum?.spreads || [];
      expect(useAlbumStore.getState().currentAlbum?.coverSpread.backgroundColorNoise).toBe(30);
      allSpreads.forEach((s) => {
        expect(s.backgroundColorNoise).toBe(30);
      });
    });

    it('updates spread inner page borders and applies to all spreads', () => {
      const activeSpreadId = useAlbumStore.getState().activeSpreadId!;
      useAlbumStore.getState().updateSpreadBorder(
        activeSpreadId,
        { borderEnabled: true, borderWidth: 1.5, borderColor: '#000000' },
        'both'
      );

      let spread = useAlbumStore.getState().currentAlbum?.spreads.find((s) => s.id === activeSpreadId);
      expect(spread?.borderEnabled).toBe(true);
      expect(spread?.borderWidth).toBe(1.5);
      expect(spread?.borderColor).toBe('#000000');

      // Propagate border to all spreads
      useAlbumStore.getState().applyBorderToAllSpreads(
        { borderEnabled: true, borderWidth: 2.0, borderColor: '#333333' },
        'both'
      );
      const album = useAlbumStore.getState().currentAlbum!;
      expect(album.coverSpread.borderEnabled).toBe(true);
      expect(album.coverSpread.borderWidth).toBe(2.0);
      album.spreads.forEach((s) => {
        expect(s.borderEnabled).toBe(true);
        expect(s.borderWidth).toBe(2.0);
        expect(s.borderColor).toBe('#333333');
      });
    });
  });

  describe('Carousel Store (Social Media)', () => {
    it('sets, updates, and clears slide background image', () => {
      useCarouselStore.getState().setSpreadBackgroundImage(0, {
        photoId: 'carousel-bg-1',
        filePath: '/photos/cbg.jpg',
        fileName: 'cbg.jpg',
        fit: 'fit',
        opacity: 90,
      });

      let slide = useCarouselStore.getState().currentCarousel?.slides[0];
      expect(slide?.backgroundImage).toBeDefined();
      expect(slide?.backgroundImage?.photoId).toBe('carousel-bg-1');
      expect(slide?.backgroundImage?.fit).toBe('fit');

      useCarouselStore.getState().updateSpreadBackgroundImage(0, {
        opacity: 60,
        flipVertical: true,
      });
      slide = useCarouselStore.getState().currentCarousel?.slides[0];
      expect(slide?.backgroundImage?.opacity).toBe(60);
      expect(slide?.backgroundImage?.flipVertical).toBe(true);

      useCarouselStore.getState().clearSpreadBackgroundImage(0);
      slide = useCarouselStore.getState().currentCarousel?.slides[0];
      expect(slide?.backgroundImage).toBeNull();
    });

    it('sets background color noise and applies to all slides', () => {
      useCarouselStore.getState().setSpreadBackgroundColorNoise(1, 40);
      let slide1 = useCarouselStore.getState().currentCarousel?.slides[1];
      expect(slide1?.backgroundColorNoise).toBe(40);

      useCarouselStore.getState().applyBackgroundNoiseToAllSpreads(20);
      const slides = useCarouselStore.getState().currentCarousel?.slides || [];
      slides.forEach((s) => {
        expect(s.backgroundColorNoise).toBe(20);
      });
    });

    it('updates slide border and applies to all slides', () => {
      useCarouselStore.getState().updateSpreadBorder(0, {
        borderEnabled: true,
        borderWidth: 4,
        borderColor: '#E4E4E7',
      });
      let slide0 = useCarouselStore.getState().currentCarousel?.slides[0];
      expect(slide0?.borderEnabled).toBe(true);
      expect(slide0?.borderWidth).toBe(4);
      expect(slide0?.borderColor).toBe('#E4E4E7');

      useCarouselStore.getState().applyBorderToAllSpreads({
        borderEnabled: true,
        borderWidth: 6,
        borderColor: '#FFFFFF',
      });
      const slides = useCarouselStore.getState().currentCarousel?.slides || [];
      slides.forEach((s) => {
        expect(s.borderEnabled).toBe(true);
        expect(s.borderWidth).toBe(6);
        expect(s.borderColor).toBe('#FFFFFF');
      });
    });
  });
});
