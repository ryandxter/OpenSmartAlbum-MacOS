/**
 * src/domain/layout/reorderLayers.ts
 * Core mathematical engine for Visual Studio Layers Management & Reordering.
 */

/**
 * Converts canvas element array (Index 0 = Bottommost, Index N-1 = Topmost)
 * to UI layer list (Slot 0 = Topmost, Slot N-1 = Bottommost).
 */
export function canvasToUiLayers<T>(elements: T[]): T[] {
  return [...elements].reverse();
}

/**
 * Converts UI layer list (Slot 0 = Topmost, Slot N-1 = Bottommost)
 * back to canvas element array (Index 0 = Bottommost, Index N-1 = Topmost).
 */
export function uiLayersToCanvas<T>(layers: T[]): T[] {
  return [...layers].reverse();
}

/**
 * Normalizes element z-indices monotonically from 1 to N based on canvas array position.
 */
export function normalizeZIndices<T extends { zIndex?: number }>(elements: T[]): T[] {
  return elements.map((elem, idx) => ({
    ...elem,
    zIndex: idx + 1,
  }));
}

/**
 * Multi-Selection Unified Block Reordering Algorithm (LAY-03).
 *
 * Given a list of items (either in UI order or Canvas order), a set of selected element IDs,
 * and a target drop slot index:
 * 1. Separates selected and unselected items while preserving relative order within both sets.
 * 2. Maps targetSlotIndex into the unselected items slice index.
 * 3. Splices the selected items as a single contiguous block at that location.
 *
 * @param items Current ordered array of items
 * @param selectedIds IDs of elements currently selected to move together
 * @param targetSlotIndex 0-indexed destination slot boundary (0 to items.length)
 * @returns New reordered array with block inserted contiguously
 */
export function reorderLayersMultiSelection<T extends { id: string; zIndex?: number }>(
  items: T[],
  selectedIds: string[],
  targetSlotIndex: number
): T[] {
  if (!items || items.length <= 1) return items ? [...items] : [];
  const selectedSet = new Set(selectedIds);

  const selectedItems = items.filter((item) => selectedSet.has(item.id));
  const unselectedItems = items.filter((item) => !selectedSet.has(item.id));

  // No-op if no items selected or all items selected
  if (selectedItems.length === 0 || unselectedItems.length === 0) {
    return [...items];
  }

  // Count how many unselected items occur prior to targetSlotIndex
  const boundedSlot = Math.max(0, Math.min(targetSlotIndex, items.length));
  let unselectedInsertIndex = 0;
  for (let i = 0; i < boundedSlot; i++) {
    const item = items[i];
    if (item && !selectedSet.has(item.id)) {
      unselectedInsertIndex++;
    }
  }

  // Splice selected block into unselected list
  const result = [...unselectedItems];
  result.splice(unselectedInsertIndex, 0, ...selectedItems);
  return result;
}

export interface CardRect {
  top: number;
  height: number;
  bottom?: number;
}

/**
 * Calculates exact drop slot index during vertical dragging using midpoint crossing
 * with a deadband hysteresis buffer (default 2px each side) to prevent flickering.
 *
 * @param cursorY Client vertical coordinate of pointer
 * @param cardIndex 0-based index of current hovered card in UI list
 * @param cardRect Bounding client rectangle of hovered card
 * @param currentSlot Previous slot index for hysteresis deadband stability
 * @param hysteresis Deadband in pixels (default 2px)
 * @returns 0-indexed drop slot (cardIndex for above, cardIndex + 1 for below)
 */
export function calculateDropSlotIndex(
  cursorY: number,
  cardIndex: number,
  cardRect: { top: number; height: number },
  currentSlot?: number,
  hysteresis?: number
): number;
export function calculateDropSlotIndex(
  cardBoundingRects: CardRect[],
  cursorY: number,
  currentSlot?: number
): number;
export function calculateDropSlotIndex(
  arg1: number | CardRect[],
  arg2: number,
  arg3?: CardRect | number,
  arg4?: number,
  arg5 = 2
): number {
  if (Array.isArray(arg1)) {
    const cardBoundingRects = arg1;
    const cursorY = arg2;
    const currentSlot = typeof arg3 === 'number' ? arg3 : undefined;
    const hysteresis = 2;

    if (cardBoundingRects.length === 0) return 0;

    const firstCard = cardBoundingRects[0];
    if (firstCard && cursorY < firstCard.top) {
      return 0;
    }

    // Check if below the last card
    const lastCard = cardBoundingRects[cardBoundingRects.length - 1];
    if (lastCard) {
      const lastBottom = lastCard.bottom !== undefined ? lastCard.bottom : lastCard.top + lastCard.height;
      if (cursorY > lastBottom) {
        return cardBoundingRects.length;
      }
    }

    // Find the card containing cursorY
    for (let i = 0; i < cardBoundingRects.length; i++) {
      const rect = cardBoundingRects[i];
      if (!rect) continue;
      const bottom = rect.bottom !== undefined ? rect.bottom : rect.top + rect.height;
      if (cursorY >= rect.top && cursorY <= bottom) {
        return calculateDropSlotIndex(cursorY, i, rect, currentSlot, hysteresis);
      }
    }

    // Fallback: search closest card
    let closestIndex = 0;
    let minDistance = Infinity;
    for (let i = 0; i < cardBoundingRects.length; i++) {
      const rect = cardBoundingRects[i];
      if (!rect) continue;
      const midpoint = rect.top + rect.height / 2;
      const dist = Math.abs(cursorY - midpoint);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    }
    const closestCard = cardBoundingRects[closestIndex];
    if (!closestCard) return 0;
    return calculateDropSlotIndex(cursorY, closestIndex, closestCard, currentSlot, hysteresis);
  }

  // Single card signature: (cursorY, cardIndex, cardRect, currentSlot?, hysteresis?)
  const cursorY = arg1;
  const cardIndex = arg2;
  const cardRect = arg3 as { top: number; height: number };
  const currentSlot = arg4;
  const hysteresis = arg5;

  const midpoint = cardRect.top + cardRect.height / 2;
  const upperBoundary = midpoint - hysteresis;
  const lowerBoundary = midpoint + hysteresis;

  if (cursorY <= upperBoundary) {
    return cardIndex; // Insert BEFORE (above) item
  }
  if (cursorY >= lowerBoundary) {
    return cardIndex + 1; // Insert AFTER (below) item
  }
  // Inside hysteresis deadband: preserve existing slot if adjacent, otherwise snap to closest
  if (currentSlot === cardIndex || currentSlot === cardIndex + 1) {
    return currentSlot;
  }
  return cursorY < midpoint ? cardIndex : cardIndex + 1;
}
