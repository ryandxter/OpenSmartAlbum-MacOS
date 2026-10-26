export interface DockScreenRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Computes dynamic screen-space coordinates for the contextual vertical dock beside the active frame.
 * Preferred position: frameScreenRect.right + 14px, top aligned (Math.max(14, frameScreenRect.top)).
 * Viewport right-edge fallback: flips to left (frameScreenRect.left - dockWidth - 14px).
 * Clamps within viewport bounds so dock is never truncated.
 */
export function computeContextDockPosition(
  frameScreenRect: DockScreenRect,
  viewportWidth: number,
  viewportHeight: number,
  dockWidth: number = 38,
  dockHeight: number = 280
): { x: number; y: number } {
  let dockX = frameScreenRect.right + 14;
  let dockY = Math.max(14, frameScreenRect.top);

  // If dock overflows right edge of the viewport: flip to left
  if (dockX + dockWidth > viewportWidth - 14) {
    dockX = frameScreenRect.left - dockWidth - 14;
  }

  // Clamp dockX and dockY within viewport bounds
  const minX = 14;
  const maxX = Math.max(minX, viewportWidth - dockWidth - 14);
  dockX = Math.max(minX, Math.min(dockX, maxX));

  const minY = 14;
  const maxY = Math.max(minY, viewportHeight - dockHeight - 14);
  dockY = Math.max(minY, Math.min(dockY, maxY));

  return {
    x: Math.round(dockX),
    y: Math.round(dockY),
  };
}
