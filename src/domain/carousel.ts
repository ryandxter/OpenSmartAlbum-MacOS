/**
 * Carousel Domain Model for OpenSmartAlbum-MacOS
 *
 * Implements digital pixel-based multi-slide layout structures for
 * Instagram & Social Media carousels (Square 1:1, Portrait 4:5, Story/Reel 9:16).
 */

import type { ShapeType } from './shapes';
import type { StyledRange } from './styledRanges';
import type { TextStyle } from './text';
import type { StudioFramingPreset } from './ai/faceDetection';
import type { Unit } from './units';
import type { FrameSlotPayload } from './editor';
import type { SpreadBackgroundImage } from './album';
export type { StudioFramingPreset };

export type CarouselRatio =
  | '1:1'
  | '4:5'
  | '9:16'
  | 'fb-post'
  | 'pinterest-pin'
  | 'yt-thumb'
  | 'x-post'
  | 'linkedin-post'
  | 'custom';

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
  'fb-post': {
    id: 'fb-post',
    label: 'Facebook Post (1200 × 630)',
    width: 1200,
    height: 630,
    aspectRatio: 1200 / 630,
  },
  'pinterest-pin': {
    id: 'pinterest-pin',
    label: 'Pinterest Pin (1000 × 1500)',
    width: 1000,
    height: 1500,
    aspectRatio: 1000 / 1500,
  },
  'yt-thumb': {
    id: 'yt-thumb',
    label: 'YouTube Thumbnail (1280 × 720)',
    width: 1280,
    height: 720,
    aspectRatio: 1280 / 720,
  },
  'x-post': {
    id: 'x-post',
    label: 'X / Twitter Post (1600 × 900)',
    width: 1600,
    height: 900,
    aspectRatio: 1600 / 900,
  },
  'linkedin-post': {
    id: 'linkedin-post',
    label: 'LinkedIn Post (1200 × 627)',
    width: 1200,
    height: 627,
    aspectRatio: 1200 / 627,
  },
  'custom': {
    id: 'custom',
    label: 'Custom Dimensions',
    width: 1080,
    height: 1080,
    aspectRatio: 1.0,
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
  name?: string;      // User-defined layer name
  hidden?: boolean;   // When true, element is hidden on canvas and export
  // Canvas coordinate system (x=0 begins at slide 0; can span across slide boundaries)
  x: number;
  y: number;
  width: number;
  height: number;
  cropX?: number;
  cropY?: number;
  cropScale?: number;
  rotation?: number;
  zIndex?: number;
  opacity?: number;
  locked?: boolean;
  groupId?: string | null;
  groupRotation?: number;
  cropRotation?: number;
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
  excludeFromAdaptiveLayout?: boolean;

  // Visual Effects (v1.4.14 / Phase 1)
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  blurRadius?: number;
  grayscaleAmount?: number;
  noiseAmount?: number;

  // Drop Shadow (v1.4.14 / Phase 1)
  shadowEnabled?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;

  // Decorative Frame Overlays (v1.4.14 / Phase 1)
  frameAssetId?: string | null;
  frameAssetUrl?: string | null;
  frameAssetLocalPath?: string | null;
  frameAssetTitle?: string | null;
  frameAssetSlot?: FrameSlotPayload | null;
  frameAssetIsPro?: boolean;

  // AI Face & Studio Framing (Phase 23)
  faceFramingPreset?: StudioFramingPreset;
  faceHeadroomRatio?: number;
  faceEyeLineRatio?: number;
  faceShoulderRatio?: number;
  activeFaceIndex?: number;
  showFaceReticles?: boolean;
}

export interface CarouselTextFrame {
  type: 'text';
  id: string;
  name?: string;      // User-defined layer name
  hidden?: boolean;   // When true, element is hidden on canvas and export
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  color: string;
  align: 'left' | 'center' | 'right' | 'justify';
  locked: boolean;
  zIndex?: number;
  opacity?: number;
  rotation?: number;
  groupId?: string | null;
  groupRotation?: number;
  excludeFromAdaptiveLayout?: boolean;
  flipHorizontal?: boolean;
  flipVertical?: boolean;

  // Drop Shadow
  shadowEnabled?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;

