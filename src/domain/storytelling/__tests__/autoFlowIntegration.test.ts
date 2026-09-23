import { useAlbumStore } from '../../../stores/albumStore';
import { useCarouselStore } from '../../../stores/carouselStore';
import { useHistoryStore } from '../../../stores/historyStore';
import { createInitialAlbum } from '../../../domain/album';
import { createInitialCarousel } from '../../../domain/carousel';
import { Project } from '../../../domain/project';
import { Photo } from '../../../domain/photo';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

const mockProject: Project = {
  id: 'test-project-flow',
  name: 'Auto Flow Test Project',
  canvasWidth: 200,
  canvasHeight: 200,
  canvasUnit: 'mm',
  canvasDpi: 300,
  spacingValue: 5,
  spacingUnit: 'mm',
  borderEnabled: false,
  borderWidth: 0,
  borderUnit: 'mm',
  borderColor: '#000000',
  backgroundType: 'solid',
  backgroundColor: '#FFFFFF',
  marginEnabled: true,
  marginValue: 10,
  marginUnit: 'mm',
  marginTop: 10,
  marginBottom: 10,
  marginOutside: 10,
  marginSpine: 15,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function createMockPhotos(count: number): Photo[] {
  const baseTime = new Date('2026-09-23T08:00:00Z').getTime();
  return Array.from({ length: count }, (_, i) => {
    // Group photos into 3 time clusters
    const clusterOffset = i < 8 ? 0 : i < 16 ? 40 * 60 * 1000 : 90 * 60 * 1000;
    const photoTime = new Date(baseTime + clusterOffset + i * 15 * 1000).toISOString();
    return {
      id: `photo-flow-${i + 1}`,
      projectId: mockProject.id,
      filePath: `/mock/path/photo_${String(i + 1).padStart(3, '0')}.jpg`,
      fileName: `photo_${String(i + 1).padStart(3, '0')}.jpg`,
      format: 'jpg',
      width: i % 2 === 0 ? 3000 : 2000,
      height: 2000,
      fileSize: 4500000,
      mimeType: 'image/jpeg',
      importedAt: photoTime,
      createdAt: photoTime,
      updatedAt: photoTime,
      isFavorite: i % 5 === 0,
      isMissing: false,
      usedCount: 0,
    };
  });
}

async function runAutoFlowTests() {
  console.log('🧪 Starting Auto-Flow Multi-Spread Storytelling Engine Integration Tests...');

  // --- Suite 1: Print Album Auto-Flow (25 photos) ---
  console.log('Testing Print Album Auto-Flow (25 photos)...');
  const initialAlbum = createInitialAlbum(mockProject);
  useAlbumStore.setState({
    currentAlbum: initialAlbum,
    activeSpreadId: initialAlbum.spreads[0]?.id || '',
    activeSpreadIndex: 0,
  });
  useHistoryStore.getState().clearHistory();

  const photos25 = createMockPhotos(25);
  await useAlbumStore.getState().autoFlowPhotosToSpreads(photos25, mockProject, {
    replaceCurrentSpread: true,
  });

  const resultingAlbum = useAlbumStore.getState().currentAlbum;
  assert(resultingAlbum !== null, 'Album should not be null after auto-flow');

  const allElements = resultingAlbum!.spreads.flatMap((s) => s.elements);
  const photoElements = allElements.filter((el) => el.type === 'photo');

  // Verify Zero-Loss Photo Invariant
  assert(
    photoElements.length === 25,
    `Zero-Loss Photo Invariant failed: expected 25 photos placed, got ${photoElements.length}`
  );

  const placedPhotoIds = new Set(photoElements.map((el) => (el as any).photoId));
  for (const p of photos25) {
    assert(placedPhotoIds.has(p.id), `Missing photo ID ${p.id} from auto-flowed spreads`);
  }

  // Verify Zero-Blank Frame Guarantee
  for (const el of photoElements) {
    const frame = el as any;
    assert(
      typeof frame.filePath === 'string' && frame.filePath.length > 0,
      `Blank frame detected with empty filePath: ${frame.id}`
    );
  }

  // Verify Spread Count (25 photos bounded [1..6] per spread => 5 to 10 spreads)
  assert(
    resultingAlbum!.spreads.length >= 5 && resultingAlbum!.spreads.length <= 10,
    `Expected 5-10 spreads, got ${resultingAlbum!.spreads.length}`
  );
  console.log(`  ✓ 25 photos successfully auto-flowed into ${resultingAlbum!.spreads.length} spreads with 0 loss and 0 blank frames.`);

  // --- Suite 2: Single-Step Undo Reversal ---
  console.log('Testing Single-Step Undo Atomic Reversal...');
  const canUndo = useHistoryStore.getState().canUndo;
  assert(canUndo, 'History should allow undo after autoFlowPhotosToSpreads');

  const preFlowAlbum = useHistoryStore.getState().undo(useAlbumStore.getState().currentAlbum!);
  assert(preFlowAlbum !== null, 'Undo should return previous album state');

  useAlbumStore.setState({ currentAlbum: preFlowAlbum });
  const restoredAlbum = useAlbumStore.getState().currentAlbum;
  assert(
    restoredAlbum!.spreads.length === initialAlbum.spreads.length,
    `Undo failed to restore initial spread count: expected ${initialAlbum.spreads.length}, got ${restoredAlbum!.spreads.length}`
  );

  const restoredElements = restoredAlbum!.spreads.flatMap((s) => s.elements);
  assert(
    restoredElements.length === 0,
    `Undo failed to clear auto-flowed elements: expected 0, got ${restoredElements.length}`
  );
  console.log('  ✓ Single Cmd+Z undo completely restored original album state in one transaction.');

  // --- Suite 3: Social Carousel Auto-Flow (10 photos) ---
  console.log('Testing Social Carousel Auto-Flow (10 photos)...');
  const initialCarousel = createInitialCarousel(mockProject.id, '1:1', 1);
  useCarouselStore.setState({
    currentCarousel: initialCarousel,
    activeSlideIndex: 0,
  });

  const photos10 = createMockPhotos(10);
  await useCarouselStore.getState().autoFlowPhotosToSlides(photos10);

  const resultingCarousel = useCarouselStore.getState().currentCarousel;
  assert(resultingCarousel !== null, 'Carousel should not be null after auto-flow');

  const allFrames = resultingCarousel!.slides.flatMap((s) => s.elements);
  assert(
    allFrames.length === 10,
    `Carousel Zero-Loss Photo Invariant failed: expected 10 photos placed, got ${allFrames.length}`
  );

  const placedCarouselPhotoIds = new Set(allFrames.map((f) => f.photoId));
  for (const p of photos10) {
    assert(placedCarouselPhotoIds.has(p.id), `Missing photo ID ${p.id} from auto-flowed slides`);
  }

  // Check valid dimensions & coordinates
  for (const frame of allFrames) {
    assert(frame.width > 0, `Frame width must be > 0: got ${frame.width}`);
    assert(frame.height > 0, `Frame height must be > 0: got ${frame.height}`);
    assert(frame.x >= 0, `Frame x must be >= 0: got ${frame.x}`);
    assert(frame.y >= 0, `Frame y must be >= 0: got ${frame.y}`);
    assert(
      typeof frame.filePath === 'string' && frame.filePath.length > 0,
      `Frame filePath cannot be empty: ${frame.id}`
    );
  }

  console.log(`  ✓ 10 photos successfully auto-flowed across ${resultingCarousel!.slides.length} carousel slides with valid geometries.`);

  console.log('🎉 All Auto-Flow Integration Tests Passed (100%)!');
}

runAutoFlowTests();
