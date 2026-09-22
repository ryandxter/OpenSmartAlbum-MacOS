import { Magnet, Maximize2, Columns } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useAlbumStore } from '../../stores/albumStore';
import { useEditorStore } from '../../stores/editorStore';
import { useCarouselStore } from '../../stores/carouselStore';
import { getAllAlbumSpreads, getSpreadLabel } from '../../domain/album';
import styles from './StatusBar.module.css';

export interface StatusBarProps {
  zoomLevel: number;
  onZoomChange: (updater: (prev: number) => number) => void;
  onFitToScreen: () => void;
  activeMode?: 'print' | 'carousel';
}

export function StatusBar({
  zoomLevel,
  onZoomChange,
  onFitToScreen,
  activeMode = 'print',
}: StatusBarProps) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const currentAlbum = useAlbumStore((s) => s.currentAlbum);
  const activeSpreadId = useAlbumStore((s) => s.activeSpreadId);
  const showGutterGuide = useAlbumStore((s) => s.showGutterGuide);
  const showBleedGuide = useAlbumStore((s) => s.showBleedGuide);
  const showSafeAreaGuide = useAlbumStore((s) => s.showSafeAreaGuide);
  const toggleGuide = useAlbumStore((s) => s.toggleGuide);

  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);

  // Carousel Store hooks
  const currentCarousel = useCarouselStore((s) => s.currentCarousel);
  const activeSlideIndex = useCarouselStore((s) => s.activeSlideIndex);
  const showSliceGuides = useCarouselStore((s) => s.showSliceGuides);
  const toggleSliceGuides = useCarouselStore((s) => s.toggleSliceGuides);

  const allSpreads = currentAlbum ? getAllAlbumSpreads(currentAlbum) : [];
  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];

  const spreadLabel = activeSpread ? getSpreadLabel(activeSpread) : 'Spread';

  const spreadW = currentProject ? currentProject.canvasWidth * 2 : 16;
  const spreadH = currentProject ? currentProject.canvasHeight : 8;
  const unit = currentProject?.canvasUnit ?? 'inch';
  const dpi = currentProject?.canvasDpi ?? 300;

  const isCarousel = activeMode === 'carousel';

  return (
    <footer className={styles.statusBar} role="contentinfo" aria-label="Status Bar">
      {/* Left: Active Spread Info & Dimensions */}
      <div className={styles.sectionLeft}>
        {isCarousel ? (
          <>
            <span className={styles.spreadInfo}>
              Slide {(activeSlideIndex || 0) + 1} of {currentCarousel?.slides.length || 1}
            </span>
            <div className={styles.separator} />
            <span className={styles.dimensionInfo}>
              {currentCarousel?.slideWidthPx || 1080} × {currentCarousel?.slideHeightPx || 1080} px ({currentCarousel?.ratio || '1:1'})
            </span>
          </>
        ) : (
          <>
            <span className={styles.spreadInfo}>{spreadLabel}</span>
            <div className={styles.separator} />
            <span className={styles.dimensionInfo}>
              {spreadW.toFixed(2)} × {spreadH.toFixed(2)} {unit} @ {dpi} DPI
            </span>
          </>
        )}
      </div>

      {/* Center: Snapping Toggle & Guide Visibility */}
      <div className={styles.sectionCenter}>
        <button
          type="button"
          className={`${styles.snapBtn} ${snapEnabled ? styles.snapBtnActive : ''}`}
          onClick={toggleSnap}
          title={snapEnabled ? 'Magnetic Snapping Enabled (S)' : 'Magnetic Snapping Disabled (S)'}
        >
          <Magnet size={12} strokeWidth={1.5} />
          <span>Snap: {snapEnabled ? 'ON' : 'OFF'}</span>
        </button>

        <div className={styles.separator} />

        {isCarousel ? (
          <button
            type="button"
            className={`${styles.guidePill} ${showSliceGuides ? styles.guidePillActive : ''}`}
            onClick={toggleSliceGuides}
            title="Toggle Carousel Slice Boundary Guides"
          >
            <Columns size={12} strokeWidth={1.5} />
            <span>Slice Guides</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              className={`${styles.guidePill} ${showSafeAreaGuide ? styles.guidePillActive : ''}`}
              onClick={() => toggleGuide('safeArea')}
              title="Toggle Safe Area Guide"
            >
              <span>Safe Area</span>
            </button>

            <button
              type="button"
              className={`${styles.guidePill} ${showBleedGuide ? styles.guidePillActive : ''}`}
              onClick={() => toggleGuide('bleed')}
              title="Toggle Bleed Guide"
            >
              <span>Bleed</span>
            </button>

            <button
              type="button"
              className={`${styles.guidePill} ${showGutterGuide ? styles.guidePillActive : ''}`}
              onClick={() => toggleGuide('gutter')}
              title="Toggle Spine / Gutter Guide"
            >
              <span>Gutter</span>
            </button>
          </>
        )}
      </div>

      {/* Right: Zoom Slider & Fit */}
      <div className={styles.sectionRight}>
        <button
          type="button"
          className={styles.fitBtn}
          onClick={onFitToScreen}
          title="Fit Spread to Canvas (⌘0)"
        >
          <Maximize2 size={11} strokeWidth={1.5} />
          <span>Fit</span>
        </button>

        <button
          type="button"
          className={styles.zoomBtn}
          onClick={() => onZoomChange((z) => Math.max(25, z - 15))}
          title="Zoom Out (⌘−)"
        >
          −
        </button>

        <input
          type="range"
          className={styles.zoomSlider}
          min={25}
          max={350}
          value={zoomLevel}
          onChange={(e) => {
            const val = Number(e.target.value);
            onZoomChange(() => val);
          }}
          title={`Zoom: ${zoomLevel}%`}
        />

        <button
          type="button"
          className={styles.zoomBtn}
          onClick={() => onZoomChange((z) => Math.min(350, z + 15))}
          title="Zoom In (⌘+)"
        >
          +
        </button>

        <span className={styles.zoomBadge}>{zoomLevel}%</span>
      </div>
    </footer>
  );
}
