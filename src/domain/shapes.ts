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

export interface Vertex2D {
  x: number;
  y: number;
}

/**
 * Rounds the vertices of a 2D polygon using circular arc tangent fillets.
 * Dynamically clamps tangent distance to at most half the length of the shortest adjacent edge,
 * preventing self-intersection, arc overlapping, or shape inversion.
 *
 * @param vertices Ordered array of 2D vertices defining the polygon contour
 * @param radii Uniform fillet radius number, or array of per-vertex radii
 * @param closed Whether the polygon contour is closed (default: true)
 */
export function roundPolygonVertices(
  vertices: Vertex2D[],
  radii: number | number[] = 0,
  closed: boolean = true
): string {
  const n = vertices.length;
  if (n < 3) return '';

  const getRadius = (idx: number): number => {
    if (Array.isArray(radii)) {
      return radii[idx] !== undefined ? Math.max(0, radii[idx]) : 0;
    }
    return Math.max(0, radii);
  };

  // Check if any radius is > 0
  let hasRounding = false;
  for (let i = 0; i < n; i++) {
    if (getRadius(i) > 0.01) {
      hasRounding = true;
      break;
    }
  }

  const v0 = vertices[0];
  if (!v0) return '';

  // Fast path: sharp polygon if no corner radius
  if (!hasRounding) {
    let p = `M ${v0.x.toFixed(2)} ${v0.y.toFixed(2)}`;
    for (let i = 1; i < n; i++) {
      const v = vertices[i];
      if (v) {
        p += ` L ${v.x.toFixed(2)} ${v.y.toFixed(2)}`;
      }
    }
    if (closed) p += ' Z';
    return p;
  }

  // Precompute tangent points and arcs for each vertex
  interface VertexFillet {
    tIn: Vertex2D;
    tOut: Vertex2D;
    rEff: number;
    sweep: number;
    isRounded: boolean;
  }

  const fillets: VertexFillet[] = [];

  for (let i = 0; i < n; i++) {
    const vi = vertices[i];
    const prev = vertices[(i - 1 + n) % n];
    const next = vertices[(i + 1) % n];
    if (!vi || !prev || !next) continue;

    const ux = prev.x - vi.x;
    const uy = prev.y - vi.y;
    const lIn = Math.hypot(ux, uy);

    const vx = next.x - vi.x;
    const vy = next.y - vi.y;
    const lOut = Math.hypot(vx, vy);

    const r = getRadius(i);

    if (lIn < 1e-4 || lOut < 1e-4 || r <= 0.01) {
      fillets.push({ tIn: vi, tOut: vi, rEff: 0, sweep: 1, isRounded: false });
      continue;
    }

    const uHatX = ux / lIn;
    const uHatY = uy / lIn;
    const vHatX = vx / lOut;
    const vHatY = vy / lOut;

    const dot = Math.max(-1, Math.min(1, uHatX * vHatX + uHatY * vHatY));
    const theta = Math.acos(dot);

    if (theta < 1e-3 || theta > Math.PI - 1e-3) {
      fillets.push({ tIn: vi, tOut: vi, rEff: 0, sweep: 1, isRounded: false });
      continue;
    }

    const tanHalf = Math.tan(theta / 2);
    if (tanHalf < 1e-4) {
      fillets.push({ tIn: vi, tOut: vi, rEff: 0, sweep: 1, isRounded: false });
      continue;
    }

    const t = r / tanHalf;
    const dMax = Math.min(lIn, lOut) / 2;
    const d = Math.min(dMax, t);
    const rEff = d * tanHalf;

    const tIn = { x: vi.x + d * uHatX, y: vi.y + d * uHatY };
    const tOut = { x: vi.x + d * vHatX, y: vi.y + d * vHatY };

    // 2D Cross product of e1 = vi - prev = -u and e2 = next - vi = v
    // e1x = -ux, e1y = -uy; e2x = vx, e2y = vy
    const cp = -ux * vy - (-uy * vx);
    const sweep = cp > 0 ? 1 : 0;

    fillets.push({ tIn, tOut, rEff, sweep, isRounded: true });
  }

  // Construct SVG path starting from tOut of vertex 0
  const first = fillets[0];
  if (!first) return '';

  let path = '';
  if (first.isRounded) {
    path += `M ${first.tOut.x.toFixed(2)} ${first.tOut.y.toFixed(2)}`;
  } else {
    path += `M ${v0.x.toFixed(2)} ${v0.y.toFixed(2)}`;
  }

  for (let i = 1; i < n; i++) {
    const f = fillets[i];
    const v = vertices[i];
    if (!f || !v) continue;

    if (f.isRounded) {
      path += ` L ${f.tIn.x.toFixed(2)} ${f.tIn.y.toFixed(2)}`;
      path += ` A ${f.rEff.toFixed(2)} ${f.rEff.toFixed(2)} 0 0 ${f.sweep} ${f.tOut.x.toFixed(2)} ${f.tOut.y.toFixed(2)}`;
    } else {
      path += ` L ${v.x.toFixed(2)} ${v.y.toFixed(2)}`;
    }
  }

  if (first.isRounded) {
    // If the first vertex was rounded, close arc to its tOut
    path += ` L ${first.tIn.x.toFixed(2)} ${first.tIn.y.toFixed(2)}`;
    path += ` A ${first.rEff.toFixed(2)} ${first.rEff.toFixed(2)} 0 0 ${first.sweep} ${first.tOut.x.toFixed(2)} ${first.tOut.y.toFixed(2)}`;
  } else if (closed) {
    path += ` L ${v0.x.toFixed(2)} ${v0.y.toFixed(2)}`;
  }

  if (closed) path += ' Z';
  return path;
}

