import { useState, useRef, useCallback } from 'react';
import { StudioLayer } from './types';
import { calculateDropSlotIndex } from '../../../domain/layout/reorderLayers';

export interface UseLayersDragAndDropProps {
  layers: StudioLayer[];
  selectedIds: string[];
  onCommitReorder: (selectedIds: string[], targetSlotIndex: number) => void;
}

export function useLayersDragAndDrop({
  layers: _layers,
  selectedIds,
  onCommitReorder,
}: UseLayersDragAndDropProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [dropSlotIndex, setDropSlotIndex] = useState<number | null>(null);
  const [indicatorY, setIndicatorY] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const lastSlotRef = useRef<number | null>(null);

  // Active dragged items (if dragged item is in selectedIds, move all selected; otherwise move only dragged item)
  const effectiveSelectedIds = useCallback(() => {
    if (!draggedLayerId) return [];
    if (selectedIds.includes(draggedLayerId)) {
      return selectedIds;
    }
    return [draggedLayerId];
  }, [draggedLayerId, selectedIds]);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, layerId: string) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', layerId);

      setDraggedLayerId(layerId);
      setIsDragging(true);
      lastSlotRef.current = null;
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      const targetCard = e.currentTarget as HTMLElement;
      if (!targetCard) return;
      const rect = targetCard.getBoundingClientRect();
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const cursorY = e.clientY;

      const slot = calculateDropSlotIndex(
        cursorY,
        index,
        { top: rect.top, height: rect.height },
        lastSlotRef.current ?? undefined,
        2 // 2px hysteresis
      );

      lastSlotRef.current = slot;
      setDropSlotIndex(slot);

      // Calculate pixel Y position of insertion line relative to scroll container
      const targetCardTopInContainer = rect.top - containerRect.top + container.scrollTop;
      const targetY = slot === index
        ? targetCardTopInContainer
        : targetCardTopInContainer + rect.height;

      setIndicatorY(targetY);
    },
    []
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Only clear if leaving the main container
    if (e.currentTarget === containerRef.current) {
      setDropSlotIndex(null);
      setIndicatorY(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const targetSlot = dropSlotIndex;
      const movingIds = effectiveSelectedIds();

      if (targetSlot !== null && movingIds.length > 0) {
        onCommitReorder(movingIds, targetSlot);
      }

      setIsDragging(false);
      setDraggedLayerId(null);
      setDropSlotIndex(null);
      setIndicatorY(null);
      lastSlotRef.current = null;
    },
    [dropSlotIndex, effectiveSelectedIds, onCommitReorder]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDraggedLayerId(null);
    setDropSlotIndex(null);
    setIndicatorY(null);
    lastSlotRef.current = null;
  }, []);

  return {
    isDragging,
    draggedLayerId,
    dropSlotIndex,
    indicatorY,
    containerRef,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  };
}
