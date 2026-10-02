import { create } from 'zustand';
import {
  Carousel,
  CarouselSlide,
  CarouselRatio,
  CarouselPhotoFrame,
  CarouselTextFrame,
  CarouselElement,
  FrameStyleSnapshot,
  extractFrameStyle,
  createInitialCarousel,
  createCarouselSlide,
  scaleFramesForRatioSwitch,
  CAROUSEL_RATIO_PRESETS,
  MAX_CAROUSEL_SLIDES,
  MIN_CAROUSEL_SLIDES,
  isCarouselEqual,
} from '../domain/carousel';
import { CAROUSEL_LAYOUT_PRESETS, CarouselLayoutPhotoInput } from '../domain/carouselLayout';
import { generateDynamicVariations } from '../domain/layout/generator';
import { AdaptivePhoto } from '../domain/adaptiveLayout';
import { generateAutoFlowPlan } from '../domain/storytelling/autoFlowEngine';
import type { Photo } from '../domain/photo';
import type { PhotoFrameElement } from '../domain/editor';

let carouselDbWriteQueue: Promise<unknown> = Promise.resolve();
export function persistCarouselInOrder<T>(write: () => Promise<T>): Promise<T> {
  const result = carouselDbWriteQueue.then(write, write);
  carouselDbWriteQueue = result.catch(() => false);
  return result;
}

export interface CarouselState {
  currentCarousel: Carousel | null;
  activeSlideIndex: number;
  showSliceGuides: boolean;
  selectedFrameId: string | null;
  selectedFrameIds: string[];
  slideLayoutIndices: Record<number, number>;

  // Persistence State
  saveStatus: 'saved' | 'saving' | 'unsaved';
  lastSavedAt: string | null;

  // History & Undo/Redo
  past: Carousel[];
  future: Carousel[];
  canUndo: boolean;
  canRedo: boolean;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;

  // Persistence Actions
  markDirty: () => void;
  setSaveStatus: (status: 'saved' | 'saving' | 'unsaved') => void;
  saveCarouselToDb: () => Promise<boolean>;
  loadCarouselFromDb: (projectId: string) => Promise<boolean>;

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
  addPhotoFrames: (
    slideIndex: number,
    photos: Photo[],
    options?: { targetFrameId?: string; isReplace?: boolean }
  ) => string[];
  updatePhotoFrame: (frameId: string, updates: Partial<CarouselPhotoFrame>) => void;
  updateTextFrame: (frameId: string, updates: Partial<CarouselTextFrame>) => void;
  removePhotoFrame: (frameId: string) => void;
  cycleSlideLayout: (direction: 'next' | 'prev') => void;
  applyDynamicSlideLayoutByIndex: (slideIndex: number, variationIndex: number) => void;
  applyCarouselLayout: (slideIndex: number, presetId: string, photos?: CarouselLayoutPhotoInput[]) => void;
  shuffleSlidePhotos: (slideIndex: number) => void;
  autoFlowPhotosToSlides: (photos: Photo[]) => Promise<void>;
  setPanoramaSpan: ((frameId: string, spanSlides: 2 | 3) => void) &
    ((slideIndex: number, frameId: string, spanSlides: 2 | 3) => void);
  setHeroPhotoOnSlide: (slideIndex: number, frameId: string) => void;
  batchUpdateFrames: (updates: Array<{ id: string; updates: Partial<CarouselPhotoFrame> | Partial<CarouselTextFrame> }>) => void;
  swapFrames: (frameIdA: string, frameIdB: string) => void;
  toggleSliceGuides: () => void;
  setShowSliceGuides: (show: boolean) => void;
  addTextFrame: () => void;
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
  saveStatus: 'saved',
  lastSavedAt: null,

  markDirty: () => {
    if (get().saveStatus !== 'unsaved') {
      set({ saveStatus: 'unsaved' });
    }
  },

