import { useEffect, useRef } from 'react';
import { useAlbumStore } from '../../stores/albumStore';
import { useCarouselStore } from '../../stores/carouselStore';
import { useAppStore } from '../../stores/appStore';
import { useProjectStore } from '../../stores/projectStore';

const SNAPSHOT_STORAGE_KEY_PREFIX = 'afsn_snapshot_';
const CAROUSEL_SNAPSHOT_STORAGE_KEY_PREFIX = 'afsn_carousel_snapshot_';

export function useAutoSave() {
  const currentAlbum = useAlbumStore((s) => s.currentAlbum);
  const albumSaveStatus = useAlbumStore((s) => s.saveStatus);
  const currentCarousel = useCarouselStore((s) => s.currentCarousel);
  const carouselSaveStatus = useCarouselStore((s) => s.saveStatus);
  const currentProject = useProjectStore((s) => s.currentProject);
  const autoSaveEnabled = useAppStore((s) => s.preferences.autoSaveEnabled);
  const autoSaveIntervalSeconds = useAppStore((s) => s.preferences.autoSaveIntervalSeconds);

  const debounceTimerRef = useRef<number | null>(null);

  const isCarousel = currentProject?.canvasUnit === 'px' || currentProject?.projectType === 'carousel';
  const activeSaveStatus = isCarousel ? carouselSaveStatus : albumSaveStatus;

  // 1. Local Storage Crash Snapshot Recovery Protection
  useEffect(() => {
    if (!currentProject) return;

    if (isCarousel) {
      if (!currentCarousel || currentCarousel.projectId !== currentProject.id) return;
      try {
        const snapshotKey = `${CAROUSEL_SNAPSHOT_STORAGE_KEY_PREFIX}${currentProject.id}`;
        localStorage.setItem(
          snapshotKey,
          JSON.stringify({
            projectId: currentProject.id,
            savedAt: new Date().toISOString(),
            carousel: currentCarousel,
          })
        );
      } catch {
        // Ignore localStorage errors (e.g. quota limit)
      }
    } else {
      if (!currentAlbum || currentAlbum.projectId !== currentProject.id) return;
      try {
        const snapshotKey = `${SNAPSHOT_STORAGE_KEY_PREFIX}${currentProject.id}`;
        localStorage.setItem(
          snapshotKey,
          JSON.stringify({
            projectId: currentProject.id,
            savedAt: new Date().toISOString(),
            album: currentAlbum,
          })
        );
      } catch {
        // Ignore localStorage errors (e.g. quota limit)
      }
    }
  }, [isCarousel, currentProject, currentCarousel, currentAlbum]);

  // 2. Dirty Flag Synchronization
  useEffect(() => {
    if (!currentProject) return;
    try {
      const key = `afsn_dirty_${currentProject.id}`;
      if (activeSaveStatus === 'saved') {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, '1');
      }
    } catch {}
  }, [currentProject, activeSaveStatus]);

  // Both timers use the same guarded save pipeline as Ctrl+S / Cmd+S.
  // Keep unsaved projects dirty after a database-only recovery checkpoint.
  const lastAlbumCheckpoint = useRef<typeof currentAlbum>(null);
  const lastCarouselCheckpoint = useRef<typeof currentCarousel>(null);

  const checkpoint = async () => {
    const state = useProjectStore.getState();
    if (state.isSaving || state.isLoading) return;
    const project = state.currentProject;
    if (!project) return;

    if (isCarousel) {
      const carousel = useCarouselStore.getState().currentCarousel;
      if (!carousel || carousel.projectId !== project.id) return;
      if (lastCarouselCheckpoint.current === carousel) return;
      lastCarouselCheckpoint.current = carousel;
      await state.saveProject({ automatic: true });
    } else {
      const album = useAlbumStore.getState().currentAlbum;
      if (!album || album.projectId !== project.id) return;
      if (lastAlbumCheckpoint.current === album) return;
      lastAlbumCheckpoint.current = album;
      await state.saveProject({ automatic: true });
    }
  };

  // 3. Debounced Autosave (2.5s for carousel, or configured interval for albums)
  useEffect(() => {
    if (!autoSaveEnabled || activeSaveStatus !== 'unsaved') return;
    if (isCarousel && !currentCarousel) return;
    if (!isCarousel && !currentAlbum) return;

    const delaySeconds = isCarousel ? 2.5 : autoSaveIntervalSeconds;
    debounceTimerRef.current = window.setTimeout(
      () => { void checkpoint(); },
      delaySeconds * 1000
    );
    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    };
  }, [autoSaveEnabled, autoSaveIntervalSeconds, isCarousel, currentAlbum, currentCarousel, activeSaveStatus, currentProject]);

  // 4. Periodic Backup Interval
  useEffect(() => {
    if (!autoSaveEnabled) return;
    const interval = window.setInterval(() => {
      const currentDirty = isCarousel
        ? useCarouselStore.getState().saveStatus === 'unsaved'
        : useAlbumStore.getState().saveStatus === 'unsaved';
      if (currentDirty) void checkpoint();
    }, Math.max(60000, autoSaveIntervalSeconds * 1000));
    return () => window.clearInterval(interval);
  }, [autoSaveEnabled, autoSaveIntervalSeconds, isCarousel]);

  // 5. Immediate Save on Window Blur
  useEffect(() => {
    const handleBlur = () => {
      const state = useProjectStore.getState();
      if (!state.currentProject || state.isSaving || state.isLoading) return;
      const isCarouselMode =
        state.currentProject.canvasUnit === 'px' ||
        state.currentProject.projectType === 'carousel';
      const isDirty = isCarouselMode
        ? useCarouselStore.getState().saveStatus === 'unsaved'
        : useAlbumStore.getState().saveStatus === 'unsaved';
      if (isDirty) {
        void state.saveProject({ automatic: true });
      }
    };

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, []);
}

/**
 * Checks if a crash snapshot exists for the given project ID.
 */
export function getCrashSnapshot(projectId: string, isCarousel = false) {
  try {
    const key = isCarousel
      ? `${CAROUSEL_SNAPSHOT_STORAGE_KEY_PREFIX}${projectId}`
      : `${SNAPSHOT_STORAGE_KEY_PREFIX}${projectId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Clears crash snapshot upon clean project exit.
 */
export function clearCrashSnapshot(projectId: string) {
  try {
    localStorage.removeItem(`${SNAPSHOT_STORAGE_KEY_PREFIX}${projectId}`);
    localStorage.removeItem(`${CAROUSEL_SNAPSHOT_STORAGE_KEY_PREFIX}${projectId}`);
  } catch {
    // ignore
  }
}
