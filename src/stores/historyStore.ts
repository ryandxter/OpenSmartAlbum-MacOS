import { create } from 'zustand';
import { Album } from '../domain/album';

export interface HistoryState {
  past: Album[];
  future: Album[];
  maxHistory: number;

  // Actions
  pushState: (album: Album) => void;
  undo: (currentAlbum: Album) => Album | null;
  redo: (currentAlbum: Album) => Album | null;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  maxHistory: 50,
  canUndo: false,
  canRedo: false,

  pushState: (album: Album) => {
    // Deep clone album snapshot to isolate from future mutations
    const snapshot: Album = JSON.parse(JSON.stringify(album));
    const { past, maxHistory } = get();

    // Prevent pushing duplicate consecutive state
    if (past.length > 0) {
      const lastSnapshot = past[past.length - 1];
      if (lastSnapshot && JSON.stringify(lastSnapshot) === JSON.stringify(snapshot)) {
        return;
      }
    }

    const updatedPast = [...past, snapshot];
    if (updatedPast.length > maxHistory) {
      updatedPast.shift(); // Drop oldest state if exceeding limit
    }

    set({
      past: updatedPast,
      future: [], // New action clears redo stack
      canUndo: updatedPast.length > 0,
      canRedo: false,
    });
  },

  undo: (currentAlbum?: Album | null) => {
    const { past, future } = get();
    if (past.length === 0) return null;

    const previous = past[past.length - 1];
    if (!previous) return null;

    const currentSnapshot: Album | null = currentAlbum ? JSON.parse(JSON.stringify(currentAlbum)) : null;
    const updatedPast = past.slice(0, -1);
    const updatedFuture = currentSnapshot ? [currentSnapshot, ...future] : [...future];

    set({
      past: updatedPast,
      future: updatedFuture,
      canUndo: updatedPast.length > 0,
      canRedo: updatedFuture.length > 0,
    });

    return JSON.parse(JSON.stringify(previous));
  },

  redo: (currentAlbum?: Album | null) => {
    const { past, future } = get();
    if (future.length === 0) return null;

    const next = future[0];
    if (!next) return null;

    const currentSnapshot: Album | null = currentAlbum ? JSON.parse(JSON.stringify(currentAlbum)) : null;
    const updatedPast = currentSnapshot ? [...past, currentSnapshot] : [...past];
    const updatedFuture = future.slice(1);

    set({
      past: updatedPast,
      future: updatedFuture,
      canUndo: updatedPast.length > 0,
      canRedo: updatedFuture.length > 0,
    });

    return JSON.parse(JSON.stringify(next));
  },

  clearHistory: () => {
    set({
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
  },
}));
