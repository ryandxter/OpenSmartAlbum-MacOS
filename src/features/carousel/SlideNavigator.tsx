import { useMemo } from 'react';
import {
  Plus,
  Copy,
  Trash2,
  Smartphone,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useCarouselStore } from '../../stores/carouselStore';
import {
  CarouselRatio,
  CarouselSlide,
  CarouselPhotoFrame,
  MAX_CAROUSEL_SLIDES,
  MIN_CAROUSEL_SLIDES,
  getSlideIntersectingFrames,
} from '../../domain/carousel';
import styles from './SlideNavigator.module.css';

function safeConvertFileSrc(filePath: string): string {
  try {
    return convertFileSrc(filePath);
  } catch {
    return filePath;
  }
}

interface MiniSlidePreviewProps {
  slide: CarouselSlide;
  slideIndex: number;
  slideWidth: number;
  slideHeight: number;
  allFrames: CarouselPhotoFrame[];
}

function MiniSlidePreview({ slide, slideIndex, slideWidth, slideHeight, allFrames }: MiniSlidePreviewProps) {
  const intersectingFrames = getSlideIntersectingFrames(allFrames, slideIndex, slideWidth);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: slide.backgroundColor || '#FFFFFF',
        overflow: 'hidden',
      }}
    >
      {intersectingFrames.map(({ frame, localX }) => {
        const leftPct = (localX / slideWidth) * 100;
        const topPct = (frame.y / slideHeight) * 100;
        const widthPct = (frame.width / slideWidth) * 100;
        const heightPct = (frame.height / slideHeight) * 100;
        const imgSrc = frame.thumbnailPath || frame.previewPath || frame.filePath;

        return (
          <div
            key={frame.id}
            style={{
              position: 'absolute',
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: `${widthPct}%`,
              height: `${heightPct}%`,
              overflow: 'hidden',
              backgroundColor: '#27272A',
              borderRadius: frame.cornerRadius ? `${frame.cornerRadius * 0.08}px` : undefined,
            }}
          >
            {imgSrc && (
              <img
                src={safeConvertFileSrc(imgSrc)}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  pointerEvents: 'none',
                }}
                loading="lazy"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface SlideNavigatorProps {
  onOpenSimulator: () => void;
}

export function SlideNavigator({ onOpenSimulator }: SlideNavigatorProps) {
  const currentCarousel = useCarouselStore((s) => s.currentCarousel);
  const activeSlideIndex = useCarouselStore((s) => s.activeSlideIndex);
  const setActiveSlide = useCarouselStore((s) => s.setActiveSlide);
  const addSlide = useCarouselStore((s) => s.addSlide);
  const duplicateSlide = useCarouselStore((s) => s.duplicateSlide);
  const deleteSlide = useCarouselStore((s) => s.deleteSlide);
  const reorderSlide = useCarouselStore((s) => s.reorderSlide);
  const setRatio = useCarouselStore((s) => s.setRatio);

  const slides = currentCarousel?.slides || [];
  const totalSlides = slides.length;
  const isAtMax = totalSlides >= MAX_CAROUSEL_SLIDES;
  const isAtMin = totalSlides <= MIN_CAROUSEL_SLIDES;

  const currentRatio = currentCarousel?.ratio || '1:1';
  const slideWidth = currentCarousel?.slideWidthPx || 1080;
  const slideHeight = currentCarousel?.slideHeightPx || 1080;

  const allFrames: CarouselPhotoFrame[] = useMemo(() => {
    if (!currentCarousel) return [];
    return currentCarousel.slides.flatMap((s) => s.elements.filter((el): el is CarouselPhotoFrame => el.type === 'photo'));
  }, [currentCarousel]);

  return (
    <nav className={styles.navigatorContainer} aria-label="Carousel Slide Navigator">
      {/* Slides Thumbnail Track */}
      <div className={styles.slidesTrack}>
        {slides.map((slide, idx) => {
          const isActive = activeSlideIndex === idx;
          const photoCount = slide.elements.filter((el) => el.type === 'photo').length;

          return (
            <div
              key={slide.id}
              className={`${styles.slideCard} ${isActive ? styles.slideCardActive : ''}`}
              style={{
                aspectRatio: `${slideWidth} / ${slideHeight}`,
              }}
              onClick={() => setActiveSlide(idx)}
              title={`Slide ${idx + 1} (${photoCount} photo${photoCount === 1 ? '' : 's'})`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setActiveSlide(idx);
                }
              }}
            >
              {/* Mini Slide Preview Rendering Photos */}
              <MiniSlidePreview
                slide={slide}
                slideIndex={idx}
                slideWidth={slideWidth}
                slideHeight={slideHeight}
                allFrames={allFrames}
              />

              {/* Slide Number Badge */}
              <span className={styles.slideNumberBadge}>{idx + 1}</span>
            </div>
          );
        })}
      </div>

      {/* Slide Navigation & Action Controls */}
      <div className={styles.actionSection}>
        {/* Aspect Ratio Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {(['1:1', '4:5', '9:16'] as CarouselRatio[]).map((r) => (
            <button
              key={r}
              type="button"
              className={styles.actionBtn}
              style={{
                padding: '4px 8px',
                fontSize: 11,
                backgroundColor: currentRatio === r ? 'var(--color-bg-surface, #2D2D32)' : 'transparent',
                borderColor: currentRatio === r ? 'var(--color-accent, #E4E4E7)' : 'var(--color-border-subtle, #2E2E33)',
              }}
              onClick={() => setRatio(r)}
              title={`Switch ratio to ${r}`}
            >
              {r}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 24, backgroundColor: 'var(--color-border-subtle, #2E2E33)' }} />

        {/* Move Left / Right */}
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => {
            if (activeSlideIndex > 0) {
              reorderSlide(activeSlideIndex, activeSlideIndex - 1);
            }
          }}
          disabled={activeSlideIndex === 0}
          title="Move Active Slide Left"
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
        </button>

        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => {
            if (activeSlideIndex < totalSlides - 1) {
              reorderSlide(activeSlideIndex, activeSlideIndex + 1);
            }
          }}
          disabled={activeSlideIndex >= totalSlides - 1}
          title="Move Active Slide Right"
        >
          <ChevronRight size={13} strokeWidth={1.5} />
        </button>

        {/* Duplicate Active Slide */}
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => duplicateSlide(activeSlideIndex)}
          disabled={isAtMax}
          title="Duplicate Active Slide"
        >
          <Copy size={13} strokeWidth={1.5} />
        </button>

        {/* Delete Active Slide */}
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => deleteSlide(activeSlideIndex)}
          disabled={isAtMin}
          title="Delete Active Slide"
        >
          <Trash2 size={13} strokeWidth={1.5} />
        </button>

        {/* Add Slide Button */}
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => addSlide()}
          disabled={isAtMax}
          title={isAtMax ? 'Maximum 10 slides reached' : 'Add New Slide'}
        >
          <Plus size={13} strokeWidth={1.5} />
          <span>Add Slide</span>
          <span style={{ fontSize: 10, opacity: 0.7 }}>({totalSlides}/10)</span>
        </button>

        <div style={{ width: 1, height: 24, backgroundColor: 'var(--color-border-subtle, #2E2E33)' }} />

        {/* Phone Swipe Simulator Preview Button */}
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.previewBtn}`}
          onClick={onOpenSimulator}
          title="Open Mobile Swipe Simulator"
        >
          <Smartphone size={13} strokeWidth={1.5} />
          <span>Phone Simulator</span>
        </button>
      </div>
    </nav>
  );
}