  setSaveStatus: (status) => {
    const updates: Partial<CarouselState> = { saveStatus: status };
    if (status === 'saved') {
      updates.lastSavedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    set(updates);
  },

  saveCarouselToDb: () => persistCarouselInOrder(async () => {
    const { currentCarousel } = get();
    if (!currentCarousel) return false;

    set({ saveStatus: 'saving' });

    const sanitizeFrame = (frame: CarouselElement): any => {
      if (frame.type === 'text') {
        return {
          type: 'text',
          id: frame.id,
          x: Number.isFinite(frame.x) ? frame.x : 0,
          y: Number.isFinite(frame.y) ? frame.y : 0,
          width: Number.isFinite(frame.width) ? frame.width : 100,
          height: Number.isFinite(frame.height) ? frame.height : 80,
          text: frame.text || '',
          fontSize: frame.fontSize || 48,
          fontFamily: frame.fontFamily || 'SF Pro Display, system-ui, sans-serif',
          fontWeight: frame.fontWeight || '700',
          color: frame.color || '#FFFFFF',
          align: frame.align || 'center',
          locked: Boolean(frame.locked),
          opacity: Number.isFinite(frame.opacity) ? Math.max(0, Math.min(1, frame.opacity!)) : 1.0,
          rotation: Number.isFinite(frame.rotation) ? frame.rotation : 0,
          styledRanges: Array.isArray(frame.styledRanges) ? frame.styledRanges : undefined,
          style: frame.style ? frame.style : undefined,
          highlight: frame.highlight || undefined,
          lineHeight: frame.lineHeight !== undefined ? frame.lineHeight : undefined,
          letterSpacing: frame.letterSpacing !== undefined ? frame.letterSpacing : undefined,
        };
      }
      const cornerRadiusNum = typeof frame.cornerRadius === 'number' ? frame.cornerRadius : null;
      return {
        type: 'photo',
        id: frame.id,
        photoId: frame.photoId || null,
        filePath: frame.filePath || '',
        fileName: frame.fileName || '',
        previewPath: frame.previewPath || null,
        thumbnailPath: frame.thumbnailPath || null,
        x: Number.isFinite(frame.x) ? frame.x : 0,
        y: Number.isFinite(frame.y) ? frame.y : 0,
        width: Number.isFinite(frame.width) ? frame.width : 100,
        height: Number.isFinite(frame.height) ? frame.height : 100,
        rotation: Number.isFinite(frame.rotation) ? frame.rotation : 0,
        zIndex: Number.isFinite(frame.zIndex) ? frame.zIndex : 1,
        photoAspect: typeof frame.photoAspect === 'number' && frame.photoAspect > 0 ? frame.photoAspect : 1.0,
        cropX: Number.isFinite(frame.cropX) ? frame.cropX : 0,
        cropY: Number.isFinite(frame.cropY) ? frame.cropY : 0,
        cropScale: Number.isFinite(frame.cropScale) && (frame.cropScale ?? 0) > 0 ? frame.cropScale : 1.0,
        cropRotation: Number.isFinite(frame.cropRotation) ? frame.cropRotation : 0,
        borderEnabled: Boolean(frame.borderEnabled),
        borderWidth: Number.isFinite(frame.borderWidth) ? frame.borderWidth : 0,
        borderColor: frame.borderColor || '#FFFFFF',
        borderStyle: frame.borderStyle || 'solid',
        opacity: Number.isFinite(frame.opacity) ? Math.max(0, Math.min(1, frame.opacity!)) : 1.0,
        locked: Boolean(frame.locked),
        shapeType: frame.shapeType || null,
        customSvgPath: frame.customSvgPath || null,
        cornerRadiusTl: frame.cornerRadiusTl ?? cornerRadiusNum,
        cornerRadiusTr: frame.cornerRadiusTr ?? cornerRadiusNum,
        cornerRadiusBr: frame.cornerRadiusBr ?? cornerRadiusNum,
        cornerRadiusBl: frame.cornerRadiusBl ?? cornerRadiusNum,
      };
    };

    const sanitizedCarousel = {
      id: currentCarousel.id,
      projectId: currentCarousel.projectId,
      ratio: currentCarousel.ratio,
      slideWidthPx: currentCarousel.slideWidthPx,
      slideHeightPx: currentCarousel.slideHeightPx,
      totalSlides: currentCarousel.totalSlides,
      slides: (currentCarousel.slides || []).map((slide, idx) => ({
        id: slide.id,
        slideIndex: typeof slide.slideIndex === 'number' ? slide.slideIndex : idx,
        widthPx: slide.widthPx,
        heightPx: slide.heightPx,
        backgroundColor: slide.backgroundColor || '#FFFFFF',
        elements: (slide.elements || []).map(sanitizeFrame),
      })),
    };

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('save_carousel_structure', { carousel: sanitizedCarousel });

      // Crash recovery snapshot
      try {
        if (isCarouselEqual(get().currentCarousel, currentCarousel)) {
          localStorage.setItem(`afsn_carousel_snapshot_${sanitizedCarousel.projectId}`, JSON.stringify({
            projectId: sanitizedCarousel.projectId,
            savedAt: new Date().toISOString(),
            carousel: sanitizedCarousel,
          }));
          localStorage.removeItem(`afsn_dirty_${sanitizedCarousel.projectId}`);
        }
      } catch {}

      if (isCarouselEqual(get().currentCarousel, currentCarousel)) {
        set({
          saveStatus: 'saved',
          lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      }
      return true;
    } catch (err) {
      console.warn('[AFSN] save_carousel_structure failed or non-Tauri environment:', err);
      // Fallback: save to localStorage snapshot
      try {
        localStorage.setItem(`afsn_carousel_snapshot_${sanitizedCarousel.projectId}`, JSON.stringify({
          projectId: sanitizedCarousel.projectId,
          savedAt: new Date().toISOString(),
          carousel: sanitizedCarousel,
        }));
      } catch {}

      if (isCarouselEqual(get().currentCarousel, currentCarousel)) {
        set({ saveStatus: 'unsaved' });
      }
      return false;
    }
  }),

  loadCarouselFromDb: async (projectId: string) => {
    try {
      let payload: any = null;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        payload = await invoke<any>('load_carousel_structure', { projectId });
      } catch (invokeErr) {
        console.warn('[AFSN] load_carousel_structure invoke failed, checking snapshot:', invokeErr);
      }

      if (!payload) {
        // Fallback to localStorage snapshot
        try {
          const snapshotRaw = localStorage.getItem(`afsn_carousel_snapshot_${projectId}`);
          if (snapshotRaw) {
            const parsed = JSON.parse(snapshotRaw);
            payload = parsed.carousel || parsed;
          }
        } catch {}
      }

      if (!payload || !payload.id) {
        return false;
      }

      const ratio = (payload.ratio || '1:1') as CarouselRatio;
      const preset = CAROUSEL_RATIO_PRESETS[ratio] || CAROUSEL_RATIO_PRESETS['1:1'];

      const domainSlides: CarouselSlide[] = (payload.slides || []).map((slide: any, idx: number) => ({
        id: slide.id || `slide-${projectId}-${idx + 1}`,
        slideIndex: typeof slide.slideIndex === 'number' ? slide.slideIndex : idx,
        widthPx: slide.widthPx || preset.width,
        heightPx: slide.heightPx || preset.height,
        backgroundColor: slide.backgroundColor || '#FFFFFF',
        elements: (slide.elements || []).map((el: any): CarouselElement => {
          if (el.type === 'text') {
            return {
              type: 'text',
              id: el.id,
              x: Number(el.x ?? 0),
              y: Number(el.y ?? 0),
              width: Number(el.width ?? 100),
              height: Number(el.height ?? 80),
              text: el.text || '',
              fontSize: Number(el.fontSize || 48),
              fontFamily: el.fontFamily || 'SF Pro Display, system-ui, sans-serif',
              fontWeight: el.fontWeight || '700',
              color: el.color || '#FFFFFF',
              align: el.align || 'center',
              locked: Boolean(el.locked),
              opacity: Number(el.opacity ?? 1.0),
              rotation: Number(el.rotation ?? 0),
              styledRanges: Array.isArray(el.styledRanges) ? el.styledRanges : undefined,
              style: el.style || undefined,
              highlight: el.highlight || undefined,
              lineHeight: el.lineHeight !== undefined && el.lineHeight !== null ? Number(el.lineHeight) : undefined,
              letterSpacing: el.letterSpacing !== undefined && el.letterSpacing !== null ? Number(el.letterSpacing) : undefined,
            };
          }
          return {
            type: 'photo',
            id: el.id,
            photoId: el.photoId || undefined,
            filePath: el.filePath || '',
            fileName: el.fileName || '',
            previewPath: el.previewPath || undefined,
            thumbnailPath: el.thumbnailPath || undefined,
            x: Number(el.x ?? 0),
            y: Number(el.y ?? 0),
            width: Number(el.width ?? 100),
            height: Number(el.height ?? 100),
            rotation: Number(el.rotation ?? 0),
            zIndex: el.zIndex !== undefined && el.zIndex !== null ? Number(el.zIndex) : 1,
            photoAspect: el.photoAspect !== undefined && el.photoAspect !== null ? Number(el.photoAspect) : 1.0,
            cropX: Number(el.cropX ?? 0),
            cropY: Number(el.cropY ?? 0),
            cropScale: Number(el.cropScale ?? 1.0),
            cropRotation: Number(el.cropRotation ?? 0),
            borderEnabled: Boolean(el.borderEnabled),
            borderWidth: Number(el.borderWidth ?? 0),
            borderColor: el.borderColor || '#FFFFFF',
            borderStyle: el.borderStyle || 'solid',
            opacity: Number(el.opacity ?? 1.0),
            locked: Boolean(el.locked),
            shapeType: el.shapeType || undefined,
            customSvgPath: el.customSvgPath || undefined,
            cornerRadius: el.cornerRadius !== undefined ? Number(el.cornerRadius) : (el.cornerRadiusTl ?? undefined),
            cornerRadiusTl: el.cornerRadiusTl !== undefined && el.cornerRadiusTl !== null ? Number(el.cornerRadiusTl) : undefined,
            cornerRadiusTr: el.cornerRadiusTr !== undefined && el.cornerRadiusTr !== null ? Number(el.cornerRadiusTr) : undefined,
            cornerRadiusBr: el.cornerRadiusBr !== undefined && el.cornerRadiusBr !== null ? Number(el.cornerRadiusBr) : undefined,
            cornerRadiusBl: el.cornerRadiusBl !== undefined && el.cornerRadiusBl !== null ? Number(el.cornerRadiusBl) : undefined,
          };
        }),
      }));

      const loadedCarousel: Carousel = {
        id: payload.id,
        projectId: payload.projectId || projectId,
        ratio,
        slideWidthPx: payload.slideWidthPx || preset.width,
        slideHeightPx: payload.slideHeightPx || preset.height,
        slides: domainSlides,
        totalSlides: payload.totalSlides || domainSlides.length,
      };

      set({
        currentCarousel: loadedCarousel,
        activeSlideIndex: 0,
        selectedFrameId: null,
        selectedFrameIds: [],
        slideLayoutIndices: {},
        past: [],
        future: [],
        canUndo: false,
        canRedo: false,
        saveStatus: 'saved',
        lastSavedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      return true;
    } catch (err) {
      console.error('[AFSN] Error loading carousel structure:', err);
      return false;
    }
  },

  pushHistory: () => {
    const { currentCarousel, past } = get();
    if (!currentCarousel) return;
    get().markDirty();
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
      saveStatus: 'unsaved',
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
      saveStatus: 'unsaved',
    });
    get().markDirty();
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
      saveStatus: 'unsaved',
    });
    get().markDirty();
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
      saveStatus: 'saved',
      lastSavedAt: null,
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
    const { slideWidthPx } = currentCarousel;

