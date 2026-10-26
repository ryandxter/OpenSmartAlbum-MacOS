import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { Project, Unit } from '../domain/project';
import {
  Album,
  Spread,
  createInitialAlbum,
  createInteriorSpread,
  duplicateAlbumSpread,
  recalculateAlbumPageNumbers,
  reorderAlbumSpreads,
  moveAlbumSpread,
  getAllAlbumSpreads,
  syncAlbumPhotoAssets,
  isAlbumDesignEqual,
  AlbumElement,
  GraphicElement,
  SpreadBackgroundImage,
} from '../domain/album';
import {
  TextNodeElement,
  serializeTextPayload,
  deserializeTextPayload,
  DEFAULT_TEXT_STYLE,
} from '../domain/text';
import { getProjectDimensionsInCanvasUnit, getUsableAreas, type RectBounds } from '../domain/templates';
import {
  AdaptivePhoto,
  generateAdaptiveLayoutVariations,
  buildSpreadElementsFromVariation,
  shuffleElementsPhotos,
  partitionPageBoxIntoKRects,
} from '../domain/adaptiveLayout';
import { generateDynamicVariations } from '../domain/layout/generator';
import { generateAutoFlowPlan } from '../domain/storytelling/autoFlowEngine';
import { useHistoryStore } from './historyStore';
import { useEditorStore } from './editorStore';
import { useProjectStore } from './projectStore';
import { usePhotoStore } from './photoStore';
import { getCornerRadii, permuteCornerRadiiOnFlip, type PhotoFrameElement } from '../domain/editor';
import { convertUnit } from '../domain/units';
import { StudioFramingPreset, FramingConfig } from '../domain/ai/faceDetection';
import { calculateOptimalStudioCrop } from '../domain/ai/framingMath';
import {
  canvasToUiLayers,
  uiLayersToCanvas,
  reorderLayersMultiSelection,
  normalizeZIndices,
} from '../domain/layout/reorderLayers';
import type { Photo } from '../domain/photo';

let databaseWriteQueue: Promise<unknown> = Promise.resolve();
export function persistInOrder<T>(write: () => Promise<T>): Promise<T> {
  const result = databaseWriteQueue.then(write, write);
  databaseWriteQueue = result.catch(() => false);
  return result;
}

let spacingHistoryTimer: any = null;
let initialAlbumBeforeSpacingChange: Album | null = null;

let safeAreaHistoryTimer: any = null;
let initialAlbumBeforeSafeAreaChange: Album | null = null;

export function flushSafeAreaHistory() {
  if (safeAreaHistoryTimer) {
    clearTimeout(safeAreaHistoryTimer);
    safeAreaHistoryTimer = null;
    if (initialAlbumBeforeSafeAreaChange) {
      useHistoryStore.getState().pushState(initialAlbumBeforeSafeAreaChange);
      initialAlbumBeforeSafeAreaChange = null;
    }
  }
}

export function flushSpacingHistory() {
  flushSafeAreaHistory();
  if (spacingHistoryTimer) {
    clearTimeout(spacingHistoryTimer);
    spacingHistoryTimer = null;
    if (initialAlbumBeforeSpacingChange) {
      useHistoryStore.getState().pushState(initialAlbumBeforeSpacingChange);
      initialAlbumBeforeSpacingChange = null;
    }
  }
}

/**
 * Finds the partition variant index for a specific box and photo elements that best preserves
 * the relative arrangement (columns, rows, heroes) of the existing photos.
 */
export function findBestVariantIndexForBox(
  box: RectBounds,
  elements: PhotoFrameElement[],
  spacing: number
): number {
  const count = elements.length;
  if (count <= 1) return 0;
  const maxVariants = count === 2 ? 4 : count === 3 ? 8 : count === 4 ? 8 : 6;
  let bestV = 0;
  let minDiff = Infinity;

  const sortedElements = [...elements].sort((a, b) => a.y - b.y || a.x - b.x);

  for (let v = 0; v < maxVariants; v++) {
    const rects = partitionPageBoxIntoKRects(box, count, spacing, v);
    const sortedRects = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
    let diff = 0;
    for (let i = 0; i < count; i++) {
      const el = sortedElements[i];
      const r = sortedRects[i];
      if (!el || !r) continue;
      const elCx = (el.x + el.width / 2 - box.x) / Math.max(1, box.width);
      const elCy = (el.y + el.height / 2 - box.y) / Math.max(1, box.height);
      const rCx = (r.x + r.width / 2 - box.x) / Math.max(1, box.width);
      const rCy = (r.y + r.height / 2 - box.y) / Math.max(1, box.height);
      diff += Math.hypot(elCx - rCx, elCy - rCy);
    }
    if (diff < minDiff) {
      minDiff = diff;
      bestV = v;
    }
  }
  return bestV;
}

/**
 * Unified adaptive layout partitioning engine for photo spreads.
 * Dynamically resizes and positions photo frames to fit the active safe margin box and gap spacing,
 * strictly preserving layout topology, photo assignments, and user crops.
 * Full-bleed photos (photos flush with canvas/page boundaries) remain edge-to-edge.
 */
export function applyAdaptiveLayoutToSpread(
  spread: Spread,
  project: Project,
  overrides?: {
    spacingValue?: number;
    spacingUnit?: Unit;
    safeAreaPatch?: Partial<Spread>;
  }
): Spread {
  const isCover = !spread.leftPage || !spread.rightPage;
  const isSpread = !isCover;

  // Build target spread with overrides applied
  let effSpread: Spread = {
    ...spread,
    ...(overrides?.spacingValue !== undefined ? { spacingValue: overrides.spacingValue } : {}),
    ...(overrides?.spacingUnit !== undefined ? { spacingUnit: overrides.spacingUnit } : {}),
    ...(overrides?.safeAreaPatch || {}),
  };

  if (overrides?.safeAreaPatch) {
    const patch = overrides.safeAreaPatch;
    if (effSpread.leftPage) {
      effSpread.leftPage = {
        ...effSpread.leftPage,
        ...(patch.safeArea !== undefined ? { safeArea: patch.safeArea } : {}),
        ...(patch.safeAreaTop !== undefined ? { safeAreaTop: patch.safeAreaTop } : {}),
        ...(patch.safeAreaBottom !== undefined ? { safeAreaBottom: patch.safeAreaBottom } : {}),
        ...(patch.safeAreaOutside !== undefined ? { safeAreaOutside: patch.safeAreaOutside } : {}),
        ...(patch.safeAreaSpine !== undefined ? { safeAreaSpine: patch.safeAreaSpine } : {}),
      };
    }
    if (effSpread.rightPage) {
      effSpread.rightPage = {
        ...effSpread.rightPage,
        ...(patch.safeArea !== undefined ? { safeArea: patch.safeArea } : {}),
        ...(patch.safeAreaTop !== undefined ? { safeAreaTop: patch.safeAreaTop } : {}),
        ...(patch.safeAreaBottom !== undefined ? { safeAreaBottom: patch.safeAreaBottom } : {}),
        ...(patch.safeAreaOutside !== undefined ? { safeAreaOutside: patch.safeAreaOutside } : {}),
        ...(patch.safeAreaSpine !== undefined ? { safeAreaSpine: patch.safeAreaSpine } : {}),
      };
    }
  }

  const dims = getProjectDimensionsInCanvasUnit(project, effSpread);
  const canvasUnit = project?.canvasUnit || effSpread.leftPage?.unit || 'mm';
  const dpi = project?.canvasDpi || 300;

  const rawGap = effSpread.spacingValue ?? project.spacingValue ?? 2;
  const rawGapUnit = effSpread.spacingUnit ?? project.spacingUnit ?? 'mm';
  const targetGapInCanvasUnit = convertUnit(rawGap, rawGapUnit, canvasUnit, dpi);

  const photoElements = (effSpread.elements || []).filter(
    (el): el is PhotoFrameElement => el.type === 'photo'
  );
  const unlockedElements = photoElements.filter((el) => !el.locked);

  const isSafeMarginChange = overrides?.safeAreaPatch !== undefined;

  // If only gap changed and there are < 2 unlocked photos, gap between photos does not alter layout
  if (!isSafeMarginChange && unlockedElements.length < 2) {
    return effSpread;
  }

  if (unlockedElements.length === 0) {
    return effSpread;
  }

  const pageWidth = effSpread.leftPage ? effSpread.leftPage.width : dims.pageWidth;
  const gutterWidth = effSpread.gutterWidth ?? dims.gutterWidth;
  const spineX = pageWidth + gutterWidth / 2;

  const spreadWidth = isCover
    ? pageWidth
    : pageWidth * 2 + gutterWidth;
  const spreadHeight = dims.pageHeight;

  const { leftPageArea, rightPageArea, spreadArea } = getUsableAreas({
    spreadWidth,
    spreadHeight,
    isSpread,
    safeMargin: dims.safeMargin,
    safeMarginTop: dims.safeMarginTop,
    safeMarginBottom: dims.safeMarginBottom,
    safeMarginOutside: dims.safeMarginOutside,
    safeMarginSpine: dims.safeMarginSpine,
    gutterWidth,
    spacing: targetGapInCanvasUnit,
  });

  // Helper to identify full bleed photos (flush with canvas or page outer perimeter)
  const isFullBleedFrame = (f: PhotoFrameElement): boolean => {
    // Full spread bleed
    if (Math.abs(f.width - spreadWidth) <= 2 && Math.abs(f.height - spreadHeight) <= 2 && f.x <= 1 && f.y <= 1) {
      return true;
    }
    // Left page bleed
    if (Math.abs(f.width - pageWidth) <= 2 && Math.abs(f.height - spreadHeight) <= 2 && f.x <= 1 && f.y <= 1) {
      return true;
    }
    // Right page bleed
    if (
      Math.abs(f.width - pageWidth) <= 2 &&
      Math.abs(f.height - spreadHeight) <= 2 &&
      Math.abs(f.x - (pageWidth + gutterWidth)) <= 2 &&
      f.y <= 1
    ) {
      return true;
    }
    return false;
  };

  // Check if any unlocked frame spans across the spine
  const hasSpanningPhoto = unlockedElements.some(
    (f) => f.x < spineX - 5 && f.x + f.width > spineX + 5
  );

  type ClusterTarget = {
    box: RectBounds;
    frames: PhotoFrameElement[];
  };

  const clusters: ClusterTarget[] = [];

  if (isCover || hasSpanningPhoto) {
    clusters.push({
      box: spreadArea,
      frames: unlockedElements,
    });
  } else {
    const leftFrames = unlockedElements.filter((f) => f.x + f.width / 2 < spineX);
    const rightFrames = unlockedElements.filter((f) => f.x + f.width / 2 >= spineX);
    if (leftFrames.length > 0) {
      clusters.push({ box: leftPageArea, frames: leftFrames });
    }
    if (rightFrames.length > 0) {
      clusters.push({ box: rightPageArea, frames: rightFrames });
    }
  }

  const updatedFramesMap = new Map<string, PhotoFrameElement>();

  for (const { box, frames } of clusters) {
    if (frames.length === 1) {
      const f = frames[0];
      if (f) {
        if (isSafeMarginChange) {
          // Adapt single photo frame strictly to the new safe area box in real-time
          updatedFramesMap.set(f.id, {
            ...f,
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            originalWidth: box.width,
            originalHeight: box.height,
          });
        } else {
          updatedFramesMap.set(f.id, f);
        }
      }
      continue;
    }

    // Multi-photo cluster: if only gap changed and all frames are full bleed, keep untouched
    if (!isSafeMarginChange && frames.every((f) => isFullBleedFrame(f))) {
      for (const f of frames) {
        updatedFramesMap.set(f.id, f);
      }
      continue;
    }

    // Partition the box adaptively for this cluster with the target spacing
    const bestV = findBestVariantIndexForBox(box, frames, targetGapInCanvasUnit);
    const rects = partitionPageBoxIntoKRects(box, frames.length, targetGapInCanvasUnit, bestV);

    const elementsWithIdx = frames.map((el, idx) => ({ el, idx }));
    elementsWithIdx.sort((a, b) => a.el.y - b.el.y || a.el.x - b.el.x);

    const sortedRects = rects.map((rect, idx) => ({ rect, idx }));
    sortedRects.sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);

    for (let i = 0; i < elementsWithIdx.length; i++) {
      const item = elementsWithIdx[i];
      if (!item) continue;
      const newRect = sortedRects[i]?.rect;
      const el = item.el;
      if (newRect && el) {
        updatedFramesMap.set(el.id, {
          ...el,
          x: newRect.x,
          y: newRect.y,
          width: newRect.width,
          height: newRect.height,
          originalWidth: newRect.width,
          originalHeight: newRect.height,
        });
      }
    }
  }

  const updatedElements = (effSpread.elements || []).map((el) =>
    el.type === 'photo' ? (updatedFramesMap.get(el.id) || el) : el
  );

  return {
    ...effSpread,
    elements: updatedElements,
  };
}

/**
 * Re-applies adaptive layout partitioning per page/cluster with the new gap spacing in real-time,
 * strictly bounded by the Safe Zone, preserving photos, crops, and layout structure.
 */
export function applyAdaptiveGapToSpread(
  spread: Spread,
  spacingValue: number,
  spacingUnit: Unit,
  project: Project,
  _layoutIndex?: number
): Spread {
  return applyAdaptiveLayoutToSpread(spread, project, { spacingValue, spacingUnit });
}

/**
 * Re-applies adaptive layout partitioning per page/cluster with the new safe margin boundaries in real-time,
 * strictly preserving inter-frame gaps, photos, crops, and layout structure.
 */
