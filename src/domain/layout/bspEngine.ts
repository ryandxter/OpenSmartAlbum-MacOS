import { RectBounds } from '../templates';

export type SplitAxis = 'horizontal' | 'vertical';

export interface BspSplitNode {
  type: 'split';
  axis: SplitAxis;
  ratio: number;
  left: BspNode;
  right: BspNode;
  bounds: RectBounds;
}

export interface BspLeafNode {
  type: 'leaf';
  bounds: RectBounds;
  slotIndex: number;
}

export type BspNode = BspSplitNode | BspLeafNode;

export interface BspPartitionOptions {
  container: RectBounds;
  leafCount: number;
  spacing: number;
  minSlotDimension?: number; // Minimum width/height (default 40px)
  seedVariant?: number; // Integer index selecting split axis & ratio combinations
}

/** Harmonic editorial split proportions */
export const HARMONIC_RATIOS = {
  GOLDEN_HERO: 0.618,
  GOLDEN_COMPANION: 0.382,
  TWO_THIRDS: 0.667,
  ONE_THIRD: 0.333,
  HALF: 0.500,
  THREE_QUARTER: 0.750,
  ONE_QUARTER: 0.250,
} as const;

/**
 * Recursively partitions a container rectangle into leafCount non-overlapping slots
 * using slicing tree (BSP) decomposition with harmonic editorial proportions.
 */
export function partitionBsp(options: BspPartitionOptions): RectBounds[] {
  const { container, leafCount, spacing } = options;
  const minDim = options.minSlotDimension ?? 40;
  const seed = options.seedVariant ?? 0;

  if (leafCount <= 0) return [];
  if (leafCount === 1) {
    return [{
      x: Math.round(container.x),
      y: Math.round(container.y),
      width: Math.max(1, Math.round(container.width)),
      height: Math.max(1, Math.round(container.height)),
    }];
  }

  const root = buildBspTree(container, leafCount, spacing, minDim, seed, 0);
  const leaves: BspLeafNode[] = [];
  collectLeaves(root, leaves);

  // Sort leaves in deterministic top-to-bottom, left-to-right reading order
  leaves.sort((a, b) => {
    const dy = a.bounds.y - b.bounds.y;
    if (Math.abs(dy) > 4) return dy;
    return a.bounds.x - b.bounds.x;
  });

  leaves.forEach((leaf, idx) => {
    leaf.slotIndex = idx;
  });

  return leaves.map(l => l.bounds);
}

