import { useState, useEffect } from 'react';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical as AlignTop,
  AlignCenterVertical as AlignMiddle,
  AlignEndVertical as AlignBottom,
  AlignHorizontalDistributeCenter as DistributeHorizontal,
  AlignVerticalDistributeCenter as DistributeVertical,
  RotateCcw,
  RotateCw,
  Lock,
  Unlock,
  Crop,
  RotateCw as RefreshIcon,
  Shield,
} from 'lucide-react';
import { useEditorStore } from '../../../stores/editorStore';
import { useAlbumStore } from '../../../stores/albumStore';
import { useProjectStore } from '../../../stores/projectStore';
import { useCarouselStore } from '../../../stores/carouselStore';
import { NumberInput } from '../../../components/ui/NumberInput';
import { getMaxGapForUnit } from '../../../domain/units';
import { getAllAlbumSpreads } from '../../../domain/album';
import type { PhotoFrameElement } from '../../../domain/editor';
import {
  type CarouselPhotoFrame,
  CAROUSEL_RATIO_PRESETS,
  type CarouselRatio,
  type SocialResizeMode,
} from '../../../domain/carousel';
import styles from '../InspectorShared.module.css';

interface LayoutSpacingSectionProps {
  onToast?: (msg: string) => void;
  activeMode?: 'print' | 'carousel';
}

