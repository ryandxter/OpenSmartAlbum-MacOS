import { useState, useEffect } from 'react';
import {
  LayoutTemplate,
  LayoutTemplateSpec,
  TemplateTargetArea,
  TemplatePlacementMode,
  TemplateApplyStyleOptions,
  applyTemplateToSpread,
  applyTemplateToSlide,
  generateTemplateSvgPreview,
} from '../../domain/templates';
import { useTemplateStore, ApplyTemplatePreferences } from '../../stores/templateStore';
import { useAlbumStore } from '../../stores/albumStore';
import { useProjectStore } from '../../stores/projectStore';
import { useCarouselStore } from '../../stores/carouselStore';
import { useHistoryStore } from '../../stores/historyStore';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import styles from './ApplyTemplateDialog.module.css';

interface ApplyTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  template: LayoutTemplate | null;
  activeMode?: 'print' | 'carousel';
  onApplyToast?: (msg: string) => void;
}

export function ApplyTemplateDialog({
  isOpen,
  onClose,
  template,
  activeMode = 'print',
  onApplyToast,
}: ApplyTemplateDialogProps) {
  const lastApplyOptions = useTemplateStore((s) => s.lastApplyOptions);
  const setLastApplyOptions = useTemplateStore((s) => s.setLastApplyOptions);

  const [targetArea, setTargetArea] = useState<TemplateTargetArea>(
    activeMode === 'carousel' ? 'slide' : lastApplyOptions.targetArea
  );
  const [placementMode, setPlacementMode] = useState<TemplatePlacementMode>(
    lastApplyOptions.placementMode
  );
  const [geometryOnly, setGeometryOnly] = useState<boolean>(
    Boolean(lastApplyOptions.styleOpts.geometryOnly)
  );
  const [borders, setBorders] = useState<boolean>(
    lastApplyOptions.styleOpts.borders !== false
  );
  const [cornerRadii, setCornerRadii] = useState<boolean>(
    lastApplyOptions.styleOpts.cornerRadii !== false
  );
  const [shadows, setShadows] = useState<boolean>(
    lastApplyOptions.styleOpts.shadows !== false
  );
  const [effects, setEffects] = useState<boolean>(
    lastApplyOptions.styleOpts.effects !== false
  );
  const [opacity, setOpacity] = useState<boolean>(
    lastApplyOptions.styleOpts.opacity !== false
  );
  const [frameOverlays, setFrameOverlays] = useState<boolean>(
    lastApplyOptions.styleOpts.frameOverlays !== false
  );

  useEffect(() => {
    if (activeMode === 'carousel') {
      setTargetArea('slide');
    }
  }, [activeMode]);

  if (!isOpen || !template) return null;

  const spec: LayoutTemplateSpec =
    typeof template.payload === 'string'
      ? (() => {
          try {
            return JSON.parse(template.payload);
          } catch {
            return { name: template.name || 'Custom Template', slots: [] };
          }
        })()
      : template.payload;

  const slotCount = spec.slots ? spec.slots.length : 0;
  const svgPreview = generateTemplateSvgPreview(spec, 80, 40);

  const handleApply = () => {
    const styleOpts: TemplateApplyStyleOptions = {
      geometryOnly,
      borders,
      cornerRadii,
      shadows,
      effects,
      opacity,
      frameOverlays,
    };

    const newPrefs: ApplyTemplatePreferences = {
      targetArea,
      placementMode,
      styleOpts,
    };
    setLastApplyOptions(newPrefs);

    if (activeMode === 'carousel') {
      const carousel = useCarouselStore.getState().currentCarousel;
      const slideIndex = useCarouselStore.getState().activeSlideIndex;
      if (!carousel || !carousel.slides[slideIndex]) return;

      const currentSlide = carousel.slides[slideIndex]!;
      useCarouselStore.getState().pushHistory();

      const updatedSlide = applyTemplateToSlide(
        spec,
        currentSlide,
        carousel.slideWidthPx || 1080,
        carousel.slideHeightPx || 1080,
        placementMode,
        styleOpts
      );

      const nextSlides = carousel.slides.map((s, idx) =>
        idx === slideIndex ? updatedSlide : s
      );

      useCarouselStore.setState({
        currentCarousel: { ...carousel, slides: nextSlides },
        saveStatus: 'unsaved',
      });
    } else {
      // Print Mode
      const album = useAlbumStore.getState().currentAlbum;
      const activeSpreadId = useAlbumStore.getState().activeSpreadId;
      const project = useProjectStore.getState().currentProject;

      if (!album || !project) return;

      const isCover = album.coverSpread?.id === activeSpreadId;
      const currentSpread = isCover
        ? album.coverSpread
        : album.spreads.find((s) => s.id === activeSpreadId) || album.spreads[0];

      if (!currentSpread) return;

      useHistoryStore.getState().pushState(album);

      const updatedSpread = applyTemplateToSpread(
        spec,
        currentSpread,
        project,
        targetArea,
        placementMode,
        styleOpts
      );

      if (isCover) {
        useAlbumStore.setState({
          currentAlbum: { ...album, coverSpread: updatedSpread },
          saveStatus: 'unsaved',
        });
      } else {
        const nextSpreads = album.spreads.map((s) =>
          s.id === updatedSpread.id ? updatedSpread : s
        );
        useAlbumStore.setState({
          currentAlbum: { ...album, spreads: nextSpreads },
          saveStatus: 'unsaved',
        });
      }
    }

    onApplyToast?.(`Applied template: ${spec.name}`);
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Apply Layout Template"
      width={460}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleApply}>
            Apply Template
          </Button>
        </>
      }
    >
      <div className={styles.headerPreviewRow}>
        <div className={styles.templateInfo}>
          <span className={styles.templateName}>{spec.name}</span>
          <span className={styles.templateMeta}>
            {slotCount} {slotCount === 1 ? 'Slot' : 'Slots'} · {(spec as any).canvasKind || 'Spread'}
          </span>
        </div>
        <div
          className={styles.svgWrapper}
          dangerouslySetInnerHTML={{ __html: svgPreview }}
        />
      </div>

      <div className={styles.body}>
        {/* Target Area */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Target Area</span>
          </div>
            {activeMode === 'carousel' ? (
              <div className={styles.segmentedControl}>
                <button
                  type="button"
                  className={`${styles.segmentBtn} ${styles.segmentBtnActive}`}
                >
                  Current Slide
                </button>
              </div>
            ) : (
              <div className={styles.segmentedControl}>
                <button
                  type="button"
                  className={`${styles.segmentBtn} ${targetArea === 'spread' ? styles.segmentBtnActive : ''}`}
                  onClick={() => setTargetArea('spread')}
                >
                  Full Spread
                </button>
                <button
                  type="button"
                  className={`${styles.segmentBtn} ${targetArea === 'left' ? styles.segmentBtnActive : ''}`}
                  onClick={() => setTargetArea('left')}
                >
                  Left Page
                </button>
                <button
                  type="button"
                  className={`${styles.segmentBtn} ${targetArea === 'right' ? styles.segmentBtnActive : ''}`}
                  onClick={() => setTargetArea('right')}
                >
                  Right Page
                </button>
              </div>
            )}
          </div>

          {/* Placement Mode */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>Placement Mode</span>
            </div>
            <div className={styles.segmentedControl}>
              <button
                type="button"
                className={`${styles.segmentBtn} ${placementMode === 'fit_safe_margin' ? styles.segmentBtnActive : ''}`}
                onClick={() => setPlacementMode('fit_safe_margin')}
              >
                Fit Safe Margin
              </button>
              <button
                type="button"
                className={`${styles.segmentBtn} ${placementMode === 'original_position' ? styles.segmentBtnActive : ''}`}
                onClick={() => setPlacementMode('original_position')}
              >
                Original Position
              </button>
            </div>
          </div>

          {/* Granular Style Options */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>Styles &amp; Decoration</span>
              <button
                type="button"
                className={`${styles.geometryToggle} ${geometryOnly ? styles.geometryToggleActive : ''}`}
                onClick={() => setGeometryOnly(!geometryOnly)}
              >
                {geometryOnly ? '✓ Geometry Only' : 'Geometry Only'}
              </button>
            </div>

            <div
              className={styles.checkboxGrid}
              style={{ opacity: geometryOnly ? 0.35 : 1, pointerEvents: geometryOnly ? 'none' : 'auto' }}
            >
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={borders}
                  disabled={geometryOnly}
                  onChange={(e) => setBorders(e.target.checked)}
                />
                <span>Borders</span>
              </label>

              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={cornerRadii}
                  disabled={geometryOnly}
                  onChange={(e) => setCornerRadii(e.target.checked)}
                />
                <span>Corner Radii</span>
              </label>

              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={shadows}
                  disabled={geometryOnly}
                  onChange={(e) => setShadows(e.target.checked)}
                />
                <span>Drop Shadows</span>
              </label>

              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={effects}
                  disabled={geometryOnly}
                  onChange={(e) => setEffects(e.target.checked)}
                />
                <span>Visual Effects</span>
              </label>

              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={opacity}
                  disabled={geometryOnly}
                  onChange={(e) => setOpacity(e.target.checked)}
                />
                <span>Opacity</span>
              </label>

              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={frameOverlays}
                  disabled={geometryOnly}
                  onChange={(e) => setFrameOverlays(e.target.checked)}
                />
                <span>Frame Overlays</span>
              </label>
            </div>
          </div>

          {/* Quick Apply Hint */}
          <div className={styles.quickApplyHintBox}>
            <span style={{ fontWeight: 600 }}>⚡ Pro Tip:</span> Shift + Click any template card in &quot;My Templates&quot; to Quick Apply instantly using these remembered preferences.
          </div>
        </div>
    </Dialog>
  );
}
