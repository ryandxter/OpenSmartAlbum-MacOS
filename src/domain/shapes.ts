/**
 * Vector Shape Presets & Clipping Mask Engine
 *
 * Implements geometric path generators for Canva/Photoshop-style frame clipping:
 * Rectangle, Rounded Rect, Circle, Oval, Hexagon, Octagon, Star, Scallop/Cloud, and Heart.
 */

export type ShapeType =
  | 'rectangle'
  | 'rounded'
  | 'circle'
  | 'oval'
  | 'hexagon'
  | 'octagon'
  | 'star'
  | 'scallop'
  | 'heart'
  | 'custom_svg';

export interface ShapePresetInfo {
  id: ShapeType;
  label: string;
  category: 'basic' | 'polygon' | 'decorative';
}

export const SHAPE_PRESETS: ShapePresetInfo[] = [
  { id: 'rectangle', label: 'Rectangle', category: 'basic' },
  { id: 'rounded', label: 'Rounded Rect', category: 'basic' },
  { id: 'circle', label: 'Circle', category: 'basic' },
  { id: 'oval', label: 'Oval', category: 'basic' },
  { id: 'hexagon', label: 'Hexagon', category: 'polygon' },
  { id: 'octagon', label: 'Octagon', category: 'polygon' },
  { id: 'star', label: 'Star', category: 'decorative' },
  { id: 'scallop', label: 'Scallop / Cloud', category: 'decorative' },
  { id: 'heart', label: 'Heart', category: 'decorative' },
];

/**
 * Generates an SVG path string for a regular polygon (Hexagon: 6, Octagon: 8).
 */
export function createPolygonSvgPath(sides: number, width: number, height: number): string {
  const rx = width / 2;
  const ry = height / 2;
  const cx = rx;
  const cy = ry;

  let path = '';
  // Start from top vertex (-Math.PI / 2)
  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
    const x = cx + rx * Math.cos(angle);
    const y = cy + ry * Math.sin(angle);
    if (i === 0) {
      path += `M ${x.toFixed(2)} ${y.toFixed(2)}`;
    } else {
      path += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
  }
  path += ' Z';
  return path;
}

/**
 * Generates an SVG path string for a star shape (default: 5 points).
 */
