import { AdaptivePhoto } from '../adaptiveLayout';

export interface ClusterOptions {
  maxPhotosPerSpread: number;
  minPhotosPerSpread: number;
  chapterGapSeconds: number; // e.g. 1800s (30m) -> hard split
  sceneGapSeconds: number;   // e.g. 300s (5m) -> soft split
  allowHeroSpreads: boolean; // allow 1-photo hero spreads
}

export const DEFAULT_CLUSTER_OPTIONS: ClusterOptions = {
  maxPhotosPerSpread: 6,
  minPhotosPerSpread: 1,
  chapterGapSeconds: 1800,
  sceneGapSeconds: 300,
  allowHeroSpreads: true,
};

export interface PhotoCluster {
  clusterIndex: number;
  photos: AdaptivePhoto[];
  reason: 'chapter_break' | 'scene_break' | 'size_cap' | 'hero_moment' | 'initial';
}

function parsePhotoTimestamp(photo: AdaptivePhoto): number {
  if (photo.createdAt) {
    const t = new Date(photo.createdAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  return 0;
}

function extractNaturalNumber(fileName?: string): number {
  if (!fileName) return 0;
  const match = fileName.match(/(\d+)/);
  return match && match[1] ? parseInt(match[1], 10) : 0;
}

/**
 * Sorts photos in chronological order using timestamp or natural filename order.
 */
export function sortPhotosChronologically(photos: AdaptivePhoto[]): AdaptivePhoto[] {
  return [...photos].sort((a, b) => {
    const timeA = parsePhotoTimestamp(a);
    const timeB = parsePhotoTimestamp(b);
    if (timeA !== 0 && timeB !== 0 && timeA !== timeB) {
      return timeA - timeB;
    }
    // Fallback: natural filename sort
    const numA = extractNaturalNumber(a.fileName || a.filePath);
    const numB = extractNaturalNumber(b.fileName || b.filePath);
    if (numA !== numB) {
      return numA - numB;
    }
    const nameA = a.fileName || a.filePath || a.id || '';
    const nameB = b.fileName || b.filePath || b.id || '';
    return nameA.localeCompare(nameB, undefined, { numeric: true });
  });
}

/**
 * Splits a list of photos into clusters bounded by maxPhotosPerSpread.
 * If a cluster exceeds maxPhotos, splits it evenly (e.g. 8 -> 4 + 4, 7 -> 3 + 4, 11 -> 4 + 4 + 3).
 */
function splitOversizedCluster(
  photos: AdaptivePhoto[],
  maxSize: number,
  reason: PhotoCluster['reason']
): PhotoCluster[] {
  if (photos.length <= maxSize) {
    return [{ clusterIndex: 0, photos, reason }];
  }

  const numSplits = Math.ceil(photos.length / maxSize);
  const baseSize = Math.floor(photos.length / numSplits);
  let remainder = photos.length % numSplits;

  const result: PhotoCluster[] = [];
  let startIndex = 0;

  for (let i = 0; i < numSplits; i++) {
    const currentChunkSize = baseSize + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;

    const chunk = photos.slice(startIndex, startIndex + currentChunkSize);
    startIndex += currentChunkSize;

    result.push({
      clusterIndex: result.length,
      photos: chunk,
      reason: i === 0 ? reason : 'size_cap',
    });
  }

  return result;
}

/**
 * Partitions photos into storytelling clusters based on EXIF burst detection,
 * hard chapter gaps, soft scene gaps, and spread capacity constraints.
 */
export function clusterPhotosChronologically(
  photos: AdaptivePhoto[],
  userOptions?: Partial<ClusterOptions>
): PhotoCluster[] {
  if (photos.length === 0) return [];

  const opts: ClusterOptions = { ...DEFAULT_CLUSTER_OPTIONS, ...userOptions };
  const sorted = sortPhotosChronologically(photos);

  const rawClusters: PhotoCluster[] = [];
  let currentGroup: AdaptivePhoto[] = [];
  let nextReason: PhotoCluster['reason'] = 'initial';

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]!;
    if (currentGroup.length === 0) {
      currentGroup.push(current);
      continue;
    }

    const prev = sorted[i - 1]!;
    const timePrev = parsePhotoTimestamp(prev);
    const timeCurr = parsePhotoTimestamp(current);

    const hasTimestamps = timePrev > 0 && timeCurr > 0;
    const deltaSeconds = hasTimestamps ? Math.max(0, (timeCurr - timePrev) / 1000) : 0;

    // Check for hard chapter break (e.g. >30 minutes gap)
    if (hasTimestamps && deltaSeconds >= opts.chapterGapSeconds) {
      rawClusters.push({
        clusterIndex: rawClusters.length,
        photos: currentGroup,
        reason: nextReason,
      });
      currentGroup = [current];
      nextReason = 'chapter_break';
      continue;
    }

    // Check for soft scene break (e.g. >5 minutes gap) if current group already has >= 2 photos
    if (hasTimestamps && deltaSeconds >= opts.sceneGapSeconds && currentGroup.length >= 2) {
      rawClusters.push({
        clusterIndex: rawClusters.length,
        photos: currentGroup,
        reason: nextReason,
      });
      currentGroup = [current];
      nextReason = 'scene_break';
      continue;
    }

    // Check for hero moment: if single photo is favorite or extreme panorama (aspect >= 2.2)
    if (opts.allowHeroSpreads && (current.isFavorite || (current.photoAspect && current.photoAspect >= 2.2))) {
      // Flush previous group if not empty
      if (currentGroup.length > 0) {
        rawClusters.push({
          clusterIndex: rawClusters.length,
          photos: currentGroup,
          reason: nextReason,
        });
      }
      // Hero spread
      rawClusters.push({
        clusterIndex: rawClusters.length,
        photos: [current],
        reason: 'hero_moment',
      });
      currentGroup = [];
      nextReason = 'scene_break';
      continue;
    }

    currentGroup.push(current);
  }

  if (currentGroup.length > 0) {
    rawClusters.push({
      clusterIndex: rawClusters.length,
      photos: currentGroup,
      reason: nextReason,
    });
  }

  // Now, enforce maxPhotosPerSpread cap by splitting any oversized cluster
  const finalClusters: PhotoCluster[] = [];
  for (const cluster of rawClusters) {
    if (cluster.photos.length > opts.maxPhotosPerSpread) {
      const splits = splitOversizedCluster(cluster.photos, opts.maxPhotosPerSpread, cluster.reason);
      finalClusters.push(...splits);
    } else {
      finalClusters.push(cluster);
    }
  }

  // Re-index clusters sequentially
  return finalClusters.map((c, idx) => ({
    ...c,
    clusterIndex: idx,
  }));
}
