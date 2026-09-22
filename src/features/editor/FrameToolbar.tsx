import {
  Check,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Crop,
  Ratio,
  Square,
  ArrowLeftRight,
  Group,
  Lock,
  Unlock,
  Trash2,
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useAlbumStore } from '../../stores/albumStore';
import { getAllAlbumSpreads } from '../../domain/album';
import { zoomCropAtPoint, PhotoFrameElement } from '../../domain/editor';
import styles from './FrameToolbar.module.css';

export function FrameToolbar() {
  const { currentAlbum, activeSpreadId } = useAlbumStore();
  const {
    selectedFrameIds,
    editingCropFrameId,
    deleteSelectedFrames,
    rotateSelectedFrames,
    enterCropMode,
    exitCropMode,
    resetToOriginalRatio,
    resetSelectedRatio,
    resetCrop,
    swapFrames,
    groupSelectedFrames,
    ungroupSelectedFrames,
    updateFrameGeometry,
    updateCrop,
  } = useEditorStore();

  if (!currentAlbum || selectedFrameIds.length === 0) return null;

  const allSpreads = getAllAlbumSpreads(currentAlbum);
  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];
  if (!activeSpread) return null;

  const primaryFrameId = selectedFrameIds[0];
  const foundFrame = (activeSpread.elements || []).find((f) => f.id === primaryFrameId);
  if (!foundFrame || foundFrame.type !== 'photo') return null;
  const frame = foundFrame as PhotoFrameElement;

  const selectedElements = (activeSpread.elements || []).filter((f) =>
    selectedFrameIds.includes(f.id)
  );
  const distinctGroupIds = new Set(selectedElements.map((f) => f.groupId).filter(Boolean));
  const hasUngrouped = selectedElements.some((f) => !f.groupId);
  const canGroup = selectedElements.length >= 2 && (distinctGroupIds.size > 1 || hasUngrouped);
  const canUngroup = distinctGroupIds.size > 0;
  const isGroupActive = distinctGroupIds.size === 1 && !hasUngrouped;

  const isCrop = editingCropFrameId === frame.id;
  const updateCropZoom = (delta: number) => {
    const nextCrop = zoomCropAtPoint(
      frame,
      { x: frame.width / 2, y: frame.height / 2 },
      (frame.cropScale || 1.0) + delta
    );
    updateCrop(activeSpread.id, frame.id, nextCrop);
  };

  const rotateCropBy = (angleDelta: number) => {
    const currentRot = frame.cropRotation || 0;
    const nextRot = (currentRot + angleDelta + 360) % 360;
    updateCrop(activeSpread.id, frame.id, { cropRotation: nextRot });
  };

  return (
    <div className={styles.verticalDockContainer}>
      {/* When in Crop Mode: Clean Pure Icon Dock */}
      {isCrop ? (
        <>
          {/* 1. Finish Crop (Done Checkmark) */}
          <button
            type="button"
            className={`${styles.toolBtn} ${styles.toolBtnCropDone}`}
            onClick={exitCropMode}
            title="Finish Crop Mode (Enter / Esc)"
          >
            <Check size={15} strokeWidth={2.2} />
          </button>

          <div className={styles.divider} />

          {/* 2. Zoom In (+) */}
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => updateCropZoom(0.01)}
            disabled={(frame.cropScale || 1.0) >= 3.5}
            title="Zoom In Inside Frame (+1%)"
          >
            <ZoomIn size={15} strokeWidth={1.75} />
          </button>

          {/* Zoom % Pill */}
          <div className={styles.zoomPercentPill} title="Current Zoom Scale">
            {Math.round((frame.cropScale || 1.0) * 100)}%
          </div>

          {/* 3. Zoom Out (-) */}
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => updateCropZoom(-0.01)}
            disabled={(frame.cropScale || 1.0) <= 1.0}
            title="Zoom Out Inside Frame (−1%)"
          >
            <ZoomOut size={15} strokeWidth={1.75} />
          </button>

          <div className={styles.divider} />

          {/* 4. Rotate Photo 90° CW (Shift+Click for CCW) */}
          <button
            type="button"
            className={`${styles.toolBtn} ${styles.toolBtnCropRotate}`}
            onClick={(e) => rotateCropBy(e.shiftKey ? -90 : 90)}
            title="Rotate Photo 90° Clockwise (Shift+Click for CCW, or press R)"
          >
            <RotateCw size={15} strokeWidth={1.75} />
          </button>

          <div className={styles.divider} />

          {/* 5. Reset Crop (Revert Position, Zoom & Rotation) */}
          <button
            type="button"
            className={`${styles.toolBtn} ${styles.toolBtnCropReset}`}
            onClick={() => resetCrop(activeSpread.id, frame.id)}
            title="Reset Crop (Center Fit & 100% Zoom)"
          >
            <RotateCcw size={15} strokeWidth={1.75} />
          </button>
        </>
      ) : (
        <>
          {/* 1. Crop Image (Double Click) */}
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => enterCropMode(frame.id)}
            title="Crop Image (Double Click)"
          >
            <Crop size={15} strokeWidth={1.75} />
          </button>
          <div className={styles.divider} />

          {/* 2. Reset to Original Aspect Ratio (1-Click Restore) */}
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() =>
              selectedFrameIds.length > 1
                ? resetSelectedRatio(activeSpread.id)
                : resetToOriginalRatio(activeSpread.id, frame.id)
            }
            title={selectedFrameIds.length > 1 ? `Reset ${selectedFrameIds.length} Frames to Original Aspect Ratio` : 'Reset to Original Aspect Ratio (3:2 / 4:3)'}
          >
            <Ratio size={15} strokeWidth={1.75} />
          </button>

          {/* 3. Rotate 90° */}
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => rotateSelectedFrames(activeSpread.id, 'cw')}
            title={selectedFrameIds.length > 1 ? `Rotate ${selectedFrameIds.length} Frames 90° (R)` : 'Rotate 90° (R)'}
          >
            <RotateCw size={15} strokeWidth={1.75} />
          </button>

          {/* 4. Border Toggle */}
          <button
            type="button"
            className={`${styles.toolBtn} ${frame.borderEnabled ? styles.toolBtnActive : ''}`}
            onClick={() =>
              updateFrameGeometry(activeSpread.id, frame.id, {
                borderEnabled: !frame.borderEnabled,
              })
            }
            title={frame.borderEnabled ? 'Disable Frame Border' : 'Enable Frame Border'}
          >
            <Square size={15} strokeWidth={1.75} />
          </button>

          {/* Contextual: Swap 2 Photos Button (When 2 frames are selected) */}
          {selectedFrameIds.length === 2 && selectedFrameIds[0] && selectedFrameIds[1] && (
            <button
              type="button"
              className={`${styles.toolBtn} ${styles.toolBtnActive}`}
              onClick={() => swapFrames(activeSpread.id, selectedFrameIds[0]!, selectedFrameIds[1]!)}
              title="Swap 2 Photos (S)"
            >
              <ArrowLeftRight size={15} strokeWidth={1.75} />
            </button>
          )}

          {/* Contextual: Group / Ungroup Toggle */}
          {(canGroup || canUngroup) && (
            <button
              type="button"
              className={`${styles.toolBtn} ${isGroupActive ? styles.toolBtnActive : ''}`}
              onClick={() => {
                if (isGroupActive) {
                  ungroupSelectedFrames(activeSpread.id);
                  return;
                }
                groupSelectedFrames(activeSpread.id);
              }}
              title={
                isGroupActive
                  ? 'Ungroup Selected Frames (Ctrl+Shift+G)'
                  : `Group ${selectedFrameIds.length} Selected Frames (Ctrl+G)`
              }
              aria-label={isGroupActive ? 'Ungroup selected frames' : `Group ${selectedFrameIds.length} selected frames`}
              aria-pressed={isGroupActive}
            >
              <Group size={15} strokeWidth={1.75} />
            </button>
          )}

          {/* Lock / Unlock Toggle Button */}
          <button
            type="button"
            className={`${styles.toolBtn} ${selectedElements.every((f) => f.locked) ? styles.toolBtnActive : ''}`}
            style={{
              color: selectedElements.every((f) => f.locked) ? '#f59e0b' : undefined,
              borderColor: selectedElements.every((f) => f.locked) ? '#f59e0b' : undefined,
            }}
            onClick={() => useEditorStore.getState().toggleLockSelectedFrames(activeSpread.id)}
            title={
              selectedElements.some((f) => !f.locked)
                ? selectedFrameIds.length > 1
                  ? `Lock ${selectedFrameIds.length} Frames (Ctrl+L)`
                  : 'Lock Photo Frame (Ctrl+L)'
                : selectedFrameIds.length > 1
                ? `Unlock ${selectedFrameIds.length} Frames (Alt+L)`
                : 'Unlock Photo Frame (Alt+L)'
            }
          >
            {selectedElements.every((f) => f.locked) ? (
              <Lock size={15} strokeWidth={1.75} />
            ) : (
              <Unlock size={15} strokeWidth={1.75} />
            )}
          </button>

          <div className={styles.divider} />

          {/* 5. Delete Frame */}
          <button
            type="button"
            className={`${styles.toolBtn} ${styles.toolBtnDanger}`}
            onClick={() => deleteSelectedFrames(activeSpread.id)}
            title="Remove Photo Frame from Canvas (Delete)"
          >
            <Trash2 size={15} strokeWidth={1.75} />
          </button>
        </>
      )}
    </div>
  );
}
