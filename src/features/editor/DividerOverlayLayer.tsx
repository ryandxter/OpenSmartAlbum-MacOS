import React, { useRef, useState } from 'react';
import { Group, Rect, Line } from 'react-konva';
import Konva from 'konva';
import { CanvasDivider, RectFrameInput } from '../../domain/layout/dividerGraph';

interface DividerOverlayLayerProps {
  dividers: CanvasDivider[];
  scaleFactor: number;
  stageRef: React.RefObject<Konva.Stage | null>;
  frames: RectFrameInput[];
  onCommit: (updates: Array<{ id: string; geometry: Partial<RectFrameInput> }>) => void;
  disabled?: boolean;
}

export const DividerOverlayLayer: React.FC<DividerOverlayLayerProps> = ({
  dividers,
  scaleFactor,
  stageRef,
  frames,
  onCommit,
  disabled = false,
}) => {
  // All hooks must be called unconditionally (Rules of Hooks) —
  // the early-return guard MUST come AFTER all hook declarations.
  const [hoveredDividerId, setHoveredDividerId] = useState<string | null>(null);
  const [activeDraggingId, setActiveDraggingId] = useState<string | null>(null);

  const initialGeomsRef = useRef<Map<string, RectFrameInput>>(new Map());
  const cachedNodesRef = useRef<Map<string, Konva.Group>>(new Map());
  const rafIdRef = useRef<number | null>(null);
  const latestDeltaRef = useRef<number>(0);

  // Guard AFTER hooks — safe: hooks are always called in the same order/count
  if (disabled || dividers.length === 0) {
    return null;
  }

  const setCursor = (cursor: string) => {
    if (stageRef.current) {
      const container = stageRef.current.container();
      if (container) {
        container.style.cursor = cursor;
      }
    }
  };

  return (
    <Group id="divider-overlay-layer">
      {dividers.map((divider) => {
        const isHovered = hoveredDividerId === divider.id;
        const isDragging = activeDraggingId === divider.id;
        const isVertical = divider.orientation === 'vertical';

        const lengthPx = (divider.endCoord - divider.startCoord) * scaleFactor;
        const posX = (isVertical ? divider.coord : divider.startCoord) * scaleFactor;
        const posY = (isVertical ? divider.startCoord : divider.coord) * scaleFactor;

        const hitWidth = isVertical ? 18 : lengthPx;
        const hitHeight = isVertical ? lengthPx : 18;
        const hitOffsetX = isVertical ? -9 : 0;
        const hitOffsetY = isVertical ? 0 : -9;

        const linePoints = isVertical ? [0, 0, 0, lengthPx] : [0, 0, lengthPx, 0];

        return (
          <Group
            key={divider.id}
            id={divider.id}
            x={posX}
            y={posY}
            draggable={!disabled}
            dragBoundFunc={(pos) => {
              const minScreen = divider.minCoord * scaleFactor;
              const maxScreen = divider.maxCoord * scaleFactor;
              if (isVertical) {
                return {
                  x: Math.max(minScreen, Math.min(maxScreen, pos.x)),
                  y: posY, // Lock orthogonal axis
                };
              } else {
                return {
                  x: posX, // Lock orthogonal axis
                  y: Math.max(minScreen, Math.min(maxScreen, pos.y)),
                };
              }
            }}
            onMouseEnter={() => {
              if (!activeDraggingId) {
                setHoveredDividerId(divider.id);
                setCursor(isVertical ? 'col-resize' : 'row-resize');
              }
            }}
            onMouseLeave={() => {
              if (!activeDraggingId) {
                setHoveredDividerId(null);
                setCursor('default');
              }
            }}
            onDragStart={(e) => {
              e.cancelBubble = true;
              setActiveDraggingId(divider.id);
              setCursor(isVertical ? 'col-resize' : 'row-resize');

              // Cache initial geometries
              const geoms = new Map<string, RectFrameInput>();
              frames.forEach((f) => geoms.set(f.id, { ...f }));
              initialGeomsRef.current = geoms;

              // Cache Konva nodes
              const nodeMap = new Map<string, Konva.Group>();
              if (stageRef.current) {
                const allIds = [...divider.firstSideFrameIds, ...divider.secondSideFrameIds];
                for (const id of allIds) {
                  const node = stageRef.current.findOne('#' + id);
                  if (node && node instanceof Konva.Group) {
                    nodeMap.set(id, node);
                  }
                }
              }
              cachedNodesRef.current = nodeMap;
              latestDeltaRef.current = 0;
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              const node = e.target;
              const currentScreenPos = isVertical ? node.x() : node.y();
              const currentPhysical = currentScreenPos / scaleFactor;
              const delta = currentPhysical - divider.coord;
              latestDeltaRef.current = delta;

              if (rafIdRef.current === null) {
                rafIdRef.current = requestAnimationFrame(() => {
                  rafIdRef.current = null;
                  const d = latestDeltaRef.current;
                  const geoms = initialGeomsRef.current;
                  const nodes = cachedNodesRef.current;

                  // Update first side (Left / Top)
                  for (const fId of divider.firstSideFrameIds) {
                    const init = geoms.get(fId);
                    const kNode = nodes.get(fId);
                    if (!init || !kNode) continue;
                    if (isVertical) {
                      const newW = Math.max(1, init.width + d);
                      kNode.width(newW * scaleFactor);
                    } else {
                      const newH = Math.max(1, init.height + d);
                      kNode.height(newH * scaleFactor);
                    }
                  }

                  // Update second side (Right / Bottom)
                  for (const fId of divider.secondSideFrameIds) {
                    const init = geoms.get(fId);
                    const kNode = nodes.get(fId);
                    if (!init || !kNode) continue;
                    if (isVertical) {
                      const newX = init.x + d;
                      const newW = Math.max(1, init.width - d);
                      kNode.x(newX * scaleFactor);
                      kNode.width(newW * scaleFactor);
                    } else {
                      const newY = init.y + d;
                      const newH = Math.max(1, init.height - d);
                      kNode.y(newY * scaleFactor);
                      kNode.height(newH * scaleFactor);
                    }
                  }

                  const layer = e.target.getLayer();
                  layer?.batchDraw();
                });
              }
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
              }

              setActiveDraggingId(null);
              setHoveredDividerId(null);
              setCursor('default');

              const finalDelta = latestDeltaRef.current;
              const geoms = initialGeomsRef.current;
              const updates: Array<{ id: string; geometry: Partial<RectFrameInput> }> = [];

              if (Math.abs(finalDelta) > 0.05) {
                // First side updates
                for (const fId of divider.firstSideFrameIds) {
                  const init = geoms.get(fId);
                  if (!init) continue;
                  if (isVertical) {
                    updates.push({
                      id: fId,
                      geometry: { width: Math.round((init.width + finalDelta) * 100) / 100 },
                    });
                  } else {
                    updates.push({
                      id: fId,
                      geometry: { height: Math.round((init.height + finalDelta) * 100) / 100 },
                    });
                  }
                }

                // Second side updates
                for (const fId of divider.secondSideFrameIds) {
                  const init = geoms.get(fId);
                  if (!init) continue;
                  if (isVertical) {
                    updates.push({
                      id: fId,
                      geometry: {
                        x: Math.round((init.x + finalDelta) * 100) / 100,
                        width: Math.round((init.width - finalDelta) * 100) / 100,
                      },
                    });
                  } else {
                    updates.push({
                      id: fId,
                      geometry: {
                        y: Math.round((init.y + finalDelta) * 100) / 100,
                        height: Math.round((init.height - finalDelta) * 100) / 100,
                      },
                    });
                  }
                }
              }

              // Revert divider group position to origin for clean re-render
              e.target.position({ x: posX, y: posY });
              const layer = e.target.getLayer();
              layer?.batchDraw();

              if (updates.length > 0) {
                onCommit(updates);
              }
            }}
          >
            {/* Invisible Wide Hit Detection Area */}
            <Rect
              x={hitOffsetX}
              y={hitOffsetY}
              width={hitWidth}
              height={hitHeight}
              fill="transparent"
            />

            {/* Visual Accent Line */}
            <Line
              points={linePoints}
              stroke={isHovered || isDragging ? '#38BDF8' : 'rgba(56, 189, 248, 0.25)'}
              strokeWidth={isHovered || isDragging ? 3 : 1.5}
              lineCap="round"
              shadowColor="#38BDF8"
              shadowBlur={isHovered || isDragging ? 8 : 0}
              shadowOpacity={0.8}
              opacity={isHovered || isDragging ? 1 : 0}
              listening={false}
            />

            {/* Subtle Centered Grip Pill on Hover */}
            {(isHovered || isDragging) && (
              <Group
                x={isVertical ? -3 : lengthPx / 2 - 12}
                y={isVertical ? lengthPx / 2 - 12 : -3}
                listening={false}
              >
                <Rect
                  width={isVertical ? 6 : 24}
                  height={isVertical ? 24 : 6}
                  fill="#38BDF8"
                  cornerRadius={3}
                  shadowColor="rgba(0, 0, 0, 0.4)"
                  shadowBlur={4}
                />
              </Group>
            )}
          </Group>
        );
      })}
    </Group>
  );
};
