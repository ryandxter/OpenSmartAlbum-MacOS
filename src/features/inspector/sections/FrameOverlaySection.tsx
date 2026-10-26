import { useAlbumStore } from '../../../stores/albumStore';
import { useCarouselStore } from '../../../stores/carouselStore';
import { useEditorStore } from '../../../stores/editorStore';
import { getAllAlbumSpreads } from '../../../domain/album';
import type { PhotoFrameElement } from '../../../domain/editor';
import type { CarouselPhotoFrame } from '../../../domain/carousel';
import { Unlink, Image as ImageIcon, Sliders } from 'lucide-react';
import styles from '../InspectorShared.module.css';

interface FrameOverlaySectionProps {
  onToast?: (msg: string) => void;
  activeMode?: 'print' | 'carousel';
}

export function FrameOverlaySection({ onToast, activeMode = 'print' }: FrameOverlaySectionProps) {
  const isCarousel = activeMode === 'carousel';

  // Print selection
  const currentAlbum = useAlbumStore((s) => s.currentAlbum);
  const activeSpreadId = useAlbumStore((s) => s.activeSpreadId);
  const selectedFrameIds = useEditorStore((s) => s.selectedFrameIds);

  // Carousel selection
  const currentCarousel = useCarouselStore((s) => s.currentCarousel);
  const activeSlideIndex = useCarouselStore((s) => s.activeSlideIndex);
  const selectedCarouselFrameIds = useCarouselStore((s) => s.selectedFrameIds);

  const allSpreads = currentAlbum ? getAllAlbumSpreads(currentAlbum) : [];
  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];

  const carouselElements = currentCarousel?.slides[activeSlideIndex]?.elements || [];
  const printElements = activeSpread?.elements || [];

  const selectedPhoto: PhotoFrameElement | CarouselPhotoFrame | undefined = isCarousel
    ? carouselElements.find(
        (el): el is CarouselPhotoFrame =>
          selectedCarouselFrameIds.length === 1 && el.id === selectedCarouselFrameIds[0] && el.type === 'photo'
      )
    : printElements.find(
        (el): el is PhotoFrameElement =>
          selectedFrameIds.length === 1 && el.id === selectedFrameIds[0] && el.type === 'photo'
      );

  if (!selectedPhoto || !selectedPhoto.frameAssetId) {
    return null;
  }

  const {
    frameAssetTitle,
    frameAssetUrl,
    frameAssetSlot,
  } = selectedPhoto;

  const handleDetach = () => {
    if (isCarousel) {
      useCarouselStore.getState().detachFrameOverlay(selectedPhoto.id);
      onToast?.('✓ Detached decorative frame');
    } else if (activeSpread) {
      useAlbumStore.getState().detachFrameOverlay(activeSpread.id, selectedPhoto.id);
      onToast?.('✓ Detached decorative frame');
    }
  };

  const handleInsetAdjust = (deltaPercent: number) => {
    const cur = frameAssetSlot || { slotX: 0.1, slotY: 0.1, slotWidth: 0.8, slotHeight: 0.8, shape: 'rectangle' };
    const factor = deltaPercent / 100;
    const newW = Math.max(0.1, Math.min(0.98, cur.slotWidth - factor * 2));
    const newH = Math.max(0.1, Math.min(0.98, cur.slotHeight - factor * 2));
    const newX = Math.max(0.01, (1 - newW) / 2);
    const newY = Math.max(0.01, (1 - newH) / 2);

    const updatedSlot = {
      ...cur,
      slotX: Math.round(newX * 1000) / 1000,
      slotY: Math.round(newY * 1000) / 1000,
      slotWidth: Math.round(newW * 1000) / 1000,
      slotHeight: Math.round(newH * 1000) / 1000,
    };

    if (isCarousel) {
      useCarouselStore.getState().updatePhotoFrame(selectedPhoto.id, {
        frameAssetSlot: updatedSlot,
      });
    } else if (activeSpread) {
      useEditorStore.getState().updateFrameGeometry(activeSpread.id, selectedPhoto.id, {
        frameAssetSlot: updatedSlot,
      });
    }
  };

  const slotShape = frameAssetSlot?.shape || 'rectangle';
  const slotWPercent = frameAssetSlot ? Math.round(frameAssetSlot.slotWidth * 100) : 80;
  const slotHPercent = frameAssetSlot ? Math.round(frameAssetSlot.slotHeight * 100) : 80;

  return (
    <div className={styles.sectionBody} style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Asset Preview Card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 6,
          padding: 8,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 4,
            background: '#18181b',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {frameAssetUrl ? (
            <img
              src={frameAssetUrl}
              alt={frameAssetTitle || 'Frame'}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <ImageIcon size={20} color="#71717a" />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#f4f4f5',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {frameAssetTitle || 'Decorative Frame'}
          </div>
          <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span
              style={{
                textTransform: 'capitalize',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                padding: '1px 6px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 500,
              }}
            >
              {slotShape}
            </span>
            <span>Aperture: {slotWPercent}% × {slotHPercent}%</span>
          </div>
        </div>
      </div>

      {/* Inset Adjustment Control */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#a1a1aa' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Sliders size={12} />
            Inner Content Inset
          </span>
          <span>{100 - slotWPercent}%</span>
        </div>
        <input
          type="range"
          min={5}
          max={45}
          value={Math.round((100 - slotWPercent) / 2)}
          onChange={(e) => {
            const desiredInset = Number(e.target.value);
            const currentInset = Math.round((100 - slotWPercent) / 2);
            handleInsetAdjust(desiredInset - currentInset);
          }}
          style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
        />
      </div>

      {/* Detach Frame Button */}
      <button
        type="button"
        onClick={handleDetach}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '7px 10px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: 6,
          color: '#f87171',
          fontSize: 12,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.12s ease',
        }}
      >
        <Unlink size={13} strokeWidth={1.75} />
        Detach Decorative Frame
      </button>
    </div>
  );
}
