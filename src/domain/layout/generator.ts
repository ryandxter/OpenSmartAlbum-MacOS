import { RectBounds } from '../templates';
import { AdaptivePhoto, AdaptiveLayoutVariation, getPhotosFingerprint } from '../adaptiveLayout';
import { PhotoFrameElement } from '../editor';
import { partitionBsp, generateBspVariants } from './bspEngine';
import { normalizeEqualHeightRow, normalizeEqualWidthColumn } from './rowColumnNormalizer';
import { matchPhotosToSlots, PhotoAspectInput } from './aspectMatcher';

export interface LayoutGeneratorOptions {
  containerWidth: number;
  containerHeight: number;
  spacing: number;
  isSpread: boolean;
  isCover?: boolean;
  gutterWidth?: number;
  safeMarginTop?: number;
  safeMarginBottom?: number;
  safeMarginOutside?: number;
  safeMarginSpine?: number;
  lockedElements?: PhotoFrameElement[];
  heroPhotoId?: string; // Explicit Hero photo anchor (Phase 12)
}

interface CandidateSlotSet {
  archetype: string;
  name: string;
  description: string;
  tags: string[];
  rects: RectBounds[];
}

/**
 * Unified Generative Layout Facade synthesizing valid, aspect-preserving,
 * non-overlapping partitions strictly generating N slots for N photos (N in [1..15]).
 */
export function generateDynamicVariations(
  options: LayoutGeneratorOptions,
  photos: AdaptivePhoto[]
): AdaptiveLayoutVariation[] {
  const n = photos.length;
  if (n === 0) return [];

  const hasHeroTarget = Boolean(options.heroPhotoId || photos.some((p) => p.isHero));

  const photoInputs: PhotoAspectInput[] = photos.map((p) => {
    const isExplicitHero = Boolean(
      (options.heroPhotoId && (p.id === options.heroPhotoId || p.photoId === options.heroPhotoId)) ||
      p.isHero
    );
    return {
      aspect: p.photoAspect && p.photoAspect > 0 ? p.photoAspect : 1.5,
      rating: p.rating,
      isFavorite: p.isFavorite,
      isHero: isExplicitHero,
    };
  });
  const photoAspects = photoInputs.map(p => p.aspect);
  const fingerprint = getPhotosFingerprint(photos);

  // Compute designable containers based on spread or single slide mode
  const { isSpread, containerWidth, containerHeight, spacing } = options;
  const marginTop = options.safeMarginTop ?? 0;
  const marginBottom = options.safeMarginBottom ?? 0;
  const marginOutside = options.safeMarginOutside ?? 0;
  const marginSpine = options.safeMarginSpine ?? 0;
  const gutter = options.gutterWidth ?? 0;

  const pageHeight = Math.max(10, containerHeight - marginTop - marginBottom);
  const spreadWidth = Math.max(10, containerWidth - marginOutside * 2);

  const container: RectBounds = {
    x: marginOutside,
    y: marginTop,
    width: spreadWidth,
    height: pageHeight,
  };

  const pageWidth = (containerWidth - gutter) / 2;
  const pageUsableWidth = Math.max(10, pageWidth - marginOutside - marginSpine);

  const leftArea: RectBounds = {
    x: marginOutside,
    y: marginTop,
    width: pageUsableWidth,
    height: pageHeight,
  };

  const rightArea: RectBounds = {
    x: pageWidth + gutter + marginSpine,
    y: marginTop,
    width: pageUsableWidth,
    height: pageHeight,
  };

  const spreadArea: RectBounds = {
    x: marginOutside,
    y: marginTop,
    width: spreadWidth,
    height: pageHeight,
  };

  const candidates: CandidateSlotSet[] = [];

  // Generate candidates according to density tier and spread mode
  if (n === 1) {
    generateTier1Candidates(candidates, container, leftArea, rightArea, spreadArea, isSpread, options, photoAspects[0] ?? 1.5);
  } else if (n === 2) {
    generateTier2Candidates(candidates, container, leftArea, rightArea, spreadArea, isSpread, spacing, photoAspects);
  } else if (n <= 6) {
    generateTier3Candidates(candidates, container, leftArea, rightArea, spreadArea, isSpread, spacing, n, photoAspects);
  } else {
    generateTier4Candidates(candidates, container, leftArea, rightArea, spreadArea, isSpread, spacing, n, photoAspects);
  }

  // Deduplicate and evaluate each candidate with Hungarian matcher
  const variations: AdaptiveLayoutVariation[] = [];
  const seenGeometries = new Set<string>();

  let candidateIdx = 0;
  for (const cand of candidates) {
    if (cand.rects.length !== n) continue;

    // Geometric signature rounded to whole pixels for deduplication
    const signature = cand.rects
      .map(r => `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`)
      .sort()
      .join('|');

    if (seenGeometries.has(signature)) continue;
    seenGeometries.add(signature);

    const match = matchPhotosToSlots(photoInputs, cand.rects);

    let finalScore = match.score;
    if (hasHeroTarget && (cand.archetype.includes('hero') || cand.name.toLowerCase().includes('hero'))) {
      finalScore = Math.min(100, finalScore + 15);
    }

    variations.push({
      id: `dyn-${cand.archetype}-${n}-${candidateIdx++}`,
      name: cand.name,
      description: cand.description,
      rects: cand.rects,
      tags: cand.tags,
      score: finalScore,
      cropPenalty: match.avgCropPenalty,
      fingerprint,
      photoAssignments: match.mapping,
    });
  }

  // Fallback guard: If no variations generated, provide standard BSP partition
  if (variations.length === 0) {
    const fallbackRects = partitionBsp({
      container: isSpread ? spreadArea : container,
      leafCount: n,
      spacing,
      minSlotDimension: 30,
      seedVariant: 0,
    });
    const match = matchPhotosToSlots(photoInputs, fallbackRects);
    variations.push({
      id: `dyn-fallback-${n}-0`,
      name: 'Harmonic Editorial Partition',
      description: `Default balanced slicing partition for ${n} photos.`,
      rects: fallbackRects,
      tags: ['generative', 'fallback'],
      score: match.score,
      cropPenalty: match.avgCropPenalty,
      fingerprint,
      photoAssignments: match.mapping,
    });
  }

  // Sort candidates by visual score descending
  variations.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return variations;
}

