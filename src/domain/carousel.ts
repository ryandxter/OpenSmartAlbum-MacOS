/**
 * Carousel Domain Model for OpenSmartAlbum-MacOS
 *
 * Implements digital pixel-based multi-slide layout structures for
 * Instagram & Social Media carousels (Square 1:1, Portrait 4:5, Story/Reel 9:16).
 */

import type { ShapeType } from './shapes';

export type CarouselRatio = '1:1' | '4:5' | '9:16';

export interface CarouselRatioPreset {
  id: CarouselRatio;
  label: string;
  width: number;
  height: number;
  aspectRatio: number;
}

export const CAROUSEL_RATIO_PRESETS: Record<CarouselRatio, CarouselRatioPreset> = {
  '1:1': {
    id: '1:1',
    label: '1:1 — Square (Feed)',
    width: 1080,
    height: 1080,
    aspectRatio: 1.0,
  },
  '4:5': {
    id: '4:5',
    label: '4:5 — Portrait (Feed)',
    width: 1080,
    height: 1350,
    aspectRatio: 1080 / 1350,
  },
  '9:16': {
    id: '9:16',
    label: '9:16 — Story / Reel',
    width: 1080,
    height: 1920,
    aspectRatio: 1080 / 1920,
  },
};

export const MAX_CAROUSEL_SLIDES = 10;
export const MIN_CAROUSEL_SLIDES = 1;

export interface CarouselPhotoFrame {
  type: 'photo';
  id: string;
  photoId?: string;
  filePath?: string;
  fileName?: string;
  previewPath?: string;
  thumbnailPath?: string;
  photoAspect?: number;
  isMissing?: boolean;
  // Canvas coordinate system (x=0 begins at slide 0; can span across slide boundaries)
  x: number;
  y: number;
  width: number;
  height: number;
  cropX?: number;
  cropY?: number;
  cropScale?: number;
  rotation?: number;
  locked?: boolean;
  cornerRadius?: number;
  shapeType?: ShapeType;
  customSvgPath?: string;
  borderEnabled?: boolean;
  borderWidth?: number;
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'double';
  cornerRadiusTl?: number;
  cornerRadiusTr?: number;
  cornerRadiusBr?: number;
  cornerRadiusBl?: number;
}

export type CarouselElement = CarouselPhotoFrame;

export interface CarouselSlide {
  id: string;
  slideIndex: number;
  widthPx: number;
  heightPx: number;
  backgroundColor: string;
  elements: CarouselElement[];
}

export interface Carousel {
  id: string;
  projectId: string;
  ratio: CarouselRatio;
  slideWidthPx: number;
  slideHeightPx: number;
  slides: CarouselSlide[];
  totalSlides: number;
}

/**
 * Creates an empty Carousel project structure with standard defaults.
 */
export function createInitialCarousel(projectId: string, ratio: CarouselRatio = '1:1', initialSlidesCount: number = 3): Carousel {
  const preset = CAROUSEL_RATIO_PRESETS[ratio] || CAROUSEL_RATIO_PRESETS['1:1'];
  const count = Math.max(MIN_CAROUSEL_SLIDES, Math.min(MAX_CAROUSEL_SLIDES, initialSlidesCount));
  
  const slides: CarouselSlide[] = [];
  for (let i = 0; i < count; i++) {
    slides.push({
      id: `slide-${projectId}-${i + 1}`,
      slideIndex: i,
      widthPx: preset.width,
      heightPx: preset.height,
      backgroundColor: '#FFFFFF',
      elements: [],
    });
  }

  return {
    id: `carousel-${projectId}`,
    projectId,
    ratio,
    slideWidthPx: preset.width,
    slideHeightPx: preset.height,
    slides,
    totalSlides: count,
  };
}

/**
 * Creates a new slide for an existing carousel.
 */
export function createCarouselSlide(carousel: Carousel, backgroundColor = '#FFFFFF'): CarouselSlide {
  const index = carousel.slides.length;
  return {
    id: `slide-${carousel.projectId}-${Date.now()}-${index + 1}`,
    slideIndex: index,
    widthPx: carousel.slideWidthPx,
    heightPx: carousel.slideHeightPx,
    backgroundColor,
    elements: [],
  };
}

/**
 * Computes total continuous stage width (N * slideWidthPx).
 */
export function getCarouselTotalWidth(carousel: Carousel): number {
  return carousel.slideWidthPx * carousel.slides.length;
}

/**
 * Computes horizontal starting coordinate of a given slide index.
 */
export function getSlideXOffset(carousel: Carousel, slideIndex: number): number {
  return carousel.slideWidthPx * slideIndex;
}

/**
 * Returns which slide index an x-coordinate on the continuous stage falls into.
 */
export function getSlideIndexAtX(carousel: Carousel, x: number): number {
  const index = Math.floor(x / carousel.slideWidthPx);
  return Math.max(0, Math.min(carousel.slides.length - 1, index));
}

/**
 * Executes Option A (Proportional Aspect-Fit) transformation for all photo frames
 * across all slides when switching carousel aspect ratios (e.g. 1:1 ↔ 4:5 ↔ 9:16).
 * Guarantees:
 * 1. Preserves photo frame aspect ratio.
 * 2. Scales and repositions frames relative to slide/panorama bounds without clipping or overflow.
 * 3. Retains multi-slide span relationships.
 */
export function scaleFramesForRatioSwitch(
  slides: CarouselSlide[],
  oldPreset: CarouselRatioPreset,
  newPreset: CarouselRatioPreset
): CarouselSlide[] {
  if (oldPreset.width === newPreset.width && oldPreset.height === newPreset.height) {
    return slides;
  }

  const scaleFactor = Math.min(newPreset.width / oldPreset.width, newPreset.height / oldPreset.height);

  return slides.map((slide, slideIdx) => {
    const updatedElements = slide.elements.map((el) => {
      if (el.type !== 'photo') return el;

      // Determine if frame spans multiple slides
      const spanSlides = Math.max(1, Math.round(el.width / oldPreset.width));
      const oldSlideStartX = slideIdx * oldPreset.width;
      const localX = el.x - oldSlideStartX;

      // Normalized center position in old slide/span space
      const totalOldSpanW = oldPreset.width * spanSlides;
      const relCenterX = (localX + el.width / 2) / totalOldSpanW;
      const relCenterY = (el.y + el.height / 2) / oldPreset.height;

      // Proportional aspect-fitted dimensions
      const newW = Math.round(el.width * scaleFactor);
      const newH = Math.round(el.height * scaleFactor);

      // Reposition relative to new slide coordinates
      const newSlideStartX = slideIdx * newPreset.width;
      const totalNewSpanW = newPreset.width * spanSlides;
      const newCenterX = newSlideStartX + relCenterX * totalNewSpanW;
      const newCenterY = relCenterY * newPreset.height;

      let newX = Math.round(newCenterX - newW / 2);
      let newY = Math.round(newCenterY - newH / 2);

      // Safety clamp within canvas boundaries
      newY = Math.max(0, Math.min(newPreset.height - newH, newY));
      newX = Math.max(0, newX);

      return {
        ...el,
        x: newX,
        y: newY,
        width: newW,
        height: newH,
      };
    });

    return {
      ...slide,
      widthPx: newPreset.width,
      heightPx: newPreset.height,
      elements: updatedElements,
    };
  });
}
