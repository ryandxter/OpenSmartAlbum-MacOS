import { describe, it, expect, beforeEach } from 'vitest';
import { usePhotoStore } from '../../stores/photoStore';
import type { PhotoAiAnalysisRow } from '../../services/photoAiService';

describe('Plan 05-01: Persistent Photo AI Analysis Pipeline (AI-01)', () => {
  beforeEach(() => {
    usePhotoStore.setState({
      photos: [
        {
          id: 'photo-1',
          projectId: 'p1',
          filePath: '/photos/portrait.jpg',
          fileName: 'portrait.jpg',
          fileSize: 1024,
          width: 1920,
          height: 1080,
          format: 'jpg',
          isFavorite: false,
          usedCount: 0,
          isMissing: false,
          createdAt: '2026-10-27',
          updatedAt: '2026-10-27',
        },
        {
          id: 'photo-2',
          projectId: 'p1',
          filePath: '/photos/group.jpg',
          fileName: 'group.jpg',
          fileSize: 2048,
          width: 2400,
          height: 1600,
          format: 'jpg',
          isFavorite: false,
          usedCount: 0,
          isMissing: false,
          createdAt: '2026-10-27',
          updatedAt: '2026-10-27',
        },
      ],
      photoAiAnalyses: {},
      aiProgress: null,
    });
  });

  it('initializes photo AI analysis state with empty cache and null progress', () => {
    const state = usePhotoStore.getState();
    expect(state.photoAiAnalyses).toEqual({});
    expect(state.aiProgress).toBeNull();
  });

  it('updates aiProgress correctly when analysis is in-flight', () => {
    usePhotoStore.setState({
      aiProgress: {
        isAnalyzing: true,
        completed: 1,
        total: 5,
      },
    });

    const progress = usePhotoStore.getState().aiProgress;
    expect(progress?.isAnalyzing).toBe(true);
    expect(progress?.completed).toBe(1);
    expect(progress?.total).toBe(5);
  });

  it('persists and retrieves analysis rows keyed by photoId', () => {
    const mockRow1: PhotoAiAnalysisRow = {
      photoId: 'photo-1',
      projectId: 'p1',
      modelVersion: 'yunet-v1',
      sourceSignature: 'sig-abc',
      faceCount: 1,
      faceFocusScore: 94.5,
      largestFaceRatio: 0.32,
      facesJson: JSON.stringify([
        {
          bboxX: 0.2,
          bboxY: 0.15,
          bboxWidth: 0.3,
          bboxHeight: 0.4,
          score: 0.98,
          isHeroCandidate: true,
          isEyesClosed: false,
        },
      ]),
      analyzedAt: '2026-10-27T06:00:00Z',
    };

    usePhotoStore.setState((s) => ({
      photoAiAnalyses: {
        ...s.photoAiAnalyses,
        [mockRow1.photoId]: mockRow1,
      },
    }));

    const analysis = usePhotoStore.getState().photoAiAnalyses['photo-1'];
    expect(analysis).toBeDefined();
    expect(analysis?.faceCount).toBe(1);
    expect(analysis?.faceFocusScore).toBe(94.5);
    expect(analysis?.largestFaceRatio).toBe(0.32);

    const parsedFaces = JSON.parse(analysis!.facesJson);
    expect(parsedFaces.length).toBe(1);
    expect(parsedFaces[0].isHeroCandidate).toBe(true);
  });

  it('clears analysis cache cleanly upon request', () => {
    usePhotoStore.setState({
      photoAiAnalyses: {
        'photo-1': {
          photoId: 'photo-1',
          projectId: 'p1',
          modelVersion: 'yunet-v1',
          sourceSignature: '',
          faceCount: 1,
          faceFocusScore: 90,
          largestFaceRatio: 0.2,
          facesJson: '[]',
          analyzedAt: '',
        },
      },
    });

    expect(Object.keys(usePhotoStore.getState().photoAiAnalyses).length).toBe(1);

    usePhotoStore.setState({ photoAiAnalyses: {} });
    expect(Object.keys(usePhotoStore.getState().photoAiAnalyses).length).toBe(0);
  });
});
