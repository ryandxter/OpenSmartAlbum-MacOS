import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Circle, Line, Text as KonvaText, Group, Image as KonvaImage, Transformer, Path as KonvaPath } from 'react-konva';
import Konva from 'konva';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Maximize2, Star, RotateCcw, Trash2 } from 'lucide-react';
import { ContextMenu, ContextMenuItem } from '../../components/ui';
import { useCarouselStore } from '../../stores/carouselStore';
import { usePhotoStore } from '../../stores/photoStore';
import {
  CarouselPhotoFrame,
  CarouselTextFrame,
  getCarouselTotalWidth,
  getSlideXOffset,
  getSlideIndexAtX,
} from '../../domain/carousel';
import { drawShapeToContext, getShapeSvgPath } from '../../domain/shapes';
import { calculateImageOffset } from '../../domain/editor';
import { DEFAULT_TEXT_STYLE } from '../../domain/text';
import { DividerOverlayLayer } from '../editor/DividerOverlayLayer';
import { TextInlineEditor } from '../editor/TextInlineEditor';
import { CarouselTextNode } from './CarouselTextNode';
import { extractCanvasDividers, findPhotoSwapTarget, RectFrameInput } from '../../domain/layout/dividerGraph';
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
  onContextMenu,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  frame: CarouselPhotoFrame;
  isSelected: boolean;
  onSelect: (e: Konva.KonvaEventObject<any>) => void;
  onChange: (updates: Partial<CarouselPhotoFrame>) => void;
  onContextMenu?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (e: Konva.KonvaEventObject<DragEvent>) => void;
}) {
  const shapeRef = useRef<Konva.Group>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  const displaySrc = frame.previewPath || frame.thumbnailPath || frame.filePath || '';

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
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        const naturalAspect = img.naturalWidth / img.naturalHeight;
        if (!frame.photoAspect || Math.abs(frame.photoAspect - naturalAspect) > 0.01) {
          useCarouselStore.getState().updatePhotoFrame(frame.id, { photoAspect: naturalAspect });
        }
      }
    };
    img.onerror = () => {
      setImageObj(null);
    };
  }, [displaySrc, frame.id, frame.photoAspect]);

  const cornerRadiiArray: [number, number, number, number] = [
    frame.cornerRadiusTl ?? frame.cornerRadius ?? 0,
    frame.cornerRadiusTr ?? frame.cornerRadius ?? 0,
    frame.cornerRadiusBr ?? frame.cornerRadius ?? 0,
    frame.cornerRadiusBl ?? frame.cornerRadius ?? 0,
  ];
  const hasRounding = cornerRadiiArray.some((r) => r > 0);
  const strokePx = Math.max(1, Math.round(frame.borderWidth || 1));
  const strokeDash = frame.borderStyle === 'dashed' ? [strokePx * 2.5, strokePx * 1.5] : undefined;

  // Real natural photo aspect ratio from loaded image or frame metadata
  const naturalAspect = (imageObj && imageObj.naturalWidth > 0 && imageObj.naturalHeight > 0)
    ? imageObj.naturalWidth / imageObj.naturalHeight
    : (frame.photoAspect && frame.photoAspect > 0 ? frame.photoAspect : 1.0);

  // Proportional aspect-cover fit geometry and centered offset inside frame
  const { offsetX, offsetY, width: imgW, height: imgH } = calculateImageOffset(
    frame.width,
    frame.height,
    naturalAspect,
    frame.cropScale || 1.0,
    frame.cropX || 0,
    frame.cropY || 0
  );

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
      onContextMenu={(e) => {
        e.evt.preventDefault();
        e.cancelBubble = true;
        onContextMenu?.(e);
      }}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd || ((e) => {
        onChange({
          x: Math.round(e.target.x()),
          y: Math.round(e.target.y()),
        });
      })}
    >
      {/* Clipped Photo Viewport */}
      <Group
        clipFunc={(ctx) => {
          if (frame.shapeType && frame.shapeType !== 'rectangle') {
            drawShapeToContext(ctx, frame.shapeType, frame.width, frame.height, cornerRadiiArray, frame.customSvgPath);
          } else if (hasRounding && typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(0, 0, frame.width, frame.height, cornerRadiiArray);
          } else if (hasRounding) {
            const [tl, tr, br, bl] = cornerRadiiArray;
            ctx.beginPath();
            ctx.moveTo(tl, 0);
            ctx.lineTo(frame.width - tr, 0);
            ctx.arcTo(frame.width, 0, frame.width, tr, tr);
            ctx.lineTo(frame.width, frame.height - br);
            ctx.arcTo(frame.width, frame.height, frame.width - br, frame.height, br);
            ctx.lineTo(bl, frame.height);
            ctx.arcTo(0, frame.height, 0, frame.height - bl, bl);
            ctx.lineTo(0, tl);
            ctx.arcTo(0, 0, tl, 0, tl);
            ctx.closePath();
          } else {
            ctx.rect(0, 0, frame.width, frame.height);
          }
        }}
      >
        {/* Background / Placeholder */}
        <Rect
          width={frame.width}
          height={frame.height}
          fill={imageObj ? '#000000' : '#27272A'}
          listening={false}
        />

        {/* Render Image with proportional Aspect-Cover Fit */}
        {imageObj && (
          <KonvaImage
            image={imageObj}
            x={offsetX}
            y={offsetY}
            width={imgW}
            height={imgH}
          />
        )}
      </Group>

      {/* Frame Border (Vector Contour or Rounded/Rect stroke) */}
      {frame.borderEnabled && (() => {
        const isCustomShape = frame.shapeType && frame.shapeType !== 'rectangle' && frame.shapeType !== 'rounded';
        if (isCustomShape) {
          const pathData = getShapeSvgPath(frame.shapeType as any, frame.width, frame.height, cornerRadiiArray, frame.customSvgPath);
          return (
            <KonvaPath
              data={pathData}
              stroke={frame.borderColor || '#FFFFFF'}
              strokeWidth={strokePx}
              dash={strokeDash}
              strokeScaleEnabled={false}
              listening={false}
            />
          );
        }

        const borderRadii: [number, number, number, number] = [
          Math.max(0, cornerRadiiArray[0] - strokePx / 2),
          Math.max(0, cornerRadiiArray[1] - strokePx / 2),
          Math.max(0, cornerRadiiArray[2] - strokePx / 2),
          Math.max(0, cornerRadiiArray[3] - strokePx / 2),
        ];
        return (
          <Rect
            x={strokePx / 2}
            y={strokePx / 2}
            width={Math.max(0, frame.width - strokePx)}
            height={Math.max(0, frame.height - strokePx)}
            stroke={frame.borderColor || '#FFFFFF'}
            strokeWidth={strokePx}
            dash={strokeDash}
            cornerRadius={hasRounding ? borderRadii : undefined}
            strokeScaleEnabled={false}
            listening={false}
          />
        );
      })()}

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
  onToast,
}: CarouselCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const currentCarousel = useCarouselStore((s) => s.currentCarousel);
  const activeSlideIndex = useCarouselStore((s) => s.activeSlideIndex);
  const setActiveSlide = useCarouselStore((s) => s.setActiveSlide);
  const showSliceGuides = useCarouselStore((s) => s.showSliceGuides);
  const showCenterGuide = useCarouselStore((s) => s.showCenterGuide);
  const showThirdsGuide = useCarouselStore((s) => s.showThirdsGuide);
  const updatePhotoFrame = useCarouselStore((s) => s.updatePhotoFrame);

  const selectedFrameIds = useCarouselStore((s) => s.selectedFrameIds);
  const setSelectedFrameId = useCarouselStore((s) => s.setSelectedFrameId);
  const setSelectedFrameIds = useCarouselStore((s) => s.setSelectedFrameIds);
  const toggleFrameSelection = useCarouselStore((s) => s.toggleFrameSelection);
  const removePhotoFrame = useCarouselStore((s) => s.removePhotoFrame);
  const setPanoramaSpan = useCarouselStore((s) => s.setPanoramaSpan);
  const setHeroPhotoOnSlide = useCarouselStore((s) => s.setHeroPhotoOnSlide);

  const dragInitialPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [isSwapHandleFocused, setIsSwapHandleFocused] = useState(false);
  const [isSwapDragging, setIsSwapDragging] = useState(false);
  const photoSwapHandleRef = useRef<Konva.Group>(null);
  const photoSwapSourceIdRef = useRef<string | null>(null);
  const photoSwapHandleOriginRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setIsSwapHandleFocused(false);
  }, [selectedFrameIds, activeSlideIndex]);

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    frameId?: string | null;
  }>({ isOpen: false, x: 0, y: 0, frameId: null });

  const [hoveredDropSlideIndex, setHoveredDropSlideIndex] = useState<number | null>(null);
  const [hoveredDropReplaceFrameId, setHoveredDropReplaceFrameId] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 800 });
  const [stagePos, setStagePos] = useState({ x: 40, y: 40 });
  const stagePosRef = useRef(stagePos);
  stagePosRef.current = stagePos;
  const panAnimationRef = useRef<number | null>(null);
  const [isSpacePanning, setIsSpacePanning] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const cancelSmoothPan = useCallback(() => {
    if (panAnimationRef.current !== null) {
      cancelAnimationFrame(panAnimationRef.current);
      panAnimationRef.current = null;
    }
  }, []);

  // Cleanup smooth pan RAF on unmount
  useEffect(() => {
    return () => {
      cancelSmoothPan();
    };
  }, [cancelSmoothPan]);

  const totalWidth = currentCarousel ? getCarouselTotalWidth(currentCarousel) : 1080;
  const totalHeight = currentCarousel?.slideHeightPx ?? 1080;
  const slideWidth = currentCarousel?.slideWidthPx ?? 1080;

  const scale = zoomLevel / 100;

  /**
   * Cancelable 60fps RAF smooth panning using easeOutCubic curve.
   * Viewport centering math:
   * X_target = round(Wc / 2 - (Xs + Ws / 2) * S)
   * Y_target = round(Hc / 2 - (Hs / 2) * S)
   */
  const smoothPanToSlide = useCallback(
    (slideIdx: number, duration = 280, _force = false) => {
      cancelSmoothPan();
      if (!currentCarousel || !containerRef.current) return;

      const cw = containerSize.width || containerRef.current.clientWidth;
      const ch = containerSize.height || containerRef.current.clientHeight;
      if (cw <= 0 || ch <= 0) return;

      const currentScale = zoomLevel / 100;
      const ws = currentCarousel.slideWidthPx;
      const hs = currentCarousel.slideHeightPx;
      const xs = slideIdx * ws;

      const targetX = Math.round(cw / 2 - (xs + ws / 2) * currentScale);
      const targetY = Math.round(ch / 2 - (hs / 2) * currentScale);

      const startX = stagePosRef.current.x;
      const startY = stagePosRef.current.y;

      if (startX === targetX && startY === targetY) return;

      prevActiveSlideRef.current = slideIdx;
      const startTime = performance.now();

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic

        const currentX = Math.round(startX + (targetX - startX) * ease);
        const currentY = Math.round(startY + (targetY - startY) * ease);

        setStagePos({ x: currentX, y: currentY });

        if (progress < 1) {
          panAnimationRef.current = requestAnimationFrame(step);
        } else {
          panAnimationRef.current = null;
        }
      };

      panAnimationRef.current = requestAnimationFrame(step);
    },
    [cancelSmoothPan, currentCarousel, containerSize, zoomLevel]
  );

  // Track container sizing with ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateSize = () => {
      if (container.clientWidth > 0 && container.clientHeight > 0) {
        setContainerSize({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.contentRect) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize({
            width: Math.round(width),
            height: Math.round(height),
          });
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Center / Fit to screen
  const fitToScreen = useCallback(() => {
    cancelSmoothPan();
    if (!containerRef.current || !currentCarousel) return;
    const cw = containerSize.width || containerRef.current.clientWidth;
    const ch = containerSize.height || containerRef.current.clientHeight;
    if (cw <= 0 || ch <= 0) return;

    const pad = 48;
    const availW = Math.max(100, cw - pad * 2);
    const availH = Math.max(100, ch - pad * 2);

    const fitScale = Math.min(availW / totalWidth, availH / totalHeight);
    const newZoom = Math.max(5, Math.min(300, Math.round(fitScale * 100)));

    if (onZoomChange) {
      onZoomChange(() => newZoom);
    }

    const stageW = totalWidth * (newZoom / 100);
    const stageH = totalHeight * (newZoom / 100);
    setStagePos({
      x: Math.round((cw - stageW) / 2),
      y: Math.round((ch - stageH) / 2),
    });
  }, [cancelSmoothPan, containerSize, currentCarousel, totalWidth, totalHeight, onZoomChange]);

  useEffect(() => {
    fitToScreen();
  }, [fitTrigger]);

  // Auto-bring active slide into view if outside visible canvas
  const prevActiveSlideRef = useRef<number>(activeSlideIndex);
  useEffect(() => {
    if (!currentCarousel) return;
    if (prevActiveSlideRef.current === activeSlideIndex) return;
    prevActiveSlideRef.current = activeSlideIndex;

    // Do not conflict with active RAF smooth pan
    if (panAnimationRef.current !== null) return;

    const cw = containerSize.width;
    if (cw <= 0) return;

    const slideX = getSlideXOffset(currentCarousel, activeSlideIndex);
    const slideW = currentCarousel.slideWidthPx;
    const currentScale = zoomLevel / 100;
    const screenLeft = stagePos.x + slideX * currentScale;
    const screenRight = stagePos.x + (slideX + slideW) * currentScale;

    const pad = 48;
    if (screenLeft < pad) {
      setStagePos((p) => ({ ...p, x: Math.round(pad - slideX * currentScale) }));
    } else if (screenRight > cw - pad) {
      setStagePos((p) => ({ ...p, x: Math.round(cw - pad - (slideX + slideW) * currentScale) }));
    }
  }, [activeSlideIndex, currentCarousel, containerSize.width, zoomLevel, stagePos.x]);

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

  // Carousel-specific keyboard shortcuts (Delete, Escape, Arrow nudge, Cmd+A, Shortcut S)
  // These must live here so keyboard actions route to carousel store, not album store.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable ||
        target?.closest?.('[contenteditable="true"]') ||
        editingTextId !== null
      ) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;

      const mac = navigator.platform.toUpperCase().includes('MAC');
      const cmdOrCtrl = mac ? e.metaKey : e.ctrlKey;

      // Delete / Backspace → remove all selected carousel frames
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedFrameIds: ids } = useCarouselStore.getState();
        if (ids.length > 0) {
          e.preventDefault();
          useCarouselStore.getState().deleteSelectedFrames();
          onToast?.(`Removed ${ids.length} element${ids.length > 1 ? 's' : ''}`);
        }
        return;
      }

      // Escape → deselect all frames / cancel active swap drag
      if (e.key === 'Escape') {
        if (photoSwapSourceIdRef.current) {
          const origin = photoSwapHandleOriginRef.current;
          const handle = photoSwapHandleRef.current;
          if (origin && handle) {
            handle.position(origin);
            handle.getLayer()?.batchDraw();
          }
          photoSwapSourceIdRef.current = null;
          photoSwapHandleOriginRef.current = null;
          setIsSwapDragging(false);
          setHoveredSwapTargetFrameId(null);
          stageRef.current?.container().style.setProperty('cursor', 'default');
          return;
        }
        useCarouselStore.getState().setSelectedFrameIds([]);
        return;
      }

      // Cmd+A → select all frames on active slide
      if (cmdOrCtrl && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        useCarouselStore.getState().selectAllFramesOnSlide();
        onToast?.('Selected all photos on slide');
        return;
      }

      // Shortcut 'S' for Photo Swap
      if (e.key.toLowerCase() === 's' && !cmdOrCtrl && !e.altKey && !e.shiftKey) {
        const { selectedFrameIds: selIds, currentCarousel: cc } = useCarouselStore.getState();
        if (!cc) return;

        const activeSlide = cc.slides[activeSlideIndex];
        const selectedPhotos = (activeSlide?.elements || []).filter(
          (el): el is CarouselPhotoFrame =>
            selIds.includes(el.id) && el.type === 'photo' && Boolean(el.filePath) && !el.locked
        );

        if (selIds.length === 2) {
          e.preventDefault();
          if (selectedPhotos.length === 2 && selectedPhotos[0] && selectedPhotos[1]) {
            useCarouselStore.getState().swapFrames(selectedPhotos[0].id, selectedPhotos[1].id);
            onToast?.('✓ Swapped 2 photos');
          } else {
            onToast?.('⚠️ Select 2 unlocked photo frames to swap');
          }
        } else if (selIds.length === 1) {
          e.preventDefault();
          if (selectedPhotos.length === 1) {
            setIsSwapHandleFocused(true);
            onToast?.('⇄ Photo swap handle active — drag to another photo to swap');
          } else {
            onToast?.('⚠️ Photo swap handle is only available on unlocked photo frames');
          }
        }
        return;
      }

      // Arrow keys → nudge all selected carousel frames
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const { selectedFrameIds: selIds, currentCarousel: cc } = useCarouselStore.getState();
        if (selIds.length === 0 || !cc) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;

        const selSet = new Set(selIds);
        const updates: Array<{ id: string; updates: Partial<CarouselPhotoFrame> }> = [];
        for (const slide of cc.slides) {
          for (const el of slide.elements) {
            if (el.type === 'photo' && selSet.has(el.id)) {
              updates.push({
                id: el.id,
                updates: {
                  x: Math.round(el.x + dx),
                  y: Math.round(el.y + dy),
                },
              });
            }
          }
        }
        if (updates.length > 0) {
          useCarouselStore.getState().batchUpdateFrames(updates);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSlideIndex]);

  // Global mouse up for pan release safety
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsMouseDown(false);
      dragStartRef.current = null;
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Continuous wheel / trackpad 2D pan and cursor-anchored pinch zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      cancelSmoothPan();
      e.preventDefault();
      e.stopPropagation();

      if (e.ctrlKey || e.metaKey) {
        // Zoom centered at mouse pointer
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const rawDelta = e.deltaY;
        let deltaZoom = 0;
        if (e.deltaMode === WheelEvent.DOM_DELTA_PIXEL && Math.abs(rawDelta) < 35) {
          const factor = Math.exp(-rawDelta * 0.006);
          deltaZoom = (zoomLevel * factor) - zoomLevel;
        } else {
          deltaZoom = rawDelta > 0 ? -10 : 10;
        }

        const newZoom = Math.max(5, Math.min(350, Math.round(zoomLevel + deltaZoom)));
        const newScale = newZoom / 100;
        const oldScale = zoomLevel / 100;

        if (newScale !== oldScale && oldScale > 0) {
          setStagePos((prev) => {
            const worldX = (mouseX - prev.x) / oldScale;
            const worldY = (mouseY - prev.y) / oldScale;
            const nextX = mouseX - worldX * newScale;
            const nextY = mouseY - worldY * newScale;
            return { x: Math.round(nextX), y: Math.round(nextY) };
          });
          onZoomChange?.(() => newZoom);
        }
      } else {
        // Free 2D Trackpad / Mouse Wheel Panning
        setStagePos((prev) => ({
          x: Math.round(prev.x - e.deltaX),
          y: Math.round(prev.y - e.deltaY),
        }));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [zoomLevel, onZoomChange, cancelSmoothPan]);

  // Collect all elements from all slides
  const allFrames: CarouselPhotoFrame[] = currentCarousel
    ? currentCarousel.slides.flatMap((s) => s.elements.filter((el): el is CarouselPhotoFrame => el.type === 'photo'))
    : [];

  const allTextFrames: CarouselTextFrame[] = currentCarousel
    ? currentCarousel.slides.flatMap((s) => s.elements.filter((el): el is CarouselTextFrame => el.type === 'text'))
    : [];

  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const editingTextFrame = allTextFrames.find((f) => f.id === editingTextId) || null;

  const [hoveredSwapTargetFrameId, setHoveredSwapTargetFrameId] = useState<string | null>(null);

  const carouselPhotoFrames: RectFrameInput[] = useMemo(() => {
    return allFrames.map((f) => ({
      id: f.id,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      rotation: f.rotation,
      locked: f.locked,
    }));
  }, [allFrames]);

  const carouselDividers = useMemo(() => {
    return extractCanvasDividers(carouselPhotoFrames, {
      minDimension: 120,
      minOverlap: 10,
      maxGap: 60,
    });
  }, [carouselPhotoFrames]);

  const hoveredSwapTargetFrame = useMemo(() => {
    if (!hoveredSwapTargetFrameId) return null;
    return allFrames.find((f) => f.id === hoveredSwapTargetFrameId) || null;
  }, [allFrames, hoveredSwapTargetFrameId]);

  const hoveredDropReplaceFrame = useMemo(() => {
    if (!hoveredDropReplaceFrameId) return null;
    return allFrames.find((f) => f.id === hoveredDropReplaceFrameId) || null;
  }, [allFrames, hoveredDropReplaceFrameId]);

  const selectedPhotosOnSlide = (currentCarousel?.slides[activeSlideIndex]?.elements || []).filter(
    (el): el is CarouselPhotoFrame =>
      selectedFrameIds.includes(el.id) && el.type === 'photo' && Boolean(el.filePath) && !el.locked
  );
  const swapHandleFrame = selectedFrameIds.length === 1 && !editingTextId && selectedPhotosOnSlide.length === 1
    ? selectedPhotosOnSlide[0]
    : undefined;

  const handlePhotoSwapDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    if (!swapHandleFrame) return;
    photoSwapSourceIdRef.current = swapHandleFrame.id;
    photoSwapHandleOriginRef.current = {
      x: e.currentTarget.x(),
      y: e.currentTarget.y(),
    };
    setIsSwapDragging(true);
    setHoveredSwapTargetFrameId(null);
    stageRef.current?.container().style.setProperty('cursor', 'grabbing');
  };

  const handlePhotoSwapDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    const sourceId = photoSwapSourceIdRef.current;
    if (!sourceId || !currentCarousel) return;

    const stage = e.currentTarget.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;

    const canvasX = (pointer.x - stagePos.x) / scale;
    const canvasY = (pointer.y - stagePos.y) / scale;

    const target = findPhotoSwapTarget(carouselPhotoFrames, { x: canvasX, y: canvasY }, sourceId);
    setHoveredSwapTargetFrameId(target?.id || null);
  };

  const handlePhotoSwapDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    const sourceId = photoSwapSourceIdRef.current;
    const origin = photoSwapHandleOriginRef.current;
    const handle = photoSwapHandleRef.current;

    const stage = e.currentTarget.getStage();
    const pointer = stage?.getPointerPosition();
    let targetFrame: RectFrameInput | null = null;
    if (pointer && sourceId) {
      const canvasX = (pointer.x - stagePos.x) / scale;
      const canvasY = (pointer.y - stagePos.y) / scale;
      targetFrame = findPhotoSwapTarget(carouselPhotoFrames, { x: canvasX, y: canvasY }, sourceId);
    }

    if (sourceId && targetFrame && targetFrame.id !== sourceId) {
      useCarouselStore.getState().swapFrames(sourceId, targetFrame.id);
      useCarouselStore.getState().setSelectedFrameId(targetFrame.id);
      onToast?.('✓ Swapped photos');
    }

    if (origin && handle) {
      handle.position(origin);
      handle.getLayer()?.batchDraw();
    }

    photoSwapSourceIdRef.current = null;
    photoSwapHandleOriginRef.current = null;
    setIsSwapDragging(false);
    setHoveredSwapTargetFrameId(null);
    stageRef.current?.container().style.setProperty('cursor', 'default');
  };

  // Update Transformer selection (supports multi-selection, ignoring locked/hidden)
  useEffect(() => {
    if (!trRef.current || !stageRef.current) return;
    if (selectedFrameIds.length > 0) {
      const allElements = [...allFrames, ...allTextFrames];
      const transformableIds = selectedFrameIds.filter((id) => {
        const el = allElements.find((item) => item.id === id);
        return el && !el.locked && !el.hidden;
      });
      const nodes = transformableIds
        .map((id) => stageRef.current?.findOne(`#${id}`))
        .filter(Boolean) as Konva.Node[];
      trRef.current.nodes(nodes);
      trRef.current.getLayer()?.batchDraw();
      return;
    }
    trRef.current.nodes([]);
    trRef.current.getLayer()?.batchDraw();
  }, [selectedFrameIds, allFrames, allTextFrames]);

  const getCarouselContextMenuItems = (): ContextMenuItem[] => {
    if (!contextMenu.frameId) return [];

    // Check if target is a text frame
    const targetTextFrame = allTextFrames.find((f) => f.id === contextMenu.frameId);
    if (targetTextFrame) {
      return [
        {
          id: 'edit-text',
          label: 'Edit Text',
          onClick: () => {
            setEditingTextId(targetTextFrame.id);
          },
        },
        {
          id: 'toggle-lock',
          label: targetTextFrame.locked ? 'Unlock Text Box' : 'Lock Text Box',
          onClick: () => {
            useCarouselStore.getState().updateTextFrame(targetTextFrame.id, { locked: !targetTextFrame.locked });
          },
        },
        { id: 'divider-text', label: '', divider: true },
        {
          id: 'delete-text',
          label: 'Delete Text Box',
          icon: <Trash2 size={14} />,
          danger: true,
          onClick: () => {
            useCarouselStore.getState().deleteSelectedFrames();
            onToast?.('Deleted text frame');
          },
        },
      ];
    }

    const targetFrame = allFrames.find((f) => f.id === contextMenu.frameId);
    if (!targetFrame) return [];

    const items: ContextMenuItem[] = [
      {
        id: 'span-2-slides',
        label: 'Set as Seamless Panorama Span (2 Slides)',
        icon: <Maximize2 size={14} />,
        onClick: () => {
          setPanoramaSpan(targetFrame.id, 2);
          onToast?.('Spanned photo across 2 slides');
        },
      },
      {
        id: 'span-3-slides',
        label: 'Set as Seamless Panorama Span (3 Slides)',
        icon: <Maximize2 size={14} />,
        onClick: () => {
          setPanoramaSpan(targetFrame.id, 3);
          onToast?.('Spanned photo across 3 slides');
        },
      },
      {
        id: 'set-hero-photo',
        label: 'Set as Hero / Anchor Photo',
        icon: <Star size={14} />,
        onClick: () => {
          if (!currentCarousel) return;
          const centerX = targetFrame.x + targetFrame.width / 2;
          const slideIdx = getSlideIndexAtX(currentCarousel, centerX);
          setHeroPhotoOnSlide(slideIdx, targetFrame.id);
          onToast?.(`Set photo as Hero on Slide ${slideIdx + 1}`);
        },
      },
      { id: 'divider-1', label: '', divider: true },
      {
        id: 'reset-crop',
        label: 'Reset Crop & Center',
        icon: <RotateCcw size={14} />,
        onClick: () => {
          updatePhotoFrame(targetFrame.id, { cropX: 0, cropY: 0, cropScale: 1.0 });
          onToast?.('Reset crop and centered photo');
        },
      },
      {
        id: 'delete-frame',
        label: 'Delete Photo Frame',
        icon: <Trash2 size={14} />,
        danger: true,
        onClick: () => {
          removePhotoFrame(targetFrame.id);
          setSelectedFrameId(null);
          onToast?.('Deleted photo frame');
        },
      },
    ];
    return items;
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!currentCarousel) return;
    const box = e.currentTarget.getBoundingClientRect();
    const canvasX = (e.clientX - box.left - stagePos.x) / scale;
    const canvasY = (e.clientY - box.top - stagePos.y) / scale;
    const targetIdx = getSlideIndexAtX(currentCarousel, canvasX);
    setHoveredDropSlideIndex(targetIdx);

    const hitFrame = allFrames.find(
      (f) =>
        !f.locked &&
        canvasX >= f.x &&
        canvasX <= f.x + f.width &&
        canvasY >= f.y &&
        canvasY <= f.y + f.height
    );
    setHoveredDropReplaceFrameId(hitFrame?.id || null);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setHoveredDropSlideIndex(null);
    setHoveredDropReplaceFrameId(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setHoveredDropSlideIndex(null);
    setHoveredDropReplaceFrameId(null);
    if (!currentCarousel) return;

    // Extract photo IDs from drag payload with WebKit pasteboard fallbacks
    let photoIds: string[] = [];
    try {
      const raw = e.dataTransfer.getData('application/x-afsn-photo-ids') || e.dataTransfer.getData('application/json');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) photoIds = parsed.filter((id): id is string => typeof id === 'string');
        else if (typeof parsed?.id === 'string') photoIds = [parsed.id];
      }
    } catch {}
    if (photoIds.length === 0) {
      const textId = e.dataTransfer.getData('text/plain');
      if (textId) {
        if (textId.includes(',')) {
          photoIds = textId.split(',').map((id) => id.trim()).filter(Boolean);
        } else {
          photoIds = [textId];
        }
      }
    }
    if (photoIds.length === 0) {
      const draggedIds = usePhotoStore.getState().draggedPhotoIds;
      if (draggedIds && draggedIds.length > 0) {
        photoIds = [...draggedIds];
      }
    }
    if (photoIds.length === 0) {
      const selectedIds = usePhotoStore.getState().selectedPhotoIds;
      if (selectedIds && selectedIds.length > 0) {
        photoIds = [...selectedIds];
      }
    }

    usePhotoStore.setState({ draggedPhotoIds: [] });

    const libraryPhotos = usePhotoStore.getState().photos;
    const byId = new Map(libraryPhotos.map((p) => [p.id, p]));
    const photosToPlace = [...new Set(photoIds)].map((id) => byId.get(id)).filter((p): p is (typeof libraryPhotos)[number] => Boolean(p));
    if (photosToPlace.length === 0) return;

    // Translate viewport coords to canvas continuous space
    const box = e.currentTarget.getBoundingClientRect();
    const canvasX = (e.clientX - box.left - stagePos.x) / scale;
    const canvasY = (e.clientY - box.top - stagePos.y) / scale;
    const targetSlideIdx = getSlideIndexAtX(currentCarousel, canvasX);

    const { addPhotoFrames, setActiveSlide } = useCarouselStore.getState();

    if (photosToPlace.length === 1) {
      const photo = photosToPlace[0]!;

      // Check if dropped directly over an existing frame to REPLACE its photo
      const hitFrame = allFrames.find(
        (f) =>
          !f.locked &&
          canvasX >= f.x &&
          canvasX <= f.x + f.width &&
          canvasY >= f.y &&
          canvasY <= f.y + f.height
      );

      if (hitFrame) {
        const hitSlideIdx = getSlideIndexAtX(currentCarousel, hitFrame.x + hitFrame.width / 2);
        addPhotoFrames(hitSlideIdx, photosToPlace, { targetFrameId: hitFrame.id, isReplace: true });
        setActiveSlide(hitSlideIdx);
        smoothPanToSlide(hitSlideIdx, 280, true);

        usePhotoStore.setState((s) => ({
          photos: s.photos.map((p) => (p.id === photo.id ? { ...p, usedCount: (p.usedCount || 0) + 1 } : p)),
        }));
        onToast?.(`Replaced photo in frame with ${photo.fileName}`);
        return;
      }
    }

    // Single or multi-photo drop: place using atomic addPhotoFrames with R-BSP generative reflow
    addPhotoFrames(targetSlideIdx, photosToPlace);
    setActiveSlide(targetSlideIdx);
    smoothPanToSlide(targetSlideIdx, 280, true);

    // Update usedCount in photoStore
    const placedIdSet = new Set(photosToPlace.map((p) => p.id));
    usePhotoStore.setState((s) => ({
      photos: s.photos.map((p) => (placedIdSet.has(p.id) ? { ...p, usedCount: (p.usedCount || 0) + 1 } : p)),
    }));
    onToast?.(`Added ${photosToPlace.length} photo${photosToPlace.length > 1 ? 's' : ''} to Slide ${targetSlideIdx + 1}`);
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.canvasContainer} ${isSpacePanning ? styles.panningMode : ''}`}
      onMouseDown={(e) => {
        cancelSmoothPan();
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
      <div
        className={styles.stageWrapper}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Stage
          ref={stageRef}
          width={containerSize.width}
          height={containerSize.height}
          scaleX={scale}
          scaleY={scale}
          x={stagePos.x}
          y={stagePos.y}
          onClick={(e) => {
            if (e.target === e.target.getStage()) {
              setSelectedFrameIds([]);
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
              onClick={() => setSelectedFrameIds([])}
            />

            {/* Individual Slide Backgrounds */}
            {currentCarousel?.slides.map((slide, idx) => (
              <Group
                key={slide.id}
                x={getSlideXOffset(currentCarousel, idx)}
                y={0}
                onClick={() => {
                  setActiveSlide(idx);
                  setSelectedFrameIds([]);
                }}
                onTap={() => {
                  setActiveSlide(idx);
                  setSelectedFrameIds([]);
                }}
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

                {/* Drop Target Feedback Highlight */}
                {hoveredDropSlideIndex === idx && (
                  <Rect
                    width={slideWidth}
                    height={totalHeight}
                    stroke="#3B82F6"
                    strokeWidth={3}
                    dash={[8, 8]}
                    listening={false}
                  />
                )}
              </Group>
            ))}
          </Layer>

          {/* Layer 2: Interactive Photo Frames (Seamless across slides) */}
          <Layer>
            {allFrames.map((frame) => {
              if (frame.hidden) return null;
              return (
              <CarouselFrameNode
                key={frame.id}
                frame={frame}
                isSelected={selectedFrameIds.includes(frame.id)}
                onSelect={(e) => {
                  e.cancelBubble = true;
                  const isShift = Boolean(e.evt?.shiftKey);
                  toggleFrameSelection(frame.id, isShift);
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
                onContextMenu={(e) => {
                  if (!selectedFrameIds.includes(frame.id)) {
                    setSelectedFrameId(frame.id);
                  }
                  if (currentCarousel) {
                    const centerX = frame.x + frame.width / 2;
                    const targetIdx = getSlideIndexAtX(currentCarousel, centerX);
                    setActiveSlide(targetIdx);
                  }
                  setContextMenu({
                    isOpen: true,
                    x: e.evt.clientX,
                    y: e.evt.clientY,
                    frameId: frame.id,
                  });
                }}
                onDragStart={() => {
                  if (selectedFrameIds.includes(frame.id) && selectedFrameIds.length > 1) {
                    const initMap = new Map<string, { x: number; y: number }>();
                    for (const id of selectedFrameIds) {
                      const f = allFrames.find((item) => item.id === id);
                      if (f) initMap.set(id, { x: f.x, y: f.y });
                    }
                    dragInitialPositionsRef.current = initMap;
                  } else {
                    dragInitialPositionsRef.current.clear();
                  }
                }}
                onDragMove={(e) => {
                  const node = e.target;
                  if (dragInitialPositionsRef.current.size > 1) {
                    const initSelf = dragInitialPositionsRef.current.get(frame.id);
                    if (initSelf) {
                      const dx = node.x() - initSelf.x;
                      const dy = node.y() - initSelf.y;
                      dragInitialPositionsRef.current.forEach((initPos, otherId) => {
                        if (otherId !== frame.id) {
                          const otherNode = stageRef.current?.findOne(`#${otherId}`);
                          if (otherNode) {
                            otherNode.position({ x: initPos.x + dx, y: initPos.y + dy });
                          }
                        }
                      });
                      node.getLayer()?.batchDraw();
                    }
                    return;
                  }

                  const cx = node.x() + node.width() / 2;
                  const cy = node.y() + node.height() / 2;
                  const target = findPhotoSwapTarget(carouselPhotoFrames, { x: cx, y: cy }, frame.id);
                  setHoveredSwapTargetFrameId(target?.id || null);
                }}
                onDragEnd={(e) => {
                  const node = e.target;
                  if (dragInitialPositionsRef.current.size > 1) {
                    const initSelf = dragInitialPositionsRef.current.get(frame.id);
                    if (initSelf) {
                      const dx = Math.round(node.x() - initSelf.x);
                      const dy = Math.round(node.y() - initSelf.y);
                      const updates = Array.from(dragInitialPositionsRef.current.entries()).map(([id, pos]) => ({
                        id,
                        updates: {
                          x: Math.round(pos.x + dx),
                          y: Math.round(pos.y + dy),
                        },
                      }));
                      useCarouselStore.getState().batchUpdateFrames(updates);
                    }
                    dragInitialPositionsRef.current.clear();
                    return;
                  }

                  const cx = node.x() + node.width() / 2;
                  const cy = node.y() + node.height() / 2;
                  const target = findPhotoSwapTarget(carouselPhotoFrames, { x: cx, y: cy }, frame.id);
                  if (target) {
                    // Snap dragged node back to original position
                    node.position({ x: frame.x, y: frame.y });
                    node.getLayer()?.batchDraw();
                    useCarouselStore.getState().swapFrames(frame.id, target.id);
                    onToast?.('Swapped photos');
                  } else {
                    updatePhotoFrame(frame.id, {
                      x: Math.round(node.x()),
                      y: Math.round(node.y()),
                    });
                  }
                  setHoveredSwapTargetFrameId(null);
                }}
              />
              );
            })}

            {/* Interactive Text Nodes */}
            {allTextFrames.map((textFrame) => {
              if (textFrame.hidden) return null;
              return (
              <CarouselTextNode
                key={textFrame.id}
                frame={textFrame}
                isSelected={selectedFrameIds.includes(textFrame.id)}
                isEditing={editingTextId === textFrame.id}
                onSelect={(e) => {
                  if (e) e.cancelBubble = true;
                  const isShift = Boolean(e?.evt?.shiftKey);
                  toggleFrameSelection(textFrame.id, isShift);
                  if (currentCarousel) {
                    const centerX = textFrame.x + textFrame.width / 2;
                    const targetIdx = getSlideIndexAtX(currentCarousel, centerX);
                    setActiveSlide(targetIdx);
                  }
                }}
                onChange={(updates) => {
                  useCarouselStore.getState().updateTextFrame(textFrame.id, updates);
                }}
                onDoubleClick={() => {
                  setEditingTextId(textFrame.id);
                }}
                onContextMenu={(e) => {
                  if (!selectedFrameIds.includes(textFrame.id)) {
                    setSelectedFrameId(textFrame.id);
                  }
                  if (currentCarousel) {
                    const centerX = textFrame.x + textFrame.width / 2;
                    const targetIdx = getSlideIndexAtX(currentCarousel, centerX);
                    setActiveSlide(targetIdx);
                  }
                  setContextMenu({
                    isOpen: true,
                    x: e.evt.clientX,
                    y: e.evt.clientY,
                    frameId: textFrame.id,
                  });
                }}
                onDragStart={() => {
                  if (selectedFrameIds.includes(textFrame.id) && selectedFrameIds.length > 1) {
                    const initMap = new Map<string, { x: number; y: number }>();
                    for (const id of selectedFrameIds) {
                      const f = [...allFrames, ...allTextFrames].find((item) => item.id === id);
                      if (f) initMap.set(id, { x: f.x, y: f.y });
                    }
                    dragInitialPositionsRef.current = initMap;
                  } else {
                    dragInitialPositionsRef.current.clear();
                  }
                }}
                onDragMove={(e) => {
                  const node = e.target;
                  if (dragInitialPositionsRef.current.size > 1) {
                    const initSelf = dragInitialPositionsRef.current.get(textFrame.id);
                    if (initSelf) {
                      const dx = node.x() - initSelf.x;
                      const dy = node.y() - initSelf.y;
                      dragInitialPositionsRef.current.forEach((initPos, otherId) => {
                        if (otherId !== textFrame.id) {
                          const otherNode = stageRef.current?.findOne(`#${otherId}`);
                          if (otherNode) {
                            otherNode.position({ x: initPos.x + dx, y: initPos.y + dy });
                          }
                        }
                      });
                      node.getLayer()?.batchDraw();
                    }
                  }
                }}
                onDragEnd={(e) => {
                  const finalX = Math.round(e.target.x());
                  const finalY = Math.round(e.target.y());
                  if (dragInitialPositionsRef.current.size > 1) {
                    const initSelf = dragInitialPositionsRef.current.get(textFrame.id);
                    if (initSelf) {
                      const dx = finalX - initSelf.x;
                      const dy = finalY - initSelf.y;
                      const batchUpdates: Array<{ id: string; updates: Partial<CarouselPhotoFrame> | Partial<CarouselTextFrame> }> = [];
                      dragInitialPositionsRef.current.forEach((initPos, otherId) => {
                        batchUpdates.push({
                          id: otherId,
                          updates: {
                            x: Math.round(initPos.x + dx),
                            y: Math.round(initPos.y + dy),
                          },
                        });
                      });
                      useCarouselStore.getState().batchUpdateFrames(batchUpdates);
                      dragInitialPositionsRef.current.clear();
                      return;
                    }
                  }
                  useCarouselStore.getState().updateTextFrame(textFrame.id, {
                    x: finalX,
                    y: finalY,
                  });
                }}
              />
              );
            })}

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
              onTransformEnd={() => {
                const nodes = trRef.current?.nodes() || [];
                const updates: Array<{ id: string; updates: Partial<CarouselPhotoFrame> | Partial<CarouselTextFrame> }> = [];
                for (const node of nodes) {
                  const id = node.id();
                  const scaleX = node.scaleX();
                  const scaleY = node.scaleY();
                  node.scaleX(1);
                  node.scaleY(1);
                  updates.push({
                    id,
                    updates: {
                      x: Math.round(node.x()),
                      y: Math.round(node.y()),
                      width: Math.max(20, Math.round(node.width() * scaleX)),
                      height: Math.max(20, Math.round(node.height() * scaleY)),
                      rotation: Math.round(node.rotation()),
                    },
                  });
                }
                if (updates.length > 0) {
                  useCarouselStore.getState().batchUpdateFrames(updates);
                }
              }}
            />

            {/* Cyan Swap Target Ring — glows on hovered drop target during photo drag */}
            {hoveredSwapTargetFrame && (
              <Rect
                x={hoveredSwapTargetFrame.x}
                y={hoveredSwapTargetFrame.y}
                width={hoveredSwapTargetFrame.width}
                height={hoveredSwapTargetFrame.height}
                stroke="#38BDF8"
                strokeWidth={3}
                dash={[8, 6]}
                shadowColor="#38BDF8"
                shadowBlur={14}
                shadowOpacity={0.7}
                listening={false}
                cornerRadius={4}
              />
            )}

            {/* Cyan Drop Replacement Ring — glows when dragging photo over an existing frame to replace it */}
            {hoveredDropReplaceFrame && (
              <Rect
                x={hoveredDropReplaceFrame.x}
                y={hoveredDropReplaceFrame.y}
                width={hoveredDropReplaceFrame.width}
                height={hoveredDropReplaceFrame.height}
                stroke="#38bdf8"
                strokeWidth={2}
                dash={[6, 4]}
                shadowColor="#38bdf8"
                shadowBlur={10}
                shadowOpacity={0.8}
                listening={false}
                cornerRadius={hoveredDropReplaceFrame.cornerRadius || 0}
              />
            )}

            {/* Interactive Divider Overlay — drag-to-resize adjacent frames */}
            <DividerOverlayLayer
              dividers={carouselDividers}
              scaleFactor={scale}
              stageRef={stageRef}
              frames={carouselPhotoFrames}
              onCommit={(updates) => {
                useCarouselStore.getState().batchUpdateFrames(
                  updates.map((u) => ({
                    id: u.id,
                    updates: u.geometry as Partial<CarouselPhotoFrame>,
                  }))
                );
                onToast?.(`Resized ${updates.length} frame${updates.length !== 1 ? 's' : ''}`);
              }}
            />

            {/* Direct on-canvas photo swap handle */}
            {swapHandleFrame && !isSwapDragging && (
              <Group
                key={`photo-swap-handle-${swapHandleFrame.id}`}
                ref={photoSwapHandleRef}
                name="photo-swap-handle"
                x={swapHandleFrame.x + swapHandleFrame.width / 2}
                y={swapHandleFrame.y + swapHandleFrame.height / 2}
                draggable
                dragDistance={3}
                onMouseDown={(e) => {
                  e.cancelBubble = true;
                }}
                onClick={(e) => {
                  e.cancelBubble = true;
                }}
                onTap={(e) => {
                  e.cancelBubble = true;
                }}
                onMouseEnter={() => {
                  stageRef.current?.container().style.setProperty('cursor', 'grab');
                }}
                onMouseLeave={() => {
                  if (!photoSwapSourceIdRef.current) {
                    stageRef.current?.container().style.setProperty('cursor', 'default');
                  }
                }}
                onDragStart={handlePhotoSwapDragStart}
                onDragMove={handlePhotoSwapDragMove}
                onDragEnd={handlePhotoSwapDragEnd}
              >
                <Circle
                  radius={isSwapHandleFocused ? 14 : 12}
                  fill="rgba(18, 20, 26, 0.9)"
                  stroke="#38bdf8"
                  strokeWidth={isSwapHandleFocused ? 2.5 : 1.5}
                  shadowColor={isSwapHandleFocused ? '#38bdf8' : 'rgba(0, 0, 0, 0.65)'}
                  shadowBlur={isSwapHandleFocused ? 12 : 6}
                  shadowOffset={{ x: 0, y: 2 }}
                />
                <KonvaText
                  x={-12}
                  y={-8}
                  width={24}
                  height={16}
                  text="⇄"
                  align="center"
                  verticalAlign="middle"
                  fill="#38bdf8"
                  fontSize={15}
                  fontStyle="bold"
                  fontFamily="Inter, system-ui, -apple-system, sans-serif"
                  listening={false}
                />
              </Group>
            )}
          </Layer>

          {/* Layer 3: Guides & Overlays (Slice Boundaries, Centerlines, Rule of Thirds) */}
          {(showSliceGuides || showCenterGuide || showThirdsGuide) && (
            <Layer listening={false}>
              {/* Slice Boundary Guides & Slide Number Badges (Overlay) */}
              {showSliceGuides && (
                <>
                  {/* Virtual Cut Indicators for Spanning Frames */}
                  {allFrames
                    .filter((f) => f.width > slideWidth + 1)
                    .map((frame) => {
                      const startSlide = Math.floor(frame.x / slideWidth);
                      const endSlide = Math.floor((frame.x + frame.width - 1) / slideWidth);
                      const cutXPositions: number[] = [];
                      for (let s = startSlide + 1; s <= endSlide; s++) {
                        const boundaryX = s * slideWidth;
                        if (boundaryX > frame.x && boundaryX < frame.x + frame.width) {
                          cutXPositions.push(boundaryX);
                        }
                      }
                      return (
                        <Group key={`cuts-${frame.id}`}>
                          {cutXPositions.map((cutX) => (
                            <Group key={`cut-${frame.id}-${cutX}`}>
                              <Line
                                points={[cutX, frame.y, cutX, frame.y + frame.height]}
                                stroke="rgba(56, 189, 248, 0.75)"
                                strokeWidth={1.5}
                                dash={[4, 4]}
                              />
                              <Group x={cutX - 35} y={frame.y + frame.height / 2 - 10}>
                                <Rect width={70} height={20} fill="rgba(15, 23, 42, 0.85)" cornerRadius={4} />
                                <KonvaText
                                  text="Slide Cut"
                                  x={14}
                                  y={5}
                                  fill="#38bdf8"
                                  fontSize={10}
                                  fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
                                  fontStyle="600"
                                />
                              </Group>
                            </Group>
                          ))}
                        </Group>
                      );
                    })}

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
                </>
              )}

              {/* Optical Centerlines per Slide */}
              {showCenterGuide && (
                <Group listening={false}>
                  {currentCarousel?.slides.map((slide, idx) => {
                    const xOffset = getSlideXOffset(currentCarousel, idx);
                    return (
                      <Group key={`center-guide-${slide.id}`} x={xOffset} y={0}>
                        {/* Vertical Slide Centerline */}
                        <Line
                          points={[slideWidth / 2, 0, slideWidth / 2, totalHeight]}
                          stroke="rgba(168, 85, 247, 0.65)"
                          strokeWidth={1.5}
                          dash={[6, 4]}
                          perfectDrawEnabled={false}
                          strokeScaleEnabled={false}
                        />
                        {/* Horizontal Slide Centerline */}
                        <Line
                          points={[0, totalHeight / 2, slideWidth, totalHeight / 2]}
                          stroke="rgba(168, 85, 247, 0.65)"
                          strokeWidth={1.5}
                          dash={[6, 4]}
                          perfectDrawEnabled={false}
                          strokeScaleEnabled={false}
                        />
                      </Group>
                    );
                  })}
                </Group>
              )}

              {/* Rule of Thirds Grid per Slide */}
              {showThirdsGuide && (
                <Group listening={false}>
                  {currentCarousel?.slides.map((slide, idx) => {
                    const xOffset = getSlideXOffset(currentCarousel, idx);
                    return (
                      <Group key={`thirds-guide-${slide.id}`} x={xOffset} y={0}>
                        {/* Vertical Thirds */}
                        <Line
                          points={[slideWidth / 3, 0, slideWidth / 3, totalHeight]}
                          stroke="rgba(56, 189, 248, 0.45)"
                          strokeWidth={1}
                          dash={[4, 4]}
                          perfectDrawEnabled={false}
                          strokeScaleEnabled={false}
                        />
                        <Line
                          points={[(slideWidth * 2) / 3, 0, (slideWidth * 2) / 3, totalHeight]}
                          stroke="rgba(56, 189, 248, 0.45)"
                          strokeWidth={1}
                          dash={[4, 4]}
                          perfectDrawEnabled={false}
                          strokeScaleEnabled={false}
                        />
                        {/* Horizontal Thirds */}
                        <Line
                          points={[0, totalHeight / 3, slideWidth, totalHeight / 3]}
                          stroke="rgba(56, 189, 248, 0.45)"
                          strokeWidth={1}
                          dash={[4, 4]}
                          perfectDrawEnabled={false}
                          strokeScaleEnabled={false}
                        />
                        <Line
                          points={[0, (totalHeight * 2) / 3, slideWidth, (totalHeight * 2) / 3]}
                          stroke="rgba(56, 189, 248, 0.45)"
                          strokeWidth={1}
                          dash={[4, 4]}
                          perfectDrawEnabled={false}
                          strokeScaleEnabled={false}
                        />
                      </Group>
                    );
                  })}
                </Group>
              )}
            </Layer>
          )}
        </Stage>

        {/* Inline Text Editor Overlay for Carousel Text Frames */}
        {editingTextFrame && (
          <TextInlineEditor
            key={editingTextFrame.id}
            element={{
              id: editingTextFrame.id,
              type: 'text',
              text: editingTextFrame.text,
              x: editingTextFrame.x,
              y: editingTextFrame.y,
              width: editingTextFrame.width,
              height: editingTextFrame.height,
              rotation: editingTextFrame.rotation || 0,
              opacity: editingTextFrame.opacity ?? 1,
              locked: editingTextFrame.locked,
              styledRanges: editingTextFrame.styledRanges,
              style: {
                ...DEFAULT_TEXT_STYLE,
                fontFamily: editingTextFrame.fontFamily || 'SF Pro Display, system-ui, sans-serif',
                fontSize: editingTextFrame.fontSize || 48,
                fontWeight: (editingTextFrame.fontWeight as any) || '700',
                fill: editingTextFrame.color || '#FFFFFF',
                align: editingTextFrame.align || 'center',
                lineHeight: editingTextFrame.lineHeight ?? 1.25,
                letterSpacing: editingTextFrame.letterSpacing ?? 0,
                ...(editingTextFrame.style || {}),
              },
            }}
            stageRef={stageRef}
            scaleFactor={scale}
            canvasUnit="px"
            dpi={72}
            onCommit={(newText, newRanges, stylePatch) => {
              const currentId = editingTextFrame.id;
              if (currentId) {
                useCarouselStore.getState().updateTextFrame(currentId, {
                  text: newText,
                  ...(newRanges !== undefined ? { styledRanges: newRanges } : {}),
                  ...(stylePatch
                    ? {
                        style: { ...(editingTextFrame.style || {}), ...stylePatch },
                        align: stylePatch.align ? (stylePatch.align as any) : editingTextFrame.align,
                        color: stylePatch.fill || editingTextFrame.color,
                        fontSize: stylePatch.fontSize || editingTextFrame.fontSize,
                        fontFamily: stylePatch.fontFamily || editingTextFrame.fontFamily,
                        fontWeight: stylePatch.fontWeight
                          ? String(stylePatch.fontWeight)
                          : editingTextFrame.fontWeight,
                      }
                    : {}),
                });
              }
              setEditingTextId(null);
            }}
            onCancel={() => setEditingTextId(null)}
          />
        )}
      </div>

      <ContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        items={getCarouselContextMenuItems()}
        onClose={() => setContextMenu((p) => ({ ...p, isOpen: false }))}
      />
    </div>
  );
}
