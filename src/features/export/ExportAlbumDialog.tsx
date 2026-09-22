import { useState, useMemo, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  RectangleHorizontal,
  PanelLeft,
  PanelRight,
  ShieldCheck,
  Scissors,
  Image,
  FileImage,
  FileText,
  FileArchive,
  Layers,
  Sliders,
  Info,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Tag,
  X,
  Check,
  FolderOpen,
  Folder,
  Download,
  FileDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { useProjectStore } from '../../stores/projectStore';
import { useAlbumStore } from '../../stores/albumStore';
import { usePhotoStore } from '../../stores/photoStore';
import { useCarouselStore } from '../../stores/carouselStore';
import { getAllAlbumSpreads, Spread } from '../../domain/album';
import { ExportSpreadPreview, ExportPreviewViewMode } from './ExportSpreadPreview';
import styles from './ExportAlbumDialog.module.css';

import {
  parseRange,
  type ExportOptions,
  type MissingPhotoInfo,
  type PreflightReport,
} from './exportUtils';

export {
  parseRange,
  type ExportOptions,
  type MissingPhotoInfo,
  type PreflightReport,
};

interface ExportAlbumDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStartExport: (options: ExportOptions) => void;
  activeMode?: 'print' | 'carousel';
}

const LAST_EXPORT_DIR_KEY = 'afsn_last_export_dir';

