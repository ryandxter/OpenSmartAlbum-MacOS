import type { AlbumElement } from '../../domain/album';
import type { PhotoFrameElement } from '../../domain/editor';

function containsPoint(
  frame: Pick<PhotoFrameElement, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
  point: { x: number; y: number },
): boolean {
  if (frame.width <= 0 || frame.height <= 0) return false;

  const radians = -((frame.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - frame.x;
  const dy = point.y - frame.y;
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  const epsilon = 1e-6;

  return (
    localX >= -epsilon &&
    localX <= frame.width + epsilon &&
    localY >= -epsilon &&
    localY <= frame.height + epsilon
  );
}

/**
 * Resolves the topmost valid photo-frame target for an on-canvas photo-content drag.
 * Locked frames, the source frame, text elements, and rotated-frame AABB corners are excluded.
 */
export function findPhotoSwapTarget(
  elements: AlbumElement[],
  point: { x: number; y: number },
  sourceFrameId: string,
): PhotoFrameElement | null {
  const candidates = elements
    .map((element, index) => ({ element, index }))
    .filter(({ element }) => element.type === 'photo' && element.id !== sourceFrameId && !element.locked)
    .sort((a, b) => ((b.element.zIndex ?? 0) - (a.element.zIndex ?? 0)) || (b.index - a.index));

  const match = candidates.find(({ element }) => containsPoint(element as PhotoFrameElement, point));
  return match ? match.element as PhotoFrameElement : null;
}
