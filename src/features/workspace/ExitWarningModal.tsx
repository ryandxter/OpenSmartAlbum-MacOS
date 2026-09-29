import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../../stores/appStore';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { isTauri } from '../../utils/platform';
import { useProjectStore } from '../../stores/projectStore';
import { useAlbumStore } from '../../stores/albumStore';
import { useCarouselStore } from '../../stores/carouselStore';
import { usePhotoStore } from '../../stores/photoStore';

export function ExitWarningModal() {
  const { isExitWarningOpen, closeExitWarning } = useAppStore();
  const [isClosing, setIsClosing] = useState(false);
  const isSaving = useProjectStore((s) => s.isSaving);
  const isPhotoBusy = usePhotoStore((s) => s.isRemoving || s.isRelinking);
  const currentProject = useProjectStore((s) => s.currentProject);

  const isCarousel = currentProject?.canvasUnit === 'px' || (currentProject as any)?.projectType === 'carousel';
  const detail = isCarousel
    ? 'If you exit without saving, recent carousel slides and photo placements will be lost.'
    : 'If you exit without saving, your recent photo placements and album changes will be lost.';

  const handleForceExit = async () => {
    if (isClosing || useProjectStore.getState().isSaving || isPhotoBusy) return;
    setIsClosing(true);
    closeExitWarning();

    if (isTauri()) {
      try {
        await invoke('exit_app');
      } catch (err) {
        console.error('Failed to exit via invoke exit_app:', err);
        // Fallback to window destroy if command fails
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          await getCurrentWindow().destroy();
        } catch {
          window.close();
        }
      }
    } else {
      window.close();
    }
  };

  const handleExitWithoutSaving = async () => {
    const current = useProjectStore.getState().currentProject;
    if (current) {
      try {
        localStorage.removeItem(`afsn_dirty_${current.id}`);
      } catch {}
    }
    await handleForceExit();
  };

  if (!isExitWarningOpen) return null;

  return (
    <ConfirmDialog
      isOpen={isExitWarningOpen}
      title="Unsaved Changes"
      message="Save your changes before exiting?"
      detail={detail}
      variant="warning"
      secondaryVariant="danger"
      onConfirm={async () => {
        const result = await useProjectStore.getState().saveProject();
        const current = useProjectStore.getState().currentProject;
        const isCarouselProj = current?.canvasUnit === 'px' || (current as any)?.projectType === 'carousel';
        const isSaved = isCarouselProj
          ? useCarouselStore.getState().saveStatus === 'saved'
          : useAlbumStore.getState().saveStatus === 'saved';
        if (result.success && isSaved) {
          await handleForceExit();
        }
      }}
      onSecondary={handleExitWithoutSaving}
      secondaryText="Exit Without Saving"
      isLoading={isSaving || isClosing || isPhotoBusy}
      loadingText={isPhotoBusy ? 'Finishing photo operation...' : 'Processing...'}
      onCancel={() => {
        setIsClosing(false);
        closeExitWarning();
      }}
      confirmText="Save & Exit"
      cancelText="Cancel"
    />
  );
}
