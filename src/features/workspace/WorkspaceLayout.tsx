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
import { getCurrentWebview } from '@tauri-apps/api/webview';
import Konva from 'konva';
import { DropZoneHUD } from './DropZoneHUD';
import { useHistoryStore } from '../../stores/historyStore';
import { getProjectDimensionsInCanvasUnit } from '../../domain/templates';
import {
  generateAdaptiveLayoutVariations,
  buildSpreadElementsFromVariation,
  partitionPageBoxIntoKRects,
  type AdaptivePhoto,
} from '../../domain/adaptiveLayout';
import { getSlideXOffset } from '../../domain/carousel';
import { findPhotoSwapTarget } from '../editor/photoSwapDrag';
import { StatusBar } from './StatusBar';
import { isMac, isTauri } from '../../utils/platform';
import styles from './WorkspaceLayout.module.css';

const SUPPORTED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'tiff', 'tif', 'webp', 'heic', 'heif',
  'raw', 'cr2', 'nef', 'arw', 'dng', 'raf', 'orf', 'rw2', 'pef'
]);

function isSupportedFileOrDir(filePath: string): boolean {
  const parts = filePath.split(/[\\/]/);
  const fileName = parts[parts.length - 1] || '';
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1) return true; // Likely a directory
  const ext = fileName.slice(dotIndex + 1).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

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
  const activeModeRef = useRef(activeMode);
  activeModeRef.current = activeMode;
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // External Finder Drag-and-Drop Ingestion state
  const [isFinderDragging, setIsFinderDragging] = useState(false);
  const [finderDropZone, setFinderDropZone] = useState<'canvas' | 'filmstrip' | 'none'>('none');
  const [draggedFileCount, setDraggedFileCount] = useState(0);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const [exportZipProgress, setExportZipProgress] = useState<ExportZipProgressPayload | null>(null);
  const exportZipTimeoutRef = useRef<number | null>(null);

  // Spacebar Disambiguation State Machine Refs (Single-Tap vs Pan-Drag)
  const spaceDownTimeRef = useRef<number | null>(null);
  const isSpaceHeldRef = useRef(false);
  const hasDraggedRef = useRef(false);
  const shiftHeldRef = useRef(false);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);

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
    if (!isTauri()) return;
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

  // Resolve whether cursor client coordinates fall inside Filmstrip Tray or Canvas area
  const resolveDropTargetZone = useCallback((clientX: number, clientY: number): 'canvas' | 'filmstrip' | 'none' => {
    const filmstripEl = document.querySelector('[class*="filmstrip"]');
    if (filmstripEl && isFilmstripOpen) {
      const rect = filmstripEl.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= window.innerHeight && clientX >= 0 && clientX <= window.innerWidth) {
        return 'filmstrip';
      }
    }

    const mainEl = document.querySelector('main');
    if (mainEl) {
      const rect = mainEl.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return 'canvas';
      }
    }

    if (clientY >= 40 && clientY <= window.innerHeight && clientX >= 0 && clientX <= window.innerWidth) {
      return 'canvas';
    }

    return 'none';
  }, [isFilmstripOpen]);

  // Handle drops onto the Canvas (D-02, D-03)
  const handleCanvasFinderDrop = useCallback(async (
    validPaths: string[],
    clientX: number,
    clientY: number
  ) => {
    if (!currentProject) return;

    showToast(`Ingesting ${validPaths.length} photo${validPaths.length > 1 ? 's' : ''}...`);
    const newPhotos = await usePhotoStore.getState().importPathsAndGetPhotos(currentProject.id, validPaths);

    if (!newPhotos || newPhotos.length === 0) {
      showToast('Unable to load dropped photos into library');
      return;
    }

    if (activeMode === 'print') {
      const { currentAlbum, activeSpreadId } = useAlbumStore.getState();
      if (!currentAlbum) return;

      const isCover = currentAlbum.coverSpread.id === activeSpreadId;
      const targetSpread = isCover
        ? currentAlbum.coverSpread
        : currentAlbum.spreads.find((s) => s.id === activeSpreadId) || currentAlbum.spreads[0];

      if (!targetSpread) return;

      // Convert clientX, clientY to physical spread coordinates
      let physicalPt: { x: number; y: number } | null = null;
      const stage = Konva.stages[0];
      if (stage) {
        const stageBox = stage.container().getBoundingClientRect();
        const dropX = clientX - stageBox.left;
        const dropY = clientY - stageBox.top;
        const dims = getProjectDimensionsInCanvasUnit(currentProject, targetSpread);
        const spreadWidth = isCover
          ? (targetSpread.leftPage ? targetSpread.leftPage.width : dims.pageWidth) +
            (targetSpread.rightPage ? targetSpread.rightPage.width : 0) +
            dims.gutterWidth
          : dims.pageWidth * 2 + dims.gutterWidth;

        const bgSheet = stage.findOne('.background-sheet');
        const screenSpreadW = bgSheet ? bgSheet.width() : spreadWidth;
        const scaleFactor = screenSpreadW / spreadWidth;

        physicalPt = {
          x: (dropX - stage.x()) / scaleFactor,
          y: (dropY - stage.y()) / scaleFactor,
        };
      }

      // 1. Single photo drop over an existing unlocked frame -> Swap/Replace (D-02)
      if (newPhotos.length === 1 && physicalPt) {
        const targetFrame = findPhotoSwapTarget(
          targetSpread.elements || [],
          physicalPt,
          ''
        );

        if (targetFrame) {
          const replacedPhoto = newPhotos[0]!;
          useEditorStore.getState().replacePhotoInFrame(targetSpread.id, targetFrame.id, replacedPhoto);
          useEditorStore.getState().clearSelection();
          usePhotoStore.setState((s) => ({
            photos: s.photos.map((p) => (p.id === replacedPhoto.id ? { ...p, usedCount: (p.usedCount || 0) + 1 } : p)),
          }));
          showToast('Replaced photo in frame');
          return;
        }
      }

      // 2. Multi-photo drop (>6 photos) -> Auto-Flow Multi-Spread Storytelling Engine (FLOW-04)
      const existingPhotoCount = (targetSpread.elements || []).filter((e) => e.type === 'photo').length;
      if (newPhotos.length > 6) {
        showToast(`Auto-flowing ${newPhotos.length} photos across sequential spreads...`);
        await useAlbumStore.getState().autoFlowPhotosToSpreads(newPhotos, currentProject, {
          replaceCurrentSpread: existingPhotoCount === 0 && !isCover,
        });

        const placedIdSet = new Set(newPhotos.map((p) => p.id));
        usePhotoStore.setState((s) => ({
          photos: s.photos.map((p) => (placedIdSet.has(p.id) ? { ...p, usedCount: (p.usedCount || 0) + 1 } : p)),
        }));

        showToast(`Auto-flowed ${newPhotos.length} photos into album`);
        return;
      }

      // 3. Multi-photo drop (2-6 photos) on empty spread -> Smart Auto-Partitioning (D-03)
      if (existingPhotoCount === 0 && newPhotos.length >= 2 && newPhotos.length <= 6) {
        const dims = getProjectDimensionsInCanvasUnit(currentProject, targetSpread);
        const isSpread = !isCover;
        const spreadWidth = isCover
          ? (targetSpread.leftPage ? targetSpread.leftPage.width : dims.pageWidth) +
            (targetSpread.rightPage ? targetSpread.rightPage.width : 0) +
            dims.gutterWidth
          : dims.pageWidth * 2 + dims.gutterWidth;
        const spreadHeight = dims.pageHeight;

        const adaptivePhotos: AdaptivePhoto[] = newPhotos.map((p, idx) => ({
          id: `photo-${Date.now()}-${idx + 1}`,
          photoId: p.id,
          filePath: p.filePath,
          fileName: p.fileName,
          previewPath: p.previewPath ?? undefined,
          thumbnailPath: p.thumbnailPath ?? undefined,
          photoAspect: p.width > 0 && p.height > 0 ? p.width / p.height : 1.5,
          isFavorite: p.isFavorite,
        }));

        const variations = generateAdaptiveLayoutVariations(
          {
            spreadWidth,
            spreadHeight,
            isSpread,
            safeMargin: dims.safeMargin,
            safeMarginTop: dims.safeMarginTop,
            safeMarginBottom: dims.safeMarginBottom,
            safeMarginOutside: dims.safeMarginOutside,
            safeMarginSpine: dims.safeMarginSpine,
            gutterWidth: dims.gutterWidth,
            spacing: dims.spacing,
            lockedElements: [],
          },
          adaptivePhotos
        );

        if (variations.length > 0) {
          const bestVariation = variations[0]!;
          const newElements = buildSpreadElementsFromVariation(
            bestVariation,
            adaptivePhotos,
            currentProject.borderEnabled,
            currentProject.borderWidth,
            currentProject.borderColor
          );

          useHistoryStore.getState().pushState(currentAlbum);

          const textElements = (targetSpread.elements || []).filter((e) => e.type === 'text');
          const allElements = [...newElements, ...textElements];

          if (isCover) {
            useAlbumStore.setState({
              currentAlbum: {
                ...currentAlbum,
                coverSpread: { ...currentAlbum.coverSpread, elements: allElements },
              },
              saveStatus: 'unsaved',
            });
          } else {
            const updatedSpreads = currentAlbum.spreads.map((s) =>
              s.id === targetSpread.id ? { ...s, elements: allElements } : s
            );
            useAlbumStore.setState({
              currentAlbum: {
                ...currentAlbum,
                spreads: updatedSpreads,
              },
              saveStatus: 'unsaved',
            });
          }

          useEditorStore.setState({
            selectedFrameIds: newElements.map((el) => el.id),
            selectionGroupRotation: null,
          });

          const placedIdSet = new Set(newPhotos.map((p) => p.id));
          usePhotoStore.setState((s) => ({
            photos: s.photos.map((p) => (placedIdSet.has(p.id) ? { ...p, usedCount: (p.usedCount || 0) + 1 } : p)),
          }));

          showToast(`Placed ${newPhotos.length} photos with Smart Auto-Partitioning`);
          return;
        }
      }

      // 3. Otherwise: Add photos to spread (single photo, >6 photos, or spread already has elements)
      useEditorStore.getState().addPhotosToSpread(
        targetSpread.id,
        newPhotos,
        physicalPt ?? undefined
      );

      const placedIdSet = new Set(newPhotos.map((p) => p.id));
      usePhotoStore.setState((s) => ({
        photos: s.photos.map((p) => (placedIdSet.has(p.id) ? { ...p, usedCount: (p.usedCount || 0) + 1 } : p)),
      }));

      showToast(`Added ${newPhotos.length} photo${newPhotos.length > 1 ? 's' : ''} to spread`);
      return;
    }

    if (activeMode === 'carousel') {
      const { currentCarousel, activeSlideIndex, addPhotoFrame } = useCarouselStore.getState();
      if (!currentCarousel) return;

      const targetSlide = currentCarousel.slides[activeSlideIndex] || currentCarousel.slides[0];
      if (!targetSlide) return;

      const slideWidth = currentCarousel.slideWidthPx;
      const slideHeight = currentCarousel.slideHeightPx;
      const slideX = getSlideXOffset(currentCarousel, activeSlideIndex);

      if (newPhotos.length > 4) {
        showToast(`Auto-flowing ${newPhotos.length} photos across sequential slides...`);
        await useCarouselStore.getState().autoFlowPhotosToSlides(newPhotos);

        const placedIdSet = new Set(newPhotos.map((p) => p.id));
        usePhotoStore.setState((s) => ({
          photos: s.photos.map((p) => (placedIdSet.has(p.id) ? { ...p, usedCount: (p.usedCount || 0) + 1 } : p)),
        }));

        showToast(`Auto-flowed ${newPhotos.length} photos across carousel slides`);
        return;
      }

      if (targetSlide.elements.length === 0 && newPhotos.length >= 2) {
        const margin = 40;
        const spacing = 16;
        const slideBox = {
          x: slideX + margin,
          y: margin,
          width: slideWidth - margin * 2,
          height: slideHeight - margin * 2,
        };
        const rects = partitionPageBoxIntoKRects(slideBox, newPhotos.length, spacing, 0);

        rects.forEach((rect, idx) => {
          const photo = newPhotos[idx]!;
          addPhotoFrame(activeSlideIndex, {
            type: 'photo',
            photoId: photo.id,
            filePath: photo.filePath,
            fileName: photo.fileName,
            previewPath: photo.previewPath ?? undefined,
            thumbnailPath: photo.thumbnailPath ?? undefined,
            photoAspect: photo.width > 0 && photo.height > 0 ? photo.width / photo.height : rect.width / rect.height,
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            rotation: 0,
          });
        });

        const placedIdSet = new Set(newPhotos.map((p) => p.id));
        usePhotoStore.setState((s) => ({
          photos: s.photos.map((p) => (placedIdSet.has(p.id) ? { ...p, usedCount: (p.usedCount || 0) + 1 } : p)),
        }));

        showToast(`Placed ${newPhotos.length} photos onto slide`);
        return;
      }

      newPhotos.forEach((photo, idx) => {
        const aspect = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1.0;
        const pad = 60;
        const maxW = slideWidth - pad * 2;
        const maxH = slideHeight - pad * 2;
        let frameW = maxW;
        let frameH = frameW / aspect;
        if (frameH > maxH) {
          frameH = maxH;
          frameW = frameH * aspect;
        }
        const offset = idx * 24;
        const frameX = slideX + (slideWidth - frameW) / 2 + offset;
        const frameY = (slideHeight - frameH) / 2 + offset;

        addPhotoFrame(activeSlideIndex, {
          type: 'photo',
          photoId: photo.id,
          filePath: photo.filePath,
          fileName: photo.fileName,
          previewPath: photo.previewPath ?? undefined,
          thumbnailPath: photo.thumbnailPath ?? undefined,
          photoAspect: aspect,
          x: Math.round(frameX),
          y: Math.round(frameY),
          width: Math.round(frameW),
          height: Math.round(frameH),
          rotation: 0,
        });
      });

      const placedIdSet = new Set(newPhotos.map((p) => p.id));
      usePhotoStore.setState((s) => ({
        photos: s.photos.map((p) => (placedIdSet.has(p.id) ? { ...p, usedCount: (p.usedCount || 0) + 1 } : p)),
      }));

      showToast(`Added ${newPhotos.length} photo${newPhotos.length > 1 ? 's' : ''} to slide`);
    }
  }, [currentProject, activeMode, showToast]);

  // Handle external drops routed by zone (D-01 vs D-02)
  const handleFinderDrop = useCallback(async (
    paths: string[],
    targetZone: 'canvas' | 'filmstrip' | 'none',
    clientX: number,
    clientY: number
  ) => {
    if (!currentProject) {
      showToast('Open or create a project before dropping photos');
      return;
    }

    const validPaths = (paths || []).filter(isSupportedFileOrDir);
    if (validPaths.length === 0) {
      showToast('No supported image files or folders detected in drop');
      return;
    }

    if (targetZone === 'filmstrip') {
      showToast(`Importing ${validPaths.length} item${validPaths.length > 1 ? 's' : ''} into library...`);
      await usePhotoStore.getState().importPaths(currentProject.id, validPaths);
    } else {
      await handleCanvasFinderDrop(validPaths, clientX, clientY);
    }
  }, [currentProject, handleCanvasFinderDrop, showToast]);

  // Register window drag-and-drop event listener (Tauri native + browser dev fallback)
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let isCancelled = false;

    if (isTauri()) {
      try {
        getCurrentWebview()
          .onDragDropEvent((event) => {
            if (isCancelled) return;
            const payload = event.payload;

            if (payload.type === 'enter') {
              const paths = payload.paths || [];
              // Ignore internal DOM drag events (e.g. from filmstrip tray) which have empty paths
              if (paths.length === 0) return;
              setIsFinderDragging(true);
              setDraggedFileCount(paths.length);
              const clientX = payload.position.x / window.devicePixelRatio;
              const clientY = payload.position.y / window.devicePixelRatio;
              setFinderDropZone(resolveDropTargetZone(clientX, clientY));
            } else if (payload.type === 'over') {
              if (!isFinderDragging) return;
              const clientX = payload.position.x / window.devicePixelRatio;
              const clientY = payload.position.y / window.devicePixelRatio;
              setFinderDropZone(resolveDropTargetZone(clientX, clientY));
            } else if (payload.type === 'leave') {
              setIsFinderDragging(false);
              setFinderDropZone('none');
              setDraggedFileCount(0);
            } else if (payload.type === 'drop') {
              setIsFinderDragging(false);
              setFinderDropZone('none');
              setDraggedFileCount(0);
              const paths = payload.paths || [];
              // If paths is empty, this drop is an internal HTML5 DOM drag (from FilmstripTray or Canvas)
              // DO NOT show any error toast! Let HTML5 onDrop handler manage it.
              if (paths.length === 0) return;

              const clientX = payload.position.x / window.devicePixelRatio;
              const clientY = payload.position.y / window.devicePixelRatio;
              const targetZone = resolveDropTargetZone(clientX, clientY);
              void handleFinderDrop(paths, targetZone, clientX, clientY);
            }
          })
          .then((fn) => {
            if (isCancelled) fn();
            else unlisten = fn;
          })
          .catch((err) => {
            console.warn('[AFSN] Error attaching onDragDropEvent listener:', err);
          });
      } catch (err) {
        console.warn('[AFSN] Error initializing getCurrentWebview:', err);
      }
    } else {
      // Browser fallback (Vite dev mode in standard browser)
      const handleWindowDragOver = (e: DragEvent) => {
        if (!e.dataTransfer?.types?.includes('Files')) return;
        e.preventDefault();
        setIsFinderDragging(true);
        setFinderDropZone(resolveDropTargetZone(e.clientX, e.clientY));
      };
      const handleWindowDragLeave = (e: DragEvent) => {
        if (!e.relatedTarget) {
          setIsFinderDragging(false);
          setFinderDropZone('none');
        }
      };
      const handleWindowDrop = () => {
        setIsFinderDragging(false);
        setFinderDropZone('none');
      };
      window.addEventListener('dragover', handleWindowDragOver);
      window.addEventListener('dragleave', handleWindowDragLeave);
      window.addEventListener('drop', handleWindowDrop);
      unlisten = () => {
        window.removeEventListener('dragover', handleWindowDragOver);
        window.removeEventListener('dragleave', handleWindowDragLeave);
        window.removeEventListener('drop', handleWindowDrop);
      };
    }

    return () => {
      isCancelled = true;
      if (unlisten) unlisten();
    };
  }, [resolveDropTargetZone, handleFinderDrop]);

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

      // In carousel mode: suppress all non-cmdOrCtrl single-key album shortcuts
      // (Delete, T, L, G, R, S, Arrow, etc.) so they don't leak into album store.
      // Global shortcuts (Cmd+S, Cmd+Z, Cmd+E, F1, zoom) still pass through.
      if (activeMode === 'carousel' && !cmdOrCtrl && e.key !== 'F1' && e.key !== '?') {
        return;
      }

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

      const curMode = activeModeRef.current;

      // Below shortcuts require cmdOrCtrl:
      if (!cmdOrCtrl) return;

      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (curMode === 'carousel') {
          if (e.shiftKey) {
            useCarouselStore.getState().redo();
            showToast('↷ Redo');
          } else {
            useCarouselStore.getState().undo();
            showToast('↶ Undo');
          }
        } else {
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        if (curMode === 'carousel') {
          useCarouselStore.getState().redo();
          showToast('↷ Redo');
        } else {
          redo();
        }
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
          if (curMode === 'carousel') {
            useCarouselStore.getState().setSelectedFrameIds([]);
          } else {
            useEditorStore.getState().clearSelection();
          }
        } else if (curMode === 'carousel') {
          useCarouselStore.getState().selectAllFramesOnSlide();
          usePhotoStore.getState().clearSelection();
          showToast('✓ Selected all elements on slide');
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
        setZoomLevel((z) => Math.max(5, z - 15));
      }
    },
    [activeMode, undo, redo, saveProject, exportProjectAsAfsn, importProjectFromAfsn, openNewProject, confirmSafeAction, showToast, activeSpreadId, activeSpread, selectedFrameIds, toggleLockSelectedFrames, addTextToSpread, setEditingTextElementId, currentProject, handleFitToScreen]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Authoritative Spacebar Disambiguation State Machine (Single-Tap vs Pan-Drag)
  useEffect(() => {
    const handleSpaceKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        const { editingCropFrameId, editingTextElementId } = useEditorStore.getState();
        if (editingCropFrameId || editingTextElementId) return;

        e.preventDefault(); // Prevent page scroll
        if (e.repeat) return;

        spaceDownTimeRef.current = performance.now();
        isSpaceHeldRef.current = true;
        hasDraggedRef.current = false;
        shiftHeldRef.current = e.shiftKey;
        pointerDownPosRef.current = null;
      }
    };

    const handlePointerMove = (e: MouseEvent | PointerEvent) => {
      if (isSpaceHeldRef.current && (e.buttons === 1 || e.buttons === 4)) {
        if (!pointerDownPosRef.current) {
          pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
        } else {
          const dx = e.clientX - pointerDownPosRef.current.x;
          const dy = e.clientY - pointerDownPosRef.current.y;
          if (Math.hypot(dx, dy) > 4) {
            hasDraggedRef.current = true;
          }
        }
      }
    };

    const handleSpaceKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }

        if (isSpaceHeldRef.current) {
          const downTime = spaceDownTimeRef.current;
          const elapsed = downTime !== null ? performance.now() - downTime : 9999;
          const wasDrag = hasDraggedRef.current;
          const shiftHeld = shiftHeldRef.current;

          // Reset refs
          isSpaceHeldRef.current = false;
          spaceDownTimeRef.current = null;
          hasDraggedRef.current = false;
          pointerDownPosRef.current = null;

          // Disambiguation: single tap without dragging under 600ms
          // Only cycle layout in print/album mode — carousel has its own spacebar handler
          if (!wasDrag && elapsed < 600 && activeMode !== 'carousel') {
            e.preventDefault();
            useEditorStore.getState().cycleLayout(shiftHeld ? 'prev' : 'next', activeMode);
          }
        }
      }
    };

    window.addEventListener('keydown', handleSpaceKeyDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('keyup', handleSpaceKeyUp);

    return () => {
      window.removeEventListener('keydown', handleSpaceKeyDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('keyup', handleSpaceKeyUp);
    };
  }, [activeMode]);

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
          activeMode={activeMode}
        />
      )}

      {/* Bottom Photo Library Filmstrip */}
      {currentProject && (
        <FilmstripTray
          isOpen={isFilmstripOpen}
          onToggle={() => setIsFilmstripOpen((v) => !v)}
          activeMode={activeMode}
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
        activeMode={activeMode}
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

      {/* External Finder Drag-and-Drop Ingestion HUD */}
      <DropZoneHUD
        isVisible={isFinderDragging}
        targetZone={finderDropZone}
        activeMode={activeMode}
        itemCount={draggedFileCount}
      />
    </div>
  );
}
