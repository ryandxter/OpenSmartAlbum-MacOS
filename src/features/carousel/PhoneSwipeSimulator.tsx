import { useRef, useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Smartphone } from 'lucide-react';
import { useCarouselStore } from '../../stores/carouselStore';
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
    const slideWidth = viewportRef.current.clientWidth;
    if (slideWidth > 0) {
      const activeIdx = Math.round(scrollLeft / slideWidth);
      if (activeIdx !== currentSlideIndex) {
        setCurrentSlideIndex(activeIdx);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Phone Swipe Simulator">
      {/* Modal Header */}
      <div className={styles.modalHeader}>
        <div className={styles.titleGroup}>
          <Smartphone size={18} strokeWidth={1.5} />
          <div>
            <h3 className={styles.title}>Instagram Swipe Simulator</h3>
            <p className={styles.subtitle}>Test seamless panorama transitions between slides</p>
          </div>
        </div>

        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          title="Close Simulator (Esc)"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* Phone Mockup Frame */}
      <div className={styles.phoneFrame}>
        {/* Dynamic Island / Notch */}
        <div className={styles.notch} />

        {/* Mock App Header */}
        <div className={styles.appHeader}>
          <span>OpenSmartAlbum</span>
          <span style={{ fontSize: 11, opacity: 0.7 }}>
            {currentSlideIndex + 1}/{totalSlides}
          </span>
        </div>

        {/* Carousel Swipe Viewport */}
        <div
          ref={viewportRef}
          className={styles.carouselViewport}
          onScroll={handleScroll}
        >
          {slides.map((slide, idx) => {
            return (
              <div key={slide.id} className={styles.slideItem}>
                <div
                  className={styles.slideSurface}
                  style={{
                    backgroundColor: slide.backgroundColor || '#FFFFFF',
                    aspectRatio: currentCarousel ? `${currentCarousel.slideWidthPx} / ${currentCarousel.slideHeightPx}` : '1 / 1',
                  }}
                >
                  {/* Photo Frames inside slide */}
                  {slide.elements
                    .filter((el) => el.type === 'photo')
                    .map((photoFrame) => {
                      const displaySrc = photoFrame.previewPath || photoFrame.thumbnailPath || '';
                      let src = displaySrc;
                      if (displaySrc) {
                        try {
                          src = convertFileSrc(displaySrc);
                        } catch {
                          src = displaySrc;
                        }
                      }

                      // Position relative to slide
                      const slideX = idx * (currentCarousel?.slideWidthPx || 1080);
                      const relX = photoFrame.x - slideX;
                      const slideW = currentCarousel?.slideWidthPx || 1080;
                      const slideH = currentCarousel?.slideHeightPx || 1080;

                      const leftPct = (relX / slideW) * 100;
                      const topPct = (photoFrame.y / slideH) * 100;
                      const widthPct = (photoFrame.width / slideW) * 100;
                      const heightPct = (photoFrame.height / slideH) * 100;

                      return (
                        <div
                          key={photoFrame.id}
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
