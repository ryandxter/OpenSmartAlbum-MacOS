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

import { RectBounds } from '../../templates';
import { partitionBsp, generateBspVariants } from '../bspEngine';
import { normalizeEqualHeightRow, normalizeEqualWidthColumn } from '../rowColumnNormalizer';
import { calculateSlotCost, solveHungarian, matchPhotosToSlots, PhotoAspectInput } from '../aspectMatcher';
import { generateDynamicVariations, LayoutGeneratorOptions } from '../generator';
import { AdaptivePhoto } from '../../adaptiveLayout';

console.log('🧪 Starting Generative Layout Core Automated Verification Tests...\n');

// ---------------------------------------------------------------------------
// Suite 1: Recursive Binary Space Partitioning Engine (bspEngine)
// ---------------------------------------------------------------------------
console.log('▶ Test Suite 1: Slicing Tree Partitioning (bspEngine)');

const container: RectBounds = { x: 50, y: 50, width: 1000, height: 800 };
const spacing = 12;
const minDim = 30;

for (let n = 1; n <= 15; n++) {
  const leaves = partitionBsp({
    container,
    leafCount: n,
    spacing,
    minSlotDimension: minDim,
    seedVariant: 0,
  });

  assert.strictEqual(leaves.length, n, `BSP should produce exactly ${n} leaves for N=${n}`);

  // Containment assertion
  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i]!;
    assert(leaf.x >= container.x - 0.01, `Leaf ${i} x (${leaf.x}) must be >= container.x (${container.x})`);
    assert(leaf.y >= container.y - 0.01, `Leaf ${i} y (${leaf.y}) must be >= container.y (${container.y})`);
    assert(
      leaf.x + leaf.width <= container.x + container.width + 0.01,
      `Leaf ${i} right (${leaf.x + leaf.width}) must be <= container right (${container.x + container.width})`
    );
    assert(
      leaf.y + leaf.height <= container.y + container.height + 0.01,
      `Leaf ${i} bottom (${leaf.y + leaf.height}) must be <= container bottom (${container.y + container.height})`
    );
    assert(leaf.width >= minDim - 1, `Leaf ${i} width (${leaf.width}) must respect minDim (${minDim})`);
    assert(leaf.height >= minDim - 1, `Leaf ${i} height (${leaf.height}) must respect minDim (${minDim})`);
  }

  // Non-overlapping assertion
  for (let i = 0; i < leaves.length; i++) {
    for (let j = i + 1; j < leaves.length; j++) {
      const a = leaves[i]!;
      const b = leaves[j]!;
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      const isOverlapping = overlapX > 0.01 && overlapY > 0.01;
      assert(!isOverlapping, `Leaves ${i} and ${j} must not overlap! Overlap: [${overlapX}x${overlapY}]`);
    }
  }
}

// Variant generation test
const variants = generateBspVariants(container, 4, spacing, 8);
assert(variants.length >= 3, `Expected at least 3 distinct BSP variants for N=4, got ${variants.length}`);
for (const v of variants) {
  assert.strictEqual(v.length, 4, 'Each BSP variant must have exactly 4 leaves');
}
console.log('  ✓ BSP partition invariant verified for N in [1..15] (Containment, Non-overlap, MinDim, Variants)');

// ---------------------------------------------------------------------------
// Suite 2: Multi-Photo Strip Solvers (rowColumnNormalizer)
// ---------------------------------------------------------------------------
console.log('\n▶ Test Suite 2: Equal-Height & Equal-Width Normalizers (rowColumnNormalizer)');

// 1. Equal-Height Row with 3 mixed photos (aspects: 1.5, 0.67, 1.0)
const rowContainer: RectBounds = { x: 100, y: 100, width: 900, height: 600 };
const rowAspects = [1.5, 0.67, 1.0];
const rowSpacing = 16;

const rowRects = normalizeEqualHeightRow({
  container: rowContainer,
  photoAspects: rowAspects,
  spacing: rowSpacing,
});

assert.strictEqual(rowRects.length, 3, 'Justified row should produce 3 rects');

// Zero-seam verification: first rect starts at container.x
assert.strictEqual(rowRects[0]!.x, rowContainer.x, 'First row slot must start at container.x');

// Consecutive slots separated by exactly spacing
for (let i = 0; i < rowRects.length - 1; i++) {
  const current = rowRects[i]!;
  const next = rowRects[i + 1]!;
  const seamGap = next.x - (current.x + current.width);
  assert.strictEqual(seamGap, rowSpacing, `Gap between slot ${i} and ${i + 1} must be exactly ${rowSpacing}px, got ${seamGap}`);
}

