/**
 * Image Filters & Deterministic Film-Grain Pipeline (FX-01, FX-03, D-01)
 *
 * Implements:
 * 1. FNV-1a seed hashing (hashSeed)
 * 2. Deterministic 32-bit PRNG (mulberry32)
 * 3. Seeded procedural film-grain noise canvas tile generation
 * 4. Real-time offscreen canvas filter pipeline (Grayscale -> Noise -> Blur)
 * 5. LRU cache for 60fps interaction responsiveness
 */

export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const grainTileCache = new Map<number, HTMLCanvasElement>();

/**
 * Creates a tileable monochrome film-grain noise canvas using Mulberry32 PRNG.
 */
export function createNoisePatternCanvas(
  seed: number,
  amount: number = 100,
  width: number = 256,
  height: number = 256
): HTMLCanvasElement {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : ({} as HTMLCanvasElement);
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  if (typeof canvas.getContext !== 'function') {
    return canvas;
  }
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const imgData = ctx.createImageData(canvas.width, canvas.height);
    const data = imgData.data;
    const rand = mulberry32(seed);
    const normalizedAmount = amount > 1 ? Math.min(1, amount / 100) : Math.max(0, amount);
    for (let i = 0; i < data.length; i += 4) {
      const raw = Math.floor(rand() * 256);
      const val = Math.floor(128 + (raw - 128) * normalizedAmount);
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
      data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
  }
  return canvas;
}

/**
 * Retrieves a cached 256x256 monochrome film-grain tile for a given seed key.
 */
export function getSeededGrainTile(seedKey: string | number, tileSize = 256): HTMLCanvasElement {
  const seed = typeof seedKey === 'number' ? seedKey : hashSeed(seedKey);
  const cached = grainTileCache.get(seed);
  if (cached && cached.width === tileSize && cached.height === tileSize) {
    return cached;
  }
  const canvas = createNoisePatternCanvas(seed, 100, tileSize, tileSize);
  if (grainTileCache.size > 64) {
    const firstKey = grainTileCache.keys().next().value;
    if (firstKey !== undefined) grainTileCache.delete(firstKey);
  }
  grainTileCache.set(seed, canvas);
  return canvas;
}

export interface PhotoFilterOptions {
  grayscale?: number; // 0..100 (%)
  noise?: number;     // 0..100 (%)
  blur?: number;      // >= 0 (px)
  seed?: string;
  targetCanvas?: HTMLCanvasElement;
}

interface CacheEntry {
  key: string;
  canvas: HTMLCanvasElement;
}

const FILTER_CACHE_MAX_SIZE = 40;
const filterCanvasCache: CacheEntry[] = [];
let nextCanvasId = 1;
const canvasIdMap = new WeakMap<HTMLCanvasElement, number>();

function getSourceId(source: HTMLImageElement | HTMLCanvasElement): string {
  if ('src' in source && typeof source.src === 'string' && source.src) {
    return source.src;
  }
  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
    let id = canvasIdMap.get(source);
    if (!id) {
      id = nextCanvasId++;
      canvasIdMap.set(source, id);
    }
    return `canvas_${id}`;
  }
  return 'source_img';
}

export function clearImageFilterCache(): void {
  filterCanvasCache.length = 0;
  grainTileCache.clear();
}

/**
 * Applies real-time visual filter pipeline in strict order (D-01):
 * Grayscale (0-100%) -> Deterministic Film-Grain Noise (0-100%) -> Gaussian Blur (0-maxBlur px)
 */
export function renderFilteredPhotoToCanvas(
  sourceImg: HTMLImageElement | HTMLCanvasElement,
  width: number,
  height: number,
  opts: PhotoFilterOptions = {}
): HTMLCanvasElement {
  const w = Math.max(1, Math.min(2400, Math.round(width)));
  const h = Math.max(1, Math.min(2400, Math.round(height)));
  const grayscale = Math.max(0, Math.min(100, opts.grayscale || 0));
  const noise = Math.max(0, Math.min(100, opts.noise || 0));
  const blur = Math.max(0, opts.blur || 0);
  const seed = opts.seed || 'default';

  // Check LRU cache if no custom targetCanvas was supplied
  if (!opts.targetCanvas) {
    const srcId = getSourceId(sourceImg);
    const cacheKey = `${srcId}:${w}x${h}:g${grayscale}:n${noise}:b${blur.toFixed(1)}:s${seed}`;
    const cachedIndex = filterCanvasCache.findIndex((entry) => entry.key === cacheKey);
    if (cachedIndex !== -1) {
      const entry = filterCanvasCache.splice(cachedIndex, 1)[0];
      if (entry) {
        filterCanvasCache.push(entry); // Move to most recent
        return entry.canvas;
      }
    }
  }

  const outCanvas =
    opts.targetCanvas ||
    (typeof document !== 'undefined' ? document.createElement('canvas') : ({} as HTMLCanvasElement));
  if (outCanvas.width !== w || outCanvas.height !== h) {
    outCanvas.width = w;
    outCanvas.height = h;
  }

  if (typeof outCanvas.getContext !== 'function') {
    return outCanvas;
  }

  const ctx = outCanvas.getContext('2d');
  if (!ctx) return outCanvas;

  ctx.save();
  ctx.clearRect(0, 0, w, h);

  // Stage 1: Grayscale (0..100%)
  if (grayscale > 0) {
    ctx.filter = `grayscale(${grayscale}%)`;
  } else {
    ctx.filter = 'none';
  }
  ctx.drawImage(sourceImg, 0, 0, w, h);
  ctx.filter = 'none';

  // Stage 2: Deterministic Film-Grain Noise (0..100%)
  if (noise > 0) {
    const tile = getSeededGrainTile(seed);
    const pattern = ctx.createPattern(tile, 'repeat');
    if (pattern) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = Math.min(1, (noise / 100) * 0.55);
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  // Stage 3: Gaussian Blur (0..maxBlur px, applied after grain per D-01)
  if (blur > 0.1) {
    const temp = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (temp) {
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d');
      if (tCtx) {
        tCtx.drawImage(outCanvas, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.filter = `blur(${blur.toFixed(2)}px)`;
        const pad = Math.ceil(blur * 1.5);
        ctx.drawImage(temp, -pad, -pad, w + pad * 2, h + pad * 2);
        ctx.filter = 'none';
      }
    }
  }

  ctx.restore();

  // If using internal canvas, store into LRU cache
  if (!opts.targetCanvas) {
    const srcId = getSourceId(sourceImg);
    const cacheKey = `${srcId}:${w}x${h}:g${grayscale}:n${noise}:b${blur.toFixed(1)}:s${seed}`;
    if (filterCanvasCache.length >= FILTER_CACHE_MAX_SIZE) {
      filterCanvasCache.shift(); // Evict oldest
    }
    filterCanvasCache.push({ key: cacheKey, canvas: outCanvas });
  }

  return outCanvas;
}