// ---------------------------------------------------------------------------
// Tier 1 (N = 1)
// ---------------------------------------------------------------------------
function generateTier1Candidates(
  candidates: CandidateSlotSet[],
  container: RectBounds,
  leftArea: RectBounds,
  rightArea: RectBounds,
  spreadArea: RectBounds,
  isSpread: boolean,
  options: LayoutGeneratorOptions,
  photoAspect: number
): void {
  if (!isSpread) {
    // 1. Full Inset Container
    candidates.push({
      archetype: 'full-container',
      name: 'Full Page Margins',
      description: 'Single photo spanning the designable page area.',
      tags: ['generative', 'single', 'margin'],
      rects: [{ ...container }],
    });

    // 2. Full Bleed
    candidates.push({
      archetype: 'full-bleed',
      name: 'Full Bleed',
      description: 'Single photo spanning the entire canvas without margins.',
      tags: ['generative', 'single', 'bleed'],
      rects: [{ x: 0, y: 0, width: options.containerWidth, height: options.containerHeight }],
    });

    // 3. Centered Inset Mat (80% scale)
    const insetW = Math.round(container.width * 0.8);
    const insetH = Math.round(container.height * 0.8);
    candidates.push({
      archetype: 'centered-inset',
      name: 'Centered Inset Mat',
      description: 'Centered presentation with generous whitespace border.',
      tags: ['generative', 'single', 'mat'],
      rects: [{
        x: Math.round(container.x + (container.width - insetW) / 2),
        y: Math.round(container.y + (container.height - insetH) / 2),
        width: insetW,
        height: insetH,
      }],
    });

    // 4. Centered Natural Aspect Mat
    const fitted = fitAspectInsideBox(container, photoAspect);
    candidates.push({
      archetype: 'centered-natural',
      name: 'Proportional Gallery Mat',
      description: 'Preserves the photo original aspect ratio perfectly centered.',
      tags: ['generative', 'single', 'proportional'],
      rects: [fitted],
    });
  } else {
    // Spread 1-photo candidates
    // 1. Panoramic Spread Bleed
    candidates.push({
      archetype: 'spread-bleed',
      name: 'Panoramic Full Bleed',
      description: 'Sweeping panoramic presentation across both pages.',
      tags: ['generative', 'panoramic', 'bleed'],
      rects: [{ x: 0, y: 0, width: options.containerWidth, height: options.containerHeight }],
    });

    // 2. Panoramic Margin
    candidates.push({
      archetype: 'spread-margin',
      name: 'Panoramic Margined Spread',
      description: 'Double-page panoramic hero inside safe margins.',
      tags: ['generative', 'panoramic', 'margin'],
      rects: [{ ...spreadArea }],
    });

    // 3. Left Page Solo
    candidates.push({
      archetype: 'page-left',
      name: 'Left Page Showcase',
      description: 'Single hero photo positioned on the left page.',
      tags: ['generative', 'spread', 'editorial'],
      rects: [{ ...leftArea }],
    });

    // 4. Right Page Solo
    candidates.push({
      archetype: 'page-right',
      name: 'Right Page Showcase',
      description: 'Single hero photo positioned on the right page.',
      tags: ['generative', 'spread', 'editorial'],
      rects: [{ ...rightArea }],
    });
  }
}

