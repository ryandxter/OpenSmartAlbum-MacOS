import { useRef, useState, useMemo, useLayoutEffect } from 'react';
import { Group, Rect, Shape as KonvaShape, Circle, Path as KonvaPath, Text as KonvaText } from 'react-konva';
import Konva from 'konva';
import { CarouselTextFrame } from '../../domain/carousel';
import {
  DEFAULT_TEXT_STYLE,
  TextStyle,
  getTextRuns,
  layoutRichText,
  drawRichTextLayout,
} from '../../domain/text';
import { useCarouselStore } from '../../stores/carouselStore';

export interface CarouselTextNodeProps {
  frame: CarouselTextFrame;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: (e?: Konva.KonvaEventObject<any>) => void;
  onChange: (updates: Partial<CarouselTextFrame>) => void;
  onDoubleClick: () => void;
  onContextMenu?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (e: Konva.KonvaEventObject<DragEvent>) => void;
}

export function CarouselTextNode({
  frame,
  isSelected,
  isEditing,
  onSelect,
  onChange,
  onDoubleClick,
  onContextMenu,
  onDragStart,
  onDragMove,
  onDragEnd,
}: CarouselTextNodeProps) {
  const shapeRef = useRef<Konva.Group>(null);
  const hitRef = useRef<Konva.Rect>(null);
  const textRef = useRef<Konva.Shape>(null);
  const overflowRef = useRef<Konva.Group>(null);
  const liveLayoutRef = useRef<ReturnType<typeof layoutRichText> | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useLayoutEffect(() => {
    const node = shapeRef.current;
    if (!node) return;
    const original = node.getClientRect;
    node.getClientRect = (config) => hitRef.current?.getClientRect(config) ?? original.call(node, config);
    return () => {
      node.getClientRect = original;
    };
  }, []);

  const style: TextStyle = useMemo(
    () => ({
      ...DEFAULT_TEXT_STYLE,
      fontFamily: frame.fontFamily || 'SF Pro Display, system-ui, sans-serif',
      fontSize: frame.fontSize || 48,
      fontWeight: (frame.fontWeight as any) || '700',
      fill: frame.color || '#FFFFFF',
      align: frame.align || 'center',
      lineHeight: frame.lineHeight ?? 1.25,
      letterSpacing: frame.letterSpacing ?? 0,
      ...(frame.style || {}),
    }),
    [
      frame.fontFamily,
      frame.fontSize,
      frame.fontWeight,
      frame.color,
      frame.align,
      frame.lineHeight,
      frame.letterSpacing,
      frame.style,
    ]
  );

  const richRuns = useMemo(
    () => getTextRuns(frame.text, style, frame.styledRanges),
    [frame.text, frame.styledRanges, style]
  );

  const richLayout = useMemo(
    () => layoutRichText(richRuns, style, frame.width, frame.height, 72, 'inch', 72),
    [richRuns, style, frame.width, frame.height]
  );

  const transformStartRef = useRef<{
    initialPixelW: number;
    initialPixelH: number;
    initialFontSize: number;
    anchor: string | null;
  } | null>(null);

  const lastTransformStateRef = useRef<{
    fontSize: number;
    isCorner: boolean;
    scaledRanges?: typeof frame.styledRanges;
  } | null>(null);

  useLayoutEffect(() => {
    if (transformStartRef.current) return;
    liveLayoutRef.current = null;
    textRef.current?.setAttrs({ width: frame.width, height: frame.height, scaleX: 1, scaleY: 1 });
    overflowRef.current?.setAttrs({
      x: Math.max(0, frame.width - 16),
      y: Math.max(0, frame.height - 16),
      visible: isSelected && !isEditing && richLayout.overflow,
    });
  });

  return (
    <Group
      id={frame.id}
      ref={shapeRef}
      x={frame.x}
      y={frame.y}
      width={frame.width}
      height={frame.height}
      rotation={frame.rotation || 0}
      draggable={!frame.locked && !isEditing}
      onMouseDown={(e) => {
        if ('button' in e.evt && (e.evt.button === 2 || e.evt.button === 1)) return;
        if ('which' in e.evt && (e.evt.which === 3 || e.evt.which === 2)) return;
      }}
      onClick={(e) => {
        if ('button' in e.evt && e.evt.button !== 0) return;
        if ('which' in e.evt && e.evt.which !== 1) return;
        onSelect(e);
      }}
      onTap={onSelect}
      onDblClick={(e) => {
        e.cancelBubble = true;
        if ('button' in e.evt && e.evt.button !== 0) return;
        if ('which' in e.evt && e.evt.which !== 1) return;
        if (!frame.locked) onDoubleClick();
      }}
      onDblTap={(e) => {
        e.cancelBubble = true;
        if (!frame.locked) onDoubleClick();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={
        onDragEnd ||
        ((e) => {
          onChange({
            x: Math.round(e.target.x()),
            y: Math.round(e.target.y()),
          });
        })
      }
      onContextMenu={(e) => {
        e.evt.preventDefault();
        e.cancelBubble = true;
        onContextMenu?.(e);
      }}
      onTransformStart={() => {
        if (frame.locked) return;
        const node = shapeRef.current;
        if (!node) return;
        const tr = node.getStage()?.findOne('Transformer') as Konva.Transformer | undefined;
        const anchor = tr?.getActiveAnchor() || null;
        lastTransformStateRef.current = null;
        transformStartRef.current = {
          initialPixelW: node.width(),
          initialPixelH: node.height(),
          initialFontSize: style.fontSize || 48,
          anchor,
        };
      }}
      onTransform={() => {
        if (frame.locked) return;
        const node = shapeRef.current;
        if (!node) return;

        const tr = node.getStage()?.findOne('Transformer') as Konva.Transformer | undefined;
        const anchor = tr?.getActiveAnchor() || transformStartRef.current?.anchor || null;

        const scaleX = Math.abs(node.scaleX());
        const scaleY = Math.abs(node.scaleY());
        if (scaleX === 0 || scaleY === 0) return;

        const isCorner =
          anchor === 'top-left' ||
          anchor === 'top-right' ||
          anchor === 'bottom-left' ||
          anchor === 'bottom-right' ||
          (!anchor && Math.abs(scaleX - 1) > 0.001 && Math.abs(scaleY - 1) > 0.001);

        if (!transformStartRef.current) {
          transformStartRef.current = {
            initialPixelW: node.width(),
            initialPixelH: node.height(),
            initialFontSize: style.fontSize || 48,
            anchor: anchor || 'corner',
          };
        }

        const { initialPixelW, initialFontSize } = transformStartRef.current;
        const newPixelW = Math.max(20, node.width() * scaleX);
        const newPixelH = Math.max(20, node.height() * scaleY);

        let newFontSize = initialFontSize;
        let currentScaledRanges = frame.styledRanges;

        if (isCorner && initialPixelW > 0) {
          const scaleRatio = newPixelW / initialPixelW;
          newFontSize = Math.max(6, Math.min(300, initialFontSize * scaleRatio));
          const fontRatio = newFontSize / initialFontSize;

          if (frame.styledRanges && frame.styledRanges.length > 0) {
            currentScaledRanges = frame.styledRanges.map((r) => ({
              ...r,
              fontSize: r.fontSize ? r.fontSize * fontRatio : undefined,
            }));
          }
        }

        lastTransformStateRef.current = {
          fontSize: newFontSize,
          isCorner,
          scaledRanges: currentScaledRanges,
        };

        const fontRatio = newFontSize / initialFontSize;
        const layoutW = newPixelW / fontRatio;
        const layoutH = newPixelH / fontRatio;
        const layout = layoutRichText(richRuns, style, layoutW, layoutH, 72, 'inch', 72);
        liveLayoutRef.current = layout;
        textRef.current?.setAttrs({
          width: layoutW,
          height: layoutH,
          scaleX: fontRatio / node.scaleX(),
          scaleY: fontRatio / node.scaleY(),
        });
        overflowRef.current?.setAttrs({
          x: Math.max(0, newPixelW - 16) / scaleX,
          y: Math.max(0, newPixelH - 16) / scaleY,
          visible: isSelected && !isEditing && layout.overflow,
        });
        node.getLayer()?.batchDraw();
      }}
      onTransformEnd={() => {
        if (frame.locked) return;
        const node = shapeRef.current;
        if (!node) return;

        const lastState = lastTransformStateRef.current;
        const wasCorner = lastState ? lastState.isCorner : false;
        const finalFontSize = lastState ? Math.round(lastState.fontSize) : (style.fontSize || 48);
        const finalRanges = lastState?.scaledRanges || frame.styledRanges;

        const scaleX = Math.abs(node.scaleX());
        const scaleY = Math.abs(node.scaleY());
        const finalW = Math.round(Math.max(20, node.width() * scaleX));
        const finalH = Math.round(Math.max(20, node.height() * scaleY));
        const finalX = Math.round(node.x());
        const finalY = Math.round(node.y());

        transformStartRef.current = null;
        lastTransformStateRef.current = null;
        liveLayoutRef.current = null;

        node.setAttrs({ x: finalX, y: finalY, width: finalW, height: finalH, scaleX: 1, scaleY: 1 });
        hitRef.current?.setAttrs({ width: finalW, height: finalH });
        textRef.current?.setAttrs({ width: finalW, height: finalH, scaleX: 1, scaleY: 1 });

        onChange({
          x: finalX,
          y: finalY,
          width: finalW,
          height: finalH,
          rotation: Math.round(node.rotation()),
          fontSize: wasCorner ? finalFontSize : frame.fontSize,
          ...(wasCorner && finalRanges ? { styledRanges: finalRanges } : {}),
        });
        node.getLayer()?.batchDraw();
      }}
    >
      {/* Base Invisible Hit Box for interaction */}
      <Rect
        ref={hitRef}
        width={frame.width}
        height={frame.height}
        fill="rgba(0, 0, 0, 0.001)"
        listening={!isEditing}
      />

      {/* Rendered Rich Text Canvas Layer */}
      <KonvaShape
        ref={textRef}
        width={frame.width}
        height={frame.height}
        opacity={isEditing ? 0 : (frame.opacity ?? 1)}
        listening={false}
        sceneFunc={(context) =>
          drawRichTextLayout(context._context, liveLayoutRef.current ?? richLayout)
        }
      />

      {/* Overflow Indicator Badge */}
      <Group
        ref={overflowRef}
        visible={isSelected && !isEditing && richLayout.overflow}
        x={Math.max(0, frame.width - 16)}
        y={Math.max(0, frame.height - 16)}
        listening={false}
      >
        <Rect x={0.5} y={0.5} width={15} height={15} fill="#fff" stroke="#e11d48" strokeWidth={1} cornerRadius={2} />
        <KonvaText text="+" width={16} height={16} align="center" verticalAlign="middle" fill="#e11d48" fontSize={12} fontStyle="bold" />
      </Group>

      {/* Hover Outline */}
      {isHovered && !isSelected && !isEditing && (
        <Rect
          width={frame.width}
          height={frame.height}
          stroke="rgba(148, 163, 184, 0.5)"
          strokeWidth={1}
          dash={[4, 4]}
          fillEnabled={false}
          listening={false}
        />
      )}

      {/* Padlock Badge when locked */}
      {frame.locked && (
        <Group
          x={Math.max(11, frame.width - 14)}
          y={14}
          listening={true}
          onClick={(e) => {
            e.cancelBubble = true;
            useCarouselStore.getState().updateTextFrame(frame.id, { locked: false });
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            useCarouselStore.getState().updateTextFrame(frame.id, { locked: false });
          }}
        >
          <Circle
            radius={9}
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
            scale={{ x: 0.4, y: 0.4 }}
            x={-4.8}
            y={-4.8}
            listening={false}
          />
        </Group>
      )}
    </Group>
  );
}
