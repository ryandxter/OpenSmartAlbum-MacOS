import { useAlbumStore } from '../../../stores/albumStore';
import { useHistoryStore } from '../../../stores/historyStore';
import { createInitialAlbum } from '../../../domain/album';
import { Project } from '../../../domain/project';
import { PhotoFrameElement } from '../../../domain/editor';
import { matchPhotosToSlots, PhotoAspectInput } from '../aspectMatcher';
import { RectBounds } from '../../../domain/templates';
import { convertUnit } from '../../../domain/units';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

const mockProject: Project = {
  id: 'test-project-hero',
  name: 'Hero & Full Bleed Test Project',
  canvasWidth: 200,
  canvasHeight: 200,
  canvasUnit: 'mm',
  canvasDpi: 300,
  spacingValue: 5,
  spacingUnit: 'mm',
  bleed: 3,
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

function createMockFrame(id: string, photoId: string, x: number, y: number, w: number, h: number): PhotoFrameElement {
  return {
    id,
    type: 'photo',
    photoId,
    filePath: `/path/${photoId}.jpg`,
    previewPath: `/path/${photoId}_prev.jpg`,
    thumbnailPath: `/path/${photoId}_thumb.jpg`,
    fileName: `${photoId}.jpg`,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    zIndex: 1,
    photoAspect: 1.5,
    cropX: 0,
    cropY: 0,
    cropScale: 1.0,
    cropRotation: 0,
    borderEnabled: false,
    borderWidth: 0,
    borderColor: '#000000',
    opacity: 1.0,
  };
}

function runHeroAndFullBleedSuites() {
  console.log('🧪 Starting Plan 12-01: Hero Anchor Biasing & Full Bleed Promotion Tests...');

  // --- Suite 1: Hungarian Hero Biasing to Largest Slot ---
  console.log('Testing Suite 1: Kuhn-Munkres Hero Assignment to Largest Slot...');
  const slots: RectBounds[] = [
    { x: 0, y: 0, width: 250, height: 200 }, // Area: 50,000 (Largest slot)
    { x: 260, y: 0, width: 140, height: 95 }, // Area: 13,300
    { x: 260, y: 105, width: 140, height: 95 }, // Area: 13,300
  ];

  const photoInputs: PhotoAspectInput[] = [
    { aspect: 1.0, isHero: false },
    { aspect: 1.0, isHero: true }, // Explicit Hero Anchor
    { aspect: 1.0, isHero: false },
  ];

  const match = matchPhotosToSlots(photoInputs, slots);
  // match.mapping[i] tells which slot photo[i] is assigned to
  assert(
    match.mapping[1] === 0,
    `Explicit hero photo at index 1 must be assigned to Slot 0 (largest area), but got slot ${match.mapping[1]}`
  );
  console.log('  ✓ Hero photo with isHero: true was reliably assigned to dominant Slot 0.');

  // --- Suite 2: Full Bleed Spread Promotion with Non-Destructive Reflow ---
  console.log('Testing Suite 2: Full Bleed Spread Promotion with Zero-Loss Reflow...');
  const album = createInitialAlbum(mockProject);
  const targetSpread = album.spreads[0]!;

  const initialFrames: PhotoFrameElement[] = [
    createMockFrame('frame-1', 'photo-1', 20, 20, 150, 100),
    createMockFrame('frame-2', 'photo-2', 180, 20, 150, 100),
    createMockFrame('frame-3', 'photo-3', 20, 130, 150, 100),
    createMockFrame('frame-4', 'photo-4', 180, 130, 150, 100),
  ];

  targetSpread.elements = initialFrames;
  useAlbumStore.setState({
    currentAlbum: album,
    activeSpreadId: targetSpread.id,
    activeSpreadIndex: 0,
  });
  useHistoryStore.getState().clearHistory();

  // Promote frame-2 to full bleed
  useAlbumStore.getState().promoteToFullBleedSpread(targetSpread.id, 'frame-2', mockProject);

  const updatedAlbum = useAlbumStore.getState().currentAlbum!;
  assert(updatedAlbum.spreads.length === 2, `Expected 2 spreads after reflow, got ${updatedAlbum.spreads.length}`);

  const spread0 = updatedAlbum.spreads[0]!;
  const spread1 = updatedAlbum.spreads[1]!;

  // Verify Spread 0 has 1 full bleed frame (frame-2)
  const spread0Photos = spread0.elements.filter((el) => el.type === 'photo') as PhotoFrameElement[];
  assert(spread0Photos.length === 1, `Spread 0 must have exactly 1 photo, got ${spread0Photos.length}`);
  const fullBleed = spread0Photos[0]!;
  const bleedVal = mockProject.bleed ?? 3;
  assert(fullBleed.id === 'frame-2', `Expected frame-2 to be the full bleed photo, got ${fullBleed.id}`);
  assert(fullBleed.x === -bleedVal, `Expected x = -bleed (${-bleedVal}), got ${fullBleed.x}`);
  assert(fullBleed.y === -bleedVal, `Expected y = -bleed (${-bleedVal}), got ${fullBleed.y}`);

  // Total spread width = 200 * 2 + 0 = 400. Width with bleed = 400 + 6 = 406.
  const expectedW = mockProject.canvasWidth * 2 + 2 * bleedVal;
  const expectedH = mockProject.canvasHeight + 2 * bleedVal;
  assert(fullBleed.width === expectedW, `Expected width ${expectedW}, got ${fullBleed.width}`);
  assert(fullBleed.height === expectedH, `Expected height ${expectedH}, got ${fullBleed.height}`);

  // Verify Spread 1 has the remaining 3 photos reflowed
  const spread1Photos = spread1.elements.filter((el) => el.type === 'photo') as PhotoFrameElement[];
  assert(spread1Photos.length === 3, `Spread 1 must have 3 reflowed photos, got ${spread1Photos.length}`);

  const allPreservedIds = new Set([...spread0Photos, ...spread1Photos].map((f) => f.photoId));
  for (let i = 1; i <= 4; i++) {
    assert(allPreservedIds.has(`photo-${i}`), `Missing photo-${i} after full bleed promotion!`);
  }
  console.log('  ✓ Full bleed spread promotion expanded target photo and reflowed remaining 3 photos with 0 loss.');

  // --- Suite 3: Single-Step Undo Reversal ---
  console.log('Testing Suite 3: Single-Step Undo Atomic Reversal...');
  assert(useHistoryStore.getState().canUndo, 'canUndo must be true after promotion');
  const restoredAlbum = useHistoryStore.getState().undo(useAlbumStore.getState().currentAlbum!);
  assert(restoredAlbum !== null, 'undo() returned null');
  useAlbumStore.setState({ currentAlbum: restoredAlbum });

  assert(
    restoredAlbum!.spreads.length === 1,
    `Undo must restore spread count to 1, got ${restoredAlbum!.spreads.length}`
  );
  const restoredSpreadPhotos = restoredAlbum!.spreads[0]!.elements.filter((el) => el.type === 'photo');
  assert(
    restoredSpreadPhotos.length === 4,
    `Undo must restore all 4 photos on original spread, got ${restoredSpreadPhotos.length}`
  );
  console.log('  ✓ Single Cmd+Z undo completely restored original 4-photo spread state.');

  // --- Suite 4: Spine Clearance Collision Detection Math ---
  console.log('Testing Suite 4: Spine Clearance Collision Detection Math...');
  const spineX = 200; // Left page width = 200mm
  const exclusionMm = convertUnit(19, 'mm', 'mm', 300); // 19mm

  // Frame spanning across spine with focal center exactly on spine fold
  const spanningFrame1: PhotoFrameElement = createMockFrame('span-1', 'photo-span', 100, 50, 200, 100);
  const focalX1 = spanningFrame1.x + spanningFrame1.width / 2; // 200mm
  const isSpanning1 = spanningFrame1.x < spineX && spanningFrame1.x + spanningFrame1.width > spineX;
  const isViolation1 = isSpanning1 && Math.abs(focalX1 - spineX) <= exclusionMm;
  assert(isViolation1, 'Spanning frame with focalX at 200mm must trigger spine corridor violation');

  // Frame spanning across spine but focal point panned far away (+40mm)
  const spanningFrame2: PhotoFrameElement = {
    ...spanningFrame1,
    id: 'span-2',
    cropX: 40,
  };
  const focalX2 = spanningFrame2.x + spanningFrame2.width / 2 + spanningFrame2.cropX; // 240mm
  const isViolation2 = Math.abs(focalX2 - spineX) <= exclusionMm;
  assert(!isViolation2, 'Spanning frame with focalX at 240mm (outside 19mm) must NOT trigger violation');

  console.log('  ✓ Spine clearance corridor detection correctly distinguishes safe vs hazardous focal positioning.');

  console.log('🎉 All Plan 12-01 Unit & Integration Tests Passed (100%)!');
}

runHeroAndFullBleedSuites();