    // ISO-04: The duplicated slide is inserted at index + 1.
    // Its elements are cloned from the source and shifted by +slideWidthPx.
    const duplicated: CarouselSlide = {
      ...target,
      id: `slide-${currentCarousel.projectId}-${Date.now()}-dup`,
      elements: target.elements.map((el) => ({
        ...el,
        id: `${el.id}-dup-${Date.now()}`,
        x: Math.round(el.x + slideWidthPx),
      })),
    };

    // Build original index map before building the new array
    const originalIndexById = new Map(currentCarousel.slides.map((s, i) => [s.id, i]));

    const newSlides = [
      ...currentCarousel.slides.slice(0, index + 1),
      duplicated,
      ...currentCarousel.slides.slice(index + 1),
    ].map((slide, newIdx) => {
      const originalIdx = originalIndexById.get(slide.id);
      if (originalIdx === undefined) {
        // This is the duplicated slide — elements already have correct shifted x coords
        return { ...slide, slideIndex: newIdx };
      }
      const deltaX = (newIdx - originalIdx) * slideWidthPx;
      return {
        ...slide,
        slideIndex: newIdx,
        elements: deltaX === 0
          ? slide.elements
          : slide.elements.map((el) => ({ ...el, x: Math.round(el.x + deltaX) })),
      };
    });

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
    const { slideWidthPx } = currentCarousel;

