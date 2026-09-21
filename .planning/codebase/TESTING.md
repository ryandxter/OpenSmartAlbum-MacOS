---
last_mapped_commit: a7d32d2e29106b6263ac48059f328f6de747f7b8
last_mapped_at: 2026-09-21
---
# Testing Patterns and Quality Assurance

**Analysis Date:** 2026-09-21  
**Project:** AFSNSmartAlbum (`afsn-smart-album` v1.0.77)  
**Test Runners:** `tsx` + `node:assert/strict` (TypeScript/Frontend), `cargo test` (Rust Backend)

---

## 1. Testing Philosophy & Strategy

AFSNSmartAlbum employs a dual-stack testing strategy tailored for creative desktop software:

1. **Lightweight, Zero-Config Frontend Testing:**  
   Instead of heavyweight test frameworks like Vitest or Jest, frontend tests use Node.js's native `node:assert/strict` executed via `tsx`. This architecture provides:
   - Zero-overhead ES module execution of TypeScript files without build compilation steps.
   - Native modern Node.js assert primitives (`assert.strictEqual`, `assert.deepStrictEqual`, `assert.ok`).
   - Direct integration with `@tauri-apps/api/mocks` for fast IPC command mocking.
   - Immediate deterministic process exit codes for CI/CD and pre-commit checks.

2. **Rigorous Native Backend Testing:**  
   The Rust backend uses standard `cargo test` with module-level `#[cfg(test)]` blocks. Tests exercise real SQLite database transactions, filesystem atomic writes, EXIF parsing, and image rasterization pipelines.

3. **Separation of Pure Domain Math from UI:**  
   Complex geometric calculations (magnetic snapping, pasteboard viewports, adaptive layout partitioning, crop clamping, multi-frame rotations) are isolated in `src/domain/` as pure functions, enabling 100% deterministic test coverage without DOM overhead.

---

## 2. Frontend Test Suite

### 2.1 Test Directory Structure (`tests/`)

The `tests/` directory contains 17 automated test suites and 3 visual browser test harnesses:

| Test File | Target Domain / Store | Key Coverage Areas |
| :--- | :--- | :--- |
| `tests/adaptiveLayout.test.ts` | `src/domain/adaptiveLayout.ts` | Partitioning algorithms (`partitionPageBoxIntoKRects`), hero layout distributions (1–6+ photos), aspect ratio preservation, layout variation cycling. |
| `tests/album.test.ts` | `src/domain/album.ts`, `src/stores/albumStore.ts` | Spread creation (`createInitialAlbum`, `createInteriorSpread`), spread reordering, page numbering recalculation, asset synchronization, deep equality (`isAlbumDesignEqual`). |
| `tests/appPreferences.test.ts` | `src/domain/appPreferences.ts` | Magnetic snapping preferences, distance thresholds, default configuration loading/saving. |
| `tests/domain.test.ts` | `src/domain/units.ts`, `src/domain/presets.ts`, `src/domain/photo.ts` | Unit conversions (`mm`, `cm`, `inch`, `px`), DPI scaling, `calculateExportPixels`, dynamic gap limits (`getMaxGapForUnit`), custom preset lifecycles, photo filtering/sorting. |
| `tests/editor.test.ts` | `src/domain/editor.ts`, `src/stores/editorStore.ts` | Smart magnetic snapping math (margins, center gutter, neighbor boundaries), in-frame crop clamping, multi-frame alignment & distribution, fixed gap application, group rotation around center, marquee selection intersections. |
| `tests/history.test.ts` | `src/stores/historyStore.ts` | Undo/redo stacks, max history depth (50 snapshots), snapshot isolation, consecutive duplicate state suppression, redo invalidation on new actions. |
| `tests/importQueue.test.ts` | `src/stores/photoStore.ts` | Background photo import queue concurrency, cancellation handling, duplicate file path detection. |
| `tests/objectOpacity.test.ts` | `src/domain/editor.ts`, `src/domain/text.ts` | Object opacity fallback defaults (1.0 for backward compatibility), opacity clamping, multi-element opacity updates. |
| `tests/photoBatchPlacement.test.ts` | `src/domain/photoPlacement.ts` | Multi-photo drag-and-drop batch placement calculations, grid positioning on empty spreads. |
| `tests/previewGeometry.test.ts` | `src/domain/viewport.ts`, `src/domain/previewGeometry.ts` | Viewport scaling (`calculateSpreadViewport`), pasteboard extents (`calculatePasteboardViewport`), screen-to-spread coordinate mapping, zoom preservation. |
| `tests/projectPersistence.test.ts` | `src/stores/projectStore.ts` | Autosave vs manual save, Save As dialog workflows, local recovery database checkpoints, disk full/file locked error handling, legacy `.zip` to `.afsn` migration safeguards. |
| `tests/richText.test.ts` | `src/domain/richTextParser.ts`, `src/domain/richTextRenderer.ts` | BBCode-style rich text tags, text run parsing, multiline text measurement. |
| `tests/styledRanges.test.ts` | `src/domain/styledRanges.ts` | Plain-text + styled ranges model, range slicing, overlapping range formatting, range offset shifting on text edits. |
| `tests/templates.test.ts` | `src/domain/templates.ts` | Built-in album layout templates, usable page bounding boxes, margin clipping. |
| `tests/text.test.ts` | `src/domain/text.ts` | Text node instantiation, styling defaults, font conversions, tracking/leading math. |
| `tests/textHandling.test.ts` | `src/domain/text.ts`, `src/features/editor/TextNode.tsx` | Text frame auto-fitting (`calculateTextFitDimensions`), word wrapping boundaries, physical point scaling across units. |
| `tests/updateDownload.test.ts` | `src/services/updateService.ts`, `src/stores/appStore.ts` | Auto-update downloader lifecycle, byte formatting (`formatBytes`), progress tracking, background notification dismissal and reset. |

