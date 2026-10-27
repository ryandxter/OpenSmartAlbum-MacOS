import React, { useState, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, Sparkles } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Dialog } from '../../components/ui/Dialog';
import { useAssetStore } from '../../stores/assetStore';
import { frameAssetService, FrameAssetMeta, FrameSlotPayload } from '../../services/frameAssetService';
import { isTauri } from '../../utils/platform';
import styles from './ImportCustomAssetModal.module.css';

interface ImportCustomAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: 'frame' | 'element';
  onImportSuccess?: (asset: FrameAssetMeta) => void;
  onImported?: (asset: FrameAssetMeta) => void;
}

const SHAPES = ['rectangle', 'square', 'oval', 'arch', 'circle'] as const;

export function ImportCustomAssetModal({
  isOpen,
  onClose,
  initialCategory = 'frame',
  onImportSuccess,
  onImported,
}: ImportCustomAssetModalProps) {
  const [filePath, setFilePath] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<'frame' | 'element'>(initialCategory);
  const [shape, setShape] = useState<string>('rectangle');

  // Inset percentages (0..50)
  const [insetTop, setInsetTop] = useState<number>(10);
  const [insetBottom, setInsetBottom] = useState<number>(10);
  const [insetLeft, setInsetLeft] = useState<number>(10);
  const [insetRight, setInsetRight] = useState<number>(10);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFilePath('');
    setPreviewUrl('');
    setTitle('');
    setCategory('frame');
    setShape('rectangle');
    setInsetTop(10);
    setInsetBottom(10);
    setInsetLeft(10);
    setInsetRight(10);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handlePickFile = async () => {
    if (isTauri()) {
      try {
        const picked = await frameAssetService.pickFrameAssetFileDialog();
        if (picked) {
          setFilePath(picked);
          setPreviewUrl(convertFileSrc(picked));
          const name = picked.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Custom Asset';
          setTitle(name);
        }
      } catch (err) {
        console.error('[ImportCustomAssetModal] Pick file error:', err);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilePath(file.name);
    setPreviewUrl(URL.createObjectURL(file));
    setTitle(file.name.replace(/\.[^/.]+$/, ''));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setFilePath(file.name);
    setPreviewUrl(URL.createObjectURL(file));
    setTitle(file.name.replace(/\.[^/.]+$/, ''));
  };

  const handleImport = async () => {
    if (!filePath || isSubmitting) return;
    setIsSubmitting(true);

    try {
      let customSlot: FrameSlotPayload | undefined = undefined;
      if (category === 'frame') {
        const slotX = insetLeft / 100;
        const slotY = insetTop / 100;
        const slotWidth = Math.max(0.05, (100 - insetLeft - insetRight) / 100);
        const slotHeight = Math.max(0.05, (100 - insetTop - insetBottom) / 100);

        customSlot = {
          slotX: (Math.round(slotX * 1000) / 1000),
          slotY: (Math.round(slotY * 1000) / 1000),
          slotWidth: (Math.round(slotWidth * 1000) / 1000),
          slotHeight: (Math.round(slotHeight * 1000) / 1000),
          shape,
        };
      }

      const imported = await useAssetStore.getState().importAsset(
        filePath,
        category,
        shape,
        customSlot
      );

      if (imported) {
        onImportSuccess?.(imported);
        onImported?.(imported);
      }
      handleClose();
    } catch (err) {
      console.error('[ImportCustomAssetModal] Import failed:', err);
      setIsSubmitting(false);
    }
  };

  const slotX = insetLeft;
  const slotY = insetTop;
  const slotWidth = Math.max(5, 100 - insetLeft - insetRight);
  const slotHeight = Math.max(5, 100 - insetTop - insetBottom);

  let shapeOverlayClass = '';
  if (shape === 'circle') shapeOverlayClass = styles.apertureCircle || '';
  else if (shape === 'oval') shapeOverlayClass = styles.apertureOval || '';
  else if (shape === 'arch') shapeOverlayClass = styles.apertureArch || '';
  else if (shape === 'square') shapeOverlayClass = styles.apertureRounded || '';

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Decorative Asset"
      width={600}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          {previewUrl ? (
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handlePickFile}
              disabled={isSubmitting}
            >
              Change File…
            </button>
          ) : <div />}

          <div className={styles.actionsRight}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleImport}
              disabled={!filePath || isSubmitting}
            >
              {isSubmitting ? 'Importing…' : 'Import Asset'}
            </button>
          </div>
        </div>
      }
    >
      <div className={styles.modalContent}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.webp,.svg"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />

        {!previewUrl ? (
          <div
            className={styles.dropzone}
            onClick={handlePickFile}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
          >
            <div className={styles.dropzoneIcon}>
              <UploadCloud size={40} strokeWidth={1.5} />
            </div>
            <div className={styles.dropzoneTitle}>Choose Frame or Sticker Asset</div>
            <div className={styles.dropzoneSub}>
              Supports PNG with transparency, WebP, and SVG vector graphics
            </div>
            <button type="button" className={styles.browseBtn} onClick={(e) => { e.stopPropagation(); handlePickFile(); }}>
              Browse Files…
            </button>
          </div>
        ) : (
          <div className={styles.previewGrid}>
            <div className={styles.previewBox}>
              <img src={previewUrl} alt="Preview" className={styles.previewImage} />
              {category === 'frame' && (
                <div
                  className={`${styles.apertureOverlay} ${shapeOverlayClass}`}
                  style={{
                    left: `${slotX}%`,
                    top: `${slotY}%`,
                    width: `${slotWidth}%`,
                    height: `${slotHeight}%`,
                  }}
                  title="Photo Aperture Window"
                />
              )}
            </div>

            <div className={styles.formFields}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Asset Title</label>
                <input
                  type="text"
                  className={styles.textInput}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Golden Floral Arch Frame"
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Category</label>
                <div className={styles.segmentedControl}>
                  <button
                    type="button"
                    className={`${styles.segmentBtn} ${category === 'frame' ? styles.segmentBtnActive : ''}`}
                    onClick={() => setCategory('frame')}
                  >
                    <ImageIcon size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                    Frame Overlay
                  </button>
                  <button
                    type="button"
                    className={`${styles.segmentBtn} ${category === 'element' ? styles.segmentBtnActive : ''}`}
                    onClick={() => setCategory('element')}
                  >
                    <Sparkles size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                    Graphic Sticker
                  </button>
                </div>
              </div>

              {category === 'frame' && (
                <>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Aperture Shape</label>
                    <div className={styles.chipRow}>
                      {SHAPES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={`${styles.chip} ${shape === s ? styles.chipActive : ''}`}
                          onClick={() => setShape(s)}
                        >
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Aperture Insets (%)</label>
                    <div className={styles.insetsGrid}>
                      <div className={styles.insetControl}>
                        <div className={styles.insetLabel}>
                          <span>Top</span>
                          <span>{insetTop}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={45}
                          value={insetTop}
                          onChange={(e) => setInsetTop(Number(e.target.value))}
                          className={styles.slider}
                        />
                      </div>

                      <div className={styles.insetControl}>
                        <div className={styles.insetLabel}>
                          <span>Bottom</span>
                          <span>{insetBottom}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={45}
                          value={insetBottom}
                          onChange={(e) => setInsetBottom(Number(e.target.value))}
                          className={styles.slider}
                        />
                      </div>

                      <div className={styles.insetControl}>
                        <div className={styles.insetLabel}>
                          <span>Left</span>
                          <span>{insetLeft}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={45}
                          value={insetLeft}
                          onChange={(e) => setInsetLeft(Number(e.target.value))}
                          className={styles.slider}
                        />
                      </div>

                      <div className={styles.insetControl}>
                        <div className={styles.insetLabel}>
                          <span>Right</span>
                          <span>{insetRight}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={45}
                          value={insetRight}
                          onChange={(e) => setInsetRight(Number(e.target.value))}
                          className={styles.slider}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