    // ISO-04: Slides after the deleted index shift left by one slideWidthPx.
    // For slide at new index i:
    //   - If i < index (was before deleted slide): originalIdx = i, deltaX = 0
    //   - If i >= index (was after deleted slide): originalIdx = i + 1, deltaX = -slideWidthPx
    const newSlides = currentCarousel.slides
      .filter((_, idx) => idx !== index)
      .map((slide, newIdx) => {
        const originalIdx = newIdx >= index ? newIdx + 1 : newIdx;
        const deltaX = (newIdx - originalIdx) * slideWidthPx; // 0 or -slideWidthPx
        return {
          ...slide,
          slideIndex: newIdx,
          elements: deltaX === 0
            ? slide.elements
            : slide.elements.map((el) => ({ ...el, x: Math.round(el.x + deltaX) })),
        };
      });

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
    if (!currentCarousel || fromIndex === toIndex) return;

    pushHistory();

    // ISO-04: Capture pre-reorder indices by stable slide ID before mutation.
    const oldIndexById = new Map(currentCarousel.slides.map((s, i) => [s.id, i]));

    const slides = [...currentCarousel.slides];
    const [moved] = slides.splice(fromIndex, 1);
    if (!moved) return;
    slides.splice(toIndex, 0, moved);

    const { slideWidthPx } = currentCarousel;

    const updatedSlides = slides.map((slide, newIdx) => {
      const oldIdx = oldIndexById.get(slide.id) ?? newIdx;
      const deltaX = (newIdx - oldIdx) * slideWidthPx;
      return {
        ...slide,
        slideIndex: newIdx,
        elements: deltaX === 0
          ? slide.elements
          : slide.elements.map((el) => ({ ...el, x: Math.round(el.x + deltaX) })),
      };
    });

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