// ---------------------------------------------------------------------------
// Tier 2 (N = 2)
// ---------------------------------------------------------------------------
function generateTier2Candidates(
  candidates: CandidateSlotSet[],
  container: RectBounds,
  leftArea: RectBounds,
  rightArea: RectBounds,
  spreadArea: RectBounds,
  isSpread: boolean,
  spacing: number,
  aspects: number[]
): void {
  const baseArea = isSpread ? spreadArea : container;

  // 1. Equal-Height Justified Row
  const rowRects = normalizeEqualHeightRow({
    container: baseArea,
    photoAspects: aspects,
    spacing,
  });
  if (rowRects.length === 2) {
    candidates.push({
      archetype: 'justified-row',
      name: 'Justified Side-by-Side',
      description: 'Equal-height diptych preserving horizontal visual harmony.',
      tags: ['generative', 'justified', 'row'],
      rects: rowRects,
    });
  }

  // 2. Equal-Width Column
  const colRects = normalizeEqualWidthColumn({
    container: baseArea,
    photoAspects: aspects,
    spacing,
  });
  if (colRects.length === 2) {
    candidates.push({
      archetype: 'justified-col',
      name: 'Vertical Diptych Stack',
      description: 'Equal-width vertical stack spanning container height.',
      tags: ['generative', 'justified', 'column'],
      rects: colRects,
    });
  }

  // 3. Facing pages if spread
  if (isSpread) {
    candidates.push({
      archetype: 'facing-pages',
      name: 'Facing Page Diptych',
      description: 'One photo per page for balanced bilateral reading.',
      tags: ['generative', 'spread', 'facing'],
      rects: [{ ...leftArea }, { ...rightArea }],
    });
  }

  // 4. Harmonic BSP Slicing variations
  const bspVariants = generateBspVariants(baseArea, 2, spacing, 6);
  bspVariants.forEach((rects, i) => {
    candidates.push({
      archetype: `bsp-${i}`,
      name: i === 0 ? 'Harmonic Golden Split' : `Editorial Slicing Split ${i + 1}`,
      description: 'Proportional geometric partition with harmonic editorial ratios.',
      tags: ['generative', 'bsp', 'harmonic'],
      rects,
    });
  });
}

