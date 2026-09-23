import { AdaptivePhoto, AdaptiveLayoutVariation } from '../adaptiveLayout';
import { generateDynamicVariations, LayoutGeneratorOptions } from '../layout/generator';
import {
  clusterPhotosChronologically,
  ClusterOptions,
} from './temporalClusterer';
import { optimizeClusterCadence, getCadenceArchetype } from './cadenceEngine';

export interface AutoFlowSpreadPlan {
  spreadIndex: number;
  clusterReason: string;
  cadenceArchetype: string;
  photos: AdaptivePhoto[];
  selectedVariation: AdaptiveLayoutVariation;
}

export interface AutoFlowProgress {
  percent: number;
  currentSpread: number;
  totalSpreads: number;
}

/**
 * Synchronous Auto-Flow Plan Generator.
 * Given an arbitrary pool of photos, clusters them chronologically, optimizes cadence,
 * and synthesizes the highest harmony layout variation for each spread.
 */
export function generateAutoFlowPlan(
  photos: AdaptivePhoto[],
  generatorOptions: LayoutGeneratorOptions,
  clusterOptions?: Partial<ClusterOptions>
): AutoFlowSpreadPlan[] {
  if (photos.length === 0) return [];

  const rawClusters = clusterPhotosChronologically(photos, clusterOptions);
  const optimizedClusters = optimizeClusterCadence(rawClusters);

  const plans: AutoFlowSpreadPlan[] = [];

  for (let idx = 0; idx < optimizedClusters.length; idx++) {
    const cluster = optimizedClusters[idx]!;
    const variations = generateDynamicVariations(generatorOptions, cluster.photos);

    if (variations.length === 0) continue;

    // Pick top-scoring variation
    const sorted = [...variations].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const best = sorted[0] || variations[0]!;

    plans.push({
      spreadIndex: idx,
      clusterReason: cluster.reason,
      cadenceArchetype: getCadenceArchetype(cluster.photos.length),
      photos: cluster.photos,
      selectedVariation: best,
    });
  }

  return plans;
}

/**
 * Asynchronous / Non-Blocking Auto-Flow Plan Generator with progress streaming.
 * Yields periodically to the event loop so 50+ photo batches do not block the UI thread.
 */
export async function generateAutoFlowPlanAsync(
  photos: AdaptivePhoto[],
  generatorOptions: LayoutGeneratorOptions,
  clusterOptions?: Partial<ClusterOptions>,
  onProgress?: (progress: AutoFlowProgress) => void
): Promise<AutoFlowSpreadPlan[]> {
  if (photos.length === 0) return [];

  const rawClusters = clusterPhotosChronologically(photos, clusterOptions);
  const optimizedClusters = optimizeClusterCadence(rawClusters);
  const totalSpreads = optimizedClusters.length;

  const plans: AutoFlowSpreadPlan[] = [];

  for (let idx = 0; idx < optimizedClusters.length; idx++) {
    const cluster = optimizedClusters[idx]!;
    const variations = generateDynamicVariations(generatorOptions, cluster.photos);

    if (variations.length > 0) {
      const sorted = [...variations].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      const best = sorted[0] || variations[0]!;

      plans.push({
        spreadIndex: idx,
        clusterReason: cluster.reason,
        cadenceArchetype: getCadenceArchetype(cluster.photos.length),
        photos: cluster.photos,
        selectedVariation: best,
      });
    }

    if (onProgress) {
      const percent = Math.round(((idx + 1) / totalSpreads) * 100);
      onProgress({
        percent,
        currentSpread: idx + 1,
        totalSpreads,
      });
    }

    // Yield to event loop every 2 spreads
    if (idx % 2 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return plans;
}
