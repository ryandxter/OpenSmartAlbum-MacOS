import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { AIFramingSection } from '../AIFramingSection';
import { PhotoFaceData, formatFaceTelemetryBadge, isHeroShot } from '../../../../domain/ai/faceDetection';
import { PhotoFrameElement } from '../../../../domain/editor';
import { useAlbumStore } from '../../../../stores/albumStore';
import { useCarouselStore } from '../../../../stores/carouselStore';
import { useEditorStore } from '../../../../stores/editorStore';
import { usePhotoStore } from '../../../../stores/photoStore';

describe('AIFramingSection Integration & Props Suite', () => {
  const mockPhotoElement: PhotoFrameElement = {
    id: 'frame-1',
    type: 'photo',
    photoId: 'photo-123',
    filePath: '/photos/portrait.jpg',
    previewPath: '/previews/portrait.jpg',
    thumbnailPath: '/thumbs/portrait.jpg',
    fileName: 'portrait.jpg',
    x: 50,
    y: 50,
    width: 400,
    height: 600,
    rotation: 0,
    zIndex: 1,
    photoAspect: 0.667,
    cropX: 0,
    cropY: 0,
    cropScale: 1.0,
    cropRotation: 0,
    borderEnabled: false,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    opacity: 1,
  };

  const mockFaceData: PhotoFaceData = {
    photoPath: '/photos/portrait.jpg',
    width: 2000,
    height: 3000,
    faces: [
      {
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
        sharpnessScore: 88,
        isHeroCandidate: true,
        isEyesClosed: false,
      },
    ],
    heroScore: 94,
    focalPoint: [0.5, 0.35],
    eyeLevelY: 0.32,
    detectionTimeMs: 14.5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Component Instantiation & Props Contract', () => {
    it('creates React element with required AIFramingSection props', () => {
      const onToast = vi.fn();
      const element = React.createElement(AIFramingSection, {
        element: mockPhotoElement,
        faceData: mockFaceData,
        onToast,
        activeMode: 'print',
      });

      expect(element).toBeTruthy();
      expect(element.type).toBe(AIFramingSection);
      expect(element.props.element).toBe(mockPhotoElement);
      expect(element.props.faceData).toBe(mockFaceData);
      expect(element.props.activeMode).toBe('print');
    });
  });

  describe('2. Telemetry Badge & Quality Calculations', () => {
    it('formats 1 face telemetry badge with confidence score', () => {
      const badge = formatFaceTelemetryBadge(mockFaceData);
      expect(badge).toBe('👤 1 Face • 98%');
    });

    it('formats multiple faces telemetry badge', () => {
      const firstFace = mockFaceData.faces[0]!;
      const multiFaceData: PhotoFaceData = {
        ...mockFaceData,
        faces: [firstFace, { ...firstFace, bboxX: 0.1 }],
      };
      const badge = formatFaceTelemetryBadge(multiFaceData);
      expect(badge).toBe('👥 2 Faces');
    });

    it('formats empty face data badge', () => {
      expect(formatFaceTelemetryBadge(null)).toBe('No Faces');
      expect(formatFaceTelemetryBadge({ ...mockFaceData, faces: [] })).toBe('No Faces');
    });

    it('evaluates hero shot quality criteria (score >= 85)', () => {
      expect(isHeroShot(mockFaceData)).toBe(true);
      expect(isHeroShot({ ...mockFaceData, heroScore: 80 })).toBe(false);
      expect(isHeroShot(null)).toBe(false);
    });
  });

  describe('3. Store Dispatch Actions', () => {
    it('applies studio framing preset to album frame when in print mode', () => {
      const applySpy = vi.fn();
      useAlbumStore.setState({ applyStudioFramingPreset: applySpy });

      const applyFraming = useAlbumStore.getState().applyStudioFramingPreset;
      applyFraming('frame-1', 'pasfoto_formal', { headroomRatio: 0.10 });

      expect(applySpy).toHaveBeenCalledWith('frame-1', 'pasfoto_formal', { headroomRatio: 0.10 });
    });

    it('applies studio framing preset to carousel frame when in carousel mode', () => {
      const applySpy = vi.fn();
      useCarouselStore.setState({ applyStudioFramingPreset: applySpy });

      const applyFraming = useCarouselStore.getState().applyStudioFramingPreset;
      applyFraming('frame-c1', 'wisuda_uny', { eyeLineTargetRatio: 0.333 });

      expect(applySpy).toHaveBeenCalledWith('frame-c1', 'wisuda_uny', { eyeLineTargetRatio: 0.333 });
    });

    it('resets crop to optical center via updateFrameGeometry', () => {
      const updateSpy = vi.fn();
      useEditorStore.setState({ updateFrameGeometry: updateSpy });

      useEditorStore.getState().updateFrameGeometry('spread-1', 'frame-1', {
        cropX: 0,
        cropY: 0,
        cropScale: 1.0,
        faceFramingPreset: undefined,
      });

      expect(updateSpy).toHaveBeenCalledWith('spread-1', 'frame-1', {
        cropX: 0,
        cropY: 0,
        cropScale: 1.0,
        faceFramingPreset: undefined,
      });
    });

    it('triggers face detection analysis on demand via photoStore', async () => {
      const mockResult: PhotoFaceData = { ...mockFaceData };
      const analyzeSpy = vi.fn().mockResolvedValue(mockResult);
      usePhotoStore.setState({ analyzePhotoFaces: analyzeSpy });

      const result = await usePhotoStore.getState().analyzePhotoFaces('photo-123');
      expect(analyzeSpy).toHaveBeenCalledWith('photo-123');
      expect(result).toBe(mockResult);
    });
  });
});
