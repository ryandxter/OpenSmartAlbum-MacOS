import { usePhotoStore } from '../../stores/photoStore';

/**
 * Creates or updates the in-bounds DOM drag ghost badge for WebKit/WKWebView.
 *
 * Keeps the badge strictly within the visible viewport bounds (top: 0px, left: 0px)
 * with pointer-events: none, snapshotted at opacity: 1, then immediately transitioned
 * to opacity: 0.01 via requestAnimationFrame. This ensures WebKit's graphics compositor
 * preserves the layer backing store without culling or aborting the native drag session.
 */
export function setInBoundsDragGhostBadge(label: string, e: React.DragEvent): void {
  try {
    let badge = document.getElementById('afsn-drag-ghost-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'afsn-drag-ghost-badge';
      badge.style.position = 'fixed';
      badge.style.top = '0px';
      badge.style.left = '0px';
      badge.style.padding = '6px 12px';
      badge.style.background = '#0f172a';
      badge.style.color = '#38bdf8';
      badge.style.border = '1px solid #38bdf8';
      badge.style.borderRadius = '6px';
      badge.style.fontWeight = 'bold';
      badge.style.fontSize = '12px';
      badge.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
      badge.style.pointerEvents = 'none';
      badge.style.zIndex = '999999';
      document.body.appendChild(badge);
    }
    badge.textContent = label;
    badge.style.display = 'block';
    badge.style.opacity = '1';
    badge.style.pointerEvents = 'none';

    e.dataTransfer.setDragImage(badge, 20, 16);

    requestAnimationFrame(() => {
      const activeBadge = document.getElementById('afsn-drag-ghost-badge');
      if (activeBadge) {
        activeBadge.style.opacity = '0.01';
        activeBadge.style.pointerEvents = 'none';
      }
    });
  } catch {}
}

/**
 * Hides the ghost badge and resets the draggedPhotoIds store.
 */
export function cleanupDragGhostBadge(): void {
  try {
    const badge = document.getElementById('afsn-drag-ghost-badge');
    if (badge) {
      badge.style.display = 'none';
    }
  } catch {}
  usePhotoStore.setState({ draggedPhotoIds: [] });
}
