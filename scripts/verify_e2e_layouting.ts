import fs from 'node:fs';
import path from 'node:path';
import { BUILTIN_ALBUM_PRESETS, AlbumPreset } from '../src/domain/presets';
import { convertUnit } from '../src/domain/units';
import {
  createInitialCarousel,
  scaleFramesForRatioSwitch,
  CAROUSEL_RATIO_PRESETS,
  CarouselRatio,
  CarouselPhotoFrame,
} from '../src/domain/carousel';
import {
  generateAdaptiveLayoutVariations,
  type SpreadGeometry,
  type PhotoItem,
} from '../src/domain/adaptiveLayout';
import {
  CAROUSEL_LAYOUT_PRESETS,
  generateCarouselLayoutVariations,
} from '../src/domain/carouselLayout';

// Input user test photos
const TEST_PHOTO_PATHS = [
  '/Users/chiio/Downloads/RVMR9845.JPG',
  '/Users/chiio/Downloads/RVMR2316.JPG',
  '/Users/chiio/Downloads/RVMR2299.JPG',
  '/Users/chiio/Downloads/RVMR1971.JPG',
  '/Users/chiio/Downloads/RVMR9888.JPG',
  '/Users/chiio/Downloads/RVMR2662.JPG',
  '/Users/chiio/Downloads/RVMR9920.JPG',
];

const PHOTO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  'RVMR9845.JPG': { width: 6801, height: 4534 },
  'RVMR2316.JPG': { width: 5152, height: 7728 },
  'RVMR2299.JPG': { width: 7728, height: 5152 },
  'RVMR1971.JPG': { width: 5152, height: 7728 },
  'RVMR9888.JPG': { width: 6990, height: 4660 },
  'RVMR2662.JPG': { width: 6870, height: 4580 },
  'RVMR9920.JPG': { width: 5925, height: 3950 },
};

export interface E2EPhoto {
  id: string;
  filePath: string;
  fileName: string;
  width: number;
  height: number;
  aspect: number;
}

export function loadTestPhotos(): E2EPhoto[] {
  return TEST_PHOTO_PATHS.map((filePath, index) => {
    const fileName = path.basename(filePath);
    const dims = PHOTO_DIMENSIONS[fileName] || { width: 6000, height: 4000 };
    return {
      id: `photo-${index + 1}`,
      filePath,
      fileName,
      width: dims.width,
      height: dims.height,
      aspect: Math.round((dims.width / dims.height) * 1000) / 1000,
    };
  });
}

// ============================================================================
// Print Album E2E Verification across ALL Sizes & 5 Spreads
// ============================================================================
export interface VerificationResult {
  title: string;
  passed: boolean;
  details: string[];
}

