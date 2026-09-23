import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Line, Text as KonvaText, Group, Image as KonvaImage, Transformer, Path as KonvaPath } from 'react-konva';
import Konva from 'konva';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Maximize2, Star, RotateCcw, Trash2 } from 'lucide-react';
import { ContextMenu, ContextMenuItem } from '../../components/ui';
import { useCarouselStore } from '../../stores/carouselStore';
import { usePhotoStore } from '../../stores/photoStore';
import {
  CarouselPhotoFrame,
  getCarouselTotalWidth,
  getSlideXOffset,
  getSlideIndexAtX,
} from '../../domain/carousel';
import { drawShapeToContext, getShapeSvgPath } from '../../domain/shapes';
import { calculateImageOffset } from '../../domain/editor';
import { DividerOverlayLayer } from '../editor/DividerOverlayLayer';
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
  onDragMove,
  onDragEnd,
}: {
  frame: CarouselPhotoFrame;
  isSelected: boolean;
  onSelect: (e: Konva.KonvaEventObject<any>) => void;
  onChange: (updates: Partial<CarouselPhotoFrame>) => void;
  onContextMenu?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
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
  const updatePhotoFrame = useCarouselStore((s) => s.updatePhotoFrame);

  const selectedFrameId = useCarouselStore((s) => s.selectedFrameId);
  const setSelectedFrameId = useCarouselStore((s) => s.setSelectedFrameId);
  const removePhotoFrame = useCarouselStore((s) => s.removePhotoFrame);
  const setPanoramaSpan = useCarouselStore((s) => s.setPanoramaSpan);
  const setHeroPhotoOnSlide = useCarouselStore((s) => s.setHeroPhotoOnSlide);

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    frameId?: string | null;
  }>({ isOpen: false, x: 0, y: 0, frameId: null });

  const [hoveredDropSlideIndex, setHoveredDropSlideIndex] = useState<number | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 800 });
  const [stagePos, setStagePos] = useState({ x: 40, y: 40 });
  const [isSpacePanning, setIsSpacePanning] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const totalWidth = currentCarousel ? getCarouselTotalWidth(currentCarousel) : 1080;
  const totalHeight = currentCarousel?.slideHeightPx ?? 1080;
  const slideWidth = currentCarousel?.slideWidthPx ?? 1080;

  const scale = zoomLevel / 100;

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
  }, [containerSize, currentCarousel, totalWidth, totalHeight, onZoomChange]);

  useEffect(() => {
    fitToScreen();
  }, [fitTrigger]);

  // Auto-bring active slide into view if outside visible canvas
  const prevActiveSlideRef = useRef<number>(activeSlideIndex);
  useEffect(() => {
    if (!currentCarousel) return;
    if (prevActiveSlideRef.current === activeSlideIndex) return;
    prevActiveSlideRef.current = activeSlideIndex;

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

  // Carousel-specific keyboard shortcuts (Delete, Escape, Arrow nudge, Cmd+A)
  // These must live here so keyboard actions route to carousel store, not album store.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;

      const mac = navigator.platform.toUpperCase().includes('MAC');
      const cmdOrCtrl = mac ? e.metaKey : e.ctrlKey;

      // Delete / Backspace → remove selected carousel frame
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const id = useCarouselStore.getState().selectedFrameId;
        if (id) {
          e.preventDefault();
          useCarouselStore.getState().removePhotoFrame(id);
          useCarouselStore.getState().setSelectedFrameId(null);
        }
        return;
      }

      // Escape → deselect frame
      if (e.key === 'Escape') {
        useCarouselStore.getState().setSelectedFrameId(null);
        return;
      }

      // Cmd+A → select first frame on active slide (highlight active slide's first frame)
      if (cmdOrCtrl && (e.key === 'a' || e.key === 'A')) {
        const { currentCarousel, activeSlideIndex } = useCarouselStore.getState();
        if (!currentCarousel) return;
        const slide = currentCarousel.slides[activeSlideIndex];
        if (slide && slide.elements.length > 0) {
          e.preventDefault();
          const firstPhoto = slide.elements.find((el) => el.type === 'photo');
          if (firstPhoto) useCarouselStore.getState().setSelectedFrameId(firstPhoto.id);
        }
        return;
      }

      // Arrow keys → nudge selected carousel frame
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const { selectedFrameId: selId } = useCarouselStore.getState();
        if (!selId) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;
        const { currentCarousel: cc } = useCarouselStore.getState();
        if (!cc) return;
        for (const slide of cc.slides) {
          const frame = slide.elements.find((el) => el.type === 'photo' && el.id === selId) as CarouselPhotoFrame | undefined;
          if (frame) {
            useCarouselStore.getState().updatePhotoFrame(selId, {
              x: Math.round(frame.x + dx),
              y: Math.round(frame.y + dy),
            });
            break;
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
  }, [zoomLevel, onZoomChange]);

  // Collect all elements from all slides
  const allFrames: CarouselPhotoFrame[] = currentCarousel
    ? currentCarousel.slides.flatMap((s) => s.elements.filter((el): el is CarouselPhotoFrame => el.type === 'photo'))
    : [];

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

  const getCarouselContextMenuItems = (): ContextMenuItem[] => {
    if (!contextMenu.frameId) return [];
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!currentCarousel) return;
    const box = stageRef.current?.container().getBoundingClientRect() || containerRef.current?.getBoundingClientRect();
    if (!box) return;
    const canvasX = (e.clientX - box.left - stagePos.x) / scale;
    const targetIdx = getSlideIndexAtX(currentCarousel, canvasX);
    setHoveredDropSlideIndex(targetIdx);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setHoveredDropSlideIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setHoveredDropSlideIndex(null);
    if (!currentCarousel) return;

    // Extract photo IDs from drag payload with WebKit pasteboard fallbacks
    const transferTypes = Array.from(e.dataTransfer.types);
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
      if (textId) photoIds = [textId];
    }
    if (photoIds.length === 0) {
      const draggedIds = usePhotoStore.getState().draggedPhotoIds;
      if (draggedIds && draggedIds.length > 0) {
        photoIds = [...draggedIds];
      }
    }
    if (photoIds.length === 0 && transferTypes.includes('application/x-afsn-photo-ids')) {
      photoIds = usePhotoStore.getState().selectedPhotoIds;
    }

    usePhotoStore.setState({ draggedPhotoIds: [] });

    const libraryPhotos = usePhotoStore.getState().photos;
    const byId = new Map(libraryPhotos.map((p) => [p.id, p]));
    const photosToPlace = [...new Set(photoIds)].map((id) => byId.get(id)).filter((p): p is (typeof libraryPhotos)[number] => Boolean(p));
    if (photosToPlace.length === 0) return;

    // Translate viewport coords to canvas continuous space
    const box = stageRef.current?.container().getBoundingClientRect() || containerRef.current?.getBoundingClientRect();
    const canvasX = (e.clientX - (box?.left ?? 0) - stagePos.x) / scale;
    const canvasY = (e.clientY - (box?.top ?? 0) - stagePos.y) / scale;
    const targetSlideIdx = getSlideIndexAtX(currentCarousel, canvasX);
    const slideW = currentCarousel.slideWidthPx;
    const slideH = currentCarousel.slideHeightPx;
    const slideStartX = getSlideXOffset(currentCarousel, targetSlideIdx);

    const { addPhotoFrame, setActiveSlide } = useCarouselStore.getState();

    if (photosToPlace.length === 1) {
      const photo = photosToPlace[0]!;
      const aspect = photo.width && photo.height ? photo.width / photo.height : 1.0;
      const maxW = slideW * 0.8;
      const maxH = slideH * 0.8;
      let frameW = maxW;
      let frameH = maxW / aspect;
      if (frameH > maxH) {
        frameH = maxH;
        frameW = maxH * aspect;
      }
      const dropRelX = canvasX - slideStartX;
      const posX = slideStartX + Math.max(20, Math.min(slideW - frameW - 20, dropRelX - frameW / 2));
      const posY = Math.max(20, Math.min(slideH - frameH - 20, canvasY - frameH / 2));

      addPhotoFrame(targetSlideIdx, {
        type: 'photo',
        photoId: photo.id,
        filePath: photo.filePath,
        fileName: photo.fileName,
        previewPath: photo.previewPath || undefined,
        thumbnailPath: photo.thumbnailPath || undefined,
        photoAspect: aspect,
        x: Math.round(posX),
        y: Math.round(posY),
        width: Math.round(frameW),
        height: Math.round(frameH),
      });
    } else {
      // Multi-photo drop: partition onto slide with uniform spacing
      const margin = 40;
      const spacing = 16;
      const usableW = slideW - margin * 2;
      const usableH = slideH - margin * 2;
      const count = photosToPlace.length;
      const cols = count <= 2 ? 1 : 2;
      const rows = Math.ceil(count / cols);
      const cellW = (usableW - spacing * (cols - 1)) / cols;
      const cellH = (usableH - spacing * (rows - 1)) / rows;

      photosToPlace.forEach((photo, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const posX = slideStartX + margin + col * (cellW + spacing);
        const posY = margin + row * (cellH + spacing);
        const aspect = photo.width && photo.height ? photo.width / photo.height : 1.0;
        addPhotoFrame(targetSlideIdx, {
          type: 'photo',
          photoId: photo.id,
          filePath: photo.filePath,
          fileName: photo.fileName,
          previewPath: photo.previewPath || undefined,
          thumbnailPath: photo.thumbnailPath || undefined,
          photoAspect: aspect,
          x: Math.round(posX),
          y: Math.round(posY),
          width: Math.round(cellW),
          height: Math.round(cellH),
        });
      });
    }

    setActiveSlide(targetSlideIdx);
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
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
          width={containerSize.width}
          height={containerSize.height}
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
                onContextMenu={(e) => {
                  setSelectedFrameId(frame.id);
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
                onDragMove={(e) => {
                  const node = e.target;
                  const cx = node.x() + node.width() / 2;
                  const cy = node.y() + node.height() / 2;
                  const target = findPhotoSwapTarget(carouselPhotoFrames, { x: cx, y: cy }, frame.id);
                  setHoveredSwapTargetFrameId(target?.id || null);
                }}
                onDragEnd={(e) => {
                  const node = e.target;
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
          </Layer>

          {/* Layer 3: Slice Boundary Guides & Slide Number Badges (Overlay) */}
          {showSliceGuides && (
            <Layer listening={false}>
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
            </Layer>
          )}
        </Stage>
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
