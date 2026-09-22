import { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect, Line, Text as KonvaText, Group, Image as KonvaImage, Transformer } from 'react-konva';
import Konva from 'konva';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useCarouselStore } from '../../stores/carouselStore';
import {
  CarouselPhotoFrame,
  getCarouselTotalWidth,
  getSlideXOffset,
  getSlideIndexAtX,
} from '../../domain/carousel';
import styles from './CarouselCanvas.module.css';

interface CarouselCanvasProps {
  zoomLevel: number;
  fitTrigger?: number;
  onZoomChange?: (updater: (prev: number) => number) => void;
  onToast?: (msg: string) => void;
}

// Bounded LRU Image Cache for Carousel Canvas
const MAX_CAROUSEL_CACHE = 32;
const carouselImageCache = new Map<string, HTMLImageElement>();

function getCachedImage(src: string): HTMLImageElement | null {
  const img = carouselImageCache.get(src);
  if (img) {
    carouselImageCache.delete(src);
    carouselImageCache.set(src, img);
    return img;
  }
  return null;
}

function setCachedImage(src: string, img: HTMLImageElement) {
  if (carouselImageCache.has(src)) {
    carouselImageCache.delete(src);
  } else if (carouselImageCache.size >= MAX_CAROUSEL_CACHE) {
    const oldest = carouselImageCache.keys().next().value;
    if (oldest) {
      const evicted = carouselImageCache.get(oldest);
      if (evicted) {
        evicted.onload = null;
        evicted.onerror = null;
        evicted.src = '';
      }
      carouselImageCache.delete(oldest);
    }
  }
  carouselImageCache.set(src, img);
}

// Individual Photo Frame Node in Carousel
function CarouselFrameNode({
  frame,
  isSelected,
  onSelect,
  onChange,
}: {
  frame: CarouselPhotoFrame;
  isSelected: boolean;
  onSelect: (e: Konva.KonvaEventObject<any>) => void;
  onChange: (updates: Partial<CarouselPhotoFrame>) => void;
}) {
  const shapeRef = useRef<Konva.Group>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  const displaySrc = frame.previewPath || frame.thumbnailPath || '';

  useEffect(() => {
    if (!displaySrc) {
      setImageObj(null);
      return;
    }

    let url = displaySrc;
    try {
      url = convertFileSrc(displaySrc);
    } catch {
      url = displaySrc;
    }

    const cached = getCachedImage(url);
    if (cached && cached.complete && cached.naturalWidth > 0) {
      setImageObj(cached);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => {
      setCachedImage(url, img);
      setImageObj(img);
    };
    img.onerror = () => {
      setImageObj(null);
    };
  }, [displaySrc]);

  return (
    <Group
      ref={shapeRef}
      id={frame.id}
      x={frame.x}
      y={frame.y}
      width={frame.width}
      height={frame.height}
      rotation={frame.rotation || 0}
      draggable={!frame.locked}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        onChange({
          x: Math.round(e.target.x()),
          y: Math.round(e.target.y()),
        });
      }}
    >
      {/* Background / Placeholder */}
      <Rect
        width={frame.width}
        height={frame.height}
        fill={imageObj ? '#000000' : '#27272A'}
        stroke={isSelected ? '#E4E4E7' : undefined}
        strokeWidth={isSelected ? 2 : 0}
        cornerRadius={frame.cornerRadius || 0}
      />

      {/* Render Image if loaded */}
      {imageObj && (
        <KonvaImage
          image={imageObj}
          width={frame.width}
          height={frame.height}
          cornerRadius={frame.cornerRadius || 0}
        />
      )}

      {/* Frame boundary indication if selected */}
      {isSelected && (
        <Rect
          width={frame.width}
          height={frame.height}
          stroke="#E4E4E7"
          strokeWidth={1.5}
          dash={[4, 4]}
          listening={false}
        />
      )}
    </Group>
  );
}