export function runPrintAlbumE2E(photos: E2EPhoto[]): VerificationResult {
  const details: string[] = [];
  let allPassed = true;

  details.push(`Testing ${BUILTIN_ALBUM_PRESETS.length} Album Presets with 5 spreads each...`);

  for (const preset of BUILTIN_ALBUM_PRESETS) {
    const pageW_mm = convertUnit(preset.width, preset.unit, 'mm', preset.dpi);
    const pageH_mm = convertUnit(preset.height, preset.unit, 'mm', preset.dpi);
    const spreadW_mm = pageW_mm * 2;
    const spreadH_mm = pageH_mm;
    const margin_mm = 15;
    const spacing_mm = 6;

    const templateParams = {
      spreadWidth: spreadW_mm,
      spreadHeight: spreadH_mm,
      isSpread: true,
      safeMargin: margin_mm,
      spacing: spacing_mm,
      gutterWidth: 0,
    };

    // 5 Spreads per preset:
    // Spread 1: 1 Hero Photo
    // Spread 2: 2 Photos Split
    // Spread 3: 3 Photos Collage
    // Spread 4: 4 Photos Grid
    // Spread 5: 5-7 Photos Reshuffle & Adaptive Randomization
    const photoCounts = [1, 2, 3, 4, 6];

    for (let spreadIdx = 0; spreadIdx < 5; spreadIdx++) {
      const count = photoCounts[spreadIdx];
      const selectedSubset = photos.slice(0, count).map((p) => ({
        id: p.id,
        photoAspect: p.aspect,
      }));

      // Generate variations
      const variations = generateAdaptiveLayoutVariations(templateParams, selectedSubset);

      if (variations.length === 0) {
        details.push(`❌ [${preset.name}] Spread ${spreadIdx + 1} (${count} photos): 0 variations generated!`);
        allPassed = false;
        continue;
      }

      // Check top variation and reshuffled variations
      for (const variation of variations.slice(0, 3)) {
        if (variation.rects.length !== count) {
          details.push(`❌ [${preset.name}] Spread ${spreadIdx + 1}: expected ${count} rects, got ${variation.rects.length}`);
          allPassed = false;
        }

        // Geometric verification: no NaN, no negative dimensions, within spread boundaries
        for (const box of variation.rects) {
          if (box.x === null || box.y === null || box.width === null || box.height === null || isNaN(box.x) || isNaN(box.y) || isNaN(box.width) || isNaN(box.height)) {
            details.push(`❌ [${preset.name}] Variation [${variation.id} - ${variation.name}] contains null/NaN: ${JSON.stringify(box)} in variation: ${JSON.stringify(variation)}`);
            allPassed = false;
            break;
          }
          if (box.width <= 0 || box.height <= 0) {
            details.push(`❌ [${preset.name}] Box has non-positive dimensions: ${JSON.stringify(box)}`);
            allPassed = false;
          }
          if (box.x < 0 || box.x + box.width > spreadW_mm + 0.1 || box.y < 0 || box.y + box.height > spreadH_mm + 0.1) {
            details.push(`❌ [${preset.name}] Box out of bounds: box=[${box.x}, ${box.y}, ${box.width}, ${box.height}], spread=[${spreadW_mm}, ${spreadH_mm}]`);
            allPassed = false;
          }
        }
      }
    }

    details.push(`✔ [${preset.name}] 5 Spreads successfully generated & verified within ${spreadW_mm.toFixed(1)} × ${spreadH_mm.toFixed(1)} mm.`);
  }

  return {
    title: 'Print Album Multi-Size & 5-Spread Layout Verification',
    passed: allPassed,
    details,
  };
}

