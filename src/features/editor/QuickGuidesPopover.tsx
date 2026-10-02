import React, { useEffect, useRef, useMemo } from 'react';
import {
  X,
  SlidersHorizontal,
  Magnet,
} from 'lucide-react';
import { Switch } from '../../components/ui/Switch';
import { useAlbumStore } from '../../stores/albumStore';
import { useCarouselStore } from '../../stores/carouselStore';
import { useEditorStore } from '../../stores/editorStore';
import { SNAPPING_LEVELS, SnappingLevel } from '../../domain/editor';
import styles from './QuickGuidesPopover.module.css';

export interface QuickGuidesPopoverProps {
  mode: 'print' | 'carousel';
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  align?: 'left' | 'center' | 'right';
}

export function QuickGuidesPopover({
  mode,
  isOpen,
  onClose,
  anchorRef,
  align = 'center',
}: QuickGuidesPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Snapping Store
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const snappingConfig = useEditorStore((s) => s.snappingConfig);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);
  const updateSnappingConfig = useEditorStore((s) => s.updateSnappingConfig);

  // Print Album Guides
  const showGutterGuide = useAlbumStore((s) => s.showGutterGuide);
  const showBleedGuide = useAlbumStore((s) => s.showBleedGuide);
  const showSafeAreaGuide = useAlbumStore((s) => s.showSafeAreaGuide);
  const showPrintCenterGuide = useAlbumStore((s) => s.showCenterGuide);
  const showPrintThirdsGuide = useAlbumStore((s) => s.showThirdsGuide);
  const togglePrintGuide = useAlbumStore((s) => s.toggleGuide);

  // Carousel Guides
  const showSliceGuides = useCarouselStore((s) => s.showSliceGuides);
  const showCarouselCenterGuide = useCarouselStore((s) => s.showCenterGuide);
  const showCarouselThirdsGuide = useCarouselStore((s) => s.showThirdsGuide);
  const toggleCarouselGuide = useCarouselStore((s) => s.toggleGuide);

  // Active Snapping Level Calculation
  const activeLevelObj: SnappingLevel = useMemo(() => {
    const defaultLevel = SNAPPING_LEVELS.find((l) => l.isDefault) || SNAPPING_LEVELS[1]!;
    if (!snappingConfig.threshold) return defaultLevel;
    let closest: SnappingLevel = defaultLevel;
    let minDiff = Infinity;
    for (const lvl of SNAPPING_LEVELS) {
      const diff = Math.abs(lvl.mm - snappingConfig.threshold);
      if (diff < minDiff) {
        minDiff = diff;
        closest = lvl;
      }
    }
    return closest;
  }, [snappingConfig.threshold]);

  // Outside click listener
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        (!anchorRef?.current || !anchorRef.current.contains(target))
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        anchorRef?.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className={`${styles.popoverContainer} ${styles[`align_${align}`]}`}
      role="dialog"
      aria-label="Quick Guides and Snapping Settings"
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitleRow}>
          <SlidersHorizontal size={14} className={styles.headerIcon} />
          <span className={styles.headerTitle}>Guides & Snapping</span>
        </div>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close Popover"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>

      <div className={styles.scrollBody}>
        {/* SECTION 1: CANVAS GUIDES */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Canvas Visual Guides</div>
          <div className={styles.itemsList}>
            {mode === 'print' ? (
              <>
                <div className={styles.itemRow} onClick={() => togglePrintGuide('gutter')}>
                  <span className={styles.itemTitle}>Spine Center Crease</span>
                  <Switch
                    checked={showGutterGuide}
                    onChange={() => togglePrintGuide('gutter')}
                    size="sm"
                  />
                </div>
                <div className={styles.itemRow} onClick={() => togglePrintGuide('safeArea')}>
                  <span className={styles.itemTitle}>Safe Area Margins (Blue)</span>
                  <Switch
                    checked={showSafeAreaGuide}
                    onChange={() => togglePrintGuide('safeArea')}
                    size="sm"
                  />
                </div>
                <div className={styles.itemRow} onClick={() => togglePrintGuide('bleed')}>
                  <span className={styles.itemTitle}>Bleed Cut Boundary (Red)</span>
                  <Switch
                    checked={showBleedGuide}
                    onChange={() => togglePrintGuide('bleed')}
                    size="sm"
                  />
                </div>
                <div className={styles.itemRow} onClick={() => togglePrintGuide('center')}>
                  <span className={styles.itemTitle}>Optical Centerlines</span>
                  <Switch
                    checked={showPrintCenterGuide}
                    onChange={() => togglePrintGuide('center')}
                    size="sm"
                  />
                </div>
                <div className={styles.itemRow} onClick={() => togglePrintGuide('thirds')}>
                  <span className={styles.itemTitle}>Rule of Thirds Grid (3×3)</span>
                  <Switch
                    checked={showPrintThirdsGuide}
                    onChange={() => togglePrintGuide('thirds')}
                    size="sm"
                  />
                </div>
              </>
            ) : (
              <>
                <div className={styles.itemRow} onClick={() => toggleCarouselGuide('slices')}>
                  <span className={styles.itemTitle}>Slide Slice Boundaries</span>
                  <Switch
                    checked={showSliceGuides}
                    onChange={() => toggleCarouselGuide('slices')}
                    size="sm"
                  />
                </div>
                <div className={styles.itemRow} onClick={() => toggleCarouselGuide('center')}>
                  <span className={styles.itemTitle}>Slide Center Axes</span>
                  <Switch
                    checked={showCarouselCenterGuide}
                    onChange={() => toggleCarouselGuide('center')}
                    size="sm"
                  />
                </div>
                <div className={styles.itemRow} onClick={() => toggleCarouselGuide('thirds')}>
                  <span className={styles.itemTitle}>Slide Rule of Thirds (3×3)</span>
                  <Switch
                    checked={showCarouselThirdsGuide}
                    onChange={() => toggleCarouselGuide('thirds')}
                    size="sm"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <div className={styles.divider} />

        {/* SECTION 2: MAGNETIC SNAPPING */}
        <div className={styles.section}>
          <div className={styles.masterRow} onClick={toggleSnap}>
            <div className={styles.masterInfo}>
              <div className={styles.masterTitleRow}>
                <Magnet size={13} className={styles.masterIcon} />
                <span className={styles.itemTitle} style={{ fontWeight: 600 }}>
                  Magnetic Snapping
                </span>
              </div>
              <span className={styles.itemDesc}>Snap to guides during drag & resize</span>
            </div>
            <Switch checked={snapEnabled} onChange={toggleSnap} size="sm" />
          </div>

          {/* Attraction Distance Threshold Pills */}
          <div className={styles.thresholdSection}>
            <div className={styles.subLabel}>Attraction Distance</div>
            <div className={styles.pillsContainer}>
              {SNAPPING_LEVELS.map((lvl) => {
                const isActive = activeLevelObj.level === lvl.level;
                return (
                  <button
                    key={lvl.level}
                    type="button"
                    className={`${styles.levelPill} ${isActive ? styles.levelPillActive : ''}`}
                    onClick={() => updateSnappingConfig({ threshold: lvl.mm })}
                    title={`Level ${lvl.level} (${lvl.name}) — ${lvl.desc}`}
                  >
                    <div className={styles.pillLevel}>L{lvl.level}</div>
                    <div className={styles.pillName}>{lvl.name}</div>
                  </button>
                );
              })}
            </div>
            <div className={styles.activeLevelMetric}>
              <span>🧲 Level {activeLevelObj.level} • {activeLevelObj.name}</span>
              <span className={styles.metricBadge}>{activeLevelObj.px}px / {activeLevelObj.mm}mm</span>
            </div>
          </div>
        </div>

        <div className={styles.divider} />

        {/* SECTION 3: REFERENCE TARGETS */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Snapping Reference Targets</div>
          <div className={styles.itemsList}>
            <div
              className={styles.itemRow}
              onClick={() =>
                snapEnabled &&
                updateSnappingConfig({ snapToPageEdges: !snappingConfig.snapToPageEdges })
              }
            >
              <span className={styles.itemTitle}>Page & Spine Outer Edges</span>
              <Switch
                checked={snappingConfig.snapToPageEdges}
                disabled={!snapEnabled}
                onChange={(checked) => updateSnappingConfig({ snapToPageEdges: checked })}
                size="sm"
              />
            </div>
            <div
              className={styles.itemRow}
              onClick={() =>
                snapEnabled &&
                updateSnappingConfig({ snapToPageCenters: !snappingConfig.snapToPageCenters })
              }
            >
              <span className={styles.itemTitle}>Page Optical Centers</span>
              <Switch
                checked={snappingConfig.snapToPageCenters}
                disabled={!snapEnabled}
                onChange={(checked) => updateSnappingConfig({ snapToPageCenters: checked })}
                size="sm"
              />
            </div>
            <div
              className={styles.itemRow}
              onClick={() =>
                snapEnabled &&
                updateSnappingConfig({ snapToMargins: !snappingConfig.snapToMargins })
              }
            >
              <span className={styles.itemTitle}>Safe Zone Margins</span>
              <Switch
                checked={snappingConfig.snapToMargins}
                disabled={!snapEnabled}
                onChange={(checked) => updateSnappingConfig({ snapToMargins: checked })}
                size="sm"
              />
            </div>
            <div
              className={styles.itemRow}
              onClick={() =>
                snapEnabled &&
                updateSnappingConfig({ snapToFrames: !snappingConfig.snapToFrames })
              }
            >
              <span className={styles.itemTitle}>Adjacent Frame Edges</span>
              <Switch
                checked={snappingConfig.snapToFrames}
                disabled={!snapEnabled}
                onChange={(checked) => updateSnappingConfig({ snapToFrames: checked })}
                size="sm"
              />
            </div>
            <div
              className={styles.itemRow}
              onClick={() =>
                snapEnabled &&
                updateSnappingConfig({ snapToEqualGaps: !snappingConfig.snapToEqualGaps })
              }
            >
              <span className={styles.itemTitle}>Equidistant Gap Spacing</span>
              <Switch
                checked={snappingConfig.snapToEqualGaps}
                disabled={!snapEnabled}
                onChange={(checked) => updateSnappingConfig({ snapToEqualGaps: checked })}
                size="sm"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