export function CarouselCanvas({
  zoomLevel,
  fitTrigger,
  onZoomChange,
}: CarouselCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const currentCarousel = useCarouselStore((s) => s.currentCarousel);
  const activeSlideIndex = useCarouselStore((s) => s.activeSlideIndex);
  const setActiveSlide = useCarouselStore((s) => s.setActiveSlide);
  const showSliceGuides = useCarouselStore((s) => s.showSliceGuides);
  const updatePhotoFrame = useCarouselStore((s) => s.updatePhotoFrame);

  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [stagePos, setStagePos] = useState({ x: 40, y: 40 });
  const [isSpacePanning, setIsSpacePanning] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const totalWidth = currentCarousel ? getCarouselTotalWidth(currentCarousel) : 1080;
  const totalHeight = currentCarousel?.slideHeightPx ?? 1080;
  const slideWidth = currentCarousel?.slideWidthPx ?? 1080;

  const scale = zoomLevel / 100;

  // Center / Fit to screen
  const fitToScreen = useCallback(() => {
    if (!containerRef.current || !currentCarousel) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    if (cw <= 0 || ch <= 0) return;

    const pad = 60;
    const availW = cw - pad * 2;
    const availH = ch - pad * 2;

    const fitScale = Math.min(availW / totalWidth, availH / totalHeight);
    const newZoom = Math.max(10, Math.min(300, Math.round(fitScale * 100)));

    if (onZoomChange) {
      onZoomChange(() => newZoom);
    }

    const stageW = totalWidth * (newZoom / 100);
    const stageH = totalHeight * (newZoom / 100);
    setStagePos({
      x: Math.max(pad, (cw - stageW) / 2),
      y: Math.max(pad, (ch - stageH) / 2),
    });
  }, [currentCarousel, totalWidth, totalHeight, onZoomChange]);

  useEffect(() => {
    fitToScreen();
  }, [fitTrigger]);

  // Spacebar pan listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        setIsSpacePanning(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePanning(false);
        setIsMouseDown(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Continuous wheel / trackpad pinch zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rawDelta = e.deltaY;
        let deltaZoom = 0;
        if (e.deltaMode === WheelEvent.DOM_DELTA_PIXEL && Math.abs(rawDelta) < 35) {
          const factor = Math.exp(-rawDelta * 0.006);
          deltaZoom = (zoomLevel * factor) - zoomLevel;
        } else {
          deltaZoom = rawDelta > 0 ? -10 : 10;
        }

        if (onZoomChange) {
          onZoomChange((prev) => Math.max(25, Math.min(350, Math.round(prev + deltaZoom))));
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [zoomLevel, onZoomChange]);

  // Collect all elements from all slides
  const allFrames: CarouselPhotoFrame[] = currentCarousel
    ? currentCarousel.slides.flatMap((s) => s.elements.filter((el): el is CarouselPhotoFrame => el.type === 'photo'))
    : [];

  // Update Transformer selection
  useEffect(() => {
    if (!trRef.current || !stageRef.current) return;
    if (selectedFrameId) {
      const node = stageRef.current.findOne(`#${selectedFrameId}`);
      if (node) {
        trRef.current.nodes([node]);
        trRef.current.getLayer()?.batchDraw();
        return;
      }
    }
    trRef.current.nodes([]);
    trRef.current.getLayer()?.batchDraw();
  }, [selectedFrameId]);

  return (
    <div
      ref={containerRef}
      className={`${styles.canvasContainer} ${isSpacePanning ? styles.panningMode : ''}`}
      onMouseDown={(e) => {
        if (isSpacePanning || e.button === 1) {
          setIsMouseDown(true);
          dragStartRef.current = { x: e.clientX - stagePos.x, y: e.clientY - stagePos.y };
        }
      }}
      onMouseMove={(e) => {
        if (isMouseDown && dragStartRef.current) {
          setStagePos({
            x: e.clientX - dragStartRef.current.x,
            y: e.clientY - dragStartRef.current.y,
          });
        }
      }}
      onMouseUp={() => {
        setIsMouseDown(false);
        dragStartRef.current = null;
      }}
    >
      <div className={styles.stageWrapper}>
        <Stage
          ref={stageRef}
          width={Math.max(window.innerWidth, totalWidth * scale + 200)}
          height={Math.max(window.innerHeight, totalHeight * scale + 200)}
          scaleX={scale}
          scaleY={scale}
          x={stagePos.x}
          y={stagePos.y}
          onClick={(e) => {
            if (e.target === e.target.getStage()) {
              setSelectedFrameId(null);
            }
          }}
        >
          {/* Layer 1: Background & Slide Surfaces */}
          <Layer>
            {/* Master Continuous Canvas Drop Shadow */}
            <Rect
              x={0}
              y={0}
              width={totalWidth}
              height={totalHeight}
              fill="#000000"
              shadowColor="rgba(0, 0, 0, 0.4)"
              shadowBlur={30}
              shadowOffset={{ x: 0, y: 15 }}
              shadowOpacity={0.6}
            />

            {/* Individual Slide Backgrounds */}
            {currentCarousel?.slides.map((slide, idx) => (
              <Group
                key={slide.id}
                x={getSlideXOffset(currentCarousel, idx)}
                y={0}
                onClick={() => setActiveSlide(idx)}
                onTap={() => setActiveSlide(idx)}
              >
                <Rect
                  width={slideWidth}
                  height={totalHeight}
                  fill={slide.backgroundColor || '#FFFFFF'}
                />

                {/* Active Slide Subtle Highlight */}
                {activeSlideIndex === idx && (
                  <Rect
                    width={slideWidth}
                    height={totalHeight}
                    stroke="#E4E4E7"
                    strokeWidth={2}
                    listening={false}
                  />
                )}
              </Group>
            ))}
          </Layer>

          {/* Layer 2: Interactive Photo Frames (Seamless across slides) */}
          <Layer>
            {allFrames.map((frame) => (
              <CarouselFrameNode
                key={frame.id}
                frame={frame}
                isSelected={selectedFrameId === frame.id}
                onSelect={(e) => {
                  e.cancelBubble = true;
                  setSelectedFrameId(frame.id);
                  // Auto-switch active slide to whichever slide frame's center sits on
                  if (currentCarousel) {
                    const centerX = frame.x + frame.width / 2;
                    const targetIdx = getSlideIndexAtX(currentCarousel, centerX);
                    setActiveSlide(targetIdx);
                  }
                }}
                onChange={(updates) => {
                  updatePhotoFrame(frame.id, updates);
                }}
              />
            ))}

            {/* Selection Transformer */}
            <Transformer
              ref={trRef}
              rotateEnabled={true}
              keepRatio={false}
              borderStroke="#E4E4E7"
              borderStrokeWidth={1.5}
              anchorFill="#FFFFFF"
              anchorStroke="#18181B"
              anchorCornerRadius={2}
              anchorSize={8}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 20 || newBox.height < 20) {
                  return oldBox;
                }
                return newBox;
              }}
            />
          </Layer>

          {/* Layer 3: Slice Boundary Guides & Slide Number Badges (Overlay) */}
          {showSliceGuides && (
            <Layer listening={false}>
              {currentCarousel?.slides.map((slide, idx) => {
                const xOffset = getSlideXOffset(currentCarousel, idx);
                return (
                  <Group key={`guide-${slide.id}`} x={xOffset} y={0}>
                    {/* Vertical Boundary Line between slides (except at x=0) */}
                    {idx > 0 && (
                      <Line
                        points={[0, 0, 0, totalHeight]}
                        stroke="rgba(255, 255, 255, 0.4)"
                        strokeWidth={1.5}
                        dash={[6, 6]}
                      />
                    )}

                    {/* Slide Top Badge Header */}
                    <Group x={12} y={12}>
                      <Rect
                        width={74}
                        height={22}
                        fill="rgba(0, 0, 0, 0.65)"
                        cornerRadius={4}
                      />
                      <KonvaText
                        text={`Slide ${idx + 1}`}
                        x={10}
                        y={5}
                        fill="#F4F4F5"
                        fontSize={11}
                        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
                        fontStyle="500"
                      />
                    </Group>
                  </Group>
                );
              })}
            </Layer>
          )}
        </Stage>
      </div>
    </div>
  );
}