export function applyAdaptiveSafeAreaToSpread(
  spread: Spread,
  safeAreaPatch: Partial<Spread>,
  project: Project
): Spread {
  return applyAdaptiveLayoutToSpread(spread, project, { safeAreaPatch });
}

export interface AlbumState {
  currentAlbum: Album | null;
  activeSpreadId: string | null;
  activeSpreadIndex: number;
  selectedSpreadIds: string[];
  selectedPageId: string | null;

  // Persistence State
  saveStatus: 'saved' | 'saving' | 'unsaved';
  lastSavedAt: string | null;

  // Visual Guide Toggles
  showGutterGuide: boolean;
  showBleedGuide: boolean;
  showSafeAreaGuide: boolean;
  showCenterGuide: boolean; // Optical centerlines of left page, right page, and full spread
  showThirdsGuide: boolean; // Rule of Thirds 3×3 grid overlay for composition balance

  // Spread Drawer Open State
  isSpreadDrawerOpen: boolean;

  // Actions
  initializeAlbum: (project: Project) => void;
  loadAlbumFromDb: (projectId: string) => Promise<boolean>;
  saveAlbumToDb: () => Promise<boolean>;
  setSaveStatus: (status: 'saved' | 'saving' | 'unsaved') => void;
  syncPhotoAssets: (photos: Photo[], options?: { persist?: boolean }) => Promise<boolean>;
  undo: () => void;
  redo: () => void;
  setActiveSpread: (spreadId: string) => void;
  setActiveSpreadByIndex: (index: number) => void;
  nextSpread: () => void;
  prevSpread: () => void;
  addSpread: (project: Project, afterIndex?: number) => void;
  deleteSpread: (spreadId: string) => void;
  deleteSpreads: (spreadIds: string[]) => void;
  setSelectedSpreadIds: (spreadIds: string[]) => void;
  toggleSpreadSelection: (spreadId: string, isMulti: boolean, isRange: boolean) => void;
  selectAllSpreads: () => void;
  clearSpreadSelection: () => void;
  duplicateSpread: (spreadId: string, project: Project) => void;
  moveSpread: (spreadId: string, direction: 'left' | 'right') => void;
  reorderSpread: (fromIndex: number, toIndex: number) => void;
  updateBleed: (bleed: number) => void;
  updateSpreadSpacing: (spacingValue: number, spacingUnit?: Unit, project?: Project) => void;
  applySpacingToAllSpreads: (spacingValue: number, spacingUnit?: Unit, project?: Project) => void;
  updateSafeArea: (safeArea: number, side?: 'all' | 'top' | 'bottom' | 'outside' | 'spine', project?: Project) => void;
  applySafeAreaToAllSpreads: (safeArea: number, side?: 'all' | 'top' | 'bottom' | 'outside' | 'spine', project?: Project) => void;
  updateSpreadBackgroundColor: (spreadId: string, color: string, scope?: 'spread' | 'left' | 'right') => void;
  applyBackgroundColorToAllSpreads: (color: string) => void;
  setSpreadBackgroundImage: (
    spreadId: string,
    image: SpreadBackgroundImage | Partial<SpreadBackgroundImage>,
    scope?: 'spread' | 'left' | 'right'
  ) => void;
  updateSpreadBackgroundImage: (spreadId: string, patch: Partial<SpreadBackgroundImage>) => void;
  clearSpreadBackgroundImage: (spreadId: string) => void;
  setSpreadBackgroundColorNoise: (
    spreadId: string,
    noise: number,
    scope?: 'spread' | 'left' | 'right'
  ) => void;
  applyBackgroundNoiseToAllSpreads: (noise: number) => void;
  updateSpreadBorder: (
    spreadId: string,
    border: { borderEnabled?: boolean; borderWidth?: number; borderColor?: string },
    target?: 'both' | 'full' | 'left' | 'right'
  ) => void;
  applyBorderToAllSpreads: (
    border: { borderEnabled?: boolean; borderWidth?: number; borderColor?: string },
    target?: 'both' | 'full' | 'left' | 'right'
  ) => void;
  toggleGuide: (guide: 'gutter' | 'bleed' | 'safeArea' | 'center' | 'thirds') => void;
  setGuideVisibility: (guide: 'gutter' | 'bleed' | 'safeArea' | 'center' | 'thirds', visible: boolean) => void;
  selectPage: (pageId: string | null) => void;
  setSpreadDrawerOpen: (isOpen: boolean) => void;
  toggleSpreadDrawer: () => void;
  // Adaptive Smart Layout State
  spreadLayoutIndices: Record<string, number>;
  cycleSpreadLayout: (spreadId: string, direction: 'next' | 'prev', project: Project) => void;
  shuffleSpreadPhotos: (spreadId: string) => void;
  applyAdaptiveLayoutByIndex: (spreadId: string, index: number, project: Project) => void;
  autoFlowPhotosToSpreads: (
    photos: Photo[],
    project: Project,
    options?: { replaceCurrentSpread?: boolean }
  ) => Promise<void>;
  promoteToFullBleedSpread: (spreadId: string, frameId: string, project: Project) => void;
  setHeroPhotoOnSpread: (spreadId: string, frameId: string, project: Project) => void;

  // Visual Studio Layers Management Actions (Phase 21)
  reorderLayers: (spreadId: string, fromIndicesOrIds: string[] | number[], targetIndex: number) => void;
  reorderSpreadElements: (spreadId: string, orderedElementIds: string[]) => void;
  toggleElementVisibility: (spreadId: string, elementId: string, forceState?: boolean) => void;
  toggleElementLock: (spreadId: string, elementId: string, forceState?: boolean) => void;
  renameElement: (spreadId: string, elementId: string, name: string) => void;
  setAllElementsLock: (spreadId: string, locked: boolean) => void;
  setAllElementsVisibility: (spreadId: string, visible: boolean) => void;
  deleteSingleElement: (spreadId: string, elementId: string) => void;

  // AI Face & Studio Framing (Phase 23)
  applyStudioFramingPreset: (frameId: string, preset: StudioFramingPreset, customConfig?: Partial<FramingConfig>) => void;

  // Visual Effects & Flip (Phase 2)
  flipElements: (spreadId: string, elementIds: string[], axis: 'horizontal' | 'vertical') => void;
  updateElementVisualEffects: (
    spreadId: string,
    elementIds: string[],
    effects: Partial<PhotoFrameElement>
  ) => void;
}

export function hydrateElement(el: any): AlbumElement {
  if (el.type === 'text') {
    const { text, style, textRuns, styledRanges } = deserializeTextPayload(
      el.textPayload ?? serializeTextPayload(el),
      el.fileName || el.text
    );
    return {
      id: el.id,
      type: 'text',
      text,
      x: Number.isFinite(el.x) ? el.x : 0,
      y: Number.isFinite(el.y) ? el.y : 0,
      width: Number.isFinite(el.width) ? el.width : 120,
      height: Number.isFinite(el.height) ? el.height : 35,
      rotation: Number.isFinite(el.rotation) ? el.rotation : 0,
      opacity: Number.isFinite(el.opacity) ? Math.max(0, Math.min(1, el.opacity)) : 1,
      zIndex: Number.isFinite(el.zIndex) ? el.zIndex : 10,
      locked: Boolean(el.locked),
      name: el.name,
      hidden: Boolean(el.hidden),
      groupId: el.groupId || null,
      groupRotation: el.groupRotation,
      flipHorizontal: Boolean(el.flipHorizontal),
      flipVertical: Boolean(el.flipVertical),
      excludeFromAdaptiveLayout: Boolean(el.excludeFromAdaptiveLayout),
      shadowEnabled: Boolean(el.shadowEnabled),
      shadowBlur: el.shadowBlur,
      shadowOffsetX: el.shadowOffsetX,
      shadowOffsetY: el.shadowOffsetY,
      shadowOpacity: el.shadowOpacity,
      shadowColor: el.shadowColor,
      style,
      textRuns,
      styledRanges,
    };
  }

  if (el.type === 'graphic') {
    return {
      ...el,
      type: 'graphic',
      id: el.id,
      x: Number.isFinite(el.x) ? el.x : 0,
      y: Number.isFinite(el.y) ? el.y : 0,
      width: Number.isFinite(el.width) ? el.width : 100,
      height: Number.isFinite(el.height) ? el.height : 100,
      rotation: Number.isFinite(el.rotation) ? el.rotation : 0,
      opacity: Number.isFinite(el.opacity) ? Math.max(0, Math.min(1, el.opacity)) : 1,
      zIndex: Number.isFinite(el.zIndex) ? el.zIndex : 1,
      locked: Boolean(el.locked),
      name: el.name,
      hidden: Boolean(el.hidden),
      groupId: el.groupId || null,
      groupRotation: el.groupRotation,
      excludeFromAdaptiveLayout: el.excludeFromAdaptiveLayout !== undefined ? Boolean(el.excludeFromAdaptiveLayout) : true,
      flipHorizontal: Boolean(el.flipHorizontal),
      flipVertical: Boolean(el.flipVertical),
      blurRadius: Number.isFinite(el.blurRadius) ? el.blurRadius : 0,
      grayscaleAmount: Number.isFinite(el.grayscaleAmount) ? el.grayscaleAmount : 0,
      noiseAmount: Number.isFinite(el.noiseAmount) ? el.noiseAmount : 0,
      shadowEnabled: Boolean(el.shadowEnabled),
      shadowBlur: Number.isFinite(el.shadowBlur) ? el.shadowBlur : 10,
      shadowOffsetX: Number.isFinite(el.shadowOffsetX) ? el.shadowOffsetX : 0,
      shadowOffsetY: Number.isFinite(el.shadowOffsetY) ? el.shadowOffsetY : 5,
      shadowOpacity: Number.isFinite(el.shadowOpacity) ? el.shadowOpacity : 35,
      shadowColor: el.shadowColor || '#000000',
      frameAssetId: el.frameAssetId || el.graphicId || null,
      frameAssetUrl: el.frameAssetUrl || el.fileUrl || null,
      frameAssetLocalPath: el.frameAssetLocalPath || el.filePath || null,
      frameAssetTitle: el.frameAssetTitle || el.fileName || null,
      frameAssetSlot: el.frameAssetSlot || null,
      frameAssetIsPro: false,
      graphicId: el.graphicId || el.frameAssetId || null,
      filePath: el.filePath || el.frameAssetLocalPath || '',
      fileName: el.fileName || el.frameAssetTitle || '',
      fileUrl: el.fileUrl || el.frameAssetUrl || null,
      previewPath: el.previewPath || null,
      thumbnailPath: el.thumbnailPath || null,
    };
  }

  const [tl, tr, br, bl] = getCornerRadii(el);
  return {
    ...el,
    type: 'photo',
    locked: Boolean(el.locked),
    name: el.name,
    hidden: Boolean(el.hidden),
    flipHorizontal: Boolean(el.flipHorizontal),
    flipVertical: Boolean(el.flipVertical),
    blurRadius: Number.isFinite(el.blurRadius) ? el.blurRadius : 0,
    grayscaleAmount: Number.isFinite(el.grayscaleAmount) ? el.grayscaleAmount : 0,
    noiseAmount: Number.isFinite(el.noiseAmount) ? el.noiseAmount : 0,
    shadowEnabled: Boolean(el.shadowEnabled),
    shadowBlur: Number.isFinite(el.shadowBlur) ? el.shadowBlur : 10,
    shadowOffsetX: Number.isFinite(el.shadowOffsetX) ? el.shadowOffsetX : 0,
    shadowOffsetY: Number.isFinite(el.shadowOffsetY) ? el.shadowOffsetY : 5,
    shadowOpacity: Number.isFinite(el.shadowOpacity) ? el.shadowOpacity : 35,
    shadowColor: el.shadowColor || '#000000',
    excludeFromAdaptiveLayout: Boolean(el.excludeFromAdaptiveLayout),
    frameAssetId: el.frameAssetId || null,
    frameAssetUrl: el.frameAssetUrl || null,
    frameAssetLocalPath: el.frameAssetLocalPath || null,
    frameAssetTitle: el.frameAssetTitle || null,
    frameAssetSlot: el.frameAssetSlot || null,
    frameAssetIsPro: false,
    cornerRadiusTl: tl,
    cornerRadiusTr: tr,
    cornerRadiusBr: br,
    cornerRadiusBl: bl,
    cornerRadius: (tl === tr && tr === br && br === bl) ? tl : [tl, tr, br, bl],
  };
}

