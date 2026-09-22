import { useState, useRef } from 'react';
import {
  Square,
  Circle,
  Hexagon,
  Octagon,
  Star,
  Cloud,
  Heart,
  Upload,
  RotateCcw,
  Link,
  Unlink,
} from 'lucide-react';
import { useEditorStore } from '../../../stores/editorStore';
import { useAlbumStore } from '../../../stores/albumStore';
import { useCarouselStore } from '../../../stores/carouselStore';
import { ColorPicker } from '../../../components/ui/ColorPicker';
import { Switch } from '../../../components/ui/Switch';
import { NumberInput } from '../../../components/ui/NumberInput';
import { getCornerRadii, ShapeType } from '../../../domain/editor';
import { getAllAlbumSpreads } from '../../../domain/album';
import styles from '../InspectorShared.module.css';

interface ShapesBordersSectionProps {
  onToast?: (msg: string) => void;
  activeMode?: 'print' | 'carousel';
}

export function ShapesBordersSection({ onToast, activeMode = 'print' }: ShapesBordersSectionProps) {
  const isCarousel = activeMode === 'carousel';

  // Album/Print Store state
  const currentAlbum = useAlbumStore((s) => s.currentAlbum);
  const activeSpreadId = useAlbumStore((s) => s.activeSpreadId);
  const selectedFrameIds = useEditorStore((s) => s.selectedFrameIds);
  const updateFrameGeometry = useEditorStore((s) => s.updateFrameGeometry);
  const batchUpdateFrames = useEditorStore((s) => s.batchUpdateFrames);

  // Carousel Store state
  const currentCarousel = useCarouselStore((s) => s.currentCarousel);
  const selectedCarouselFrameId = useCarouselStore((s) => s.selectedFrameId);

  const [isCornersLinked, setIsCornersLinked] = useState(true);
  const svgInputRef = useRef<HTMLInputElement>(null);

  const allSpreads = currentAlbum ? getAllAlbumSpreads(currentAlbum) : [];
  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];
  const selectedElements = (activeSpread?.elements || []).filter((el) =>
    selectedFrameIds.includes(el.id)
  );

  const carouselFrame = isCarousel
    ? currentCarousel?.slides
        .flatMap((s) => s.elements)
        .find((el) => el.id === selectedCarouselFrameId && el.type === 'photo')
    : null;

  if (isCarousel && !carouselFrame) {
    return (
      <div className={styles.emptyHint}>
        Select a carousel photo frame to customize clipping shapes, borders, and corner radii.
      </div>
    );
  }

  if (!isCarousel && selectedElements.length === 0) {
    return (
      <div className={styles.emptyHint}>
        Select one or more photo frames to customize clipping shapes, borders, and drop shadows.
      </div>
    );
  }

  // Representative element for initial values
  const activeTarget: any = isCarousel ? carouselFrame : selectedElements[0];
  const currentShape: ShapeType =
    activeTarget.shapeType || (activeTarget.cornerRadius ? 'rounded' : 'rectangle');

  const [tl, tr, br, bl] = isCarousel
    ? [
        Number(activeTarget.cornerRadiusTl ?? activeTarget.cornerRadius ?? 0),
        Number(activeTarget.cornerRadiusTr ?? activeTarget.cornerRadius ?? 0),
        Number(activeTarget.cornerRadiusBr ?? activeTarget.cornerRadius ?? 0),
        Number(activeTarget.cornerRadiusBl ?? activeTarget.cornerRadius ?? 0),
      ]
    : getCornerRadii(activeTarget);
  const masterRadius = Math.max(tl, tr, br, bl);

  // Border values
  const borderEnabled = Boolean(activeTarget.borderEnabled);
  const borderWidth = Number(activeTarget.borderWidth || 1);
  const borderColor = String(activeTarget.borderColor || '#FFFFFF');
  const borderStyle = String(activeTarget.borderStyle || 'solid');

  // Shadow values
  const shadowEnabled = Boolean(activeTarget.shadowEnabled);
  const shadowColor = String(activeTarget.shadowColor || 'rgba(0, 0, 0, 0.6)');
  const shadowBlur = Number(activeTarget.shadowBlur ?? 15);
  const shadowOffsetX = Number(activeTarget.shadowOffsetX ?? 0);
  const shadowOffsetY = Number(activeTarget.shadowOffsetY ?? 6);
  const shadowOpacity = Math.round(Number(activeTarget.shadowOpacity ?? 0.6) * 100);

  const updateSelectedBorders = (updates: Record<string, any>) => {
    if (isCarousel) {
      if (!selectedCarouselFrameId) return;
      useCarouselStore.getState().updatePhotoFrame(selectedCarouselFrameId, updates);
      return;
    }

    if (!activeSpreadId || !activeTarget) return;
    if (selectedElements.length === 1) {
      updateFrameGeometry(activeSpreadId, activeTarget.id, updates as any);
    } else {
      batchUpdateFrames(
        activeSpreadId,
        selectedElements.map((el) => ({ id: el.id, geometry: updates as any }))
      );
    }
  };

  const handleShapeSelect = (shape: ShapeType) => {
    if (shape === 'rounded') {
      updateSelectedBorders({
        shapeType: 'rounded',
        cornerRadius: masterRadius > 0 ? masterRadius : 16,
        cornerRadiusTl: masterRadius > 0 ? masterRadius : 16,
        cornerRadiusTr: masterRadius > 0 ? masterRadius : 16,
        cornerRadiusBr: masterRadius > 0 ? masterRadius : 16,
        cornerRadiusBl: masterRadius > 0 ? masterRadius : 16,
      });
    } else if (shape === 'rectangle') {
      updateSelectedBorders({
        shapeType: 'rectangle',
        cornerRadius: 0,
        cornerRadiusTl: 0,
        cornerRadiusTr: 0,
        cornerRadiusBr: 0,
        cornerRadiusBl: 0,
      });
    } else {
      updateSelectedBorders({
        shapeType: shape,
      });
    }
    onToast?.(`Applied ${shape} shape`);
  };

  const handleMasterRadiusChange = (radius: number) => {
    updateSelectedBorders({
      shapeType: radius > 0 ? 'rounded' : 'rectangle',
      cornerRadius: radius,
      cornerRadiusTl: radius,
      cornerRadiusTr: radius,
      cornerRadiusBr: radius,
      cornerRadiusBl: radius,
    });
  };

  const handleSvgFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      // Extract path d attribute
      const match = text.match(/<path[^>]*d=["']([^"']+)["']/i);
      if (match && match[1]) {
        updateSelectedBorders({
          shapeType: 'custom_svg',
          customSvgPath: match[1],
        });
        onToast?.('Loaded custom SVG mask vector');
      } else {
        onToast?.('Could not find vector <path> in SVG file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div>
      {/* 1. Geometric Shape Presets */}
      <div className={styles.propGroup}>
        <div className={styles.groupHeader}>
          <span className={styles.label}>Vector Shape Mask</span>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => handleShapeSelect('rectangle')}
            title="Reset to Standard Rectangle"
          >
            <RotateCcw size={12} strokeWidth={1.5} />
          </button>
        </div>

        <div className={styles.propGrid3}>
          <button
            type="button"
            className={`${styles.actionBtn} ${currentShape === 'rectangle' ? styles.iconBtnActive : ''}`}
            onClick={() => handleShapeSelect('rectangle')}
            title="Rectangle"
          >
            <Square size={13} strokeWidth={1.5} />
            <span>Rect</span>
          </button>

          <button
            type="button"
            className={`${styles.actionBtn} ${currentShape === 'rounded' ? styles.iconBtnActive : ''}`}
            onClick={() => handleShapeSelect('rounded')}
            title="Rounded Rectangle"
          >
            <Square size={13} strokeWidth={1.5} style={{ borderRadius: '3px' }} />
            <span>Rounded</span>
          </button>

          <button
            type="button"
            className={`${styles.actionBtn} ${currentShape === 'circle' ? styles.iconBtnActive : ''}`}
            onClick={() => handleShapeSelect('circle')}
            title="Circle"
          >
            <Circle size={13} strokeWidth={1.5} />
            <span>Circle</span>
          </button>

          <button
            type="button"
            className={`${styles.actionBtn} ${currentShape === 'hexagon' ? styles.iconBtnActive : ''}`}
            onClick={() => handleShapeSelect('hexagon')}
            title="Hexagon"
          >
            <Hexagon size={13} strokeWidth={1.5} />
            <span>Hexagon</span>
          </button>

          <button
            type="button"
            className={`${styles.actionBtn} ${currentShape === 'octagon' ? styles.iconBtnActive : ''}`}
            onClick={() => handleShapeSelect('octagon')}
            title="Octagon"
          >
            <Octagon size={13} strokeWidth={1.5} />
            <span>Octagon</span>
          </button>

          <button
            type="button"
            className={`${styles.actionBtn} ${currentShape === 'star' ? styles.iconBtnActive : ''}`}
            onClick={() => handleShapeSelect('star')}
            title="Star (5-Point)"
          >
            <Star size={13} strokeWidth={1.5} />
            <span>Star</span>
          </button>

          <button
            type="button"
            className={`${styles.actionBtn} ${currentShape === 'scallop' ? styles.iconBtnActive : ''}`}
            onClick={() => handleShapeSelect('scallop')}
            title="Scallop / Cloud Fluted Frame"
          >
            <Cloud size={13} strokeWidth={1.5} />
            <span>Scallop</span>
          </button>

          <button
            type="button"
            className={`${styles.actionBtn} ${currentShape === 'heart' ? styles.iconBtnActive : ''}`}
            onClick={() => handleShapeSelect('heart')}
            title="Heart Frame"
          >
            <Heart size={13} strokeWidth={1.5} />
            <span>Heart</span>
          </button>

          <button
            type="button"
            className={`${styles.actionBtn} ${currentShape === 'custom_svg' ? styles.iconBtnActive : ''}`}
            onClick={() => svgInputRef.current?.click()}
            title="Upload Custom Vector SVG (.svg)"
          >
            <Upload size={13} strokeWidth={1.5} />
            <span>SVG Mask</span>
          </button>
        </div>

        <input
          ref={svgInputRef}
          type="file"
          accept=".svg"
          style={{ display: 'none' }}
          onChange={handleSvgFileUpload}
        />
      </div>

      {/* 2. Corner Radii (For Rectangle / Rounded) */}
      {(currentShape === 'rectangle' || currentShape === 'rounded') && (
        <>
          <div className={styles.divider} />
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
        </>
      )}

      <div className={styles.divider} />

      {/* 3. Border & Stroke */}
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

            <div className={styles.propRow}>
              <span className={styles.subLabel}>Stroke Style</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${borderStyle === 'solid' ? styles.iconBtnActive : ''}`}
                  style={{ padding: '3px 8px', fontSize: 11 }}
                  onClick={() => updateSelectedBorders({ borderStyle: 'solid' })}
                >
                  Solid
                </button>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${borderStyle === 'dashed' ? styles.iconBtnActive : ''}`}
                  style={{ padding: '3px 8px', fontSize: 11 }}
                  onClick={() => updateSelectedBorders({ borderStyle: 'dashed' })}
                >
                  Dashed
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {!isCarousel && (
        <>
          <div className={styles.divider} />

          {/* 4. Contour Drop Shadow */}
          <div className={styles.propGroup}>
            <div className={styles.groupHeader}>
              <span className={styles.label}>Drop Shadow</span>
              <Switch
                checked={shadowEnabled}
                onChange={(checked) => updateSelectedBorders({ shadowEnabled: checked })}
              />
            </div>

            {shadowEnabled && (
              <>
                <div className={styles.propRow}>
                  <span className={styles.subLabel}>Shadow Color</span>
                  <ColorPicker
                    value={shadowColor}
                    onChange={(c) => updateSelectedBorders({ shadowColor: c })}
                  />
                </div>

                <div className={styles.propRow}>
                  <span className={styles.subLabel}>Blur Radius</span>
                  <div style={{ width: '100px' }}>
                    <NumberInput
                      value={shadowBlur}
                      min={0}
                      max={60}
                      suffix="px"
                      onChange={(b) => updateSelectedBorders({ shadowBlur: b })}
                    />
                  </div>
                </div>

                <div className={styles.propGrid2} style={{ marginTop: '8px' }}>
                  <NumberInput
                    label="Offset X"
                    value={shadowOffsetX}
                    min={-50}
                    max={50}
                    suffix="px"
                    onChange={(ox) => updateSelectedBorders({ shadowOffsetX: ox })}
                  />
                  <NumberInput
                    label="Offset Y"
                    value={shadowOffsetY}
                    min={-50}
                    max={50}
                    suffix="px"
                    onChange={(oy) => updateSelectedBorders({ shadowOffsetY: oy })}
                  />
                </div>

                <div className={styles.propGroup} style={{ marginTop: '8px' }}>
                  <span className={styles.subLabel}>Opacity ({shadowOpacity}%)</span>
                  <div className={styles.sliderContainer} style={{ marginTop: '4px' }}>
                    <input
                      type="range"
                      className={styles.slider}
                      min={0}
                      max={100}
                      value={shadowOpacity}
                      onChange={(e) => updateSelectedBorders({ shadowOpacity: Number(e.target.value) / 100 })}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
