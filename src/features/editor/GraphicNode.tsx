import { useRef, useState, useEffect, useMemo, useLayoutEffect } from 'react';
import { Group, Rect, Image as KonvaImage, Circle, Path as KonvaPath } from 'react-konva';
import Konva from 'konva';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { GraphicElement } from '../../domain/editor';
import { useAlbumStore } from '../../stores/albumStore';
import { useEditorStore } from '../../stores/editorStore';
import { renderFilteredPhotoToCanvas } from '../../utils/imageFilters';

const graphicImageCache = new Map<string, HTMLImageElement>();
function getCachedGraphicImage(key: string): HTMLImageElement | null {
  return graphicImageCache.get(key) || null;
}
function setCachedGraphicImage(key: string, img: HTMLImageElement) {
  if (graphicImageCache.size >= 40) {
    const firstKey = graphicImageCache.keys().next().value;
    if (firstKey) graphicImageCache.delete(firstKey);
  }
  graphicImageCache.set(key, img);
}

export interface GraphicNodeProps {
  element: GraphicElement;
  isSelected: boolean;
  isMultiSelectActive?: boolean;
  scaleFactor: number;
  onSelect: (e?: Konva.KonvaEventObject<any>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onContextMenu?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
  onElementChange: (newAttrs: Partial<GraphicElement>, anchor?: string | null) => void;
  getActiveResizeAnchor?: () => string | null;
  isShiftPressed?: boolean;
}

export function GraphicNode({
  element,
  isSelected,
  isMultiSelectActive = false,
  scaleFactor,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onContextMenu,
  onElementChange,
  getActiveResizeAnchor,
}: GraphicNodeProps) {
  const shapeRef = useRef<Konva.Group>(null);
  const hitRef = useRef<Konva.Rect>(null);
  const isDraggingRef = useRef(false);

  useLayoutEffect(() => {
    const node = shapeRef.current;
    if (!node) return;
    const original = node.getClientRect;
    node.getClientRect = (config) => hitRef.current?.getClientRect(config) ?? original.call(node, config);
    return () => {
      node.getClientRect = original;
    };
  }, []);

  const pixelX = element.x * scaleFactor;
  const pixelY = element.y * scaleFactor;
  const pixelW = Math.max(1, element.width * scaleFactor);
  const pixelH = Math.max(1, element.height * scaleFactor);

  const displaySrc = element.frameAssetLocalPath || element.filePath || element.frameAssetUrl || element.fileUrl || '';
  const resolvedSrc = displaySrc
    ? (element.frameAssetLocalPath || element.filePath ? convertFileSrc(displaySrc) : displaySrc)
    : '';

  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(() => {
    return resolvedSrc ? getCachedGraphicImage(resolvedSrc) : null;
  });

  useEffect(() => {
    if (!resolvedSrc) {
      setImageObj(null);
      return;
    }
    const cached = getCachedGraphicImage(resolvedSrc);
    if (cached && cached.complete && cached.naturalWidth > 0) {
      setImageObj(cached);
      return;
    }

    let isMounted = true;
    const img = new window.Image();
    img.crossOrigin = 'Anonymous';
    img.src = resolvedSrc;
    img.onload = () => {
      if (!isMounted) return;
      setCachedGraphicImage(resolvedSrc, img);
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
    (element.grayscaleAmount && element.grayscaleAmount > 0) ||
    (element.noiseAmount && element.noiseAmount > 0) ||
    (element.blurRadius && element.blurRadius > 0)
  );

  const displayImage = useMemo(() => {
    if (!imageObj) return null;
    if (!hasVisualEffects) return imageObj;

    const blurPx = (element.blurRadius || 0) * scaleFactor;
    return renderFilteredPhotoToCanvas(imageObj, Math.round(pixelW), Math.round(pixelH), {
      grayscale: element.grayscaleAmount || 0,
      noise: element.noiseAmount || 0,
      blur: blurPx,
      seed: element.id,
    });
  }, [
    imageObj,
    hasVisualEffects,
    element.grayscaleAmount,
    element.noiseAmount,
    element.blurRadius,
    scaleFactor,
    pixelW,
    pixelH,
    element.id,
  ]);

  return (
    <Group
      id={element.id}
      ref={shapeRef}
      x={pixelX}
      y={pixelY}
      width={pixelW}
      height={pixelH}
      rotation={element.rotation || 0}
      opacity={element.opacity ?? 1}
      shadowColor={element.shadowEnabled ? (element.shadowColor || 'rgba(0, 0, 0, 0.6)') : undefined}
      shadowBlur={element.shadowEnabled ? ((element.shadowBlur ?? 15) * scaleFactor) : undefined}
      shadowOffsetX={element.shadowEnabled ? ((element.shadowOffsetX ?? 0) * scaleFactor) : undefined}
      shadowOffsetY={element.shadowEnabled ? ((element.shadowOffsetY ?? 4) * scaleFactor) : undefined}
      shadowOpacity={element.shadowEnabled ? (element.shadowOpacity ?? 0.5) : undefined}
      draggable={!element.locked}
      onMouseDown={(e) => {
        e.cancelBubble = true;
        if ('button' in e.evt && (e.evt.button === 2 || e.evt.button === 1)) return;
        if ('which' in e.evt && (e.evt.which === 3 || e.evt.which === 2)) return;
        const isMulti = Boolean(e.evt?.shiftKey || e.evt?.ctrlKey || e.evt?.metaKey);
        if (isMulti || !isSelected) {
          onSelect(e);
        }
      }}
      onClick={(e) => {
        e.cancelBubble = true;
        if ('button' in e.evt && e.evt.button !== 0) return;
        if ('which' in e.evt && e.evt.which !== 1) return;
        const isMulti = Boolean(e.evt?.shiftKey || e.evt?.ctrlKey || e.evt?.metaKey);
        if (!isDraggingRef.current && isSelected && !isMulti) {
          onSelect(e);
        }
        isDraggingRef.current = false;
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect(e);
      }}
      onContextMenu={(e) => {
        e.evt.preventDefault();
        e.cancelBubble = true;
        if (!isSelected) {
          onSelect();
        }
        onContextMenu?.(e);
      }}
      onDragStart={(e) => {
        isDraggingRef.current = true;
        onDragStart?.(e);
      }}
      onDragMove={onDragMove}
      onDragEnd={(e) => {
        setTimeout(() => {
          isDraggingRef.current = false;
        }, 50);
        onDragEnd(e);
      }}
      onTransformEnd={() => {
        if (isMultiSelectActive) return;
        const node = shapeRef.current;
        if (!node) return;

        const scaleX = Math.abs(node.scaleX());
        const scaleY = Math.abs(node.scaleY());
        let rawW = (node.width() * scaleX) / scaleFactor;
        let rawH = (node.height() * scaleY) / scaleFactor;

        const minDim = 1;
        rawW = Math.max(minDim, rawW);
        rawH = Math.max(minDim, rawH);

        node.scaleX(1);
        node.scaleY(1);

        onElementChange({
          x: node.x() / scaleFactor,
          y: node.y() / scaleFactor,
          width: rawW,
          height: rawH,
          rotation: Math.round(node.rotation()),
        }, getActiveResizeAnchor ? getActiveResizeAnchor() : null);
      }}
    >
      {/* Base Solid Hit Rect for robust selection & drag events */}
      <Rect
        ref={hitRef}
        width={pixelW}
        height={pixelH}
        fill="rgba(0, 0, 0, 0.001)"
        listening={true}
      />

      {/* Render Graphic Image with Flip Horizontal / Vertical */}
      <Group
        scaleX={element.flipHorizontal ? -1 : 1}
        scaleY={element.flipVertical ? -1 : 1}
        offsetX={element.flipHorizontal ? pixelW : 0}
        offsetY={element.flipVertical ? pixelH : 0}
      >
        {displayImage ? (
          <KonvaImage
            image={displayImage}
            width={pixelW}
            height={pixelH}
            listening={false}
          />
        ) : (
          <Rect
            width={pixelW}
            height={pixelH}
            fill="rgba(255, 255, 255, 0.05)"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth={1}
            dash={[4, 4]}
            listening={false}
          />
        )}
      </Group>

      {/* Multiple Selection Visual Highlight Outline */}
      {isSelected && isMultiSelectActive && !element.locked && (
        <Rect
          x={1.5}
          y={1.5}
          width={Math.max(0, pixelW - 3)}
          height={Math.max(0, pixelH - 3)}
          stroke="#3b82f6"
          strokeWidth={2}
          strokeScaleEnabled={false}
          listening={false}
        />
      )}

      {/* Modern Compact Locked Padlock Badge (top-right corner) */}
      {element.locked && (
        <Group
          x={Math.max(11, pixelW - 12)}
          y={12}
          listening={true}
          onClick={(e) => {
            e.cancelBubble = true;
            useEditorStore.getState().toggleLockSelectedFrames(undefined, false);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            useEditorStore.getState().toggleLockSelectedFrames(undefined, false);
          }}
          onMouseEnter={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'pointer';
          }}
          onMouseLeave={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'default';
          }}
        >
          <Circle
            radius={8}
            fill="rgba(18, 20, 26, 0.9)"
            stroke="rgba(245, 158, 11, 0.7)"
            strokeWidth={1}
            shadowColor="rgba(0, 0, 0, 0.45)"
            shadowBlur={3}
            shadowOffset={{ x: 0, y: 1 }}
          />
          <KonvaPath
            data="M7 11V7a5 5 0 0 1 10 0v4M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z"
            stroke="#fbbf24"
            strokeWidth={2}
            fillEnabled={false}
            scale={{ x: 0.38, y: 0.38 }}
            x={-4.5}
            y={-4.5}
            listening={false}
          />
        </Group>
      )}

      {/* Modern Compact Exclude from Adaptive Layout Pin Badge (AST-02, TPL-06) */}
      {element.excludeFromAdaptiveLayout && (
        <Group
          x={element.locked ? Math.max(25, pixelW - 30) : Math.max(11, pixelW - 12)}
          y={12}
          listening={true}
          onClick={(e) => {
            e.cancelBubble = true;
            const spreadId = useAlbumStore.getState().activeSpreadId;
            if (spreadId) {
              useAlbumStore.getState().toggleExcludeFromAdaptiveLayout(spreadId, [element.id]);
            }
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            const spreadId = useAlbumStore.getState().activeSpreadId;
            if (spreadId) {
              useAlbumStore.getState().toggleExcludeFromAdaptiveLayout(spreadId, [element.id]);
            }
          }}
          onMouseEnter={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'pointer';
          }}
          onMouseLeave={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'default';
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
