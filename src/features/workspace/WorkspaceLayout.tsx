import { useState, useEffect, useCallback, useRef } from 'react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useAppStore } from '../../stores/appStore';
import { useProjectStore } from '../../stores/projectStore';
import { useAlbumStore } from '../../stores/albumStore';
import { useEditorStore } from '../../stores/editorStore';
import { usePhotoStore } from '../../stores/photoStore';
import { useCarouselStore } from '../../stores/carouselStore';
import { useAutoSave } from '../persistence/useAutoSave';
import { useTauriInfo } from '../../hooks/useTauriInfo';
import { WelcomeScreen } from './WelcomeScreen';
import { getAllAlbumSpreads } from '../../domain/album';
import { formatImportNoticeToast } from '../../domain/photo';
import { FilmstripTray } from '../photos/FilmstripTray';
import { RelinkDialog } from '../photos/RelinkDialog';
import { KonvaEditorCanvas } from '../editor/KonvaEditorCanvas';
import { FrameToolbar } from '../editor/FrameToolbar';
import { getTextRuns, resolveCssFontFamily } from '../../domain/text';
import { PageNavigator } from '../album/PageNavigator';
import { CarouselCanvas } from '../carousel/CarouselCanvas';
import { SlideNavigator } from '../carousel/SlideNavigator';
import { PhoneSwipeSimulator } from '../carousel/PhoneSwipeSimulator';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ExportAlbumDialog, ExportOptions } from '../export/ExportAlbumDialog';
import { ExportProgressModal } from '../export/ExportProgressModal';
import { AppTitleBar } from './AppTitleBar';
import { InspectorContainer } from '../inspector/InspectorContainer';
import { StatusBar } from './StatusBar';
import { isMac } from '../../utils/platform';
import styles from './WorkspaceLayout.module.css';

export interface ExportZipProgressPayload {
  current: number;
  total: number;
  percent: number;
  status: string;
  isFinished: boolean;
  targetPath?: string | null;
  error?: string | null;
}