  // Dual-Engine Rich Text Parity Fields
  styledRanges?: StyledRange[];
  style?: Partial<TextStyle>;
  highlight?: string;
  lineHeight?: number;
  letterSpacing?: number;
}

export interface CarouselGraphicFrame {
  type: 'graphic';
  id: string;
  name?: string;
  hidden?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex?: number;
  opacity?: number;
  locked?: boolean;
  groupId?: string | null;
  groupRotation?: number;
  excludeFromAdaptiveLayout?: boolean;

  // Visual Effects
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  blurRadius?: number;
  grayscaleAmount?: number;
  noiseAmount?: number;

  // Drop Shadow
  shadowEnabled?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;

  // Graphic / Frame Asset
  frameAssetId?: string | null;
  frameAssetUrl?: string | null;
  frameAssetLocalPath?: string | null;
  frameAssetTitle?: string | null;
  frameAssetSlot?: FrameSlotPayload | null;
  frameAssetIsPro?: boolean;

  graphicId?: string | null;
  photoId?: string;
  filePath?: string;
  fileName?: string;
  fileUrl?: string | null;
  previewPath?: string;
  thumbnailPath?: string;
  photoAspect?: number;
  originalWidth?: number;
  originalHeight?: number;
  cropX?: number;
  cropY?: number;
  cropScale?: number;
  cropRotation?: number;
  isMissing?: boolean;

  // Interoperability styling properties
  shapeType?: ShapeType;
  customSvgPath?: string;
  borderEnabled?: boolean;
  borderWidth?: number;
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'double';
  cornerRadius?: number;
  cornerRadiusTl?: number;
  cornerRadiusTr?: number;
  cornerRadiusBr?: number;
  cornerRadiusBl?: number;
}

export type CarouselElement = CarouselPhotoFrame | CarouselTextFrame | CarouselGraphicFrame;

export interface CarouselSlide {
  id: string;
  slideIndex: number;
  widthPx: number;
  heightPx: number;
  backgroundColor: string;
  elements: CarouselElement[];

  // Per-slide dimensions & unit overrides (v1.4.14 / Phase 1)
  pageWidth?: number | null;
  pageHeight?: number | null;
  pageUnit?: Unit | null;

  // Background image & noise
  backgroundImage?: SpreadBackgroundImage | null;
  backgroundColorNoise?: number;

