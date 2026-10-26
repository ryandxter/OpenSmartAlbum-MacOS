import { useRef, useState, useEffect, useMemo, useLayoutEffect } from 'react';
import { Group, Rect, Image as KonvaImage, Circle, Path as KonvaPath } from 'react-konva';
import Konva from 'konva';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { CarouselGraphicFrame } from '../../domain/carousel';
import { useCarouselStore } from '../../stores/carouselStore';
import { renderFilteredPhotoToCanvas } from '../../utils/imageFilters';

const carouselGraphicCache = new Map<string, HTMLImageElement>();
function getCachedImage(src: string): HTMLImageElement | null {
  return carouselGraphicCache.get(src) || null;
}
function setCachedImage(src: string, img: HTMLImageElement) {
  if (carouselGraphicCache.size >= 40) {
    const firstKey = carouselGraphicCache.keys().next().value;
    if (firstKey) carouselGraphicCache.delete(firstKey);
  }
  carouselGraphicCache.set(src, img);
}

export interface CarouselGraphicNodeProps {
  frame: CarouselGraphicFrame;
  isSelected: boolean;
  onSelect: (e: Konva.KonvaEventObject<any>) => void;
  onChange: (updates: Partial<CarouselGraphicFrame>) => void;
  onContextMenu?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (e: Konva.KonvaEventObject<DragEvent>) => void;
}

export function CarouselGraphicNode({
  frame,
  isSelected,
  onSelect,
  onChange,
  onContextMenu,
  onDragStart,
  onDragMove,
  onDragEnd,
}: CarouselGraphicNodeProps) {
  const shapeRef = useRef<Konva.Group>(null);
  const hitRef = useRef<Konva.Rect>(null);

  useLayoutEffect(() => {
    const node = shapeRef.current;
    if (!node) return;
    const original = node.getClientRect;
    node.getClientRect = (config) => hitRef.current?.getClientRect(config) ?? original.call(node, config);
    return () => {
      node.getClientRect = original;
    };
  }, []);

  const displaySrc = frame.frameAssetLocalPath || frame.filePath || frame.frameAssetUrl || frame.fileUrl || '';
  const resolvedSrc = displaySrc
    ? (frame.frameAssetLocalPath || frame.filePath ? convertFileSrc(displaySrc) : displaySrc)
    : '';

  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(() => {
    return resolvedSrc ? getCachedImage(resolvedSrc) : null;
  });

  useEffect(() => {
    if (!resolvedSrc) {
      setImageObj(null);
      return;
    }
    const cached = getCachedImage(resolvedSrc);
    if (cached && cached.complete && cached.naturalWidth > 0) {
      setImageObj(cached);
      return;
    }

    let isMounted = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = resolvedSrc;
    img.onload = () => {
      if (!isMounted) return;
      setCachedImage(resolvedSrc, img);
      setImageObj(img);
    };
    img.onerror = () => {
      if (isMounted) setImageObj(null);
    };

    return () => {
      isMounted = false;
    };
  }, [resolvedSrc]);

  const hasVisualEffects = Boolean(
    (frame.grayscaleAmount && frame.grayscaleAmount > 0) ||
    (frame.noiseAmount && frame.noiseAmount > 0) ||
    (frame.blurRadius && frame.blurRadius > 0)
  );

  const displayImage = useMemo(() => {
    if (!imageObj) return null;
    if (!hasVisualEffects) return imageObj;

    return renderFilteredPhotoToCanvas(imageObj, Math.round(frame.width), Math.round(frame.height), {
      grayscale: frame.grayscaleAmount || 0,
      noise: frame.noiseAmount || 0,
      blur: frame.blurRadius || 0,
      seed: frame.id,
    });
  }, [imageObj, hasVisualEffects, frame.grayscaleAmount, frame.noiseAmount, frame.blurRadius, frame.width, frame.height, frame.id]);

  return (
    <Group
      ref={shapeRef}
      id={frame.id}
      x={frame.x}
      y={frame.y}
      width={frame.width}
      height={frame.height}
      rotation={frame.rotation || 0}
      opacity={frame.opacity ?? 1}
      shadowColor={frame.shadowEnabled ? (frame.shadowColor || '#000000') : undefined}
      shadowBlur={frame.shadowEnabled ? (frame.shadowBlur ?? 8) : undefined}
      shadowOffsetX={frame.shadowEnabled ? (frame.shadowOffsetX ?? 0) : undefined}
      shadowOffsetY={frame.shadowEnabled ? (frame.shadowOffsetY ?? 4) : undefined}
      shadowOpacity={frame.shadowEnabled ? (frame.shadowOpacity ?? 0.5) : undefined}
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
      {/* Base Solid Hit Rect */}
      <Rect
        ref={hitRef}
        width={frame.width}
        height={frame.height}
        fill="rgba(0, 0, 0, 0.001)"
        listening={true}
      />

      {/* Render Graphic Image with Flip Horizontal / Vertical */}
      <Group
        scaleX={frame.flipHorizontal ? -1 : 1}
        scaleY={frame.flipVertical ? -1 : 1}
        offsetX={frame.flipHorizontal ? frame.width : 0}
        offsetY={frame.flipVertical ? frame.height : 0}
      >
        {displayImage ? (
          <KonvaImage
            image={displayImage}
            width={frame.width}
            height={frame.height}
            listening={false}
          />
        ) : (
          <Rect
            width={frame.width}
            height={frame.height}
            fill="rgba(255, 255, 255, 0.05)"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth={1}
            dash={[4, 4]}
            listening={false}
          />
        )}
      </Group>

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

      {/* Modern Compact Exclude from Adaptive Layout Pin Badge (AST-02, TPL-06) */}
      {frame.excludeFromAdaptiveLayout && (
        <Group
          x={frame.locked ? Math.max(25, frame.width - 30) : Math.max(11, frame.width - 12)}
          y={12}
          listening={true}
          onClick={(e) => {
            e.cancelBubble = true;
            const sIdx = useCarouselStore.getState().activeSlideIndex;
            useCarouselStore.getState().toggleExcludeFromAdaptiveLayout(sIdx, [frame.id]);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            const sIdx = useCarouselStore.getState().activeSlideIndex;
            useCarouselStore.getState().toggleExcludeFromAdaptiveLayout(sIdx, [frame.id]);
          }}
        >
          <Circle
            radius={8}
            fill="rgba(18, 20, 26, 0.9)"
            stroke="rgba(56, 189, 248, 0.7)"
            strokeWidth={1}
            shadowColor="rgba(0, 0, 0, 0.45)"
            shadowBlur={3}
            shadowOffset={{ x: 0, y: 1 }}
          />
          <KonvaPath
            data="M12 2v8M12 18v4M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h8M18 12h4"
            stroke="#38bdf8"
            strokeWidth={1.8}
            fillEnabled={false}
            scale={{ x: 0.38, y: 0.38 }}
            x={-4.5}
            y={-4.5}
            listening={false}
          />
        </Group>
      )}
    </Group>
  );
}
