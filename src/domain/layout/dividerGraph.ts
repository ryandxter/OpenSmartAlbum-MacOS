/**
 * Divider Graph Engine
 *
 * Geometric analysis for extracting interactive shared dividers between adjacent photo frames,
 * merging colinear segments into continuous through-lines, calculating closed-form min/max
 * drag bounds, and resolving direct photo swap drop targets.
 *
 * 100% pure TypeScript, zero dependencies.
 */

export interface RectFrameInput {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  locked?: boolean;
  photoAspect?: number;
  cropScale?: number;
  cropX?: number;
  cropY?: number;
}

export interface CanvasDivider {
  /** Deterministic unique identifier, e.g. "v-div-150.0-f1,f2-f3,f4" */
  id: string;
  orientation: 'vertical' | 'horizontal';
  /** Centerline coordinate in physical units (mm for Album, px for Carousel) */
  coord: number;
  /** Span start on orthogonal axis (Y1 for vertical, X1 for horizontal) */
  startCoord: number;
  /** Span end on orthogonal axis (Y2 for vertical, X2 for horizontal) */
  endCoord: number;
  /** Detected inter-frame spacing gap */
  gap: number;
  /** Frame IDs on Left (vertical) or Top (horizontal) */
  firstSideFrameIds: string[];
  /** Frame IDs on Right (vertical) or Bottom (horizontal) */
  secondSideFrameIds: string[];
  /** Clamped lower bound coordinate */
  minCoord: number;
  /** Clamped upper bound coordinate */
  maxCoord: number;
  /** Minimum allowable relative delta */
  minDelta: number;
  /** Maximum allowable relative delta */
  maxDelta: number;
}

export interface ExtractDividersOptions {
  /** Minimum dimension allowed for any frame (e.g. 25.4mm for print, 120px for carousel) */
  minDimension?: number;
  /** Minimum orthogonal overlap to consider two frames adjacent */
  minOverlap?: number;
  /** Maximum gap distance to consider frames sharing a divider */
  maxGap?: number;
  /** Minimum split ratio for either adjacent frame (default 0.15) */
  minRatio?: number;
  /** Maximum split ratio for either adjacent frame (default 0.85) */
  maxRatio?: number;
}

interface RawContact {
  orientation: 'vertical' | 'horizontal';
  coord: number;
  startCoord: number;
  endCoord: number;
  gap: number;
  firstSideId: string;
  secondSideId: string;
}

/**
 * Extracts all shared vertical and horizontal dividers from an array of rectangular frames.
 */