export function sanitizeElement(el: AlbumElement, layoutContext?: { unit: Unit; dpi: number }): any {
  if (el.type === 'text') {
    const textEl = el as TextNodeElement;
    const textStr = typeof textEl.text === 'string' ? textEl.text : ((textEl as any).fileName || '');
    const styleObj = { ...DEFAULT_TEXT_STYLE, ...(textEl.style || {}) };
    return {
      ...textEl,
      id: textEl.id,
      type: 'text',
      text: textStr,
      style: styleObj,
      textRuns: textEl.textRuns || [],
      photoId: null,
      groupId: textEl.groupId || null,
      groupRotation: textEl.groupRotation || 0,
      filePath: '',
      fileName: textStr,
      previewPath: '',
      thumbnailPath: '',
      x: Number.isFinite(textEl.x) ? textEl.x : 0,
      y: Number.isFinite(textEl.y) ? textEl.y : 0,
      width: Number.isFinite(textEl.width) ? textEl.width : 120,
      height: Number.isFinite(textEl.height) ? textEl.height : 35,
      rotation: Number.isFinite(textEl.rotation) ? textEl.rotation : 0,
      zIndex: Number.isFinite(textEl.zIndex) ? textEl.zIndex : 10,
      photoAspect: 1.0,
      originalWidth: textEl.width,
      originalHeight: textEl.height,
      cropX: 0,
      cropY: 0,
      cropScale: 1.0,
      cropRotation: 0,
      borderEnabled: false,
      borderWidth: 0,
      cornerRadius: 0,
      cornerRadiusTl: 0,
      cornerRadiusTr: 0,
      cornerRadiusBr: 0,
      cornerRadiusBl: 0,
      borderColor: '#FFFFFF',
      opacity: Number.isFinite(textEl.opacity) ? Math.max(0, Math.min(1, textEl.opacity!)) : 1.0,
      locked: Boolean(textEl.locked),
      flipHorizontal: Boolean(textEl.flipHorizontal),
      flipVertical: Boolean(textEl.flipVertical),
      excludeFromAdaptiveLayout: Boolean(textEl.excludeFromAdaptiveLayout),
      shadowEnabled: Boolean(textEl.shadowEnabled),
      shadowBlur: Number.isFinite(textEl.shadowBlur) ? textEl.shadowBlur : 10,
      shadowOffsetX: Number.isFinite(textEl.shadowOffsetX) ? textEl.shadowOffsetX : 0,
      shadowOffsetY: Number.isFinite(textEl.shadowOffsetY) ? textEl.shadowOffsetY : 5,
      shadowOpacity: Number.isFinite(textEl.shadowOpacity) ? textEl.shadowOpacity : 35,
      shadowColor: textEl.shadowColor || '#000000',
      textPayload: serializeTextPayload({
        ...textEl,
        text: textStr,
        style: styleObj,
      }, layoutContext),
    };
  }

  if (el.type === 'graphic') {
    const gEl = el as GraphicElement;
    return {
      ...gEl,
      id: gEl.id,
      type: 'graphic',
      photoId: null,
      groupId: gEl.groupId || null,
      groupRotation: gEl.groupRotation || 0,
      graphicId: gEl.graphicId || gEl.frameAssetId || null,
      fileUrl: gEl.fileUrl || gEl.frameAssetUrl || null,
      filePath: gEl.filePath || gEl.frameAssetLocalPath || '',
      fileName: gEl.fileName || gEl.frameAssetTitle || '',
      previewPath: gEl.previewPath || '',
      thumbnailPath: gEl.thumbnailPath || '',
      x: Number.isFinite(gEl.x) ? gEl.x : 0,
      y: Number.isFinite(gEl.y) ? gEl.y : 0,
      width: Number.isFinite(gEl.width) ? gEl.width : 100,
      height: Number.isFinite(gEl.height) ? gEl.height : 100,
      rotation: Number.isFinite(gEl.rotation) ? gEl.rotation : 0,
      zIndex: Number.isFinite(gEl.zIndex) ? gEl.zIndex : 1,
      photoAspect: 1.0,
      originalWidth: gEl.width,
      originalHeight: gEl.height,
      cropX: 0,
      cropY: 0,
      cropScale: 1.0,
      cropRotation: 0,
      borderEnabled: false,
      borderWidth: 0,
      borderColor: '#FFFFFF',
      cornerRadius: 0,
      cornerRadiusTl: 0,
      cornerRadiusTr: 0,
      cornerRadiusBr: 0,
      cornerRadiusBl: 0,
      opacity: Number.isFinite(gEl.opacity) ? Math.max(0, Math.min(1, gEl.opacity)) : 1.0,
      locked: Boolean(gEl.locked),
      flipHorizontal: Boolean(gEl.flipHorizontal),
      flipVertical: Boolean(gEl.flipVertical),
      blurRadius: Number.isFinite(gEl.blurRadius) ? gEl.blurRadius : 0,
      grayscaleAmount: Number.isFinite(gEl.grayscaleAmount) ? gEl.grayscaleAmount : 0,
      noiseAmount: Number.isFinite(gEl.noiseAmount) ? gEl.noiseAmount : 0,
      excludeFromAdaptiveLayout: true,
      shadowEnabled: Boolean(gEl.shadowEnabled),
      shadowBlur: Number.isFinite(gEl.shadowBlur) ? gEl.shadowBlur : 10,
      shadowOffsetX: Number.isFinite(gEl.shadowOffsetX) ? gEl.shadowOffsetX : 0,
      shadowOffsetY: Number.isFinite(gEl.shadowOffsetY) ? gEl.shadowOffsetY : 5,
      shadowOpacity: Number.isFinite(gEl.shadowOpacity) ? gEl.shadowOpacity : 35,
      shadowColor: gEl.shadowColor || '#000000',
      frameAssetId: gEl.frameAssetId || gEl.graphicId || null,
      frameAssetUrl: gEl.frameAssetUrl || gEl.fileUrl || null,
      frameAssetLocalPath: gEl.frameAssetLocalPath || gEl.filePath || null,
      frameAssetTitle: gEl.frameAssetTitle || gEl.fileName || null,
      frameAssetSlot: null,
      frameAssetIsPro: false,
      textPayload: null,
    };
  }

  const pEl = el as PhotoFrameElement;
  const [rTl, rTr, rBr, rBl] = getCornerRadii(pEl);
  return {
    ...pEl,
    type: 'photo',
    photoId: pEl.photoId || null,
    groupId: pEl.groupId || null,
    groupRotation: pEl.groupRotation || 0,
    filePath: pEl.filePath || '',
    fileName: pEl.fileName || '',
    previewPath: pEl.previewPath || '',
    thumbnailPath: pEl.thumbnailPath || '',
    x: Number.isFinite(pEl.x) ? pEl.x : 0,
    y: Number.isFinite(pEl.y) ? pEl.y : 0,
    width: Number.isFinite(pEl.width) ? pEl.width : 100,
    height: Number.isFinite(pEl.height) ? pEl.height : 100,
    rotation: Number.isFinite(pEl.rotation) ? pEl.rotation : 0,
    zIndex: Number.isFinite(pEl.zIndex) ? pEl.zIndex : 1,
    photoAspect: typeof pEl.photoAspect === 'number' && pEl.photoAspect > 0 ? pEl.photoAspect : 1.5,
    originalWidth: pEl.originalWidth || pEl.width,
    originalHeight: pEl.originalHeight || pEl.height,
    cropX: Number.isFinite(pEl.cropX) ? pEl.cropX : 0,
    cropY: Number.isFinite(pEl.cropY) ? pEl.cropY : 0,
    cropScale: Number.isFinite(pEl.cropScale) && pEl.cropScale > 0 ? pEl.cropScale : 1.0,
    cropRotation: Number.isFinite(pEl.cropRotation) ? pEl.cropRotation : 0,
    borderEnabled: Boolean(pEl.borderEnabled),
    borderWidth: Number.isFinite(pEl.borderWidth) ? pEl.borderWidth : 0,
    borderColor: pEl.borderColor || '#FFFFFF',
    cornerRadiusTl: rTl,
    cornerRadiusTr: rTr,
    cornerRadiusBr: rBr,
    cornerRadiusBl: rBl,
    cornerRadius: (rTl === rTr && rTr === rBr && rBr === rBl) ? rTl : [rTl, rTr, rBr, rBl],
    opacity: Number.isFinite(pEl.opacity) ? Math.max(0, Math.min(1, pEl.opacity)) : 1.0,
    locked: Boolean(pEl.locked),
    flipHorizontal: Boolean(pEl.flipHorizontal),
    flipVertical: Boolean(pEl.flipVertical),
    blurRadius: Number.isFinite(pEl.blurRadius) ? pEl.blurRadius : 0,
    grayscaleAmount: Number.isFinite(pEl.grayscaleAmount) ? pEl.grayscaleAmount : 0,
    noiseAmount: Number.isFinite(pEl.noiseAmount) ? pEl.noiseAmount : 0,
    excludeFromAdaptiveLayout: Boolean(pEl.excludeFromAdaptiveLayout),
    shadowEnabled: Boolean(pEl.shadowEnabled),
    shadowBlur: Number.isFinite(pEl.shadowBlur) ? pEl.shadowBlur : 10,
    shadowOffsetX: Number.isFinite(pEl.shadowOffsetX) ? pEl.shadowOffsetX : 0,
    shadowOffsetY: Number.isFinite(pEl.shadowOffsetY) ? pEl.shadowOffsetY : 5,
    shadowOpacity: Number.isFinite(pEl.shadowOpacity) ? pEl.shadowOpacity : 35,
    shadowColor: pEl.shadowColor || '#000000',
    frameAssetId: pEl.frameAssetId || null,
    frameAssetUrl: pEl.frameAssetUrl || null,
    frameAssetLocalPath: pEl.frameAssetLocalPath || null,
    frameAssetTitle: pEl.frameAssetTitle || null,
    frameAssetSlot: pEl.frameAssetSlot || null,
    frameAssetIsPro: false,
    textPayload: null,
  };
}