export function createStarSvgPath(points: number = 5, width: number, height: number, innerRatio: number = 0.45): string {
  const rx = width / 2;
  const ry = height / 2;
  const cx = rx;
  const cy = ry;

  let path = '';
  const totalSteps = points * 2;
  for (let i = 0; i < totalSteps; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const isInner = i % 2 !== 0;
    const currentRx = isInner ? rx * innerRatio : rx;
    const currentRy = isInner ? ry * innerRatio : ry;
    const x = cx + currentRx * Math.cos(angle);
    const y = cy + currentRy * Math.sin(angle);
    if (i === 0) {
      path += `M ${x.toFixed(2)} ${y.toFixed(2)}`;
    } else {
      path += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
  }
  path += ' Z';
  return path;
}

/**
 * Generates an SVG path string for a smooth heart shape.
 */
export function createHeartSvgPath(width: number, height: number): string {
  const w = width;
  const h = height;

  // Symmetrical heart using two cubic beziers
  return `M ${(w * 0.5).toFixed(2)} ${(h * 0.82).toFixed(2)}
    C ${(w * 0.15).toFixed(2)} ${(h * 0.55).toFixed(2)} 0 ${(h * 0.28).toFixed(2)} ${(w * 0.25).toFixed(2)} ${(h * 0.12).toFixed(2)}
    C ${(w * 0.42).toFixed(2)} ${(h * 0.02).toFixed(2)} ${(w * 0.5).toFixed(2)} ${(h * 0.25).toFixed(2)} ${(w * 0.5).toFixed(2)} ${(h * 0.25).toFixed(2)}
    C ${(w * 0.5).toFixed(2)} ${(h * 0.25).toFixed(2)} ${(w * 0.58).toFixed(2)} ${(h * 0.02).toFixed(2)} ${(w * 0.75).toFixed(2)} ${(h * 0.12).toFixed(2)}
    C ${w.toFixed(2)} ${(h * 0.28).toFixed(2)} ${(w * 0.85).toFixed(2)} ${(h * 0.55).toFixed(2)} ${(w * 0.5).toFixed(2)} ${(h * 0.82).toFixed(2)} Z`;
}

/**
 * Generates a decorative fluted scallop / cloud contour.
 */
export function createScallopSvgPath(width: number, height: number, scallopsCount: number = 8): string {
  const rx = width / 2;
  const ry = height / 2;
  const cx = rx;
  const cy = ry;

  let path = '';
  const steps = Math.max(6, scallopsCount);
  const stepAngle = (2 * Math.PI) / steps;

  for (let i = 0; i < steps; i++) {
    const a1 = i * stepAngle - Math.PI / 2;
    const a2 = (i + 1) * stepAngle - Math.PI / 2;
    const midAngle = (a1 + a2) / 2;

    const x1 = cx + rx * Math.cos(a1);
    const y1 = cy + ry * Math.sin(a1);

    const x2 = cx + rx * Math.cos(a2);
    const y2 = cy + ry * Math.sin(a2);

    // Control point bulges outward
    const bulge = 1.15;
    const cpX = cx + rx * bulge * Math.cos(midAngle);
    const cpY = cy + ry * bulge * Math.sin(midAngle);

    if (i === 0) {
      path += `M ${x1.toFixed(2)} ${y1.toFixed(2)}`;
    }
    path += ` Q ${cpX.toFixed(2)} ${cpY.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }
  path += ' Z';
  return path;
}

/**
 * Returns the SVG path data for any supported ShapeType scaled to dimensions (w, h).
 */
export function getShapeSvgPath(
  shapeType: ShapeType = 'rectangle',
  width: number,
  height: number,
  radii: [number, number, number, number] = [0, 0, 0, 0],
  customSvgPath?: string
): string {
  const w = Math.max(1, width);
  const h = Math.max(1, height);

  switch (shapeType) {
    case 'circle': {
      const r = Math.min(w, h) / 2;
      const cx = w / 2;
      const cy = h / 2;
      return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
    }
    case 'oval': {
      const rx = w / 2;
      const ry = h / 2;
      return `M 0 ${ry} A ${rx} ${ry} 0 1 0 ${w} ${ry} A ${rx} ${ry} 0 1 0 0 ${ry} Z`;
    }
    case 'hexagon':
      return createPolygonSvgPath(6, w, h);
    case 'octagon':
      return createPolygonSvgPath(8, w, h);
    case 'star':
      return createStarSvgPath(5, w, h, 0.45);
    case 'scallop':
      return createScallopSvgPath(w, h, 10);
    case 'heart':
      return createHeartSvgPath(w, h);
    case 'custom_svg':
      if (customSvgPath && customSvgPath.trim().length > 0) {
        return customSvgPath;
      }
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
    case 'rounded': {
      const [tl, tr, br, bl] = radii;
      // Per-corner rounded rect SVG path
      return `M ${tl} 0
        L ${w - tr} 0 Q ${w} 0 ${w} ${tr}
        L ${w} ${h - br} Q ${w} ${h} ${w - br} ${h}
        L ${bl} ${h} Q 0 ${h} 0 ${h - bl}
        L 0 ${tl} Q 0 0 ${tl} 0 Z`;
    }
    case 'rectangle':
    default:
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
  }
}

/**
 * Draws the shape path directly onto a Canvas2D or Konva rendering context.
 * Traces the closed subpath so Konva's clipFunc or canvas stroke/fill can consume it.
 */
export function drawShapeToContext(
  ctx: any,
  shapeType: ShapeType = 'rectangle',
  width: number,
  height: number,
  radii: [number, number, number, number] = [0, 0, 0, 0],
  customSvgPath?: string
): void {
  const c = ctx._context || ctx;
  const pathData = getShapeSvgPath(shapeType, width, height, radii, customSvgPath);

  if (typeof Path2D !== 'undefined' && typeof c.fill === 'function' && typeof Path2D.prototype === 'object') {
    try {
      // If Path2D is supported and we can use it with ctx.clip(path) in canvas context
      if (typeof c.clip === 'function') {
        const p = new Path2D(pathData);
        c.clip(p);
        return;
      }
    } catch {
      // fallback to manual trace
    }
  }

  // Native geometric path trace
  c.beginPath();
  if (shapeType === 'circle' || shapeType === 'oval') {
    const rx = width / 2;
    const ry = height / 2;
    if (typeof c.ellipse === 'function') {
      c.ellipse(rx, ry, rx, ry, 0, 0, Math.PI * 2);
    } else {
      c.arc(rx, ry, Math.min(rx, ry), 0, Math.PI * 2);
    }
  } else if (shapeType === 'rounded') {
    const [tl, tr, br, bl] = radii;
    if (typeof c.roundRect === 'function') {
      c.roundRect(0, 0, width, height, radii);
    } else {
      c.moveTo(tl, 0);
      c.lineTo(width - tr, 0);
      c.arcTo(width, 0, width, tr, tr);
      c.lineTo(width, height - br);
      c.arcTo(width, height, width - br, height, br);
      c.lineTo(bl, height);
      c.arcTo(0, height, 0, height - bl, bl);
      c.lineTo(0, tl);
      c.arcTo(0, 0, tl, 0, tl);
    }
  } else if (shapeType === 'hexagon' || shapeType === 'octagon') {
    const sides = shapeType === 'hexagon' ? 6 : 8;
    const rx = width / 2;
    const ry = height / 2;
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
      const x = rx + rx * Math.cos(angle);
      const y = ry + ry * Math.sin(angle);
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
  } else {
    c.rect(0, 0, width, height);
  }
  c.closePath();
}
