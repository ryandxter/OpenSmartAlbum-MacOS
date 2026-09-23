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

import { clusterPhotosChronologically } from '../temporalClusterer';
import { optimizeClusterCadence, getCadenceArchetype } from '../cadenceEngine';
import { generateAutoFlowPlan, generateAutoFlowPlanAsync } from '../autoFlowEngine';
import { AdaptivePhoto } from '../../adaptiveLayout';

console.log('🧪 Starting Plan 11-01: Temporal Clustering & Cadence Storytelling Engine Tests...\n');

// Helper to generate mock photos with timestamps
function makePhotos(count: number, startIso: string, stepMinutes: number): AdaptivePhoto[] {
  const baseTime = new Date(startIso).getTime();
  return Array.from({ length: count }, (_, i) => ({
    id: `photo-${i + 1}`,
    photoId: `pid-${i + 1}`,
    filePath: `/photos/img_${String(i + 1).padStart(3, '0')}.jpg`,
    fileName: `img_${String(i + 1).padStart(3, '0')}.jpg`,
    photoAspect: i % 2 === 0 ? 1.5 : 0.67,
    createdAt: new Date(baseTime + i * stepMinutes * 60 * 1000).toISOString(),
  }));
}

// Suite 1: Burst Separation with 30m Chapter Gaps & 5m Scene Gaps
{
  console.log('Running Suite 1: Burst separation with 30m chapter gaps and 5m scene gaps...');

  // 3 photos in Morning Prep (1m apart)
  const prep = makePhotos(3, '2026-06-15T09:00:00Z', 1);
  // 45m gap (Chapter Break) -> 4 photos in Ceremony (1m apart)
  const ceremony = makePhotos(4, '2026-06-15T09:46:00Z', 1);
  // 10m gap (Scene Break) -> 3 photos in Couple Session (1m apart)
  const portraits = makePhotos(3, '2026-06-15T10:00:00Z', 1);

  const allPhotos = [...prep, ...ceremony, ...portraits];
  assert.strictEqual(allPhotos.length, 10);

  const clusters = clusterPhotosChronologically(allPhotos, {
    chapterGapSeconds: 1800, // 30 min
    sceneGapSeconds: 300,    // 5 min
    maxPhotosPerSpread: 6,
  });

  assert.strictEqual(clusters.length, 3, 'Must create exactly 3 clusters for Prep, Ceremony, and Portraits');
  assert.strictEqual(clusters[0]!.photos.length, 3, 'Prep cluster should have 3 photos');
  assert.strictEqual(clusters[1]!.photos.length, 4, 'Ceremony cluster should have 4 photos');
  assert.strictEqual(clusters[1]!.reason, 'chapter_break', 'Ceremony should be marked chapter_break');
  assert.strictEqual(clusters[2]!.photos.length, 3, 'Portraits cluster should have 3 photos');

  console.log('  ✅ Suite 1 Passed: Chapter breaks and scene breaks accurately partitioned');
}

// Suite 2: Large Group Splitting (N = 18 photos split into clusters <= 6)
{
  console.log('\nRunning Suite 2: Large group splitting (18 photos split evenly <= 6)...');

  // 18 photos all within a 15-minute cocktail reception (no gaps > 5 min)
  const cocktail = makePhotos(18, '2026-06-15T18:00:00Z', 0.5);

  const clusters = clusterPhotosChronologically(cocktail, {
    maxPhotosPerSpread: 6,
  });

  // 18 / 6 = 3 clusters of 6 photos each
  assert.strictEqual(clusters.length, 3, '18 photos capped at 6 must produce 3 clusters');
  for (const c of clusters) {
    assert.ok(c.photos.length <= 6, `Cluster size ${c.photos.length} must be <= 6`);
    assert.strictEqual(c.photos.length, 6, 'Each cluster should hold 6 photos');
  }

  // Test odd count: 11 photos -> splits into 4 + 4 + 3
  const oddPhotos = makePhotos(11, '2026-06-15T19:00:00Z', 0.5);
  const oddClusters = clusterPhotosChronologically(oddPhotos, {
    maxPhotosPerSpread: 6,
  });
  assert.strictEqual(oddClusters.length, 2, '11 photos capped at 6 must produce 2 clusters');
  assert.strictEqual(oddClusters[0]!.photos.length, 6);
  assert.strictEqual(oddClusters[1]!.photos.length, 5);

  console.log('  ✅ Suite 2 Passed: Large groups split cleanly without exceeding spread capacity');
}

