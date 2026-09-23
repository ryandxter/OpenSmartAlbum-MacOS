import { useRef, useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Smartphone } from 'lucide-react';
import { useCarouselStore } from '../../stores/carouselStore';
import { getSlideIntersectingFrames } from '../../domain/carousel';
import { convertFileSrc } from '@tauri-apps/api/core';
import styles from './PhoneSwipeSimulator.module.css';

interface PhoneSwipeSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PhoneSwipeSimulator({ isOpen, onClose }: PhoneSwipeSimulatorProps) {
  const currentCarousel = useCarouselStore((s) => s.currentCarousel);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const slides = currentCarousel?.slides || [];
  const totalSlides = slides.length;
  const allFrames = slides.flatMap((s) => s.elements.filter((el) => el.type === 'photo'));

  const scrollToSlide = useCallback((index: number) => {
    if (!viewportRef.current) return;
    const clamped = Math.max(0, Math.min(totalSlides - 1, index));
    viewportRef.current.scrollTo({
      left: clamped * viewportRef.current.clientWidth,
      behavior: 'smooth',
    });
    setCurrentSlideIndex(clamped);
  }, [totalSlides]);

  // Handle keyboard navigation (Left/Right arrow, Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        scrollToSlide(currentSlideIndex - 1);
      } else if (e.key === 'ArrowRight') {
        scrollToSlide(currentSlideIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentSlideIndex, scrollToSlide, onClose]);

  // Handle scroll events inside phone viewport to update active dot
  const handleScroll = () => {
    if (!viewportRef.current) return;
    const scrollLeft = viewportRef.current.scrollLeft;
    const width = viewportRef.current.clientWidth;
    if (width > 0) {
      const page = Math.round(scrollLeft / width);
      setCurrentSlideIndex(page);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.simulatorBackdrop} onClick={onClose}>
      <div className={styles.phoneChassis} onClick={(e) => e.stopPropagation()}>
        {/* Top Speaker / Dynamic Island Notch */}
        <div className={styles.phoneNotch}>
          <div className={styles.speakerPill} />
          <div className={styles.cameraDot} />
        </div>

        {/* Header inside Phone Screen */}
        <div className={styles.phoneHeader}>
          <div className={styles.headerLeft}>
            <Smartphone size={15} strokeWidth={1.5} className={styles.phoneIcon} />
            <span className={styles.accountName}>Feed Preview</span>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close phone simulator"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {/* Slide Counter Indicator */}
        <div className={styles.slideIndicator}>
          <span>
            {currentSlideIndex + 1} / {totalSlides}
          </span>
        </div>

        {/* Carousel Swipe Viewport */}
        <div
          ref={viewportRef}
          className={styles.carouselViewport}
          onScroll={handleScroll}
        >
          {slides.map((slide, idx) => {
            const slideW = currentCarousel?.slideWidthPx || 1080;
            const slideH = currentCarousel?.slideHeightPx || 1080;
            const intersectingFrames = getSlideIntersectingFrames(allFrames, idx, slideW);

            return (
              <div key={slide.id} className={styles.slideItem}>
                <div
                  className={styles.slideSurface}
                  style={{
                    backgroundColor: slide.backgroundColor || '#FFFFFF',
                    aspectRatio: currentCarousel ? `${currentCarousel.slideWidthPx} / ${currentCarousel.slideHeightPx}` : '1 / 1',
                  }}
                >
                  {/* Photo Frames intersecting slide (including multi-slide spanning panoramas) */}
                  {intersectingFrames.map(({ frame: photoFrame, localX }) => {
                    const displaySrc = photoFrame.previewPath || photoFrame.thumbnailPath || '';
                    let src = displaySrc;
                    if (displaySrc) {
                      try {
                        src = convertFileSrc(displaySrc);
                      } catch {
                        src = displaySrc;
                      }
                    }
                    const leftPct = (localX / slideW) * 100;
                    const topPct = (photoFrame.y / slideH) * 100;
                    const widthPct = (photoFrame.width / slideW) * 100;
                    const heightPct = (photoFrame.height / slideH) * 100;

                    return (
                      <div
                        key={photoFrame.id}
                        className={styles.photoFrame}
                        style={{
                          position: 'absolute',
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          width: `${widthPct}%`,
                          height: `${heightPct}%`,
                          backgroundColor: '#1E1E22',
                          overflow: 'hidden',
                          borderRadius: photoFrame.cornerRadius ? `${photoFrame.cornerRadius}px` : undefined,
                        }}
                      >
                          {src && (
                            <img
                              src={src}
                              alt=""
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                pointerEvents: 'none',
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation Arrows */}
        {currentSlideIndex > 0 && (
          <button
            type="button"
            className={`${styles.navArrow} ${styles.navArrowLeft}`}
            onClick={() => scrollToSlide(currentSlideIndex - 1)}
            title="Previous Slide (←)"
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
        )}

        {currentSlideIndex < totalSlides - 1 && (
          <button
            type="button"
            className={`${styles.navArrow} ${styles.navArrowRight}`}
            onClick={() => scrollToSlide(currentSlideIndex + 1)}
            title="Next Slide (→)"
          >
            <ChevronRight size={16} strokeWidth={2} />
          </button>
        )}

        {/* Bottom Pagination Dots */}
        <div className={styles.dotsContainer}>
          {slides.map((_, idx) => (
            <div
              key={idx}
              className={`${styles.dot} ${currentSlideIndex === idx ? styles.dotActive : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
