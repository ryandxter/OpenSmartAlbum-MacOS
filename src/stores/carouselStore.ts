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
import { generateAutoFlowPlan } from '../domain/storytelling/autoFlowEngine';
import type { Photo } from '../domain/photo';

export interface CarouselState {
  currentCarousel: Carousel | null;
  activeSlideIndex: number;
  showSliceGuides: boolean;
  selectedFrameId: string | null;
  selectedFrameIds: string[];
  slideLayoutIndices: Record<number, number>;

  // History & Undo/Redo
  past: Carousel[];
  future: Carousel[];
  canUndo: boolean;
  canRedo: boolean;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;

  // Actions
  initializeCarousel: (projectId: string, ratio?: CarouselRatio, initialSlidesCount?: number) => void;
  setRatio: (ratio: CarouselRatio) => void;
  setActiveSlide: (index: number) => void;
  setSelectedFrameId: (id: string | null) => void;
  setSelectedFrameIds: (ids: string[]) => void;
  toggleFrameSelection: (id: string, isShift: boolean) => void;
  selectAllFramesOnSlide: (slideIndex?: number) => void;
  deleteSelectedFrames: () => void;
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
  autoFlowPhotosToSlides: (photos: Photo[]) => Promise<void>;
  setPanoramaSpan: ((frameId: string, spanSlides: 2 | 3) => void) &
    ((slideIndex: number, frameId: string, spanSlides: 2 | 3) => void);
  setHeroPhotoOnSlide: (slideIndex: number, frameId: string) => void;
  batchUpdateFrames: (updates: Array<{ id: string; updates: Partial<CarouselPhotoFrame> }>) => void;
  swapFrames: (frameIdA: string, frameIdB: string) => void;
  toggleSliceGuides: () => void;
  setShowSliceGuides: (show: boolean) => void;
}