/**
 * Generates an SVG path string for a regular polygon (Hexagon: 6, Octagon: 8) with optional corner fillet.
 * Option A (Geometric 1:1 Centered): Scales within min(width, height) and centers in bounding box.
 */
export function createPolygonSvgPath(
  sides: number,
  width: number,
  height: number,
  radius: number = 0
): string {
  const size = Math.min(width, height);
  const rx = size / 2;
  const ry = size / 2;
  const cx = width / 2;
  const cy = height / 2;

  const vertices: Vertex2D[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
    vertices.push({
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    });
  }

  return roundPolygonVertices(vertices, radius, true);
}

/**
 * Generates an SVG path string for a star shape with independent tip and valley corner fillets.
 * Option A (Geometric 1:1 Centered): Scales within min(width, height) and centers in bounding box.
 */
export function createStarSvgPath(
  points: number = 5,
  width: number,
  height: number,
  innerRatio: number = 0.45,
  tipRadius: number = 0,
  valleyRadius: number = 0
): string {
  const size = Math.min(width, height);
  const rx = size / 2;
  const ry = size / 2;
  const cx = width / 2;
  const cy = height / 2;

  const totalSteps = points * 2;
  const vertices: Vertex2D[] = [];
  const radii: number[] = [];

  for (let i = 0; i < totalSteps; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const isInner = i % 2 !== 0;
    const currentRx = isInner ? rx * innerRatio : rx;
    const currentRy = isInner ? ry * innerRatio : ry;
    vertices.push({
      x: cx + currentRx * Math.cos(angle),
      y: cy + currentRy * Math.sin(angle),
    });
    radii.push(isInner ? valleyRadius : tipRadius);
  }

  return roundPolygonVertices(vertices, radii, true);
}

/**
 * Generates an SVG path string for an analytical Oval / Ellipse fitting (width, height).
 */
export function createOvalSvgPath(width: number, height: number): string {
  const rx = width / 2;
  const ry = height / 2;
  return `M 0 ${ry.toFixed(2)} A ${rx.toFixed(2)} ${ry.toFixed(2)} 0 1 0 ${width.toFixed(2)} ${ry.toFixed(2)} A ${rx.toFixed(2)} ${ry.toFixed(2)} 0 1 0 0 ${ry.toFixed(2)} Z`;
}

// Aliases for functional parity and SVG generation pipelines
export const generatePolygonPath = createPolygonSvgPath;
export const generateHexagonPath = (w: number, h: number, r: number = 0) => createPolygonSvgPath(6, w, h, r);
export const generateOctagonPath = (w: number, h: number, r: number = 0) => createPolygonSvgPath(8, w, h, r);
export const generateStarPath = createStarSvgPath;
export const generateScallopPath = createScallopSvgPath;
export const generateHeartPath = createHeartSvgPath;
export const generateOvalPath = createOvalSvgPath;

/**
 * Generates an SVG path string for a smooth heart shape.
 * Option A (Geometric 1:1 Centered): Scales within min(width, height) and centers in bounding box.
 */