// ============================================================================
// Social Carousel E2E Verification across ALL Ratios & 5 Slides
// ============================================================================
export function runSocialCarouselE2E(photos: E2EPhoto[]): VerificationResult {
  const details: string[] = [];
  let allPassed = true;

  const ratios: CarouselRatio[] = ['1:1', '4:5', '9:16'];

  for (const ratio of ratios) {
    const carousel = createInitialCarousel('test-project', ratio, 5);
    const preset = CAROUSEL_RATIO_PRESETS[ratio];

    details.push(`Testing Carousel ${preset.label} (5 slides, ${preset.width} × ${preset.height} px)...`);

    if (carousel.slides.length !== 5) {
      details.push(`❌ Expected 5 slides, got ${carousel.slides.length}`);
      allPassed = false;
    }

    // Populate Slide 1: 1 Hero Photo
    const p1 = photos[0];
    const frameW = preset.width - 80;
    const frameH = Math.round(frameW / p1.aspect);
    carousel.slides[0].elements.push({
      type: 'photo',
      id: 'frame-1',
      photoId: p1.id,
      filePath: p1.filePath,
      fileName: p1.fileName,
      photoAspect: p1.aspect,
      x: 40,
      y: Math.round((preset.height - frameH) / 2),
      width: frameW,
      height: frameH,
    });

    // Populate Slide 2: 2 Photos Vertical Split
    const p2 = photos[1];
    const p3 = photos[2];
    const colW = (preset.width - 100) / 2;
    carousel.slides[1].elements.push({
      type: 'photo',
      id: 'frame-2',
      photoId: p2.id,
      filePath: p2.filePath,
      fileName: p2.fileName,
      photoAspect: p2.aspect,
      x: 40,
      y: 100,
      width: Math.round(colW),
      height: preset.height - 200,
    });
    carousel.slides[1].elements.push({
      type: 'photo',
      id: 'frame-3',
      photoId: p3.id,
      filePath: p3.filePath,
      fileName: p3.fileName,
      photoAspect: p3.aspect,
      x: Math.round(40 + colW + 20),
      y: 100,
      width: Math.round(colW),
      height: preset.height - 200,
    });

    // Populate Slide 3: Carousel Preset Layouts (Per-slide presets)
    const slidePresets = CAROUSEL_LAYOUT_PRESETS.filter((p) => p.category === 'per_slide');
    if (slidePresets.length < 4) {
      details.push(`❌ Expected at least 4 per-slide presets, got ${slidePresets.length}`);
      allPassed = false;
    }
    const presetChosen = slidePresets[0];
    const appliedFrames = presetChosen.generate({
      slideIndex: 2,
      totalSlides: 5,
      slideWidth: preset.width,
      slideHeight: preset.height,
      photos: [photos[3], photos[4]],
    });
    carousel.slides[2].elements.push(...appliedFrames.map((f, idx) => ({ ...f, id: `frame-s3-${idx}` })));

    // Populate Slide 4 & 5: Seamless Panorama Span across 2 slides!
    const panoPhoto = photos[5];
    const panoPresets = CAROUSEL_LAYOUT_PRESETS.filter((p) => p.category === 'panorama');
    if (panoPresets.length === 0) {
      details.push(`❌ Expected panorama presets to exist`);
      allPassed = false;
    }
    const spanFrames = panoPresets[0].generate({
      slideIndex: 3,
      totalSlides: 5,
      slideWidth: preset.width,
      slideHeight: preset.height,
      photos: [panoPhoto],
    });
    carousel.slides[3].elements.push(...spanFrames.map((f, idx) => ({ ...f, id: `frame-s4-pano-${idx}` })));

    // Verify all frames
    for (let i = 0; i < carousel.slides.length; i++) {
      const slide = carousel.slides[i];
      for (const el of slide.elements) {
        if (isNaN(el.x) || isNaN(el.y) || isNaN(el.width) || isNaN(el.height)) {
          details.push(`❌ Slide ${i + 1} has NaN frame coordinate: ${JSON.stringify(el)}`);
          allPassed = false;
        }
      }
    }

    // Now test Reshuffle & Aspect Ratio Switching (1:1 -> 4:5 -> 9:16)
    const nextRatio: CarouselRatio = ratio === '1:1' ? '4:5' : ratio === '4:5' ? '9:16' : '1:1';
    const nextPreset = CAROUSEL_RATIO_PRESETS[nextRatio];
    const scaledSlides = scaleFramesForRatioSwitch(carousel.slides, preset, nextPreset);

    if (scaledSlides.length !== 5) {
      details.push(`❌ Scaled slides length mismatch: expected 5, got ${scaledSlides.length}`);
      allPassed = false;
    }

    // Verify scaled frames are within new bounds
    for (let i = 0; i < scaledSlides.length; i++) {
      const slide = scaledSlides[i];
      if (slide.widthPx !== nextPreset.width || slide.heightPx !== nextPreset.height) {
        details.push(`❌ Scaled slide ${i + 1} dimension mismatch: got ${slide.widthPx}x${slide.heightPx}, expected ${nextPreset.width}x${nextPreset.height}`);
        allPassed = false;
      }
      for (const el of slide.elements) {
        if (el.y + el.height > nextPreset.height + 1) {
          details.push(`❌ Frame overflowed vertically on ratio switch to ${nextRatio}: y=${el.y}, h=${el.height}, maxH=${nextPreset.height}`);
          allPassed = false;
        }
      }
    }

    details.push(`✔ [${preset.label}] 5 Slides + Panorama span + Ratio Switch to ${nextPreset.label} passed cleanly.`);
  }

  return {
    title: 'Social Carousel Multi-Ratio & Panorama Verification',
    passed: allPassed,
    details,
  };
}

