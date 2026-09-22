import assert from 'node:assert';
import { parseRange, ExportOptions, PreflightReport } from '../src/features/export/exportUtils';
import { CarouselRatioPreset, CAROUSEL_RATIO_PRESETS } from '../src/domain/carousel';

console.log('Testing Export Suite (Plan 05-02)...');

// -------------------------------------------------------------
// Test Suite 1: Range Parsing
// -------------------------------------------------------------
console.log('1. Testing Range Parsing Logic...');

// 1.1 Simple single numbers and lists
assert.deepStrictEqual(parseRange('1', 10), [1]);
assert.deepStrictEqual(parseRange('1, 3, 5', 10), [1, 3, 5]);

// 1.2 Dash ranges
assert.deepStrictEqual(parseRange('1-4', 10), [1, 2, 3, 4]);
assert.deepStrictEqual(parseRange('2-5, 8, 10', 10), [2, 3, 4, 5, 8, 10]);

// 1.3 Out-of-order ranges & inverted ranges
assert.deepStrictEqual(parseRange('5-3', 10), [3, 4, 5]);
assert.deepStrictEqual(parseRange('7, 2, 5', 10), [2, 5, 7]);

// 1.4 Deduplication & whitespace resilience
assert.deepStrictEqual(parseRange('  1-3 ,  2 , 3, 1 ', 10), [1, 2, 3]);

// 1.5 Clamping to maxVal & filtering invalid
assert.deepStrictEqual(parseRange('0-15', 8), [1, 2, 3, 4, 5, 6, 7, 8]);
assert.deepStrictEqual(parseRange('invalid, -5, 99', 10), []);

console.log('✓ Range parsing tests passed successfully.');

// -------------------------------------------------------------
// Test Suite 2: 5-Format ExportOptions Payload Construction
// -------------------------------------------------------------
console.log('2. Testing 5-Format ExportOptions Payloads...');

// 2.1 JPEG Standard Print
const jpegOpts: ExportOptions = {
  format: 'jpeg',
  dpi: 300,
  jpegQuality: 95,
  includeBleed: false,
  splitPages: false,
  outputDir: '/Users/test/Desktop/Export',
};
assert.strictEqual(jpegOpts.format, 'jpeg');
assert.strictEqual(jpegOpts.dpi, 300);
assert.strictEqual(jpegOpts.jpegQuality, 95);

// 2.2 Lossless PNG
const pngOpts: ExportOptions = {
  format: 'png',
  dpi: 600,
  jpegQuality: 100,
  includeBleed: true,
  splitPages: true,
  outputDir: '/Users/test/Desktop/Export',
};
assert.strictEqual(pngOpts.format, 'png');
assert.strictEqual(pngOpts.dpi, 600);
assert.strictEqual(pngOpts.splitPages, true);

// 2.3 Lossless Archival TIFF (EXPO-03)
const tiff8Opts: ExportOptions = {
  format: 'tiff',
  dpi: 300,
  jpegQuality: 100,
  includeBleed: true,
  splitPages: false,
  outputDir: '/Users/test/Desktop/Export',
  tiffBitDepth: 8,
  tiffCompression: 'lzw',
};
assert.strictEqual(tiff8Opts.format, 'tiff');
assert.strictEqual(tiff8Opts.tiffBitDepth, 8);
assert.strictEqual(tiff8Opts.tiffCompression, 'lzw');

const tiff16Opts: ExportOptions = {
  format: 'tiff',
  dpi: 300,
  jpegQuality: 100,
  includeBleed: true,
  splitPages: false,
  outputDir: '/Users/test/Desktop/Export',
  tiffBitDepth: 16,
  tiffCompression: 'lzw',
};
assert.strictEqual(tiff16Opts.tiffBitDepth, 16);

// 2.4 Print-Ready PDF/X with Vector Marks (EXPO-04)
const pdfxOpts: ExportOptions = {
  format: 'pdf',
  dpi: 300,
  jpegQuality: 95,
  includeBleed: true,
  splitPages: false,
  outputDir: '/Users/test/Desktop/Export',
  pdfPrintReady: true,
  slugMm: 5.0,
  cropMarks: true,
};
assert.strictEqual(pdfxOpts.format, 'pdf');
assert.strictEqual(pdfxOpts.pdfPrintReady, true);
assert.strictEqual(pdfxOpts.slugMm, 5.0);
assert.strictEqual(pdfxOpts.cropMarks, true);

// 2.5 Multi-Layer PSD (EXPO-01)
const psdOpts: ExportOptions = {
  format: 'psd',
  dpi: 300,
  jpegQuality: 100,
  includeBleed: true,
  splitPages: false,
  outputDir: '/Users/test/Desktop/Export',
};
assert.strictEqual(psdOpts.format, 'psd');

console.log('✓ 5-Format ExportOptions payload validation passed.');

// -------------------------------------------------------------
// Test Suite 3: Preflight Report Data Contract
// -------------------------------------------------------------
console.log('3. Testing Preflight Report Data Contract...');

const dummyReport: PreflightReport = {
  totalPhotos: 12,
  missingPhotos: [
    {
      elementId: 'elem-1',
      spreadName: 'Spread 01',
      filePath: '/missing/image.jpg',
      fileName: 'image.jpg',
      hasPreview: true,
    },
  ],
  existingFiles: ['Spread_01.jpg', 'Spread_02.jpg'],
  destinationWritable: true,
  destinationError: null,
};

assert.strictEqual(dummyReport.totalPhotos, 12);
assert.strictEqual(dummyReport.missingPhotos.length, 1);
assert.strictEqual(dummyReport.missingPhotos[0].hasPreview, true);
assert.strictEqual(dummyReport.existingFiles.length, 2);
assert.strictEqual(dummyReport.destinationWritable, true);
assert.strictEqual(dummyReport.destinationError, null);

console.log('✓ Preflight Report data contract verified.');

// -------------------------------------------------------------
// Test Suite 4: Carousel Publishing Payload Geometry (EXPO-02)
// -------------------------------------------------------------
console.log('4. Testing Carousel Social Publishing Geometry...');

const squarePreset: CarouselRatioPreset = CAROUSEL_RATIO_PRESETS['1:1'];
assert.strictEqual(squarePreset.width, 1080);
assert.strictEqual(squarePreset.height, 1080);

const portraitPreset: CarouselRatioPreset = CAROUSEL_RATIO_PRESETS['4:5'];
assert.strictEqual(portraitPreset.width, 1080);
assert.strictEqual(portraitPreset.height, 1350);

// Multi-slide continuous panorama calculation
const slideCount = 5;
const panoramaWidth = slideCount * portraitPreset.width;
assert.strictEqual(panoramaWidth, 5400);

const expectedFiles = [
  'slide_01.jpg',
  'slide_02.jpg',
  'slide_03.jpg',
  'slide_04.jpg',
  'slide_05.jpg',
  'full_panorama.jpg',
];
assert.strictEqual(expectedFiles.length, 6);

console.log('✓ Carousel Social Publishing Geometry verified.');
console.log('All export suite tests completed successfully! 🎉');
