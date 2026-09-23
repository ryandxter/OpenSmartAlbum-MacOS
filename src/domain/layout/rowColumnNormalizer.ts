import { RectBounds } from '../templates';

export interface RowNormalizationOptions {
  container: RectBounds;
  photoAspects: number[]; // w_i / h_i (> 0)
  spacing: number;
  maxHeight?: number;
  verticalAlign?: 'top' | 'center' | 'bottom';
}

export interface ColumnNormalizationOptions {
  container: RectBounds;
  photoAspects: number[]; // w_j / h_j (> 0)
  spacing: number;
  maxWidth?: number;
  horizontalAlign?: 'left' | 'center' | 'right';
}

/**
 * Normalizes a list of photos into an equal-height justified row spanning container.width.
 * Applies cumulative discrete boundary snapping to guarantee 0px hairline gaps or rounding seams.
 */
export function normalizeEqualHeightRow(options: RowNormalizationOptions): RectBounds[] {
  const { container, photoAspects, spacing } = options;
  const k = photoAspects.length;
  if (k === 0) return [];

  // Usable horizontal width deducting total spacing between items
  const totalSpacing = (k - 1) * spacing;
  const usableWidth = Math.max(k, container.width - totalSpacing);

  // Sum of aspect ratios: S_r = sum(w_i / h_i)
  const safeAspects = photoAspects.map(a => (a > 0 && Number.isFinite(a) ? a : 1.5));
  const sumAspects = safeAspects.reduce((sum, a) => sum + a, 0);

  // Ideal row height: H_ideal = usableWidth / S_r
  const idealHeight = usableWidth / sumAspects;
  const maxHeight = options.maxHeight ?? container.height;
  const hRow = Math.min(idealHeight, maxHeight);

  // Calculate vertical alignment offset
  const verticalAlign = options.verticalAlign ?? 'center';
  let yStart = container.y;
  if (verticalAlign === 'center') {
    yStart = container.y + (container.height - hRow) / 2;
  } else if (verticalAlign === 'bottom') {
    yStart = container.y + (container.height - hRow);
  }

  // Cumulative discrete boundary snapping (Zero-Seam Guarantee)
  let runningAspectSum = 0;
  const edges: number[] = [container.x];

  for (let i = 0; i < k; i++) {
    const asp = safeAspects[i] ?? 1.5;
    runningAspectSum += asp;
    const edgeX = Math.round(container.x + (runningAspectSum / sumAspects) * usableWidth + i * spacing);
    edges.push(edgeX);
  }

  const rects: RectBounds[] = [];
  for (let i = 0; i < k; i++) {
    const baseEdge = edges[i] ?? container.x;
    const x = baseEdge + (i > 0 ? spacing : 0);
    const nextEdge = edges[i + 1] ?? (container.x + container.width);
    const width = nextEdge - x;

    rects.push({
      x,
      y: Math.round(yStart),
      width: Math.max(1, width),
      height: Math.max(1, Math.round(hRow)),
    });
  }

  return rects;
}

/**
 * Normalizes a list of photos into an equal-width justified column spanning container.height.
 * Applies cumulative discrete boundary snapping to guarantee 0px hairline gaps or rounding seams.
 */
export function normalizeEqualWidthColumn(options: ColumnNormalizationOptions): RectBounds[] {
  const { container, photoAspects, spacing } = options;
  const m = photoAspects.length;
  if (m === 0) return [];

  // Usable vertical height deducting total spacing between items
  const totalSpacing = (m - 1) * spacing;
  const usableHeight = Math.max(m, container.height - totalSpacing);

  // Sum of inverse aspect ratios: S_inv = sum(1 / (w_j / h_j)) = sum(h_j / w_j)
  const safeAspects = photoAspects.map(a => (a > 0 && Number.isFinite(a) ? a : 1.5));
  const sumInverseAspects = safeAspects.reduce((sum, a) => sum + 1 / a, 0);

  // Ideal column width: W_ideal = usableHeight / S_inv
  const idealWidth = usableHeight / sumInverseAspects;
  const maxWidth = options.maxWidth ?? container.width;
  const wCol = Math.min(idealWidth, maxWidth);

  // Calculate horizontal alignment offset
  const horizontalAlign = options.horizontalAlign ?? 'center';
  let xStart = container.x;
  if (horizontalAlign === 'center') {
    xStart = container.x + (container.width - wCol) / 2;
  } else if (horizontalAlign === 'right') {
    xStart = container.x + (container.width - wCol);
  }

  // Cumulative discrete boundary snapping (Zero-Seam Guarantee)
  let runningInvSum = 0;
  const edges: number[] = [container.y];

  for (let j = 0; j < m; j++) {
    const asp = safeAspects[j] ?? 1.5;
    runningInvSum += 1 / asp;
    const edgeY = Math.round(container.y + (runningInvSum / sumInverseAspects) * usableHeight + j * spacing);
    edges.push(edgeY);
  }

  const rects: RectBounds[] = [];
  for (let j = 0; j < m; j++) {
    const baseEdge = edges[j] ?? container.y;
    const y = baseEdge + (j > 0 ? spacing : 0);
    const nextEdge = edges[j + 1] ?? (container.y + container.height);
    const height = nextEdge - y;

    rects.push({
      x: Math.round(xStart),
      y,
      width: Math.max(1, Math.round(wCol)),
      height: Math.max(1, height),
    });
  }

  return rects;
}
