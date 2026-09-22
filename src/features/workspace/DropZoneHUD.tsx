import React from 'react';
import { DownloadCloud, ImagePlus, Sparkles } from 'lucide-react';
import styles from './DropZoneHUD.module.css';

export interface DropZoneHUDProps {
  isVisible: boolean;
  targetZone: 'canvas' | 'filmstrip' | 'none';
  activeMode: 'print' | 'carousel';
  itemCount?: number;
}

export const DropZoneHUD: React.FC<DropZoneHUDProps> = ({
  isVisible,
  targetZone,
  activeMode,
  itemCount = 0,
}) => {
  if (!isVisible) return null;

  const isCanvasActive = targetZone === 'canvas';
  const isFilmstripActive = targetZone === 'filmstrip';

  const canvasTitle =
    activeMode === 'carousel'
      ? 'Drop Photos to Add to Slide & Library'
      : 'Drop Photos to Add to Spread & Library';

  const canvasSubtitle =
    itemCount >= 2 && itemCount <= 6
      ? 'Smart Auto-Partitioning will create an optimal aspect-ratio matched layout'
      : 'Directly places photos onto the current page and syncs with your project library';

  return (
    <div className={styles.hudContainer} role="region" aria-label="File Drop Zones">
      {/* Top Floating Badge for dragged item count */}
      {itemCount > 0 && (
        <div className={styles.topPillBar}>
          <div className={styles.itemCountBadge}>
            <span className={styles.badgePulseDot} />
            <span>
              {itemCount} {itemCount === 1 ? 'file' : 'files'} ready to drop
            </span>
          </div>
        </div>
      )}

      <div className={styles.zonesContainer}>
        {/* Canvas Zone Target */}
        <div
          className={`${styles.canvasZone} ${isCanvasActive ? styles.canvasZoneActive : ''}`}
        >
          <div className={styles.cardContent}>
            <div
              className={`${styles.iconWrapper} ${isCanvasActive ? styles.iconWrapperActive : ''}`}
            >
              {itemCount >= 2 && itemCount <= 6 ? (
                <Sparkles size={28} strokeWidth={2} />
              ) : (
                <ImagePlus size={28} strokeWidth={2} />
              )}
            </div>
            <h2 className={styles.cardTitle}>{canvasTitle}</h2>
            <p className={styles.cardSubtitle}>
              {isCanvasActive ? (
                <span className={styles.activeHighlightText}>
                  Release to place immediately onto {activeMode === 'carousel' ? 'active slide' : 'active spread'}
                </span>
              ) : (
                canvasSubtitle
              )}
            </p>
            {itemCount >= 2 && itemCount <= 6 && (
              <div className={styles.tagBadge}>
                <Sparkles size={12} />
                <span>Smart Auto-Partitioning</span>
              </div>
            )}
          </div>
        </div>

        {/* Filmstrip Tray Zone Target */}
        <div
          className={`${styles.filmstripZone} ${isFilmstripActive ? styles.filmstripZoneActive : ''}`}
        >
          <div className={styles.cardContent} style={{ padding: '12px 24px' }}>
            <div
              className={`${styles.iconWrapper} ${isFilmstripActive ? styles.iconWrapperActive : ''}`}
              style={{ width: 44, height: 44 }}
            >
              <DownloadCloud size={22} strokeWidth={2} />
            </div>
            <div>
              <h3 className={styles.cardTitle} style={{ fontSize: 16 }}>
                Drop Photos to Import into Project Library
              </h3>
              <p className={styles.cardSubtitle} style={{ fontSize: 12 }}>
                {isFilmstripActive ? (
                  <span className={styles.activeHighlightText}>
                    Release to import into library pool (without placing on canvas)
                  </span>
                ) : (
                  'Adds photos to the bottom filmstrip for manual placement later'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
