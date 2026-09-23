import { PhotoCluster } from './temporalClusterer';

export type CadenceArchetype = 'hero' | 'duo' | 'trio' | 'quad' | 'grid';

export function getCadenceArchetype(count: number): CadenceArchetype {
  switch (count) {
    case 1:
      return 'hero';
    case 2:
      return 'duo';
    case 3:
      return 'trio';
    case 4:
      return 'quad';
    default:
      return 'grid';
  }
}

/**
 * Optimizes the visual rhythm across sequential clusters to avoid visual monotony.
 * For instance, prevents [4, 4, 4] by smoothing into [3, 5, 4] or [5, 3, 4] if allowed.
 */
export function optimizeClusterCadence(clusters: PhotoCluster[]): PhotoCluster[] {
  if (clusters.length <= 2) return clusters;

  // Clone clusters so we don't mutate input
  const result: PhotoCluster[] = clusters.map((c) => ({
    ...c,
    photos: [...c.photos],
  }));

  // Iterate clusters and look for runs of 3 identical counts
  for (let i = 0; i < result.length - 2; i++) {
    const c1 = result[i]!;
    const c2 = result[i + 1]!;
    const c3 = result[i + 2]!;

    // If 3 consecutive clusters have identical photo count (e.g. 4, 4, 4)
    if (c1.photos.length === c2.photos.length && c2.photos.length === c3.photos.length) {
      const count = c1.photos.length;

      // Only rebalance if count is 3 or 4 and c2 is not a hard chapter break
      if ((count === 3 || count === 4) && c2.reason !== 'chapter_break' && c2.photos.length > 2) {
        // Shift 1 photo from c2 to c1
        const movedPhoto = c2.photos.shift();
        if (movedPhoto) {
          c1.photos.push(movedPhoto);
        }
      }
    }
  }

  // Filter out any accidentally empty cluster and re-index
  return result
    .filter((c) => c.photos.length > 0)
    .map((c, idx) => ({
      ...c,
      clusterIndex: idx,
    }));
}