export function WorkspaceLayout() {
  useAutoSave();

  const openSettings = useAppStore((s) => s.openSettings);

  const currentProject = useProjectStore((s) => s.currentProject);
  const openNewProject = useProjectStore((s) => s.openNewProject);
  const saveProject = useProjectStore((s) => s.saveProject);
  const exportProjectAsAfsn = useProjectStore((s) => s.exportProjectAsAfsn);
  const importProjectFromAfsn = useProjectStore((s) => s.importProjectFromAfsn);

  const currentAlbum = useAlbumStore((s) => s.currentAlbum);
  const activeSpreadId = useAlbumStore((s) => s.activeSpreadId);
  const saveStatus = useAlbumStore((s) => s.saveStatus);
  const saveAlbumToDb = useAlbumStore((s) => s.saveAlbumToDb);
  const undo = useAlbumStore((s) => s.undo);
  const redo = useAlbumStore((s) => s.redo);

  const selectedFrameIds = useEditorStore((s) => s.selectedFrameIds);
  const toggleLockSelectedFrames = useEditorStore((s) => s.toggleLockSelectedFrames);
  const addTextToSpread = useEditorStore((s) => s.addTextToSpread);
  const setEditingTextElementId = useEditorStore((s) => s.setEditingTextElementId);

  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [fitTrigger, setFitTrigger] = useState<number>(0);

  const handleFitToScreen = useCallback(() => {
    setFitTrigger((prev) => prev + 1);
  }, []);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const [isFilmstripOpen, setIsFilmstripOpen] = useState(true);
  const [activeMode, setActiveMode] = useState<'print' | 'carousel'>('print');
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const [exportZipProgress, setExportZipProgress] = useState<ExportZipProgressPayload | null>(null);
  const exportZipTimeoutRef = useRef<number | null>(null);

  // Export Dialog & Progress Modal State
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isExportProgressOpen, setIsExportProgressOpen] = useState(false);
  const [activeExportDir, setActiveExportDir] = useState('');

  const handleStartExport = async (options: ExportOptions) => {
    if (!currentProject) return;
    setActiveExportDir(options.outputDir);
    setIsExportProgressOpen(true);
    try {
      const album = useAlbumStore.getState().currentAlbum;
      const selectedIds = new Set(options.selectedSpreadIds || []);
      const faces = new Set<string>();
      for (const spread of album ? getAllAlbumSpreads(album) : []) {
        if (selectedIds.size && !selectedIds.has(spread.id)) continue;
        for (const element of spread.elements) {
          if (element.type !== 'text') continue;
          for (const run of getTextRuns(element.text, element.style, element.styledRanges)) {
            const family = resolveCssFontFamily(run.fontFamily || element.style.fontFamily);
            faces.add(`${run.fontStyle || element.style.fontStyle} ${run.fontWeight || element.style.fontWeight} ${run.fontSize || element.style.fontSize}px ${family}`);
          }
        }
      }
      if (document.fonts) await Promise.allSettled([...faces].map((face) => document.fonts.load(face)));
      await document.fonts?.ready;
      if (!await saveAlbumToDb()) throw new Error('The latest album changes could not be saved before export.');
      await invoke('export_album_high_res', {
        projectId: currentProject.id,
        options,
      });
    } catch (err: any) {
      const errStr = String(err?.message || err || '');
      if (errStr.toLowerCase().includes('cancel')) {
        // User intentionally cancelled; modal displays cancellation state
        return;
      }
      console.error('Export failed:', err);
      setIsExportProgressOpen(false);
      alert(`Export could not be completed: ${err?.message || err}`);
    }
  };

  // Active Import Cancellation & Unsaved Changes Protection Dialog State
  const [pendingSafeAction, setPendingSafeAction] = useState<(() => void | Promise<void>) | null>(null);
  const [pendingImportCancelAction, setPendingImportCancelAction] = useState<(() => void | Promise<void>) | null>(null);

  const confirmSafeAction = useCallback((action: () => void | Promise<void>) => {
    if (usePhotoStore.getState().isRemoving) return;
    if (useProjectStore.getState().isSaving || useProjectStore.getState().isLoading) return;
    if (usePhotoStore.getState().isImporting) {
      setPendingImportCancelAction(() => action);
    } else if (saveStatus !== 'saved') {
      setPendingSafeAction(() => action);
    } else {
      action();
    }
  }, [saveStatus]);

  const showToast = useCallback((msg: string, durationMs: number = 4000) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, durationMs);
  }, []);

  // Surface photo import notices (success, duplicate, cancel, relink) as floating toasts
  const importNotice = usePhotoStore((s) => s.importNotice);
  const dismissImportNotice = usePhotoStore((s) => s.dismissImportNotice);
  const removalNotice = usePhotoStore((s) => s.removalNotice);
  const dismissRemovalNotice = usePhotoStore((s) => s.dismissRemovalNotice);
  useEffect(() => {
    if (removalNotice) {
      showToast(removalNotice, 7000);
      dismissRemovalNotice();
    }
  }, [removalNotice, dismissRemovalNotice, showToast]);

  useEffect(() => {
    if (importNotice) {
      const msg = formatImportNoticeToast(importNotice);
      if (msg) {
        showToast(msg, 5000);
      }
      dismissImportNotice();
    }
  }, [importNotice, dismissImportNotice, showToast]);

  // Listen for real-time Export Project Package (.zip) progress
  useEffect(() => {
    let isMounted = true;
    const unlistenPromise = listen<ExportZipProgressPayload>('export-zip-progress', (event) => {
      if (!isMounted) return;
      const payload = event.payload;
      setExportZipProgress(payload);
      if (payload.isFinished) {
        if (exportZipTimeoutRef.current) clearTimeout(exportZipTimeoutRef.current);
        exportZipTimeoutRef.current = window.setTimeout(() => {
          if (isMounted) setExportZipProgress(null);
        }, 6000);
      }
    });

    return () => {
      isMounted = false;
      unlistenPromise.then((unlisten) => unlisten());
      if (exportZipTimeoutRef.current) clearTimeout(exportZipTimeoutRef.current);
    };
  }, []);

  // Window BeforeUnload Warning when modifications are unsaved
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === 'unsaved') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus]);

  // Automatically open Properties Panel when entering or creating a project, close when exiting to Welcome Screen
  const prevProjectIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (currentProject) {
      if (prevProjectIdRef.current !== currentProject.id) {
        setIsPropertiesOpen(true);
        prevProjectIdRef.current = currentProject.id;
      }
    } else {
      setIsPropertiesOpen(false);
      prevProjectIdRef.current = null;
    }
  }, [currentProject]);

  useTauriInfo();

  // Initialize or load album structure and photos from SQLite DB on project load
  useEffect(() => {
    if (currentProject) {
      const albumStore = useAlbumStore.getState();
      const existingAlbum = albumStore.currentAlbum;

      // Ensure photos & folders for this project are loaded in photoStore
      import('../../stores/photoStore').then(({ usePhotoStore }) => {
        usePhotoStore.getState().loadPhotos(currentProject.id);
        usePhotoStore.getState().loadFolders(currentProject.id);
      });

      if (!existingAlbum || existingAlbum.projectId !== currentProject.id) {
        albumStore.loadAlbumFromDb(currentProject.id).then((loaded) => {
          if (!loaded) {
            albumStore.initializeAlbum(currentProject);
          }
        });
      }
    }
  }, [currentProject]);

  const allSpreads = currentAlbum ? getAllAlbumSpreads(currentAlbum) : [];
  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];



  // Global Keyboard Shortcuts for App
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.defaultPrevented || document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      // Ignore when typing inside input / textarea / select / contentEditable
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
        return;
      }

      // Prevent Windows OS menu bar focus stealing when standalone Alt is pressed outside text inputs
      if (e.key === 'Alt') {
        e.preventDefault();
        return;
      }

      const mac = isMac();
      const cmdOrCtrl = mac ? e.metaKey : e.ctrlKey;

      // 0. F1 or ? -> Open Keyboard Shortcuts Dialog
      if (e.key === 'F1' || (!cmdOrCtrl && !e.altKey && e.key === '?')) {
        e.preventDefault();
        openSettings('shortcuts');
        return;
      }

      // 1. Single Key: P -> Toggle Properties Panel
      if (!cmdOrCtrl && !e.altKey && !e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setIsPropertiesOpen((v) => !v);
        showToast('📋 Properties Panel');
        return;
      }

      // 2. Single Key: L -> Open Lock Panel in Properties
      if (!cmdOrCtrl && !e.altKey && !e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        setIsPropertiesOpen(true);
        showToast('🔒 Locked Photos & Elements');
        return;
      }

      // 3. Single Key: G -> Open Smart Layout in Properties
      if (!cmdOrCtrl && !e.altKey && !e.shiftKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        setIsPropertiesOpen(true);
        showToast('✨ Smart Layout Templates');
        return;
      }

      // 3. Ctrl + Alt + L -> Unlock all items on spread
      if (cmdOrCtrl && e.altKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        if (activeSpread) {
          const lockedCount = (activeSpread.elements || []).filter((el) => el.locked).length;
          if (lockedCount > 0) {
            useEditorStore.getState().unlockAllFramesOnSpread(activeSpread.id);
            showToast(`🔓 Unlocked all ${lockedCount} element(s) on spread`);
          } else {
            showToast('⚠️ No locked elements found on spread');
          }
        }
        return;
      }

      // 4. Ctrl + L -> Lock selected images / texts
      if (cmdOrCtrl && !e.altKey && !e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        if (activeSpread) {
          if (selectedFrameIds.length > 0) {
            toggleLockSelectedFrames(activeSpread.id, true);
            showToast(`🔒 Locked ${selectedFrameIds.length} selected element(s)`);
          } else {
            showToast(`⚠️ Select photo(s) or text(s) to lock (${mac ? '⌘L' : 'Ctrl+L'})`);
          }
        }
        return;
      }

      // 5. Alt + L (or Ctrl + Shift + L) -> Unlock selected images / texts
      if ((e.altKey && (e.key === 'l' || e.key === 'L')) || (cmdOrCtrl && e.shiftKey && (e.key === 'l' || e.key === 'L'))) {
        e.preventDefault();
        if (activeSpread) {
          if (selectedFrameIds.length > 0) {
            toggleLockSelectedFrames(activeSpread.id, false);
            showToast(`🔓 Unlocked ${selectedFrameIds.length} selected element(s)`);
          } else {
            const lockedCount = (activeSpread.elements || []).filter((el) => el.locked).length;
            if (lockedCount > 0) {
              useEditorStore.getState().unlockAllFramesOnSpread(activeSpread.id);
              showToast(`🔓 Unlocked all ${lockedCount} element(s) on spread`);
            } else {
              showToast('⚠️ No locked elements found on spread');
            }
          }
        }
        return;
      }

      // 5. Single Key: T -> Add Text Box to Spread
      if (!cmdOrCtrl && !e.altKey && !e.shiftKey && (e.key === 't' || e.key === 'T')) {
        if (activeSpreadId) {
          e.preventDefault();
          const newId = addTextToSpread(activeSpreadId);
          if (newId) {
            setEditingTextElementId(newId);
            showToast('✓ Added Text Box. Double-click or type to edit.');
          }
        }
        return;
      }

      // Below shortcuts require cmdOrCtrl:
      if (!cmdOrCtrl) return;

      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        redo();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (e.shiftKey) {
          // Save As (.afsn)
          exportProjectAsAfsn().then((path) => {
            if (path) showToast(`✓ Project saved to: ${path.split(/[\\/]/).pop() || path}`);
          });
        } else {
          // Save
          saveProject().then((res) => {
            if (res.success) {
              const fileName = res.filePath ? (res.filePath.split(/[\\/]/).pop() || res.filePath) : '';
              if (res.filePath) {
                showToast(`✓ Project saved to: ${fileName}`);
              } else {
                showToast('✓ Project saved to database');
              }
            }
          });
        }
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        if (currentProject) {
          setIsExportDialogOpen(true);
        }
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        // If hovering over filmstrip, select all photos
        const isHoveredOnFilmstrip = Boolean(document.querySelector('[aria-label="Photo Library Filmstrip"]:hover'));
        if (isHoveredOnFilmstrip) {
          usePhotoStore.getState().selectAll();
          useEditorStore.getState().clearSelection();
        } else {
          // Select all frames on active spread
          const album = useAlbumStore.getState().currentAlbum;
          const curSpreadId = useAlbumStore.getState().activeSpreadId;
          const spreads = album ? getAllAlbumSpreads(album) : [];
          const curSpread = spreads.find((s) => s.id === curSpreadId) || spreads[0];
          if (curSpread && curSpread.elements && curSpread.elements.length > 0) {
            useEditorStore.getState().selectFrames(curSpread.elements.map((f) => f.id));
            usePhotoStore.getState().clearSelection();
          }
        }
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        confirmSafeAction(async () => {
          await importProjectFromAfsn();
        });
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        confirmSafeAction(() => openNewProject());
      } else if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
        e.preventDefault();
        handleFitToScreen();
      } else if (e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd') {
        e.preventDefault();
        setZoomLevel((z) => Math.min(350, z + 15));
      } else if (e.key === '-' || e.key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        setZoomLevel((z) => Math.max(25, z - 15));
      }
    },
    [undo, redo, saveProject, exportProjectAsAfsn, importProjectFromAfsn, openNewProject, confirmSafeAction, showToast, activeSpreadId, activeSpread, selectedFrameIds, toggleLockSelectedFrames, addTextToSpread, setEditingTextElementId, currentProject, handleFitToScreen]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className={styles.workspace}>
      {/* macOS Integrated Titlebar with 80px Traffic Light Inset & Mode Switcher Shell */}
      <AppTitleBar
        onOpenExportDialog={() => setIsExportDialogOpen(true)}
        onToggleProperties={() => setIsPropertiesOpen((v) => !v)}
        isPropertiesOpen={isPropertiesOpen}
        showToast={showToast}
        confirmSafeAction={confirmSafeAction}
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        onFitToScreen={handleFitToScreen}
        activeMode={activeMode}
        onModeSelect={(mode) => {
          setActiveMode(mode);
          if (mode === 'carousel' && currentProject) {
            const cs = useCarouselStore.getState();
            if (!cs.currentCarousel || cs.currentCarousel.projectId !== currentProject.id) {
              cs.initializeCarousel(currentProject.id);
            }
          }
        }}
      />

      {/* Center Editor Area (contains Canvas + Bottom Full-Width PageNavigator) */}
      <div className={styles.centerArea}>
        <main className={styles.canvas}>
          {!currentProject ? (
            <WelcomeScreen />
          ) : activeMode === 'carousel' ? (
            <>
              <CarouselCanvas
                zoomLevel={zoomLevel}
                fitTrigger={fitTrigger}
                onZoomChange={setZoomLevel}
                onToast={showToast}
              />
              <FrameToolbar />
            </>
          ) : (
            <>
              <KonvaEditorCanvas
                zoomLevel={zoomLevel}
                fitTrigger={fitTrigger}
                onZoomChange={setZoomLevel}
                onToast={showToast}
              />
              <FrameToolbar />
            </>
          )}
        </main>

        {/* Page & Spread / Slide Navigation Bar spanning full width of the editor */}
        {currentProject && activeMode === 'carousel' && (
          <SlideNavigator onOpenSimulator={() => setIsSimulatorOpen(true)} />
        )}
        {currentProject && activeMode !== 'carousel' && <PageNavigator />}
        {currentProject && (
          <StatusBar
            zoomLevel={zoomLevel}
            onZoomChange={setZoomLevel}
            onFitToScreen={handleFitToScreen}
            activeMode={activeMode}
          />
        )}
      </div>

      {/* Right Panel: Collapsible Properties & Smart Layout */}
      {currentProject && isPropertiesOpen && (
        <InspectorContainer
          onClose={() => setIsPropertiesOpen(false)}
          onToast={showToast}
        />
      )}

      {/* Bottom Photo Library Filmstrip */}
      {currentProject && (
        <FilmstripTray
          isOpen={isFilmstripOpen}
          onToggle={() => setIsFilmstripOpen((v) => !v)}
        />
      )}

      {/* Relink Missing Photos Dialog */}
      <RelinkDialog />

      {/* Real-Time Export Project Package (.zip) Progress Toast */}
      {exportZipProgress && (
        <div
          className={`${styles.exportZipToast} ${exportZipProgress.error ? styles.exportZipToastError : ''} ${exportZipProgress.isFinished && !exportZipProgress.error ? styles.exportZipToastSuccess : ''}`}
          role="status"
          aria-live="polite"
        >
          {/* Header */}
          <div className={styles.exportZipHeader}>
            <div className={styles.exportZipTitleGroup}>
              {exportZipProgress.error ? (
                <span className={styles.exportZipIconError} aria-hidden="true">⚠️</span>
              ) : exportZipProgress.isFinished ? (
                <span className={styles.exportZipIconSuccess} aria-hidden="true">✓</span>
              ) : (
                <span className={styles.exportZipIconSpin} aria-hidden="true">📦</span>
              )}
              <span className={styles.exportZipTitle}>
                {exportZipProgress.error
                  ? 'Export Failed'
                  : exportZipProgress.isFinished
                  ? 'Project Package Exported'
                  : 'Exporting Project Package (.zip)...'}
              </span>
            </div>

            <div className={styles.exportZipHeaderRight}>
              {!exportZipProgress.error && (
                <span className={styles.exportZipPercentBadge}>
                  {exportZipProgress.percent}%
                </span>
              )}
              {(exportZipProgress.isFinished || exportZipProgress.error) && (
                <button
                  type="button"
                  className={styles.exportZipDismissBtn}
                  onClick={() => {
                    if (exportZipTimeoutRef.current) clearTimeout(exportZipTimeoutRef.current);
                    setExportZipProgress(null);
                  }}
                  title="Dismiss"
                  aria-label="Dismiss export notification"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className={styles.exportZipBarTrack}>
            <div
              className={styles.exportZipBarFill}
              style={{
                width: `${Math.min(Math.max(exportZipProgress.percent, 0), 100)}%`,
              }}
            />
          </div>

          {/* Footer Status & Count */}
          <div className={styles.exportZipFooter}>
            <span className={styles.exportZipStatus} title={exportZipProgress.status}>
              {exportZipProgress.targetPath && exportZipProgress.isFinished
                ? `Saved: ${exportZipProgress.targetPath.split(/[\\/]/).pop() || exportZipProgress.targetPath}`
                : exportZipProgress.status}
            </span>
            {exportZipProgress.total > 0 && !exportZipProgress.isFinished && !exportZipProgress.error && (
              <span className={styles.exportZipCounter}>
                {exportZipProgress.current} / {exportZipProgress.total}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Floating Notification Toast */}
      {toastMessage && !exportZipProgress && (
        <div
          className={styles.toastBanner}
          onClick={() => {
            if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
            setToastMessage(null);
          }}
          title="Click to dismiss"
          role="status"
          style={{ cursor: 'pointer' }}
        >
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Active Photo Import In Progress Confirmation Dialog */}
      <ConfirmDialog
        isOpen={pendingImportCancelAction !== null}
        title="Cancel Photo Import?"
        message={`Photos are currently being imported into "${currentProject?.name}". Closing or leaving now will cancel the remaining import process.`}
        detail="Photos that have already finished importing will remain safely in your album library. Background canvas preview generation and remaining queued files will be stopped immediately."
        confirmText="Cancel Import & Continue"
        cancelText="Keep Importing"
        variant="warning"
        onConfirm={async () => {
          await usePhotoStore.getState().cancelAllImports();
          const act = pendingImportCancelAction;
          setPendingImportCancelAction(null);
          if (act) {
            if (saveStatus === 'unsaved') {
              setPendingSafeAction(() => act);
            } else {
              await act();
            }
          }
        }}
        onCancel={() => setPendingImportCancelAction(null)}
      />

      {/* Unsaved Changes Confirmation Dialog */}
      <ConfirmDialog
        isOpen={pendingSafeAction !== null}
        title="Unsaved Changes"
        message={`You have unsaved changes in "${currentProject?.name}". Do you want to save them before leaving?`}
        detail="If you leave without saving, your recent page layouts and edits since the last save will be lost."
        confirmText="Save & Continue"
        secondaryText="Don't Save"
        cancelText="Cancel"
        variant="warning"
        onConfirm={async () => {
          const result = await saveProject();
          if (!result.success || useAlbumStore.getState().saveStatus !== 'saved') return;
          const act = pendingSafeAction;
          setPendingSafeAction(null);
          if (act) await act();
        }}
        onSecondary={async () => {
          const act = pendingSafeAction;
          setPendingSafeAction(null);
          if (act) await act();
        }}
        onCancel={() => setPendingSafeAction(null)}
      />

      {/* Phase 8: High-Resolution Print Export Dialog */}
      <ExportAlbumDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        onStartExport={handleStartExport}
      />

      {/* Phase 8: Export Progress Modal */}
      <ExportProgressModal
        isOpen={isExportProgressOpen}
        outputDir={activeExportDir}
        onClose={() => setIsExportProgressOpen(false)}
      />

      {/* Phase 3: Phone Swipe Simulator Modal */}
      <PhoneSwipeSimulator
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
      />
    </div>
  );
}
