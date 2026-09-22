import { CarouselRatio, CarouselPhotoFrame } from './carousel';

export type CarouselLayoutCategory = 'per_slide' | 'panorama';

export interface CarouselLayoutPhotoInput {
  id?: string;
  photoId?: string;
  filePath?: string;
  fileName?: string;
  previewPath?: string | null;
  thumbnailPath?: string | null;
  photoAspect?: number;
}

export interface CarouselLayoutPreset {
  id: string;
  name: string;
  description: string;
  category: CarouselLayoutCategory;
  spanSlides: number; // 1 for single slide, 2 or 3 for multi-slide panorama
  minPhotos: number;
  maxPhotos: number;
  generate: (params: {
    slideWidth: number;
    slideHeight: number;
    slideIndex: number;
    totalSlides: number;
    photos: CarouselLayoutPhotoInput[];
    spacing?: number;
    margin?: number;
  }) => Array<Omit<CarouselPhotoFrame, 'id'>>;
  previewSvg: (ratio: CarouselRatio) => string;
}

function createFrame(
  photo: CarouselLayoutPhotoInput | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
  extra?: Partial<Omit<CarouselPhotoFrame, 'id'>>
): Omit<CarouselPhotoFrame, 'id'> {
  return {
    type: 'photo',
    photoId: photo?.photoId || photo?.id,
    filePath: photo?.filePath || '',
    fileName: photo?.fileName,
    previewPath: photo?.previewPath || undefined,
    thumbnailPath: photo?.thumbnailPath || undefined,
    photoAspect: photo?.photoAspect || 1.0,
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    ...extra,
  };
}