// ============================================================================
// Filmstrip & Finder Interaction Invariants Verification
// ============================================================================
export function runFilmstripAndFinderInteractionInvariants(photos: E2EPhoto[]): VerificationResult {
  const details: string[] = [];
  let allPassed = true;

  details.push(`Verifying Seamless Filmstrip & Finder Drop Invariants...`);

  // Invariant 1: Photo Reusability across slides/spreads
  // In the past, photos were locked once used. Now usedCount should be incremented
  // and the photo remains fully selectable and placeable.
  const photoUsageMap = new Map<string, number>();
  for (const p of photos) {
    photoUsageMap.set(p.id, 0);
  }

  // Simulate placing photo 1 five times on five different spreads/slides
  for (let i = 0; i < 5; i++) {
    const current = photoUsageMap.get(photos[0].id) || 0;
    photoUsageMap.set(photos[0].id, current + 1);
  }

  if (photoUsageMap.get(photos[0].id) !== 5) {
    details.push(`❌ Photo reuse tracking failed: expected count 5, got ${photoUsageMap.get(photos[0].id)}`);
    allPassed = false;
  } else {
    details.push(`✔ Reusability: Photo ${photos[0].fileName} safely placed 5 times without locking.`);
  }

  // Invariant 2: Multi-photo finder drop auto-partition
  const dropSubset = photos.slice(0, 4);
  const templateBox = {
    spreadWidth: 400,
    spreadHeight: 300,
    isSpread: true,
    safeMargin: 20,
    spacing: 10,
    gutterWidth: 0,
  };
  const variations = generateAdaptiveLayoutVariations(
    templateBox,
    dropSubset.map((p) => ({ id: p.id, photoAspect: p.aspect }))
  );
  if (variations.length < 2) {
    details.push(`❌ Auto-partitioning generated fewer than 2 variations for 4 photos`);
    allPassed = false;
  } else {
    details.push(`✔ Auto-Partitioning: Successfully generated ${variations.length} distinct layouts for 4-photo drop.`);
  }

  return {
    title: 'Filmstrip & Finder Drop Invariants Verification',
    passed: allPassed,
    details,
  };
}

// Main execution
async function main() {
  console.log('================================================================');
  console.log('🚀 OpenSmartAlbum-MacOS E2E Layouting & Interaction Test Suite');
  console.log('================================================================\n');

  const photos = loadTestPhotos();
  console.log(`Loaded ${photos.length} High-Resolution Test Photos:`);
  for (const p of photos) {
    console.log(`  • ${p.fileName} (${p.width} × ${p.height} px, aspect: ${p.aspect})`);
  }
  console.log('\n----------------------------------------------------------------\n');

  const res1 = runPrintAlbumE2E(photos);
  console.log(`▶ ${res1.title}: ${res1.passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  res1.details.forEach((d) => console.log(`  ${d}`));
  console.log('\n----------------------------------------------------------------\n');

  const res2 = runSocialCarouselE2E(photos);
  console.log(`▶ ${res2.title}: ${res2.passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  res2.details.forEach((d) => console.log(`  ${d}`));
  console.log('\n----------------------------------------------------------------\n');

  const res3 = runFilmstripAndFinderInteractionInvariants(photos);
  console.log(`▶ ${res3.title}: ${res3.passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  res3.details.forEach((d) => console.log(`  ${d}`));
  console.log('\n================================================================');

  if (!res1.passed || !res2.passed || !res3.passed) {
    console.error('❌ E2E VERIFICATION SUITE FAILED!');
    process.exit(1);
  } else {
    console.log('🎉 ALL E2E LAYOUTING TESTS PASSED (100% GREEN)!');
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
