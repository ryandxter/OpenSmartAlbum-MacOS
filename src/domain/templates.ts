import { Unit, convertUnit } from './units';
import { Project } from './project';
import { Spread } from './album';
import type { PhotoFrameElement } from './editor';

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

export type TemplateCanvasKind = 'spread' | 'single' | 'carousel';

export interface TemplateSlot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex?: number;
  shapeType?: string;
  cornerRadius?: number | [number, number, number, number];
  type?: 'photo' | 'text' | 'graphic';
  text?: string;
  style?: any;
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
  id: string;
  name: string;
  folderId?: string | null;
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
