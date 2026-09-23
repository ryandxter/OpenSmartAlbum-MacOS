import { RectBounds } from '../templates';

export interface PhotoAspectInput {
  aspect: number; // width / height
  rating?: number; // 0 to 5
  isFavorite?: boolean;
  isHero?: boolean; // Explicit Hero Anchor (Phase 12)
}

export interface MatchResult {
  mapping: number[]; // photo[i] -> slot[mapping[i]]
  score: number; // 0..100 composite visual harmony score
  avgCropPenalty: number; // 0.0 (perfect) to 1.0 (severe)
}

/**
 * Calculates energy cost for placing a photo in a slot based on:
 * 1. Scale-invariant log-aspect distance (|ln(P) - ln(S)|)
 * 2. Cross-orientation mismatch penalty (landscape photo in portrait slot, or vice versa)
 * 3. Hero importance weighting (high star/favorite/explicit hero photos prioritized in larger slots)
 */
export function calculateSlotCost(
  photo: PhotoAspectInput,
  slot: RectBounds,
  maxSlotArea: number
): number {
  const pAspect = photo.aspect > 0 ? photo.aspect : 1.5;
  const sAspect = slot.height > 0 ? slot.width / slot.height : 1.5;

  // 1. Scale-invariant log-aspect distance
  const aspectCost = Math.abs(Math.log(pAspect) - Math.log(sAspect));

  // 2. Cross-orientation mismatch penalty (landscape in portrait or vice versa)
  const isPhotoLandscape = pAspect >= 1.05;
  const isPhotoPortrait = pAspect <= 0.95;
  const isSlotLandscape = sAspect >= 1.05;
  const isSlotPortrait = sAspect <= 0.95;

  let orientPenalty = 0;
  if ((isPhotoLandscape && isSlotPortrait) || (isPhotoPortrait && isSlotLandscape)) {
    orientPenalty = 2.5; // Significant deterrent against orientation mismatch
  }

  // 3. Hero importance weighting: high-star / favorite / explicit hero photos should receive largest slots
  let heroBonus = 0;
  const isHero = Boolean(photo.isHero) || (photo.rating !== undefined && photo.rating >= 4) || Boolean(photo.isFavorite);
  if (isHero && maxSlotArea > 0) {
    const slotArea = slot.width * slot.height;
    const areaRatio = slotArea / maxSlotArea; // 1.0 = largest slot
    // Heavy penalty against placing explicit hero in non-dominant slots
    const penaltyMultiplier = photo.isHero ? 20.0 : 3.0;
    heroBonus = (1.0 - areaRatio) * penaltyMultiplier;
  }

  return aspectCost + orientPenalty + heroBonus;
}

/**
 * Solves the classical Kuhn-Munkres (Hungarian) minimum cost assignment problem in O(N^3).
 * Given an N x M cost matrix, returns mapping pi where pi[i] = j denotes row i assigned to column j.
 */
export function solveHungarian(costMatrix: number[][]): number[] {
  const n = costMatrix.length;
  if (n === 0) return [];
  const firstRow = costMatrix[0];
  if (!firstRow || firstRow.length === 0) return [];
  const m = firstRow.length;

  const dim = Math.max(n, m);
  // 1-indexed (dim + 1) x (dim + 1) matrix
  const matrix: number[][] = Array.from({ length: dim + 1 }, () => Array<number>(dim + 1).fill(0));
  for (let i = 0; i < dim; i++) {
    const row = costMatrix[i];
    const matRow = matrix[i + 1];
    if (!matRow) continue;
    for (let j = 0; j < dim; j++) {
      if (i < n && j < m && row && typeof row[j] === 'number') {
        matRow[j + 1] = row[j]!;
      } else {
        matRow[j + 1] = 1e6; // dummy high cost for padding
      }
    }
  }

  const u = new Array<number>(dim + 1).fill(0);
  const v = new Array<number>(dim + 1).fill(0);
  const p = new Array<number>(dim + 1).fill(0);
  const way = new Array<number>(dim + 1).fill(0);

  for (let i = 1; i <= dim; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(dim + 1).fill(Infinity);
    const used = new Array<boolean>(dim + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = p[j0] ?? 0;
      let delta = Infinity;
      let j1 = 0;

      for (let j = 1; j <= dim; j++) {
        if (!used[j]) {
          const matRow = matrix[i0];
          const matVal = matRow ? (matRow[j] ?? 0) : 0;
          const cur = matVal - (u[i0] ?? 0) - (v[j] ?? 0);
          if (cur < (minv[j] ?? Infinity)) {
            minv[j] = cur;
            way[j] = j0;
          }
          if ((minv[j] ?? Infinity) < delta) {
            delta = minv[j] ?? delta;
            j1 = j;
          }
        }
      }

      for (let j = 0; j <= dim; j++) {
        if (used[j]) {
          const pj = p[j] ?? 0;
          u[pj] = (u[pj] ?? 0) + delta;
          v[j] = (v[j] ?? 0) - delta;
        } else {
          minv[j] = (minv[j] ?? 0) - delta;
        }
      }

      j0 = j1;
    } while ((p[j0] ?? 0) !== 0);

    do {
      const j1 = way[j0] ?? 0;
      p[j0] = p[j1] ?? 0;
      j0 = j1;
    } while (j0 !== 0);
  }

  const result = new Array<number>(n).fill(-1);
  for (let j = 1; j <= dim; j++) {
    const row = p[j] ?? 0;
    if (row >= 1 && row <= n) {
      result[row - 1] = j - 1;
    }
  }

  return result;
}

/**
 * Optimally matches a set of photos to geometric slots using Kuhn-Munkres energy minimization.
 */
export function matchPhotosToSlots(
  photos: PhotoAspectInput[],
  slots: RectBounds[]
): MatchResult {
  const n = photos.length;
  if (n === 0 || slots.length === 0) {
    return { mapping: [], score: 100, avgCropPenalty: 0 };
  }

  const maxSlotArea = Math.max(...slots.map(s => s.width * s.height), 1);

  // Build N x slots.length cost matrix
  const costMatrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    const p = photos[i] ?? { aspect: 1.5 };
    const row: number[] = [];
    for (let j = 0; j < slots.length; j++) {
      const s = slots[j] ?? { x: 0, y: 0, width: 100, height: 100 };
      row.push(calculateSlotCost(p, s, maxSlotArea));
    }
    costMatrix.push(row);
  }

  const mapping = solveHungarian(costMatrix);

  let totalCost = 0;
  let totalCrop = 0;

  for (let i = 0; i < n; i++) {
    const slotIdx = mapping[i] ?? -1;
    const photo = photos[i] ?? { aspect: 1.5 };
    const costRow = costMatrix[i];

    if (slotIdx >= 0 && slotIdx < slots.length && costRow) {
      totalCost += costRow[slotIdx] ?? 0;
      const slot = slots[slotIdx];
      if (slot) {
        const pAsp = photo.aspect > 0 ? photo.aspect : 1.5;
        const sAsp = slot.height > 0 ? slot.width / slot.height : 1.5;
        const crop = 1 - Math.min(pAsp / sAsp, sAsp / pAsp);
        totalCrop += crop;
      }
    }
  }

  const score = Math.max(0, Math.min(100, Math.round(100 - (totalCost / n) * 25)));
  const avgCropPenalty = n > 0 ? Math.round((totalCrop / n) * 1000) / 1000 : 0;

  return { mapping, score, avgCropPenalty };
}
