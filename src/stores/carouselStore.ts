import { create } from 'zustand';
import {
  Carousel,
  CarouselSlide,
  CarouselRatio,
  CarouselPhotoFrame,
  createInitialCarousel,
  createCarouselSlide,
  scaleFramesForRatioSwitch,
  CAROUSEL_RATIO_PRESETS,
  MAX_CAROUSEL_SLIDES,
  MIN_CAROUSEL_SLIDES,
} from '../domain/carousel';
import { CAROUSEL_LAYOUT_PRESETS, CarouselLayoutPhotoInput } from '../domain/carouselLayout';
import { generateDynamicVariations } from '../domain/layout/generator';
import { AdaptivePhoto } from '../domain/adaptiveLayout';

export interface CarouselState {
  currentCarousel: Carousel | null;
  activeSlideIndex: number;
  showSliceGuides: boolean;
  selectedFrameId: string | null;
  slideLayoutIndices: Record<number, number>;

  // Actions
  initializeCarousel: (projectId: string, ratio?: CarouselRatio, initialSlidesCount?: number) => void;
  setRatio: (ratio: CarouselRatio) => void;
  setActiveSlide: (index: number) => void;
  setSelectedFrameId: (id: string | null) => void;
  addSlide: (backgroundColor?: string) => void;
  duplicateSlide: (index: number) => void;
  deleteSlide: (index: number) => void;
  reorderSlide: (fromIndex: number, toIndex: number) => void;
  updateSlideBackground: (slideIndex: number, color: string) => void;
  addPhotoFrame: (slideIndex: number, frame: Omit<CarouselPhotoFrame, 'id'>) => void;
  updatePhotoFrame: (frameId: string, updates: Partial<CarouselPhotoFrame>) => void;
  removePhotoFrame: (frameId: string) => void;
  cycleSlideLayout: (direction: 'next' | 'prev') => void;
  applyDynamicSlideLayoutByIndex: (slideIndex: number, variationIndex: number) => void;
  applyCarouselLayout: (slideIndex: number, presetId: string, photos?: CarouselLayoutPhotoInput[]) => void;
  shuffleSlidePhotos: (slideIndex: number) => void;
  toggleSliceGuides: () => void;
  setShowSliceGuides: (show: boolean) => void;
}