export function createHeartSvgPath(width: number, height: number): string {
  const size = Math.min(width, height);
  const offsetX = (width - size) / 2;
  const offsetY = (height - size) / 2;
  const sx = (factor: number) => (offsetX + size * factor).toFixed(2);
  const sy = (factor: number) => (offsetY + size * factor).toFixed(2);

  // Symmetrical heart using two cubic beziers scaled and 1:1 centered
  return `M ${sx(0.5)} ${sy(0.82)}
    C ${sx(0.15)} ${sy(0.55)} ${sx(0)} ${sy(0.28)} ${sx(0.25)} ${sy(0.12)}
    C ${sx(0.42)} ${sy(0.02)} ${sx(0.5)} ${sy(0.25)} ${sx(0.5)} ${sy(0.25)}
    C ${sx(0.5)} ${sy(0.25)} ${sx(0.58)} ${sy(0.02)} ${sx(0.75)} ${sy(0.12)}
    C ${sx(1.0)} ${sy(0.28)} ${sx(0.85)} ${sy(0.55)} ${sx(0.5)} ${sy(0.82)} Z`;
}

/**
 * Generates a decorative fluted scallop / cloud contour.
 * Option A (Geometric 1:1 Centered): Scales within min(width, height) and centers in bounding box.
 */
export function createScallopSvgPath(width: number, height: number, scallopsCount: number = 8): string {
  const size = Math.min(width, height);
  const bulge = 1.15;
  const rx = (size / 2) / bulge;
  const ry = (size / 2) / bulge;
  const cx = width / 2;
  const cy = height / 2;

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
    case 'oval':
      return createOvalSvgPath(w, h);
    case 'hexagon':
      return createPolygonSvgPath(6, w, h, radii[0] ?? 0);
    case 'octagon':
      return createPolygonSvgPath(8, w, h, radii[0] ?? 0);
    case 'star':
      return createStarSvgPath(5, w, h, 0.45, radii[0] ?? 0, radii[1] ?? 0);
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
 * Endpoint-to-center SVG arc converter to cubic bezier curves on a 2D canvas context.
 * Complies with W3C SVG 1.1 Appendix F.6.
 */
function traceSvgArc(
  ctx: any,
  x0: number,
  y0: number,
  rx: number,
  ry: number,
  angleDeg: number,
  largeArcFlag: number,
  sweepFlag: number,
  x1: number,
  y1: number
): void {
  if (x0 === x1 && y0 === y1) return;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  if (rx === 0 || ry === 0) {
    ctx.lineTo(x1, y1);
    return;
  }

  const phi = (angleDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // Step 1: Compute (x1', y1')
  const dx = (x0 - x1) / 2;
  const dy = (y0 - y1) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  // Correct radii if necessary
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const sqrtLambda = Math.sqrt(lambda);
    rx *= sqrtLambda;
    ry *= sqrtLambda;
  }

  // Step 2: Compute (cx', cy')
  const rxSq = rx * rx;
  const rySq = ry * ry;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;

  let rad = (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) / (rxSq * y1pSq + rySq * x1pSq);
  if (rad < 0) rad = 0;
  const sq = (largeArcFlag !== sweepFlag ? 1 : -1) * Math.sqrt(rad);
  const cxp = sq * ((rx * y1p) / ry);
  const cyp = sq * (-(ry * x1p) / rx);

  // Step 3: Compute (cx, cy) from (cx', cy')
  const cx = cosPhi * cxp - sinPhi * cyp + (x0 + x1) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y0 + y1) / 2;

  // Step 4: Compute theta1 and deltaTheta
  const v1x = (x1p - cxp) / rx;
  const v1y = (y1p - cyp) / ry;
  const v2x = (-x1p - cxp) / rx;
  const v2y = (-y1p - cyp) / ry;

  const angleBetween = (ux: number, uy: number, vx: number, vy: number) => {
    const sign = ux * vy - uy * vx < 0 ? -1 : 1;
    const dot = ux * vx + uy * vy;
    const uLen = Math.hypot(ux, uy);
    const vLen = Math.hypot(vx, vy);
    let cosVal = dot / (uLen * vLen);
    if (cosVal < -1) cosVal = -1;
    if (cosVal > 1) cosVal = 1;
    return sign * Math.acos(cosVal);
  };

  const theta1 = angleBetween(1, 0, v1x, v1y);
  let deltaTheta = angleBetween(v1x, v1y, v2x, v2y);

  if (!sweepFlag && deltaTheta > 0) {
    deltaTheta -= 2 * Math.PI;
  } else if (sweepFlag && deltaTheta < 0) {
    deltaTheta += 2 * Math.PI;
  }

  // Decompose arc into cubic beziers (<= Math.PI / 2 per segment)
  const segments = Math.max(1, Math.ceil(Math.abs(deltaTheta) / (Math.PI / 2)));
  const segDelta = deltaTheta / segments;

  for (let i = 0; i < segments; i++) {
    const startAngle = theta1 + i * segDelta;
    const endAngle = startAngle + segDelta;
    const halfDelta = segDelta / 2;
    const alpha = (Math.sin(segDelta) * (Math.sqrt(4 + 3 * Math.tan(halfDelta) * Math.tan(halfDelta)) - 1)) / 3;

    const cosStart = Math.cos(startAngle);
    const sinStart = Math.sin(startAngle);
    const cosEnd = Math.cos(endAngle);
    const sinEnd = Math.sin(endAngle);

    const p1x = cosStart - alpha * sinStart;
    const p1y = sinStart + alpha * cosStart;
    const p2x = cosEnd + alpha * sinEnd;
    const p2y = sinEnd - alpha * cosEnd;

    const mapPt = (px: number, py: number) => {
      const sx = px * rx;
      const sy = py * ry;
      return {
        x: cosPhi * sx - sinPhi * sy + cx,
        y: sinPhi * sx + cosPhi * sy + cy,
      };
    };

    const cp1 = mapPt(p1x, p1y);
    const cp2 = mapPt(p2x, p2y);
    const ep = mapPt(cosEnd, sinEnd);

    ctx.bezierCurveTo(
      cp1.x,
      cp1.y,
      cp2.x,
      cp2.y,
      i === segments - 1 ? x1 : ep.x,
      i === segments - 1 ? y1 : ep.y
    );
  }
}