function buildBspTree(
  bounds: RectBounds,
  leafCount: number,
  spacing: number,
  minDim: number,
  seed: number,
  depth: number
): BspNode {
  if (leafCount <= 1) {
    return {
      type: 'leaf',
      bounds: {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.max(1, Math.round(bounds.width)),
        height: Math.max(1, Math.round(bounds.height)),
      },
      slotIndex: 0,
    };
  }

  // Determine split strategy
  // Leaf partition: hero (1 vs N-1), companion (N-1 vs 1), or balanced
  let kLeft: number;
  let kRight: number;

  const strategy = (seed + depth) % 4;
  if (strategy === 1 && leafCount >= 3) {
    // Hero on left/top
    kLeft = 1;
    kRight = leafCount - 1;
  } else if (strategy === 2 && leafCount >= 3) {
    // Hero on right/bottom
    kLeft = leafCount - 1;
    kRight = 1;
  } else {
    // Balanced allocation
    kLeft = Math.ceil(leafCount / 2);
    kRight = leafCount - kLeft;
  }

  // Determine split axis
  let axis: SplitAxis;
  const aspect = bounds.width / Math.max(1, bounds.height);
  const axisToggle = ((seed >> depth) & 1) === 1;

  if (aspect >= 1.3) {
    // Strongly wide: vertical split (cut width)
    axis = axisToggle && bounds.height - spacing >= 2 * minDim ? 'horizontal' : 'vertical';
  } else if (aspect <= 0.75) {
    // Strongly tall: horizontal split (cut height)
    axis = axisToggle && bounds.width - spacing >= 2 * minDim ? 'vertical' : 'horizontal';
  } else {
    // Near square: alternate or seed driven
    axis = (depth + seed) % 2 === 0 ? 'vertical' : 'horizontal';
  }

  // Determine ratio
  let ratio: number;
  if (kLeft === 1 && kRight > 1) {
    // Single hero
    const heroRatios = [HARMONIC_RATIOS.GOLDEN_HERO, HARMONIC_RATIOS.TWO_THIRDS, HARMONIC_RATIOS.THREE_QUARTER];
    ratio = heroRatios[(seed + depth) % heroRatios.length] ?? HARMONIC_RATIOS.GOLDEN_HERO;
  } else if (kLeft > 1 && kRight === 1) {
    // Single companion
    const compRatios = [HARMONIC_RATIOS.GOLDEN_COMPANION, HARMONIC_RATIOS.ONE_THIRD, HARMONIC_RATIOS.ONE_QUARTER];
    ratio = compRatios[(seed + depth) % compRatios.length] ?? HARMONIC_RATIOS.GOLDEN_COMPANION;
  } else {
    // Balanced
    const balancedRatios = [HARMONIC_RATIOS.HALF, HARMONIC_RATIOS.GOLDEN_HERO, HARMONIC_RATIOS.GOLDEN_COMPANION];
    ratio = (kLeft === kRight)
      ? HARMONIC_RATIOS.HALF
      : (seed % 2 === 0 ? kLeft / leafCount : (balancedRatios[seed % balancedRatios.length] ?? HARMONIC_RATIOS.HALF));
  }

  // Attempt the cut along selected axis
  let leftBounds: RectBounds;
  let rightBounds: RectBounds;

  if (axis === 'vertical') {
    const usableW = bounds.width - spacing;
    let wLeft = Math.round(usableW * ratio);
    let wRight = usableW - wLeft;

    // Check minSlotDimension guard
    if (wLeft < minDim || wRight < minDim) {
      // Fallback to symmetric 0.5
      wLeft = Math.round(usableW * 0.5);
      wRight = usableW - wLeft;
      ratio = 0.5;
    }

    if (wLeft < minDim || wRight < minDim) {
      // Check if horizontal cut would fit better
      const usableH = bounds.height - spacing;
      if (usableH >= 2 * minDim) {
        axis = 'horizontal';
        let hTop = Math.round(usableH * ratio);
        let hBottom = usableH - hTop;
        if (hTop < minDim || hBottom < minDim) {
          hTop = Math.round(usableH * 0.5);
          hBottom = usableH - hTop;
        }
        leftBounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: Math.max(1, hTop) };
        rightBounds = { x: bounds.x, y: bounds.y + hTop + spacing, width: bounds.width, height: Math.max(1, hBottom) };
      } else {
        // Clamp as best as possible
        wLeft = Math.max(1, Math.min(usableW - 1, wLeft));
        wRight = Math.max(1, usableW - wLeft);
        leftBounds = { x: bounds.x, y: bounds.y, width: wLeft, height: bounds.height };
        rightBounds = { x: bounds.x + wLeft + spacing, y: bounds.y, width: wRight, height: bounds.height };
      }
    } else {
      leftBounds = { x: bounds.x, y: bounds.y, width: wLeft, height: bounds.height };
      rightBounds = { x: bounds.x + wLeft + spacing, y: bounds.y, width: wRight, height: bounds.height };
    }
  } else {
    // Horizontal cut
    const usableH = bounds.height - spacing;
    let hTop = Math.round(usableH * ratio);
    let hBottom = usableH - hTop;

    // Check minSlotDimension guard
    if (hTop < minDim || hBottom < minDim) {
      // Fallback to symmetric 0.5
      hTop = Math.round(usableH * 0.5);
      hBottom = usableH - hTop;
      ratio = 0.5;
    }

    if (hTop < minDim || hBottom < minDim) {
      // Check if vertical cut would fit better
      const usableW = bounds.width - spacing;
      if (usableW >= 2 * minDim) {
        axis = 'vertical';
        let wLeft = Math.round(usableW * ratio);
        let wRight = usableW - wLeft;
        if (wLeft < minDim || wRight < minDim) {
          wLeft = Math.round(usableW * 0.5);
          wRight = usableW - wLeft;
        }
        leftBounds = { x: bounds.x, y: bounds.y, width: Math.max(1, wLeft), height: bounds.height };
        rightBounds = { x: bounds.x + wLeft + spacing, y: bounds.y, width: Math.max(1, wRight), height: bounds.height };
      } else {
        hTop = Math.max(1, Math.min(usableH - 1, hTop));
        hBottom = Math.max(1, usableH - hTop);
        leftBounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: hTop };
        rightBounds = { x: bounds.x, y: bounds.y + hTop + spacing, width: bounds.width, height: hBottom };
      }
    } else {
      leftBounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: hTop };
      rightBounds = { x: bounds.x, y: bounds.y + hTop + spacing, width: bounds.width, height: hBottom };
    }
  }

  const leftChild = buildBspTree(leftBounds, kLeft, spacing, minDim, seed, depth + 1);
  const rightChild = buildBspTree(rightBounds, kRight, spacing, minDim, seed, depth + 1);

  return {
    type: 'split',
    axis,
    ratio,
    left: leftChild,
    right: rightChild,
    bounds: { ...bounds },
  };
}

function collectLeaves(node: BspNode, acc: BspLeafNode[]): void {
  if (node.type === 'leaf') {
    acc.push(node);
  } else {
    collectLeaves(node.left, acc);
    collectLeaves(node.right, acc);
  }
}

/**
 * Generates a diverse list of distinct BSP partition variations for a container
 * by cycling seeds, ratio sequences, and axis orientations.
 */
export function generateBspVariants(
  container: RectBounds,
  leafCount: number,
  spacing: number,
  maxVariants = 12
): RectBounds[][] {
  if (leafCount <= 0) return [];
  if (leafCount === 1) return [[{ ...container }]];

  const variants: RectBounds[][] = [];
  const seenSignatures = new Set<string>();

  for (let seed = 0; seed < 40 && variants.length < maxVariants; seed++) {
    const candidate = partitionBsp({
      container,
      leafCount,
      spacing,
      minSlotDimension: 30,
      seedVariant: seed,
    });

    if (candidate.length !== leafCount) continue;

    // Geometric signature
    const signature = candidate
      .map(r => `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`)
      .sort()
      .join('|');

    if (!seenSignatures.has(signature)) {
      seenSignatures.add(signature);
      variants.push(candidate);
    }
  }

  return variants;
}