  // Slide border styling
  borderEnabled?: boolean;
  borderWidth?: number;
  borderColor?: string;
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

/**
 * Executes Reflow with Adaptive Layout transformation for all photo frames
 * across all slides when switching carousel aspect ratios or live resizing.
 * Refits participating photo frames cleanly to match the new canvas proportions,
 * while preserving frames marked with excludeFromAdaptiveLayout or locked.
 */
export function reflowFramesForRatioSwitch(
  slides: CarouselSlide[],
  oldPreset: { width: number; height: number },
  newPreset: { width: number; height: number }
): CarouselSlide[] {
  if (oldPreset.width === newPreset.width && oldPreset.height === newPreset.height) {
    return slides;
  }

  const scaleX = newPreset.width / oldPreset.width;
  const scaleY = newPreset.height / oldPreset.height;
  const uniformScale = Math.min(scaleX, scaleY);

  return slides.map((slide, slideIdx) => {
    const updatedElements = slide.elements.map((el) => {
      if (el.type !== 'photo') {
        // Text / graphics scale with relative center position
        return {
          ...el,
          x: Math.round(el.x * scaleX),
          y: Math.round(el.y * scaleY),
          width: Math.round(el.width * scaleX),
          height: Math.round(el.height * scaleY),
        };
      }

      // If excluded or locked, preserve exact proportional scale
      if (el.excludeFromAdaptiveLayout || el.locked) {
        const oldSlideStartX = slideIdx * oldPreset.width;
        const localX = el.x - oldSlideStartX;
        const relCenterX = (localX + el.width / 2) / oldPreset.width;
        const relCenterY = (el.y + el.height / 2) / oldPreset.height;

        const newW = Math.round(el.width * uniformScale);
        const newH = Math.round(el.height * uniformScale);
        const newSlideStartX = slideIdx * newPreset.width;
        const newCenterX = newSlideStartX + relCenterX * newPreset.width;
        const newCenterY = relCenterY * newPreset.height;

        return {
          ...el,
          x: Math.max(0, Math.round(newCenterX - newW / 2)),
          y: Math.max(0, Math.min(newPreset.height - newH, Math.round(newCenterY - newH / 2))),
          width: newW,
          height: newH,
        };
      }

      // Adaptive Reflow for participating photo frames:
      // Map coordinates to new aspect ratio while refitting dimensions cleanly
      const oldSlideStartX = slideIdx * oldPreset.width;
      const localX = el.x - oldSlideStartX;
      const spanSlides = Math.max(1, Math.round(el.width / oldPreset.width));

      const relX = localX / (oldPreset.width * spanSlides);
      const relY = el.y / oldPreset.height;
      const relW = el.width / (oldPreset.width * spanSlides);
      const relH = el.height / oldPreset.height;

      const newSlideStartX = slideIdx * newPreset.width;
      const totalNewSpanW = newPreset.width * spanSlides;

      // In adaptive reflow, frame scales to fill the new relative region cleanly
      const reflowedW = Math.round(relW * totalNewSpanW);
      const reflowedH = Math.round(relH * newPreset.height);
      const reflowedX = Math.round(newSlideStartX + relX * totalNewSpanW);
      const reflowedY = Math.round(relY * newPreset.height);

      return {
        ...el,
        x: Math.max(0, reflowedX),
        y: Math.max(0, Math.min(newPreset.height - reflowedH, reflowedY)),
        width: reflowedW,
        height: reflowedH,
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

export type SocialResizeMode = 'reflow' | 'scale';

/**
 * Resizes a carousel post's slides to new dimensions using either
 * 'reflow' (Adaptive Layout) or 'scale' (Proportional Aspect-Fit).
 */
export function resizeCarouselPost(
  slides: CarouselSlide[],
  oldPreset: { width: number; height: number },
  newPreset: { width: number; height: number },
  mode: SocialResizeMode = 'reflow'
): CarouselSlide[] {
  if (mode === 'reflow') {
    return reflowFramesForRatioSwitch(slides, oldPreset, newPreset);
  }
  return scaleFramesForRatioSwitch(
    slides,
    {
      id: 'custom',
      label: 'Custom',
      width: oldPreset.width,
      height: oldPreset.height,
      aspectRatio: oldPreset.width / oldPreset.height,
    },
    {
      id: 'custom',
      label: 'Custom',
      width: newPreset.width,
      height: newPreset.height,
      aspectRatio: newPreset.width / newPreset.height,
    }
  );
}

/**
 * Resolves all frames that intersect a given slide index,
 * returning the frame along with its local coordinate offset relative to the slide's left boundary.
 * Essential for multi-slide seamless panoramas in PhoneSwipeSimulator and multi-slice exports.
 */
export function getSlideIntersectingFrames(
  source: Carousel | CarouselPhotoFrame[],
  slideIndex: number,
  slideWidth?: number
): { frame: CarouselPhotoFrame; localX: number }[] {
  let allFrames: CarouselPhotoFrame[];
  let width: number;

  if ('slides' in source) {
    allFrames = source.slides.flatMap((s) => s.elements.filter((el): el is CarouselPhotoFrame => el.type === 'photo'));
    width = source.slideWidthPx;
  } else {
    allFrames = source;
    width = slideWidth || 1080;
  }

  const slideStart = slideIndex * width;
  const slideEnd = slideStart + width;

  return allFrames
    .filter((f) => f.x < slideEnd && f.x + f.width > slideStart)
    .map((frame) => ({
      frame,
      localX: frame.x - slideStart,
    }));
}

/**
 * Checks deep structural equality between two carousel state objects.
 */
export function isCarouselEqual(a: Carousel | null, b: Carousel | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Snapshot of visual style properties for a CarouselPhotoFrame.
 * Used to carry styles through layout cycling and auto-flow operations,
 * where geometry (x, y, width, height) changes but visual customizations must be preserved.
 *
 * ISO-05: Preserves shapeType, border, cornerRadius, opacity, rotation, and locked state.
 */
export type FrameStyleSnapshot = {
  shapeType?: ShapeType;
  customSvgPath?: string;
  borderEnabled?: boolean;
  borderWidth?: number;
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'double';
  opacity?: number;
  rotation?: number;
  locked?: boolean;
  cornerRadius?: number;
  cornerRadiusTl?: number;
  cornerRadiusTr?: number;
  cornerRadiusBr?: number;
  cornerRadiusBl?: number;

  // Visual Effects & Shadow (v1.4.14 / Phase 1)
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  blurRadius?: number;
  grayscaleAmount?: number;
  noiseAmount?: number;
  shadowEnabled?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;

  // Frame Overlay Assets
  frameAssetId?: string | null;
  frameAssetUrl?: string | null;
  frameAssetLocalPath?: string | null;
  frameAssetTitle?: string | null;
  frameAssetSlot?: FrameSlotPayload | null;
  frameAssetIsPro?: boolean;
};

/**
 * Extracts the visual style snapshot from a CarouselPhotoFrame.
 * Only includes fields that have been explicitly set (non-undefined).
 *
 * @param frame - The source photo frame to extract styles from.
 * @returns A FrameStyleSnapshot containing all explicitly-set visual properties.
 */
export function extractFrameStyle(frame: CarouselPhotoFrame): FrameStyleSnapshot {
  const snap: FrameStyleSnapshot = {};
  if (frame.shapeType !== undefined) snap.shapeType = frame.shapeType;
  if (frame.customSvgPath !== undefined) snap.customSvgPath = frame.customSvgPath;
  if (frame.borderEnabled !== undefined) snap.borderEnabled = frame.borderEnabled;
  if (frame.borderWidth !== undefined) snap.borderWidth = frame.borderWidth;
  if (frame.borderColor !== undefined) snap.borderColor = frame.borderColor;
  if (frame.borderStyle !== undefined) snap.borderStyle = frame.borderStyle;
  if (frame.opacity !== undefined) snap.opacity = frame.opacity;
  if (frame.rotation !== undefined) snap.rotation = frame.rotation;
  if (frame.locked !== undefined) snap.locked = frame.locked;
  if (frame.cornerRadius !== undefined) snap.cornerRadius = frame.cornerRadius;
  if (frame.cornerRadiusTl !== undefined) snap.cornerRadiusTl = frame.cornerRadiusTl;
  if (frame.cornerRadiusTr !== undefined) snap.cornerRadiusTr = frame.cornerRadiusTr;
  if (frame.cornerRadiusBr !== undefined) snap.cornerRadiusBr = frame.cornerRadiusBr;
  if (frame.cornerRadiusBl !== undefined) snap.cornerRadiusBl = frame.cornerRadiusBl;

  // Visual Effects & Shadow
  if (frame.flipHorizontal !== undefined) snap.flipHorizontal = frame.flipHorizontal;
  if (frame.flipVertical !== undefined) snap.flipVertical = frame.flipVertical;
  if (frame.blurRadius !== undefined) snap.blurRadius = frame.blurRadius;
  if (frame.grayscaleAmount !== undefined) snap.grayscaleAmount = frame.grayscaleAmount;
  if (frame.noiseAmount !== undefined) snap.noiseAmount = frame.noiseAmount;
  if (frame.shadowEnabled !== undefined) snap.shadowEnabled = frame.shadowEnabled;
  if (frame.shadowColor !== undefined) snap.shadowColor = frame.shadowColor;
  if (frame.shadowBlur !== undefined) snap.shadowBlur = frame.shadowBlur;
  if (frame.shadowOffsetX !== undefined) snap.shadowOffsetX = frame.shadowOffsetX;
  if (frame.shadowOffsetY !== undefined) snap.shadowOffsetY = frame.shadowOffsetY;
  if (frame.shadowOpacity !== undefined) snap.shadowOpacity = frame.shadowOpacity;

  // Frame Overlay Assets
  if (frame.frameAssetId !== undefined) snap.frameAssetId = frame.frameAssetId;
  if (frame.frameAssetUrl !== undefined) snap.frameAssetUrl = frame.frameAssetUrl;
  if (frame.frameAssetLocalPath !== undefined) snap.frameAssetLocalPath = frame.frameAssetLocalPath;
  if (frame.frameAssetTitle !== undefined) snap.frameAssetTitle = frame.frameAssetTitle;
  if (frame.frameAssetSlot !== undefined) snap.frameAssetSlot = frame.frameAssetSlot;
  if (frame.frameAssetIsPro !== undefined) snap.frameAssetIsPro = frame.frameAssetIsPro;

  return snap;
}