  addPhotoFrames: (slideIndex, photos, options) => {
    const { currentCarousel, slideLayoutIndices, pushHistory } = get();
    if (!currentCarousel || photos.length === 0) return [];
    if (slideIndex < 0 || slideIndex >= currentCarousel.slides.length) return [];

    const targetSlide = currentCarousel.slides[slideIndex];
    if (!targetSlide) return [];

    const existingPhotoFrames = targetSlide.elements.filter(
      (el): el is CarouselPhotoFrame => el.type === 'photo'
    );
    const nonPhotoElements = targetSlide.elements.filter((el) => el.type !== 'photo');

    // Case A: Single-Photo Frame Replacement
    if (photos.length === 1 && (options?.isReplace || options?.targetFrameId)) {
      const targetId = options.targetFrameId || get().selectedFrameId;
      let actualSlideIdx = slideIndex;
      let targetFrame = targetId ? existingPhotoFrames.find((f) => f.id === targetId) : undefined;

      // Fallback search across other slides if targetId was specified but not on targetSlide
      if (!targetFrame && targetId) {
        for (let sIdx = 0; sIdx < currentCarousel.slides.length; sIdx++) {
          const f = currentCarousel.slides[sIdx]?.elements.find((el) => el.id === targetId && el.type === 'photo');
          if (f) {
            targetFrame = f as CarouselPhotoFrame;
            actualSlideIdx = sIdx;
            break;
          }
        }
      }

      if (targetFrame) {
        pushHistory();
        const photo = photos[0]!;
        const aspect = photo.width && photo.height ? photo.width / photo.height : 1.0;
        const updatedFrame: CarouselPhotoFrame = {
          ...targetFrame,
          photoId: photo.id,
          filePath: photo.filePath,
          fileName: photo.fileName,
          previewPath: photo.previewPath ?? undefined,
          thumbnailPath: photo.thumbnailPath ?? undefined,
          photoAspect: aspect,
          cropX: 0,
          cropY: 0,
          cropScale: 1.0,
        };

        const updatedSlides = currentCarousel.slides.map((s, idx) =>
          idx === actualSlideIdx
            ? {
                ...s,
                elements: s.elements.map((el) => (el.id === targetFrame!.id ? updatedFrame : el)),
              }
            : s
        );

        set({
          currentCarousel: {
            ...currentCarousel,
            slides: updatedSlides,
          },
          activeSlideIndex: actualSlideIdx,
          selectedFrameId: targetFrame.id,
          selectedFrameIds: [targetFrame.id],
        });
        return [targetFrame.id];
      }
    }

    // Case B: Fresh Batch Drop or Smart Reflow
    pushHistory();

    const existingAdaptive: Array<AdaptivePhoto & { _origFrame?: CarouselPhotoFrame }> = existingPhotoFrames
      .filter((f) => Boolean(f.filePath))
      .map((f) => ({
        id: f.id,
        photoId: f.photoId || f.id,
        filePath: f.filePath!,
        fileName: f.fileName,
        previewPath: f.previewPath,
        thumbnailPath: f.thumbnailPath,
        photoAspect: f.photoAspect || (f.height > 0 ? f.width / f.height : 1.0),
        _origFrame: f,
      }));

    const incomingAdaptive: Array<AdaptivePhoto & { _origFrame?: CarouselPhotoFrame }> = photos.map((p, idx) => ({
      id: `photo-in-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
      photoId: p.id,
      filePath: p.filePath,
      fileName: p.fileName,
      previewPath: p.previewPath ?? undefined,
      thumbnailPath: p.thumbnailPath ?? undefined,
      photoAspect: p.width > 0 && p.height > 0 ? p.width / p.height : 1.0,
      isFavorite: p.isFavorite,
    }));

    const combinedPhotos = [...existingAdaptive, ...incomingAdaptive];
    if (combinedPhotos.length === 0) return [];

    const variations = generateDynamicVariations(
      {
        containerWidth: currentCarousel.slideWidthPx,
        containerHeight: currentCarousel.slideHeightPx,
        spacing: 16,
        isSpread: false,
      },
      combinedPhotos
    );

    if (variations.length === 0) return [];

    const chosen = variations[0]!;
    const slideStartX = slideIndex * currentCarousel.slideWidthPx;
    const newlyPlacedIds: string[] = [];

    const newPhotoElements: CarouselPhotoFrame[] = chosen.rects.map((rect, i) => {
      const photoIdx =
        chosen.photoAssignments && chosen.photoAssignments[i] !== undefined
          ? chosen.photoAssignments[i]!
          : i;
      const item = combinedPhotos[photoIdx] || combinedPhotos[i] || combinedPhotos[0]!;
      const orig = item._origFrame;

      if (orig) {
        // Preserve original frame id and styling attributes (fixing WARN-03)
        return {
          type: 'photo',
          id: orig.id,
          photoId: item.photoId || orig.photoId || orig.id,
          filePath: item.filePath || orig.filePath || '',
          fileName: item.fileName || orig.fileName,
          previewPath: item.previewPath ?? orig.previewPath,
          thumbnailPath: item.thumbnailPath ?? orig.thumbnailPath,
          photoAspect: item.photoAspect || orig.photoAspect || 1.0,
          x: Math.round(slideStartX + rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          cropX: 0,
          cropY: 0,
          cropScale: 1.0,
          rotation: orig.rotation,
          locked: orig.locked,
          cornerRadius: orig.cornerRadius,
          cornerRadiusTl: orig.cornerRadiusTl,
          cornerRadiusTr: orig.cornerRadiusTr,
          cornerRadiusBr: orig.cornerRadiusBr,
          cornerRadiusBl: orig.cornerRadiusBl,
          shapeType: orig.shapeType,
          customSvgPath: orig.customSvgPath,
          borderEnabled: orig.borderEnabled,
          borderWidth: orig.borderWidth,
          borderColor: orig.borderColor,
          borderStyle: orig.borderStyle,
          isMissing: orig.isMissing,
        };
      }

      // Freshly placed photo frame
      const frameId = `frame-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`;
      newlyPlacedIds.push(frameId);
      return {
        type: 'photo',
        id: frameId,
        photoId: item.photoId || item.id,
        filePath: item.filePath || '',
        fileName: item.fileName,
        previewPath: item.previewPath,
        thumbnailPath: item.thumbnailPath,
        photoAspect: item.photoAspect || 1.0,
        x: Math.round(slideStartX + rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        cropX: 0,
        cropY: 0,
        cropScale: 1.0,
      };
    });

    const updatedSlides = currentCarousel.slides.map((s, idx) =>
      idx === slideIndex
        ? {
            ...s,
            elements: [...newPhotoElements, ...nonPhotoElements],
          }
        : s
    );

    const activeFrameIds = newlyPlacedIds.length > 0 ? newlyPlacedIds : newPhotoElements.map((f) => f.id);

    set({
      currentCarousel: {
        ...currentCarousel,
        slides: updatedSlides,
      },
      activeSlideIndex: slideIndex,
      selectedFrameIds: activeFrameIds,
      selectedFrameId: activeFrameIds[0] || null,
      slideLayoutIndices: {
        ...slideLayoutIndices,
        [slideIndex]: 0,
      },
    });

    return activeFrameIds;
  },

  updatePhotoFrame: (frameId, updates) => {
    const { currentCarousel, pushHistory } = get();
    if (!currentCarousel) return;

    pushHistory();
    const updatedSlides = currentCarousel.slides.map((s) => ({
      ...s,
      elements: s.elements.map((el): CarouselElement => {
        if (el.id === frameId && el.type === 'photo') {
          return { ...el, ...updates };
        }
        return el;
      }),
    }));

    set({
      currentCarousel: {
        ...currentCarousel,
        slides: updatedSlides,
      },
    });
  },

  updateTextFrame: (frameId, updates) => {
    const { currentCarousel, pushHistory } = get();
    if (!currentCarousel) return;

    pushHistory();
    const updatedSlides = currentCarousel.slides.map((s) => ({
      ...s,
      elements: s.elements.map((el): CarouselElement => {
        if (el.id === frameId && el.type === 'text') {
          return { ...el, ...updates };
        }
        return el;
      }),
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

    const lockedFrames = targetSlide.elements.filter(
      (el): el is CarouselPhotoFrame => el.type === 'photo' && Boolean(el.locked)
    );
    const excludedFrames = targetSlide.elements.filter(
      (el): el is CarouselPhotoFrame => el.type === 'photo' && !el.locked && Boolean(el.excludeFromAdaptiveLayout)
    );
    const participatingFrames = targetSlide.elements.filter(
      (el): el is CarouselPhotoFrame => el.type === 'photo' && Boolean(el.filePath) && !el.locked && !el.excludeFromAdaptiveLayout
    );
    if (participatingFrames.length === 0) return;

    // ISO-05: Build style map from participating frames keyed by photoId (stable key that follows the photo).
    // When the layout cycles, geometry changes but visual styles must travel with the photo.
    const styleByPhotoId = new Map<string, FrameStyleSnapshot>(
      participatingFrames.map((f) => [f.photoId || f.id, extractFrameStyle(f)])
    );

    const slideStartX = activeSlideIndex * currentCarousel.slideWidthPx;
    const localObstacles: PhotoFrameElement[] = [...lockedFrames, ...excludedFrames].map((f) => ({
      id: f.id,
      type: 'photo',
      photoId: f.photoId || null,
      filePath: f.filePath || '',
      fileName: f.fileName || '',
      previewPath: f.previewPath || '',
      thumbnailPath: f.thumbnailPath || '',
      x: f.x - slideStartX,
      y: f.y,
      width: f.width,
      height: f.height,
      rotation: f.rotation || 0,
      zIndex: f.zIndex || 1,
      cropX: f.cropX || 0,
      cropY: f.cropY || 0,
      cropScale: f.cropScale || 1.0,
      cropRotation: f.cropRotation || 0,
      borderEnabled: Boolean(f.borderEnabled),
      borderWidth: f.borderWidth || 0,
      borderColor: f.borderColor || '#FFFFFF',
      opacity: f.opacity || 1.0,
      locked: f.locked,
      excludeFromAdaptiveLayout: f.excludeFromAdaptiveLayout,
    }));

    const photos: AdaptivePhoto[] = participatingFrames.map((f) => ({
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
        lockedElements: localObstacles,
      },
      photos
    );

    if (variations.length === 0) return;

    pushHistory();

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
      const photoKey = (photo && (photo.photoId || photo.id)) || `photo-${i}`;
      // ISO-05: Carry forward visual styles from the previous frame for this photo.
      const existingStyle = styleByPhotoId.get(photoKey) ?? {};
      return {
        type: 'photo',
        id: `frame-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
        photoId: photoKey,
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
        ...existingStyle, // ISO-05: Spread style snapshot after geometry
      };
    });

    const nonPhotoElements = targetSlide.elements.filter((el) => el.type !== 'photo');

    const updatedSlides = currentCarousel.slides.map((s, idx) =>
      idx === activeSlideIndex
        ? {
            ...s,
            elements: [...lockedFrames, ...excludedFrames, ...newPhotoElements, ...nonPhotoElements],
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

    const lockedFrames = targetSlide.elements.filter(
      (el): el is CarouselPhotoFrame => el.type === 'photo' && Boolean(el.locked)
    );
    const excludedFrames = targetSlide.elements.filter(
      (el): el is CarouselPhotoFrame => el.type === 'photo' && !el.locked && Boolean(el.excludeFromAdaptiveLayout)
    );
    const participatingFrames = targetSlide.elements.filter(
      (el): el is CarouselPhotoFrame => el.type === 'photo' && Boolean(el.filePath) && !el.locked && !el.excludeFromAdaptiveLayout
    );
    if (participatingFrames.length === 0) return;

    // ISO-05: Build style map keyed by photoId before generating new layout.
    const styleByPhotoId = new Map<string, FrameStyleSnapshot>(
      participatingFrames.map((f) => [f.photoId || f.id, extractFrameStyle(f)])
    );

    const slideStartX = slideIndex * currentCarousel.slideWidthPx;
    const localObstacles: PhotoFrameElement[] = [...lockedFrames, ...excludedFrames].map((f) => ({
      id: f.id,
      type: 'photo',
      photoId: f.photoId || null,
      filePath: f.filePath || '',
      fileName: f.fileName || '',
      previewPath: f.previewPath || '',
      thumbnailPath: f.thumbnailPath || '',
      x: f.x - slideStartX,
      y: f.y,
      width: f.width,
      height: f.height,
      rotation: f.rotation || 0,
      zIndex: f.zIndex || 1,
      cropX: f.cropX || 0,
      cropY: f.cropY || 0,
      cropScale: f.cropScale || 1.0,
      cropRotation: f.cropRotation || 0,
      borderEnabled: Boolean(f.borderEnabled),
      borderWidth: f.borderWidth || 0,
      borderColor: f.borderColor || '#FFFFFF',
      opacity: f.opacity || 1.0,
      locked: f.locked,
      excludeFromAdaptiveLayout: f.excludeFromAdaptiveLayout,
    }));

    const photos: AdaptivePhoto[] = participatingFrames.map((f) => ({
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
        lockedElements: localObstacles,
      },
      photos
    );

    if (variations.length === 0) return;
    const clampedIndex = Math.max(0, Math.min(variations.length - 1, variationIndex));
    const chosen = variations[clampedIndex] || variations[0];
    if (!chosen) return;

    pushHistory();

    const newPhotoElements: CarouselPhotoFrame[] = chosen.rects.map((rect, i) => {
      const photoIdx =
        chosen.photoAssignments && chosen.photoAssignments[i] !== undefined
          ? chosen.photoAssignments[i]
          : i;
      const photo = photos[photoIdx] || photos[i] || photos[0];
      const photoKey = (photo && (photo.photoId || photo.id)) || `photo-${i}`;
      const existingStyle = styleByPhotoId.get(photoKey) ?? {};
      return {
        type: 'photo',
        id: `frame-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
        photoId: photoKey,
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
        ...existingStyle, // ISO-05: Spread style snapshot after geometry
      };
    });

    const nonPhotoElements = targetSlide.elements.filter((el) => el.type !== 'photo');

    const updatedSlides = currentCarousel.slides.map((s, idx) =>
      idx === slideIndex
        ? {
            ...s,
            elements: [...lockedFrames, ...excludedFrames, ...newPhotoElements, ...nonPhotoElements],
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

    const eligibleFrames = slide.elements.filter(
      (el): el is CarouselPhotoFrame =>
        el.type === 'photo' && Boolean(el.filePath) && !el.locked && !el.excludeFromAdaptiveLayout
    );
    if (eligibleFrames.length <= 1) return;

    pushHistory();

    // Extract photo payloads
    const payloads = eligibleFrames.map((f) => ({
      photoId: f.photoId,
      filePath: f.filePath,
      fileName: f.fileName,
      previewPath: f.previewPath,
      thumbnailPath: f.thumbnailPath,
      photoAspect: f.photoAspect,
    }));

    // Fisher-Yates shuffle
    const shuffled = [...payloads];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tempI = shuffled[i];
      const tempJ = shuffled[j];
      if (tempI && tempJ) {
        shuffled[i] = tempJ;
        shuffled[j] = tempI;
      }
    }

    // Force shift if identical
    const isIdentical = shuffled.every(
      (s, idx) => s && payloads[idx] && s.filePath === payloads[idx]?.filePath
    );
    if (isIdentical && shuffled.length > 1) {
      const first = shuffled.shift();
      if (first !== undefined) shuffled.push(first);
    }

    let pIdx = 0;
    const updatedElements = slide.elements.map((el) => {
      if (
        el.type === 'photo' &&
        Boolean(el.filePath) &&
        !el.locked &&
        !el.excludeFromAdaptiveLayout
      ) {
        const newP = shuffled[pIdx++];
        if (newP) {
          return {
            ...el,
            photoId: newP.photoId,
            filePath: newP.filePath,
            fileName: newP.fileName,
            previewPath: newP.previewPath ?? el.previewPath,
            thumbnailPath: newP.thumbnailPath ?? el.thumbnailPath,
            photoAspect: newP.photoAspect ?? el.photoAspect,
            cropX: 0,
            cropY: 0,
            cropScale: 1.0,
          };
        }
      }
      return el;
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
    const { currentCarousel, pushHistory } = get();
    if (!currentCarousel || photos.length === 0) return;

    pushHistory();

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
    get().markDirty();
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
    if (!slide) return;

    const photoFrames = slide.elements.filter((el): el is CarouselPhotoFrame => el.type === 'photo');
    if (photoFrames.length < 2) return;

    const targetFrame = photoFrames.find((el) => el.id === frameId);
    if (!targetFrame) return;

    pushHistory();

    const slideW = currentCarousel.slideWidthPx;
    const slideH = currentCarousel.slideHeightPx;
    const targetHeroId = targetFrame.photoId || targetFrame.id;

    const adaptivePhotos: AdaptivePhoto[] = photoFrames.map((el) => ({
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

    const otherElements = slide.elements.filter((el) => el.type !== 'photo');
    const updatedSlides = [...currentCarousel.slides];
    updatedSlides[slideIndex] = {
      ...slide,
      elements: [...updatedFrames, ...otherElements],
    };

    set({
      currentCarousel: {
        ...currentCarousel,
        slides: updatedSlides,
      },
    });
  },

  batchUpdateFrames: (updates: Array<{ id: string; updates: Partial<CarouselPhotoFrame> | Partial<CarouselTextFrame> }>) => {
    const { currentCarousel, pushHistory } = get();
    if (!currentCarousel || updates.length === 0) return;

    pushHistory();
    const updateMap = new Map(updates.map((u) => [u.id, u.updates]));

    const updatedSlides = currentCarousel.slides.map((slide) => {
      const updatedElements = slide.elements.map((el): CarouselElement => {
        const patch = updateMap.get(el.id);
        if (!patch) return el;
        if (el.type === 'photo') {
          return { ...el, ...(patch as Partial<CarouselPhotoFrame>) };
        }
        return { ...el, ...(patch as Partial<CarouselTextFrame>) };
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

    if (!frameA || !frameB || frameA.locked || frameB.locked) return;

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

  addTextFrame: () => {
    const { currentCarousel, activeSlideIndex, pushHistory } = get();
    if (!currentCarousel) return;
    const slide = currentCarousel.slides[activeSlideIndex];
    if (!slide) return;
    pushHistory();

    const slideStartX = activeSlideIndex * currentCarousel.slideWidthPx;
    const frameId = `text-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const newTextFrame: CarouselTextFrame = {
      type: 'text',
      id: frameId,
      x: Math.round(slideStartX + currentCarousel.slideWidthPx * 0.1),
      y: Math.round(currentCarousel.slideHeightPx * 0.4),
      width: Math.round(currentCarousel.slideWidthPx * 0.8),
      height: 80,
      text: 'Add your text here',
      fontSize: 48,
      fontFamily: 'SF Pro Display, system-ui, sans-serif',
      fontWeight: '700',
      color: '#FFFFFF',
      align: 'center',
      locked: false,
    };

    const updatedSlides = currentCarousel.slides.map((s, idx) =>
      idx === activeSlideIndex
        ? { ...s, elements: [...s.elements, newTextFrame] }
        : s
    );

    set({
      currentCarousel: { ...currentCarousel, slides: updatedSlides },
      selectedFrameId: frameId,
      selectedFrameIds: [frameId],
    });
  },
}));