export const useCarouselStore = create<CarouselState>((set, get) => ({
  currentCarousel: null,
  activeSlideIndex: 0,
  showSliceGuides: true,
  selectedFrameId: null,
  selectedFrameIds: [],
  slideLayoutIndices: {},
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  pushHistory: () => {
    const { currentCarousel, past } = get();
    if (!currentCarousel) return;
    const snapshot: Carousel = JSON.parse(JSON.stringify(currentCarousel));
    const last = past[past.length - 1];
    if (last && JSON.stringify(last) === JSON.stringify(snapshot)) return;
    const newPast = [...past, snapshot];
    if (newPast.length > 50) newPast.shift();
    set({
      past: newPast,
      future: [],
      canUndo: true,
      canRedo: false,
    });
  },

  undo: () => {
    const { past, future, currentCarousel } = get();
    if (!currentCarousel || past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);
    const newFuture = [JSON.parse(JSON.stringify(currentCarousel)), ...future];
    set({
      currentCarousel: previous,
      past: newPast,
      future: newFuture,
      canUndo: newPast.length > 0,
      canRedo: true,
      selectedFrameIds: [],
      selectedFrameId: null,
    });
  },

  redo: () => {
    const { past, future, currentCarousel } = get();
    if (!currentCarousel || future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    const newPast = [...past, JSON.parse(JSON.stringify(currentCarousel))];
    set({
      currentCarousel: next,
      past: newPast,
      future: newFuture,
      canUndo: true,
      canRedo: newFuture.length > 0,
      selectedFrameIds: [],
      selectedFrameId: null,
    });
  },

  clearHistory: () => {
    set({ past: [], future: [], canUndo: false, canRedo: false });
  },

  initializeCarousel: (projectId, ratio = '1:1', initialSlidesCount = 3) => {
    const carousel = createInitialCarousel(projectId, ratio, initialSlidesCount);
    set({
      currentCarousel: carousel,
      activeSlideIndex: 0,
      selectedFrameId: null,
      selectedFrameIds: [],
      slideLayoutIndices: {},
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
  },

  setRatio: (ratio) => {
    const { currentCarousel, pushHistory } = get();
    if (!currentCarousel) return;
    const oldPreset = CAROUSEL_RATIO_PRESETS[currentCarousel.ratio];
    const newPreset = CAROUSEL_RATIO_PRESETS[ratio];
    if (!newPreset || !oldPreset) return;

    pushHistory();
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
    set({
      selectedFrameId: id,
      selectedFrameIds: id ? [id] : [],
    });
  },

  setSelectedFrameIds: (ids) => {
    set({
      selectedFrameIds: ids,
      selectedFrameId: ids.length > 0 ? ids[0] : null,
    });
  },

  toggleFrameSelection: (id, isShift) => {
    const { selectedFrameIds } = get();
    if (!isShift) {
      set({
        selectedFrameIds: [id],
        selectedFrameId: id,
      });
      return;
    }
    const exists = selectedFrameIds.includes(id);
    let nextIds: string[];
    if (exists) {
      nextIds = selectedFrameIds.filter((item) => item !== id);
    } else {
      nextIds = [...selectedFrameIds, id];
    }
    set({
      selectedFrameIds: nextIds,
      selectedFrameId: nextIds.length > 0 ? nextIds[0] : null,
    });
  },

  selectAllFramesOnSlide: (slideIndex) => {
    const { currentCarousel, activeSlideIndex } = get();
    if (!currentCarousel) return;
    const idx = slideIndex !== undefined ? slideIndex : activeSlideIndex;
    const slide = currentCarousel.slides[idx];
    if (!slide) return;
    const photoIds = slide.elements.filter((el) => el.type === 'photo').map((el) => el.id);
    set({
      selectedFrameIds: photoIds,
      selectedFrameId: photoIds.length > 0 ? photoIds[0] : null,
    });
  },

  deleteSelectedFrames: () => {
    const { currentCarousel, selectedFrameIds, pushHistory } = get();
    if (!currentCarousel || selectedFrameIds.length === 0) return;
    pushHistory();
    const idSet = new Set(selectedFrameIds);
    const updatedSlides = currentCarousel.slides.map((slide) => ({
      ...slide,
      elements: slide.elements.filter((el) => !idSet.has(el.id)),
    }));
    set({
      currentCarousel: {
        ...currentCarousel,
        slides: updatedSlides,
      },
      selectedFrameIds: [],
      selectedFrameId: null,
    });
  },

  addSlide: (backgroundColor = '#FFFFFF') => {
    const { currentCarousel, pushHistory } = get();
    if (!currentCarousel || currentCarousel.slides.length >= MAX_CAROUSEL_SLIDES) return;

    pushHistory();
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
    const { currentCarousel, pushHistory } = get();
    if (!currentCarousel || currentCarousel.slides.length >= MAX_CAROUSEL_SLIDES) return;
    const target = currentCarousel.slides[index];
    if (!target) return;

    pushHistory();
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
    const { currentCarousel, pushHistory } = get();
    if (!currentCarousel || currentCarousel.slides.length <= MIN_CAROUSEL_SLIDES) return;

    pushHistory();
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
    const { currentCarousel, pushHistory } = get();
    if (!currentCarousel) return;
    if (fromIndex === toIndex) return;

    pushHistory();
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
    const { currentCarousel, pushHistory } = get();
    if (!currentCarousel) return;

    pushHistory();
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
    const { currentCarousel, pushHistory } = get();
    if (!currentCarousel) return;

    pushHistory();
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
    const { currentCarousel, pushHistory } = get();
    if (!currentCarousel) return;

    pushHistory();
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
    const { currentCarousel, pushHistory } = get();
    if (!currentCarousel) return;

    pushHistory();
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
      selectedFrameIds: get().selectedFrameIds.filter((id) => id !== frameId),
    });
  },

  cycleSlideLayout: (direction: 'next' | 'prev') => {
    const { currentCarousel, activeSlideIndex, slideLayoutIndices, pushHistory } = get();
    if (!currentCarousel) return;
    const targetSlide = currentCarousel.slides[activeSlideIndex];
    if (!targetSlide) return;

    const activeFrames = targetSlide.elements.filter(
      (el): el is CarouselPhotoFrame => el.type === 'photo' && Boolean(el.filePath)
    );
    if (activeFrames.length === 0) return;

    pushHistory();

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

    const slideStartX = activeSlideIndex * currentCarousel.slideWidthPx;

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
        x: Math.round(slideStartX + rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
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
    const { currentCarousel, slideLayoutIndices, pushHistory } = get();
    if (!currentCarousel) return;
    const targetSlide = currentCarousel.slides[slideIndex];
    if (!targetSlide) return;

    pushHistory();

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

    const slideStartX = slideIndex * currentCarousel.slideWidthPx;

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
        x: Math.round(slideStartX + rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
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
    const { currentCarousel, pushHistory } = get();
    if (!currentCarousel) return;

    const preset = CAROUSEL_LAYOUT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const targetSlide = currentCarousel.slides[slideIndex];
    if (!targetSlide) return;

    pushHistory();

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
    const { currentCarousel, pushHistory } = get();
    if (!currentCarousel) return;
    const slide = currentCarousel.slides[slideIndex];
    if (!slide) return;

    const photoFrames = slide.elements.filter((el): el is CarouselPhotoFrame => el.type === 'photo');
    if (photoFrames.length <= 1) return;

    pushHistory();

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

  autoFlowPhotosToSlides: async (photos: Photo[]) => {
    const { currentCarousel } = get();
    if (!currentCarousel || photos.length === 0) return;

    const adaptivePhotos: AdaptivePhoto[] = photos.map((p) => ({
      id: p.id,
      photoId: p.id,
      filePath: p.filePath,
      fileName: p.fileName,
      previewPath: p.previewPath ?? undefined,
      thumbnailPath: p.thumbnailPath ?? undefined,
      photoAspect: p.width > 0 && p.height > 0 ? p.width / p.height : 1.5,
      isFavorite: p.isFavorite,
      createdAt: p.createdAt,
    }));

    const slideW = currentCarousel.slideWidthPx;
    const slideH = currentCarousel.slideHeightPx;

    const generatorOpts = {
      containerWidth: slideW,
      containerHeight: slideH,
      spacing: 16,
      isSpread: false,
    };

    const plans = generateAutoFlowPlan(adaptivePhotos, generatorOpts, {
      maxPhotosPerSpread: 4,
      minPhotosPerSpread: 1,
    });

    if (plans.length === 0) return;

    let updatedSlides = [...currentCarousel.slides];
    const activeSlide = updatedSlides[get().activeSlideIndex];
    const canPopulateActive = activeSlide && activeSlide.elements.length === 0;

    let planStartIdx = 0;
    if (canPopulateActive && activeSlide) {
      const firstPlan = plans[0]!;
      const frames: CarouselPhotoFrame[] = firstPlan.selectedVariation.rects.map((rect, i) => {
        const photoIdx =
          firstPlan.selectedVariation.photoAssignments &&
          firstPlan.selectedVariation.photoAssignments[i] !== undefined
            ? firstPlan.selectedVariation.photoAssignments[i]!
            : i;
        const photo = firstPlan.photos[photoIdx] || firstPlan.photos[i] || firstPlan.photos[0]!;
        const activeSlideIdx = get().activeSlideIndex;
        const activeSlideStartX = activeSlideIdx * slideW;
        return {
          type: 'photo',
          id: `frame-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
          photoId: (photo && (photo.photoId || photo.id)) || `photo-${i}`,
          filePath: (photo && photo.filePath) || '',
          fileName: photo ? photo.fileName : undefined,
          previewPath: photo ? photo.previewPath : undefined,
          thumbnailPath: photo ? photo.thumbnailPath : undefined,
          photoAspect: (photo && photo.photoAspect) || 1.0,
          x: Math.round(activeSlideStartX + rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          cropX: 0,
          cropY: 0,
          cropScale: 1.0,
        };
      });

      updatedSlides[get().activeSlideIndex] = {
        ...activeSlide,
        elements: frames,
      };
      planStartIdx = 1;
    }

    // Append remaining plans as new slides
    for (let pIdx = planStartIdx; pIdx < plans.length; pIdx++) {
      const plan = plans[pIdx]!;
      const newSlide = createCarouselSlide(currentCarousel);
      const targetSlideIdx = updatedSlides.length;
      const targetSlideStartX = targetSlideIdx * slideW;
      const frames: CarouselPhotoFrame[] = plan.selectedVariation.rects.map((rect, i) => {
        const photoIdx =
          plan.selectedVariation.photoAssignments &&
          plan.selectedVariation.photoAssignments[i] !== undefined
            ? plan.selectedVariation.photoAssignments[i]!
            : i;
        const photo = plan.photos[photoIdx] || plan.photos[i] || plan.photos[0]!;
        return {
          type: 'photo',
          id: `frame-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
          photoId: (photo && (photo.photoId || photo.id)) || `photo-${i}`,
          filePath: (photo && photo.filePath) || '',
          fileName: photo ? photo.fileName : undefined,
          previewPath: photo ? photo.previewPath : undefined,
          thumbnailPath: photo ? photo.thumbnailPath : undefined,
          photoAspect: (photo && photo.photoAspect) || 1.0,
          x: Math.round(targetSlideStartX + rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          cropX: 0,
          cropY: 0,
          cropScale: 1.0,
        };
      });

      newSlide.elements = frames;
      updatedSlides.push(newSlide);
    }

    const renumbered = updatedSlides.map((s, idx) => ({ ...s, slideIndex: idx }));

    set({
      currentCarousel: {
        ...currentCarousel,
        slides: renumbered,
        totalSlides: renumbered.length,
      },
      activeSlideIndex: renumbered.length - 1,
    });
  },

  setPanoramaSpan: (arg1: any, arg2: any, arg3?: any) => {
    const { currentCarousel, pushHistory } = get();
    if (!currentCarousel) return;

    pushHistory();

    let slideIndex: number;
    let frameId: string;
    let spanSlides: 2 | 3;

    if (typeof arg1 === 'string') {
      frameId = arg1;
      spanSlides = (arg2 as 2 | 3) || 2;
      slideIndex = currentCarousel.slides.findIndex((s) => s.elements.some((el) => el.id === frameId));
      if (slideIndex === -1) return;
    } else {
      slideIndex = arg1;
      frameId = arg2 as string;
      spanSlides = arg3 || 2;
    }

    const slide = currentCarousel.slides[slideIndex];
    if (!slide) return;

    const frame = slide.elements.find((el) => el.id === frameId);
    if (!frame) return;

    const slideW = currentCarousel.slideWidthPx;
    const slideH = currentCarousel.slideHeightPx;

    // Check if subsequent slides exist; if not, automatically append slides to fit span
    let updatedSlides = [...currentCarousel.slides];
    const neededTotal = slideIndex + spanSlides;
    while (updatedSlides.length < neededTotal && updatedSlides.length < MAX_CAROUSEL_SLIDES) {
      updatedSlides.push(createCarouselSlide(currentCarousel));
    }

    const targetW = slideW * spanSlides;
    const targetX = slideIndex * slideW;

    // Update target frame to span targetW across slides
    const updatedElements = slide.elements.map((el) =>
      el.id === frameId
        ? {
            ...el,
            x: targetX,
            y: 0,
            width: targetW,
            height: slideH,
            rotation: 0,
            cropX: 0,
            cropY: 0,
            cropScale: 1.0,
          }
        : el
    );

    updatedSlides[slideIndex] = {
      ...slide,
      elements: updatedElements,
    };

    const renumbered = updatedSlides.map((s, idx) => ({ ...s, slideIndex: idx }));

    set({
      currentCarousel: {
        ...currentCarousel,
        slides: renumbered,
        totalSlides: renumbered.length,
      },
    });
  },

  setHeroPhotoOnSlide: (slideIndex: number, frameId: string) => {
    const { currentCarousel, pushHistory } = get();
    if (!currentCarousel) return;

    const slide = currentCarousel.slides[slideIndex];
    if (!slide || slide.elements.length < 2) return;

    const targetFrame = slide.elements.find((el) => el.id === frameId);
    if (!targetFrame) return;

    pushHistory();

    const slideW = currentCarousel.slideWidthPx;
    const slideH = currentCarousel.slideHeightPx;
    const targetHeroId = targetFrame.photoId || targetFrame.id;

    const adaptivePhotos: AdaptivePhoto[] = slide.elements.map((el) => ({
      id: el.id,
      photoId: el.photoId,
      filePath: el.filePath,
      fileName: el.fileName,
      previewPath: el.previewPath,
      thumbnailPath: el.thumbnailPath,
      photoAspect: el.photoAspect,
      isHero: el.id === frameId || el.photoId === targetHeroId,
    }));

    const variations = generateDynamicVariations(
      {
        containerWidth: slideW,
        containerHeight: slideH,
        spacing: 16,
        isSpread: false,
        heroPhotoId: targetHeroId,
      },
      adaptivePhotos
    );

    if (variations.length === 0) return;

    const bestVariation = variations[0]!;
    const slideStartX = slideIndex * slideW;

    const updatedFrames: CarouselPhotoFrame[] = bestVariation.rects.map((rect, i) => {
      const photoIdx =
        bestVariation.photoAssignments && bestVariation.photoAssignments[i] !== undefined
          ? bestVariation.photoAssignments[i]!
          : i;
      const photo = adaptivePhotos[photoIdx] || adaptivePhotos[i] || adaptivePhotos[0]!;
      return {
        type: 'photo',
        id: photo.id || `frame-${Date.now()}-${i}`,
        photoId: photo.photoId || `photo-${i}`,
        filePath: photo.filePath || '',
        fileName: photo.fileName,
        previewPath: photo.previewPath,
        thumbnailPath: photo.thumbnailPath,
        photoAspect: photo.photoAspect || 1.0,
        x: slideStartX + rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        cropX: 0,
        cropY: 0,
        cropScale: 1.0,
      };
    });

    const updatedSlides = [...currentCarousel.slides];
    updatedSlides[slideIndex] = {
      ...slide,
      elements: updatedFrames,
    };

    set({
      currentCarousel: {
        ...currentCarousel,
        slides: updatedSlides,
      },
    });
  },

  batchUpdateFrames: (updates: Array<{ id: string; updates: Partial<CarouselPhotoFrame> }>) => {
    const { currentCarousel, pushHistory } = get();
    if (!currentCarousel || updates.length === 0) return;

    pushHistory();
    const updateMap = new Map(updates.map((u) => [u.id, u.updates]));

    const updatedSlides = currentCarousel.slides.map((slide) => {
      const updatedElements = slide.elements.map((el) => {
        const patch = updateMap.get(el.id);
        return patch ? { ...el, ...patch } : el;
      });
      return { ...slide, elements: updatedElements };
    });

    set({
      currentCarousel: {
        ...currentCarousel,
        slides: updatedSlides,
      },
    });
  },

  swapFrames: (frameIdA: string, frameIdB: string) => {
    const { currentCarousel, pushHistory } = get();
    if (!currentCarousel || frameIdA === frameIdB) return;

    let frameA: CarouselPhotoFrame | null = null;
    let frameB: CarouselPhotoFrame | null = null;

    for (const slide of currentCarousel.slides) {
      for (const el of slide.elements) {
        if (el.id === frameIdA && el.type === 'photo') frameA = el;
        if (el.id === frameIdB && el.type === 'photo') frameB = el;
      }
    }

    if (!frameA || !frameB) return;

    pushHistory();

    const payloadA = {
      photoId: frameA.photoId,
      filePath: frameA.filePath,
      fileName: frameA.fileName,
      previewPath: frameA.previewPath,
      thumbnailPath: frameA.thumbnailPath,
      photoAspect: frameA.photoAspect,
    };

    const payloadB = {
      photoId: frameB.photoId,
      filePath: frameB.filePath,
      fileName: frameB.fileName,
      previewPath: frameB.previewPath,
      thumbnailPath: frameB.thumbnailPath,
      photoAspect: frameB.photoAspect,
    };

    const updatedSlides = currentCarousel.slides.map((slide) => {
      const updatedElements = slide.elements.map((el) => {
        if (el.id === frameIdA) {
          return {
            ...el,
            ...payloadB,
            cropX: 0,
            cropY: 0,
            cropScale: 1.0,
          };
        }
        if (el.id === frameIdB) {
          return {
            ...el,
            ...payloadA,
            cropX: 0,
            cropY: 0,
            cropScale: 1.0,
          };
        }
        return el;
      });
      return { ...slide, elements: updatedElements };
    });

    set({
      currentCarousel: {
        ...currentCarousel,
        slides: updatedSlides,
      },
      selectedFrameId: frameIdB,
    });
  },

  toggleSliceGuides: () => set((state) => ({ showSliceGuides: !state.showSliceGuides })),
  setShowSliceGuides: (show) => set({ showSliceGuides: show }),
}));