// Last slot ends exactly at container.x + container.width (0px hairline seam guarantee)
const lastSlot = rowRects[rowRects.length - 1]!;
const totalRowSpan = lastSlot.x + lastSlot.width - rowContainer.x;
assert.strictEqual(totalRowSpan, rowContainer.width, `Total row width must equal container width (900px), got ${totalRowSpan}`);

// 2. Equal-Width Column with 4 photos (aspects: 1.0, 1.5, 0.75, 1.33)
const colContainer: RectBounds = { x: 200, y: 50, width: 500, height: 800 };
const colAspects = [1.0, 1.5, 0.75, 1.33];
const colSpacing = 10;

const colRects = normalizeEqualWidthColumn({
  container: colContainer,
  photoAspects: colAspects,
  spacing: colSpacing,
});

assert.strictEqual(colRects.length, 4, 'Justified column should produce 4 rects');
assert.strictEqual(colRects[0]!.y, colContainer.y, 'First column slot must start at container.y');

for (let j = 0; j < colRects.length - 1; j++) {
  const current = colRects[j]!;
  const next = colRects[j + 1]!;
  const seamGap = next.y - (current.y + current.height);
  assert.strictEqual(seamGap, colSpacing, `Vertical gap between slot ${j} and ${j + 1} must be exactly ${colSpacing}px, got ${seamGap}`);
}

const lastColSlot = colRects[colRects.length - 1]!;
const totalColSpan = lastColSlot.y + lastColSlot.height - colContainer.y;
assert.strictEqual(totalColSpan, colContainer.height, `Total column height must equal container height (800px), got ${totalColSpan}`);
console.log('  ✓ 0px hairline seam guarantee verified for justified rows and columns');

// ---------------------------------------------------------------------------
// Suite 3: Optimal Kuhn-Munkres Assignment & Log-Aspect Energy (aspectMatcher)
// ---------------------------------------------------------------------------
console.log('\n▶ Test Suite 3: Kuhn-Munkres Assignment & Visual Scoring (aspectMatcher)');

// 0. Direct calculateSlotCost test on perfect aspect match
const perfectCost = calculateSlotCost({ aspect: 1.5 }, { x: 0, y: 0, width: 300, height: 200 }, 60000);
assert(Math.abs(perfectCost) < 0.001, `Perfect aspect match cost should be ~0, got ${perfectCost}`);

// 1. Cross-orientation matching test:
// 1 landscape photo (1.6) and 1 portrait photo (0.6)
// Slot 0 is landscape (600x300 = 2.0), Slot 1 is portrait (300x600 = 0.5)
const photosOri: PhotoAspectInput[] = [
  { aspect: 1.6 }, // Photo 0: landscape
  { aspect: 0.6 }, // Photo 1: portrait
];
const slotsOri: RectBounds[] = [
  { x: 0, y: 0, width: 600, height: 300 }, // Slot 0: landscape
  { x: 620, y: 0, width: 300, height: 600 }, // Slot 1: portrait
];

const oriMatch = matchPhotosToSlots(photosOri, slotsOri);
assert.strictEqual(oriMatch.mapping[0], 0, 'Landscape photo 0 must be matched to landscape slot 0');
assert.strictEqual(oriMatch.mapping[1], 1, 'Portrait photo 1 must be matched to portrait slot 1');
assert(oriMatch.score >= 85, `Orientation-matched score should be high, got ${oriMatch.score}`);

// 2. Hero photo area prioritization test:
// Photo 0: 5-star favorite hero (aspect 1.5)
// Photo 1: 2-star regular (aspect 1.5)
// Slot 0: Small thumbnail (200x150, area 30000)
// Slot 1: Dominant hero slot (800x600, area 480000)
const photosHero: PhotoAspectInput[] = [
  { aspect: 1.5, rating: 5, isFavorite: true },
  { aspect: 1.5, rating: 2, isFavorite: false },
];
const slotsHero: RectBounds[] = [
  { x: 0, y: 0, width: 200, height: 150 },
  { x: 250, y: 0, width: 800, height: 600 },
];
const heroMatch = matchPhotosToSlots(photosHero, slotsHero);
assert.strictEqual(heroMatch.mapping[0], 1, '5-star hero photo must be matched to largest slot 1');
assert.strictEqual(heroMatch.mapping[1], 0, 'Regular photo must take remaining slot 0');

// 3. Kuhn-Munkres solver algorithm unit test on known 3x3 matrix
const testCostMatrix = [
  [10, 19, 8],
  [10, 1, 30],
  [13, 12, 19],
];
// Row 0 -> Col 2 (cost 8)
// Row 1 -> Col 1 (cost 1)
// Row 2 -> Col 0 (cost 13)
// Total = 22 (optimal)
const hungarianMapping = solveHungarian(testCostMatrix);
assert.strictEqual(hungarianMapping[0], 2, 'Hungarian row 0 should map to col 2');
assert.strictEqual(hungarianMapping[1], 1, 'Hungarian row 1 should map to col 1');
assert.strictEqual(hungarianMapping[2], 0, 'Hungarian row 2 should map to col 0');
console.log('  ✓ Kuhn-Munkres O(N^3) assignment and hero weighting verified');

