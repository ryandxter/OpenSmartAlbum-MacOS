import { useState } from 'react';
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
} from 'lucide-react';
import { useEditorStore } from '../../../stores/editorStore';
import { useAlbumStore } from '../../../stores/albumStore';
import { useProjectStore } from '../../../stores/projectStore';
import { NumberInput } from '../../../components/ui/NumberInput';
import { getMaxGapForUnit } from '../../../domain/units';
import { getAllAlbumSpreads } from '../../../domain/album';
import styles from '../InspectorShared.module.css';

interface LayoutSpacingSectionProps {
  onToast?: (msg: string) => void;
}

export function LayoutSpacingSection({ onToast }: LayoutSpacingSectionProps) {
  const currentProject = useProjectStore((s) => s.currentProject);
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

  const [isRatioLocked, setIsRatioLocked] = useState(true);

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

      {/* Margins & Guides */}
      <div className={styles.propGroup}>
        <div className={styles.groupHeader}>
          <span className={styles.label}>Safe Margins</span>
        </div>
        <div className={styles.propGrid2}>
          <NumberInput
            label="Top"
            value={activeSpread?.safeAreaTop ?? activeSpread?.safeArea ?? 12}
            suffix={unit}
            min={0}
            max={100}
            onChange={(val) => {
              updateSafeArea(val, 'top', currentProject ?? undefined);
            }}
          />
          <NumberInput
            label="Bottom"
            value={activeSpread?.safeAreaBottom ?? activeSpread?.safeArea ?? 12}
            suffix={unit}
            min={0}
            max={100}
            onChange={(val) => {
              updateSafeArea(val, 'bottom', currentProject ?? undefined);
            }}
          />
        </div>
        <div className={styles.propGrid2}>
          <NumberInput
            label="Spine/Inside"
            value={activeSpread?.safeAreaSpine ?? 0}
            suffix={unit}
            min={0}
            max={100}
            onChange={(val) => {
              updateSafeArea(val, 'spine', currentProject ?? undefined);
            }}
          />
          <NumberInput
            label="Outside"
            value={activeSpread?.safeAreaOutside ?? activeSpread?.safeArea ?? 12}
            suffix={unit}
            min={0}
            max={100}
            onChange={(val) => {
              updateSafeArea(val, 'outside', currentProject ?? undefined);
            }}
          />
        </div>
        <button
          type="button"
          className={styles.actionBtn}
          style={{ marginTop: '6px' }}
          onClick={() => {
            const currentMargin = activeSpread?.safeArea ?? 12;
            applySafeAreaToAllSpreads(currentMargin, 'all', currentProject ?? undefined);
            onToast?.('✓ Applied safe margins to all spreads');
          }}
        >
          Apply Margins to All Spreads
        </button>
      </div>
    </div>
  );
}