### 2.2 Visual & Browser Preview Test Harnesses

In addition to automated CLI test suites, the repository includes browser harnesses for visual regression inspection:

- `tests/pasteboard.preview.html` & `tests/pasteboard.preview.tsx`: Visual staging harness for testing canvas pasteboard viewport boundaries and smooth zoom/pan animations.
- `tests/typography-browser.html` & `tests/typography-browser.tsx`: Visual typography test bench for font rasterization, styled ranges, and text alignment checks.
- `tests/textResize.browser.ts`: Live browser measurement harness comparing Konva text metrics with DOM layout bounds.

---

## 3. Mocking Tauri IPC & Environment Shims

When running unit tests in Node.js via `tsx`, native Tauri APIs and browser globals (`window`, `localStorage`) are unavailable. The test suite uses a standardized mock harness pattern demonstrated in `tests/projectPersistence.test.ts`.

### 3.1 IPC Mocking with `@tauri-apps/api/mocks`

```typescript
import assert from 'node:assert/strict';
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';
import { useProjectStore } from '../src/stores/projectStore';
import { useAlbumStore } from '../src/stores/albumStore';

// 1. Shim Browser Environment
(globalThis as any).window = {};
const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  setItem: (k: string, v: string) => storage.set(k, v),
  getItem: (k: string) => storage.get(k) ?? null,
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
};

// 2. Setup Dynamic IPC Interceptor
const calls: string[] = [];
let nativeHandler: (command: string, args: any) => any = () => null;

mockIPC((command, args) => {
  calls.push(command);
  return nativeHandler(command, args);
});

// 3. State Reset Helper
const resetState = () => {
  useProjectStore.setState({ currentProject: mockProject, isSaving: false, error: null });
  useAlbumStore.setState({ currentAlbum: createInitialAlbum(mockProject), saveStatus: 'unsaved' });
  calls.length = 0;
  storage.clear();
  nativeHandler = (cmd) => (cmd === 'check_path_exists' ? true : null);
};
```

### 3.2 Testing Error Recovery & Native Failures

The persistence test suite verifies that filesystem or SQLite failures do not corrupt state or cause silent data loss:

```typescript
// Test: SQLite error during save should mark project unsaved and preserve recovery snapshot
resetState();
nativeHandler = (command) => {
  if (command === 'save_album_structure') throw new Error('disk full');
  return null;
};

const result = await useProjectStore.getState().saveProject();

assert.equal(result.success, false);
assert.equal(calls.includes('export_afsn_package'), false); // Did not attempt file export
assert.equal(useAlbumStore.getState().saveStatus, 'unsaved'); // Kept dirty flag
assert.ok(useProjectStore.getState().error?.includes('recovery database'));
assert.ok(storage.has('afsn_snapshot_mock-project-id')); // Preserved local recovery snapshot
```

### 3.3 Mocking Auto-Updater Lifecycle

In `tests/updateDownload.test.ts`, the Tauri auto-updater is verified using a simulated event-emitter mock:

```typescript
import { setMockTauriUpdate, startUpdateDownload } from '../src/services/updateService';
import { useAppStore } from '../src/stores/appStore';

const mockUpdate = {
  version: '1.0.78',
  downloadAndInstall: async (onEvent: (event: any) => void) => {
    onEvent({ event: 'Started', data: { contentLength: 5000000 } });
    onEvent({ event: 'Progress', data: { chunkLength: 2500000 } });
    onEvent({ event: 'Finished' });
  },
};

setMockTauriUpdate(mockUpdate);
await startUpdateDownload();

assert.strictEqual(useAppStore.getState().updateStatus, 'ready');
assert.strictEqual(useAppStore.getState().updateProgress.percent, 100);
```

---

## 4. Rust Backend Test Suite

The native backend in `src-tauri/` contains unit and integration tests covering low-level performance, database transactions, and graphics operations.

### 4.1 Native Test Structure

Tests are colocated within their respective modules under `#[cfg(test)]`:

- `src-tauri/src/db/mod.rs`:
  - `test_project_crud`: Project creation, retrieval, and updates.
  - `test_duplicate_project`: Project deep-copying with all pages, spreads, and elements.
  - `test_batch_photo_insertion`: Transactional multi-photo cataloging.
  - `test_corner_radius_payload_deserialization_and_persistence`: Per-corner radius JSON migration.
- `src-tauri/src/db/package_io.rs`:
  - `atomic_write`: Temporary file staging and atomic replacement.
  - `failed_write_preserves_existing_file_and_cleans_temporary`: Crash resilience.
  - `extracted_package_edit_save_preserves_zip_and_photos`: Round-trip `.afsn` archive preservation.
  - `import_rolls_back_on_invalid_membership_and_rejects_future_formats`: Transactional rollback on invalid data.
- `src-tauri/src/export_engine/mod.rs`:
  - `test_unit_to_pixels`: Conversion math across mm, cm, inch, and px at variable DPI.
  - `test_calculate_export_scale_physical_and_pixels`: Resolution scaling factors.
  - `test_crop_pan_math_matches_konva`: Parity check ensuring Rust export cropping precisely matches Konva viewport math.
  - `test_render_spread_and_pdf_generation`: Multi-page print PDF generation.
  - `test_apply_print_sharpening`: Two-pass unsharp mask convolution.
- `src-tauri/src/export_engine/text_rasterizer.rs`:
  - `test_ranges_to_text_runs`: Typography segment parsing.
  - `test_blend_pixel_over`: Porter-Duff alpha blending.
  - `preview_positions_keep_the_last_word_in_export`: Font metrics alignment.
- `src-tauri/src/photo_engine/mod.rs`:
  - `test_png_transparency_preservation`: RGBA channel integrity during thumbnail creation.
  - `test_photo_processing`: Thumbnail (320px) and preview (1500px) resizing.
  - `test_extract_metadata_and_cancelable_preview`: EXIF orientation and metadata reading.
- `src-tauri/src/asset_cache.rs`:
  - `measures_only_generated_photo_cache_assets`: Cache size disk calculation.
  - `removes_only_orphaned_generated_photo_assets`: Cache cleanup without deleting source photos.

### 4.2 Current Native Test Status

As of 2026-09-21, running `cargo test` in `src-tauri/` yields:

- **Total Tests:** 37
- **Passed:** 36
- **Failed:** 1 (`export_engine::text_rasterizer::tests::test_user_rotated_scenario` - assertion on anti-aliased intermediate edge pixel threshold).

---

## 5. Running Tests

### 5.1 Running Frontend Tests

The frontend test script is defined in `package.json`:

```bash

# Run typecheck followed by all 17 unit test suites

npm test
```

Under the hood, `npm test` executes:

```bash
tsc --noEmit && tsx tests/domain.test.ts && tsx tests/album.test.ts && tsx tests/editor.test.ts && tsx tests/history.test.ts && tsx tests/templates.test.ts && tsx tests/previewGeometry.test.ts && tsx tests/adaptiveLayout.test.ts && tsx tests/text.test.ts && tsx tests/richText.test.ts && tsx tests/styledRanges.test.ts && tsx tests/importQueue.test.ts && tsx tests/photoBatchPlacement.test.ts && tsx tests/textHandling.test.ts && tsx tests/objectOpacity.test.ts && tsx tests/projectPersistence.test.ts && tsx tests/updateDownload.test.ts && tsx tests/appPreferences.test.ts
```

To run a single specific test file during development:

```bash
npx tsx tests/projectPersistence.test.ts
npx tsx tests/editor.test.ts
```

### 5.2 Running Backend Tests

Run the complete native test suite from the `src-tauri` directory:

```bash
cd src-tauri
cargo test -- --nocapture
```

To run only database persistence tests with isolated test databases:

```bash
cargo test --lib db:: -- --skip test_inspect_actual_db
```

To run a specific module test:

```bash
cargo test --lib export_engine::
cargo test --lib photo_engine::
```

---

## 6. Regression Testing Checklist for Contributors

When implementing new features or refactoring existing code, ensure all relevant verification checks pass:

1. **Static Type Checking:**  
   `npx tsc --noEmit` must report zero errors.
2. **Domain Math Regressions:**  
   If touching snapping, margins, or units, run `npx tsx tests/domain.test.ts` and `npx tsx tests/editor.test.ts`.
3. **Persistence Safety:**  
   If altering database schemas, migrations, or file export methods:
   - Add a new SQLite migration test in `src-tauri/src/db/mod.rs`.
   - Run `npx tsx tests/projectPersistence.test.ts`.
   - Run `cargo test --lib db::package_io::tests`.
4. **Photo Lifecycle & Memory:**  
   If updating photo decoding or caching, verify `npx tsx tests/importQueue.test.ts` and `cargo test --lib photo_engine::`.

---
*Document maintained under AFSNSmartAlbum Quality Guidelines.*  
*Date of verification: 2026-09-21*