export function LayoutSpacingSection({ onToast, activeMode = 'print' }: LayoutSpacingSectionProps) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const updateProjectMargin = useProjectStore((s) => s.updateProjectMargin);
  const updateProjectMargins = useProjectStore((s) => s.updateProjectMargins);
  const currentAlbum = useAlbumStore((s) => s.currentAlbum);
  const activeSpreadId = useAlbumStore((s) => s.activeSpreadId);
  const updateSpreadSpacing = useAlbumStore((s) => s.updateSpreadSpacing);
  const applySpacingToAllSpreads = useAlbumStore((s) => s.applySpacingToAllSpreads);
  const updateSafeArea = useAlbumStore((s) => s.updateSafeArea);
  const applySafeAreaToAllSpreads = useAlbumStore((s) => s.applySafeAreaToAllSpreads);

  const selectedFrameIds = useEditorStore((s) => s.selectedFrameIds);
  const updateFrameGeometry = useEditorStore((s) => s.updateFrameGeometry);
  const rotateSelectedFrames = useEditorStore((s) => s.rotateSelectedFrames);
  const alignSelectedFrames = useEditorStore((s) => s.alignSelectedFrames);
  const distributeSelectedFrames = useEditorStore((s) => s.distributeSelectedFrames);
  const applyFixedGapToSelected = useEditorStore((s) => s.applyFixedGapToSelected);
  const matchSelectedDimensions = useEditorStore((s) => s.matchSelectedDimensions);
  const resetToOriginalRatio = useEditorStore((s) => s.resetToOriginalRatio);
  const resetSelectedRatio = useEditorStore((s) => s.resetSelectedRatio);
  const resetCrop = useEditorStore((s) => s.resetCrop);
  const resetSelectedCrop = useEditorStore((s) => s.resetSelectedCrop);
  const editingCropFrameId = useEditorStore((s) => s.editingCropFrameId);
  const enterCropMode = useEditorStore((s) => s.enterCropMode);
  const exitCropMode = useEditorStore((s) => s.exitCropMode);

  // Carousel Store Hooks
  const currentCarousel = useCarouselStore((s) => s.currentCarousel);
  const activeSlideIndex = useCarouselStore((s) => s.activeSlideIndex);
  const selectedCarouselFrameId = useCarouselStore((s) => s.selectedFrameId);
  const selectedCarouselFrameIds = useCarouselStore((s) => s.selectedFrameIds);
  const updateCarouselPhotoFrame = useCarouselStore((s) => s.updatePhotoFrame);
  const batchUpdateCarouselFrames = useCarouselStore((s) => s.batchUpdateFrames);
  const updateSlideBackground = useCarouselStore((s) => s.updateSlideBackground);
  const resizeSocialPost = useCarouselStore((s) => s.resizeSocialPost);

  const [selectedRatio, setSelectedRatio] = useState<CarouselRatio>(currentCarousel?.ratio || '1:1');
  const [customW, setCustomW] = useState<number>(currentCarousel?.slideWidthPx || 1080);
  const [customH, setCustomH] = useState<number>(currentCarousel?.slideHeightPx || 1080);
  const [resizeMode, setResizeMode] = useState<SocialResizeMode>('reflow');

  useEffect(() => {
    if (currentCarousel) {
      setSelectedRatio(currentCarousel.ratio);
      setCustomW(currentCarousel.slideWidthPx);
      setCustomH(currentCarousel.slideHeightPx);
    }
  }, [currentCarousel?.ratio, currentCarousel?.slideWidthPx, currentCarousel?.slideHeightPx]);

  const [isRatioLocked, setIsRatioLocked] = useState(true);
  const [marginMode, setMarginMode] = useState<'uniform' | '4-sided'>('4-sided');

  if (activeMode === 'carousel') {
    if (!currentCarousel) {
      return <div className={styles.emptyHint}>No carousel project active.</div>;
    }

    const activeSlide = currentCarousel.slides[activeSlideIndex] || currentCarousel.slides[0];
    const selectedCarouselPhotos = (activeSlide?.elements || []).filter(
      (el): el is CarouselPhotoFrame => selectedCarouselFrameIds.includes(el.id) && el.type === 'photo'
    );

    // Multi-Selection Mode in Carousel (>= 2 frames)
    if (selectedCarouselFrameIds.length >= 2 && selectedCarouselPhotos.length > 0) {
      const allExcluded = selectedCarouselPhotos.every((f) => f.excludeFromAdaptiveLayout);
      return (
        <div>
          {/* Layout Constraints & Decorative Exclusion */}
          <div className={styles.propGroup}>
            <div className={styles.groupHeader}>
              <span className={styles.label}>Layout Constraints</span>
              <span className={styles.subLabel}>{selectedCarouselPhotos.length} photos</span>
            </div>
            <button
              type="button"
              className={`${styles.actionBtn} ${allExcluded ? styles.iconBtnActive : ''}`}
              onClick={() => {
                const nextState = !allExcluded;
                batchUpdateCarouselFrames(
                  selectedCarouselPhotos.map((f) => ({
                    id: f.id,
                    updates: { excludeFromAdaptiveLayout: nextState },
                  }))
                );
                onToast?.(
                  nextState
                    ? '🛡️ Excluded selected frames from auto-layout'
                    : '✓ Included selected frames in auto-layout'
                );
              }}
              title="Keep these frames stationary at their positions during Spacebar layout cycling"
            >
              <Shield size={13} strokeWidth={1.5} />
              <span>
                {allExcluded ? 'Include All in Auto-Layout' : 'Exclude All from Auto-Layout'}
              </span>
            </button>
          </div>
        </div>
      );
    }

    const selectedCarouselFrame = activeSlide?.elements.find((el) => el.id === selectedCarouselFrameId);

    if (selectedCarouselFrame && selectedCarouselFrame.type === 'photo') {
      const f = selectedCarouselFrame;
      return (
        <div>
          {/* Frame Dimensions */}
          <div className={styles.propGroup}>
            <div className={styles.groupHeader}>
              <span className={styles.label}>Frame Dimensions</span>
              <span className={styles.subLabel}>pixels</span>
            </div>
            <div className={styles.propGrid2}>
              <NumberInput
                label="W"
                value={Math.round(f.width)}
                min={20}
                max={5000}
                onChange={(val) => {
                  const newW = Math.max(20, Math.round(val));
                  const newH = isRatioLocked && f.photoAspect ? Math.round(newW / f.photoAspect) : f.height;
                  updateCarouselPhotoFrame(f.id, { width: newW, height: newH });
                }}
              />
              <NumberInput
                label="H"
                value={Math.round(f.height)}
                min={20}
                max={5000}
                onChange={(val) => {
                  const newH = Math.max(20, Math.round(val));
                  const newW = isRatioLocked && f.photoAspect ? Math.round(newH * f.photoAspect) : f.width;
                  updateCarouselPhotoFrame(f.id, { width: newW, height: newH });
                }}
              />
            </div>
            <div className={styles.propGrid2} style={{ marginTop: 8 }}>
              <NumberInput
                label="X"
                value={Math.round(f.x)}
                onChange={(val) => updateCarouselPhotoFrame(f.id, { x: Math.round(val) })}
              />
              <NumberInput
                label="Y"
                value={Math.round(f.y)}
                onChange={(val) => updateCarouselPhotoFrame(f.id, { y: Math.round(val) })}
              />
            </div>
            <button
              type="button"
              className={`${styles.actionBtn} ${isRatioLocked ? styles.iconBtnActive : ''}`}
              style={{ marginTop: 8 }}
              onClick={() => setIsRatioLocked(!isRatioLocked)}
            >
              {isRatioLocked ? <Lock size={12} strokeWidth={1.5} /> : <Unlock size={12} strokeWidth={1.5} />}
              <span>{isRatioLocked ? 'Lock Aspect Ratio' : 'Unlock Aspect Ratio'}</span>
            </button>
          </div>

          {/* Rotation */}
          <div className={styles.propGroup}>
            <div className={styles.groupHeader}>
              <span className={styles.label}>Rotation</span>
              <span className={styles.subLabel}>degrees</span>
            </div>
            <div className={styles.propGrid2}>
              <NumberInput
                label="Angle"
                value={f.rotation || 0}
                min={-360}
                max={360}
                onChange={(val) => updateCarouselPhotoFrame(f.id, { rotation: Math.round(val) })}
              />
              <div className={styles.buttonGroup}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => updateCarouselPhotoFrame(f.id, { rotation: ((f.rotation || 0) - 90 + 360) % 360 })}
                  title="Rotate 90° CCW"
                >
                  <RotateCcw size={13} strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => updateCarouselPhotoFrame(f.id, { rotation: ((f.rotation || 0) + 90) % 360 })}
                  title="Rotate 90° CW"
                >
                  <RotateCw size={13} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>

          {/* Aspect & Crop actions */}
          <div className={styles.propGroup}>
            <div className={styles.groupHeader}>
              <span className={styles.label}>Aspect Ratio & Crop</span>
            </div>
            <div className={styles.propGrid2}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => {
                  const aspect = f.photoAspect || 1.0;
                  const newW = Math.round(f.height * aspect);
                  updateCarouselPhotoFrame(f.id, { width: newW, cropX: 0, cropY: 0, cropScale: 1.0 });
                  onToast?.('↺ Reset frame to original photo aspect ratio');
                }}
                title="Fit frame dimensions to original photo aspect ratio"
              >
                <RefreshIcon size={12} strokeWidth={1.5} />
                <span>Reset Ratio</span>
              </button>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => {
                  updateCarouselPhotoFrame(f.id, { cropX: 0, cropY: 0, cropScale: 1.0 });
                  onToast?.('↺ Centered photo and reset crop');
                }}
                title="Center photo and reset zoom"
              >
                <span>Reset Crop</span>
              </button>
            </div>
          </div>

          {/* Carousel Layout Constraints */}
          <div className={styles.propGroup}>
            <div className={styles.groupHeader}>
              <span className={styles.label}>Layout Constraints</span>
            </div>
            <button
              type="button"
              className={`${styles.actionBtn} ${f.excludeFromAdaptiveLayout ? styles.iconBtnActive : ''}`}
              onClick={() => {
                const nextState = !f.excludeFromAdaptiveLayout;
                updateCarouselPhotoFrame(f.id, { excludeFromAdaptiveLayout: nextState });
                onToast?.(
                  nextState
                    ? '🛡️ Excluded from adaptive layout cycling'
                    : '✓ Included in adaptive layout cycling'
                );
              }}
              title="Keep this frame stationary at its position during Spacebar layout cycling"
            >
              <Shield size={13} strokeWidth={1.5} />
              <span>{f.excludeFromAdaptiveLayout ? 'Excluded from Auto-Layout' : 'Exclude from Auto-Layout'}</span>
            </button>
          </div>
        </div>
      );
    }

    // Carousel Canvas Mode (No frame selected)
    const totalSlides = currentCarousel.slides.length;
    const slideW = currentCarousel.slideWidthPx;
    const slideH = currentCarousel.slideHeightPx;

    const handlePresetChange = (presetKey: CarouselRatio) => {
      setSelectedRatio(presetKey);
      if (presetKey !== 'custom' && CAROUSEL_RATIO_PRESETS[presetKey]) {
        setCustomW(CAROUSEL_RATIO_PRESETS[presetKey].width);
        setCustomH(CAROUSEL_RATIO_PRESETS[presetKey].height);
      }
    };

    const handleApplySize = () => {
      if (customW < 200 || customW > 6000 || customH < 200 || customH > 6000) {
        onToast?.('Dimensions must be between 200 px and 6000 px.');
        return;
      }
      resizeSocialPost(customW, customH, selectedRatio, resizeMode);
      onToast?.(
        `✓ Resized carousel post to ${customW} × ${customH} px (${resizeMode === 'reflow' ? 'Reflow' : 'Scaled'})`
      );
    };

    return (
      <div>
        {/* Slide Dimensions & Live Preset Resize (D-08) */}
        <div className={styles.propGroup}>
          <div className={styles.groupHeader}>
            <span className={styles.label}>Slide Dimensions</span>
            <span className={styles.subLabel}>{slideW} × {slideH} px</span>
          </div>

          {/* Preset Selector Dropdown */}
          <div className={styles.propRow}>
            <span className={styles.subLabel}>Preset / Ratio</span>
            <select
              value={selectedRatio}
              onChange={(e) => handlePresetChange(e.target.value as CarouselRatio)}
              style={{
                background: 'var(--color-bg-secondary, #1e1e22)',
                color: 'var(--color-text-primary, #ffffff)',
                border: '1px solid var(--color-border, #27272a)',
                borderRadius: 'var(--radius-sm, 4px)',
                padding: '4px 8px',
                fontSize: '11px',
                width: '100%',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {(Object.entries(CAROUSEL_RATIO_PRESETS) as [CarouselRatio, typeof CAROUSEL_RATIO_PRESETS[CarouselRatio]][]).map(
                ([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.label}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Width & Height Number Inputs */}
          <div className={styles.propGrid2} style={{ marginTop: 8 }}>
            <NumberInput
              label="W"
              value={customW}
              min={200}
              max={6000}
              step={10}
              suffix="px"
              onChange={(val) => {
                setCustomW(val);
                setSelectedRatio('custom');
              }}
            />
            <NumberInput
              label="H"
              value={customH}
              min={200}
              max={6000}
              step={10}
              suffix="px"
              onChange={(val) => {
                setCustomH(val);
                setSelectedRatio('custom');
              }}
            />
          </div>

          {/* Resize Behavior Segmented Control (Reflow vs Scale) */}
          <div style={{ marginTop: 8 }}>
            <div className={styles.groupHeader} style={{ marginBottom: 4 }}>
              <span className={styles.subLabel}>Resize Behavior</span>
            </div>
            <div className={styles.propGrid2}>
              <button
                type="button"
                className={`${styles.actionBtn} ${resizeMode === 'reflow' ? styles.iconBtnActive : ''}`}
                onClick={() => setResizeMode('reflow')}
                title="Reflow frames adaptively for the new aspect ratio (recommended for photos)"
              >
                <span>Reflow (Adaptive)</span>
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${resizeMode === 'scale' ? styles.iconBtnActive : ''}`}
                onClick={() => setResizeMode('scale')}
                title="Scale and reposition all frames proportionally"
              >
                <span>Scale Proportionally</span>
              </button>
            </div>
          </div>

          {/* Apply Size CTA */}
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              className={styles.actionBtn}
              style={{
                width: '100%',
                padding: '6px 12px',
                background: 'var(--color-accent, #e4e4e7)',
                color: 'var(--color-text-inverse, #18181b)',
                fontWeight: 600,
                fontSize: '11px',
                borderRadius: 'var(--radius-sm, 4px)',
                border: 'none',
                cursor: 'pointer',
              }}
              onClick={handleApplySize}
            >
              Apply Size
            </button>
          </div>

          <div className={styles.emptyHint} style={{ textAlign: 'left', padding: '6px 0 0' }}>
            Current ratio: <strong>{currentCarousel.ratio}</strong>. Active slide: <strong>Slide {activeSlideIndex + 1} of {totalSlides}</strong>.
          </div>
        </div>

        {/* Slide Background Color */}
        <div className={styles.propGroup}>
          <div className={styles.groupHeader}>
            <span className={styles.label}>Slide Background</span>
            <span className={styles.subLabel}>{activeSlide?.backgroundColor || '#000000'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <input
              type="color"
              value={activeSlide?.backgroundColor || '#000000'}
              onChange={(e) => updateSlideBackground(activeSlideIndex, e.target.value)}
              style={{
                width: 38,
                height: 30,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 4,
                cursor: 'pointer',
                background: 'transparent',
              }}
              title="Change slide background color"
            />
            <span style={{ fontSize: 12, color: '#a1a1aa' }}>
              Slide {activeSlideIndex + 1} Background
            </span>
          </div>
        </div>
      </div>
    );
  }

  const allSpreads = currentAlbum ? getAllAlbumSpreads(currentAlbum) : [];
  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];
  const selectedElements = (activeSpread?.elements || []).filter((el) =>
    selectedFrameIds.includes(el.id)
  );

  const unit = currentProject?.canvasUnit ?? 'inch';
  const maxGap = getMaxGapForUnit(unit);

  if (!activeSpreadId) {
    return <div className={styles.emptyHint}>No active spread selected.</div>;
  }

  // 1. MULTI-SELECTION MODE (>= 2 frames)
  if (selectedElements.length >= 2) {
    const currentGap = activeSpread?.spacingValue ?? currentProject?.spacingValue ?? 5;

    return (
      <div>
        {/* Alignment */}
        <div className={styles.propGroup}>
          <div className={styles.groupHeader}>
            <span className={styles.label}>Align Selection</span>
            <span className={styles.subLabel}>{selectedElements.length} items</span>
          </div>
          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => alignSelectedFrames(activeSpreadId, 'left')}
              title="Align Left"
            >
              <AlignLeft size={14} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => alignSelectedFrames(activeSpreadId, 'center')}
              title="Align Center"
            >
              <AlignCenter size={14} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => alignSelectedFrames(activeSpreadId, 'right')}
              title="Align Right"
            >
              <AlignRight size={14} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => alignSelectedFrames(activeSpreadId, 'top')}
              title="Align Top"
            >
              <AlignTop size={14} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => alignSelectedFrames(activeSpreadId, 'middle')}
              title="Align Middle"
            >
              <AlignMiddle size={14} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => alignSelectedFrames(activeSpreadId, 'bottom')}
              title="Align Bottom"
            >
              <AlignBottom size={14} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Distribute */}
        <div className={styles.propGroup}>
          <div className={styles.groupHeader}>
            <span className={styles.label}>Distribute</span>
          </div>
          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => distributeSelectedFrames(activeSpreadId, 'horizontal')}
              title="Distribute Horizontally"
            >
              <DistributeHorizontal size={14} strokeWidth={1.5} />
              <span>Horizontal</span>
            </button>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => distributeSelectedFrames(activeSpreadId, 'vertical')}
              title="Distribute Vertically"
            >
              <DistributeVertical size={14} strokeWidth={1.5} />
              <span>Vertical</span>
            </button>
          </div>
        </div>

        {/* Gap Spacing Slider */}
        <div className={styles.propGroup}>
          <div className={styles.groupHeader}>
            <span className={styles.label}>Inter-Frame Gap</span>
            <span className={styles.subLabel}>{currentGap} {unit}</span>
          </div>
          <div className={styles.sliderContainer}>
            <input
              type="range"
              className={styles.slider}
              min={0}
              max={maxGap}
              step={unit === 'inch' ? 0.05 : 1}
              value={currentGap}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                applyFixedGapToSelected(activeSpreadId, 'horizontal', val);
                updateSpreadSpacing(val, unit, currentProject ?? undefined);
              }}
            />
            <span className={styles.sliderBadge}>{currentGap}</span>
          </div>
        </div>

        {/* Match Dimensions */}
        <div className={styles.propGroup}>
          <div className={styles.groupHeader}>
            <span className={styles.label}>Match Size</span>
          </div>
          <div className={styles.propGrid2}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => matchSelectedDimensions(activeSpreadId, 'width')}
              title="Match Width to First Selected"
            >
              Match Width
            </button>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => matchSelectedDimensions(activeSpreadId, 'height')}
              title="Match Height to First Selected"
            >
              Match Height
            </button>
          </div>
        </div>

        {/* Batch Rotation & Resets */}
        <div className={styles.propGroup}>
          <div className={styles.groupHeader}>
            <span className={styles.label}>Batch Actions</span>
          </div>
          <div className={styles.propGrid2}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => rotateSelectedFrames(activeSpreadId, -90)}
              title="Rotate 90° Counter-Clockwise"
            >
              <RotateCcw size={13} strokeWidth={1.5} />
              <span>-90°</span>
            </button>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => rotateSelectedFrames(activeSpreadId, 90)}
              title="Rotate 90° Clockwise"
            >
              <RotateCw size={13} strokeWidth={1.5} />
              <span>+90°</span>
            </button>
          </div>
          <div className={styles.propGrid2} style={{ marginTop: '6px' }}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => {
                resetSelectedRatio(activeSpreadId);
                onToast?.('↺ Reset native aspect ratio on selected frames');
              }}
              title="Reset Frame Ratio to Original Photo Ratio"
            >
              <RefreshIcon size={12} strokeWidth={1.5} />
              <span>Reset Ratio</span>
            </button>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => {
                resetSelectedCrop(activeSpreadId);
                onToast?.('↺ Centered and reset crop on selected frames');
              }}
              title="Reset Crop Zoom and Center Photo"
            >
              <Crop size={12} strokeWidth={1.5} />
              <span>Reset Crop</span>
            </button>
          </div>
        </div>

        {/* Layout Constraints & Decorative Exclusion */}
        {(() => {
          const photoElements = selectedElements.filter((item): item is PhotoFrameElement => item.type === 'photo');
          if (photoElements.length === 0) return null;
          const allExcluded = photoElements.every((item) => item.excludeFromAdaptiveLayout);

          return (
            <div className={styles.propGroup}>
              <div className={styles.groupHeader}>
                <span className={styles.label}>Layout Constraints</span>
                <span className={styles.subLabel}>{photoElements.length} photos</span>
              </div>
              <button
                type="button"
                className={`${styles.actionBtn} ${allExcluded ? styles.iconBtnActive : ''}`}
                onClick={() => {
                  const nextState = !allExcluded;
                  for (const item of photoElements) {
                    updateFrameGeometry(activeSpreadId, item.id, { excludeFromAdaptiveLayout: nextState });
                  }
                  onToast?.(
                    nextState
                      ? '🛡️ Excluded selected frames from auto-layout'
                      : '✓ Included selected frames in auto-layout'
                  );
                }}
                title="Keep these frames stationary at their positions during Spacebar layout cycling"
              >
                <Shield size={13} strokeWidth={1.5} />
                <span>{allExcluded ? 'Include All in Auto-Layout' : 'Exclude All from Auto-Layout'}</span>
              </button>
            </div>
          );
        })()}
      </div>
    );
  }

  // 2. SINGLE SELECTION MODE (1 element)
  if (selectedElements.length === 1 && selectedElements[0]) {
    const el = selectedElements[0];
    const isPhoto = el.type === 'photo';
    const isCropping = editingCropFrameId === el.id;

    return (
      <div>
        {/* Position & Dimensions */}
        <div className={styles.propGroup}>
          <div className={styles.groupHeader}>
            <span className={styles.label}>Transform</span>
            <button
              type="button"
              className={styles.iconBtn}
              style={{ width: '22px', height: '22px' }}
              onClick={() => setIsRatioLocked(!isRatioLocked)}
              title={isRatioLocked ? 'Aspect Ratio Locked' : 'Aspect Ratio Unlocked'}
            >
              {isRatioLocked ? (
                <Lock size={12} strokeWidth={1.5} />
              ) : (
                <Unlock size={12} strokeWidth={1.5} />
              )}
            </button>
          </div>

          <div className={styles.propGrid2}>
            <NumberInput
              label="X"
              value={el.x}
              suffix="px"
              onChange={(val) => updateFrameGeometry(activeSpreadId, el.id, { x: val })}
            />
            <NumberInput
              label="Y"
              value={el.y}
              suffix="px"
              onChange={(val) => updateFrameGeometry(activeSpreadId, el.id, { y: val })}
            />
          </div>

          <div className={styles.propGrid2}>
            <NumberInput
              label="W"
              value={el.width}
              suffix="px"
              min={10}
              onChange={(val) => {
                if (isRatioLocked && el.width > 0) {
                  const ratio = el.height / el.width;
                  updateFrameGeometry(activeSpreadId, el.id, { width: val, height: Math.round(val * ratio) });
                } else {
                  updateFrameGeometry(activeSpreadId, el.id, { width: val });
                }
              }}
            />
            <NumberInput
              label="H"
              value={el.height}
              suffix="px"
              min={10}
              onChange={(val) => {
                if (isRatioLocked && el.height > 0) {
                  const ratio = el.width / el.height;
                  updateFrameGeometry(activeSpreadId, el.id, { height: val, width: Math.round(val * ratio) });
                } else {
                  updateFrameGeometry(activeSpreadId, el.id, { height: val });
                }
              }}
            />
          </div>
        </div>

        {/* Rotation */}
        <div className={styles.propGroup}>
          <div className={styles.groupHeader}>
            <span className={styles.label}>Rotation</span>
          </div>
          <div className={styles.propRow}>
            <div style={{ flex: 1 }}>
              <NumberInput
                value={el.rotation || 0}
                suffix="°"
                min={-360}
                max={360}
                onChange={(val) => updateFrameGeometry(activeSpreadId, el.id, { rotation: val })}
              />
            </div>
            <div className={styles.buttonGroup}>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => rotateSelectedFrames(activeSpreadId, -90)}
                title="Rotate 90° CCW"
              >
                <RotateCcw size={13} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => rotateSelectedFrames(activeSpreadId, 90)}
                title="Rotate 90° CW"
              >
                <RotateCw size={13} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>

        {/* Photo Crop Actions */}
        {isPhoto && (
          <div className={styles.propGroup}>
            <div className={styles.groupHeader}>
              <span className={styles.label}>Crop & Aspect Ratio</span>
            </div>
            <div className={styles.propGrid2}>
              <button
                type="button"
                className={`${styles.actionBtn} ${isCropping ? styles.iconBtnActive : ''}`}
                onClick={() => {
                  if (isCropping) exitCropMode();
                  else enterCropMode(el.id);
                }}
                title="Toggle In-Frame Interactive Crop Mode"
              >
                <Crop size={13} strokeWidth={1.5} />
                <span>{isCropping ? 'Done' : 'Crop'}</span>
              </button>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => {
                  resetToOriginalRatio(activeSpreadId, el.id);
                  onToast?.('↺ Reset frame to original aspect ratio');
                }}
                title="Reset Frame Aspect Ratio"
              >
                <RefreshIcon size={12} strokeWidth={1.5} />
                <span>↺ Ratio</span>
              </button>
            </div>
            <button
              type="button"
              className={styles.actionBtn}
              style={{ marginTop: '6px' }}
              onClick={() => {
                resetCrop(activeSpreadId, el.id);
                onToast?.('↺ Re-centered image and reset zoom');
              }}
              title="Center Photo and Reset Crop Zoom"
            >
              <span>↺ Reset Crop (Zoom 1.0x)</span>
            </button>
          </div>
        )}

        {/* Layout Constraints & Decorative Exclusion */}
        {isPhoto && (
          <div className={styles.propGroup}>
            <div className={styles.groupHeader}>
              <span className={styles.label}>Layout Constraints</span>
            </div>
            <button
              type="button"
              className={`${styles.actionBtn} ${el.excludeFromAdaptiveLayout ? styles.iconBtnActive : ''}`}
              onClick={() => {
                const nextState = !el.excludeFromAdaptiveLayout;
                updateFrameGeometry(activeSpreadId, el.id, { excludeFromAdaptiveLayout: nextState });
                onToast?.(
                  nextState
                    ? '🛡️ Excluded from adaptive layout cycling'
                    : '✓ Included in adaptive layout cycling'
                );
              }}
              title="Keep this frame stationary at its position during Spacebar layout cycling and templates (ideal for logos, stamps, watermarks)"
            >
              <Shield size={13} strokeWidth={1.5} />
              <span>{el.excludeFromAdaptiveLayout ? 'Excluded from Auto-Layout' : 'Exclude from Auto-Layout'}</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // 3. CANVAS / SPREAD MODE (No selection)
  const spreadSpacing = activeSpread?.spacingValue ?? currentProject?.spacingValue ?? 5;

  return (
    <div>
      {/* Spread Dimensions Readout */}
      <div className={styles.propGroup}>
        <div className={styles.groupHeader}>
          <span className={styles.label}>Spread Dimensions</span>
          <span className={styles.subLabel}>
            {currentProject ? `${currentProject.canvasWidth * 2} × ${currentProject.canvasHeight} ${unit}` : ''}
          </span>
        </div>
        <div className={styles.emptyHint} style={{ textAlign: 'left', padding: '4px 0' }}>
          Configured in Project Settings. Left & Right page: {currentProject?.canvasWidth} × {currentProject?.canvasHeight} {unit} @ {currentProject?.canvasDpi ?? 300} DPI.
        </div>
      </div>

      {/* Global Spread Photo Spacing */}
      <div className={styles.propGroup}>
        <div className={styles.groupHeader}>
          <span className={styles.label}>Spread Photo Spacing</span>
          <span className={styles.subLabel}>{spreadSpacing} {unit}</span>
        </div>
        <div className={styles.sliderContainer}>
          <input
            type="range"
            className={styles.slider}
            min={0}
            max={maxGap}
            step={unit === 'inch' ? 0.05 : 1}
            value={spreadSpacing}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              updateSpreadSpacing(val, unit, currentProject ?? undefined);
            }}
          />
          <span className={styles.sliderBadge}>{spreadSpacing}</span>
        </div>
        <button
          type="button"
          className={styles.actionBtn}
          style={{ marginTop: '8px' }}
          onClick={() => {
            applySpacingToAllSpreads(spreadSpacing, unit, currentProject ?? undefined);
            onToast?.(`✓ Applied ${spreadSpacing} ${unit} spacing to all spreads`);
          }}
          title="Apply this spacing to every spread in the album"
        >
          Apply Spacing to All Spreads
        </button>
      </div>

      {/* Margins & Guides (FX-05) */}
      <div className={styles.propGroup}>
        <div className={styles.groupHeader}>
          <span className={styles.label}>Safe Margins</span>
        </div>

        {/* Mode Switcher: Uniform vs 4-Sided */}
        <div className={styles.propGrid2} style={{ marginBottom: '10px' }}>
          <button
            type="button"
            className={`${styles.actionBtn} ${marginMode === 'uniform' ? styles.iconBtnActive : ''}`}
            onClick={() => setMarginMode('uniform')}
          >
            <span>Uniform</span>
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${marginMode === '4-sided' ? styles.iconBtnActive : ''}`}
            onClick={() => setMarginMode('4-sided')}
          >
            <span>4-Sided</span>
          </button>
        </div>

        {marginMode === 'uniform' ? (
          <div style={{ marginBottom: '8px' }}>
            <NumberInput
              label="Margin"
              value={activeSpread?.safeArea ?? currentProject?.marginValue ?? 12}
              suffix={unit}
              min={0}
              max={100}
              onChange={(val) => {
                updateSafeArea(val, 'all', currentProject ?? undefined);
                updateProjectMargin(val, unit, 'all');
              }}
            />
          </div>
        ) : (
          <>
            <div className={styles.propGrid2}>
              <NumberInput
                label="Top"
                value={activeSpread?.safeAreaTop ?? currentProject?.marginTop ?? activeSpread?.safeArea ?? 12}
                suffix={unit}
                min={0}
                max={100}
                onChange={(val) => {
                  updateSafeArea(val, 'top', currentProject ?? undefined);
                  updateProjectMargin(val, unit, 'top');
                }}
              />
              <NumberInput
                label="Bottom"
                value={activeSpread?.safeAreaBottom ?? currentProject?.marginBottom ?? activeSpread?.safeArea ?? 12}
                suffix={unit}
                min={0}
                max={100}
                onChange={(val) => {
                  updateSafeArea(val, 'bottom', currentProject ?? undefined);
                  updateProjectMargin(val, unit, 'bottom');
                }}
              />
            </div>
            <div className={styles.propGrid2} style={{ marginTop: '6px' }}>
              <NumberInput
                label="Outside"
                value={activeSpread?.safeAreaOutside ?? currentProject?.marginOutside ?? activeSpread?.safeArea ?? 12}
                suffix={unit}
                min={0}
                max={100}
                onChange={(val) => {
                  updateSafeArea(val, 'outside', currentProject ?? undefined);
                  updateProjectMargin(val, unit, 'outside');
                }}
              />
              <NumberInput
                label="Spine/Inside"
                value={activeSpread?.safeAreaSpine ?? currentProject?.marginSpine ?? 0}
                suffix={unit}
                min={0}
                max={100}
                onChange={(val) => {
                  updateSafeArea(val, 'spine', currentProject ?? undefined);
                  updateProjectMargin(val, unit, 'spine');
                }}
              />
            </div>
          </>
        )}

        {/* Continuous Seamless Spread Badge (FX-05) */}
        {(marginMode === '4-sided'
          ? (activeSpread?.safeAreaSpine ?? currentProject?.marginSpine ?? 0) === 0
          : (activeSpread?.safeArea ?? currentProject?.marginValue ?? 12) === 0) && (
          <div
            style={{
              marginTop: '8px',
              padding: '6px 10px',
              borderRadius: '6px',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              fontSize: '11px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>✨ Continuous Seamless Spread: 0 Spine Margin</span>
          </div>
        )}

        <button
          type="button"
          className={styles.actionBtn}
          style={{ marginTop: '8px' }}
          onClick={() => {
            if (marginMode === 'uniform') {
              const currentMargin = activeSpread?.safeArea ?? currentProject?.marginValue ?? 12;
              applySafeAreaToAllSpreads(currentMargin, 'all', currentProject ?? undefined);
              updateProjectMargin(currentMargin, unit, 'all');
            } else {
              const top = activeSpread?.safeAreaTop ?? currentProject?.marginTop ?? activeSpread?.safeArea ?? 12;
              const bottom = activeSpread?.safeAreaBottom ?? currentProject?.marginBottom ?? activeSpread?.safeArea ?? 12;
              const outside = activeSpread?.safeAreaOutside ?? currentProject?.marginOutside ?? activeSpread?.safeArea ?? 12;
              const spine = activeSpread?.safeAreaSpine ?? currentProject?.marginSpine ?? 0;
              applySafeAreaToAllSpreads(top, 'top', currentProject ?? undefined);
              applySafeAreaToAllSpreads(bottom, 'bottom', currentProject ?? undefined);
              applySafeAreaToAllSpreads(outside, 'outside', currentProject ?? undefined);
              applySafeAreaToAllSpreads(spine, 'spine', currentProject ?? undefined);
              updateProjectMargins({ top, bottom, outside, spine, unit });
            }
            onToast?.('✓ Applied safe margins to all spreads');
          }}
        >
          Apply Margins to All Spreads
        </button>
      </div>
    </div>
  );
}