export const CAROUSEL_LAYOUT_PRESETS: CarouselLayoutPreset[] = [
  // 1 Photo: Full Bleed
  {
    id: 'hero_full',
    name: 'Full Bleed',
    description: '1 photo filling the complete slide surface edge-to-edge.',
    category: 'per_slide',
    spanSlides: 1,
    minPhotos: 1,
    maxPhotos: 1,
    generate: ({ slideWidth, slideHeight, slideIndex, photos }) => {
      const slideStartX = slideIndex * slideWidth;
      return [
        createFrame(photos[0], slideStartX, 0, slideWidth, slideHeight),
      ];
    },
    previewSvg: () => {
      return `<svg width="140" height="70" viewBox="0 0 140 70" xmlns="http://www.w3.org/2000/svg">
        <rect width="140" height="70" rx="4" fill="var(--color-bg-secondary, #18181b)"/>
        <rect x="45" y="10" width="50" height="50" rx="2" fill="rgba(255, 255, 255, 0.08)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1"/>
      </svg>`;
    },
  },

  // 1 Photo: Framed
  {
    id: 'hero_framed',
    name: 'Framed Hero',
    description: '1 photo centered with generous margins.',
    category: 'per_slide',
    spanSlides: 1,
    minPhotos: 1,
    maxPhotos: 1,
    generate: ({ slideWidth, slideHeight, slideIndex, photos, margin = 60 }) => {
      const slideStartX = slideIndex * slideWidth;
      const w = slideWidth - margin * 2;
      const h = slideHeight - margin * 2;
      return [
        createFrame(photos[0], slideStartX + margin, margin, w, h),
      ];
    },
    previewSvg: () => {
      return `<svg width="140" height="70" viewBox="0 0 140 70" xmlns="http://www.w3.org/2000/svg">
        <rect width="140" height="70" rx="4" fill="var(--color-bg-secondary, #18181b)"/>
        <rect x="45" y="10" width="50" height="50" rx="2" fill="none" stroke="rgba(255, 255, 255, 0.12)" stroke-dasharray="2 2" stroke-width="1"/>
        <rect x="52" y="17" width="36" height="36" rx="2" fill="rgba(255, 255, 255, 0.08)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1"/>
      </svg>`;
    },
  },

  // 2 Photos: Vertical Split (Stacked)
  {
    id: 'split_vertical',
    name: 'Vertical Stack',
    description: '2 photos stacked vertically (top and bottom).',
    category: 'per_slide',
    spanSlides: 1,
    minPhotos: 2,
    maxPhotos: 2,
    generate: ({ slideWidth, slideHeight, slideIndex, photos, margin = 40, spacing = 16 }) => {
      const slideStartX = slideIndex * slideWidth;
      const usableW = slideWidth - margin * 2;
      const usableH = slideHeight - margin * 2 - spacing;
      const cellH = usableH / 2;
      return [
        createFrame(photos[0], slideStartX + margin, margin, usableW, cellH),
        createFrame(photos[1], slideStartX + margin, margin + cellH + spacing, usableW, cellH),
      ];
    },
    previewSvg: () => {
      return `<svg width="140" height="70" viewBox="0 0 140 70" xmlns="http://www.w3.org/2000/svg">
        <rect width="140" height="70" rx="4" fill="var(--color-bg-secondary, #18181b)"/>
        <rect x="47" y="12" width="46" height="21" rx="2" fill="rgba(255, 255, 255, 0.08)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1"/>
        <rect x="47" y="37" width="46" height="21" rx="2" fill="rgba(255, 255, 255, 0.08)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1"/>
      </svg>`;
    },
  },

  // 2 Photos: Horizontal Split (Side by Side)
  {
    id: 'split_horizontal',
    name: 'Side by Side',
    description: '2 photos side-by-side with uniform central spacing.',
    category: 'per_slide',
    spanSlides: 1,
    minPhotos: 2,
    maxPhotos: 2,
    generate: ({ slideWidth, slideHeight, slideIndex, photos, margin = 40, spacing = 16 }) => {
      const slideStartX = slideIndex * slideWidth;
      const usableW = slideWidth - margin * 2 - spacing;
      const usableH = slideHeight - margin * 2;
      const cellW = usableW / 2;
      return [
        createFrame(photos[0], slideStartX + margin, margin, cellW, usableH),
        createFrame(photos[1], slideStartX + margin + cellW + spacing, margin, cellW, usableH),
      ];
    },
    previewSvg: () => {
      return `<svg width="140" height="70" viewBox="0 0 140 70" xmlns="http://www.w3.org/2000/svg">
        <rect width="140" height="70" rx="4" fill="var(--color-bg-secondary, #18181b)"/>
        <rect x="47" y="12" width="21" height="46" rx="2" fill="rgba(255, 255, 255, 0.08)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1"/>
        <rect x="72" y="12" width="21" height="46" rx="2" fill="rgba(255, 255, 255, 0.08)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1"/>
      </svg>`;
    },
  },

  // 3 Photos: Hero Top + 2 Bottom
  {
    id: 'grid_3_hero_top',
    name: 'Hero Top + 2 Bottom',
    description: '1 prominent top hero frame with 2 supporting frames underneath.',
    category: 'per_slide',
    spanSlides: 1,
    minPhotos: 3,
    maxPhotos: 3,
    generate: ({ slideWidth, slideHeight, slideIndex, photos, margin = 40, spacing = 16 }) => {
      const slideStartX = slideIndex * slideWidth;
      const usableW = slideWidth - margin * 2;
      const usableH = slideHeight - margin * 2 - spacing;
      const topH = Math.round(usableH * 0.55);
      const botH = usableH - topH;
      const botW = (usableW - spacing) / 2;

      return [
        createFrame(photos[0], slideStartX + margin, margin, usableW, topH),
        createFrame(photos[1], slideStartX + margin, margin + topH + spacing, botW, botH),
        createFrame(photos[2], slideStartX + margin + botW + spacing, margin + topH + spacing, botW, botH),
      ];
    },
    previewSvg: () => {
      return `<svg width="140" height="70" viewBox="0 0 140 70" xmlns="http://www.w3.org/2000/svg">
        <rect width="140" height="70" rx="4" fill="var(--color-bg-secondary, #18181b)"/>
        <rect x="47" y="12" width="46" height="24" rx="2" fill="rgba(255, 255, 255, 0.08)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1"/>
        <rect x="47" y="40" width="21" height="18" rx="2" fill="rgba(255, 255, 255, 0.08)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1"/>
        <rect x="72" y="40" width="21" height="18" rx="2" fill="rgba(255, 255, 255, 0.08)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1"/>
      </svg>`;
    },
  },

  // 3 Photos: 3 Columns
  {
    id: 'grid_3_columns',
    name: '3 Columns',
    description: '3 vertical photo columns spaced evenly across the slide.',
    category: 'per_slide',
    spanSlides: 1,
    minPhotos: 3,
    maxPhotos: 3,
    generate: ({ slideWidth, slideHeight, slideIndex, photos, margin = 40, spacing = 14 }) => {
      const slideStartX = slideIndex * slideWidth;
      const usableW = slideWidth - margin * 2 - spacing * 2;
      const usableH = slideHeight - margin * 2;
      const colW = usableW / 3;

      return [
        createFrame(photos[0], slideStartX + margin + 0 * (colW + spacing), margin, colW, usableH),
        createFrame(photos[1], slideStartX + margin + 1 * (colW + spacing), margin, colW, usableH),
        createFrame(photos[2], slideStartX + margin + 2 * (colW + spacing), margin, colW, usableH),
      ];
    },
    previewSvg: () => {
      return `<svg width="140" height="70" viewBox="0 0 140 70" xmlns="http://www.w3.org/2000/svg">
        <rect width="140" height="70" rx="4" fill="var(--color-bg-secondary, #18181b)"/>
        <rect x="46" y="12" width="13" height="46" rx="2" fill="rgba(255, 255, 255, 0.08)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1"/>
        <rect x="63" y="12" width="13" height="46" rx="2" fill="rgba(255, 255, 255, 0.08)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1"/>
        <rect x="80" y="12" width="13" height="46" rx="2" fill="rgba(255, 255, 255, 0.08)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1"/>
      </svg>`;
    },
  },

  // 4 Photos: 2x2 Quad Grid
  {
    id: 'grid_4_quad',
    name: '2 × 2 Quad Grid',
    description: '4 balanced photos organized in a neat square quad grid.',
    category: 'per_slide',
    spanSlides: 1,
    minPhotos: 4,
    maxPhotos: 4,
    generate: ({ slideWidth, slideHeight, slideIndex, photos, margin = 40, spacing = 16 }) => {
      const slideStartX = slideIndex * slideWidth;
      const usableW = slideWidth - margin * 2 - spacing;
      const usableH = slideHeight - margin * 2 - spacing;
      const cellW = usableW / 2;
      const cellH = usableH / 2;

      return [
        createFrame(photos[0], slideStartX + margin, margin, cellW, cellH),
        createFrame(photos[1], slideStartX + margin + cellW + spacing, margin, cellW, cellH),
        createFrame(photos[2], slideStartX + margin, margin + cellH + spacing, cellW, cellH),
        createFrame(photos[3], slideStartX + margin + cellW + spacing, margin + cellH + spacing, cellW, cellH),
      ];
    },
    previewSvg: () => {
      return `<svg width="140" height="70" viewBox="0 0 140 70" xmlns="http://www.w3.org/2000/svg">
        <rect width="140" height="70" rx="4" fill="var(--color-bg-secondary, #18181b)"/>
        <rect x="47" y="12" width="21" height="21" rx="2" fill="rgba(255, 255, 255, 0.08)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1"/>
        <rect x="72" y="12" width="21" height="21" rx="2" fill="rgba(255, 255, 255, 0.08)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1"/>
        <rect x="47" y="37" width="21" height="21" rx="2" fill="rgba(255, 255, 255, 0.08)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1"/>
        <rect x="72" y="37" width="21" height="21" rx="2" fill="rgba(255, 255, 255, 0.08)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1"/>
      </svg>`;
    },
  },

  // 4 Photos: Editorial 1 Large + 3 Stacked
  {
    id: 'editorial_4',
    name: 'Editorial Feature',
    description: '1 hero frame (2/3 width) alongside 3 stacked sidebar frames.',
    category: 'per_slide',
    spanSlides: 1,
    minPhotos: 4,
    maxPhotos: 4,
    generate: ({ slideWidth, slideHeight, slideIndex, photos, margin = 40, spacing = 14 }) => {
      const slideStartX = slideIndex * slideWidth;
      const usableW = slideWidth - margin * 2 - spacing;
      const usableH = slideHeight - margin * 2;
      const leftW = Math.round(usableW * 0.65);
      const rightW = usableW - leftW;
      const thumbH = (usableH - spacing * 2) / 3;

      return [
        createFrame(photos[0], slideStartX + margin, margin, leftW, usableH),
        createFrame(photos[1], slideStartX + margin + leftW + spacing, margin + 0 * (thumbH + spacing), rightW, thumbH),
        createFrame(photos[2], slideStartX + margin + leftW + spacing, margin + 1 * (thumbH + spacing), rightW, thumbH),
        createFrame(photos[3], slideStartX + margin + leftW + spacing, margin + 2 * (thumbH + spacing), rightW, thumbH),
      ];
    },
    previewSvg: () => {
      return `<svg width="140" height="70" viewBox="0 0 140 70" xmlns="http://www.w3.org/2000/svg">
        <rect width="140" height="70" rx="4" fill="var(--color-bg-secondary, #18181b)"/>
        <rect x="45" y="12" width="28" height="46" rx="2" fill="rgba(255, 255, 255, 0.08)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1"/>
        <rect x="77" y="12" width="18" height="13" rx="2" fill="rgba(255, 255, 255, 0.08)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1"/>
        <rect x="77" y="28" width="18" height="13" rx="2" fill="rgba(255, 255, 255, 0.08)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1"/>
        <rect x="77" y="45" width="18" height="13" rx="2" fill="rgba(255, 255, 255, 0.08)" stroke="rgba(255, 255, 255, 0.22)" stroke-width="1"/>
      </svg>`;
    },
  },

  // Panorama: 2-Slide Seamless Span
  {
    id: 'panorama_2_slide',
    name: '2-Slide Seamless Panorama',
    description: '1 wide landscape photo spanning continuously across 2 slides for seamless swiping.',
    category: 'panorama',
    spanSlides: 2,
    minPhotos: 1,
    maxPhotos: 1,
    generate: ({ slideWidth, slideHeight, slideIndex, photos }) => {
      const slideStartX = slideIndex * slideWidth;
      return [
        createFrame(photos[0], slideStartX, 0, slideWidth * 2, slideHeight),
      ];
    },
    previewSvg: () => {
      return `<svg width="140" height="70" viewBox="0 0 140 70" xmlns="http://www.w3.org/2000/svg">
        <rect width="140" height="70" rx="4" fill="var(--color-bg-secondary, #18181b)"/>
        <rect x="25" y="12" width="90" height="46" rx="2" fill="rgba(59, 130, 246, 0.15)" stroke="rgba(59, 130, 246, 0.4)" stroke-width="1.2"/>
        <line x1="70" y1="12" x2="70" y2="58" stroke="#3b82f6" stroke-dasharray="3 3" stroke-width="1.5"/>
      </svg>`;
    },
  },

  // Panorama: 2-Slide Framed Panorama
  {
    id: 'panorama_2_slide_framed',
    name: '2-Slide Framed Panorama',
    description: 'Spans 2 slides with elegant cinematic top and bottom letterboxing.',
    category: 'panorama',
    spanSlides: 2,
    minPhotos: 1,
    maxPhotos: 1,
    generate: ({ slideWidth, slideHeight, slideIndex, photos, margin = 60 }) => {
      const slideStartX = slideIndex * slideWidth;
      const h = slideHeight - margin * 2;
      return [
        createFrame(photos[0], slideStartX + 40, margin, slideWidth * 2 - 80, h),
      ];
    },
    previewSvg: () => {
      return `<svg width="140" height="70" viewBox="0 0 140 70" xmlns="http://www.w3.org/2000/svg">
        <rect width="140" height="70" rx="4" fill="var(--color-bg-secondary, #18181b)"/>
        <rect x="25" y="19" width="90" height="32" rx="2" fill="rgba(59, 130, 246, 0.15)" stroke="rgba(59, 130, 246, 0.4)" stroke-width="1.2"/>
        <line x1="70" y1="12" x2="70" y2="58" stroke="rgba(255, 255, 255, 0.25)" stroke-dasharray="2 2" stroke-width="1"/>
      </svg>`;
    },
  },

  // Panorama: 3-Slide Triple Panorama
  {
    id: 'panorama_3_slide',
    name: '3-Slide Ultra Panorama',
    description: '1 ultra-wide panoramic photo seamlessly spanning 3 complete slides.',
    category: 'panorama',
    spanSlides: 3,
    minPhotos: 1,
    maxPhotos: 1,
    generate: ({ slideWidth, slideHeight, slideIndex, photos }) => {
      const slideStartX = slideIndex * slideWidth;
      return [
        createFrame(photos[0], slideStartX, 0, slideWidth * 3, slideHeight),
      ];
    },
    previewSvg: () => {
      return `<svg width="140" height="70" viewBox="0 0 140 70" xmlns="http://www.w3.org/2000/svg">
        <rect width="140" height="70" rx="4" fill="var(--color-bg-secondary, #18181b)"/>
        <rect x="15" y="16" width="110" height="38" rx="2" fill="rgba(59, 130, 246, 0.15)" stroke="rgba(59, 130, 246, 0.4)" stroke-width="1.2"/>
        <line x1="51.6" y1="16" x2="51.6" y2="54" stroke="#3b82f6" stroke-dasharray="3 3" stroke-width="1.5"/>
        <line x1="88.3" y1="16" x2="88.3" y2="54" stroke="#3b82f6" stroke-dasharray="3 3" stroke-width="1.5"/>
      </svg>`;
    },
  },

  // Panorama: 2-Slide Span with Floating Detail Card
  {
    id: 'panorama_2_slide_detail',
    name: 'Panorama + Floating Detail',
    description: '1 continuous background panorama across 2 slides with 1 floating detail card on the second slide.',
    category: 'panorama',
    spanSlides: 2,
    minPhotos: 2,
    maxPhotos: 2,
    generate: ({ slideWidth, slideHeight, slideIndex, photos }) => {
      const slideStartX = slideIndex * slideWidth;
      const detailW = Math.round(slideWidth * 0.48);
      const detailH = Math.round(slideHeight * 0.48);
      const detailX = (slideIndex + 1) * slideWidth + (slideWidth - detailW) / 2;
      const detailY = (slideHeight - detailH) / 2;

      return [
        createFrame(photos[0], slideStartX, 0, slideWidth * 2, slideHeight),
        createFrame(photos[1], detailX, detailY, detailW, detailH, {
          cornerRadius: 8,
        }),
      ];
    },
    previewSvg: () => {
      return `<svg width="140" height="70" viewBox="0 0 140 70" xmlns="http://www.w3.org/2000/svg">
        <rect width="140" height="70" rx="4" fill="var(--color-bg-secondary, #18181b)"/>
        <rect x="25" y="12" width="90" height="46" rx="2" fill="rgba(59, 130, 246, 0.15)" stroke="rgba(59, 130, 246, 0.4)" stroke-width="1.2"/>
        <line x1="70" y1="12" x2="70" y2="58" stroke="#3b82f6" stroke-dasharray="3 3" stroke-width="1.5"/>
        <rect x="80" y="24" width="22" height="22" rx="3" fill="rgba(255, 255, 255, 0.9)" stroke="rgba(0, 0, 0, 0.3)" stroke-width="1"/>
      </svg>`;
    },
  },
];

/**
 * Returns available layout presets filtered by photo count and multi-slide spanning support.
 */
export function getAvailableCarouselLayouts(
  photoCount: number,
  _ratio: CarouselRatio = '1:1',
  canSpanMultiSlide = true
): CarouselLayoutPreset[] {
  let presets = CAROUSEL_LAYOUT_PRESETS;
  if (!canSpanMultiSlide) {
    presets = presets.filter((p) => p.spanSlides === 1);
  }

  if (photoCount <= 0) {
    return presets;
  }

  const matching = presets.filter((p) => photoCount >= p.minPhotos && photoCount <= p.maxPhotos);
  return matching.length > 0 ? matching : presets;
}