/**
 * Directly tokenizes and parses standard SVG path `d` strings and invokes matching Canvas 2D
 * path methods on `ctx` (M, L, H, V, C, S, Q, T, A, Z) without calling `clip()`.
 */
export function traceSvgPathToContext(ctx: any, pathData: string): void {
  if (!pathData || typeof pathData !== 'string') return;

  // Regex tokenizes SVG command characters and numbers (including decimals, negatives, and exponents)
  const tokenRegex = /([achlmqstvz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)/gi;
  const tokens = pathData.match(tokenRegex);
  if (!tokens || tokens.length === 0) return;

  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;
  let prevCpX: number | null = null;
  let prevCpY: number | null = null;
  let prevCmd = '';

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (!token) {
      i++;
      continue;
    }

    // Check if token is a command character
    const isCmd = /^[achlmqstvz]$/i.test(token);
    let cmd = isCmd ? token : prevCmd;
    if (isCmd) {
      i++;
    } else {
      // Repeat command with coordinates: M becomes L, m becomes l
      if (prevCmd === 'M') cmd = 'L';
      else if (prevCmd === 'm') cmd = 'l';
    }

    const nextNumber = (): number => {
      if (i >= tokens.length) return 0;
      const val = parseFloat(tokens[i]!);
      i++;
      return isNaN(val) ? 0 : val;
    };

    switch (cmd) {
      case 'M': {
        const x = nextNumber();
        const y = nextNumber();
        currentX = x;
        currentY = y;
        startX = x;
        startY = y;
        ctx.moveTo(x, y);
        prevCpX = null;
        prevCpY = null;
        prevCmd = 'M';
        break;
      }
      case 'm': {
        const dx = nextNumber();
        const dy = nextNumber();
        currentX += dx;
        currentY += dy;
        startX = currentX;
        startY = currentY;
        ctx.moveTo(currentX, currentY);
        prevCpX = null;
        prevCpY = null;
        prevCmd = 'm';
        break;
      }
      case 'L': {
        const x = nextNumber();
        const y = nextNumber();
        currentX = x;
        currentY = y;
        ctx.lineTo(x, y);
        prevCpX = null;
        prevCpY = null;
        prevCmd = 'L';
        break;
      }
      case 'l': {
        const dx = nextNumber();
        const dy = nextNumber();
        currentX += dx;
        currentY += dy;
        ctx.lineTo(currentX, currentY);
        prevCpX = null;
        prevCpY = null;
        prevCmd = 'l';
        break;
      }
      case 'H': {
        const x = nextNumber();
        currentX = x;
        ctx.lineTo(currentX, currentY);
        prevCpX = null;
        prevCpY = null;
        prevCmd = 'H';
        break;
      }
      case 'h': {
        const dx = nextNumber();
        currentX += dx;
        ctx.lineTo(currentX, currentY);
        prevCpX = null;
        prevCpY = null;
        prevCmd = 'h';
        break;
      }
      case 'V': {
        const y = nextNumber();
        currentY = y;
        ctx.lineTo(currentX, currentY);
        prevCpX = null;
        prevCpY = null;
        prevCmd = 'V';
        break;
      }
      case 'v': {
        const dy = nextNumber();
        currentY += dy;
        ctx.lineTo(currentX, currentY);
        prevCpX = null;
        prevCpY = null;
        prevCmd = 'v';
        break;
      }
      case 'C': {
        const cp1x = nextNumber();
        const cp1y = nextNumber();
        const cp2x = nextNumber();
        const cp2y = nextNumber();
        const x = nextNumber();
        const y = nextNumber();
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
        prevCpX = cp2x;
        prevCpY = cp2y;
        currentX = x;
        currentY = y;
        prevCmd = 'C';
        break;
      }
      case 'c': {
        const cp1x = currentX + nextNumber();
        const cp1y = currentY + nextNumber();
        const cp2x = currentX + nextNumber();
        const cp2y = currentY + nextNumber();
        const x = currentX + nextNumber();
        const y = currentY + nextNumber();
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
        prevCpX = cp2x;
        prevCpY = cp2y;
        currentX = x;
        currentY = y;
        prevCmd = 'c';
        break;
      }
      case 'S': {
        let cp1x = currentX;
        let cp1y = currentY;
        if ((prevCmd === 'C' || prevCmd === 'c' || prevCmd === 'S' || prevCmd === 's') && prevCpX !== null && prevCpY !== null) {
          cp1x = 2 * currentX - prevCpX;
          cp1y = 2 * currentY - prevCpY;
        }
        const cp2x = nextNumber();
        const cp2y = nextNumber();
        const x = nextNumber();
        const y = nextNumber();
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
        prevCpX = cp2x;
        prevCpY = cp2y;
        currentX = x;
        currentY = y;
        prevCmd = 'S';
        break;
      }
      case 's': {
        let cp1x = currentX;
        let cp1y = currentY;
        if ((prevCmd === 'C' || prevCmd === 'c' || prevCmd === 'S' || prevCmd === 's') && prevCpX !== null && prevCpY !== null) {
          cp1x = 2 * currentX - prevCpX;
          cp1y = 2 * currentY - prevCpY;
        }
        const cp2x = currentX + nextNumber();
        const cp2y = currentY + nextNumber();
        const x = currentX + nextNumber();
        const y = currentY + nextNumber();
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
        prevCpX = cp2x;
        prevCpY = cp2y;
        currentX = x;
        currentY = y;
        prevCmd = 's';
        break;
      }
      case 'Q': {
        const cpx = nextNumber();
        const cpy = nextNumber();
        const x = nextNumber();
        const y = nextNumber();
        ctx.quadraticCurveTo(cpx, cpy, x, y);
        prevCpX = cpx;
        prevCpY = cpy;
        currentX = x;
        currentY = y;
        prevCmd = 'Q';
        break;
      }
      case 'q': {
        const cpx = currentX + nextNumber();
        const cpy = currentY + nextNumber();
        const x = currentX + nextNumber();
        const y = currentY + nextNumber();
        ctx.quadraticCurveTo(cpx, cpy, x, y);
        prevCpX = cpx;
        prevCpY = cpy;
        currentX = x;
        currentY = y;
        prevCmd = 'q';
        break;
      }
      case 'T': {
        let cpx = currentX;
        let cpy = currentY;
        if ((prevCmd === 'Q' || prevCmd === 'q' || prevCmd === 'T' || prevCmd === 't') && prevCpX !== null && prevCpY !== null) {
          cpx = 2 * currentX - prevCpX;
          cpy = 2 * currentY - prevCpY;
        }
        const x = nextNumber();
        const y = nextNumber();
        ctx.quadraticCurveTo(cpx, cpy, x, y);
        prevCpX = cpx;
        prevCpY = cpy;
        currentX = x;
        currentY = y;
        prevCmd = 'T';
        break;
      }
      case 't': {
        let cpx = currentX;
        let cpy = currentY;
        if ((prevCmd === 'Q' || prevCmd === 'q' || prevCmd === 'T' || prevCmd === 't') && prevCpX !== null && prevCpY !== null) {
          cpx = 2 * currentX - prevCpX;
          cpy = 2 * currentY - prevCpY;
        }
        const x = currentX + nextNumber();
        const y = currentY + nextNumber();
        ctx.quadraticCurveTo(cpx, cpy, x, y);
        prevCpX = cpx;
        prevCpY = cpy;
        currentX = x;
        currentY = y;
        prevCmd = 't';
        break;
      }
      case 'A': {
        const rx = nextNumber();
        const ry = nextNumber();
        const angle = nextNumber();
        const largeArc = nextNumber();
        const sweep = nextNumber();
        const x = nextNumber();
        const y = nextNumber();
        traceSvgArc(ctx, currentX, currentY, rx, ry, angle, largeArc, sweep, x, y);
        currentX = x;
        currentY = y;
        prevCpX = null;
        prevCpY = null;
        prevCmd = 'A';
        break;
      }
      case 'a': {
        const rx = nextNumber();
        const ry = nextNumber();
        const angle = nextNumber();
        const largeArc = nextNumber();
        const sweep = nextNumber();
        const x = currentX + nextNumber();
        const y = currentY + nextNumber();
        traceSvgArc(ctx, currentX, currentY, rx, ry, angle, largeArc, sweep, x, y);
        currentX = x;
        currentY = y;
        prevCpX = null;
        prevCpY = null;
        prevCmd = 'a';
        break;
      }
      case 'Z':
      case 'z': {
        ctx.closePath();
        currentX = startX;
        currentY = startY;
        prevCpX = null;
        prevCpY = null;
        prevCmd = 'Z';
        break;
      }
      default:
        // Ignore unhandled tokens
        break;
    }
  }
}