export const useAlbumStore = create<AlbumState>((set, get) => ({
  currentAlbum: null,
  activeSpreadId: null,
  activeSpreadIndex: 0,
  selectedSpreadIds: [],
  selectedPageId: null,

  saveStatus: 'saved',
  lastSavedAt: null,

  showGutterGuide: true,
  showBleedGuide: true,
  showSafeAreaGuide: true,
  showCenterGuide: false,
  showThirdsGuide: false,
  isSpreadDrawerOpen: false,
  spreadLayoutIndices: {},

  setSpreadDrawerOpen: (isOpen: boolean) => set({ isSpreadDrawerOpen: isOpen }),
  toggleSpreadDrawer: () => set((s) => ({ isSpreadDrawerOpen: !s.isSpreadDrawerOpen })),
  setSaveStatus: (status) => set({ saveStatus: status }),

  syncPhotoAssets: async (photos, options = {}) => {
    const { currentAlbum, saveAlbumToDb } = get();
    if (!currentAlbum || photos.length === 0) return false;

    const { album: syncedAlbum, changed } = syncAlbumPhotoAssets(currentAlbum, photos);
    if (!changed) return false;

    // Let the queued checkpoint capture the real saved/unsaved state before it
    // sets 'saving'. Pre-setting it here makes a cache refresh look like an edit.
    set({ currentAlbum: syncedAlbum });

    if (options.persist) {
      return saveAlbumToDb();
    }

    return true;
  },

  initializeAlbum: (project: Project) => {
    const album = createInitialAlbum(project);
    useHistoryStore.getState().clearHistory();
    set({
      currentAlbum: album,
      activeSpreadId: album.spreads[0]?.id || '',
      activeSpreadIndex: 0, // Default to Spread 1 (Pages 1-2)
      selectedSpreadIds: album.spreads[0]?.id ? [album.spreads[0].id] : [],
      selectedPageId: null,
      showSafeAreaGuide: project.marginEnabled ?? true,
      saveStatus: 'saved',
      lastSavedAt: new Date().toLocaleTimeString(),
    });
  },

  loadAlbumFromDb: async (projectId: string) => {
    try {
      const payload = await invoke<any>('load_album_structure', { projectId });
      if (payload?.coverSpread && Array.isArray(payload.spreads)) {
        const hydratedAlbum: Album = {
          ...payload,
          coverSpread: {
            ...payload.coverSpread,
            spacingValue:
              payload.coverSpread?.spacingValue !== undefined && payload.coverSpread?.spacingValue !== null
                ? Number(payload.coverSpread.spacingValue)
                : undefined,
            spacingUnit: payload.coverSpread?.spacingUnit || undefined,
            elements: (payload.coverSpread?.elements || []).map(hydrateElement),
          },
          spreads: (payload.spreads || []).map((s: any) => ({
            ...s,
            spacingValue:
              s?.spacingValue !== undefined && s?.spacingValue !== null
                ? Number(s.spacingValue)
                : undefined,
            spacingUnit: s?.spacingUnit || undefined,
            elements: (s.elements || []).map(hydrateElement),
          })),
        };

        useHistoryStore.getState().clearHistory();
        const initialSpreadId = hydratedAlbum.spreads[0]?.id || hydratedAlbum.coverSpread?.id || '';
        set({
          currentAlbum: hydratedAlbum,
          activeSpreadId: initialSpreadId,
          activeSpreadIndex: 0,
          selectedSpreadIds: initialSpreadId ? [initialSpreadId] : [],
          selectedPageId: null,
          saveStatus: 'saved',
          lastSavedAt: new Date().toLocaleTimeString(),
        });
        try {
          const { usePhotoStore } = await import('./photoStore');
          await get().syncPhotoAssets(usePhotoStore.getState().photos, { persist: true });
        } catch (err) {
          console.warn('[AFSN] sync loaded album photo assets error:', err);
        }
        return true;
      }
    } catch (err) {
      console.warn('Could not load album structure from SQLite DB, checking snapshot:', err);
    }

    // Fallback: Check local storage snapshot
    try {
      const raw = localStorage.getItem(`afsn_snapshot_${projectId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.album?.coverSpread && Array.isArray(parsed.album.spreads)) {
          const hydratedAlbum: Album = {
            ...parsed.album,
            coverSpread: {
              ...parsed.album.coverSpread,
              spacingValue:
                parsed.album.coverSpread?.spacingValue !== undefined && parsed.album.coverSpread?.spacingValue !== null
                  ? Number(parsed.album.coverSpread.spacingValue)
                  : undefined,
              spacingUnit: parsed.album.coverSpread?.spacingUnit || undefined,
              elements: (parsed.album.coverSpread?.elements || []).map(hydrateElement),
            },
            spreads: (parsed.album.spreads || []).map((s: any) => ({
              ...s,
              spacingValue:
                s?.spacingValue !== undefined && s?.spacingValue !== null
                  ? Number(s.spacingValue)
                  : undefined,
              spacingUnit: s?.spacingUnit || undefined,
              elements: (s.elements || []).map(hydrateElement),
            })),
          };

          useHistoryStore.getState().clearHistory();
          const initialSpreadId = hydratedAlbum.spreads[0]?.id || hydratedAlbum.coverSpread?.id || '';
          set({
            currentAlbum: hydratedAlbum,
            activeSpreadId: initialSpreadId,
            activeSpreadIndex: 0,
            selectedSpreadIds: initialSpreadId ? [initialSpreadId] : [],
            selectedPageId: null,
            saveStatus: 'saved',
            lastSavedAt: new Date().toLocaleTimeString(),
          });
          try {
            const { usePhotoStore } = await import('./photoStore');
            await get().syncPhotoAssets(usePhotoStore.getState().photos, { persist: true });
          } catch (err) {
            console.warn('[AFSN] sync loaded album photo assets error:', err);
          }
          // Resync to SQLite
          try {
            await invoke('save_album_structure', { album: parsed.album });
          } catch {}
          return true;
        }
      }
    } catch {}

    return false;
  },

  saveAlbumToDb: () => persistInOrder(async () => {
    const { currentAlbum, saveStatus: previousStatus } = get();
    if (!currentAlbum) return false;
    const project = useProjectStore.getState().currentProject;
    const layoutContext = {
      unit: project?.canvasUnit || currentAlbum.spreads[0]?.leftPage?.unit || 'mm',
      dpi: project?.canvasDpi || 300,
    };

    set({ saveStatus: 'saving' });

    const sanitizedAlbum: any = {
      ...currentAlbum,
      coverSpread: {
        ...currentAlbum.coverSpread,
        spacingValue:
          currentAlbum.coverSpread?.spacingValue !== undefined && currentAlbum.coverSpread?.spacingValue !== null
            ? Number(currentAlbum.coverSpread.spacingValue)
            : null,
        spacingUnit: currentAlbum.coverSpread?.spacingUnit || null,
        elements: (currentAlbum.coverSpread.elements || []).map((el) => sanitizeElement(el, layoutContext)),
      },
      spreads: (currentAlbum.spreads || []).map((spread) => ({
        ...spread,
        spacingValue:
          spread.spacingValue !== undefined && spread.spacingValue !== null
            ? Number(spread.spacingValue)
            : null,
        spacingUnit: spread.spacingUnit || null,
        elements: (spread.elements || []).map((el) => sanitizeElement(el, layoutContext)),
      })),
    };

    try {
      await invoke('save_album_structure', { album: sanitizedAlbum });
      // Update local storage crash recovery snapshot
      try {
        if (isAlbumDesignEqual(get().currentAlbum, currentAlbum)) localStorage.setItem(`afsn_snapshot_${sanitizedAlbum.projectId}`, JSON.stringify({
          projectId: sanitizedAlbum.projectId,
          savedAt: new Date().toISOString(),
          album: sanitizedAlbum,
        }));
      } catch {}

      // This is a recovery checkpoint, not confirmation that the .afsn file saved.
      // Never replace edits made while the native write was in flight.
      if (isAlbumDesignEqual(get().currentAlbum, currentAlbum)) {
        if (get().saveStatus !== 'saved') {
          set({ saveStatus: previousStatus === 'saved' ? 'saved' : 'unsaved' });
        }
      }
      return true;
    } catch (err) {
      console.error('Failed to save album to SQLite DB:', err);
      // Fallback: save to localStorage snapshot so data is never lost
      try {
        if (isAlbumDesignEqual(get().currentAlbum, currentAlbum)) localStorage.setItem(`afsn_snapshot_${sanitizedAlbum.projectId}`, JSON.stringify({
          projectId: sanitizedAlbum.projectId,
          savedAt: new Date().toISOString(),
          album: sanitizedAlbum,
        }));
      } catch {}
      if (isAlbumDesignEqual(get().currentAlbum, currentAlbum)) set({ saveStatus: 'unsaved' });
      return false;
    }
  }),

  undo: () => {
    flushSpacingHistory();
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    const previousAlbum = useHistoryStore.getState().undo(currentAlbum);
    if (previousAlbum) {
      const all = getAllAlbumSpreads(previousAlbum);
      const activeId = get().activeSpreadId;
      const validActiveId = all.some((s) => s.id === activeId)
        ? activeId
        : (all[0]?.id || previousAlbum.coverSpread?.id || '');
      const validIndex = all.findIndex((s) => s.id === validActiveId);

      set({
        currentAlbum: previousAlbum,
        activeSpreadId: validActiveId,
        activeSpreadIndex: Math.max(0, validIndex),
        saveStatus: 'unsaved',
      });

      // Sync editorStore selection and group rotation with the restored state
      useEditorStore.getState().syncSelectionWithSpread(validActiveId || '', previousAlbum);
    }
  },

  redo: () => {
    flushSpacingHistory();
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    const nextAlbum = useHistoryStore.getState().redo(currentAlbum);
    if (nextAlbum) {
      const all = getAllAlbumSpreads(nextAlbum);
      const activeId = get().activeSpreadId;
      const validActiveId = all.some((s) => s.id === activeId)
        ? activeId
        : (all[0]?.id || nextAlbum.coverSpread?.id || '');
      const validIndex = all.findIndex((s) => s.id === validActiveId);

      set({
        currentAlbum: nextAlbum,
        activeSpreadId: validActiveId,
        activeSpreadIndex: Math.max(0, validIndex),
        saveStatus: 'unsaved',
      });

      // Sync editorStore selection and group rotation with the restored state
      useEditorStore.getState().syncSelectionWithSpread(validActiveId || '', nextAlbum);
    }
  },

  setActiveSpread: (spreadId: string) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    const all = getAllAlbumSpreads(currentAlbum);
    const foundIndex = all.findIndex((s) => s.id === spreadId);
    if (foundIndex !== -1) {
      set({
        activeSpreadId: spreadId,
        activeSpreadIndex: foundIndex,
        selectedSpreadIds: [spreadId],
        selectedPageId: null,
      });
    }
  },

  setActiveSpreadByIndex: (index: number) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    const all = getAllAlbumSpreads(currentAlbum);
    if (index >= 0 && index < all.length) {
      const targetSpread = all[index];
      if (targetSpread) {
        set({
          activeSpreadId: targetSpread.id,
          activeSpreadIndex: index,
          selectedSpreadIds: [targetSpread.id],
          selectedPageId: null,
        });
      }
    }
  },

  nextSpread: () => {
    const { activeSpreadIndex, setActiveSpreadByIndex } = get();
    setActiveSpreadByIndex(activeSpreadIndex + 1);
  },

  prevSpread: () => {
    const { activeSpreadIndex, setActiveSpreadByIndex } = get();
    if (activeSpreadIndex > 0) {
      setActiveSpreadByIndex(activeSpreadIndex - 1);
    }
  },

  addSpread: (project: Project, afterIndex?: number) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const newSpreadNumber = currentAlbum.spreads.length + 1;
    const newSpread = createInteriorSpread(currentAlbum, project, newSpreadNumber);

    let updatedSpreads: Spread[];
    if (afterIndex !== undefined && afterIndex >= 0 && afterIndex <= currentAlbum.spreads.length) {
      updatedSpreads = [
        ...currentAlbum.spreads.slice(0, afterIndex),
        newSpread,
        ...currentAlbum.spreads.slice(afterIndex),
      ];
    } else {
      updatedSpreads = [...currentAlbum.spreads, newSpread];
    }

    const updatedAlbum = recalculateAlbumPageNumbers({
      ...currentAlbum,
      spreads: updatedSpreads,
    });

    const newIndex = updatedAlbum.spreads.findIndex((s) => s.id === newSpread.id);

    set({
      currentAlbum: updatedAlbum,
      activeSpreadId: newSpread.id,
      activeSpreadIndex: Math.max(0, newIndex),
      selectedSpreadIds: [newSpread.id],
      selectedPageId: null,
      saveStatus: 'unsaved',
    });
  },

  deleteSpread: (spreadId: string) => {
    const { currentAlbum, activeSpreadId } = get();
    if (!currentAlbum) return;

    // If only 1 spread left, deleting it resets the album to a new blank spread
    if (currentAlbum.spreads.length <= 1) {
      const { currentProject } = useProjectStore.getState();
      if (!currentProject) return;

      useHistoryStore.getState().pushState(currentAlbum);

      const newSpread = createInteriorSpread(currentAlbum, currentProject, 1);
      const updatedAlbum = recalculateAlbumPageNumbers({
        ...currentAlbum,
        spreads: [newSpread],
      });

      useEditorStore.getState().clearSelection();

      set({
        currentAlbum: updatedAlbum,
        activeSpreadId: newSpread.id,
        activeSpreadIndex: 0,
        selectedSpreadIds: [newSpread.id],
        selectedPageId: null,
        saveStatus: 'unsaved',
      });
      return;
    }

    const oldAll = getAllAlbumSpreads(currentAlbum);
    const deletedIndex = oldAll.findIndex((s) => s.id === spreadId);

    useHistoryStore.getState().pushState(currentAlbum);

    const filtered = currentAlbum.spreads.filter((s) => s.id !== spreadId);
    const updatedAlbum = recalculateAlbumPageNumbers({
      ...currentAlbum,
      spreads: filtered,
    });

    const all = getAllAlbumSpreads(updatedAlbum);
    let nextActiveId = activeSpreadId;
    let nextIndex = 0;

    if (activeSpreadId === spreadId) {
      // If the active spread was deleted:
      // If the deleted spread was the last spread (or at/beyond all.length), select the previous spread
      // Otherwise select the spread that shifted into this position
      const candidateIndex = deletedIndex >= all.length
        ? Math.max(0, all.length - 1)
        : Math.max(0, deletedIndex);
      const targetSpread = all[candidateIndex] || all[all.length - 1] || all[0];
      if (targetSpread) {
        nextActiveId = targetSpread.id;
        nextIndex = all.findIndex((s) => s.id === targetSpread.id);
      }
    } else {
      nextIndex = Math.max(0, all.findIndex((s) => s.id === activeSpreadId));
    }

    set({
      currentAlbum: updatedAlbum,
      activeSpreadId: nextActiveId,
      activeSpreadIndex: Math.max(0, nextIndex),
      selectedSpreadIds: nextActiveId ? [nextActiveId] : [],
      selectedPageId: null,
      saveStatus: 'unsaved',
    });
  },

  deleteSpreads: (spreadIds: string[]) => {
    const { currentAlbum, activeSpreadId } = get();
    if (!currentAlbum || spreadIds.length === 0) return;

    const toDeleteSet = new Set(spreadIds);
    const remainingSpreads = currentAlbum.spreads.filter((s) => !toDeleteSet.has(s.id));

    useHistoryStore.getState().pushState(currentAlbum);

    // If all spreads in album were deleted, reset to a new blank spread
    if (remainingSpreads.length === 0) {
      const { currentProject } = useProjectStore.getState();
      if (!currentProject) return;

      const newSpread = createInteriorSpread(currentAlbum, currentProject, 1);
      const updatedAlbum = recalculateAlbumPageNumbers({
        ...currentAlbum,
        spreads: [newSpread],
      });

      useEditorStore.getState().clearSelection();

      set({
        currentAlbum: updatedAlbum,
        activeSpreadId: newSpread.id,
        activeSpreadIndex: 0,
        selectedSpreadIds: [newSpread.id],
        selectedPageId: null,
        saveStatus: 'unsaved',
      });
      return;
    }

    const oldAll = getAllAlbumSpreads(currentAlbum);
    const activeOldIndex = activeSpreadId ? oldAll.findIndex((s) => s.id === activeSpreadId) : -1;

    const updatedAlbum = recalculateAlbumPageNumbers({
      ...currentAlbum,
      spreads: remainingSpreads,
    });

    const all = getAllAlbumSpreads(updatedAlbum);
    let nextActiveId = activeSpreadId;
    let nextIndex = 0;

    if (activeSpreadId && toDeleteSet.has(activeSpreadId)) {
      // Fallback to nearest spread: if at/beyond the end, select previous spread
      const candidateIndex = activeOldIndex >= all.length
        ? Math.max(0, all.length - 1)
        : Math.max(0, activeOldIndex);
      const targetSpread = all[candidateIndex] || all[all.length - 1] || all[0];
      if (targetSpread) {
        nextActiveId = targetSpread.id;
        nextIndex = all.findIndex((s) => s.id === targetSpread.id);
      }
    } else if (activeSpreadId) {
      nextIndex = Math.max(0, all.findIndex((s) => s.id === activeSpreadId));
    }

    set({
      currentAlbum: updatedAlbum,
      activeSpreadId: nextActiveId,
      activeSpreadIndex: Math.max(0, nextIndex),
      selectedSpreadIds: nextActiveId ? [nextActiveId] : [],
      selectedPageId: null,
      saveStatus: 'unsaved',
    });
  },

  setSelectedSpreadIds: (spreadIds: string[]) => set({ selectedSpreadIds: spreadIds }),

  toggleSpreadSelection: (spreadId: string, isMulti: boolean, isRange: boolean) => {
    const { currentAlbum, activeSpreadId, selectedSpreadIds } = get();
    if (!currentAlbum) return;
    const allSpreads = getAllAlbumSpreads(currentAlbum);

    if (isRange) {
      // Shift+Click: Range selection between activeSpreadId and clicked spreadId
      const startIndex = allSpreads.findIndex((s) => s.id === activeSpreadId);
      const endIndex = allSpreads.findIndex((s) => s.id === spreadId);
      if (startIndex !== -1 && endIndex !== -1) {
        const minIdx = Math.min(startIndex, endIndex);
        const maxIdx = Math.max(startIndex, endIndex);
        const rangeIds = allSpreads.slice(minIdx, maxIdx + 1).map((s) => s.id);
        set({
          selectedSpreadIds: rangeIds,
          activeSpreadId: spreadId,
          activeSpreadIndex: endIndex,
        });
        return;
      }
    }

    if (isMulti) {
      // Ctrl+Click / Cmd+Click: Toggle clicked spread
      if (selectedSpreadIds.includes(spreadId)) {
        if (selectedSpreadIds.length > 1) {
          const newSelected = selectedSpreadIds.filter((id) => id !== spreadId);
          const nextActiveId = activeSpreadId === spreadId ? newSelected[0] : activeSpreadId;
          const nextIndex = allSpreads.findIndex((s) => s.id === nextActiveId);
          set({
            selectedSpreadIds: newSelected,
            activeSpreadId: nextActiveId,
            activeSpreadIndex: Math.max(0, nextIndex),
          });
        }
      } else {
        const newSelected = [...selectedSpreadIds, spreadId];
        const nextIndex = allSpreads.findIndex((s) => s.id === spreadId);
        set({
          selectedSpreadIds: newSelected,
          activeSpreadId: spreadId,
          activeSpreadIndex: Math.max(0, nextIndex),
        });
      }
      return;
    }

    // Normal Click: Single selection
    const index = allSpreads.findIndex((s) => s.id === spreadId);
    set({
      selectedSpreadIds: [spreadId],
      activeSpreadId: spreadId,
      activeSpreadIndex: Math.max(0, index),
    });
  },

  selectAllSpreads: () => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;
    const allSpreads = getAllAlbumSpreads(currentAlbum);
    set({
      selectedSpreadIds: allSpreads.map((s) => s.id),
    });
  },

  clearSpreadSelection: () => {
    const { activeSpreadId } = get();
    set({
      selectedSpreadIds: activeSpreadId ? [activeSpreadId] : [],
    });
  },

  duplicateSpread: (spreadId: string, project: Project) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const result = duplicateAlbumSpread(currentAlbum, project, spreadId);
    if (!result) return;

    set({
      currentAlbum: result.updatedAlbum,
      activeSpreadId: result.newSpreadId,
      activeSpreadIndex: result.newSpreadIndex,
      selectedSpreadIds: [result.newSpreadId],
      selectedPageId: null,
      saveStatus: 'unsaved',
    });
  },

  moveSpread: (spreadId: string, direction: 'left' | 'right') => {
    const { currentAlbum, activeSpreadId } = get();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const result = moveAlbumSpread(currentAlbum, spreadId, direction);
    if (!result) return;

    const nextActiveId = activeSpreadId === spreadId ? spreadId : (result.updatedAlbum.spreads[result.newActiveIndex]?.id || activeSpreadId);
    const nextActiveIndex = result.updatedAlbum.spreads.findIndex((s) => s.id === nextActiveId);

    set({
      currentAlbum: result.updatedAlbum,
      activeSpreadId: nextActiveId,
      activeSpreadIndex: Math.max(0, nextActiveIndex),
      saveStatus: 'unsaved',
    });
  },

  reorderSpread: (fromIndex: number, toIndex: number) => {
    const { currentAlbum, activeSpreadId } = get();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const updatedAlbum = reorderAlbumSpreads(currentAlbum, fromIndex, toIndex);
    const nextActiveIndex = updatedAlbum.spreads.findIndex((s) => s.id === activeSpreadId);

    set({
      currentAlbum: updatedAlbum,
      activeSpreadIndex: Math.max(0, nextActiveIndex),
      saveStatus: 'unsaved',
    });
  },

  updateBleed: (bleed: number) => {
    const { currentAlbum, activeSpreadId } = get();
    if (!currentAlbum || !activeSpreadId) return;

    useHistoryStore.getState().pushState(currentAlbum);

    if (currentAlbum.coverSpread.id === activeSpreadId) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: {
            ...currentAlbum.coverSpread,
            bleed,
            leftPage: currentAlbum.coverSpread.leftPage ? { ...currentAlbum.coverSpread.leftPage, bleed } : currentAlbum.coverSpread.leftPage,
            rightPage: currentAlbum.coverSpread.rightPage ? { ...currentAlbum.coverSpread.rightPage, bleed } : currentAlbum.coverSpread.rightPage,
          },
        },
        saveStatus: 'unsaved',
      });
      return;
    }

    const updatedSpreads = currentAlbum.spreads.map((s) =>
      s.id === activeSpreadId ? {
        ...s,
        bleed,
        leftPage: s.leftPage ? { ...s.leftPage, bleed } : s.leftPage,
        rightPage: s.rightPage ? { ...s.rightPage, bleed } : s.rightPage,
      } : s
    );

    set({
      currentAlbum: {
        ...currentAlbum,
        spreads: updatedSpreads,
      },
      saveStatus: 'unsaved',
    });
  },

  updateSpreadSpacing: (spacingValue: number, spacingUnit?: Unit, project?: Project) => {
    const { currentAlbum, activeSpreadId, spreadLayoutIndices } = get();
    if (!currentAlbum || !activeSpreadId) return;

    // Debounce history push so typing/scrubbing is 60fps instant with zero lag
    if (!initialAlbumBeforeSpacingChange) {
      initialAlbumBeforeSpacingChange = currentAlbum;
    }
    if (spacingHistoryTimer) {
      clearTimeout(spacingHistoryTimer);
    }
    spacingHistoryTimer = setTimeout(() => {
      if (initialAlbumBeforeSpacingChange) {
        useHistoryStore.getState().pushState(initialAlbumBeforeSpacingChange);
        initialAlbumBeforeSpacingChange = null;
      }
      spacingHistoryTimer = null;
    }, 400);

    const isCover = currentAlbum.coverSpread.id === activeSpreadId;
    const targetSpread = isCover
      ? currentAlbum.coverSpread
      : currentAlbum.spreads.find((s) => s.id === activeSpreadId);

    if (!targetSpread) return;

    const proj = project || useProjectStore.getState().currentProject;
    if (!proj) return;

    const unit = spacingUnit || targetSpread.spacingUnit || proj.spacingUnit || 'mm';
    const layoutIndex = spreadLayoutIndices[activeSpreadId];

    const updatedTargetSpread = applyAdaptiveGapToSpread(
      targetSpread,
      spacingValue,
      unit,
      proj,
      layoutIndex
    );

    if (isCover) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: updatedTargetSpread,
        },
        saveStatus: 'unsaved',
      });
      return;
    }

    const updatedSpreads = currentAlbum.spreads.map((s) =>
      s.id === activeSpreadId ? updatedTargetSpread : s
    );

    set({
      currentAlbum: {
        ...currentAlbum,
        spreads: updatedSpreads,
      },
      saveStatus: 'unsaved',
    });
  },

  applySpacingToAllSpreads: (spacingValue: number, spacingUnit?: Unit, project?: Project) => {
    const { currentAlbum, spreadLayoutIndices } = get();
    if (!currentAlbum) return;

    flushSpacingHistory();
    useHistoryStore.getState().pushState(currentAlbum);

    const proj = project || useProjectStore.getState().currentProject;
    if (!proj) return;

    const unit = spacingUnit || currentAlbum.coverSpread.spacingUnit || proj.spacingUnit || 'mm';

    const updatedCover = applyAdaptiveGapToSpread(
      currentAlbum.coverSpread,
      spacingValue,
      unit,
      proj,
      spreadLayoutIndices[currentAlbum.coverSpread.id]
    );

    const updatedSpreads = currentAlbum.spreads.map((s) =>
      applyAdaptiveGapToSpread(s, spacingValue, unit, proj, spreadLayoutIndices[s.id])
    );

    set({
      currentAlbum: {
        ...currentAlbum,
        coverSpread: updatedCover,
        spreads: updatedSpreads,
      },
      saveStatus: 'unsaved',
    });
  },

  updateSafeArea: (
    safeArea: number,
    side: 'all' | 'top' | 'bottom' | 'outside' | 'spine' = 'all',
    project?: Project
  ) => {
    const { currentAlbum, activeSpreadId } = get();
    if (!currentAlbum || !activeSpreadId) return;

    // Debounce history push so typing/scrubbing is 60fps instant with zero lag
    if (!initialAlbumBeforeSafeAreaChange) {
      initialAlbumBeforeSafeAreaChange = currentAlbum;
    }
    if (safeAreaHistoryTimer) {
      clearTimeout(safeAreaHistoryTimer);
    }
    safeAreaHistoryTimer = setTimeout(() => {
      if (initialAlbumBeforeSafeAreaChange) {
        useHistoryStore.getState().pushState(initialAlbumBeforeSafeAreaChange);
        initialAlbumBeforeSafeAreaChange = null;
      }
      safeAreaHistoryTimer = null;
    }, 400);

    const patch: Partial<Spread> = {};
    if (side === 'all') {
      patch.safeArea = safeArea;
      patch.safeAreaTop = safeArea;
      patch.safeAreaBottom = safeArea;
      patch.safeAreaOutside = safeArea;
      patch.safeAreaSpine = safeArea;
    } else if (side === 'top') {
      patch.safeAreaTop = safeArea;
    } else if (side === 'bottom') {
      patch.safeAreaBottom = safeArea;
    } else if (side === 'outside') {
      patch.safeAreaOutside = safeArea;
    } else if (side === 'spine') {
      patch.safeAreaSpine = safeArea;
    }

    const proj = project || useProjectStore.getState().currentProject;
    if (!proj) return;

    const isCover = currentAlbum.coverSpread.id === activeSpreadId;
    const targetSpread = isCover
      ? currentAlbum.coverSpread
      : currentAlbum.spreads.find((s) => s.id === activeSpreadId);

    if (!targetSpread) return;

    const updatedTargetSpread = applyAdaptiveSafeAreaToSpread(targetSpread, patch, proj);

    if (isCover) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: updatedTargetSpread,
        },
        saveStatus: 'unsaved',
      });
      return;
    }

    const updatedSpreads = currentAlbum.spreads.map((s) =>
      s.id === activeSpreadId ? updatedTargetSpread : s
    );

    set({
      currentAlbum: {
        ...currentAlbum,
        spreads: updatedSpreads,
      },
      saveStatus: 'unsaved',
    });
  },

  applySafeAreaToAllSpreads: (
    safeArea: number,
    side: 'all' | 'top' | 'bottom' | 'outside' | 'spine' = 'all',
    project?: Project
  ) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    flushSafeAreaHistory();
    useHistoryStore.getState().pushState(currentAlbum);

    const proj = project || useProjectStore.getState().currentProject;
    if (!proj) return;

    const patch: Partial<Spread> = {};
    if (side === 'all') {
      patch.safeArea = safeArea;
      patch.safeAreaTop = safeArea;
      patch.safeAreaBottom = safeArea;
      patch.safeAreaOutside = safeArea;
      patch.safeAreaSpine = safeArea;
    } else if (side === 'top') {
      patch.safeAreaTop = safeArea;
    } else if (side === 'bottom') {
      patch.safeAreaBottom = safeArea;
    } else if (side === 'outside') {
      patch.safeAreaOutside = safeArea;
    } else if (side === 'spine') {
      patch.safeAreaSpine = safeArea;
    }

    const updatedCover = applyAdaptiveSafeAreaToSpread(currentAlbum.coverSpread, patch, proj);
    const updatedSpreads = currentAlbum.spreads.map((s) =>
      applyAdaptiveSafeAreaToSpread(s, patch, proj)
    );

    set({
      currentAlbum: {
        ...currentAlbum,
        coverSpread: updatedCover,
        spreads: updatedSpreads,
      },
      saveStatus: 'unsaved',
    });
  },

  updateSpreadBackgroundColor: (
    spreadId: string,
    color: string,
    scope: 'spread' | 'left' | 'right' = 'spread'
  ) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const isCover = currentAlbum.coverSpread.id === spreadId;

    if (isCover) {
      const cover = currentAlbum.coverSpread;
      const updatedLeft = cover.leftPage
        ? { ...cover.leftPage, backgroundColor: scope === 'right' ? cover.leftPage.backgroundColor : color }
        : cover.leftPage;
      const updatedRight = cover.rightPage
        ? { ...cover.rightPage, backgroundColor: scope === 'left' ? cover.rightPage.backgroundColor : color }
        : cover.rightPage;
      const updatedCover: Spread = {
        ...cover,
        backgroundColor: scope === 'spread' ? color : cover.backgroundColor,
        leftPage: updatedLeft,
        rightPage: updatedRight,
      };

      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: updatedCover,
        },
        saveStatus: 'unsaved',
      });
      return;
    }

    const updatedSpreads = currentAlbum.spreads.map((s) => {
      if (s.id !== spreadId) return s;

      const updatedLeft = s.leftPage
        ? { ...s.leftPage, backgroundColor: scope === 'right' ? s.leftPage.backgroundColor : color }
        : s.leftPage;
      const updatedRight = s.rightPage
        ? { ...s.rightPage, backgroundColor: scope === 'left' ? s.rightPage.backgroundColor : color }
        : s.rightPage;

      return {
        ...s,
        backgroundColor: scope === 'spread' ? color : s.backgroundColor,
        leftPage: updatedLeft,
        rightPage: updatedRight,
      };
    });

    set({
      currentAlbum: {
        ...currentAlbum,
        spreads: updatedSpreads,
      },
      saveStatus: 'unsaved',
    });
  },

  applyBackgroundColorToAllSpreads: (color: string) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const updatedCover: Spread = {
      ...currentAlbum.coverSpread,
      backgroundColor: color,
      leftPage: currentAlbum.coverSpread.leftPage ? { ...currentAlbum.coverSpread.leftPage, backgroundColor: color } : currentAlbum.coverSpread.leftPage,
      rightPage: currentAlbum.coverSpread.rightPage ? { ...currentAlbum.coverSpread.rightPage, backgroundColor: color } : currentAlbum.coverSpread.rightPage,
    };

    const updatedSpreads = currentAlbum.spreads.map((s) => ({
      ...s,
      backgroundColor: color,
      leftPage: s.leftPage ? { ...s.leftPage, backgroundColor: color } : s.leftPage,
      rightPage: s.rightPage ? { ...s.rightPage, backgroundColor: color } : s.rightPage,
    }));

    set({
      currentAlbum: {
        ...currentAlbum,
        coverSpread: updatedCover,
        spreads: updatedSpreads,
      },
      saveStatus: 'unsaved',
    });
  },

  setSpreadBackgroundImage: (
    spreadId: string,
    image: SpreadBackgroundImage | Partial<SpreadBackgroundImage>,
    scope: 'spread' | 'left' | 'right' = 'spread'
  ) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const target: 'full' | 'left' | 'right' = scope === 'left' ? 'left' : scope === 'right' ? 'right' : 'full';
    const bgImage: SpreadBackgroundImage = {
      photoId: image.photoId || '',
      filePath: image.filePath || '',
      fileName: image.fileName || '',
      previewPath: image.previewPath,
      thumbnailPath: image.thumbnailPath,
      width: image.width,
      height: image.height,
      fit: image.fit || 'fill',
      opacity: image.opacity ?? 100,
      cropX: image.cropX ?? 0,
      cropY: image.cropY ?? 0,
      cropScale: image.cropScale ?? 1,
      cropRotation: image.cropRotation ?? 0,
      flipHorizontal: image.flipHorizontal ?? false,
      flipVertical: image.flipVertical ?? false,
      blurRadius: image.blurRadius ?? 0,
      grayscaleAmount: image.grayscaleAmount ?? 0,
      noiseAmount: image.noiseAmount ?? 0,
      target,
      ...image,
    };

    const isCover = currentAlbum.coverSpread.id === spreadId;
    if (isCover) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: {
            ...currentAlbum.coverSpread,
            backgroundImage: bgImage,
          },
        },
        saveStatus: 'unsaved',
      });
      return;
    }

    set({
      currentAlbum: {
        ...currentAlbum,
        spreads: currentAlbum.spreads.map((s) =>
          s.id === spreadId ? { ...s, backgroundImage: bgImage } : s
        ),
      },
      saveStatus: 'unsaved',
    });
  },

  updateSpreadBackgroundImage: (spreadId: string, patch: Partial<SpreadBackgroundImage>) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    const isCover = currentAlbum.coverSpread.id === spreadId;
    const targetSpread = isCover
      ? currentAlbum.coverSpread
      : currentAlbum.spreads.find((s) => s.id === spreadId);

    if (!targetSpread?.backgroundImage) return;

    const updatedBgImage: SpreadBackgroundImage = {
      ...targetSpread.backgroundImage,
      ...patch,
    };

    if (isCover) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: {
            ...currentAlbum.coverSpread,
            backgroundImage: updatedBgImage,
          },
        },
        saveStatus: 'unsaved',
      });
      return;
    }

    set({
      currentAlbum: {
        ...currentAlbum,
        spreads: currentAlbum.spreads.map((s) =>
          s.id === spreadId ? { ...s, backgroundImage: updatedBgImage } : s
        ),
      },
      saveStatus: 'unsaved',
    });
  },

  clearSpreadBackgroundImage: (spreadId: string) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const isCover = currentAlbum.coverSpread.id === spreadId;
    if (isCover) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: {
            ...currentAlbum.coverSpread,
            backgroundImage: null,
          },
        },
        saveStatus: 'unsaved',
      });
      return;
    }

    set({
      currentAlbum: {
        ...currentAlbum,
        spreads: currentAlbum.spreads.map((s) =>
          s.id === spreadId ? { ...s, backgroundImage: null } : s
        ),
      },
      saveStatus: 'unsaved',
    });
  },

  setSpreadBackgroundColorNoise: (
    spreadId: string,
    noise: number,
    scope: 'spread' | 'left' | 'right' = 'spread'
  ) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    const isCover = currentAlbum.coverSpread.id === spreadId;
    if (isCover) {
      const cover = currentAlbum.coverSpread;
      const updatedCover: Spread = {
        ...cover,
        backgroundColorNoise: scope === 'spread' ? noise : cover.backgroundColorNoise,
        leftPageBackgroundColorNoise: scope === 'left' ? noise : (scope === 'spread' ? null : cover.leftPageBackgroundColorNoise),
        rightPageBackgroundColorNoise: scope === 'right' ? noise : (scope === 'spread' ? null : cover.rightPageBackgroundColorNoise),
      };
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: updatedCover,
        },
        saveStatus: 'unsaved',
      });
      return;
    }

    set({
      currentAlbum: {
        ...currentAlbum,
        spreads: currentAlbum.spreads.map((s) => {
          if (s.id !== spreadId) return s;
          return {
            ...s,
            backgroundColorNoise: scope === 'spread' ? noise : s.backgroundColorNoise,
            leftPageBackgroundColorNoise: scope === 'left' ? noise : (scope === 'spread' ? null : s.leftPageBackgroundColorNoise),
            rightPageBackgroundColorNoise: scope === 'right' ? noise : (scope === 'spread' ? null : s.rightPageBackgroundColorNoise),
          };
        }),
      },
      saveStatus: 'unsaved',
    });
  },

  applyBackgroundNoiseToAllSpreads: (noise: number) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    set({
      currentAlbum: {
        ...currentAlbum,
        coverSpread: {
          ...currentAlbum.coverSpread,
          backgroundColorNoise: noise,
          leftPageBackgroundColorNoise: null,
          rightPageBackgroundColorNoise: null,
        },
        spreads: currentAlbum.spreads.map((s) => ({
          ...s,
          backgroundColorNoise: noise,
          leftPageBackgroundColorNoise: null,
          rightPageBackgroundColorNoise: null,
        })),
      },
      saveStatus: 'unsaved',
    });
  },

  updateSpreadBorder: (
    spreadId: string,
    border: { borderEnabled?: boolean; borderWidth?: number; borderColor?: string },
    target: 'both' | 'full' | 'left' | 'right' = 'both'
  ) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    const updateSpreadFn = (s: Spread): Spread => {
      if (target === 'left') {
        return {
          ...s,
          leftPageBorderEnabled: border.borderEnabled !== undefined ? border.borderEnabled : s.leftPageBorderEnabled,
          leftPageBorderWidth: border.borderWidth !== undefined ? border.borderWidth : s.leftPageBorderWidth,
          leftPageBorderColor: border.borderColor !== undefined ? border.borderColor : s.leftPageBorderColor,
        };
      }
      if (target === 'right') {
        return {
          ...s,
          rightPageBorderEnabled: border.borderEnabled !== undefined ? border.borderEnabled : s.rightPageBorderEnabled,
          rightPageBorderWidth: border.borderWidth !== undefined ? border.borderWidth : s.rightPageBorderWidth,
          rightPageBorderColor: border.borderColor !== undefined ? border.borderColor : s.rightPageBorderColor,
        };
      }
      return {
        ...s,
        borderEnabled: border.borderEnabled !== undefined ? border.borderEnabled : s.borderEnabled,
        borderWidth: border.borderWidth !== undefined ? border.borderWidth : s.borderWidth,
        borderColor: border.borderColor !== undefined ? border.borderColor : s.borderColor,
      };
    };

    if (currentAlbum.coverSpread.id === spreadId) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: updateSpreadFn(currentAlbum.coverSpread),
        },
        saveStatus: 'unsaved',
      });
      return;
    }

    set({
      currentAlbum: {
        ...currentAlbum,
        spreads: currentAlbum.spreads.map((s) => (s.id === spreadId ? updateSpreadFn(s) : s)),
      },
      saveStatus: 'unsaved',
    });
  },

  applyBorderToAllSpreads: (
    border: { borderEnabled?: boolean; borderWidth?: number; borderColor?: string },
    target: 'both' | 'full' | 'left' | 'right' = 'both'
  ) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const updateSpreadFn = (s: Spread): Spread => {
      if (target === 'left') {
        return {
          ...s,
          leftPageBorderEnabled: border.borderEnabled !== undefined ? border.borderEnabled : s.leftPageBorderEnabled,
          leftPageBorderWidth: border.borderWidth !== undefined ? border.borderWidth : s.leftPageBorderWidth,
          leftPageBorderColor: border.borderColor !== undefined ? border.borderColor : s.leftPageBorderColor,
        };
      }
      if (target === 'right') {
        return {
          ...s,
          rightPageBorderEnabled: border.borderEnabled !== undefined ? border.borderEnabled : s.rightPageBorderEnabled,
          rightPageBorderWidth: border.borderWidth !== undefined ? border.borderWidth : s.rightPageBorderWidth,
          rightPageBorderColor: border.borderColor !== undefined ? border.borderColor : s.rightPageBorderColor,
        };
      }
      return {
        ...s,
        borderEnabled: border.borderEnabled !== undefined ? border.borderEnabled : s.borderEnabled,
        borderWidth: border.borderWidth !== undefined ? border.borderWidth : s.borderWidth,
        borderColor: border.borderColor !== undefined ? border.borderColor : s.borderColor,
      };
    };

    set({
      currentAlbum: {
        ...currentAlbum,
        coverSpread: updateSpreadFn(currentAlbum.coverSpread),
        spreads: currentAlbum.spreads.map(updateSpreadFn),
      },
      saveStatus: 'unsaved',
    });
  },

  toggleGuide: (guide: 'gutter' | 'bleed' | 'safeArea' | 'center' | 'thirds') => {
    if (guide === 'gutter') {
      set((s) => ({ showGutterGuide: !s.showGutterGuide }));
    } else if (guide === 'bleed') {
      set((s) => ({ showBleedGuide: !s.showBleedGuide }));
    } else if (guide === 'safeArea') {
      set((s) => ({ showSafeAreaGuide: !s.showSafeAreaGuide }));
    } else if (guide === 'center') {
      set((s) => ({ showCenterGuide: !s.showCenterGuide }));
    } else if (guide === 'thirds') {
      set((s) => ({ showThirdsGuide: !s.showThirdsGuide }));
    }
  },

  setGuideVisibility: (guide: 'gutter' | 'bleed' | 'safeArea' | 'center' | 'thirds', visible: boolean) => {
    if (guide === 'gutter') set({ showGutterGuide: visible });
    else if (guide === 'bleed') set({ showBleedGuide: visible });
    else if (guide === 'safeArea') set({ showSafeAreaGuide: visible });
    else if (guide === 'center') set({ showCenterGuide: visible });
    else if (guide === 'thirds') set({ showThirdsGuide: visible });
  },

  selectPage: (pageId: string | null) => {
    set({ selectedPageId: pageId });
  },

  cycleSpreadLayout: (spreadId: string, direction: 'next' | 'prev', project: Project) => {
    const { currentAlbum, spreadLayoutIndices } = get();
    if (!currentAlbum) return;

    const isCover = currentAlbum.coverSpread.id === spreadId;
    const targetSpread = isCover
      ? currentAlbum.coverSpread
      : currentAlbum.spreads.find((s) => s.id === spreadId);

    if (!targetSpread || targetSpread.elements.length === 0) return;

    const lockedElements = targetSpread.elements.filter((el): el is PhotoFrameElement => el.type === 'photo' && Boolean(el.locked));
    const excludedElements = targetSpread.elements.filter((el): el is PhotoFrameElement => el.type === 'photo' && !el.locked && Boolean(el.excludeFromAdaptiveLayout));
    const unlockedElements = targetSpread.elements.filter((el): el is PhotoFrameElement => el.type === 'photo' && !el.locked && !el.excludeFromAdaptiveLayout);
    const obstacleElements = [...lockedElements, ...excludedElements];
    const textElements = targetSpread.elements.filter((el) => el.type === 'text');

    // If all photo elements are locked or excluded, no changes can be made
    if (unlockedElements.length === 0) return;

    const unlockedPhotos: AdaptivePhoto[] = unlockedElements.map((el) => ({
      id: el.id,
      photoId: el.photoId,
      filePath: el.filePath,
      fileName: el.fileName,
      previewPath: el.previewPath,
      thumbnailPath: el.thumbnailPath,
      photoAspect: el.photoAspect,
    }));

    const isSpread = !isCover;
    const dims = getProjectDimensionsInCanvasUnit(project, targetSpread);
    const spreadWidth = isCover
      ? (targetSpread.leftPage ? targetSpread.leftPage.width : dims.pageWidth) +
        (targetSpread.rightPage ? targetSpread.rightPage.width : 0) +
        dims.gutterWidth
      : dims.pageWidth * 2 + dims.gutterWidth;
    const spreadHeight = dims.pageHeight;

    const variations = generateDynamicVariations(
      {
        containerWidth: spreadWidth,
        containerHeight: spreadHeight,
        isSpread,
        isCover,
        spacing: dims.spacing,
        gutterWidth: dims.gutterWidth,
        safeMarginTop: dims.safeMarginTop,
        safeMarginBottom: dims.safeMarginBottom,
        safeMarginOutside: dims.safeMarginOutside,
        safeMarginSpine: dims.safeMarginSpine,
        lockedElements: obstacleElements,
      },
      unlockedPhotos
    );

    if (variations.length === 0) return;

    const currentIndex = spreadLayoutIndices[spreadId] || 0;
    const nextIndex =
      direction === 'next'
        ? (currentIndex + 1) % variations.length
        : (currentIndex - 1 + variations.length) % variations.length;

    const chosenVariation = variations[nextIndex];
    if (!chosenVariation) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const faceDataMap = usePhotoStore.getState().faceDataMap;

    const newUnlockedElements = buildSpreadElementsFromVariation(
      chosenVariation,
      unlockedPhotos,
      project.borderEnabled,
      project.borderWidth,
      project.borderColor,
      faceDataMap
    );

    const newElements = [...lockedElements, ...excludedElements, ...newUnlockedElements, ...textElements];

    if (isCover) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: { ...currentAlbum.coverSpread, elements: newElements },
        },
        spreadLayoutIndices: { ...spreadLayoutIndices, [spreadId]: nextIndex },
        saveStatus: 'unsaved',
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((s) =>
        s.id === spreadId ? { ...s, elements: newElements } : s
      );
      set({
        currentAlbum: {
          ...currentAlbum,
          spreads: updatedSpreads,
        },
        spreadLayoutIndices: { ...spreadLayoutIndices, [spreadId]: nextIndex },
        saveStatus: 'unsaved',
      });
    }
  },

  shuffleSpreadPhotos: (spreadId: string) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    const isCover = currentAlbum.coverSpread.id === spreadId;
    const targetSpread = isCover
      ? currentAlbum.coverSpread
      : currentAlbum.spreads.find((s) => s.id === spreadId);

    if (!targetSpread) return;

    const photoElements = targetSpread.elements.filter((el): el is PhotoFrameElement => el.type === 'photo');
    const textElements = targetSpread.elements.filter((el) => el.type === 'text');
    if (photoElements.length <= 1) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const faceDataMap = usePhotoStore.getState().faceDataMap;

    const shuffledElements = [...shuffleElementsPhotos(photoElements, faceDataMap), ...textElements];

    if (isCover) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: { ...currentAlbum.coverSpread, elements: shuffledElements },
        },
        saveStatus: 'unsaved',
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((s) =>
        s.id === spreadId ? { ...s, elements: shuffledElements } : s
      );
      set({
        currentAlbum: {
          ...currentAlbum,
          spreads: updatedSpreads,
        },
        saveStatus: 'unsaved',
      });
    }
  },

  applyAdaptiveLayoutByIndex: (spreadId: string, index: number, project: Project) => {
    const { currentAlbum, spreadLayoutIndices } = get();
    if (!currentAlbum) return;

    const isCover = currentAlbum.coverSpread.id === spreadId;
    const targetSpread = isCover
      ? currentAlbum.coverSpread
      : currentAlbum.spreads.find((s) => s.id === spreadId);

    if (!targetSpread || targetSpread.elements.length === 0) return;

    const lockedElements = targetSpread.elements.filter((el): el is PhotoFrameElement => el.type === 'photo' && Boolean(el.locked));
    const excludedElements = targetSpread.elements.filter((el): el is PhotoFrameElement => el.type === 'photo' && !el.locked && Boolean(el.excludeFromAdaptiveLayout));
    const unlockedElements = targetSpread.elements.filter((el): el is PhotoFrameElement => el.type === 'photo' && !el.locked && !el.excludeFromAdaptiveLayout);
    const obstacleElements = [...lockedElements, ...excludedElements];
    const textElements = targetSpread.elements.filter((el) => el.type === 'text');

    // If all photo elements are locked or excluded, no changes can be made
    if (unlockedElements.length === 0) return;

    const unlockedPhotos: AdaptivePhoto[] = unlockedElements.map((el) => ({
      id: el.id,
      photoId: el.photoId,
      filePath: el.filePath,
      fileName: el.fileName,
      previewPath: el.previewPath,
      thumbnailPath: el.thumbnailPath,
      photoAspect: el.photoAspect,
    }));

    const isSpread = !isCover;
    const dims = getProjectDimensionsInCanvasUnit(project, targetSpread);
    const spreadWidth = isCover
      ? (targetSpread.leftPage ? targetSpread.leftPage.width : dims.pageWidth) +
        (targetSpread.rightPage ? targetSpread.rightPage.width : 0) +
        dims.gutterWidth
      : dims.pageWidth * 2 + dims.gutterWidth;
    const spreadHeight = dims.pageHeight;

    const variations = generateAdaptiveLayoutVariations(
      {
        spreadWidth,
        spreadHeight,
        isSpread,
        safeMargin: dims.safeMargin,
        safeMarginTop: dims.safeMarginTop,
        safeMarginBottom: dims.safeMarginBottom,
        safeMarginOutside: dims.safeMarginOutside,
        safeMarginSpine: dims.safeMarginSpine,
        gutterWidth: dims.gutterWidth,
        spacing: dims.spacing,
        lockedElements: obstacleElements,
      },
      unlockedPhotos
    );

    if (variations.length === 0 || index < 0 || index >= variations.length) return;

    const chosenVariation = variations[index];
    if (!chosenVariation) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const faceDataMap = usePhotoStore.getState().faceDataMap;

    const newUnlockedElements = buildSpreadElementsFromVariation(
      chosenVariation,
      unlockedPhotos,
      project.borderEnabled,
      project.borderWidth,
      project.borderColor,
      faceDataMap
    );

    const newElements = [...lockedElements, ...excludedElements, ...newUnlockedElements, ...textElements];

    if (isCover) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: { ...currentAlbum.coverSpread, elements: newElements },
        },
        spreadLayoutIndices: { ...spreadLayoutIndices, [spreadId]: index },
        saveStatus: 'unsaved',
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((s) =>
        s.id === spreadId ? { ...s, elements: newElements } : s
      );
      set({
        currentAlbum: {
          ...currentAlbum,
          spreads: updatedSpreads,
        },
        spreadLayoutIndices: { ...spreadLayoutIndices, [spreadId]: index },
        saveStatus: 'unsaved',
      });
    }
  },

  autoFlowPhotosToSpreads: async (
    photos: Photo[],
    project: Project,
    options?: { replaceCurrentSpread?: boolean }
  ) => {
    const { currentAlbum, activeSpreadId } = get();
    if (!currentAlbum || photos.length === 0) return;

    // Atomic History Snapshot: single Cmd+Z reverts entire auto-flow
    useHistoryStore.getState().pushState(currentAlbum);

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

    // Derive spread geometry from project canvas unit
    const sampleSpread = currentAlbum.spreads[0] || currentAlbum.coverSpread;
    const dims = getProjectDimensionsInCanvasUnit(project, sampleSpread);
    const spreadWidth = dims.pageWidth * 2 + dims.gutterWidth;
    const spreadHeight = dims.pageHeight;

    const generatorOpts = {
      containerWidth: spreadWidth,
      containerHeight: spreadHeight,
      spacing: dims.spacing,
      isSpread: true,
      gutterWidth: dims.gutterWidth,
      safeMarginTop: dims.safeMarginTop,
      safeMarginBottom: dims.safeMarginBottom,
      safeMarginOutside: dims.safeMarginOutside,
      safeMarginSpine: dims.safeMarginSpine,
    };

    const plans = generateAutoFlowPlan(adaptivePhotos, generatorOpts, {
      maxPhotosPerSpread: 6,
      minPhotosPerSpread: 1,
    });

    if (plans.length === 0) return;

    let updatedSpreads = [...currentAlbum.spreads];
    const isCover = currentAlbum.coverSpread.id === activeSpreadId;
    const activeSpread = isCover
      ? currentAlbum.coverSpread
      : updatedSpreads.find((s) => s.id === activeSpreadId);

    const shouldReplaceActive =
      Boolean(options?.replaceCurrentSpread) &&
      Boolean(activeSpread) &&
      !isCover &&
      activeSpread!.elements.length === 0;

    let planStartIdx = 0;
    const faceDataMap = usePhotoStore.getState().faceDataMap;

    if (shouldReplaceActive && activeSpread) {
      const firstPlan = plans[0]!;
      const firstSpreadElements = buildSpreadElementsFromVariation(
        firstPlan.selectedVariation,
        firstPlan.photos,
        project.borderEnabled,
        project.borderWidth,
        project.borderColor,
        faceDataMap
      );

      updatedSpreads = updatedSpreads.map((s) =>
        s.id === activeSpread.id ? { ...s, elements: firstSpreadElements } : s
      );
      planStartIdx = 1;
    }

    // Append remaining plans as new interior spreads
    let lastCreatedSpreadId = activeSpreadId;
    for (let pIdx = planStartIdx; pIdx < plans.length; pIdx++) {
      const plan = plans[pIdx]!;
      const spreadNum = updatedSpreads.length + 1;
      const newSpread = createInteriorSpread(currentAlbum, project, spreadNum);

      const elements = buildSpreadElementsFromVariation(
        plan.selectedVariation,
        plan.photos,
        project.borderEnabled,
        project.borderWidth,
        project.borderColor,
        faceDataMap
      );

      newSpread.elements = elements;
      updatedSpreads.push(newSpread);
      lastCreatedSpreadId = newSpread.id;
    }

    const updatedAlbum = recalculateAlbumPageNumbers({
      ...currentAlbum,
      spreads: updatedSpreads,
    });

    set({
      currentAlbum: updatedAlbum,
      activeSpreadId: lastCreatedSpreadId || activeSpreadId,
      saveStatus: 'unsaved',
    });
  },

  promoteToFullBleedSpread: (spreadId: string, frameId: string, project: Project) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    const isCover = currentAlbum.coverSpread.id === spreadId;
    if (isCover) return; // Full bleed spread promotion is designed for interior 2-page spreads

    const spreadIndex = currentAlbum.spreads.findIndex((s) => s.id === spreadId);
    if (spreadIndex === -1) return;
    const spread = currentAlbum.spreads[spreadIndex]!;

    const targetFrame = (spread.elements || []).find(
      (el): el is PhotoFrameElement => el.type === 'photo' && el.id === frameId
    );
    if (!targetFrame) return;

    // Single atomic undo snapshot
    useHistoryStore.getState().pushState(currentAlbum);

    const dims = getProjectDimensionsInCanvasUnit(project, spread);
    const spreadWidth = dims.pageWidth * 2 + dims.gutterWidth;
    const spreadHeight = dims.pageHeight;
    const bleed = dims.bleed ?? 0;

    // Full bleed photo geometry
    const fullBleedFrame: PhotoFrameElement = {
      ...targetFrame,
      x: -bleed,
      y: -bleed,
      width: spreadWidth + 2 * bleed,
      height: spreadHeight + 2 * bleed,
      rotation: 0,
      cropX: 0,
      cropY: 0,
      cropScale: 1.0,
    };

    // Extract other photos for non-destructive reflow
    const remainingPhotos = (spread.elements || []).filter(
      (el): el is PhotoFrameElement => el.type === 'photo' && el.id !== frameId
    );
    const nonPhotoElements = (spread.elements || []).filter((el) => el.type !== 'photo');

    // Update active spread with full bleed photo
    const updatedTargetSpread: Spread = {
      ...spread,
      elements: [fullBleedFrame, ...nonPhotoElements],
    };

    let updatedSpreads = [...currentAlbum.spreads];
    updatedSpreads[spreadIndex] = updatedTargetSpread;

    // Zero-Loss Invariant: Reflow remaining photos to a newly created interior spread
    if (remainingPhotos.length > 0) {
      const newSpreadNum = spreadIndex + 2;
      const newSpread = createInteriorSpread(currentAlbum, project, newSpreadNum);

      const reflowAdaptivePhotos: AdaptivePhoto[] = remainingPhotos.map((el) => ({
        id: el.id,
        photoId: el.photoId,
        filePath: el.filePath,
        fileName: el.fileName,
        previewPath: el.previewPath,
        thumbnailPath: el.thumbnailPath,
        photoAspect: el.photoAspect,
      }));

      const variations = generateDynamicVariations(
        {
          containerWidth: spreadWidth,
          containerHeight: spreadHeight,
          spacing: dims.spacing,
          isSpread: true,
          gutterWidth: dims.gutterWidth,
          safeMarginTop: dims.safeMarginTop,
          safeMarginBottom: dims.safeMarginBottom,
          safeMarginOutside: dims.safeMarginOutside,
          safeMarginSpine: dims.safeMarginSpine,
        },
        reflowAdaptivePhotos
      );

      if (variations.length > 0) {
        newSpread.elements = buildSpreadElementsFromVariation(
          variations[0]!,
          reflowAdaptivePhotos,
          project.borderEnabled,
          project.borderWidth,
          project.borderColor
        );
      } else {
        newSpread.elements = remainingPhotos;
      }

      updatedSpreads.splice(spreadIndex + 1, 0, newSpread);
    }

    const renumberedAlbum = recalculateAlbumPageNumbers({
      ...currentAlbum,
      spreads: updatedSpreads,
    });

    set({
      currentAlbum: renumberedAlbum,
      saveStatus: 'unsaved',
    });
  },

  setHeroPhotoOnSpread: (spreadId: string, frameId: string, project: Project) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    const isCover = currentAlbum.coverSpread.id === spreadId;
    const spread = isCover
      ? currentAlbum.coverSpread
      : currentAlbum.spreads.find((s) => s.id === spreadId);

    if (!spread) return;

    const photoElements = (spread.elements || []).filter(
      (el): el is PhotoFrameElement => el.type === 'photo'
    );
    if (photoElements.length < 2) return;

    const targetFrame = photoElements.find((el) => el.id === frameId);
    if (!targetFrame) return;

    // Single atomic undo snapshot
    useHistoryStore.getState().pushState(currentAlbum);

    const dims = getProjectDimensionsInCanvasUnit(project, spread);
    const isSpread = !isCover;
    const spreadWidth = isCover
      ? (spread.leftPage ? spread.leftPage.width : dims.pageWidth) +
        (spread.rightPage ? spread.rightPage.width : 0) +
        dims.gutterWidth
      : dims.pageWidth * 2 + dims.gutterWidth;
    const spreadHeight = dims.pageHeight;

    const targetHeroId = targetFrame.photoId || targetFrame.id;

    const adaptivePhotos: AdaptivePhoto[] = photoElements.map((el) => ({
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
        containerWidth: spreadWidth,
        containerHeight: spreadHeight,
        spacing: dims.spacing,
        isSpread,
        isCover,
        gutterWidth: dims.gutterWidth,
        safeMarginTop: dims.safeMarginTop,
        safeMarginBottom: dims.safeMarginBottom,
        safeMarginOutside: dims.safeMarginOutside,
        safeMarginSpine: dims.safeMarginSpine,
        heroPhotoId: targetHeroId,
      },
      adaptivePhotos
    );

    if (variations.length === 0) return;

    const faceDataMap = usePhotoStore.getState().faceDataMap;

    const bestVariation = variations[0]!;
    const newSpreadElements = buildSpreadElementsFromVariation(
      bestVariation,
      adaptivePhotos,
      project.borderEnabled,
      project.borderWidth,
      project.borderColor,
      faceDataMap
    );

    const nonPhotoElements = (spread.elements || []).filter((el) => el.type !== 'photo');
    const finalElements = [...newSpreadElements, ...nonPhotoElements];

    if (isCover) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: { ...currentAlbum.coverSpread, elements: finalElements },
        },
        saveStatus: 'unsaved',
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((s) =>
        s.id === spread.id ? { ...s, elements: finalElements } : s
      );
      set({
        currentAlbum: {
          ...currentAlbum,
          spreads: updatedSpreads,
        },
        saveStatus: 'unsaved',
      });
    }
  },

  reorderSpreadElements: (spreadId: string, orderedElementIds: string[]) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const reorderInList = (elements: AlbumElement[]): AlbumElement[] => {
      const elementMap = new Map(elements.map((el) => [el.id, el]));
      const reordered: AlbumElement[] = [];
      for (const id of orderedElementIds) {
        const el = elementMap.get(id);
        if (el) {
          reordered.push(el);
          elementMap.delete(id);
        }
      }
      // Append any elements not explicitly in orderedElementIds
      for (const remaining of elementMap.values()) {
        reordered.push(remaining);
      }
      return normalizeZIndices(reordered);
    };

    if (currentAlbum.coverSpread.id === spreadId) {
      const updatedCover = {
        ...currentAlbum.coverSpread,
        elements: reorderInList(currentAlbum.coverSpread.elements || []),
      };
      set({
        currentAlbum: { ...currentAlbum, coverSpread: updatedCover },
        saveStatus: 'unsaved',
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((spread) => {
        if (spread.id === spreadId) {
          return {
            ...spread,
            elements: reorderInList(spread.elements || []),
          };
        }
        return spread;
      });
      set({
        currentAlbum: { ...currentAlbum, spreads: updatedSpreads },
        saveStatus: 'unsaved',
      });
    }
  },

  reorderLayers: (spreadId: string, fromIndicesOrIds: string[] | number[], targetIndex: number) => {
    const { currentAlbum, reorderSpreadElements } = get();
    if (!currentAlbum) return;

    const targetSpread = currentAlbum.coverSpread?.id === spreadId
      ? currentAlbum.coverSpread
      : currentAlbum.spreads.find((s) => s.id === spreadId);
    if (!targetSpread || !targetSpread.elements || targetSpread.elements.length <= 1) return;

    // Convert elements to UI layer ordering (Slot 0 = Frontmost / Top of UI list)
    const uiLayers = canvasToUiLayers(targetSpread.elements);

    // Normalize selected IDs
    let selectedIds: string[] = [];
    if (typeof fromIndicesOrIds[0] === 'number') {
      selectedIds = (fromIndicesOrIds as number[])
        .map((idx) => uiLayers[idx]?.id)
        .filter((id): id is string => Boolean(id));
    } else {
      selectedIds = fromIndicesOrIds as string[];
    }

    const reorderedUiLayers = reorderLayersMultiSelection(uiLayers, selectedIds, targetIndex);
    // Convert back to canvas array (Index 0 = Backmost / Lowest zIndex)
    const canvasElements = uiLayersToCanvas(reorderedUiLayers);
    reorderSpreadElements(spreadId, canvasElements.map((el) => el.id));
  },

  toggleElementVisibility: (spreadId: string, elementId: string, forceState?: boolean) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const updateList = (elements: AlbumElement[]) =>
      elements.map((el) => {
        if (el.id === elementId) {
          const nextHidden = forceState !== undefined ? !forceState : !el.hidden;
          return { ...el, hidden: nextHidden };
        }
        return el;
      });

    if (currentAlbum.coverSpread.id === spreadId) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: { ...currentAlbum.coverSpread, elements: updateList(currentAlbum.coverSpread.elements || []) },
        },
        saveStatus: 'unsaved',
      });
    } else {
      set({
        currentAlbum: {
          ...currentAlbum,
          spreads: currentAlbum.spreads.map((s) => (s.id === spreadId ? { ...s, elements: updateList(s.elements || []) } : s)),
        },
        saveStatus: 'unsaved',
      });
    }
  },

  toggleElementLock: (spreadId: string, elementId: string, forceState?: boolean) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const updateList = (elements: AlbumElement[]) =>
      elements.map((el) => {
        if (el.id === elementId) {
          const nextLocked = forceState !== undefined ? forceState : !el.locked;
          return { ...el, locked: nextLocked };
        }
        return el;
      });

    if (currentAlbum.coverSpread.id === spreadId) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: { ...currentAlbum.coverSpread, elements: updateList(currentAlbum.coverSpread.elements || []) },
        },
        saveStatus: 'unsaved',
      });
    } else {
      set({
        currentAlbum: {
          ...currentAlbum,
          spreads: currentAlbum.spreads.map((s) => (s.id === spreadId ? { ...s, elements: updateList(s.elements || []) } : s)),
        },
        saveStatus: 'unsaved',
      });
    }
  },

  renameElement: (spreadId: string, elementId: string, name: string) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);
    const trimmedName = name.trim();

    const updateList = (elements: AlbumElement[]) =>
      elements.map((el) => (el.id === elementId ? { ...el, name: trimmedName || undefined } : el));

    if (currentAlbum.coverSpread.id === spreadId) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: { ...currentAlbum.coverSpread, elements: updateList(currentAlbum.coverSpread.elements || []) },
        },
        saveStatus: 'unsaved',
      });
    } else {
      set({
        currentAlbum: {
          ...currentAlbum,
          spreads: currentAlbum.spreads.map((s) => (s.id === spreadId ? { ...s, elements: updateList(s.elements || []) } : s)),
        },
        saveStatus: 'unsaved',
      });
    }
  },

  setAllElementsLock: (spreadId: string, locked: boolean) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const updateList = (elements: AlbumElement[]) => elements.map((el) => ({ ...el, locked }));

    if (currentAlbum.coverSpread.id === spreadId) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: { ...currentAlbum.coverSpread, elements: updateList(currentAlbum.coverSpread.elements || []) },
        },
        saveStatus: 'unsaved',
      });
    } else {
      set({
        currentAlbum: {
          ...currentAlbum,
          spreads: currentAlbum.spreads.map((s) => (s.id === spreadId ? { ...s, elements: updateList(s.elements || []) } : s)),
        },
        saveStatus: 'unsaved',
      });
    }
  },

  setAllElementsVisibility: (spreadId: string, visible: boolean) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const updateList = (elements: AlbumElement[]) => elements.map((el) => ({ ...el, hidden: !visible }));

    if (currentAlbum.coverSpread.id === spreadId) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: { ...currentAlbum.coverSpread, elements: updateList(currentAlbum.coverSpread.elements || []) },
        },
        saveStatus: 'unsaved',
      });
    } else {
      set({
        currentAlbum: {
          ...currentAlbum,
          spreads: currentAlbum.spreads.map((s) => (s.id === spreadId ? { ...s, elements: updateList(s.elements || []) } : s)),
        },
        saveStatus: 'unsaved',
      });
    }
  },

  deleteSingleElement: (spreadId: string, elementId: string) => {
    const { currentAlbum } = get();
    if (!currentAlbum) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const filterList = (elements: AlbumElement[]) => elements.filter((el) => el.id !== elementId);

    if (currentAlbum.coverSpread.id === spreadId) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: { ...currentAlbum.coverSpread, elements: filterList(currentAlbum.coverSpread.elements || []) },
        },
        saveStatus: 'unsaved',
      });
    } else {
      set({
        currentAlbum: {
          ...currentAlbum,
          spreads: currentAlbum.spreads.map((s) => (s.id === spreadId ? { ...s, elements: filterList(s.elements || []) } : s)),
        },
        saveStatus: 'unsaved',
      });
    }

    try {
      const { selectedFrameIds, selectFrames } = useEditorStore.getState();
      if (selectedFrameIds.includes(elementId)) {
        selectFrames(selectedFrameIds.filter((id) => id !== elementId));
      }
    } catch {
      // Ignore if editorStore not ready
    }
  },

  applyStudioFramingPreset: (frameId: string, preset: StudioFramingPreset, customConfig?: Partial<FramingConfig>) => {
    const album = get().currentAlbum;
    if (!album) return;

    const allSpreads = [album.coverSpread, ...album.spreads];
    const spread = allSpreads.find((s) => (s.elements || []).some((e) => e.id === frameId));
    if (!spread) return;
    const element = spread.elements.find((e) => e.id === frameId);
    if (!element || element.type !== 'photo') return;

    const photoState = usePhotoStore.getState();
    const photoId = element.photoId;
    const faceData = photoId ? photoState.getPhotoFaceData(photoId) : null;
    const photo = photoId ? photoState.photos.find((p: any) => p.id === photoId) : null;

    const imageWidth = photo?.width || element.originalWidth || 1200;
    const imageHeight = photo?.height || element.originalHeight || 800;

    const cropResult = calculateOptimalStudioCrop(
      {
        frameWidth: element.width,
        frameHeight: element.height,
        imageWidth,
        imageHeight,
      },
      faceData,
      preset,
      customConfig
    );

    useHistoryStore.getState().pushState(album);

    const updateFn = (f: AlbumElement): AlbumElement => {
      if (f.id === frameId && f.type === 'photo') {
        return {
          ...f,
          cropX: cropResult.cropX,
          cropY: cropResult.cropY,
          cropScale: cropResult.cropScale,
          faceFramingPreset: preset,
          faceHeadroomRatio: customConfig?.headroomRatio,
          faceEyeLineRatio: customConfig?.eyeLineTargetRatio,
          faceShoulderRatio: customConfig?.shoulderRatio,
        } as AlbumElement;
      }
      return f;
    };

    if (album.coverSpread.id === spread.id) {
      set({
        currentAlbum: {
          ...album,
          coverSpread: {
            ...album.coverSpread,
            elements: (album.coverSpread.elements || []).map(updateFn),
          },
        },
        saveStatus: 'unsaved',
      });
    } else {
      set({
        currentAlbum: {
          ...album,
          spreads: album.spreads.map((s) =>
            s.id === spread.id
              ? { ...s, elements: (s.elements || []).map(updateFn) }
              : s
          ),
        },
        saveStatus: 'unsaved',
      });
    }
  },

  flipElements: (spreadId, elementIds, axis) => {
    const { currentAlbum } = get();
    if (!currentAlbum || elementIds.length === 0) return;

    useHistoryStore.getState().pushState(currentAlbum);

    const targetSpread = currentAlbum.coverSpread.id === spreadId
      ? currentAlbum.coverSpread
      : currentAlbum.spreads.find((s) => s.id === spreadId);
    if (!targetSpread) return;

    const matchedElements = (targetSpread.elements || []).filter((el) => elementIds.includes(el.id));
    if (matchedElements.length === 0) return;

    const prop = axis === 'horizontal' ? 'flipHorizontal' : 'flipVertical';
    const anyFalse = matchedElements.some((el) => !(el as any)[prop]);
    const nextFlipVal = anyFalse;

    const updatedElements = (targetSpread.elements || []).map((el) => {
      if (!elementIds.includes(el.id)) return el;

      const radii = getCornerRadii(el as any);
      const permuted = permuteCornerRadiiOnFlip(radii, axis);

      return {
        ...el,
        [prop]: nextFlipVal,
        cornerRadiusTl: permuted[0],
        cornerRadiusTr: permuted[1],
        cornerRadiusBr: permuted[2],
        cornerRadiusBl: permuted[3],
        cornerRadius: permuted,
      } as AlbumElement;
    });

    if (currentAlbum.coverSpread.id === spreadId) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: { ...currentAlbum.coverSpread, elements: updatedElements },
        },
        saveStatus: 'unsaved',
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((s) =>
        s.id === spreadId ? { ...s, elements: updatedElements } : s
      );
      set({
        currentAlbum: { ...currentAlbum, spreads: updatedSpreads },
        saveStatus: 'unsaved',
      });
    }
  },

  updateElementVisualEffects: (spreadId, elementIds, effects) => {
    const { currentAlbum } = get();
    if (!currentAlbum || elementIds.length === 0) return;

    const targetSpread = currentAlbum.coverSpread.id === spreadId
      ? currentAlbum.coverSpread
      : currentAlbum.spreads.find((s) => s.id === spreadId);
    if (!targetSpread) return;

    const updatedElements = (targetSpread.elements || []).map((el) => {
      if (!elementIds.includes(el.id)) return el;
      return { ...el, ...effects } as AlbumElement;
    });

    if (currentAlbum.coverSpread.id === spreadId) {
      set({
        currentAlbum: {
          ...currentAlbum,
          coverSpread: { ...currentAlbum.coverSpread, elements: updatedElements },
        },
        saveStatus: 'unsaved',
      });
    } else {
      const updatedSpreads = currentAlbum.spreads.map((s) =>
        s.id === spreadId ? { ...s, elements: updatedElements } : s
      );
      set({
        currentAlbum: { ...currentAlbum, spreads: updatedSpreads },
        saveStatus: 'unsaved',
      });
    }
  },
}));
