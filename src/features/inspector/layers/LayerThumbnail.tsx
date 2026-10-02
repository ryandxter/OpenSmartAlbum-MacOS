import React from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Image as ImageIcon, AlertTriangle, Shapes } from 'lucide-react';
import { StudioLayer } from './types';
import styles from './LayerThumbnail.module.css';

interface LayerThumbnailProps {
  layer: StudioLayer;
}

function safeConvertSrc(path?: string): string {
  if (!path) return '';
  try {
    return convertFileSrc(path);
  } catch {
    return path;
  }
}

export const LayerThumbnail: React.FC<LayerThumbnailProps> = React.memo(({ layer }) => {
  if (layer.kind === 'text') {
    return (
      <div className={styles.textThumbnail} aria-hidden="true" title="Text Layer">
        <span className={styles.textGlyph}>T</span>
      </div>
    );
  }

  if (layer.kind === 'shape') {
    return (
      <div className={styles.shapeThumbnail} aria-hidden="true" title={`Shape: ${layer.shapeType || 'Mask'}`}>
        <Shapes size={14} className={styles.shapeIcon} />
      </div>
    );
  }

  // Photo Kind
  if (layer.isMissing) {
    return (
      <div className={`${styles.photoThumbnail} ${styles.photoMissing}`} aria-hidden="true" title="Missing Photo Asset">
        <AlertTriangle size={13} className={styles.missingIcon} />
      </div>
    );
  }

  if (layer.thumbnailSrc) {
    return (
      <div className={styles.photoThumbnail}>
        <img
          src={safeConvertSrc(layer.thumbnailSrc)}
          alt=""
          className={styles.photoImg}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className={styles.photoThumbnail} aria-hidden="true">
      <ImageIcon size={13} className={styles.emptyPhotoIcon} />
    </div>
  );
});

LayerThumbnail.displayName = 'LayerThumbnail';