// ---------------------------------------------------------------------------
// Tier 3 (N in [3..6])
// ---------------------------------------------------------------------------
function generateTier3Candidates(
  candidates: CandidateSlotSet[],
  container: RectBounds,
  leftArea: RectBounds,
  rightArea: RectBounds,
  spreadArea: RectBounds,
  isSpread: boolean,
  spacing: number,
  n: number,
  aspects: number[]
): void {
  const baseArea = isSpread ? spreadArea : container;

  // 1. Harmonic BSP Variants
  const bspVars = generateBspVariants(baseArea, n, spacing, 8);
  bspVars.forEach((rects, i) => {
    candidates.push({
      archetype: `bsp-${i}`,
      name: i === 0 ? 'Harmonic Editorial Tree' : `Editorial Partition ${i + 1}`,
      description: `Harmonic binary space decomposition for ${n} photos.`,
      tags: ['generative', 'bsp', 'editorial'],
      rects,
    });
  });

  // 2. Justified Row (for N <= 4)
  if (n <= 4) {
    const rowRects = normalizeEqualHeightRow({
      container: baseArea,
      photoAspects: aspects,
      spacing,
    });
    if (rowRects.length === n) {
      candidates.push({
        archetype: 'justified-row',
        name: `${n}-Photo Justified Row`,
        description: 'Equal-height panoramic gallery strip.',
        tags: ['generative', 'justified', 'row'],
        rects: rowRects,
      });
    }
  }

  // 3. Hero + Companion Stack
  generateHeroStackCandidates(candidates, baseArea, n, spacing, aspects);

  // 4. Structured multi-row partitions (e.g. 2+1, 1+2 for 3; 2+2 for 4; 2+3, 3+2 for 5; 3+3 for 6)
  const rowSplits = getRowPartitions(n);
  for (const split of rowSplits) {
    const splitRects = buildMultiRowPartition(baseArea, split, spacing, aspects);
    if (splitRects.length === n) {
      candidates.push({
        archetype: `multirow-${split.join('-')}`,
        name: `Multi-Row Grid (${split.join('+')})`,
        description: `Balanced editorial grid distributed into ${split.length} rows.`,
        tags: ['generative', 'grid', 'multirow'],
        rects: splitRects,
      });
    }
  }

  // 5. Spread Combinatorial Left/Right Page Partitions
  if (isSpread) {
    for (let leftCount = 1; leftCount < n; leftCount++) {
      const rightCount = n - leftCount;
      const leftRects = partitionBsp({
        container: leftArea,
        leafCount: leftCount,
        spacing,
        minSlotDimension: 30,
        seedVariant: 0,
      });
      const rightRects = partitionBsp({
        container: rightArea,
        leafCount: rightCount,
        spacing,
        minSlotDimension: 30,
        seedVariant: 1,
      });

      if (leftRects.length === leftCount && rightRects.length === rightCount) {
        candidates.push({
          archetype: `spread-split-${leftCount}-${rightCount}`,
          name: `Spread Split (${leftCount} Left + ${rightCount} Right)`,
          description: `Bilateral spread layout distributing ${leftCount} photos on left and ${rightCount} on right.`,
          tags: ['generative', 'spread', 'combinatorial'],
          rects: [...leftRects, ...rightRects],
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Tier 4 (N in [7..15])
// ---------------------------------------------------------------------------
function generateTier4Candidates(
  candidates: CandidateSlotSet[],
  container: RectBounds,
  leftArea: RectBounds,
  rightArea: RectBounds,
  spreadArea: RectBounds,
  isSpread: boolean,
  spacing: number,
  n: number,
  aspects: number[]
): void {
  const baseArea = isSpread ? spreadArea : container;

  // 1. Harmonic BSP Variants
  const bspVars = generateBspVariants(baseArea, n, spacing, 10);
  bspVars.forEach((rects, i) => {
    candidates.push({
      archetype: `bsp-${i}`,
      name: i === 0 ? 'High-Density Editorial Tree' : `High-Density Partition ${i + 1}`,
      description: `Algorithmic slicing tree balancing ${n} photos.`,
      tags: ['generative', 'bsp', 'dense'],
      rects,
    });
  });

  // 2. Multi-Row Grid strips
  const rowSplits = getRowPartitions(n);
  for (const split of rowSplits) {
    const splitRects = buildMultiRowPartition(baseArea, split, spacing, aspects);
    if (splitRects.length === n) {
      candidates.push({
        archetype: `multirow-${split.join('-')}`,
        name: `Dense Masonry Grid (${split.join('+')})`,
        description: `Balanced multi-row masonry partition for ${n} photos.`,
        tags: ['generative', 'grid', 'dense'],
        rects: splitRects,
      });
    }
  }

  // 3. Hero + Multi-Companion Grid
  const heroGridRects = buildHeroCompanionGrid(baseArea, n, spacing);
  if (heroGridRects.length === n) {
    candidates.push({
      archetype: 'hero-companion-grid',
      name: 'Hero Showcase + Companion Grid',
      description: `Dominant hero slot accompanied by ${n - 1} companion thumbnails.`,
      tags: ['generative', 'hero', 'grid'],
      rects: heroGridRects,
    });
  }

  // 4. Spread Combinatorial Left/Right Page Partitions
  if (isSpread) {
    // Generate key page partitions: balanced, hero-page, asymmetric
    const pairs: Array<[number, number]> = [
      [Math.floor(n / 2), Math.ceil(n / 2)],
      [Math.ceil(n / 2), Math.floor(n / 2)],
      [1, n - 1],
      [n - 1, 1],
      [2, n - 2],
      [n - 2, 2],
    ];

    const seenPairs = new Set<string>();
    for (const [leftCount, rightCount] of pairs) {
      const pairKey = `${leftCount}-${rightCount}`;
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      const leftRects = partitionBsp({
        container: leftArea,
        leafCount: leftCount,
        spacing,
        minSlotDimension: 25,
        seedVariant: 0,
      });
      const rightRects = partitionBsp({
        container: rightArea,
        leafCount: rightCount,
        spacing,
        minSlotDimension: 25,
        seedVariant: 1,
      });

      if (leftRects.length === leftCount && rightRects.length === rightCount) {
        candidates.push({
          archetype: `spread-split-${leftCount}-${rightCount}`,
          name: `Spread (${leftCount} Left + ${rightCount} Right)`,
          description: `Two-page layout partitioning ${n} photos across spine.`,
          tags: ['generative', 'spread', 'dense'],
          rects: [...leftRects, ...rightRects],
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helper Builders
// ---------------------------------------------------------------------------

function fitAspectInsideBox(container: RectBounds, aspect: number): RectBounds {
  const boxAspect = container.width / Math.max(1, container.height);
  let w: number;
  let h: number;

  if (aspect >= boxAspect) {
    w = container.width;
    h = w / aspect;
  } else {
    h = container.height;
    w = h * aspect;
  }

  return {
    x: Math.round(container.x + (container.width - w) / 2),
    y: Math.round(container.y + (container.height - h) / 2),
    width: Math.max(1, Math.round(w)),
    height: Math.max(1, Math.round(h)),
  };
}

function generateHeroStackCandidates(
  candidates: CandidateSlotSet[],
  container: RectBounds,
  n: number,
  spacing: number,
  aspects: number[]
): void {
  const companionCount = n - 1;
  const companionAspects = aspects.slice(1);

  // Left Hero (60% width) + Right vertical column of (N-1)
  const heroWidth = Math.round((container.width - spacing) * 0.6);
  const companionWidth = container.width - spacing - heroWidth;

  const heroRect: RectBounds = {
    x: container.x,
    y: container.y,
    width: heroWidth,
    height: container.height,
  };
  const companionContainer: RectBounds = {
    x: container.x + heroWidth + spacing,
    y: container.y,
    width: companionWidth,
    height: container.height,
  };

  const companionCol = normalizeEqualWidthColumn({
    container: companionContainer,
    photoAspects: companionAspects,
    spacing,
  });

  if (companionCol.length === companionCount) {
    candidates.push({
      archetype: 'hero-left-stack',
      name: 'Dominant Left Hero + Stack',
      description: `Large left focal photo balanced with ${companionCount} stacked companions.`,
      tags: ['generative', 'hero', 'stack'],
      rects: [heroRect, ...companionCol],
    });
  }

  // Right Hero (60% width) + Left vertical column of (N-1)
  const leftCompContainer: RectBounds = {
    x: container.x,
    y: container.y,
    width: companionWidth,
    height: container.height,
  };
  const rightHeroRect: RectBounds = {
    x: container.x + companionWidth + spacing,
    y: container.y,
    width: heroWidth,
    height: container.height,
  };
  const leftCol = normalizeEqualWidthColumn({
    container: leftCompContainer,
    photoAspects: companionAspects,
    spacing,
  });

  if (leftCol.length === companionCount) {
    candidates.push({
      archetype: 'hero-right-stack',
      name: 'Dominant Right Hero + Stack',
      description: `Large right focal photo with ${companionCount} stacked companions on left.`,
      tags: ['generative', 'hero', 'stack'],
      rects: [...leftCol, rightHeroRect],
    });
  }
}

function getRowPartitions(n: number): number[][] {
  const splits: Record<number, number[][]> = {
    3: [[1, 2], [2, 1]],
    4: [[2, 2], [1, 3], [3, 1]],
    5: [[2, 3], [3, 2], [1, 3, 1]],
    6: [[3, 3], [2, 2, 2], [2, 4], [4, 2]],
    7: [[3, 4], [4, 3], [2, 3, 2]],
    8: [[4, 4], [3, 2, 3], [3, 3, 2], [2, 4, 2]],
    9: [[3, 3, 3], [4, 5], [5, 4]],
    10: [[5, 5], [3, 4, 3], [4, 3, 3]],
    11: [[4, 3, 4], [3, 5, 3], [4, 4, 3]],
    12: [[4, 4, 4], [3, 3, 3, 3], [6, 6]],
    13: [[4, 5, 4], [5, 4, 4], [3, 4, 3, 3]],
    14: [[5, 4, 5], [4, 6, 4], [7, 7]],
    15: [[5, 5, 5], [4, 4, 4, 3], [3, 4, 4, 4]],
  };

  return splits[n] ?? [[Math.floor(n / 2), Math.ceil(n / 2)]];
}

function buildMultiRowPartition(
  container: RectBounds,
  rowCounts: number[],
  spacing: number,
  photoAspects: number[]
): RectBounds[] {
  const numRows = rowCounts.length;
  if (numRows === 0) return [];

  const totalVSpacing = (numRows - 1) * spacing;
  const usableH = Math.max(numRows, container.height - totalVSpacing);
  const rowHeight = Math.floor(usableH / numRows);

  const rects: RectBounds[] = [];
  let aspectCursor = 0;

  for (let r = 0; r < numRows; r++) {
    const count = rowCounts[r] ?? 1;
    const y = container.y + r * (rowHeight + spacing);
    const h = r === numRows - 1 ? container.y + container.height - y : rowHeight;

    const rowContainer: RectBounds = {
      x: container.x,
      y,
      width: container.width,
      height: Math.max(1, h),
    };

    const rowAspects = photoAspects.slice(aspectCursor, aspectCursor + count);
    aspectCursor += count;

    const rowRects = normalizeEqualHeightRow({
      container: rowContainer,
      photoAspects: rowAspects.length > 0 ? rowAspects : Array(count).fill(1.5),
      spacing,
      maxHeight: h,
    });

    rects.push(...rowRects);
  }

  return rects;
}

function buildHeroCompanionGrid(
  container: RectBounds,
  n: number,
  spacing: number
): RectBounds[] {
  const companionCount = n - 1;
  const heroWidth = Math.round((container.width - spacing) * 0.55);
  const companionWidth = container.width - spacing - heroWidth;

  const heroRect: RectBounds = {
    x: container.x,
    y: container.y,
    width: heroWidth,
    height: container.height,
  };

  const compContainer: RectBounds = {
    x: container.x + heroWidth + spacing,
    y: container.y,
    width: companionWidth,
    height: container.height,
  };

  const companionRects = partitionBsp({
    container: compContainer,
    leafCount: companionCount,
    spacing,
    minSlotDimension: 20,
    seedVariant: 0,
  });

  return [heroRect, ...companionRects];
}
