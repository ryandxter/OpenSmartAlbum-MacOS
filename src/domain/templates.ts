import { Unit, convertUnit } from './units';
import { Project } from './project';
import { Spread } from './album';
import type { PhotoFrameElement } from './editor';
import type { AdaptiveLayoutSettings } from './adaptiveLayout';
import { matchPhotosToSlots, type PhotoAspectInput } from './layout/aspectMatcher';
import type { CarouselSlide, CarouselPhotoFrame } from './carousel';

export interface RectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TemplateParams {
  spreadWidth: number;
  spreadHeight: number;
  isSpread: boolean; // true for 2-page spread, false for single-page cover
  safeMargin: number; // default/fallback in canvasUnit
  safeMarginTop?: number;
  safeMarginBottom?: number;
  safeMarginOutside?: number;
  safeMarginSpine?: number;
  gutterWidth: number; // in canvasUnit
  spacing: number; // in canvasUnit
  currentPhotos?: Array<{
    id?: string;
    photoId?: string | null;
    filePath?: string;
    fileName?: string;
    previewPath?: string;
    thumbnailPath?: string;
    photoAspect?: number;
  }>;
  lockedElements?: PhotoFrameElement[];
  layoutSettings?: AdaptiveLayoutSettings;
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Extracts and unifies all project & spread physical dimensions into the project's native canvasUnit.
 * This completely prevents unit mismatch bugs (e.g. 10mm margin on an 8 inch canvas).
 */
export function getProjectDimensionsInCanvasUnit(project: Project, spread?: Spread | null): {
  pageWidth: number;
  pageHeight: number;
  unit: Unit;
  dpi: number;
  safeMargin: number;
  safeMarginTop: number;
  safeMarginBottom: number;
  safeMarginOutside: number;
  safeMarginSpine: number;
  gutterWidth: number;
  spacing: number;
  bleed: number;
} {
  const unit = project.canvasUnit;
  const dpi = project.canvasDpi || 300;

  // Check per-spread dimension overrides before falling back to project canvas size
  const rawPageWidth = spread?.pageWidth !== undefined && spread?.pageWidth !== null ? spread.pageWidth : project.canvasWidth;
  const rawPageHeight = spread?.pageHeight !== undefined && spread?.pageHeight !== null ? spread.pageHeight : project.canvasHeight;
  const spreadUnit = spread?.pageUnit || unit;
  const pageWidth = round4(convertUnit(rawPageWidth, spreadUnit, unit, dpi, 4));
  const pageHeight = round4(convertUnit(rawPageHeight, spreadUnit, unit, dpi, 4));

  // Margin: convert from project.marginUnit (or 'mm') to project.canvasUnit
  // Spread overrides take precedence, including explicit zero. Project margins
  // are defaults only; a zero default must not erase a later spread adjustment.
  const marginEnabled = project.marginEnabled ?? true;
  const rawMargin = !marginEnabled
    ? 0
    : (spread?.safeArea ?? project.marginValue ?? 10);

  const rawMarginTop = !marginEnabled
    ? 0
    : (spread?.safeAreaTop ?? spread?.safeArea ?? project.marginTop ?? rawMargin);

  const rawMarginBottom = !marginEnabled
    ? 0
    : (spread?.safeAreaBottom ?? spread?.safeArea ?? project.marginBottom ?? rawMargin);

  const rawMarginOutside = !marginEnabled
    ? 0
    : (spread?.safeAreaOutside ?? spread?.safeArea ?? project.marginOutside ?? rawMargin);

  const rawMarginSpine = !marginEnabled
    ? 0
    : (spread?.safeAreaSpine ?? spread?.safeArea ?? project.marginSpine ?? rawMargin);

  const marginUnit = project.marginUnit || 'mm';
  const safeMargin = round4(convertUnit(rawMargin, marginUnit, unit, dpi, 4));
  const safeMarginTop = round4(convertUnit(rawMarginTop, marginUnit, unit, dpi, 4));
  const safeMarginBottom = round4(convertUnit(rawMarginBottom, marginUnit, unit, dpi, 4));
  const safeMarginOutside = round4(convertUnit(rawMarginOutside, marginUnit, unit, dpi, 4));
  const safeMarginSpine = round4(convertUnit(rawMarginSpine, marginUnit, unit, dpi, 4));

  // Spacing: convert from spread.spacingUnit or project.spacingUnit (or 'mm') to project.canvasUnit
  const rawSpacing = spread?.spacingValue ?? project.spacingValue ?? 4;
  const spacingUnit = spread?.spacingUnit ?? project.spacingUnit ?? 'mm';
  const spacing = round4(convertUnit(rawSpacing, spacingUnit, unit, dpi, 4));

  // Gutter: In layflat photobooks, physical spread width is strictly 2 * pageWidth without spine expansion
  const gutterWidth = 0;

  // Bleed: spread.bleed is already in project.canvasUnit (e.g. 0mm, 0cm, 0in)
  const defaultBleed = 0;
  const bleed = round4(spread?.bleed ?? defaultBleed);

  return {
    pageWidth,
    pageHeight,
    unit,
    dpi,
    safeMargin,
    safeMarginTop,
    safeMarginBottom,
    safeMarginOutside,
    safeMarginSpine,
    gutterWidth,
    spacing,
    bleed,
  };
}

/**
 * Fits a photo with given aspect ratio centered horizontally & vertically inside a container box.
 */
export function fitInsideBoxCentered(
  container: RectBounds,
  photoAspect = 1.5,
  coverage = 1.0
): RectBounds {
  const maxW = container.width * coverage;
  const maxH = container.height * coverage;
  const boxAspect = maxW / Math.max(0.001, maxH);

  let w: number;
  let h: number;

  if (photoAspect >= boxAspect) {
    w = maxW;
    h = w / photoAspect;
  } else {
    h = maxH;
    w = h * photoAspect;
  }

  const x = container.x + (container.width - w) / 2;
  const y = container.y + (container.height - h) / 2;

  return {
    x: round4(x),
    y: round4(y),
    width: round4(w),
    height: round4(h),
  };
}

/**
 * Computes exact printable and designable Safe Margin boxes for Left Page and Right Page.
 * Conforms 100% with the Blue Dashed Safe Guide Lines on the canvas.
 */
export function getUsableAreas(params: TemplateParams): {
  spreadArea: RectBounds;
  leftPageArea: RectBounds;
  rightPageArea: RectBounds;
  pageWidth: number;
  gutterWidth: number;
} {
  const {
    spreadWidth,
    spreadHeight,
    isSpread,
    safeMargin,
    safeMarginTop = safeMargin,
    safeMarginBottom = safeMargin,
    safeMarginOutside = safeMargin,
    safeMarginSpine = safeMargin,
    gutterWidth,
  } = params;

  if (!isSpread) {
    const singleArea: RectBounds = {
      x: round4(safeMarginOutside),
      y: round4(safeMarginTop),
      width: Math.max(0.1, round4(spreadWidth - safeMarginOutside * 2)),
      height: Math.max(0.1, round4(spreadHeight - safeMarginTop - safeMarginBottom)),
    };
    return {
      spreadArea: singleArea,
      leftPageArea: singleArea,
      rightPageArea: singleArea,
      pageWidth: spreadWidth,
      gutterWidth: 0,
    };
  }

  // On a 2-page spread: spreadWidth = leftPageWidth + gutterWidth + rightPageWidth
  const pageWidth = round4((spreadWidth - gutterWidth) / 2);

  // Left Page: outer edge is safeMarginOutside, spine edge is safeMarginSpine
  const leftPageArea: RectBounds = {
    x: round4(safeMarginOutside),
    y: round4(safeMarginTop),
    width: Math.max(0.1, round4(pageWidth - safeMarginOutside - safeMarginSpine)),
    height: Math.max(0.1, round4(spreadHeight - safeMarginTop - safeMarginBottom)),
  };

  // Right Page: spine edge starts at pageWidth + gutterWidth + safeMarginSpine, outer edge is safeMarginOutside
  const rightPageArea: RectBounds = {
    x: round4(pageWidth + gutterWidth + safeMarginSpine),
    y: round4(safeMarginTop),
    width: Math.max(0.1, round4(pageWidth - safeMarginSpine - safeMarginOutside)),
    height: Math.max(0.1, round4(spreadHeight - safeMarginTop - safeMarginBottom)),
  };

  // Full Spread Area across both pages
  const spreadArea: RectBounds = {
    x: round4(safeMarginOutside),
    y: round4(safeMarginTop),
    width: Math.max(0.1, round4(spreadWidth - safeMarginOutside * 2)),
    height: Math.max(0.1, round4(spreadHeight - safeMarginTop - safeMarginBottom)),
  };

  return { spreadArea, leftPageArea, rightPageArea, pageWidth, gutterWidth };
}

// ---------------------------------------------------------------------------
// v1.4.14 Custom Layout Template Models (DB-01, DB-04)
// ---------------------------------------------------------------------------

export type TemplateCanvasKind = 'spread' | 'single' | 'carousel' | 'post' | 'slide';

export interface LayoutTemplateCanvas {
  kind: string; // "spread" | "post" | "slide" | "single"
  width: number;
  height: number;
  pageWidth?: number;
  gutterWidth?: number;
  unit?: string;
  dpi?: number;
}

export interface TemplateFrameStyle {
  borderEnabled?: boolean;
  borderWidth?: number;
  borderColor?: string;
  cornerRadii?: number | [number, number, number, number];
  shadowEnabled?: boolean;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  shadowColor?: string;
  noiseAmount?: number;
  blurRadius?: number;
  grayscaleAmount?: number;
  opacity?: number;
}

export interface TemplateSlot {
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex?: number;
  page?: 'left' | 'right' | 'full' | string;
  style?: TemplateFrameStyle | any;
  frameAssetId?: string | null;
  frameAssetTitle?: string | null;
  frameAssetUrl?: string | null;
  frameAssetLocalPath?: string | null;
  frameAssetSlot?: any;
  frameAssetIsPro?: boolean;
  shapeType?: string;
  cornerRadius?: number | [number, number, number, number];
  type?: 'photo' | 'text' | 'graphic';
  text?: string;
  cropX?: number;
  cropY?: number;
  cropScale?: number;
  borderEnabled?: boolean;
  borderWidth?: number;
  borderColor?: string;
  shadowEnabled?: boolean;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  shadowColor?: string;
}

export interface LayoutTemplateSpec {
  version?: number;
  id?: string;
  name: string;
  folderId?: string | null;
  canvas?: LayoutTemplateCanvas;
  canvasKind?: TemplateCanvasKind;
  slots: TemplateSlot[];
  aspectRatio?: number;
  description?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface LayoutTemplate {
  id: string;
  name?: string;
  folderId?: string | null;
  payload: string | LayoutTemplateSpec;
  isFavorite: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LayoutTemplateFolder {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export type TemplateTargetArea = 'full' | 'spread' | 'left' | 'right' | 'slide';
export type TemplatePlacementMode = 'fit_safe_margin' | 'original_position';

export interface TemplateApplyStyleOptions {
  geometryOnly?: boolean;
  borders?: boolean;
  cornerRadii?: boolean;
  shadows?: boolean;
  effects?: boolean;
  opacity?: boolean;
  frameOverlays?: boolean;
}

export interface TemplateConflict {
  templateId: string;
  templateName: string;
  existingId?: string;
  existingName?: string;
  conflictType: 'id_exists' | 'name_exists' | 'both' | string;
}

export interface TemplatePreviewItem {
  id: string;
  name: string;
  slotCount: number;
  canvasKind: string;
  hasFrameAssets: boolean;
  sourceFile?: string;
}

export interface StagedImportPreview {
  token: string;
  packageName: string;
  templates: TemplatePreviewItem[];
  conflicts: TemplateConflict[];
  totalCount: number;
}

export interface StagedExportPreview {
  token: string;
  targetPath: string;
  templateCount: number;
  hasCustomFrameAssets: boolean;
  isPackage: boolean;
}

export interface TemplateExportOptions {
  targetPath?: string;
  includePreviews?: boolean;
}

export interface TemplatePackagePreviewItem {
  id: string;
  name: string;
  slotCount: number;
  isFavorite: boolean;
  folderName?: string;
}

export interface TemplatePackageSelection {
  templateIds: string[];
  folderIds: string[];
}

export interface TemplateExportResult {
  success: boolean;
  exportedCount: number;
  filePath?: string;
  error?: string;
}

export interface SlotPhotoAssignment<P, S> {
  slotIndex: number;
  slot: S;
  photo?: P;
}

/**
 * Maps photos to geometric slots using Kuhn-Munkres Hungarian energy minimization.
 */
export function assignPhotosToSlots<
  P extends {
    id?: string;
    photoAspect?: number;
    width?: number;
    height?: number;
    isHero?: boolean;
    isFavorite?: boolean;
    rating?: number;
  },
  S extends RectBounds
>(photos: P[], slots: S[]): SlotPhotoAssignment<P, S>[] {
  if (slots.length === 0) {
    return [];
  }

  if (photos.length === 0) {
    return slots.map((slot, idx) => ({
      slotIndex: idx,
      slot,
      photo: undefined,
    }));
  }

  const photoInputs: PhotoAspectInput[] = photos.map((p) => {
    let aspect = p.photoAspect;
    if (!aspect && p.width && p.height && p.height > 0) {
      aspect = p.width / p.height;
    }
    return {
      aspect: aspect && aspect > 0 ? aspect : 1.5,
      rating: p.rating,
      isFavorite: p.isFavorite,
      isHero: p.isHero,
    };
  });

  const { mapping } = matchPhotosToSlots(photoInputs, slots);

  const slotToPhotoMap = new Map<number, P>();
  for (let photoIdx = 0; photoIdx < photos.length; photoIdx++) {
    const assignedSlotIdx = mapping[photoIdx];
    if (
      assignedSlotIdx !== undefined &&
      assignedSlotIdx >= 0 &&
      assignedSlotIdx < slots.length &&
      !slotToPhotoMap.has(assignedSlotIdx)
    ) {
      const p = photos[photoIdx];
      if (p) {
        slotToPhotoMap.set(assignedSlotIdx, p);
      }
    }
  }

  return slots.map((slot, idx) => ({
    slotIndex: idx,
    slot,
    photo: slotToPhotoMap.get(idx),
  }));
}

/**
 * Applies a LayoutTemplateSpec to an album spread, mapping photos to best-fit aspect slots
 * while strictly preserving pinned elements (excludeFromAdaptiveLayout / locked).
 */
export function applyTemplateToSpread(
  templateSpec: LayoutTemplateSpec,
  currentSpread: Spread,
  project: Project,
  targetArea: TemplateTargetArea = 'spread',
  placementMode: TemplatePlacementMode = 'fit_safe_margin',
  styleOpts: TemplateApplyStyleOptions = {},
  existingPhotos?: PhotoFrameElement[]
): Spread {
  const isCover = !currentSpread.leftPage || !currentSpread.rightPage;
  const isSpread = !isCover;
  const dims = getProjectDimensionsInCanvasUnit(project, currentSpread);

  const usable = getUsableAreas({
    spreadWidth: isCover
      ? (currentSpread.leftPage ? currentSpread.leftPage.width : dims.pageWidth) +
        (currentSpread.rightPage ? currentSpread.rightPage.width : 0) +
        dims.gutterWidth
      : dims.pageWidth * 2 + dims.gutterWidth,
    spreadHeight: dims.pageHeight,
    isSpread,
    safeMargin: dims.safeMargin,
    safeMarginTop: dims.safeMarginTop,
    safeMarginBottom: dims.safeMarginBottom,
    safeMarginOutside: dims.safeMarginOutside,
    safeMarginSpine: dims.safeMarginSpine,
    gutterWidth: dims.gutterWidth,
    spacing: dims.spacing,
  });

  const spineX = usable.pageWidth + usable.gutterWidth / 2;
  const allElements = currentSpread.elements || [];

  // Pinned elements are never moved or overwritten
  const pinnedElements = allElements.filter(
    (el) => Boolean(el.locked) || Boolean(el.excludeFromAdaptiveLayout)
  );

  // Retain non-target region elements if applying to only left or right page
  let retainedNonTarget: PhotoFrameElement[] = [];
  if (targetArea === 'left') {
    retainedNonTarget = allElements.filter(
      (el): el is PhotoFrameElement => !pinnedElements.includes(el) && el.x >= spineX
    );
  } else if (targetArea === 'right') {
    retainedNonTarget = allElements.filter(
      (el): el is PhotoFrameElement => !pinnedElements.includes(el) && el.x < spineX
    );
  }

  // Determine existing photos to map to template slots
  let unlockedPhotos: PhotoFrameElement[];
  if (existingPhotos) {
    unlockedPhotos = existingPhotos.filter(
      (p) => !p.locked && !p.excludeFromAdaptiveLayout
    );
  } else {
    if (targetArea === 'left') {
      unlockedPhotos = allElements.filter(
        (el): el is PhotoFrameElement =>
          el.type === 'photo' && !el.locked && !el.excludeFromAdaptiveLayout && el.x < spineX
      );
    } else if (targetArea === 'right') {
      unlockedPhotos = allElements.filter(
        (el): el is PhotoFrameElement =>
          el.type === 'photo' && !el.locked && !el.excludeFromAdaptiveLayout && el.x >= spineX
      );
    } else {
      unlockedPhotos = allElements.filter(
        (el): el is PhotoFrameElement =>
          el.type === 'photo' && !el.locked && !el.excludeFromAdaptiveLayout
      );
    }
  }

  // Select slots according to target area
  let candidateSlots = templateSpec.slots || [];
  if (targetArea === 'left') {
    const leftSlots = candidateSlots.filter((s) => s.page === 'left');
    if (leftSlots.length > 0) candidateSlots = leftSlots;
  } else if (targetArea === 'right') {
    const rightSlots = candidateSlots.filter((s) => s.page === 'right');
    if (rightSlots.length > 0) candidateSlots = rightSlots;
  }

  let targetBox: RectBounds;
  if (targetArea === 'left') {
    targetBox = usable.leftPageArea;
  } else if (targetArea === 'right') {
    targetBox = usable.rightPageArea;
  } else {
    targetBox = usable.spreadArea;
  }

  // Compute destination slot positions
  let mappedSlots: Array<RectBounds & { originalSlot: TemplateSlot }>;
  if (candidateSlots.length === 0) {
    mappedSlots = [];
  } else if (placementMode === 'original_position') {
    mappedSlots = candidateSlots.map((slot) => {
      let x = slot.x;
      if (targetArea === 'right' && slot.x < (templateSpec.canvas?.pageWidth || usable.pageWidth)) {
        x = slot.x + spineX;
      }
      return {
        x: round4(x),
        y: round4(slot.y),
        width: round4(slot.width),
        height: round4(slot.height),
        originalSlot: slot,
      };
    });
  } else {
    // 'fit_safe_margin'
    const minX = Math.min(...candidateSlots.map((s) => s.x));
    const minY = Math.min(...candidateSlots.map((s) => s.y));
    const maxX = Math.max(...candidateSlots.map((s) => s.x + s.width));
    const maxY = Math.max(...candidateSlots.map((s) => s.y + s.height));
    const boundW = Math.max(0.001, maxX - minX);
    const boundH = Math.max(0.001, maxY - minY);

    const scale = Math.min(targetBox.width / boundW, targetBox.height / boundH);
    const fittedW = boundW * scale;
    const fittedH = boundH * scale;
    const offsetX = targetBox.x + (targetBox.width - fittedW) / 2;
    const offsetY = targetBox.y + (targetBox.height - fittedH) / 2;

    mappedSlots = candidateSlots.map((slot) => ({
      x: round4(offsetX + (slot.x - minX) * scale),
      y: round4(offsetY + (slot.y - minY) * scale),
      width: round4(slot.width * scale),
      height: round4(slot.height * scale),
      originalSlot: slot,
    }));
  }

  // Hungarian photo-to-slot matching
  const assignments = assignPhotosToSlots(unlockedPhotos, mappedSlots);

  const newElements: PhotoFrameElement[] = assignments.map(({ slot, photo, slotIndex }) => {
    const orig = slot.originalSlot;
    const style = orig.style || {};
    const isGeomOnly = Boolean(styleOpts.geometryOnly);

    const frameId = photo?.id || `frame-${Date.now()}-${slotIndex + 1}-${Math.random().toString(36).slice(2, 6)}`;

    const borderEnabled = isGeomOnly
      ? (photo?.borderEnabled ?? false)
      : styleOpts.borders !== false
        ? (style.borderEnabled ?? orig.borderEnabled ?? false)
        : (photo?.borderEnabled ?? false);

    const borderWidth = isGeomOnly
      ? (photo?.borderWidth ?? 0)
      : styleOpts.borders !== false
        ? (style.borderWidth ?? orig.borderWidth ?? 0)
        : (photo?.borderWidth ?? 0);

    const borderColor = isGeomOnly
      ? (photo?.borderColor ?? '#000000')
      : styleOpts.borders !== false
        ? (style.borderColor ?? orig.borderColor ?? '#000000')
        : (photo?.borderColor ?? '#000000');

    const cornerRadius = isGeomOnly
      ? (photo?.cornerRadius ?? 0)
      : styleOpts.cornerRadii !== false
        ? (style.cornerRadii ?? orig.cornerRadius ?? 0)
        : (photo?.cornerRadius ?? 0);

    const shadowEnabled = isGeomOnly
      ? (photo?.shadowEnabled ?? false)
      : styleOpts.shadows !== false
        ? (style.shadowEnabled ?? orig.shadowEnabled ?? false)
        : (photo?.shadowEnabled ?? false);

    const shadowBlur = isGeomOnly
      ? (photo?.shadowBlur ?? 10)
      : styleOpts.shadows !== false
        ? (style.shadowBlur ?? orig.shadowBlur ?? 10)
        : (photo?.shadowBlur ?? 10);

    const shadowOffsetX = isGeomOnly
      ? (photo?.shadowOffsetX ?? 0)
      : styleOpts.shadows !== false
        ? (style.shadowOffsetX ?? orig.shadowOffsetX ?? 0)
        : (photo?.shadowOffsetX ?? 0);

    const shadowOffsetY = isGeomOnly
      ? (photo?.shadowOffsetY ?? 4)
      : styleOpts.shadows !== false
        ? (style.shadowOffsetY ?? orig.shadowOffsetY ?? 4)
        : (photo?.shadowOffsetY ?? 4);

    const shadowOpacity = isGeomOnly
      ? (photo?.shadowOpacity ?? 0.25)
      : styleOpts.shadows !== false
        ? (style.shadowOpacity ?? orig.shadowOpacity ?? 0.25)
        : (photo?.shadowOpacity ?? 0.25);

    const shadowColor = isGeomOnly
      ? (photo?.shadowColor ?? '#000000')
      : styleOpts.shadows !== false
        ? (style.shadowColor ?? orig.shadowColor ?? '#000000')
        : (photo?.shadowColor ?? '#000000');

    const opacity = isGeomOnly
      ? (photo?.opacity ?? 100)
      : styleOpts.opacity !== false
        ? (style.opacity ?? 100)
        : (photo?.opacity ?? 100);

    const noiseAmount = isGeomOnly
      ? (photo?.noiseAmount ?? 0)
      : styleOpts.effects !== false
        ? (style.noiseAmount ?? 0)
        : (photo?.noiseAmount ?? 0);

    const blurRadius = isGeomOnly
      ? (photo?.blurRadius ?? 0)
      : styleOpts.effects !== false
        ? (style.blurRadius ?? 0)
        : (photo?.blurRadius ?? 0);

    const grayscaleAmount = isGeomOnly
      ? (photo?.grayscaleAmount ?? 0)
      : styleOpts.effects !== false
        ? (style.grayscaleAmount ?? 0)
        : (photo?.grayscaleAmount ?? 0);

    const frameAssetId = isGeomOnly
      ? (photo?.frameAssetId ?? null)
      : styleOpts.frameOverlays !== false
        ? (orig.frameAssetId ?? null)
        : (photo?.frameAssetId ?? null);

    const frameAssetTitle = isGeomOnly
      ? (photo?.frameAssetTitle ?? null)
      : styleOpts.frameOverlays !== false
        ? (orig.frameAssetTitle ?? null)
        : (photo?.frameAssetTitle ?? null);

    const frameAssetUrl = isGeomOnly
      ? (photo?.frameAssetUrl ?? null)
      : styleOpts.frameOverlays !== false
        ? (orig.frameAssetUrl ?? null)
        : (photo?.frameAssetUrl ?? null);

    const frameAssetLocalPath = isGeomOnly
      ? (photo?.frameAssetLocalPath ?? null)
      : styleOpts.frameOverlays !== false
        ? (orig.frameAssetLocalPath ?? null)
        : (photo?.frameAssetLocalPath ?? null);

    const frameAssetSlot = isGeomOnly
      ? (photo?.frameAssetSlot ?? null)
      : styleOpts.frameOverlays !== false
        ? (orig.frameAssetSlot ?? null)
        : (photo?.frameAssetSlot ?? null);

    return {
      id: frameId,
      type: 'photo',
      photoId: photo ? photo.photoId : null,
      filePath: photo ? photo.filePath : '',
      fileName: photo ? photo.fileName : '',
      previewPath: photo?.previewPath ?? '',
      thumbnailPath: photo?.thumbnailPath ?? '',
      photoAspect: photo?.photoAspect,
      x: slot.x,
      y: slot.y,
      width: slot.width,
      height: slot.height,
      rotation: orig.rotation || 0,
      cropX: photo?.cropX ?? 0,
      cropY: photo?.cropY ?? 0,
      cropScale: photo?.cropScale ?? 1,
      cropRotation: photo?.cropRotation ?? 0,
      borderEnabled,
      borderWidth,
      borderColor,
      cornerRadius,
      shadowEnabled,
      shadowBlur,
      shadowOffsetX,
      shadowOffsetY,
      shadowOpacity,
      shadowColor,
      opacity,
      noiseAmount,
      blurRadius,
      grayscaleAmount,
      frameAssetId,
      frameAssetTitle,
      frameAssetUrl,
      frameAssetLocalPath,
      frameAssetSlot,
      frameAssetIsPro: false,
      excludeFromAdaptiveLayout: false,
      locked: false,
      zIndex: orig.zIndex ?? (slotIndex + 1),
    };
  });

  return {
    ...currentSpread,
    elements: [...pinnedElements, ...retainedNonTarget, ...newElements],
  };
}

/**
 * Applies a LayoutTemplateSpec to a carousel slide, preserving pinned elements.
 */
export function applyTemplateToSlide(
  templateSpec: LayoutTemplateSpec,
  currentSlide: CarouselSlide,
  slideWidth = 1080,
  slideHeight = 1080,
  placementMode: TemplatePlacementMode = 'fit_safe_margin',
  styleOpts: TemplateApplyStyleOptions = {},
  existingPhotos?: CarouselPhotoFrame[]
): CarouselSlide {
  const allElements = currentSlide.elements || [];
  const pinnedElements = allElements.filter(
    (el) => Boolean(el.locked) || Boolean(el.excludeFromAdaptiveLayout)
  );

  let unlockedPhotos: CarouselPhotoFrame[];
  if (existingPhotos) {
    unlockedPhotos = existingPhotos.filter((p) => !p.locked && !p.excludeFromAdaptiveLayout);
  } else {
    unlockedPhotos = allElements.filter(
      (el): el is CarouselPhotoFrame => el.type === 'photo' && !el.locked && !el.excludeFromAdaptiveLayout
    );
  }

  const candidateSlots = templateSpec.slots || [];
  const safePadding = placementMode === 'fit_safe_margin' ? 40 : 0;
  const targetBox: RectBounds = {
    x: safePadding,
    y: safePadding,
    width: Math.max(10, slideWidth - safePadding * 2),
    height: Math.max(10, slideHeight - safePadding * 2),
  };

  let mappedSlots: Array<RectBounds & { originalSlot: TemplateSlot }>;
  if (candidateSlots.length === 0) {
    mappedSlots = [];
  } else if (placementMode === 'original_position') {
    mappedSlots = candidateSlots.map((slot) => ({
      x: round4(slot.x),
      y: round4(slot.y),
      width: round4(slot.width),
      height: round4(slot.height),
      originalSlot: slot,
    }));
  } else {
    const minX = Math.min(...candidateSlots.map((s) => s.x));
    const minY = Math.min(...candidateSlots.map((s) => s.y));
    const maxX = Math.max(...candidateSlots.map((s) => s.x + s.width));
    const maxY = Math.max(...candidateSlots.map((s) => s.y + s.height));
    const boundW = Math.max(0.001, maxX - minX);
    const boundH = Math.max(0.001, maxY - minY);

    const scale = Math.min(targetBox.width / boundW, targetBox.height / boundH);
    const fittedW = boundW * scale;
    const fittedH = boundH * scale;
    const offsetX = targetBox.x + (targetBox.width - fittedW) / 2;
    const offsetY = targetBox.y + (targetBox.height - fittedH) / 2;

    mappedSlots = candidateSlots.map((slot) => ({
      x: round4(offsetX + (slot.x - minX) * scale),
      y: round4(offsetY + (slot.y - minY) * scale),
      width: round4(slot.width * scale),
      height: round4(slot.height * scale),
      originalSlot: slot,
    }));
  }

  const assignments = assignPhotosToSlots(unlockedPhotos, mappedSlots);

  const newElements: CarouselPhotoFrame[] = assignments.map(({ slot, photo, slotIndex }) => {
    const orig = slot.originalSlot;
    const style = orig.style || {};
    const isGeomOnly = Boolean(styleOpts.geometryOnly);
    const frameId = photo?.id || `c-frame-${Date.now()}-${slotIndex + 1}-${Math.random().toString(36).slice(2, 6)}`;

    const rawCornerRadius = isGeomOnly
      ? (photo?.cornerRadius ?? 0)
      : (style.cornerRadii ?? orig.cornerRadius ?? 0);
    const cornerRadius = typeof rawCornerRadius === 'number' ? rawCornerRadius : Array.isArray(rawCornerRadius) ? rawCornerRadius[0] : 0;

    return {
      id: frameId,
      type: 'photo',
      photoId: photo?.photoId ?? undefined,
      filePath: photo?.filePath ?? '',
      fileName: photo?.fileName ?? '',
      previewPath: photo?.previewPath ?? '',
      thumbnailPath: photo?.thumbnailPath ?? '',
      photoAspect: photo?.photoAspect,
      x: slot.x,
      y: slot.y,
      width: slot.width,
      height: slot.height,
      rotation: orig.rotation || 0,
      cropX: photo?.cropX ?? 0,
      cropY: photo?.cropY ?? 0,
      cropScale: photo?.cropScale ?? 1,
      cropRotation: photo?.cropRotation ?? 0,
      borderEnabled: isGeomOnly ? (photo?.borderEnabled ?? false) : (style.borderEnabled ?? orig.borderEnabled ?? false),
      borderWidth: isGeomOnly ? (photo?.borderWidth ?? 0) : (style.borderWidth ?? orig.borderWidth ?? 0),
      borderColor: isGeomOnly ? (photo?.borderColor ?? '#000000') : (style.borderColor ?? orig.borderColor ?? '#000000'),
      cornerRadius,
      shadowEnabled: isGeomOnly ? (photo?.shadowEnabled ?? false) : (style.shadowEnabled ?? orig.shadowEnabled ?? false),
      shadowBlur: isGeomOnly ? (photo?.shadowBlur ?? 10) : (style.shadowBlur ?? orig.shadowBlur ?? 10),
      shadowOffsetX: isGeomOnly ? (photo?.shadowOffsetX ?? 0) : (style.shadowOffsetX ?? orig.shadowOffsetX ?? 0),
      shadowOffsetY: isGeomOnly ? (photo?.shadowOffsetY ?? 4) : (style.shadowOffsetY ?? orig.shadowOffsetY ?? 4),
      shadowOpacity: isGeomOnly ? (photo?.shadowOpacity ?? 0.25) : (style.shadowOpacity ?? orig.shadowOpacity ?? 0.25),
      shadowColor: isGeomOnly ? (photo?.shadowColor ?? '#000000') : (style.shadowColor ?? orig.shadowColor ?? '#000000'),
      opacity: isGeomOnly ? (photo?.opacity ?? 100) : (style.opacity ?? 100),
      noiseAmount: isGeomOnly ? (photo?.noiseAmount ?? 0) : (style.noiseAmount ?? 0),
      blurRadius: isGeomOnly ? (photo?.blurRadius ?? 0) : (style.blurRadius ?? 0),
      grayscaleAmount: isGeomOnly ? (photo?.grayscaleAmount ?? 0) : (style.grayscaleAmount ?? 0),
      frameAssetId: isGeomOnly ? (photo?.frameAssetId ?? null) : (orig.frameAssetId ?? null),
      frameAssetTitle: isGeomOnly ? (photo?.frameAssetTitle ?? null) : (orig.frameAssetTitle ?? null),
      frameAssetUrl: isGeomOnly ? (photo?.frameAssetUrl ?? null) : (orig.frameAssetUrl ?? null),
      frameAssetLocalPath: isGeomOnly ? (photo?.frameAssetLocalPath ?? null) : (orig.frameAssetLocalPath ?? null),
      frameAssetSlot: isGeomOnly ? (photo?.frameAssetSlot ?? null) : (orig.frameAssetSlot ?? null),
      frameAssetIsPro: false,
      excludeFromAdaptiveLayout: false,
      locked: false,
      zIndex: orig.zIndex ?? (slotIndex + 1),
    };
  });

  return {
    ...currentSlide,
    elements: [...pinnedElements, ...newElements],
  };
}

/**
 * Generates lightweight SVG layout preview for template card silhouettes.
 */
export function generateTemplateSvgPreview(
  spec: LayoutTemplateSpec,
  width = 140,
  height = 70
): string {
  const canvasW = spec.canvas?.width || 400;
  const canvasH = spec.canvas?.height || 200;
  const scaleX = width / Math.max(1, canvasW);
  const scaleY = height / Math.max(1, canvasH);
  const isSpread = spec.canvas?.kind === 'spread';
  const spineX =
    isSpread && spec.canvas?.pageWidth
      ? (spec.canvas.pageWidth + (spec.canvas.gutterWidth || 0) / 2) * scaleX
      : -1;

  const rects = (spec.slots || [])
    .map((slot) => {
      const rx = (slot.x * scaleX).toFixed(1);
      const ry = (slot.y * scaleY).toFixed(1);
      const rw = Math.max(2, slot.width * scaleX).toFixed(1);
      const rh = Math.max(2, slot.height * scaleY).toFixed(1);
      return `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="2" fill="rgba(255, 255, 255, 0.12)" stroke="rgba(255, 255, 255, 0.35)" stroke-width="1"/>`;
    })
    .join('');

  const spine =
    spineX > 0
      ? `<line x1="${spineX.toFixed(1)}" y1="2" x2="${spineX.toFixed(1)}" y2="${height - 2}" stroke="rgba(255, 255, 255, 0.2)" stroke-dasharray="2 2" stroke-width="1"/>`
      : '';

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" rx="4" fill="#18181b"/>${spine}${rects}</svg>`;
}
