import { describe, it, expect, beforeEach } from 'vitest';
import { useCarouselStore } from '../carouselStore';
import { createInitialCarousel } from '../../domain/carousel';

describe('carouselStore.addTextFrame (ISO-03)', () => {
  beforeEach(() => {
    const carousel = createInitialCarousel('test-project', '1:1', 3);
    useCarouselStore.setState({
      currentCarousel: carousel,
      activeSlideIndex: 0,
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
  });

  it('creates a text frame centered on the active slide', () => {
    useCarouselStore.getState().addTextFrame();
    const { currentCarousel, activeSlideIndex } = useCarouselStore.getState();
    const slide = currentCarousel!.slides[activeSlideIndex]!;
    const textFrames = slide.elements.filter((el) => el.type === 'text');
    expect(textFrames).toHaveLength(1);
    expect(textFrames[0]!.type).toBe('text');
  });

  it('text frame has correct default text and font', () => {
    useCarouselStore.getState().addTextFrame();
    const { currentCarousel, activeSlideIndex } = useCarouselStore.getState();
    const slide = currentCarousel!.slides[activeSlideIndex]!;
    const textFrame = slide.elements.find((el) => el.type === 'text') as any;
    expect(textFrame.text).toBe('Add your text here');
    expect(textFrame.fontSize).toBe(48);
    expect(textFrame.color).toBe('#FFFFFF');
    expect(textFrame.align).toBe('center');
  });

  it('text frame x is within the active slide bounds', () => {
    useCarouselStore.getState().addTextFrame();
    const { currentCarousel, activeSlideIndex } = useCarouselStore.getState();
    const slide = currentCarousel!.slides[activeSlideIndex]!;
    const textFrame = slide.elements.find((el) => el.type === 'text') as any;
    const slideStartX = activeSlideIndex * currentCarousel!.slideWidthPx;
    const slideEndX = slideStartX + currentCarousel!.slideWidthPx;
    expect(textFrame.x).toBeGreaterThanOrEqual(slideStartX);
    expect(textFrame.x + textFrame.width).toBeLessThanOrEqual(slideEndX);
  });

  it('sets selectedFrameId to the new text frame', () => {
    useCarouselStore.getState().addTextFrame();
    const { currentCarousel, activeSlideIndex, selectedFrameId } = useCarouselStore.getState();
    const slide = currentCarousel!.slides[activeSlideIndex]!;
    const textFrame = slide.elements.find((el) => el.type === 'text') as any;
    expect(selectedFrameId).toBe(textFrame.id);
  });

  it('pushes history for undo support', () => {
    useCarouselStore.getState().addTextFrame();
    expect(useCarouselStore.getState().canUndo).toBe(true);
    useCarouselStore.getState().undo();
    const { currentCarousel, activeSlideIndex } = useCarouselStore.getState();
    const slide = currentCarousel!.slides[activeSlideIndex]!;
    const textFrames = slide.elements.filter((el) => el.type === 'text');
    expect(textFrames).toHaveLength(0);
  });

  it('adds text frame to slide 1 when activeSlideIndex is 1', () => {
    useCarouselStore.setState({ activeSlideIndex: 1 });
    useCarouselStore.getState().addTextFrame();
    const { currentCarousel } = useCarouselStore.getState();
    const slide0 = currentCarousel!.slides[0]!;
    const slide1 = currentCarousel!.slides[1]!;
    expect(slide0.elements.filter((el) => el.type === 'text')).toHaveLength(0);
    expect(slide1.elements.filter((el) => el.type === 'text')).toHaveLength(1);
  });

  it('does nothing if currentCarousel is null', () => {
    useCarouselStore.setState({ currentCarousel: null });
    expect(() => useCarouselStore.getState().addTextFrame()).not.toThrow();
  });
});