// Suite 3: Cadence Variety and Cadence Archetype
{
  console.log('\nRunning Suite 3: Cadence variety and archetype classification...');

  assert.strictEqual(getCadenceArchetype(1), 'hero');
  assert.strictEqual(getCadenceArchetype(2), 'duo');
  assert.strictEqual(getCadenceArchetype(3), 'trio');
  assert.strictEqual(getCadenceArchetype(4), 'quad');
  assert.strictEqual(getCadenceArchetype(5), 'grid');
  assert.strictEqual(getCadenceArchetype(6), 'grid');

  // Test anti-monotony: 3 consecutive clusters of 4 photos [4, 4, 4]
  const c1Photos = makePhotos(4, '2026-06-15T12:00:00Z', 1);
  const c2Photos = makePhotos(4, '2026-06-15T12:05:00Z', 1);
  const c3Photos = makePhotos(4, '2026-06-15T12:10:00Z', 1);

  const raw = [
    { clusterIndex: 0, photos: c1Photos, reason: 'initial' as const },
    { clusterIndex: 1, photos: c2Photos, reason: 'scene_break' as const },
    { clusterIndex: 2, photos: c3Photos, reason: 'scene_break' as const },
  ];

  const optimized = optimizeClusterCadence(raw);
  assert.strictEqual(optimized.length, 3);
  // c2 transferred 1 photo to c1 -> [5, 3, 4]
  assert.strictEqual(optimized[0]!.photos.length, 5);
  assert.strictEqual(optimized[1]!.photos.length, 3);
  assert.strictEqual(optimized[2]!.photos.length, 4);

  console.log('  ✅ Suite 3 Passed: Cadence engine eliminates monotonous repetitions');
}

// Suite 4: End-to-End Auto-Flow Plan Generation (35 Photos)
{
  console.log('\nRunning Suite 4: End-to-end auto-flow plan generation with 35 photos...');

  const weddingPhotos = makePhotos(35, '2026-06-15T10:00:00Z', 2);
  // Mark photo 10 as favorite (Hero moment)
  weddingPhotos[9]!.isFavorite = true;

  const plans = generateAutoFlowPlan(
    weddingPhotos,
    {
      containerWidth: 2000,
      containerHeight: 1000,
      spacing: 16,
      isSpread: true,
      gutterWidth: 40,
    },
    {
      maxPhotosPerSpread: 6,
      allowHeroSpreads: true,
    }
  );

  assert.ok(plans.length >= 6, `35 photos should generate at least 6 spreads, got ${plans.length}`);

  let totalPhotosInPlans = 0;
  for (const plan of plans) {
    assert.ok(plan.photos.length > 0, 'Every plan must contain at least 1 photo');
    assert.strictEqual(
      plan.selectedVariation.rects.length,
      plan.photos.length,
      `Spread ${plan.spreadIndex + 1} rects count must equal photos count`
    );
    totalPhotosInPlans += plan.photos.length;

    for (const rect of plan.selectedVariation.rects) {
      assert.ok(rect.width > 20 && rect.height > 20, 'Rect dimensions must be valid');
    }
  }

  // Zero-Loss Invariant: Total photos in plans must equal initial photos
  assert.strictEqual(
    totalPhotosInPlans,
    35,
    `Zero-Loss Invariant: All 35 photos must be accounted for in the generated spreads (got ${totalPhotosInPlans})`
  );

  console.log('  ✅ Suite 4 Passed: 35 photos planned across spreads with 100% photo preservation');
}

// Suite 5: Async Plan Generation with Progress Streaming
async function testAsyncAutoFlow() {
  console.log('\nRunning Suite 5: Async plan generation with progress callback...');
  const photos = makePhotos(20, '2026-06-15T14:00:00Z', 1);

  const progressUpdates: number[] = [];
  const plans = await generateAutoFlowPlanAsync(
    photos,
    {
      containerWidth: 1080,
      containerHeight: 1080,
      spacing: 16,
      isSpread: false,
    },
    { maxPhotosPerSpread: 4 },
    (p) => {
      progressUpdates.push(p.percent);
    }
  );

  assert.ok(plans.length > 0);
  assert.ok(progressUpdates.length > 0);
  assert.strictEqual(progressUpdates[progressUpdates.length - 1], 100);
  console.log('  ✅ Suite 5 Passed: Asynchronous streaming completed with 100% progress event');
}

testAsyncAutoFlow().then(() => {
  console.log('\n🎉 All Plan 11-01 Storytelling Engine tests passed successfully!\n');
});
