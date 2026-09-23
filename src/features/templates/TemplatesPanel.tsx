import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Shuffle, Star } from 'lucide-react';
import { useAlbumStore } from '../../stores/albumStore';
import { useProjectStore } from '../../stores/projectStore';
import { useCarouselStore } from '../../stores/carouselStore';
import { getProjectDimensionsInCanvasUnit } from '../../domain/templates';
import {
  generateAdaptiveLayoutVariations,
  AdaptivePhoto,
  AdaptiveLayoutVariation,
} from '../../domain/adaptiveLayout';
import { generateDynamicVariations } from '../../domain/layout/generator';
import { PhotoFrameElement } from '../../domain/editor';
import {
  CAROUSEL_LAYOUT_PRESETS,
  CarouselLayoutPreset,
} from '../../domain/carouselLayout';
import { CarouselPhotoFrame } from '../../domain/carousel';
import styles from './TemplatesPanel.module.css';

interface AdaptiveVariationCardProps {
  variation: AdaptiveLayoutVariation;
  index: number;
  totalCount: number;
  isCurrent: boolean;
  totalW: number;
  totalH: number;
  spineX: number;
  onSelect: (index: number, name: string) => void;
}

export const AdaptiveVariationCardItem = React.memo(function AdaptiveVariationCardItem({
  variation,
  index,
  totalCount,
  isCurrent,
  totalW,
  totalH,
  spineX,
  onSelect,
}: AdaptiveVariationCardProps) {
  const aspect = totalW > 0 && totalH > 0 ? totalW / totalH : 2.0;
  const cardW = 140;
  const cardH = Math.round(Math.max(50, Math.min(100, 140 / aspect)));
  const scaleX = cardW / totalW;
  const scaleY = cardH / totalH;

  const svgRects = variation.rects
    .map(
      (r) =>
        `<rect class="${isCurrent ? styles.miniLayoutRectActive : styles.miniLayoutRect}" x="${(r.x * scaleX).toFixed(1)}" y="${(r.y * scaleY).toFixed(1)}" width="${(r.width * scaleX).toFixed(1)}" height="${(r.height * scaleY).toFixed(1)}" rx="2" fill="${isCurrent ? 'rgba(59, 130, 246, 0.40)' : 'rgba(255, 255, 255, 0.08)'}" stroke="${isCurrent ? '#3b82f6' : 'rgba(255, 255, 255, 0.22)'}" stroke-width="${isCurrent ? '1.5' : '1'}"/>`
    )
    .join('');

  const spine =
    spineX > 0
      ? `<line x1="${(spineX * scaleX).toFixed(1)}" y1="4" x2="${(spineX * scaleX).toFixed(1)}" y2="${cardH - 4}" stroke="rgba(255, 255, 255, 0.18)" stroke-dasharray="2 2" stroke-width="1"/>`
      : '';

  const svg = `<svg width="${cardW}" height="${cardH}" viewBox="0 0 ${cardW} ${cardH}" xmlns="http://www.w3.org/2000/svg"><rect width="${cardW}" height="${cardH}" rx="4" fill="#18181b"/>${spine}${svgRects}</svg>`;

  const scoreClass =
    variation.score !== undefined
      ? variation.score >= 85
        ? styles.scoreBadgeHigh
        : variation.score >= 70
          ? styles.scoreBadgeMedium
          : styles.scoreBadgeStandard
      : '';

  return (
    <div
      className={`${styles.templateCard} ${isCurrent ? styles.activeCard : ''}`}
      onClick={() => onSelect(index, variation.name)}
    >
      <div
        className={styles.svgWrapper}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className={styles.cardMeta}>
        <span className={styles.templateTitle}>{variation.name}</span>
        <span className={styles.templateDesc}>{variation.description}</span>
        <div className={styles.tagRow}>
          <span className={styles.indexBadge} title={`Layout ${index + 1} of ${totalCount}`}>#{index + 1}</span>
          {variation.score !== undefined && (
            <span className={`${styles.tagPill} ${scoreClass}`}>
              <Star size={10} strokeWidth={1.75} fill="currentColor" style={{ verticalAlign: 'middle', marginRight: 3 }} />
              {variation.score}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

interface TemplatesPanelProps {
  onApplyToast?: (msg: string) => void;
  activeMode?: 'print' | 'carousel';
}

export function TemplatesPanel({ onApplyToast, activeMode = 'print' }: TemplatesPanelProps) {
  // Album / Print Mode Hooks
  const {
    currentAlbum,
    activeSpreadId,
    spreadLayoutIndices,
    applyAdaptiveLayoutByIndex,
    cycleSpreadLayout,
    shuffleSpreadPhotos,
  } = useAlbumStore();

  const { currentProject } = useProjectStore();

  // Carousel Mode Hooks
  const currentCarousel = useCarouselStore((s) => s.currentCarousel);
  const activeSlideIndex = useCarouselStore((s) => s.activeSlideIndex);
  const slideLayoutIndices = useCarouselStore((s) => s.slideLayoutIndices);
  const applyCarouselLayout = useCarouselStore((s) => s.applyCarouselLayout);
  const shuffleSlidePhotos = useCarouselStore((s) => s.shuffleSlidePhotos);
  const cycleSlideLayout = useCarouselStore((s) => s.cycleSlideLayout);
  const applyDynamicSlideLayoutByIndex = useCarouselStore((s) => s.applyDynamicSlideLayoutByIndex);

  const [carouselCategory, setCarouselCategory] = useState<'dynamic' | 'panorama'>('dynamic');
  const [selectedCarouselPresetId, setSelectedCarouselPresetId] = useState<string | null>(null);

  // Active Spread (Print Mode)
  const activeSpread = useMemo(() => {
    if (!currentAlbum || !activeSpreadId) return null;
    if (currentAlbum.coverSpread && currentAlbum.coverSpread.id === activeSpreadId) {
      return currentAlbum.coverSpread;
    }
    return currentAlbum.spreads.find((s) => s.id === activeSpreadId) || currentAlbum.spreads[0] || null;
  }, [currentAlbum, activeSpreadId]);

  const unlockedElements = useMemo(() => {
    if (!activeSpread) return [];
    return activeSpread.elements.filter((el): el is PhotoFrameElement => el.type === 'photo' && !el.locked);
  }, [activeSpread]);

  const lockedElements = useMemo(() => {
    if (!activeSpread) return [];
    return activeSpread.elements.filter((el): el is PhotoFrameElement => el.type === 'photo' && Boolean(el.locked));
  }, [activeSpread]);

  const printPhotos: AdaptivePhoto[] = useMemo(() => {
    return unlockedElements.map((el) => ({
      id: el.id,
      photoId: el.photoId,
      filePath: el.filePath,
      fileName: el.fileName,
      previewPath: el.previewPath,
      thumbnailPath: el.thumbnailPath,
      photoAspect: el.photoAspect,
    }));
  }, [unlockedElements]);

  // Active Slide Photos (Carousel Mode)
  const activeSlide = useMemo(() => {
    if (!currentCarousel) return null;
    return currentCarousel.slides[activeSlideIndex] || currentCarousel.slides[0] || null;
  }, [currentCarousel, activeSlideIndex]);

  const carouselPhotos = useMemo(() => {
    if (!activeSlide) return [];
    return activeSlide.elements
      .filter((el): el is CarouselPhotoFrame => el.type === 'photo')
      .map((el) => ({
        id: el.id,
        photoId: el.photoId,
        filePath: el.filePath,
        fileName: el.fileName,
        previewPath: el.previewPath,
        thumbnailPath: el.thumbnailPath,
        photoAspect: el.photoAspect,
      }));
  }, [activeSlide]);

  const currentPhotoCount = activeMode === 'carousel' ? carouselPhotos.length : printPhotos.length;

  // Dynamic Adaptive Variations (Print Mode)
  const adaptiveVariations = useMemo(() => {
    if (!currentProject || !activeSpread || printPhotos.length === 0) return [];
    const isCover = currentAlbum?.coverSpread?.id === activeSpread.id;
    const isSpread = !isCover;
    const dims = getProjectDimensionsInCanvasUnit(currentProject, activeSpread);
    const spreadWidth = isCover
      ? (activeSpread.leftPage ? activeSpread.leftPage.width : dims.pageWidth) +
        (activeSpread.rightPage ? activeSpread.rightPage.width : 0) +
        dims.gutterWidth
      : dims.pageWidth * 2 + dims.gutterWidth;
    const spreadHeight = dims.pageHeight;

    return generateAdaptiveLayoutVariations(
      {
        spreadWidth,
        spreadHeight,
        isSpread,
        safeMargin: dims.safeMargin,
        safeMarginTop: dims.safeMarginTop,
        safeMarginBottom: dims.safeMarginBottom,
        safeMarginOutside: dims.safeMarginOutside,
        safeMarginSpine: dims.safeMarginSpine,
        gutterWidth: dims.gutterWidth,
        spacing: dims.spacing,
        lockedElements,
      },
      printPhotos
    );
  }, [currentProject, currentAlbum, activeSpread, printPhotos, lockedElements]);

  // Dynamic Layout Variations (Carousel Mode)
  const carouselVariations = useMemo(() => {
    if (!currentCarousel || !activeSlide || carouselPhotos.length === 0) return [];
    return generateDynamicVariations(
      {
        containerWidth: currentCarousel.slideWidthPx,
        containerHeight: currentCarousel.slideHeightPx,
        spacing: 16,
        isSpread: false,
      },
      carouselPhotos
    );
  }, [currentCarousel, activeSlide, carouselPhotos]);

  // Panorama Presets (Carousel Mode)
  const panoramaCarouselPresets = useMemo(() => {
    return CAROUSEL_LAYOUT_PRESETS.filter((p) => p.category === 'panorama');
  }, []);

  const currentActiveIndex =
    activeSpread && spreadLayoutIndices[activeSpread.id] !== undefined
      ? spreadLayoutIndices[activeSpread.id]
      : 0;

  // Windowed progressive rendering state (Initial 16 cards, expanding by 16 on demand)
  const [visibleCount, setVisibleCount] = useState<number>(16);

  // Reset visible window when spread changes or photo count changes
  useEffect(() => {
    setVisibleCount(Math.max(16, (currentActiveIndex || 0) + 8));
  }, [activeSpread?.id, currentPhotoCount]);

  // Ensure active card is always rendered if currentActiveIndex increments past visible window
  useEffect(() => {
    if (currentActiveIndex !== undefined && currentActiveIndex >= visibleCount) {
      setVisibleCount((prev) => Math.max(prev, currentActiveIndex + 8));
    }
  }, [currentActiveIndex, visibleCount]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      if (target.scrollHeight - target.scrollTop - target.clientHeight < 200) {
        setVisibleCount((prev) => Math.min(prev + 16, adaptiveVariations.length));
      }
    },
    [adaptiveVariations.length]
  );

  const handleApplyAdaptive = useCallback(
    (index: number, name: string) => {
      if (!activeSpread || !currentProject) return;
      applyAdaptiveLayoutByIndex(activeSpread.id, index, currentProject);
      if (onApplyToast) {
        onApplyToast(`Switched to layout: ${name}`);
      }
    },
    [activeSpread, currentProject, applyAdaptiveLayoutByIndex, onApplyToast]
  );

  const handleApplyCarouselPreset = (preset: CarouselLayoutPreset) => {
    if (!currentCarousel) return;
    setSelectedCarouselPresetId(preset.id);
    applyCarouselLayout(activeSlideIndex, preset.id, carouselPhotos);
    if (onApplyToast) {
      onApplyToast(`Switched to layout: ${preset.name}`);
    }
  };

  const handleCycleCarousel = (direction: 'next' | 'prev') => {
    if (carouselCategory === 'panorama') {
      if (panoramaCarouselPresets.length === 0) return;
      const currentIdx = panoramaCarouselPresets.findIndex((p) => p.id === selectedCarouselPresetId);
      const nextIdx =
        direction === 'next'
          ? (currentIdx + 1) % panoramaCarouselPresets.length
          : (currentIdx - 1 + panoramaCarouselPresets.length) % panoramaCarouselPresets.length;
      const nextPreset = panoramaCarouselPresets[nextIdx];
      if (nextPreset) {
        handleApplyCarouselPreset(nextPreset);
      }
    } else {
      if (carouselVariations.length === 0) return;
      cycleSlideLayout(direction);
      onApplyToast?.(`Layout variation cycled`);
    }
  };

  // Carousel Mode Rendering
  if (activeMode === 'carousel') {
    const totalSlides = currentCarousel?.totalSlides || 1;
    const slideW = currentCarousel?.slideWidthPx || 1080;
    const slideH = currentCarousel?.slideHeightPx || 1080;
    const currentSlideVariationIndex = slideLayoutIndices[activeSlideIndex] ?? 0;

    return (
      <div className={styles.container}>
        {/* Header with Active Slide Context Badge */}
        <div className={styles.filterHeader}>
          <div className={styles.spreadContextBadge}>
            <span>
              Active: <strong>Slide {activeSlideIndex + 1} of {totalSlides}</strong> ({slideW} × {slideH} px)
            </span>
            <span className={styles.badgeCount}>
              {carouselPhotos.length} {carouselPhotos.length === 1 ? 'Photo' : 'Photos'}
            </span>
          </div>

          {/* Navigation & Shuffle Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => handleCycleCarousel('prev')}
                title="Previous Layout (Shift + Space)"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <ChevronLeft size={12} strokeWidth={1.75} />
                <span>Prev Layout</span>
              </button>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => handleCycleCarousel('next')}
                title="Next Layout (Space)"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <span>Next Layout</span>
                <ChevronRight size={12} strokeWidth={1.75} />
              </button>
            </div>

            <button
              type="button"
              className={styles.shuffleBtn}
              onClick={() => {
                shuffleSlidePhotos(activeSlideIndex);
                onApplyToast?.('Shuffled photos on slide');
              }}
              title="Shuffle Photos (S)"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <Shuffle size={12} strokeWidth={1.75} />
              <span>Shuffle</span>
            </button>
          </div>
        </div>

        {/* Carousel Category Filter Tabs */}
        <div className={styles.modeToggleRow}>
          <button
            type="button"
            className={`${styles.modeBtn} ${carouselCategory === 'dynamic' ? styles.modeBtnActive : ''}`}
            onClick={() => setCarouselCategory('dynamic')}
          >
            Dynamic Layouts ({carouselPhotos.length > 0 ? carouselVariations.length : 0})
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${carouselCategory === 'panorama' ? styles.modeBtnActive : ''}`}
            onClick={() => setCarouselCategory('panorama')}
          >
            Seamless Panorama ({panoramaCarouselPresets.length})
          </button>
        </div>

        {/* Grid List */}
        {carouselCategory === 'dynamic' ? (
          carouselPhotos.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: '#94a3b8' }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>
                No photos on active slide
              </p>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>
                Drag photos from the filmstrip onto Slide {activeSlideIndex + 1} to generate dynamic studio layouts.
              </p>
            </div>
          ) : (
            <div className={styles.gridList}>
              {carouselVariations.map((variation, idx) => {
                const isCurrent = currentSlideVariationIndex === idx;
                return (
                  <AdaptiveVariationCardItem
                    key={`carousel-dyn-${idx}-${variation.name}`}
                    variation={variation}
                    index={idx}
                    totalCount={carouselVariations.length}
                    isCurrent={isCurrent}
                    totalW={slideW}
                    totalH={slideH}
                    spineX={-1}
                    onSelect={(index, name) => {
                      applyDynamicSlideLayoutByIndex(activeSlideIndex, index);
                      if (onApplyToast) {
                        onApplyToast(`Applied layout: ${name}`);
                      }
                    }}
                  />
                );
              })}
            </div>
          )
        ) : (
          <div className={styles.gridList}>
            {panoramaCarouselPresets.map((preset) => {
              const isSelected = selectedCarouselPresetId === preset.id;
              const svg = preset.previewSvg(currentCarousel?.ratio || '1:1');

              return (
                <div
                  key={preset.id}
                  className={`${styles.templateCard} ${isSelected ? styles.activeCard : ''}`}
                  onClick={() => handleApplyCarouselPreset(preset)}
                >
                  <div
                    className={styles.svgWrapper}
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                  <div className={styles.cardMeta}>
                    <span className={styles.templateTitle}>{preset.name}</span>
                    <span className={styles.templateDesc}>{preset.description}</span>
                    <div className={styles.tagRow}>
                      <span className={styles.tagPill}>
                        Panorama ({preset.spanSlides} slides)
                      </span>
                      <span
                        className={styles.tagPill}
                        style={{
                          background: 'rgba(59, 130, 246, 0.15)',
                          color: '#60a5fa',
                          fontWeight: 600,
                        }}
                      >
                        {preset.minPhotos === preset.maxPhotos
                          ? `${preset.minPhotos} ${preset.minPhotos === 1 ? 'photo' : 'photos'}`
                          : `${preset.minPhotos}–${preset.maxPhotos} photos`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Canvas Dimensions for Print Mode
  const dims = currentProject ? getProjectDimensionsInCanvasUnit(currentProject, activeSpread) : null;
  const isCover = currentAlbum?.coverSpread?.id === activeSpread?.id;
  const totalW = dims
    ? isCover
      ? (activeSpread?.leftPage ? activeSpread.leftPage.width : dims.pageWidth) +
        (activeSpread?.rightPage ? activeSpread.rightPage.width : 0) +
        dims.gutterWidth
      : dims.pageWidth * 2 + dims.gutterWidth
    : 400;
  const totalH = dims?.pageHeight || 200;
  const spineX = dims
    ? isCover && activeSpread?.leftPage
      ? activeSpread.leftPage.width + dims.gutterWidth / 2
      : dims.pageWidth + dims.gutterWidth / 2
    : 70;

  // Print Mode Rendering (High Contrast Studio Silhouettes & Progressive Windowing)
  return (
    <div className={styles.container}>
      {/* Header with Active Spread & Photos Count */}
      <div className={styles.filterHeader}>
        <div className={styles.spreadContextBadge}>
          <span>
            Active: <strong>{activeSpread?.name || 'Spread'}</strong>
          </span>
          <span className={styles.badgeCount}>
            {currentPhotoCount} {currentPhotoCount === 1 ? 'Photo' : 'Photos'}
          </span>
        </div>

        {currentPhotoCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => activeSpread && currentProject && cycleSpreadLayout(activeSpread.id, 'prev', currentProject)}
                title="Previous Layout (Shift + Space)"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <ChevronLeft size={12} strokeWidth={1.75} />
                <span>Prev Layout</span>
              </button>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => activeSpread && currentProject && cycleSpreadLayout(activeSpread.id, 'next', currentProject)}
                title="Next Layout (Space)"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <span>Next Layout</span>
                <ChevronRight size={12} strokeWidth={1.75} />
              </button>
            </div>

            <button
              type="button"
              className={styles.shuffleBtn}
              onClick={() => activeSpread && shuffleSpreadPhotos(activeSpread.id)}
              title="Shuffle Photos (S)"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <Shuffle size={12} strokeWidth={1.75} />
              <span>Shuffle</span>
            </button>
          </div>
        )}
      </div>

      {/* Adaptive Variations Grid (Windowed progressive rendering) */}
      <div className={styles.gridList} onScroll={handleScroll}>
        {adaptiveVariations.slice(0, visibleCount).map((variation, index) => {
          const isCurrent = index === ((currentActiveIndex ?? 0) % (adaptiveVariations.length || 1));
          return (
            <AdaptiveVariationCardItem
              key={variation.id}
              variation={variation}
              index={index}
              totalCount={adaptiveVariations.length}
              isCurrent={isCurrent}
              totalW={totalW}
              totalH={totalH}
              spineX={spineX}
              onSelect={handleApplyAdaptive}
            />
          );
        })}
      </div>

      {adaptiveVariations.length === 0 && (
        <div className={styles.emptyState}>
          <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>
            {currentPhotoCount > 0 ? 'No Layout Variations for Available Space' : 'No Photos on Active Spread'}
          </p>
          <p>
            {currentPhotoCount > 0
              ? 'The remaining free space around locked frames is too constrained to fit all unlocked photos. Try unlocking a frame or resizing locked frames.'
              : 'Drag photos from the tray onto the canvas to generate Smart Layout variations automatically.'}
          </p>
        </div>
      )}
    </div>
  );
}