/**
 * Draws the shape path directly onto a Canvas2D or Konva rendering context.
 * Traces the closed subpath directly on `ctx` without calling `c.clip()` so Konva's
 * outer `clipFunc` wrapper can execute cleanly.
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
  const w = Math.max(1, width);
  const h = Math.max(1, height);

  // Native geometric path trace without premature clipping
  c.beginPath();

  if (shapeType === 'circle') {
    const size = Math.min(w, h);
    const r = size / 2;
    const cx = w / 2;
    const cy = h / 2;
    if (typeof c.ellipse === 'function') {
      c.ellipse(cx, cy, r, r, 0, 0, Math.PI * 2);
    } else {
      c.arc(cx, cy, r, 0, Math.PI * 2);
    }
  } else if (shapeType === 'oval') {
    const rx = w / 2;
    const ry = h / 2;
    if (typeof c.ellipse === 'function') {
      c.ellipse(rx, ry, rx, ry, 0, 0, Math.PI * 2);
    } else {
      const pathData = getShapeSvgPath('oval', w, h);
      traceSvgPathToContext(c, pathData);
    }
  } else if (shapeType === 'rounded') {
    const [tl, tr, br, bl] = radii;
    if (typeof c.roundRect === 'function') {
      c.roundRect(0, 0, w, h, radii);
    } else {
      c.moveTo(tl, 0);
      c.lineTo(w - tr, 0);
      c.arcTo(w, 0, w, tr, tr);
      c.lineTo(w, h - br);
      c.arcTo(w, h, w - br, h, br);
      c.lineTo(bl, h);
      c.arcTo(0, h, 0, h - bl, bl);
      c.lineTo(0, tl);
      c.arcTo(0, 0, tl, 0, tl);
    }
  } else if (
    shapeType === 'hexagon' ||
    shapeType === 'octagon' ||
    shapeType === 'star' ||
    shapeType === 'heart' ||
    shapeType === 'scallop' ||
    shapeType === 'custom_svg'
  ) {
    const pathData = getShapeSvgPath(shapeType, w, h, radii, customSvgPath);
    traceSvgPathToContext(c, pathData);
  } else {
    // Standard rectangle
    c.rect(0, 0, w, h);
  }

  c.closePath();
}