export function ExportAlbumDialog({ isOpen, onClose, onStartExport, activeMode = 'print' }: ExportAlbumDialogProps) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const currentAlbum = useAlbumStore((s) => s.currentAlbum);
  const activeSpreadId = useAlbumStore((s) => s.activeSpreadId);
  const openRelink = usePhotoStore((s) => s.openRelink);

  const [format, setFormat] = useState<'jpeg' | 'png' | 'tiff' | 'pdf' | 'psd'>('jpeg');
  const [dpi, setDpi] = useState<number>(currentProject?.canvasDpi || 300);
  const [isCustomDpi, setIsCustomDpi] = useState<boolean>(false);
  const [customDpiText, setCustomDpiText] = useState<string>(String(currentProject?.canvasDpi || 300));
  const [jpegQuality, setJpegQuality] = useState<number>(95);
  const [includeBleed, setIncludeBleed] = useState<boolean>(false);
  const [splitPages, setSplitPages] = useState<boolean>(false);
  const [sharpenEnabled, setSharpenEnabled] = useState<boolean>(true);
  const [sharpenAmount, setSharpenAmount] = useState<'standard' | 'high'>('standard');
  const [tiffBitDepth, setTiffBitDepth] = useState<8 | 16>(16);
  const [tiffCompression, setTiffCompression] = useState<'lzw' | 'none'>('lzw');
  const [pdfPrintReady, setPdfPrintReady] = useState<boolean>(true);
  const [slugMm, setSlugMm] = useState<number>(5.0);
  const [cropMarks, setCropMarks] = useState<boolean>(true);

  // Workflow tab: allow switching between Print Album Export and Instagram Carousel Slices
  const [workflowTab, setWorkflowTab] = useState<'album' | 'carousel'>(
    activeMode === 'carousel' ? 'carousel' : 'album'
  );
  useEffect(() => {
    if (isOpen) {
      setWorkflowTab(activeMode === 'carousel' ? 'carousel' : 'album');
      setErrorMsg(null);
      setCarouselSuccessMsg(null);
    }
  }, [isOpen, activeMode]);

  // Carousel Slices State
  const currentCarousel = useCarouselStore((s) => s.currentCarousel);
  const [carouselQuality, setCarouselQuality] = useState<number>(92);
  const [exportPanorama, setExportPanorama] = useState<boolean>(true);
  const [carouselPrefix, setCarouselPrefix] = useState<string>('');
  const [isExportingCarousel, setIsExportingCarousel] = useState<boolean>(false);
  const [carouselSuccessMsg, setCarouselSuccessMsg] = useState<string | null>(null);

  const [scope, setScope] = useState<'all' | 'current' | 'custom'>('all');
  const [customRange, setCustomRange] = useState<string>('1-2');
  const [rangeMode, setRangeMode] = useState<'spreads' | 'pages'>('spreads');
  const [filePrefix, setFilePrefix] = useState<string>('');

  const [outputDir, setOutputDir] = useState<string>(() => {
    try {
      return localStorage.getItem(LAST_EXPORT_DIR_KEY) || '';
    } catch {
      return '';
    }
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pre-Flight Validation State (missing photos & existing destination file collisions)
  const [preflightReport, setPreflightReport] = useState<PreflightReport | null>(null);
  const [isVerifyingPreflight, setIsVerifyingPreflight] = useState(false);
  const [isOverwriteModalOpen, setIsOverwriteModalOpen] = useState(false);
  const [isMissingModalOpen, setIsMissingModalOpen] = useState(false);

  const allSpreads: Spread[] = useMemo(() => {
    if (!currentAlbum) return [];
    const list: Spread[] = [];
    if (
      currentAlbum.coverSpread &&
      ((currentAlbum.coverSpread.elements && currentAlbum.coverSpread.elements.length > 0) ||
        currentAlbum.coverSpread.id === activeSpreadId)
    ) {
      list.push(currentAlbum.coverSpread);
    }
    list.push(...getAllAlbumSpreads(currentAlbum));
    return list;
  }, [currentAlbum, activeSpreadId]);

  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];

  // Live Preview Navigation & Inspection State
  const [activePreviewSpreadId, setActivePreviewSpreadId] = useState<string>('');
  const [previewViewMode, setPreviewViewMode] = useState<ExportPreviewViewMode>('spread');
  const [showBleedGuide, setShowBleedGuide] = useState<boolean>(true);
  const [showSafeAreaGuide, setShowSafeAreaGuide] = useState<boolean>(() => {
    return useAlbumStore.getState().showSafeAreaGuide ?? true;
  });

  // Sync active spread whenever dialog opens or active spread changes
  useEffect(() => {
    if (isOpen) {
      const targetId = activeSpreadId && allSpreads.some((s) => s.id === activeSpreadId)
        ? activeSpreadId
        : (activeSpread?.id || allSpreads[0]?.id || '');
      setActivePreviewSpreadId(targetId);
    }
  }, [isOpen, activeSpreadId, activeSpread?.id, allSpreads]);

  const previewSpread = useMemo(() => {
    return allSpreads.find((s) => s.id === activePreviewSpreadId) || activeSpread || allSpreads[0];
  }, [allSpreads, activePreviewSpreadId, activeSpread]);

  const currentSpreadIdx = useMemo(() => {
    return allSpreads.findIndex((s) => s.id === previewSpread?.id);
  }, [allSpreads, previewSpread]);

  const hasPrev = currentSpreadIdx > 0;
  const hasNext = currentSpreadIdx >= 0 && currentSpreadIdx < allSpreads.length - 1;

  const goToPrev = () => {
    if (hasPrev && allSpreads[currentSpreadIdx - 1]) {
      setActivePreviewSpreadId(allSpreads[currentSpreadIdx - 1]!.id);
    }
  };

  const goToNext = () => {
    if (hasNext && allSpreads[currentSpreadIdx + 1]) {
      setActivePreviewSpreadId(allSpreads[currentSpreadIdx + 1]!.id);
    }
  };

  // Resolve target spreads to export based on scope
  const targetSpreads = useMemo(() => {
    if (scope === 'all') {
      return allSpreads;
    }
    if (scope === 'current') {
      return activeSpread ? [activeSpread] : [];
    }
    if (scope === 'custom') {
      if (rangeMode === 'spreads') {
        const spreadNums = parseRange(customRange, allSpreads.length);
        return allSpreads.filter((s) => spreadNums.includes(s.spreadIndex));
      } else {
        // Range by Page Number (e.g. pages 3-6)
        const maxPages = allSpreads.length * 2;
        const pageNums = parseRange(customRange, maxPages);
        return allSpreads.filter((s) => {
          const leftNum = (s.spreadIndex - 1) * 2 + 1;
          const rightNum = leftNum + 1;
          return pageNums.includes(leftNum) || pageNums.includes(rightNum);
        });
      }
    }
    return allSpreads;
  }, [scope, customRange, rangeMode, allSpreads, activeSpread]);

  // Selected page numbers when custom range by pages is active
  const selectedPageNumbers = useMemo(() => {
    if (scope === 'custom' && rangeMode === 'pages') {
      const maxPages = allSpreads.length * 2;
      return parseRange(customRange, maxPages);
    }
    return undefined;
  }, [scope, rangeMode, customRange, allSpreads.length]);

  if (!isOpen || !currentProject) return null;

  const targetSpreadCount = targetSpreads.length;
  const targetPageCount = selectedPageNumbers
    ? selectedPageNumbers.length
    : splitPages
    ? targetSpreadCount * 2
    : targetSpreadCount;

  const handleSelectFolder = async () => {
    try {
      const selected = await invoke<string | null>('select_export_directory');
      if (selected) {
        setOutputDir(selected);
        try {
          localStorage.setItem(LAST_EXPORT_DIR_KEY, selected);
        } catch {}
        setErrorMsg(null);
        setPreflightReport(null);
      }
    } catch (err) {
      console.error('Failed to pick directory:', err);
    }
  };

  const handleInitiateExport = async () => {
    const trimmedDir = outputDir.trim();
    if (!trimmedDir) {
      setErrorMsg('Please select a destination folder.');
      return;
    }
    if (targetSpreads.length === 0) {
      setErrorMsg('No spreads match the selected range. Please check your range settings.');
      return;
    }

    try {
      localStorage.setItem(LAST_EXPORT_DIR_KEY, trimmedDir);
    } catch {}

    const selectedSpreadIds = targetSpreads.map((s) => s.id);
    const effectiveSplitPages = selectedPageNumbers && selectedPageNumbers.length > 0 ? true : splitPages;
    const exportOpts: ExportOptions = {
      format,
      dpi,
      jpegQuality,
      includeBleed,
      splitPages: effectiveSplitPages,
      sharpenEnabled,
      sharpenAmount,
      outputDir: trimmedDir,
      selectedSpreadIds,
      selectedPageNumbers,
      filePrefix: filePrefix.trim() || undefined,
      tiffBitDepth,
      tiffCompression,
      pdfPrintReady,
      slugMm,
      cropMarks,
    };

    setIsVerifyingPreflight(true);
    setErrorMsg(null);

    try {
      // 🔍 Upfront Pre-Flight Check before rendering
      const report = await invoke<PreflightReport>('preflight_check_export', {
        projectId: currentProject.id,
        options: exportOpts,
      });

      setIsVerifyingPreflight(false);

      if (!report.destinationWritable) {
        setErrorMsg(report.destinationError || 'Destination folder is not accessible or writable.');
        return;
      }

      if (report.missingPhotos && report.missingPhotos.length > 0) {
        // Pre-Flight found missing photos -> open dedicated Missing Photos modal popup!
        setPreflightReport(report);
        setIsMissingModalOpen(true);
        return;
      }

      if (report.existingFiles && report.existingFiles.length > 0) {
        // Pre-Flight found conflicting output files in destination folder -> open dedicated Overwrite modal popup!
        setPreflightReport(report);
        setIsOverwriteModalOpen(true);
        return;
      }

      // Pre-Flight 100% clean -> proceed to export!
      onStartExport(exportOpts);
      onClose();
    } catch (err: unknown) {
      setIsVerifyingPreflight(false);
      console.error('Pre-flight check error:', err);
      // Fallback: proceed directly if preflight check call fails
      onStartExport(exportOpts);
      onClose();
    }
  };

  const handleProceedConfirmed = () => {
    const trimmedDir = outputDir.trim();
    const selectedSpreadIds = targetSpreads.map((s) => s.id);
    onStartExport({
      format,
      dpi,
      jpegQuality,
      includeBleed,
      splitPages,
      sharpenEnabled,
      sharpenAmount,
      outputDir: trimmedDir,
      selectedSpreadIds,
      filePrefix: filePrefix.trim() || undefined,
      tiffBitDepth,
      tiffCompression,
      pdfPrintReady,
      slugMm,
      cropMarks,
    });
    setPreflightReport(null);
    setIsOverwriteModalOpen(false);
    setIsMissingModalOpen(false);
    onClose();
  };

  const handleExportCarouselSlices = async () => {
    const trimmedDir = outputDir.trim();
    if (!trimmedDir) {
      setErrorMsg('Please select a destination folder.');
      return;
    }
    if (!currentCarousel || !currentCarousel.slides || currentCarousel.slides.length === 0) {
      setErrorMsg('No carousel slides found in this project.');
      return;
    }

    try {
      localStorage.setItem(LAST_EXPORT_DIR_KEY, trimmedDir);
    } catch {}

    setIsExportingCarousel(true);
    setErrorMsg(null);
    setCarouselSuccessMsg(null);

    const payload = {
      projectId: currentProject.id,
      projectName: currentProject.name,
      ratio: currentCarousel.ratio,
      slideWidthPx: currentCarousel.slideWidthPx,
      slideHeightPx: currentCarousel.slideHeightPx,
      totalSlides: currentCarousel.slides.length,
      slides: currentCarousel.slides.map((s, idx) => ({
        id: s.id,
        slideIndex: idx,
        backgroundColor: s.backgroundColor,
        elements: s.elements.map((el) => ({
          id: el.id,
          filePath: el.filePath || null,
          previewPath: el.previewPath || null,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          cropX: el.cropX ?? null,
          cropY: el.cropY ?? null,
          cropScale: el.cropScale ?? null,
          rotation: el.rotation ?? null,
          cornerRadius: el.cornerRadius ?? null,
          shapeType: el.shapeType ?? null,
        })),
      })),
    };

    const options = {
      outputDir: trimmedDir,
      jpegQuality: carouselQuality,
      exportPanorama,
      filePrefix: carouselPrefix.trim() || undefined,
    };

    try {
      const result = await invoke<{
        outputFolder: string;
        slideFiles: string[];
        panoramaFile: string | null;
        totalSlides: number;
      }>('export_carousel_slices', { payload, options });

      setIsExportingCarousel(false);
      setCarouselSuccessMsg(
        `Exported ${result.totalSlides} slides${result.panoramaFile ? ' + panorama' : ''} to: ${result.outputFolder}`
      );
    } catch (err: unknown) {
      setIsExportingCarousel(false);
      console.error('Failed to export carousel slices:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Carousel export failed: ${errMsg}`);
    }
  };

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title={workflowTab === 'carousel' ? "Export Instagram Carousel Slices" : "Export Album Studio"}
        width={1040}
        closeOnOverlayClick={false}
        bodyClassName={styles.dialogBodyCustom}
      >
        <div className={styles.scrollableContent}>
          {currentCarousel && (
            <div className={styles.workflowTabBar}>
              <button
                type="button"
                className={`${styles.workflowTab} ${workflowTab === 'album' ? styles.workflowTabActive : ''}`}
                onClick={() => {
                  setWorkflowTab('album');
                  setErrorMsg(null);
                }}
              >
                <FileText size={14} strokeWidth={1.5} />
                <span>Print Album Studio (5-Format Suite)</span>
              </button>
              <button
                type="button"
                className={`${styles.workflowTab} ${workflowTab === 'carousel' ? styles.workflowTabActive : ''}`}
                onClick={() => {
                  setWorkflowTab('carousel');
                  setErrorMsg(null);
                }}
              >
                <Sliders size={14} strokeWidth={1.5} />
                <span>Instagram Carousel Slices ({currentCarousel.slides?.length || 0} Slides)</span>
              </button>
            </div>
          )}

          {workflowTab === 'carousel' && currentCarousel ? (
            <div className={styles.studioLayout}>
              {/* Left Column: Carousel Overview & Slice Previews */}
              <div className={styles.previewSection}>
                <div className={styles.carouselDetailsCard}>
                  <div className={styles.carouselStatItem}>
                    <span className={styles.carouselStatLabel}>Preset & Ratio</span>
                    <span className={styles.carouselStatValue}>{currentCarousel.ratio} ({currentCarousel.slideWidthPx} × {currentCarousel.slideHeightPx}px)</span>
                  </div>
                  <div className={styles.carouselStatItem}>
                    <span className={styles.carouselStatLabel}>Total Slides</span>
                    <span className={styles.carouselStatValue}>{currentCarousel.slides.length} Individual Slices</span>
                  </div>
                  <div className={styles.carouselStatItem}>
                    <span className={styles.carouselStatLabel}>Full Panorama</span>
                    <span className={styles.carouselStatValue}>{currentCarousel.slides.length * currentCarousel.slideWidthPx} × {currentCarousel.slideHeightPx}px</span>
                  </div>
                </div>

                <div className={styles.section} style={{ marginTop: 8 }}>
                  <label className={styles.sectionTitle}>Generated Slices Output</label>
                  <div className={styles.slicePillList}>
                    {currentCarousel.slides.map((_, i) => (
                      <span key={i} className={styles.slicePill}>
                        slide_{String(i + 1).padStart(2, '0')}.jpg
                      </span>
                    ))}
                    {exportPanorama && (
                      <span className={styles.slicePill} style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
                        full_panorama.jpg
                      </span>
                    )}
                  </div>
                </div>

                {carouselSuccessMsg && (
                  <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.35)', color: '#4ade80', fontSize: 12 }}>
                    <Check size={14} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                    {carouselSuccessMsg}
                  </div>
                )}
              </div>

              {/* Right Column: Carousel Settings */}
              <div className={styles.configSection}>
                <div className={styles.section}>
                  <label className={styles.sectionTitle}>Carousel Export Options</label>
                  <div className={styles.contextualPanel}>
                    <div className={styles.labelRow}>
                      <label className={styles.label}>JPEG Image Quality</label>
                      <span className={styles.qualityValBadge}>{carouselQuality}% • High Resolution</span>
                    </div>
                    <div className={styles.sliderRow}>
                      <input
                        type="range"
                        className={styles.slider}
                        min={75}
                        max={100}
                        value={carouselQuality}
                        onChange={(e) => setCarouselQuality(Number(e.target.value))}
                      />
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: 'var(--color-text-primary)', marginTop: 8 }}>
                      <input
                        type="checkbox"
                        checked={exportPanorama}
                        onChange={(e) => setExportPanorama(e.target.checked)}
                      />
                      <span>Generate Stitched Continuous Panorama (full_panorama.jpg)</span>
                    </label>
                  </div>
                </div>

                {/* Filename Prefix */}
                <div className={styles.section}>
                  <div className={styles.labelRow}>
                    <label className={styles.sectionTitle}>Output Folder Name / Prefix</label>
                  </div>
                  <div className={styles.modernInputWrapper}>
                    <span className={styles.inputPrefixIcon}><Tag size={14} strokeWidth={1.5} /></span>
                    <input
                      type="text"
                      className={styles.modernInput}
                      placeholder={currentProject?.name ? `${currentProject.name}_Carousel` : "e.g. Summer_Carousel"}
                      value={carouselPrefix}
                      onChange={(e) => setCarouselPrefix(e.target.value)}
                    />
                  </div>
                </div>

                {/* Destination Folder */}
                <div className={styles.section}>
                  <div className={styles.labelRow}>
                    <label className={styles.sectionTitle}>Destination Folder</label>
                    {outputDir && (
                      <span className={styles.folderStatusBadge}><Check size={11} strokeWidth={1.5} style={{ marginRight: 3, verticalAlign: 'middle' }} />Selected</span>
                    )}
                  </div>

                  <div
                    className={`${styles.modernFolderCard} ${!outputDir ? styles.modernFolderCardEmpty : ''}`}
                    onClick={handleSelectFolder}
                    title={outputDir ? `Target: ${outputDir}` : 'Click to choose destination folder'}
                  >
                    <div className={styles.folderCardIconWrap}>
                      <span className={styles.folderCardIcon}>{outputDir ? <FolderOpen size={24} strokeWidth={1.5} /> : <Folder size={24} strokeWidth={1.5} />}</span>
                    </div>

                    <div className={styles.folderCardContent}>
                      {outputDir ? (
                        <>
                          <span className={styles.folderPrimaryName}>
                            {outputDir.split(/[\\/]/).filter(Boolean).pop() || outputDir}
                          </span>
                          <span className={styles.folderFullPath} title={outputDir}>
                            {outputDir}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className={styles.folderEmptyTitle}>Choose Export Destination</span>
                          <span className={styles.folderEmptyHint}>Select where the carousel slices directory will be created</span>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      className={styles.browseActionBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectFolder();
                      }}
                    >
                      Browse...
                    </button>
                  </div>

                  {errorMsg && (
                    <div className={styles.errorBanner} style={{ marginTop: 8 }}>
                      <AlertTriangle size={15} strokeWidth={1.5} />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
          <div className={styles.studioLayout}>
          {/* Left Column: Interactive Live Preview & Navigation */}
          <div className={styles.previewSection}>
            {/* Preview Toolbar */}
            <div className={styles.previewToolbar}>
              <div className={styles.viewModePills}>
                <button
                  type="button"
                  className={`${styles.viewPill} ${previewViewMode === 'spread' ? styles.viewPillActive : ''}`}
                  onClick={() => setPreviewViewMode('spread')}
                  title="View full facing spread"
                >
                  <RectangleHorizontal size={14} strokeWidth={1.5} />
                  <span>Full Spread</span>
                </button>
                <button
                  type="button"
                  className={`${styles.viewPill} ${previewViewMode === 'left-page' ? styles.viewPillActive : ''}`}
                  onClick={() => setPreviewViewMode('left-page')}
                  title="Inspect left page only"
                >
                  <PanelLeft size={14} strokeWidth={1.5} />
                  <span>Left Page</span>
                </button>
                <button
                  type="button"
                  className={`${styles.viewPill} ${previewViewMode === 'right-page' ? styles.viewPillActive : ''}`}
                  onClick={() => setPreviewViewMode('right-page')}
                  title="Inspect right page only"
                >
                  <PanelRight size={14} strokeWidth={1.5} />
                  <span>Right Page</span>
                </button>
              </div>

              <div className={styles.toolbarActions}>
                <button
                  type="button"
                  className={`${styles.guideToggleBtn} ${showSafeAreaGuide ? styles.safeAreaToggleBtnActive : ''}`}
                  onClick={() => setShowSafeAreaGuide(!showSafeAreaGuide)}
                  title="Toggle dashed blue line showing safe area margins"
                >
                  <ShieldCheck size={14} strokeWidth={1.5} />
                  <span>Safe Area</span>
                </button>

                {includeBleed && (
                  <button
                    type="button"
                    className={`${styles.guideToggleBtn} ${showBleedGuide ? styles.guideToggleBtnActive : ''}`}
                    onClick={() => setShowBleedGuide(!showBleedGuide)}
                    title="Toggle dashed red line showing print lab trim cut line"
                  >
                    <Scissors size={14} strokeWidth={1.5} />
                    <span>Trim Guide</span>
                  </button>
                )}
              </div>
            </div>

            {/* Interactive Live Scaled Preview */}
            {previewSpread && (
              <ExportSpreadPreview
                spread={previewSpread}
                project={currentProject}
                viewMode={previewViewMode}
                includeBleed={includeBleed}
                showBleedGuide={showBleedGuide}
                showSafeAreaGuide={showSafeAreaGuide}
                splitPages={splitPages}
                dpi={dpi}
                format={format}
              />
            )}

            {/* Spread Navigation Bar (Arrow buttons only) */}
            <div className={styles.spreadNavigator}>
              <button
                type="button"
                className={styles.navBtn}
                onClick={goToPrev}
                disabled={!hasPrev}
                title="Previous spread"
              >
                <ChevronLeft size={14} strokeWidth={1.5} />
                <span>Prev Spread</span>
              </button>
              <div className={styles.spreadNavInfo}>
                <span className={styles.spreadNavIndex}>
                  Spread {currentSpreadIdx + 1} of {allSpreads.length}
                </span>
                {previewSpread && (
                  <span className={styles.spreadNavName}>
                    {previewSpread.name || (previewSpread.type === 'cover' ? 'Cover Spread' : `Pages ${(previewSpread.spreadIndex - 1) * 2 + 1}–${(previewSpread.spreadIndex - 1) * 2 + 2}`)}
                  </span>
                )}
              </div>
              <button
                type="button"
                className={styles.navBtn}
                onClick={goToNext}
                disabled={!hasNext}
                title="Next spread"
              >
                <span>Next Spread</span>
                <ChevronRight size={14} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Right Column: Configuration & Options */}
          <div className={styles.configSection}>
            {/* 1. Format Selection: 5 Formats */}
            <div className={styles.section}>
              <label className={styles.sectionTitle}>Export Format</label>
              <div className={styles.formatGrid} role="radiogroup" aria-label="Export Format">
                <div
                  className={`${styles.formatCard} ${format === 'jpeg' ? styles.formatCardActive : ''}`}
                  role="radio"
                  aria-checked={format === 'jpeg'}
                  tabIndex={0}
                  onClick={() => {
                    setFormat('jpeg');
                    setPreflightReport(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setFormat('jpeg');
                      setPreflightReport(null);
                    }
                  }}
                  title="Standard print lab JPEG with JFIF resolution tags"
                >
                  <span className={styles.formatIcon}><Image size={20} strokeWidth={1.5} /></span>
                  <span className={styles.formatName}>High-Res JPEG</span>
                  <span className={styles.formatDesc}>Standard Print Lab</span>
                </div>
                <div
                  className={`${styles.formatCard} ${format === 'png' ? styles.formatCardActive : ''}`}
                  role="radio"
                  aria-checked={format === 'png'}
                  tabIndex={0}
                  onClick={() => {
                    setFormat('png');
                    setPreflightReport(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setFormat('png');
                      setPreflightReport(null);
                    }
                  }}
                  title="Lossless PNG with pHYs resolution chunks"
                >
                  <span className={styles.formatIcon}><FileImage size={20} strokeWidth={1.5} /></span>
                  <span className={styles.formatName}>Lossless PNG</span>
                  <span className={styles.formatDesc}>Highest Precision</span>
                </div>
                <div
                  className={`${styles.formatCard} ${format === 'tiff' ? styles.formatCardActive : ''}`}
                  role="radio"
                  aria-checked={format === 'tiff'}
                  tabIndex={0}
                  onClick={() => {
                    setFormat('tiff');
                    setPreflightReport(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setFormat('tiff');
                      setPreflightReport(null);
                    }
                  }}
                  title="Archival Prepress TIFF with 8/16-bit color and LZW compression"
                >
                  <span className={styles.formatIcon}><FileArchive size={20} strokeWidth={1.5} /></span>
                  <span className={styles.formatName}>Lossless TIFF</span>
                  <span className={styles.formatDesc}>Archival Prepress</span>
                </div>
                <div
                  className={`${styles.formatCard} ${format === 'pdf' ? styles.formatCardActive : ''}`}
                  role="radio"
                  aria-checked={format === 'pdf'}
                  tabIndex={0}
                  onClick={() => {
                    setFormat('pdf');
                    setPreflightReport(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setFormat('pdf');
                      setPreflightReport(null);
                    }
                  }}
                  title="Multi-page PDF or Print-Ready PDF/X with vector marks"
                >
                  <span className={styles.formatIcon}><FileText size={20} strokeWidth={1.5} /></span>
                  <span className={styles.formatName}>Print PDF</span>
                  <span className={styles.formatDesc}>Multi-Page Book</span>
                </div>
                <div
                  className={`${styles.formatCard} ${format === 'psd' ? styles.formatCardActive : ''}`}
                  role="radio"
                  aria-checked={format === 'psd'}
                  tabIndex={0}
                  onClick={() => {
                    setFormat('psd');
                    setPreflightReport(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setFormat('psd');
                      setPreflightReport(null);
                    }
                  }}
                  title="Adobe Photoshop PSD with discrete layers and non-destructive masks"
                >
                  <span className={styles.formatIcon}><Layers size={20} strokeWidth={1.5} /></span>
                  <span className={styles.formatName}>Layered PSD</span>
                  <span className={styles.formatDesc}>Photoshop Layers</span>
                </div>
              </div>

              {/* Contextual Format Panels */}
              {format === 'tiff' && (
                <div className={styles.contextualPanel}>
                  <div className={styles.panelTitleRow}>
                    <label className={styles.label}>TIFF Prepress Depth & Compression</label>
                    <span className={styles.panelBadge}>
                      {tiffCompression === 'lzw' ? 'LZW Lossless' : 'Uncompressed'}
                    </span>
                  </div>
                  <div className={styles.dpiSegmentGroup}>
                    <button
                      type="button"
                      className={`${styles.dpiSegmentBtn} ${tiffBitDepth === 8 ? styles.dpiSegmentBtnActive : ''}`}
                      onClick={() => setTiffBitDepth(8)}
                    >
                      8-bit RGB (24 bpp)
                    </button>
                    <button
                      type="button"
                      className={`${styles.dpiSegmentBtn} ${tiffBitDepth === 16 ? styles.dpiSegmentBtnActive : ''}`}
                      onClick={() => setTiffBitDepth(16)}
                    >
                      16-bit Deep Color (48 bpp Archival)
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Compression:</span>
                    <div className={styles.dpiSegmentGroup}>
                      <button
                        type="button"
                        className={`${styles.dpiSegmentBtn} ${tiffCompression === 'lzw' ? styles.dpiSegmentBtnActive : ''}`}
                        onClick={() => setTiffCompression('lzw')}
                      >
                        LZW Lossless
                      </button>
                      <button
                        type="button"
                        className={`${styles.dpiSegmentBtn} ${tiffCompression === 'none' ? styles.dpiSegmentBtnActive : ''}`}
                        onClick={() => setTiffCompression('none')}
                      >
                        Uncompressed
                      </button>
                    </div>
                  </div>
                  <span className={styles.formatDesc}>
                    {tiffCompression === 'lzw'
                      ? 'Lossless LZW compression preserves master photographic tones without generation loss.'
                      : 'Uncompressed raw raster output for legacy lab compatibility.'}{' '}
                    Prepress resolution tags ({dpi} DPI) are embedded in TIFF IFD header.
                  </span>
                </div>
              )}

              {format === 'pdf' && (
                <div className={styles.contextualPanel}>
                  <div className={styles.panelTitleRow}>
                    <label className={styles.label}>Prepress PDF/X & Marks Configuration</label>
                    <span className={styles.panelBadge}>{pdfPrintReady ? 'PDF/X-3:2002 Compliant' : 'Standard PDF 1.4'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: 'var(--color-text-primary)' }}>
                      <input
                        type="checkbox"
                        checked={pdfPrintReady}
                        onChange={(e) => setPdfPrintReady(e.target.checked)}
                      />
                      <span>Generate Print-Ready PDF/X with concentric MediaBox, BleedBox, and TrimBox</span>
                    </label>
                    {pdfPrintReady && (
                      <>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: 'var(--color-text-primary)' }}>
                          <input
                            type="checkbox"
                            checked={cropMarks}
                            onChange={(e) => setCropMarks(e.target.checked)}
                          />
                          <span>Include Vector Hairline Trim Marks (0.5pt), Center Fold Ticks, and Slug Metadata</span>
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
                          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Slug Margin (bleed offset):</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="range"
                              min={3}
                              max={10}
                              step={0.5}
                              value={slugMm}
                              onChange={(e) => setSlugMm(parseFloat(e.target.value))}
                              style={{ width: 120 }}
                            />
                            <span className={styles.qualityValBadge}>{slugMm.toFixed(1)} mm</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {format === 'psd' && (
                <div className={styles.infoBanner} style={{ marginTop: 10 }}>
                  <Info size={16} className={styles.infoBannerIcon} />
                  <div>
                    <strong style={{ color: 'var(--color-text-primary)' }}>Layered Adobe Photoshop Document (.psd)</strong>
                    <p style={{ margin: '4px 0 0', lineHeight: 1.4 }}>
                      Preserves individual photo frames on discrete layers at native unclipped resolution, complete with non-destructive vector shape channel masks (ID: -2) for rounded corners and shapes, anti-aliased text layers, and embedded 300 DPI ResolutionInfo.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Page Layout & Bleed Trimming */}
            <div className={styles.optionsGrid}>
              <div className={styles.optionField}>
                <label className={styles.label}>Page Layout</label>
                <div className={styles.radioGroup}>
                  <label className={styles.radioItem}>
                    <input
                      type="radio"
                      name="pageLayout"
                      checked={!splitPages}
                      onChange={() => {
                        setSplitPages(false);
                        setPreflightReport(null);
                      }}
                    />
                    Full Spreads (Facing)
                  </label>
                  <label className={styles.radioItem}>
                    <input
                      type="radio"
                      name="pageLayout"
                      checked={splitPages}
                      onChange={() => {
                        setSplitPages(true);
                        setPreflightReport(null);
                      }}
                    />
                    Single Pages (Split L/R)
                  </label>
                </div>
              </div>

              <div className={styles.optionField}>
                <label className={styles.label}>Bleed Cut Margins</label>
                <div className={styles.radioGroup}>
                  <label className={styles.radioItem} title="Export image matching the exact canvas size without outer cut margins">
                    <input
                      type="radio"
                      name="bleedOption"
                      checked={!includeBleed}
                      onChange={() => setIncludeBleed(false)}
                    />
                    Trim to Page Boundary
                  </label>
                  <label className={styles.radioItem} title="Includes extra cut margin for print lab trimming; edge-aligned photos will auto-extend into bleed">
                    <input
                      type="radio"
                      name="bleedOption"
                      checked={includeBleed}
                      onChange={() => setIncludeBleed(true)}
                    />
                    Include Bleed (+{activeSpread?.bleed || 0} {currentProject.canvasUnit})
                  </label>
                </div>
              </div>
            </div>

            {/* 3. Print Resolution & Sharpening */}
            {/* 3. Print Resolution & Quality */}
            <div className={styles.section}>
              <div className={styles.labelRow}>
                <label className={styles.sectionTitle}>Print Resolution</label>
                <span className={styles.dpiBadge}>{dpi} DPI</span>
              </div>
              <div className={styles.dpiSegmentGroup}>
                <button
                  type="button"
                  className={`${styles.dpiSegmentBtn} ${!isCustomDpi && dpi === 240 ? styles.dpiSegmentBtnActive : ''}`}
                  onClick={() => {
                    setIsCustomDpi(false);
                    setDpi(240);
                    setPreflightReport(null);
                  }}
                  title="240 DPI - Fast draft printing"
                >
                  240
                </button>
                <button
                  type="button"
                  className={`${styles.dpiSegmentBtn} ${!isCustomDpi && dpi === 300 ? styles.dpiSegmentBtnActive : ''}`}
                  onClick={() => {
                    setIsCustomDpi(false);
                    setDpi(300);
                    setPreflightReport(null);
                  }}
                  title="300 DPI - Standard print lab production"
                >
                  300
                </button>
                <button
                  type="button"
                  className={`${styles.dpiSegmentBtn} ${!isCustomDpi && dpi === 600 ? styles.dpiSegmentBtnActive : ''}`}
                  onClick={() => {
                    setIsCustomDpi(false);
                    setDpi(600);
                    setPreflightReport(null);
                  }}
                  title="600 DPI - Ultra fine art & gallery print"
                >
                  600
                </button>
                <button
                  type="button"
                  className={`${styles.dpiSegmentBtn} ${isCustomDpi ? styles.dpiSegmentBtnActive : ''}`}
                  onClick={() => {
                    setIsCustomDpi(true);
                    setPreflightReport(null);
                  }}
                  title="Custom DPI value"
                >
                  Custom
                </button>
              </div>

              {isCustomDpi && (
                <div className={styles.customDpiRow}>
                  <div className={styles.customDpiInputWrap}>
                    <input
                      type="number"
                      className={styles.customDpiInput}
                      min={72}
                      max={1200}
                      value={customDpiText}
                      onChange={(e) => {
                        setCustomDpiText(e.target.value);
                        const n = parseInt(e.target.value, 10);
                        if (!isNaN(n) && n >= 72 && n <= 1200) {
                          setDpi(n);
                          setPreflightReport(null);
                        }
                      }}
                      placeholder="300"
                      autoFocus
                    />
                    <span className={styles.customDpiSuffix}>DPI</span>
                  </div>
                  <span className={styles.customDpiHint}>(72–1200)</span>
                </div>
              )}

              {/* Image Quality Slider - Located directly beneath DPI controls */}
              {format === 'jpeg' && (
                <div className={styles.qualityRow}>
                  <div className={styles.labelRow}>
                    <label className={styles.label}>JPEG Image Quality</label>
                    <span className={styles.qualityValBadge}>
                      {jpegQuality}% • {jpegQuality >= 95 ? 'Maximum' : jpegQuality >= 85 ? 'High' : 'Standard'}
                    </span>
                  </div>
                  <div className={styles.sliderRow}>
                    <input
                      type="range"
                      className={styles.slider}
                      min={70}
                      max={100}
                      value={jpegQuality}
                      onChange={(e) => setJpegQuality(Number(e.target.value))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modern Output Sharpening Card */}
            <div className={`${styles.modernSharpenCard} ${sharpenEnabled ? styles.modernSharpenCardActive : ''}`}>
              <div className={styles.sharpenCardHeader}>
                <div className={styles.sharpenHeaderInfo}>
                  <div className={styles.sharpenTitleRow}>
                    <Sparkles size={16} strokeWidth={1.5} className={styles.sharpenIcon} />
                    <span className={styles.sharpenTitle}>Output Print Sharpening</span>
                  </div>
                  <span className={styles.sharpenSubtitle}>
                    Unsharp masking tailored for photo paper (Pure Rust Engine)
                  </span>
                </div>

                <label className={styles.switchLabel} title="Toggle output print sharpening">
                  <input
                    type="checkbox"
                    className={styles.switchInput}
                    checked={sharpenEnabled}
                    onChange={(e) => setSharpenEnabled(e.target.checked)}
                  />
                  <span className={styles.switchTrack}>
                    <span className={styles.switchThumb} />
                  </span>
                </label>
              </div>

              {sharpenEnabled && (
                <div className={styles.sharpenIntensityGroup}>
                  <button
                    type="button"
                    className={`${styles.sharpenIntensityBtn} ${sharpenAmount === 'standard' ? styles.sharpenIntensityBtnActive : ''}`}
                    onClick={() => setSharpenAmount('standard')}
                  >
                    <span className={styles.intensityLevel}>Standard</span>
                    <span className={styles.intensityDesc}>Lustre / Matte Paper</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.sharpenIntensityBtn} ${sharpenAmount === 'high' ? styles.sharpenIntensityBtnActive : ''}`}
                    onClick={() => setSharpenAmount('high')}
                  >
                    <span className={styles.intensityLevel}>High</span>
                    <span className={styles.intensityDesc}>Glossy / Fine Art</span>
                  </button>
                </div>
              )}
            </div>

            {/* 4. Export Scope (Modern Horizontal Button Model) */}
            <div className={styles.section}>
              <div className={styles.labelRow}>
                <label className={styles.sectionTitle}>Export Scope</label>
                <span className={styles.scopeCountBadge}>
                  {targetSpreadCount} {targetSpreadCount === 1 ? 'Spread' : 'Spreads'} ({targetPageCount} {targetPageCount === 1 ? 'Page' : 'Pages'})
                </span>
              </div>

              <div className={styles.horizontalScopeBar}>
                <button
                  type="button"
                  className={`${styles.scopeBtn} ${scope === 'all' ? styles.scopeBtnActive : ''}`}
                  onClick={() => {
                    setScope('all');
                    setPreflightReport(null);
                  }}
                  title="Export all spreads in this album"
                >
                  <span className={styles.scopeBtnTitle}>All Spreads</span>
                  <span className={styles.scopeBtnSub}>{allSpreads.length} Spreads</span>
                </button>

                <button
                  type="button"
                  className={`${styles.scopeBtn} ${scope === 'current' ? styles.scopeBtnActive : ''}`}
                  onClick={() => {
                    setScope('current');
                    setPreflightReport(null);
                  }}
                  title="Export currently active spread"
                >
                  <span className={styles.scopeBtnTitle}>Current Spread</span>
                  <span className={styles.scopeBtnSub}>
                    {activeSpread ? (activeSpread.type === 'cover' ? 'Cover' : `Spread ${activeSpread.spreadIndex}`) : 'Spread 1'}
                  </span>
                </button>

                <button
                  type="button"
                  className={`${styles.scopeBtn} ${scope === 'custom' ? styles.scopeBtnActive : ''}`}
                  onClick={() => {
                    setScope('custom');
                    setPreflightReport(null);
                  }}
                  title="Export custom selection of spreads or pages"
                >
                  <span className={styles.scopeBtnTitle}>Custom Range</span>
                  <span className={styles.scopeBtnSub}>
                    {scope === 'custom' && customRange.trim() ? `${targetSpreadCount} Spreads` : 'Pick Spreads / Pages'}
                  </span>
                </button>
              </div>

              {scope === 'custom' && (
                <div className={styles.customScopeCard}>
                  <div className={styles.customScopeHeader}>
                    <span className={styles.customScopeHint}>
                      Enter {rangeMode === 'spreads' ? 'spread numbers' : 'page numbers'} to export:
                    </span>
                    <div className={styles.rangeModeToggle}>
                      <button
                        type="button"
                        className={`${styles.rangeModeBtn} ${rangeMode === 'spreads' ? styles.rangeModeBtnActive : ''}`}
                        onClick={() => {
                          setRangeMode('spreads');
                          setPreflightReport(null);
                        }}
                        title="Specify range by Spread numbers"
                      >
                        By Spreads (1–{allSpreads.length})
                      </button>
                      <button
                        type="button"
                        className={`${styles.rangeModeBtn} ${rangeMode === 'pages' ? styles.rangeModeBtnActive : ''}`}
                        onClick={() => {
                          setRangeMode('pages');
                          setSplitPages(true);
                          setPreflightReport(null);
                        }}
                        title="Specify range by individual Page numbers"
                      >
                        By Pages (1–{allSpreads.length * 2})
                      </button>
                    </div>
                  </div>

                  <div className={styles.customRangeInputRow}>
                    <input
                      type="text"
                      className={styles.customRangeInput}
                      placeholder={rangeMode === 'spreads' ? "e.g. 1-3, 5, 8" : "e.g. 1, 3, 5-8"}
                      value={customRange}
                      onChange={(e) => {
                        setCustomRange(e.target.value);
                        setPreflightReport(null);
                      }}
                      autoFocus
                    />
                  </div>

                  <div className={styles.customScopeResult}>
                    {rangeMode === 'pages' ? (
                      selectedPageNumbers && selectedPageNumbers.length > 0 ? (
                        <span className={styles.customScopeSuccess}>
                          <Check size={13} strokeWidth={1.5} style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }} />
                          Will export {selectedPageNumbers.length} {selectedPageNumbers.length === 1 ? 'Single Page' : 'Single Pages'}:{' '}
                          {selectedPageNumbers.map((p: number) => `Page ${p}`).join(', ')}
                        </span>
                      ) : (
                        <span className={styles.customScopeWarning}>
                          <AlertTriangle size={13} strokeWidth={1.5} style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }} />
                          No pages selected. Enter comma-separated page numbers or ranges (e.g. 1, 3, 5-8).
                        </span>
                      )
                    ) : targetSpreads.length > 0 ? (
                      <span className={styles.customScopeSuccess}>
                        <Check size={13} strokeWidth={1.5} style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }} />
                        Will export {targetSpreads.length} {targetSpreads.length === 1 ? 'Spread' : 'Spreads'}:{' '}
                        {targetSpreads.map((s) => s.type === 'cover' ? 'Cover' : `Spread ${s.spreadIndex}`).join(', ')}
                      </span>
                    ) : (
                      <span className={styles.customScopeWarning}>
                        <AlertTriangle size={13} strokeWidth={1.5} style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }} />
                        No spreads selected. Enter comma-separated numbers or ranges (e.g. 1-3, 5).
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 5. Filename Pattern & Prefix */}
            <div className={styles.section}>
              <div className={styles.labelRow}>
                <label className={styles.sectionTitle}>Filename Prefix</label>
                {currentProject?.name && (
                  <button
                    type="button"
                    className={styles.useProjectNameBtn}
                    onClick={() => {
                      setFilePrefix(currentProject.name.replace(/[^a-zA-Z0-9_-]/g, '_'));
                      setPreflightReport(null);
                    }}
                    title="Apply current project name as prefix"
                  >
                    <RotateCcw size={12} strokeWidth={1.5} />
                    <span>Use Project Name</span>
                  </button>
                )}
              </div>

              <div className={styles.modernInputWrapper}>
                <span className={styles.inputPrefixIcon}><Tag size={14} strokeWidth={1.5} /></span>
                <input
                  type="text"
                  className={styles.modernInput}
                  placeholder="Prefix (e.g. Wedding_Album, leave blank for default)"
                  value={filePrefix}
                  onChange={(e) => {
                    setFilePrefix(e.target.value);
                    setPreflightReport(null);
                  }}
                />
                {filePrefix && (
                  <button
                    type="button"
                    className={styles.inputClearBtn}
                    onClick={() => {
                      setFilePrefix('');
                      setPreflightReport(null);
                    }}
                    title="Clear prefix"
                    aria-label="Clear prefix"
                  >
                    <X size={13} strokeWidth={1.5} />
                  </button>
                )}
              </div>

              <div className={styles.namingOutputTag}>
                <span className={styles.outputTagIcon}><FileText size={13} strokeWidth={1.5} /></span>
                <span className={styles.outputTagLabel}>Example Output:</span>
                {(() => {
                  const ext = format === 'png' ? 'png' : format === 'psd' ? 'psd' : format === 'tiff' ? 'tif' : format === 'pdf' ? 'pdf' : 'jpg';
                  const clean = filePrefix.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
                  let filename = `Spread_01.${ext}`;
                  if (format === 'pdf') {
                    filename = clean ? (clean.toLowerCase().endsWith('.pdf') ? clean : `${clean}.pdf`) : `${currentProject?.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Album'}_Print_Ready.pdf`;
                  } else if (splitPages) {
                    filename = clean ? `${clean}_Page_001.${ext}` : `Page_001.${ext}`;
                  } else {
                    filename = clean ? `${clean}_Spread_01.${ext}` : `Spread_01.${ext}`;
                  }
                  return (
                    <span className={styles.outputTagValue} title={filename}>
                      {filename}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* 6. Destination Folder */}
            <div className={styles.section}>
              <div className={styles.labelRow}>
                <label className={styles.sectionTitle}>Destination Folder</label>
                {outputDir && (
                  <span className={styles.folderStatusBadge}><Check size={11} strokeWidth={1.5} style={{ marginRight: 3, verticalAlign: 'middle' }} />Selected</span>
                )}
              </div>

              <div
                className={`${styles.modernFolderCard} ${!outputDir ? styles.modernFolderCardEmpty : ''}`}
                onClick={handleSelectFolder}
                title={outputDir ? `Target: ${outputDir}` : 'Click to choose destination folder'}
              >
                <div className={styles.folderCardIconWrap}>
                  <span className={styles.folderCardIcon}>{outputDir ? <FolderOpen size={24} strokeWidth={1.5} /> : <Folder size={24} strokeWidth={1.5} />}</span>
                </div>

                <div className={styles.folderCardContent}>
                  {outputDir ? (
                    <>
                      <span className={styles.folderPrimaryName}>
                        {outputDir.split(/[\\/]/).filter(Boolean).pop() || outputDir}
                      </span>
                      <span className={styles.folderFullPath} title={outputDir}>
                        {outputDir}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className={styles.folderEmptyTitle}>Choose Export Destination</span>
                      <span className={styles.folderEmptyHint}>Click to select folder where print files will be saved</span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  className={styles.browseActionBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectFolder();
                  }}
                >
                  Browse...
                </button>
              </div>

              {errorMsg && (
                <div className={styles.errorBanner}>
                  <AlertTriangle size={15} strokeWidth={1.5} />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>

        {/* Footer Actions */}
        <div className={styles.footer}>
          {workflowTab === 'carousel' ? (
            <>
              <div className={styles.footerSummary}>
                <span className={styles.readyBadge}>
                  <Check size={11} strokeWidth={1.5} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                  Ready
                </span>
                <span className={styles.summaryDot}>•</span>
                <span>{currentCarousel?.slides?.length || 0} Slices</span>
                <span className={styles.summaryDot}>•</span>
                <span>{currentCarousel?.ratio || '1:1'} ({currentCarousel?.slideWidthPx} × {currentCarousel?.slideHeightPx})</span>
                {exportPanorama && (
                  <>
                    <span className={styles.summaryDot}>•</span>
                    <span>+Panorama</span>
                  </>
                )}
              </div>
              <div className={styles.footerActions}>
                <Button variant="secondary" onClick={onClose}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  onClick={handleExportCarouselSlices}
                  disabled={isExportingCarousel}
                >
                  {isExportingCarousel ? 'Slicing Carousel...' : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Download size={14} strokeWidth={1.5} />
                      Export Carousel Slices ({currentCarousel?.slides?.length || 0})
                    </span>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className={styles.footerSummary}>
                <span className={styles.readyBadge}>
                  <Check size={11} strokeWidth={1.5} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                  Ready
                </span>
                <span className={styles.summaryDot}>•</span>
                <span>
                  {targetSpreadCount} {targetSpreadCount === 1 ? 'Spread' : 'Spreads'} ({targetPageCount} {targetPageCount === 1 ? 'Page' : 'Pages'})
                </span>
                <span className={styles.summaryDot}>•</span>
                <span>
                  {format === 'tiff'
                    ? `TIFF (${tiffBitDepth}-bit)`
                    : format === 'pdf'
                    ? (pdfPrintReady ? 'PDF/X-3' : 'PDF')
                    : format.toUpperCase()}{' '}
                  @ {dpi} DPI
                </span>
                {includeBleed && <span> (+Bleed)</span>}
              </div>
              <div className={styles.footerActions}>
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleInitiateExport}
                  disabled={isVerifyingPreflight}
                >
                  {isVerifyingPreflight ? 'Verifying Files...' : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Download size={14} strokeWidth={1.5} />
                      Export Album ({targetSpreadCount})
                    </span>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </Dialog>

    {/* Dedicated Overwrite Confirmation Modal Popup */}
    {isOverwriteModalOpen && preflightReport && preflightReport.existingFiles && preflightReport.existingFiles.length > 0 && (
      <Dialog
        isOpen={isOverwriteModalOpen}
        onClose={() => setIsOverwriteModalOpen(false)}
        title="Overwrite Warning"
        width={500}
        closeOnOverlayClick={false}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
            The destination folder already contains <strong>{preflightReport.existingFiles.length} file(s)</strong> with matching export names. Proceeding will overwrite and replace them:
          </div>

          <div className={styles.conflictList}>
            {preflightReport.existingFiles.map((filename: string, i: number) => (
              <div key={i} className={styles.conflictItem}>
                <div className={styles.conflictFile}>
                  <FileDown
                    size={15}
                    strokeWidth={1.5}
                    style={{ flexShrink: 0, color: 'var(--color-text-secondary)' }}
                    aria-hidden="true"
                  />
                  <span className={styles.conflictFileName} title={filename}>
                    {filename}
                  </span>
                </div>
                <span className={styles.conflictBadge}>Will be overwritten</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--color-border)' }}>
            <Button
              variant="secondary"
              onClick={() => setIsOverwriteModalOpen(false)}
            >
              Cancel / Change Folder
            </Button>
            <Button
              variant="danger"
              className={styles.dangerActionButton}
              onClick={handleProceedConfirmed}
            >
              Overwrite Existing Files
            </Button>
          </div>
        </div>
      </Dialog>
    )}

    {/* Dedicated Missing Photos Warning Modal Popup */}
    {isMissingModalOpen && preflightReport && preflightReport.missingPhotos && preflightReport.missingPhotos.length > 0 && (
      <Dialog
        isOpen={isMissingModalOpen}
        onClose={() => setIsMissingModalOpen(false)}
        title="Missing Photos Detected"
        width={520}
        closeOnOverlayClick={false}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
            The original high-resolution master files for <strong>{preflightReport.missingPhotos.length} photo(s)</strong> could not be found at their disk paths.
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '-8px' }}>
            If you proceed with export, these frames will be rendered using low-resolution thumbnail previews.
          </div>

          <div className={styles.conflictList}>
            {preflightReport.missingPhotos.map((item: MissingPhotoInfo) => (
              <div key={item.elementId} className={styles.missingItemRow}>
                <span className={styles.missingItemTitle}>{item.spreadName}: {item.fileName}</span>
                <span className={styles.missingPath} title={item.filePath}>{item.filePath}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--color-border)' }}>
            <Button
              variant="secondary"
              onClick={() => {
                setIsMissingModalOpen(false);
                onClose();
                openRelink();
              }}
            >
              Locate & Relink Photos...
            </Button>
            <Button
              variant="primary"
              className={styles.warningActionButton}
              onClick={handleProceedConfirmed}
            >
              Export Using Previews
            </Button>
          </div>
        </div>
      </Dialog>
    )}
  </>
  );
}