export function extractCanvasDividers(
  frames: RectFrameInput[],
  options: ExtractDividersOptions = {}
): CanvasDivider[] {
  const minDimension = options.minDimension ?? 25.4;
  const minOverlap = options.minOverlap ?? 2.0;
  const maxGap = options.maxGap ?? 30.0;
  const minRatio = options.minRatio ?? 0.15;

  // Filter out invalid, locked, or rotated frames
  const validFrames = frames.filter(
    (f) =>
      !f.locked &&
      f.width > 0 &&
      f.height > 0 &&
      (!f.rotation || Math.abs(f.rotation % 360) < 0.01)
  );

  if (validFrames.length < 2) {
    return [];
  }

  const frameMap = new Map<string, RectFrameInput>(validFrames.map((f) => [f.id, f]));
  const contacts: RawContact[] = [];
  const epsilon = 0.5;

  // 1. Detect Vertical Contacts (Left frame A, Right frame B)
  for (let i = 0; i < validFrames.length; i++) {
    const a = validFrames[i]!;
    for (let j = 0; j < validFrames.length; j++) {
      if (i === j) continue;
      const b = validFrames[j]!;

      // B must be to the right of A
      const gap = b.x - (a.x + a.width);
      if (gap >= -epsilon && gap <= maxGap) {
        // Check vertical overlap
        const yStart = Math.max(a.y, b.y);
        const yEnd = Math.min(a.y + a.height, b.y + b.height);
        const overlap = yEnd - yStart;

        if (overlap >= minOverlap) {
          // Check for occluding frame C between A and B
          let occluded = false;
          for (let k = 0; k < validFrames.length; k++) {
            if (k === i || k === j) continue;
            const c = validFrames[k]!;
            const cYOverlap = Math.min(yEnd, c.y + c.height) - Math.max(yStart, c.y);
            if (cYOverlap >= minOverlap) {
              if (c.x >= a.x + a.width - epsilon && c.x + c.width <= b.x + epsilon) {
                occluded = true;
                break;
              }
            }
          }

          if (!occluded) {
            const coord = a.x + a.width + Math.max(0, gap) / 2;
            contacts.push({
              orientation: 'vertical',
              coord,
              startCoord: yStart,
              endCoord: yEnd,
              gap: Math.max(0, gap),
              firstSideId: a.id,
              secondSideId: b.id,
            });
          }
        }
      }
    }
  }

  // 2. Detect Horizontal Contacts (Top frame A, Bottom frame B)
  for (let i = 0; i < validFrames.length; i++) {
    const a = validFrames[i]!;
    for (let j = 0; j < validFrames.length; j++) {
      if (i === j) continue;
      const b = validFrames[j]!;

      // B must be below A
      const gap = b.y - (a.y + a.height);
      if (gap >= -epsilon && gap <= maxGap) {
        // Check horizontal overlap
        const xStart = Math.max(a.x, b.x);
        const xEnd = Math.min(a.x + a.width, b.x + b.width);
        const overlap = xEnd - xStart;

        if (overlap >= minOverlap) {
          // Check for occluding frame C between A and B
          let occluded = false;
          for (let k = 0; k < validFrames.length; k++) {
            if (k === i || k === j) continue;
            const c = validFrames[k]!;
            const cXOverlap = Math.min(xEnd, c.x + c.width) - Math.max(xStart, c.x);
            if (cXOverlap >= minOverlap) {
              if (c.y >= a.y + a.height - epsilon && c.y + c.height <= b.y + epsilon) {
                occluded = true;
                break;
              }
            }
          }

          if (!occluded) {
            const coord = a.y + a.height + Math.max(0, gap) / 2;
            contacts.push({
              orientation: 'horizontal',
              coord,
              startCoord: xStart,
              endCoord: xEnd,
              gap: Math.max(0, gap),
              firstSideId: a.id,
              secondSideId: b.id,
            });
          }
        }
      }
    }
  }

  // 3. Colinear Segment Merging
  // Group contacts by orientation and approximately equal coordinate
  const mergedDividers: CanvasDivider[] = [];
  const coordEpsilon = 1.0;

  const orientationGroups: { vertical: RawContact[]; horizontal: RawContact[] } = {
    vertical: contacts.filter((c) => c.orientation === 'vertical'),
    horizontal: contacts.filter((c) => c.orientation === 'horizontal'),
  };

  for (const orientation of ['vertical', 'horizontal'] as const) {
    const list = orientationGroups[orientation];
    const visited = new Set<number>();

    for (let i = 0; i < list.length; i++) {
      if (visited.has(i)) continue;
      const cluster: RawContact[] = [list[i]!];
      visited.add(i);

      for (let j = i + 1; j < list.length; j++) {
        if (visited.has(j)) continue;
        const candidate = list[j]!;

        // Must match coordinate
        if (Math.abs(candidate.coord - cluster[0]!.coord) <= coordEpsilon) {
          // Must connect or overlap with at least one segment in the cluster
          const connects = cluster.some((c) => {
            const gapBetween = Math.max(
              0,
              Math.max(c.startCoord, candidate.startCoord) - Math.min(c.endCoord, candidate.endCoord)
            );
            return gapBetween <= maxGap + 2.0;
          });

          if (connects) {
            cluster.push(candidate);
            visited.add(j);
          }
        }
      }

      // Merge cluster into a single CanvasDivider
      const firstSideIds = Array.from(new Set(cluster.map((c) => c.firstSideId)));
      const secondSideIds = Array.from(new Set(cluster.map((c) => c.secondSideId)));
      const avgCoord = cluster.reduce((sum, c) => sum + c.coord, 0) / cluster.length;
      const avgGap = cluster.reduce((sum, c) => sum + c.gap, 0) / cluster.length;
      const minStart = Math.min(...cluster.map((c) => c.startCoord));
      const maxEnd = Math.max(...cluster.map((c) => c.endCoord));

      // 4. Closed-form Clamping Bounds Derivation
      let globalMinDelta = -Infinity;
      let globalMaxDelta = Infinity;

      for (const f1Id of firstSideIds) {
        const f1 = frameMap.get(f1Id);
        if (!f1) continue;
        const dim1 = orientation === 'vertical' ? f1.width : f1.height;

        for (const f2Id of secondSideIds) {
          const f2 = frameMap.get(f2Id);
          if (!f2) continue;
          const dim2 = orientation === 'vertical' ? f2.width : f2.height;
          const combined = dim1 + dim2;

          // Constraint for first side (dim1 + delta >= minDimension & >= minRatio * combined)
          const minDeltaForPair = Math.max(
            minDimension - dim1,
            minRatio * combined - dim1
          );

          // Constraint for second side (dim2 - delta >= minDimension & >= minRatio * combined)
          const maxDeltaForPair = Math.min(
            dim2 - minDimension,
            dim2 - minRatio * combined
          );

          globalMinDelta = Math.max(globalMinDelta, minDeltaForPair);
          globalMaxDelta = Math.min(globalMaxDelta, maxDeltaForPair);
        }
      }

      // If already over-constrained or inverted, lock divider
      if (globalMinDelta > globalMaxDelta) {
        globalMinDelta = 0;
        globalMaxDelta = 0;
      }

      const dividerId = `${orientation === 'vertical' ? 'v' : 'h'}-div-${avgCoord.toFixed(1)}-${firstSideIds.join(',')}-${secondSideIds.join(',')}`;

      mergedDividers.push({
        id: dividerId,
        orientation,
        coord: Math.round(avgCoord * 100) / 100,
        startCoord: Math.round(minStart * 100) / 100,
        endCoord: Math.round(maxEnd * 100) / 100,
        gap: Math.round(avgGap * 100) / 100,
        firstSideFrameIds: firstSideIds,
        secondSideFrameIds: secondSideIds,
        minCoord: Math.round((avgCoord + globalMinDelta) * 100) / 100,
        maxCoord: Math.round((avgCoord + globalMaxDelta) * 100) / 100,
        minDelta: Math.round(globalMinDelta * 100) / 100,
        maxDelta: Math.round(globalMaxDelta * 100) / 100,
      });
    }
  }

  return mergedDividers;
}

/**
 * Detects if a coordinate point falls inside any candidate photo frame,
 * excluding the source frame being dragged.
 * Used for direct in-canvas photo drag swapping (DIV-04).
 */
export function findPhotoSwapTarget(
  frames: RectFrameInput[],
  point: { x: number; y: number },
  excludeFrameId?: string
): RectFrameInput | null {
  for (const f of frames) {
    if (f.id === excludeFrameId || f.locked) continue;

    if (
      point.x >= f.x &&
      point.x <= f.x + f.width &&
      point.y >= f.y &&
      point.y <= f.y + f.height
    ) {
      return f;
    }
  }
  return null;
}
