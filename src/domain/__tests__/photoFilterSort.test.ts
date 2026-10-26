import { describe, it, expect } from 'vitest';
import { filterPhotos, sortPhotos, Photo } from '../photo';
import { PhotoFaceData, DetectedFace } from '../ai/faceDetection';

function createMockPhoto(id: string, name: string): Photo {
  return {
    id,
    projectId: 'proj-1',
    filePath: `/photos/${name}`,
    fileName: name,
    fileSize: 1000,
    width: 1920,
    height: 1080,
    format: 'jpg',
    isFavorite: false,
    usedCount: 0,
    isMissing: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

function createFace(overrides: Partial<DetectedFace> = {}): DetectedFace {
  return {
    bboxX: 0.3,
    bboxY: 0.2,
    bboxWidth: 0.4,
    bboxHeight: 0.4,
    score: 0.95,
    landmarks: {
      rightEye: [0.4, 0.3],
      leftEye: [0.6, 0.3],
      noseTip: [0.5, 0.4],
      rightMouth: [0.42, 0.5],
      leftMouth: [0.58, 0.5],
    },
    rollDegrees: 0,
    eyeDistance: 0.2,
    isFrontal: true,
    sharpnessScore: 80,
    isHeroCandidate: false,
    isEyesClosed: false,
    ...overrides,
  };
}

describe('Photo Filtering and Sorting by AI Attributes', () => {
  const pPortrait = createMockPhoto('p1', 'portrait.jpg');
  const pGroup = createMockPhoto('p2', 'group.jpg');
  const pScenery = createMockPhoto('p3', 'scenery.jpg');
  const pBlink = createMockPhoto('p4', 'blink.jpg');
  const allPhotos = [pPortrait, pGroup, pScenery, pBlink];

  const faceDataMap: Record<string, PhotoFaceData> = {
    p1: {
      photoPath: '/photos/portrait.jpg',
      width: 1920,
      height: 1080,
      faces: [createFace({ sharpnessScore: 85 })],
      heroScore: 92,
      sharpnessScore: 85,
      focalPoint: [0.5, 0.5],
      eyeLevelY: 0.3,
    },
    p2: {
      photoPath: '/photos/group.jpg',
      width: 1920,
      height: 1080,
      faces: [createFace(), createFace(), createFace(), createFace()],
      heroScore: 78,
      sharpnessScore: 75,
      focalPoint: [0.5, 0.5],
      eyeLevelY: 0.3,
    },
    p3: {
      photoPath: '/photos/scenery.jpg',
      width: 1920,
      height: 1080,
      faces: [],
      heroScore: 0,
      sharpnessScore: 90,
      focalPoint: [0.5, 0.5],
      eyeLevelY: 0.5,
    },
    p4: {
      photoPath: '/photos/blink.jpg',
      width: 1920,
      height: 1080,
      faces: [createFace({ isEyesClosed: true, sharpnessScore: 20 })],
      heroScore: 40,
      sharpnessScore: 20,
      focalPoint: [0.5, 0.5],
      eyeLevelY: 0.3,
    },
  };

  it('filters portraits (1-2 faces)', () => {
    const res = filterPhotos(allPhotos, 'portraits', undefined, undefined, faceDataMap);
    expect(res.map((p) => p.id)).toEqual(['p1', 'p4']);
  });

  it('filters group shots (3+ faces)', () => {
    const res = filterPhotos(allPhotos, 'group', undefined, undefined, faceDataMap);
    expect(res.map((p) => p.id)).toEqual(['p2']);
  });

  it('filters scenery / details (0 faces)', () => {
    const res = filterPhotos(allPhotos, 'scenery', undefined, undefined, faceDataMap);
    expect(res.map((p) => p.id)).toEqual(['p3']);
  });

  it('filters review needed (blinks or low sharpness)', () => {
    const res = filterPhotos(allPhotos, 'review_needed', undefined, undefined, faceDataMap);
    expect(res.map((p) => p.id)).toEqual(['p4']);
  });

  it('sorts photos by hero score descending', () => {
    const sorted = sortPhotos(allPhotos, 'hero_score', faceDataMap);
    expect(sorted.map((p) => p.id)).toEqual(['p1', 'p2', 'p4', 'p3']);
  });
});
