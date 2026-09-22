import {
  Plus,
  Copy,
  Trash2,
  Smartphone,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useCarouselStore } from '../../stores/carouselStore';
import { CarouselRatio, MAX_CAROUSEL_SLIDES, MIN_CAROUSEL_SLIDES } from '../../domain/carousel';
import styles from './SlideNavigator.module.css';

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
              style={{ backgroundColor: slide.backgroundColor || '#FFFFFF' }}
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
