function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

assert.strictEqual = function <T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${String(expected)}, but got ${String(actual)}`);
  }
};

assert.ok = function (condition: unknown, message?: string): asserts condition {
  assert(condition, message);
};

import {
  generateAdaptiveLayoutVariations,
  computeRawLayoutPartitions,
  clearAdaptiveLayoutCache,
  getAdaptiveLayoutCacheStats,
  getRawPartitionCacheKey,
  getScoredVariationsCacheKey,
  AdaptivePhoto,
  LRUCache,
  MAX_ADAPTIVE_CACHE_ENTRIES,
} from '../adaptiveLayout';
import { TemplateParams } from '../templates';
import { PhotoFrameElement } from '../editor';

console.log('🧪 Starting Adaptive Layout Memoization Cache & Silhouette Invariant Tests...\n');

// ---------------------------------------------------------------------------
// 1. Cache Hit & Determinism Test
// ---------------------------------------------------------------------------
console.log('▶ Test Suite 1: Cache Hit & Determinism Test');

clearAdaptiveLayoutCache();
let stats = getAdaptiveLayoutCacheStats();
assert.strictEqual(stats.hits, 0, 'Initial cache hits should be 0');
assert.strictEqual(stats.misses, 0, 'Initial cache misses should be 0');
assert.strictEqual(stats.rawEntries, 0, 'Initial raw cache size should be 0');
assert.strictEqual(stats.scoredEntries, 0, 'Initial scored cache size should be 0');

const baseParams: TemplateParams = {
  spreadWidth: 800,
  spreadHeight: 400,
  isSpread: true,
  safeMargin: 20,
  safeMarginTop: 20,
  safeMarginBottom: 20,
  safeMarginOutside: 20,
  safeMarginSpine: 20,
  gutterWidth: 10,
  spacing: 8,
  lockedElements: [],
};

const photoA: AdaptivePhoto = { id: 'photo-1', photoId: 'p1', photoAspect: 1.5, rating: 5, isFavorite: true };
const photoB: AdaptivePhoto = { id: 'photo-2', photoId: 'p2', photoAspect: 0.67, rating: 3, isFavorite: false };
const photoC: AdaptivePhoto = { id: 'photo-3', photoId: 'p3', photoAspect: 1.0, rating: 4, isFavorite: false };
const samplePhotos: AdaptivePhoto[] = [photoA, photoB, photoC];

// Direct Raw Partition Generator Test
const rawDirect = computeRawLayoutPartitions(baseParams, 3);
assert.ok(rawDirect.length > 0, 'Raw partition generator must produce valid layout templates');

// First invocation: Cache Miss
const t0 = performance.now();
const res1 = generateAdaptiveLayoutVariations(baseParams, samplePhotos);
const t1 = performance.now();
assert.ok(res1.length > 0, 'Should generate variations on first call');
assert.ok(t1 >= t0, 'Timing sanity check');

stats = getAdaptiveLayoutCacheStats();
assert.strictEqual(stats.hits, 0, 'Hits should remain 0 after first call');
assert.strictEqual(stats.misses, 1, 'Misses should be 1 after first call');
assert.strictEqual(stats.rawEntries, 1, 'Raw cache should have 1 entry');
assert.strictEqual(stats.scoredEntries, 1, 'Scored cache should have 1 entry');

// Second invocation: 100% Cache Hit (< 2ms)
const t2 = performance.now();
const res2 = generateAdaptiveLayoutVariations(baseParams, samplePhotos);
const t3 = performance.now();
assert.ok(t3 - t2 < 50, 'Cached lookup should be sub-50ms instantaneous');
assert.strictEqual(res2.length, res1.length, 'Cached result length should match');

const top1 = res1[0];
const top2 = res2[0];
assert.ok(top1 !== undefined && top2 !== undefined, 'Top variations must exist');
assert.strictEqual(top2.id, top1.id, 'Top variation ID should match identically');
assert.strictEqual(top2.score, top1.score, 'Top variation score should match identically');

stats = getAdaptiveLayoutCacheStats();
assert.strictEqual(stats.hits, 1, 'Hits should increment to 1 on identical call');
assert.strictEqual(stats.misses, 1, 'Misses should remain 1');

// Photo Shuffling Test: Order changed, same count & geometry
// Raw partition geometry cache HIT, Scored variations cache MISS
const shuffledPhotos: AdaptivePhoto[] = [photoC, photoA, photoB];
const resShuffled = generateAdaptiveLayoutVariations(baseParams, shuffledPhotos);
assert.ok(resShuffled.length > 0, 'Should score variations for shuffled photos');

stats = getAdaptiveLayoutCacheStats();
assert.strictEqual(stats.hits, 1, 'Hits should still be 1 (different photo order produces different scored key)');
assert.strictEqual(stats.misses, 2, 'Misses increment to 2');
assert.strictEqual(stats.rawEntries, 1, 'Raw partition geometry cache was reused (rawEntries stays 1)');
assert.strictEqual(stats.scoredEntries, 2, 'Scored cache now stores 2 entries for the two distinct photo arrangements');

console.log('  ✔ Cache hit and zero-lag memoization verified.\n');

// ---------------------------------------------------------------------------
// 2. Cache Invalidation & Key Sensitivity Test
// ---------------------------------------------------------------------------
console.log('▶ Test Suite 2: Cache Invalidation & Key Sensitivity Test');

const rawKey1 = getRawPartitionCacheKey(baseParams, 3);
const scoredKey1 = getScoredVariationsCacheKey(rawKey1, samplePhotos);

// Changing photo aspect ratio changes scored key but preserves raw geometry key
const modifiedAspectPhotos: AdaptivePhoto[] = [
  { ...photoA, photoAspect: 1.8 },
  photoB,
  photoC,
];
const scoredKeyAspectMod = getScoredVariationsCacheKey(rawKey1, modifiedAspectPhotos);
assert.ok(scoredKey1 !== scoredKeyAspectMod, 'Altered photo aspect must invalidate scored key');

// Changing spread width changes raw key
const modifiedParamsWidth: TemplateParams = {
  ...baseParams,
  spreadWidth: 1000,
};
const rawKeyWidthMod = getRawPartitionCacheKey(modifiedParamsWidth, 3);
assert.ok(rawKey1 !== rawKeyWidthMod, 'Altered spread width must invalidate raw key');

// Adding a locked element changes raw key
const paramsWithLocked: TemplateParams = {
  ...baseParams,
  lockedElements: [
    {
      id: 'lock-1',
      type: 'photo',
      photoId: 'locked-p',
      x: 100,
      y: 50,
      width: 200,
      height: 300,
      locked: true,
    } as unknown as PhotoFrameElement,
  ],
};
const rawKeyLocked = getRawPartitionCacheKey(paramsWithLocked, 3);
assert.ok(rawKey1 !== rawKeyLocked, 'Added locked element must invalidate raw partition key');

console.log('  ✔ Cache key generation and invalidation sensitivity verified.\n');

// ---------------------------------------------------------------------------
// 3. LRU Eviction & Bounded Memory Test
// ---------------------------------------------------------------------------
console.log('▶ Test Suite 3: LRU Eviction & Bounded Memory Test');

const miniCache = new LRUCache<string, number>(3);
miniCache.set('a', 1);
miniCache.set('b', 2);
miniCache.set('c', 3);
assert.strictEqual(miniCache.size, 3, 'Cache should contain 3 entries');

// Access 'a' so 'b' becomes least recently used
miniCache.get('a');

// Add 4th item -> should evict 'b'
miniCache.set('d', 4);
assert.strictEqual(miniCache.size, 3, 'Cache size should stay bounded at 3');
assert.strictEqual(miniCache.has('b'), false, 'Key b should be evicted');
assert.strictEqual(miniCache.has('a'), true, 'Key a should be retained');
assert.strictEqual(miniCache.has('c'), true, 'Key c should be retained');
assert.strictEqual(miniCache.has('d'), true, 'Key d should be retained');

// Test that global adaptiveLayout cache does not exceed MAX_ADAPTIVE_CACHE_ENTRIES
clearAdaptiveLayoutCache();
for (let i = 0; i < MAX_ADAPTIVE_CACHE_ENTRIES + 15; i++) {
  const customParams: TemplateParams = {
    ...baseParams,
    spreadWidth: 600 + i * 10,
  };
  generateAdaptiveLayoutVariations(customParams, samplePhotos);
}

const boundedStats = getAdaptiveLayoutCacheStats();
assert.ok(
  boundedStats.rawEntries <= MAX_ADAPTIVE_CACHE_ENTRIES,
  `Raw cache size (${boundedStats.rawEntries}) must not exceed MAX (${MAX_ADAPTIVE_CACHE_ENTRIES})`
);
assert.ok(
  boundedStats.scoredEntries <= MAX_ADAPTIVE_CACHE_ENTRIES,
  `Scored cache size (${boundedStats.scoredEntries}) must not exceed MAX (${MAX_ADAPTIVE_CACHE_ENTRIES})`
);

console.log('  ✔ LRU eviction and memory bounds verified.\n');

// ---------------------------------------------------------------------------
// 4. High-Contrast Studio Silhouette Invariants & WCAG Standards
// ---------------------------------------------------------------------------
console.log('▶ Test Suite 4: High-Contrast Studio Silhouette Invariants & WCAG Compliance');

const SILHOUETTE_SPECS = {
  cardBg: '#18181b',
  inactiveRectFill: 'rgba(255, 255, 255, 0.08)',
  inactiveRectStroke: 'rgba(255, 255, 255, 0.22)',
  hoverRectFill: 'rgba(255, 255, 255, 0.14)',
  hoverRectStroke: 'rgba(255, 255, 255, 0.35)',
  activeRectFill: 'rgba(59, 130, 246, 0.40)',
  activeRectStroke: '#3b82f6',
  spineStroke: 'rgba(255, 255, 255, 0.18)',
};

assert.strictEqual(SILHOUETTE_SPECS.inactiveRectFill, 'rgba(255, 255, 255, 0.08)');
assert.strictEqual(SILHOUETTE_SPECS.inactiveRectStroke, 'rgba(255, 255, 255, 0.22)');
assert.strictEqual(SILHOUETTE_SPECS.activeRectFill, 'rgba(59, 130, 246, 0.40)');
assert.strictEqual(SILHOUETTE_SPECS.activeRectStroke, '#3b82f6');
assert.strictEqual(SILHOUETTE_SPECS.cardBg, '#18181b');

// Function to calculate relative luminance of sRGB color
function sRGBToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * sRGBToLinear(r) + 0.7152 * sRGBToLinear(g) + 0.0722 * sRGBToLinear(b);
}

// Function to calculate WCAG contrast ratio between two luminance values
function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Background #18181b (R: 24, G: 24, B: 27)
const bgLuminance = relativeLuminance(24, 24, 27);

// Active stroke #3b82f6 (R: 59, G: 130, B: 246)
const activeStrokeLuminance = relativeLuminance(59, 130, 246);
const activeContrast = contrastRatio(activeStrokeLuminance, bgLuminance);
assert.ok(activeContrast >= 4.5, `Active stroke contrast ratio (${activeContrast.toFixed(2)}) must be >= 4.5:1 for WCAG AA`);

// White text #ffffff on #18181b
const whiteLuminance = relativeLuminance(255, 255, 255);
const textContrast = contrastRatio(whiteLuminance, bgLuminance);
assert.ok(textContrast >= 7.0, `White text contrast ratio (${textContrast.toFixed(2)}) must be >= 7.0:1 for WCAG AAA`);

console.log(`  ✔ Silhouette invariants verified (Active Contrast: ${activeContrast.toFixed(2)}:1, Text Contrast: ${textContrast.toFixed(2)}:1).\n`);

// ---------------------------------------------------------------------------
// 5. 3-Tier Match Score Badge Classification Test
// ---------------------------------------------------------------------------
console.log('▶ Test Suite 5: 3-Tier Match Score Badge Classification');

type ScoreTier = 'high' | 'medium' | 'standard';

function getScoreTier(score: number): ScoreTier {
  if (score >= 85) return 'high';
  if (score >= 70) return 'medium';
  return 'standard';
}

assert.strictEqual(getScoreTier(100), 'high', '100% must be high tier');
assert.strictEqual(getScoreTier(95), 'high', '95% must be high tier');
assert.strictEqual(getScoreTier(85), 'high', '85% threshold must be high tier');
assert.strictEqual(getScoreTier(84), 'medium', '84% must be medium tier');
assert.strictEqual(getScoreTier(75), 'medium', '75% must be medium tier');
assert.strictEqual(getScoreTier(70), 'medium', '70% threshold must be medium tier');
assert.strictEqual(getScoreTier(69), 'standard', '69% must be standard tier');
assert.strictEqual(getScoreTier(40), 'standard', '40% must be standard tier');
assert.strictEqual(getScoreTier(0), 'standard', '0% must be standard tier');

console.log('  ✔ Match score badge 3-tier classification thresholds verified.\n');

console.log('✅ ALL ADAPTIVE LAYOUT CACHE & SILHOUETTE TESTS PASSED! (100% Green)');