export const useCarouselStore = create<CarouselState>((set, get) => ({
  currentCarousel: null,
  activeSlideIndex: 0,
  showSliceGuides: true,
  selectedFrameId: null,
  slideLayoutIndices: {},

  initializeCarousel: (projectId, ratio = '1:1', initialSlidesCount = 3) => {
    const carousel = createInitialCarousel(projectId, ratio, initialSlidesCount);
    set({
      currentCarousel: carousel,
      activeSlideIndex: 0,
      selectedFrameId: null,
      slideLayoutIndices: {},
    });
  },

  setRatio: (ratio) => {
    const { currentCarousel } = get();
    if (!currentCarousel) return;
    const oldPreset = CAROUSEL_RATIO_PRESETS[currentCarousel.ratio];
    const newPreset = CAROUSEL_RATIO_PRESETS[ratio];
    if (!newPreset || !oldPreset) return;

    const updatedSlides = scaleFramesForRatioSwitch(currentCarousel.slides, oldPreset, newPreset);

    set({
      currentCarousel: {
        ...currentCarousel,
        ratio,
        slideWidthPx: newPreset.width,
        slideHeightPx: newPreset.height,
        slides: updatedSlides,
      },
    });
  },

  setActiveSlide: (index) => {
    const { currentCarousel } = get();
    if (!currentCarousel) return;
    const clamped = Math.max(0, Math.min(currentCarousel.slides.length - 1, index));
    set({ activeSlideIndex: clamped });
  },

  setSelectedFrameId: (id) => {
    set({ selectedFrameId: id });
  },

  addSlide: (backgroundColor = '#FFFFFF') => {
    const { currentCarousel } = get();
    if (!currentCarousel || currentCarousel.slides.length >= MAX_CAROUSEL_SLIDES) return;

    const newSlide = createCarouselSlide(currentCarousel, backgroundColor);
    const updatedSlides = [...currentCarousel.slides, newSlide].map((s, idx) => ({
      ...s,
      slideIndex: idx,
    }));

    set({
      currentCarousel: {
        ...currentCarousel,
        slides: updatedSlides,
        totalSlides: updatedSlides.length,
      },
      activeSlideIndex: updatedSlides.length - 1,
    });
  },

  duplicateSlide: (index) => {
    const { currentCarousel } = get();
    if (!currentCarousel || currentCarousel.slides.length >= MAX_CAROUSEL_SLIDES) return;
    const target = currentCarousel.slides[index];
    if (!target) return;

    const duplicated: CarouselSlide = {
      ...target,
      id: `slide-${currentCarousel.projectId}-${Date.now()}-dup`,
      elements: target.elements.map((el) => ({
        ...el,
        id: `${el.id}-dup-${Date.now()}`,
      })),
    };

    const newSlides = [
      ...currentCarousel.slides.slice(0, index + 1),
      duplicated,
      ...currentCarousel.slides.slice(index + 1),
    ].map((s, idx) => ({
      ...s,
      slideIndex: idx,
    }));

    set({
      currentCarousel: {
        ...currentCarousel,
        slides: newSlides,
        totalSlides: newSlides.length,
      },
      activeSlideIndex: index + 1,
    });
  },

  deleteSlide: (index) => {
    const { currentCarousel } = get();
    if (!currentCarousel || currentCarousel.slides.length <= MIN_CAROUSEL_SLIDES) return;

    const newSlides = currentCarousel.slides
      .filter((_, idx) => idx !== index)
      .map((s, idx) => ({
        ...s,
        slideIndex: idx,
      }));

    set({
      currentCarousel: {
        ...currentCarousel,
        slides: newSlides,
        totalSlides: newSlides.length,
      },
      activeSlideIndex: Math.min(index, newSlides.length - 1),
    });
  },

  reorderSlide: (fromIndex, toIndex) => {
    const { currentCarousel } = get();
    if (!currentCarousel) return;
    if (fromIndex === toIndex) return;

    const slides = [...currentCarousel.slides];
    const [moved] = slides.splice(fromIndex, 1);
    if (!moved) return;
    slides.splice(toIndex, 0, moved);

    const updatedSlides = slides.map((s, idx) => ({
      ...s,
      slideIndex: idx,
    }));

    set({
      currentCarousel: {
        ...currentCarousel,
        slides: updatedSlides,
      },
      activeSlideIndex: toIndex,
    });
  },

  updateSlideBackground: (slideIndex, color) => {
    const { currentCarousel } = get();
    if (!currentCarousel) return;

    const updatedSlides = currentCarousel.slides.map((s, idx) =>
      idx === slideIndex ? { ...s, backgroundColor: color } : s
    );

    set({
      currentCarousel: {
        ...currentCarousel,
        slides: updatedSlides,
      },
    });
  },

  addPhotoFrame: (slideIndex, frame) => {
    const { currentCarousel } = get();
    if (!currentCarousel) return;

    const newFrame: CarouselPhotoFrame = {
      ...frame,
      id: `frame-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    };

    const updatedSlides = currentCarousel.slides.map((s, idx) =>
      idx === slideIndex ? { ...s, elements: [...s.elements, newFrame] } : s
    );

    set({
      currentCarousel: {
        ...currentCarousel,
        slides: updatedSlides,
      },
    });
  },

  updatePhotoFrame: (frameId, updates) => {
    const { currentCarousel } = get();
    if (!currentCarousel) return;

    const updatedSlides = currentCarousel.slides.map((s) => ({
      ...s,
      elements: s.elements.map((el) => (el.id === frameId ? { ...el, ...updates } : el)),
    }));

    set({
      currentCarousel: {
        ...currentCarousel,
        slides: updatedSlides,
      },
    });
  },

  removePhotoFrame: (frameId) => {
    const { currentCarousel } = get();
    if (!currentCarousel) return;

    const updatedSlides = currentCarousel.slides.map((s) => ({
      ...s,
      elements: s.elements.filter((el) => el.id !== frameId),
    }));

    set({
      currentCarousel: {
        ...currentCarousel,
        slides: updatedSlides,
      },
      selectedFrameId: get().selectedFrameId === frameId ? null : get().selectedFrameId,
    });
  },

  cycleSlideLayout: (direction: 'next' | 'prev') => {
    const { currentCarousel, activeSlideIndex, slideLayoutIndices } = get();
    if (!currentCarousel) return;
    const targetSlide = currentCarousel.slides[activeSlideIndex];
    if (!targetSlide) return;

    const activeFrames = targetSlide.elements.filter(
      (el): el is CarouselPhotoFrame => el.type === 'photo' && Boolean(el.filePath)
    );
    if (activeFrames.length === 0) return;

    const photos: AdaptivePhoto[] = activeFrames.map((f) => ({
      id: f.id,
      photoId: f.photoId,
      filePath: f.filePath,
      fileName: f.fileName,
      previewPath: f.previewPath,
      thumbnailPath: f.thumbnailPath,
      photoAspect: f.photoAspect || (f.height > 0 ? f.width / f.height : 1.0),
    }));

    const variations = generateDynamicVariations(
      {
        containerWidth: currentCarousel.slideWidthPx,
        containerHeight: currentCarousel.slideHeightPx,
        spacing: 16,
        isSpread: false,
      },
      photos
    );

    if (variations.length === 0) return;

    const currentIndex = slideLayoutIndices[activeSlideIndex] ?? 0;
    const nextIndex =
      direction === 'next'
        ? (currentIndex + 1) % variations.length
        : (currentIndex - 1 + variations.length) % variations.length;

    const chosen = variations[nextIndex] || variations[0];
    if (!chosen) return;

    const newPhotoElements: CarouselPhotoFrame[] = chosen.rects.map((rect, i) => {
      const photoIdx =
        chosen.photoAssignments && chosen.photoAssignments[i] !== undefined
          ? chosen.photoAssignments[i]
          : i;
      const photo = photos[photoIdx] || photos[i] || photos[0];
      return {
        type: 'photo',
        id: `frame-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
        photoId: (photo && (photo.photoId || photo.id)) || `photo-${i}`,
        filePath: (photo && photo.filePath) || '',
        fileName: photo ? photo.fileName : undefined,
        previewPath: photo ? photo.previewPath : undefined,
        thumbnailPath: photo ? photo.thumbnailPath : undefined,
        photoAspect: (photo && photo.photoAspect) || 1.0,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        cropX: 0,
        cropY: 0,
        cropScale: 1.0,
      };
    });

    const nonPhotoElements = targetSlide.elements.filter((el) => el.type !== 'photo');

    const updatedSlides = currentCarousel.slides.map((s, idx) =>
      idx === activeSlideIndex
        ? {
            ...s,
            elements: [...newPhotoElements, ...nonPhotoElements],
          }
        : s
    );

    set({
      currentCarousel: {
        ...currentCarousel,
        slides: updatedSlides,
      },
      slideLayoutIndices: {
        ...slideLayoutIndices,
        [activeSlideIndex]: nextIndex,
      },
    });
  },

  applyDynamicSlideLayoutByIndex: (slideIndex: number, variationIndex: number) => {
    const { currentCarousel, slideLayoutIndices } = get();
    if (!currentCarousel) return;
    const targetSlide = currentCarousel.slides[slideIndex];
    if (!targetSlide) return;

    const activeFrames = targetSlide.elements.filter(
      (el): el is CarouselPhotoFrame => el.type === 'photo' && Boolean(el.filePath)
    );
    if (activeFrames.length === 0) return;

    const photos: AdaptivePhoto[] = activeFrames.map((f) => ({
      id: f.id,
      photoId: f.photoId,
      filePath: f.filePath,
      fileName: f.fileName,
      previewPath: f.previewPath,
      thumbnailPath: f.thumbnailPath,
      photoAspect: f.photoAspect || (f.height > 0 ? f.width / f.height : 1.0),
    }));

    const variations = generateDynamicVariations(
      {
        containerWidth: currentCarousel.slideWidthPx,
        containerHeight: currentCarousel.slideHeightPx,
        spacing: 16,
        isSpread: false,
      },
      photos
    );

    if (variations.length === 0) return;
    const clampedIndex = Math.max(0, Math.min(variations.length - 1, variationIndex));
    const chosen = variations[clampedIndex] || variations[0];
    if (!chosen) return;

    const newPhotoElements: CarouselPhotoFrame[] = chosen.rects.map((rect, i) => {
      const photoIdx =
        chosen.photoAssignments && chosen.photoAssignments[i] !== undefined
          ? chosen.photoAssignments[i]
          : i;
      const photo = photos[photoIdx] || photos[i] || photos[0];
      return {
        type: 'photo',
        id: `frame-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
        photoId: (photo && (photo.photoId || photo.id)) || `photo-${i}`,
        filePath: (photo && photo.filePath) || '',
        fileName: photo ? photo.fileName : undefined,
        previewPath: photo ? photo.previewPath : undefined,
        thumbnailPath: photo ? photo.thumbnailPath : undefined,
        photoAspect: (photo && photo.photoAspect) || 1.0,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        cropX: 0,
        cropY: 0,
        cropScale: 1.0,
      };
    });

    const nonPhotoElements = targetSlide.elements.filter((el) => el.type !== 'photo');

    const updatedSlides = currentCarousel.slides.map((s, idx) =>
      idx === slideIndex
        ? {
            ...s,
            elements: [...newPhotoElements, ...nonPhotoElements],
          }
        : s
    );

    set({
      currentCarousel: {
        ...currentCarousel,
        slides: updatedSlides,
      },
      slideLayoutIndices: {
        ...slideLayoutIndices,
        [slideIndex]: clampedIndex,
      },
      activeSlideIndex: slideIndex,
    });
  },

  applyCarouselLayout: (slideIndex, presetId, inputPhotos) => {
    const { currentCarousel } = get();
    if (!currentCarousel) return;

    const preset = CAROUSEL_LAYOUT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const targetSlide = currentCarousel.slides[slideIndex];
    if (!targetSlide) return;

    // Gather photos: if inputPhotos provided, use them; otherwise extract from target slide (and spanned slides if multi-slide)
    let photosToUse: CarouselLayoutPhotoInput[] = inputPhotos && inputPhotos.length > 0 ? inputPhotos : [];
    if (photosToUse.length === 0) {
      const collected: CarouselLayoutPhotoInput[] = [];
      const maxSlide = Math.min(currentCarousel.slides.length - 1, slideIndex + preset.spanSlides - 1);
      for (let idx = slideIndex; idx <= maxSlide; idx++) {
        const s = currentCarousel.slides[idx];
        if (s) {
          s.elements.forEach((el) => {
            if (el.type === 'photo' && el.filePath) {
              collected.push({
                id: el.id,
                photoId: el.photoId,
                filePath: el.filePath,
                fileName: el.fileName,
                previewPath: el.previewPath,
                thumbnailPath: el.thumbnailPath,
                photoAspect: el.photoAspect,
              });
            }
          });
        }
      }
      photosToUse = collected;
    }

    if (photosToUse.length === 0) return;

    // If preset is per_slide and photos exceed preset slots, dynamically layout all photos to prevent photo loss
    if (preset.category === 'per_slide' && photosToUse.length > preset.maxPhotos) {
      get().applyDynamicSlideLayoutByIndex(slideIndex, 0);
      return;
    }

    const generatedFrames = preset.generate({
      slideWidth: currentCarousel.slideWidthPx,
      slideHeight: currentCarousel.slideHeightPx,
      slideIndex,
      totalSlides: currentCarousel.totalSlides,
      photos: photosToUse,
      spacing: 16,
      margin: 40,
    });

    // Zero-Blank Guarantee: strictly filter out any frame lacking valid filePath
    const validFrames = generatedFrames.filter((f) => Boolean(f.filePath));

    const framesWithIds: CarouselPhotoFrame[] = validFrames.map((f, i) => ({
      ...f,
      id: `frame-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
    }));

    // Update slides: targetSlide gets the new frames
    // Spanned subsequent slides (from slideIndex + 1 to slideIndex + preset.spanSlides - 1) have their photo frames cleared
    const spannedIndices = new Set<number>();
    for (let idx = slideIndex + 1; idx < slideIndex + preset.spanSlides; idx++) {
      spannedIndices.add(idx);
    }

    const nonPhotoElements = targetSlide.elements.filter((el) => el.type !== 'photo');

    const updatedSlides = currentCarousel.slides.map((s, idx) => {
      if (idx === slideIndex) {
        return {
          ...s,
          elements: [...framesWithIds, ...nonPhotoElements],
        };
      }
      if (spannedIndices.has(idx)) {
        return {
          ...s,
          elements: s.elements.filter((el) => el.type !== 'photo'),
        };
      }
      return s;
    });

    set({
      currentCarousel: {
        ...currentCarousel,
        slides: updatedSlides,
      },
      activeSlideIndex: slideIndex,
    });
  },

  shuffleSlidePhotos: (slideIndex) => {
    const { currentCarousel } = get();
    if (!currentCarousel) return;
    const slide = currentCarousel.slides[slideIndex];
    if (!slide) return;

    const photoFrames = slide.elements.filter((el): el is CarouselPhotoFrame => el.type === 'photo');
    if (photoFrames.length <= 1) return;

    // Extract photo payloads
    const payloads = photoFrames.map((f) => ({
      photoId: f.photoId,
      filePath: f.filePath,
      fileName: f.fileName,
      previewPath: f.previewPath,
      thumbnailPath: f.thumbnailPath,
      photoAspect: f.photoAspect,
    }));

    // Fisher-Yates shuffle
    for (let i = payloads.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tempI = payloads[i];
      const tempJ = payloads[j];
      if (tempI && tempJ) {
        payloads[i] = tempJ;
        payloads[j] = tempI;
      }
    }

    let pIdx = 0;
    const updatedElements = slide.elements.map((el) => {
      if (el.type !== 'photo') return el;
      const p = payloads[pIdx++];
      return p ? { ...el, ...p, cropX: 0, cropY: 0, cropScale: 1.0 } : el;
    });

    const updatedSlides = currentCarousel.slides.map((s, idx) =>
      idx === slideIndex ? { ...s, elements: updatedElements } : s
    );

    set({
      currentCarousel: {
        ...currentCarousel,
        slides: updatedSlides,
      },
    });
  },

  toggleSliceGuides: () => set((state) => ({ showSliceGuides: !state.showSliceGuides })),
  setShowSliceGuides: (show) => set({ showSliceGuides: show }),
}));