// ---------------------------------------------------------------------------
// Suite 4: Unified Generative Facade (generator)
// ---------------------------------------------------------------------------
console.log('\n▶ Test Suite 4: Unified Multi-Archetype Layout Synthesizer (generator)');

const singleOptions: LayoutGeneratorOptions = {
  containerWidth: 1080,
  containerHeight: 1080,
  spacing: 12,
  isSpread: false,
  safeMarginOutside: 40,
  safeMarginTop: 40,
  safeMarginBottom: 40,
};

const spreadOptions: LayoutGeneratorOptions = {
  containerWidth: 2400,
  containerHeight: 1200,
  spacing: 16,
  isSpread: true,
  gutterWidth: 20,
  safeMarginOutside: 50,
  safeMarginSpine: 30,
  safeMarginTop: 40,
  safeMarginBottom: 40,
};

// Test single slide for every N in [1..15]
for (let n = 1; n <= 15; n++) {
  const mockPhotos: AdaptivePhoto[] = Array.from({ length: n }, (_, i) => ({
    id: `photo-${i}`,
    photoAspect: i % 2 === 0 ? 1.5 : 0.67,
    rating: i === 0 ? 5 : 3,
  }));

  const singleVariations = generateDynamicVariations(singleOptions, mockPhotos);
  assert(singleVariations.length > 0, `At least 1 variation must be generated for single slide N=${n}`);

  for (const v of singleVariations) {
    assert.strictEqual(v.rects.length, n, `Single variation ${v.id} must have strictly ${n} rects`);
    assert.strictEqual(v.photoAssignments?.length, n, `Single variation ${v.id} must have strictly ${n} photo assignments`);
    assert(v.score !== undefined && v.score >= 0 && v.score <= 100, `Variation ${v.id} score must be between 0 and 100`);
  }

  // Test spread for every N in [1..15]
  const spreadVariations = generateDynamicVariations(spreadOptions, mockPhotos);
  assert(spreadVariations.length > 0, `At least 1 variation must be generated for spread N=${n}`);

  for (const v of spreadVariations) {
    assert.strictEqual(v.rects.length, n, `Spread variation ${v.id} must have strictly ${n} rects`);
    assert.strictEqual(v.photoAssignments?.length, n, `Spread variation ${v.id} must have strictly ${n} photo assignments`);
  }
}
console.log('  ✓ Invariant strictly N slots for N photos verified for all N in [1..15] (Single & Spread)');

// ---------------------------------------------------------------------------
// Suite 5: Invariant Stress Test
// ---------------------------------------------------------------------------
console.log('\n▶ Test Suite 5: Random Orientation & Aspect Invariant Stress Test (50 iterations)');

for (let iter = 0; iter < 50; iter++) {
  const randomN = Math.floor(Math.random() * 15) + 1; // 1 to 15
  const isSpread = iter % 2 === 0;

  const randomPhotos: AdaptivePhoto[] = Array.from({ length: randomN }, (_, i) => {
    // Aspect between 0.4 and 2.5
    const asp = 0.4 + Math.random() * 2.1;
    return {
      id: `p-${iter}-${i}`,
      photoAspect: asp,
      rating: Math.floor(Math.random() * 6),
      isFavorite: Math.random() > 0.7,
    };
  });

  const opts = isSpread ? spreadOptions : singleOptions;
  const variations = generateDynamicVariations(opts, randomPhotos);

  assert(variations.length > 0, `Stress iteration ${iter} (N=${randomN}): Must produce at least 1 variation`);
  for (const v of variations) {
    assert.strictEqual(v.rects.length, randomN, `Stress iteration ${iter} (N=${randomN}): Every variation must have strictly ${randomN} slots`);
    assert.strictEqual(v.photoAssignments?.length, randomN, `Stress iteration ${iter}: photoAssignments length must equal ${randomN}`);

    // Verify non-zero bounds
    for (const r of v.rects) {
      assert(r.width > 0, `Slot width must be > 0, got ${r.width}`);
      assert(r.height > 0, `Slot height must be > 0, got ${r.height}`);
      assert(!Number.isNaN(r.x) && !Number.isNaN(r.y), 'Coordinates must not be NaN');
    }
  }
}
console.log('  ✓ 50 random stress iterations passed with zero failures and zero photo dropping');

console.log('\n✅ All 5 Generative Layout Engine Test Suites Passed Successfully!');
