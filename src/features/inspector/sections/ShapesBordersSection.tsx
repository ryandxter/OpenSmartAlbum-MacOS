import { useState } from 'react';
import {
  Square,
  Circle,
  Hexagon,
  Link,
  Unlink,
} from 'lucide-react';
import { useEditorStore } from '../../../stores/editorStore';
import { useAlbumStore } from '../../../stores/albumStore';
import { ColorPicker } from '../../../components/ui/ColorPicker';
import { Switch } from '../../../components/ui/Switch';
import { NumberInput } from '../../../components/ui/NumberInput';
import { getCornerRadii } from '../../../domain/editor';
import { getAllAlbumSpreads } from '../../../domain/album';
import styles from '../InspectorShared.module.css';

interface ShapesBordersSectionProps {
  onToast?: (msg: string) => void;
}

export function ShapesBordersSection({ onToast }: ShapesBordersSectionProps) {
  const currentAlbum = useAlbumStore((s) => s.currentAlbum);
  const activeSpreadId = useAlbumStore((s) => s.activeSpreadId);
  const selectedFrameIds = useEditorStore((s) => s.selectedFrameIds);
  const updateFrameGeometry = useEditorStore((s) => s.updateFrameGeometry);
  const batchUpdateFrames = useEditorStore((s) => s.batchUpdateFrames);

  const [isCornersLinked, setIsCornersLinked] = useState(true);

  const allSpreads = currentAlbum ? getAllAlbumSpreads(currentAlbum) : [];
  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];
  const selectedElements = (activeSpread?.elements || []).filter((el) =>
    selectedFrameIds.includes(el.id)
  );

  if (selectedElements.length === 0) {
    return (
      <div className={styles.emptyHint}>
        Select one or more photo frames or shapes to adjust corner rounding, stroke borders, and clipping geometry.
      </div>
    );
  }

  // Representative element for initial values
  const firstElem = selectedElements[0];
  const [tl, tr, br, bl] = getCornerRadii(firstElem as any);
  const masterRadius = Math.max(tl, tr, br, bl);
  const borderEnabled = Boolean((firstElem as any).borderEnabled);
  const borderWidth = Number((firstElem as any).borderWidth || 1);
  const borderColor = String((firstElem as any).borderColor || '#FFFFFF');

  const updateSelectedBorders = (updates: Record<string, any>) => {
    if (!activeSpreadId || !firstElem) return;
    if (selectedElements.length === 1) {
      updateFrameGeometry(activeSpreadId, firstElem.id, updates as any);
    } else {
      batchUpdateFrames(
        activeSpreadId,
        selectedElements.map((el) => ({ id: el.id, geometry: updates as any }))
      );
    }
  };

  const handleMasterRadiusChange = (radius: number) => {
    updateSelectedBorders({
      cornerRadius: radius,
      cornerRadiusTl: radius,
      cornerRadiusTr: radius,
      cornerRadiusBr: radius,
      cornerRadiusBl: radius,
    });
  };

  return (
    <div>
      {/* Corner Radii */}
      <div className={styles.propGroup}>
        <div className={styles.groupHeader}>
          <span className={styles.label}>Corner Radius</span>
          <button
            type="button"
            className={styles.iconBtn}
            style={{ width: '22px', height: '22px' }}
            onClick={() => setIsCornersLinked(!isCornersLinked)}
            title={isCornersLinked ? 'Corners Linked (Uniform)' : 'Corners Independent'}
          >
            {isCornersLinked ? (
              <Link size={12} strokeWidth={1.5} />
            ) : (
              <Unlink size={12} strokeWidth={1.5} />
            )}
          </button>
        </div>

        {/* Master Slider */}
        <div className={styles.sliderContainer}>
          <input
            type="range"
            className={styles.slider}
            min={0}
            max={100}
            value={masterRadius}
            onChange={(e) => handleMasterRadiusChange(Number(e.target.value))}
          />
          <span className={styles.sliderBadge}>{masterRadius}px</span>
        </div>

        {/* Independent 4-Corner Inputs */}
        {!isCornersLinked && (
          <div className={styles.propGrid4} style={{ marginTop: '8px' }}>
            <NumberInput
              label="TL"
              value={tl}
              suffix="px"
              min={0}
              max={200}
              onChange={(v) => updateSelectedBorders({ cornerRadiusTl: v, cornerRadius: undefined })}
            />
            <NumberInput
              label="TR"
              value={tr}
              suffix="px"
              min={0}
              max={200}
              onChange={(v) => updateSelectedBorders({ cornerRadiusTr: v, cornerRadius: undefined })}
            />
            <NumberInput
              label="BR"
              value={br}
              suffix="px"
              min={0}
              max={200}
              onChange={(v) => updateSelectedBorders({ cornerRadiusBr: v, cornerRadius: undefined })}
            />
            <NumberInput
              label="BL"
              value={bl}
              suffix="px"
              min={0}
              max={200}
              onChange={(v) => updateSelectedBorders({ cornerRadiusBl: v, cornerRadius: undefined })}
            />
          </div>
        )}
      </div>

      <div className={styles.divider} />

      {/* Border & Stroke */}
      <div className={styles.propGroup}>
        <div className={styles.groupHeader}>
          <span className={styles.label}>Border & Stroke</span>
          <Switch
            checked={borderEnabled}
            onChange={(checked) => updateSelectedBorders({ borderEnabled: checked })}
          />
        </div>

        {borderEnabled && (
          <>
            <div className={styles.propRow}>
              <span className={styles.subLabel}>Stroke Color</span>
              <ColorPicker
                value={borderColor}
                onChange={(c) => updateSelectedBorders({ borderColor: c })}
              />
            </div>

            <div className={styles.propRow}>
              <span className={styles.subLabel}>Stroke Width</span>
              <div style={{ width: '100px' }}>
                <NumberInput
                  value={borderWidth}
                  min={1}
                  max={40}
                  suffix="px"
                  onChange={(w) => updateSelectedBorders({ borderWidth: w })}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div className={styles.divider} />

      {/* Shape Preset Shell (Phase 4 Shape Engine Readiness) */}
      <div className={styles.propGroup}>
        <div className={styles.groupHeader}>
          <span className={styles.label}>Shape Geometry</span>
          <span className={styles.subLabel} style={{ fontSize: '9px', textTransform: 'uppercase', opacity: 0.6 }}>
            Phase 4
          </span>
        </div>

        <div className={styles.propGrid3}>
          <button
            type="button"
            className={`${styles.actionBtn} ${masterRadius === 0 ? styles.iconBtnActive : ''}`}
            onClick={() => handleMasterRadiusChange(0)}
            title="Rectangle"
          >
            <Square size={13} strokeWidth={1.5} />
            <span>Rect</span>
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${masterRadius > 0 && masterRadius < 50 ? styles.iconBtnActive : ''}`}
            onClick={() => handleMasterRadiusChange(16)}
            title="Rounded Rectangle"
          >
            <Square size={13} strokeWidth={1.5} style={{ borderRadius: '3px' }} />
            <span>Rounded</span>
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${masterRadius >= 50 ? styles.iconBtnActive : ''}`}
            onClick={() => handleMasterRadiusChange(100)}
            title="Circle / Capsule"
          >
            <Circle size={13} strokeWidth={1.5} />
            <span>Circle</span>
          </button>
        </div>

        <button
          type="button"
          className={styles.actionBtn}
          style={{ marginTop: '6px', opacity: 0.7 }}
          onClick={() => onToast?.('Hexagon and custom polygon clipping masks are arriving in Phase 4!')}
          title="Polygon & Custom Mask (Phase 4)"
        >
          <Hexagon size={13} strokeWidth={1.5} />
          <span>Hexagon & Custom Shapes (Phase 4)</span>
        </button>
      </div>
    </div>
  );
}
