import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { isTauri } from '../utils/platform';

export interface PhotoAiAnalysisRow {
  photoId: string;
  projectId: string;
  modelVersion: string;
  sourceSignature: string;
  faceCount: number;
  faceFocusScore: number;
  largestFaceRatio: number;
  facesJson: string;
  analyzedAt: string;
}

export interface PhotoAiProgressPayload {
  projectId: string;
  completed: number;
  total: number;
  currentPhotoId?: string | null;
}

export interface PhotoAiReadyPayload {
  projectId: string;
  totalAnalyzed: number;
}

export const photoAiService = {
  async analyzeProjectPhotos(projectId: string, sensitivity?: number): Promise<void> {
    if (!isTauri()) return;
    await invoke('analyze_project_photos', { projectId, sensitivity: sensitivity || null });
  },

  async cancelPhotoAiAnalysis(projectId: string): Promise<void> {
    if (!isTauri()) return;
    await invoke('cancel_photo_ai_analysis', { projectId });
  },

  async getPhotoAiAnalyses(projectId: string): Promise<PhotoAiAnalysisRow[]> {
    if (!isTauri()) return [];
    try {
      return await invoke<PhotoAiAnalysisRow[]>('get_photo_ai_analyses', { projectId });
    } catch (err) {
      console.warn('[photoAiService] Failed to load photo AI analyses:', err);
      return [];
    }
  },

  async clearPhotoAiAnalyses(projectId: string): Promise<void> {
    if (!isTauri()) return;
    await invoke('clear_photo_ai_analyses', { projectId });
  },

  async onProgress(callback: (payload: PhotoAiProgressPayload) => void): Promise<UnlistenFn> {
    if (!isTauri()) return () => {};
    return await listen<PhotoAiProgressPayload>('photo-ai-analysis-progress', (event) => {
      callback(event.payload);
    });
  },

  async onReady(callback: (payload: PhotoAiReadyPayload) => void): Promise<UnlistenFn> {
    if (!isTauri()) return () => {};
    return await listen<PhotoAiReadyPayload>('photo-ai-analysis-ready', (event) => {
      callback(event.payload);
    });
  },
};
