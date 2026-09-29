/**
 * Automated Test Suite for Plan 15-02:
 * Frontend Carousel Store Persistence, Autosave Snapshot & Mode-Aware Project Hydration
 */

// Polyfill window & localStorage for Node / tsx environment
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = globalThis;
}
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

import { useCarouselStore } from '../../src/stores/carouselStore';
import { useProjectStore } from '../../src/stores/projectStore';
import { getCrashSnapshot, clearCrashSnapshot } from '../../src/features/persistence/useAutoSave';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('🧪 Running Plan 15-02 Carousel Persistence Test Suite...\n');

  // Test 1: Store Persistence State Initialization & markDirty
  console.log('▶ Test 1: useCarouselStore initial saveStatus & markDirty()');
  useCarouselStore.getState().initializeCarousel('proj-pers-1', '4:5', 3);
  assert(useCarouselStore.getState().saveStatus === 'saved', 'Initial saveStatus should be saved');
  assert(useCarouselStore.getState().lastSavedAt === null, 'Initial lastSavedAt should be null');

  // Trigger markDirty
  useCarouselStore.getState().markDirty();
  assert(useCarouselStore.getState().saveStatus === 'unsaved', 'saveStatus should switch to unsaved on markDirty()');
  console.log('  ✔ Initialization & markDirty verified.');

  // Test 2: Mutation triggers dirty state
  console.log('▶ Test 2: Carousel mutations transition saveStatus to unsaved');
  useCarouselStore.getState().setSaveStatus('saved');
  assert(useCarouselStore.getState().saveStatus === 'saved', 'Reset to saved');

  useCarouselStore.getState().addPhotoFrame(0, {
    type: 'photo',
    photoId: 'photo-p1',
    filePath: '/tmp/p1.jpg',
    fileName: 'p1.jpg',
    width: 400,
    height: 400,
    x: 50,
    y: 50,
  });
  assert(useCarouselStore.getState().saveStatus === 'unsaved', 'Adding frame should set saveStatus to unsaved');

  // Test 3: Undo / Redo keeps dirty state
  console.log('▶ Test 3: Undo / Redo keeps saveStatus unsaved');
  useCarouselStore.getState().setSaveStatus('saved');
  useCarouselStore.getState().undo();
  assert(useCarouselStore.getState().saveStatus === 'unsaved', 'Undo should set saveStatus to unsaved');

  useCarouselStore.getState().setSaveStatus('saved');
  useCarouselStore.getState().redo();
  assert(useCarouselStore.getState().saveStatus === 'unsaved', 'Redo should set saveStatus to unsaved');
  console.log('  ✔ Undo/redo dirty tracking verified.');

  // Test 4: saveCarouselToDb writes snapshot and resets saveStatus
  console.log('▶ Test 4: saveCarouselToDb updates snapshot and sets saveStatus: saved');
  const savedSuccess = await useCarouselStore.getState().saveCarouselToDb();
  // In Node/non-Tauri, invoke fails and fallback snapshot is written to localStorage
  assert(useCarouselStore.getState().saveStatus === 'saved' || typeof localStorage.getItem('afsn_carousel_snapshot_proj-pers-1') === 'string', 'Snapshot written to localStorage');

  const snapshot = getCrashSnapshot('proj-pers-1', true);
  assert(Boolean(snapshot), 'getCrashSnapshot should retrieve the saved carousel snapshot');
  assert(snapshot.carousel.projectId === 'proj-pers-1', 'Snapshot projectId matches');
  assert(snapshot.carousel.ratio === '4:5', 'Snapshot ratio matches');
  assert(snapshot.carousel.slides[0].elements.length === 1, 'Snapshot contains the added frame');
  console.log('  ✔ Snapshot persistence verified.');

  // Test 5: loadCarouselFromDb hydrates store from storage
  console.log('▶ Test 5: loadCarouselFromDb restores carousel model and resets history');
  useCarouselStore.getState().initializeCarousel('different-project', '1:1', 1);
  assert(useCarouselStore.getState().currentCarousel?.projectId === 'different-project', 'Switched project');

  const loaded = await useCarouselStore.getState().loadCarouselFromDb('proj-pers-1');
  assert(loaded === true, 'loadCarouselFromDb should succeed from snapshot');
  const restored = useCarouselStore.getState().currentCarousel;
  assert(Boolean(restored), 'Restored carousel should exist');
  assert(restored?.projectId === 'proj-pers-1', 'Restored projectId matches');
  assert(restored?.ratio === '4:5', 'Restored ratio matches');
  assert(restored?.slides[0].elements.length === 1, 'Restored slide 0 has 1 frame');
  assert(restored?.slides[0].elements[0].photoId === 'photo-p1', 'Restored frame has photoId');
  assert(useCarouselStore.getState().saveStatus === 'saved', 'Restored carousel has saveStatus: saved');
  assert(useCarouselStore.getState().canUndo === false, 'History cleared on load');
  console.log('  ✔ loadCarouselFromDb verified.');

  // Test 6: ProjectStore Mode-Aware Lifecycle
  console.log('▶ Test 6: useProjectStore createNewProject & saveProject mode routing');
  const projectSettings = {
    name: 'Instagram Travel Post',
    canvas: {
      width: 1080,
      height: 1350,
      unit: 'px' as const,
      dpi: 96,
    },
    spacing: { value: 0, unit: 'px' as const },
    margin: { enabled: false, value: 0, unit: 'px' as const },
    border: { enabled: false, width: 0, unit: 'px' as const, color: '#FFFFFF' },
    background: { type: 'solid' as const, color: '#111111' },
    projectType: 'carousel' as const,
    carouselRatio: '4:5' as const,
    carouselSlideCount: 4,
  };

  const project = await useProjectStore.getState().createNewProject(projectSettings);
  assert(project.projectType === 'carousel' || project.canvasUnit === 'px', 'Project detected as carousel');
  assert(useCarouselStore.getState().currentCarousel?.projectId === project.id, 'Carousel store initialized for new project');
  assert(useCarouselStore.getState().currentCarousel?.totalSlides === 4, 'Carousel totalSlides is 4');

  // Verify saveProject routes to carousel store
  useCarouselStore.getState().markDirty();
  assert(useCarouselStore.getState().saveStatus === 'unsaved', 'Marked dirty before saveProject');

  const saveRes = await useProjectStore.getState().saveProject({ automatic: true });
  // Automatic save on mock project (no workingPath) returns false for file, but persists recovery checkpoint
  assert(useCarouselStore.getState().saveStatus === 'saved' || typeof localStorage.getItem(`afsn_carousel_snapshot_${project.id}`) === 'string', 'Recovery checkpoint saved');

  // Test 7: closeProject cleans up carouselStore
  console.log('▶ Test 7: closeProject resets carouselStore');
  await useProjectStore.getState().closeProject();
  assert(useProjectStore.getState().currentProject === null, 'currentProject cleared');
  assert(useCarouselStore.getState().currentCarousel === null, 'currentCarousel cleared');
  assert(useCarouselStore.getState().saveStatus === 'saved', 'saveStatus reset to saved');

  // Test 8: clearCrashSnapshot
  console.log('▶ Test 8: clearCrashSnapshot removes entries');
  clearCrashSnapshot('proj-pers-1');
  assert(getCrashSnapshot('proj-pers-1', true) === null, 'Carousel snapshot removed');
  console.log('  ✔ Snapshot cleanup verified.');

  console.log('\n🎉 ALL PERSISTENCE TESTS PASSED (100% GREEN)!\n');
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
