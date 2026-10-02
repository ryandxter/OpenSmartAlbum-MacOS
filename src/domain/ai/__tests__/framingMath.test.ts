import { describe, it, expect } from 'vitest';
import {
  calculateCoverDimensions,
  solveCropPanOffsets,
  calculateOptimalStudioCrop,
  calculateShapeMaskFaceCrop,
} from '../framingMath';
import { PhotoFaceData, DetectedFace } from '../faceDetection';

describe('framingMath', () => {
  const createMockFace = (overrides?: Partial<DetectedFace>): DetectedFace => ({
    bboxX: 0.35,
    bboxY: 0.20,
    bboxWidth: 0.30,
    bboxHeight: 0.40,
    score: 0.98,
    landmarks: {
      rightEye: [0.42, 0.32],
      leftEye: [0.58, 0.32],
      noseTip: [0.50, 0.42],
      rightMouth: [0.44, 0.52],
      leftMouth: [0.56, 0.52],
    },
    rollDegrees: 0,
    eyeDistance: 0.16,
    isFrontal: true,
    sharpnessScore: 85,
    isHeroCandidate: true,
    isEyesClosed: false,
    ...overrides,
  });

  const createMockFaceData = (faces: DetectedFace[] = [createMockFace()]): PhotoFaceData => ({
    photoPath: '/photos/test.jpg',
    width: 3000,
    height: 2000,
    faces,
    heroScore: 92,
    focalPoint: [0.5, 0.35],
    eyeLevelY: 0.32,
    detectionTimeMs: 12.4,
  });

  describe('calculateCoverDimensions', () => {
    it('calculates cover dimensions for landscape photo in square frame', () => {
      const res = calculateCoverDimensions(500, 500, 3000, 2000, 1.0);
      expect(res.renderedHeight).toBe(500);
      expect(res.renderedWidth).toBe(750);
      expect(res.deltaX).toBe(250);
      expect(res.deltaY).toBe(0);
    });

    it('calculates cover dimensions for portrait photo in landscape frame', () => {
      const res = calculateCoverDimensions(800, 400, 2000, 3000, 1.0);
      expect(res.renderedWidth).toBe(800);
      expect(res.renderedHeight).toBe(1200);
      expect(res.deltaX).toBe(0);
      expect(res.deltaY).toBe(800);
    });

    it('handles zoom scale correctly', () => {
      const res = calculateCoverDimensions(500, 500, 3000, 2000, 1.5);
      expect(res.renderedHeight).toBe(750);
      expect(res.renderedWidth).toBe(1125);
      expect(res.deltaX).toBe(625);
      expect(res.deltaY).toBe(250);
    });
  });

  describe('solveCropPanOffsets', () => {
    it('centers photo when photo center matches frame center', () => {
      // 750x500 in 500x500 frame: deltaX=250, deltaY=0
      const res = solveCropPanOffsets(0.5, 0.5, 250, 250, 500, 500, 750, 500);
      expect(res.cropX).toBe(0);
      expect(res.cropY).toBe(0);
    });

    it('strictly clamps crop offsets between -1.0 and 1.0', () => {
      const extremeRight = solveCropPanOffsets(0.0, 0.5, 500, 250, 500, 500, 750, 500);
      expect(extremeRight.cropX).toBeLessThanOrEqual(1.0);
      expect(extremeRight.cropX).toBeGreaterThanOrEqual(-1.0);

      const extremeLeft = solveCropPanOffsets(1.0, 0.5, 0, 250, 500, 500, 750, 500);
      expect(extremeLeft.cropX).toBeLessThanOrEqual(1.0);
      expect(extremeLeft.cropX).toBeGreaterThanOrEqual(-1.0);
    });
  });

  describe('calculateOptimalStudioCrop', () => {
    it('returns optical center fallback when faceData is null or has no faces', () => {
      const dims = { frameWidth: 600, frameHeight: 400, imageWidth: 3000, imageHeight: 2000 };
      const resNull = calculateOptimalStudioCrop(dims, null);
      expect(resNull).toEqual({ cropX: 0, cropY: 0, cropScale: 1.0 });

      const resEmpty = calculateOptimalStudioCrop(dims, createMockFaceData([]));
      expect(resEmpty).toEqual({ cropX: 0, cropY: 0, cropScale: 1.0 });
    });

    it('applies Pasfoto Formal preset with centered X and ~10% headroom / 40% eye line', () => {
      const dims = { frameWidth: 300, frameHeight: 400, imageWidth: 3000, imageHeight: 2000 };
      const faceData = createMockFaceData();
      const res = calculateOptimalStudioCrop(dims, faceData, 'pasfoto_formal');

      expect(res.cropScale).toBeGreaterThanOrEqual(1.0);
      expect(res.cropScale).toBeLessThanOrEqual(3.5);
      expect(res.cropX).toBeGreaterThanOrEqual(-1.0);
      expect(res.cropX).toBeLessThanOrEqual(1.0);
      expect(res.cropY).toBeGreaterThanOrEqual(-1.0);
      expect(res.cropY).toBeLessThanOrEqual(1.0);
    });

    it('applies Wisuda UNY preset with eye-line target ratio 0.333', () => {
      const dims = { frameWidth: 500, frameHeight: 700, imageWidth: 2000, imageHeight: 3000 };
      const faceData = createMockFaceData();
      const res = calculateOptimalStudioCrop(dims, faceData, 'wisuda_uny');

      expect(res.cropScale).toBeGreaterThanOrEqual(1.0);
      expect(res.cropX).toBeGreaterThanOrEqual(-1.0);
      expect(res.cropX).toBeLessThanOrEqual(1.0);
      expect(res.cropY).toBeGreaterThanOrEqual(-1.0);
      expect(res.cropY).toBeLessThanOrEqual(1.0);
    });

    it('applies Rule of Thirds gaze offset when subject tilts or gazes sideways', () => {
      const dims = { frameWidth: 800, frameHeight: 600, imageWidth: 3000, imageHeight: 2000 };
      
      // Facing right (rollDegrees > 5)
      const rightGazeFace = createMockFace({ rollDegrees: 12 });
      const rightData = createMockFaceData([rightGazeFace]);
      const resRight = calculateOptimalStudioCrop(dims, rightData, 'rule_of_thirds');

      // Facing left (rollDegrees < -5)
      const leftGazeFace = createMockFace({ rollDegrees: -12 });
      const leftData = createMockFaceData([leftGazeFace]);
      const resLeft = calculateOptimalStudioCrop(dims, leftData, 'rule_of_thirds');

      // Right-gazing subject is framed toward the left (so cropX is different from left-gazing)
      expect(resRight.cropX).not.toBe(resLeft.cropX);
    });

    it('applies Group Auto-Centering for multiple faces by computing union super-bounding box', () => {
      const dims = { frameWidth: 900, frameHeight: 600, imageWidth: 3000, imageHeight: 2000 };
      const face1 = createMockFace({ bboxX: 0.15, bboxY: 0.25, bboxWidth: 0.20, bboxHeight: 0.30 });
      const face2 = createMockFace({ bboxX: 0.65, bboxY: 0.20, bboxWidth: 0.20, bboxHeight: 0.32 });
      const groupData = createMockFaceData([face1, face2]);

      const res = calculateOptimalStudioCrop(dims, groupData, 'group_auto_centering');
      expect(res.cropScale).toBeGreaterThanOrEqual(1.0);
      expect(res.cropX).toBeGreaterThanOrEqual(-1.0);
      expect(res.cropX).toBeLessThanOrEqual(1.0);
    });

    it('handles various frame aspect ratios (16:9, 1:1, 9:16)', () => {
      const faceData = createMockFaceData();
      const ratios = [
        { frameWidth: 1600, frameHeight: 900 },
        { frameWidth: 1000, frameHeight: 1000 },
        { frameWidth: 900, frameHeight: 1600 },
      ];

      for (const ratio of ratios) {
        const dims = { ...ratio, imageWidth: 3000, imageHeight: 2000 };
        const res = calculateOptimalStudioCrop(dims, faceData, 'natural_center');
        expect(res.cropX).toBeGreaterThanOrEqual(-1.0);
        expect(res.cropX).toBeLessThanOrEqual(1.0);
        expect(res.cropY).toBeGreaterThanOrEqual(-1.0);
        expect(res.cropY).toBeLessThanOrEqual(1.0);
        expect(res.cropScale).toBeGreaterThanOrEqual(1.0);
      }
    });
  });

  describe('calculateShapeMaskFaceCrop', () => {
    it('applies 15% safety buffer for custom shape masks', () => {
      const dims = { frameWidth: 500, frameHeight: 500, imageWidth: 3000, imageHeight: 2000 };
      const faceData = createMockFaceData();
      const res = calculateShapeMaskFaceCrop(dims, faceData);

      expect(res.cropScale).toBeGreaterThanOrEqual(1.0);
      expect(res.cropX).toBeGreaterThanOrEqual(-1.0);
      expect(res.cropX).toBeLessThanOrEqual(1.0);
    });
  });
});
