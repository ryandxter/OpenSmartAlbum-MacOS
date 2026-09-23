import { useState } from 'react';
import {
  Star,
  Copy,
  Check,
  FolderPlus,
  Folder,
  Trash2,
  ChevronDown,
  X,
  Sparkles,
  GripVertical,
} from 'lucide-react';
import { isMac } from '../../utils/platform';
import { usePhotoStore } from '../../stores/photoStore';
import { useProjectStore } from '../../stores/projectStore';
import { useAlbumStore } from '../../stores/albumStore';
import { useCarouselStore } from '../../stores/carouselStore';
import styles from './BatchActionBar.module.css';

export interface BatchActionBarProps {
  onRequestDelete: (ids: string[], name: string) => void;
  activeMode?: 'print' | 'carousel';
}

export function BatchActionBar({ onRequestDelete, activeMode = 'print' }: BatchActionBarProps) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const {
    selectedPhotoIds,
    clipboardPhotoIds,
    folders,
    activeFolderId,
    photos,
    clearSelection,
    batchToggleFavoritesSelected,
    addPhotosToFolder,
    movePhotosToFolder,
    removePhotosFromFolder,
    copySelectedPhotos,
  } = usePhotoStore();

  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false);
  const [folderAction, setFolderAction] = useState<'move' | 'copy'>('copy');

  // Show batch toolbar when 2 or more photos are selected (Lightroom style)
  if (!currentProject || selectedPhotoIds.length < 2) return null;

  const count = selectedPhotoIds.length;
  const selectedPhotos = photos.filter((p) => selectedPhotoIds.includes(p.id));
  const allFav = selectedPhotos.length > 0 && selectedPhotos.every((p) => p.isFavorite);
  const isCopied = selectedPhotoIds.length === clipboardPhotoIds.length
    && selectedPhotoIds.every((id) => clipboardPhotoIds.includes(id));

  const handleToggleFav = async () => {
    await batchToggleFavoritesSelected(!allFav);
  };

  const handleFolderTargetSelect = async (targetFolderId: string) => {
    setIsFolderMenuOpen(false);
    if (folderAction === 'move' && activeFolderId) {
      await movePhotosToFolder(currentProject.id, activeFolderId, targetFolderId, selectedPhotoIds);
    } else {
      await addPhotosToFolder(currentProject.id, targetFolderId, selectedPhotoIds);
    }
  };

  const handleRemoveFromCurrentFolder = async () => {
    if (!activeFolderId) return;
    setIsFolderMenuOpen(false);
    await removePhotosFromFolder(currentProject.id, activeFolderId, selectedPhotoIds);
  };

  const handleAutoFlow = async () => {
    if (selectedPhotos.length === 0) return;
    if (activeMode === 'carousel') {
      await useCarouselStore.getState().autoFlowPhotosToSlides(selectedPhotos);
    } else {
      const { currentAlbum, activeSpreadId } = useAlbumStore.getState();
      const activeSpread = currentAlbum?.spreads.find((s) => s.id === activeSpreadId);
      const replaceActive = activeSpread && activeSpread.elements.length === 0;
      await useAlbumStore.getState().autoFlowPhotosToSpreads(selectedPhotos, currentProject, {
        replaceCurrentSpread: Boolean(replaceActive),
      });
    }
    const placedIdSet = new Set(selectedPhotos.map((p) => p.id));
    usePhotoStore.setState((s) => ({
      photos: s.photos.map((p) => (placedIdSet.has(p.id) ? { ...p, usedCount: (p.usedCount || 0) + 1 } : p)),
    }));
    clearSelection();
  };

  return (
    <>
      <div className={styles.bar}>
        <div className={styles.leftInfo}>
          <span className={styles.countBadge}>{count}</span>
          <span className={styles.title}>{count} Photos Selected</span>
          <div
            className={styles.dragHandle}
            draggable={true}
            onDragStart={(e) => {
              const ids = selectedPhotos.map((p) => p.id);
              usePhotoStore.setState({ draggedPhotoIds: ids });
              e.dataTransfer.setData('application/x-afsn-photo-ids', JSON.stringify(ids));
              e.dataTransfer.setData('application/x-afsn-multi-photo', String(ids.length));
              e.dataTransfer.setData('application/json', JSON.stringify(ids));
              e.dataTransfer.setData('text/plain', ids.join(','));
              e.dataTransfer.effectAllowed = 'copyMove';
              try {
                let badge = document.getElementById('afsn-drag-ghost-badge');
                if (!badge) {
                  badge = document.createElement('div');
                  badge.id = 'afsn-drag-ghost-badge';
                  badge.style.position = 'fixed';
                  badge.style.top = '-1000px';
                  badge.style.left = '-1000px';
                  badge.style.padding = '6px 12px';
                  badge.style.background = '#0f172a';
                  badge.style.color = '#38bdf8';
                  badge.style.border = '1px solid #38bdf8';
                  badge.style.borderRadius = '6px';
                  badge.style.fontWeight = 'bold';
                  badge.style.fontSize = '12px';
                  badge.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
                  badge.style.pointerEvents = 'none';
                  badge.style.zIndex = '999999';
                  document.body.appendChild(badge);
                }
                badge.textContent = `📁 ${ids.length} Photos Selected`;
                e.dataTransfer.setDragImage(badge, 20, 16);
              } catch {}
            }}
            onDragEnd={() => {
              setTimeout(() => {
                usePhotoStore.setState({ draggedPhotoIds: [] });
              }, 400);
            }}
            title="Click and drag to drop all selected photos onto slide or spread"
          >
            <GripVertical size={13} strokeWidth={2} />
            <span>Drag All ({count})</span>
          </div>
          <button
            type="button"
            className={styles.deselectBtn}
            onClick={clearSelection}
            title="Clear photo selection (Esc)"
          >
            <X size={12} strokeWidth={1.5} />
            <span>Deselect</span>
          </button>
        </div>

        <div className={styles.actionsGroup}>
          {/* Auto-Flow Multi-Spread / Slides */}
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.autoFlowBtn}`}
            onClick={handleAutoFlow}
            title={
              activeMode === 'carousel'
                ? `Auto-Flow ${count} photos into storytelling carousel slides`
                : `Auto-Flow ${count} photos across storytelling album spreads`
            }
          >
            <Sparkles size={13} strokeWidth={1.5} />
            <span>Auto-Flow ({count})</span>
          </button>

          {/* Favorite All */}
          <button
            type="button"
            className={`${styles.actionBtn} ${allFav ? styles.activeFav : ''}`}
            onClick={handleToggleFav}
            title={allFav ? 'Remove all from favorites' : 'Mark all selected as favorites'}
          >
            <Star size={13} strokeWidth={1.5} fill={allFav ? 'currentColor' : 'none'} />
            <span>{allFav ? 'Favorited' : 'Favorite'}</span>
          </button>

          {/* Copy to Clipboard */}
          <button
            type="button"
            className={`${styles.actionBtn} ${isCopied ? styles.copiedBtn : ''}`}
            onClick={() => { void copySelectedPhotos(); }}
            title={isCopied ? `${count} photos copied. Paste onto a spread.` : `Copy selected photos (${isMac() ? '⌘C' : 'Ctrl+C'})`}
            aria-live="polite"
          >
            {isCopied ? (
              <>
                <Check size={13} strokeWidth={1.5} />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy size={13} strokeWidth={1.5} />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Add / Move to Folder Dropdown */}
          {folders.length > 0 && (
            <div className={styles.dropdownContainer}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => setIsFolderMenuOpen(!isFolderMenuOpen)}
                title="Organize selected photos into a folder"
              >
                <FolderPlus size={13} strokeWidth={1.5} />
                <span>To Folder</span>
                <ChevronDown size={11} strokeWidth={1.5} />
              </button>

              {isFolderMenuOpen && (
                <div className={styles.dropdownMenu}>
                  <div className={styles.menuHeader}>
                    <button
                      type="button"
                      className={`${styles.modeToggle} ${folderAction === 'copy' ? styles.modeActive : ''}`}
                      onClick={() => setFolderAction('copy')}
                    >
                      Copy to...
                    </button>
                    {activeFolderId && (
                      <button
                        type="button"
                        className={`${styles.modeToggle} ${folderAction === 'move' ? styles.modeActive : ''}`}
                        onClick={() => setFolderAction('move')}
                      >
                        Move to...
                      </button>
                    )}
                  </div>

                  <div className={styles.menuDivider} />

                  {folders.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={styles.menuItem}
                      onClick={() => handleFolderTargetSelect(f.id)}
                    >
                      <Folder size={13} strokeWidth={1.5} />
                      <span>{f.name}</span>
                    </button>
                  ))}

                  {activeFolderId && (
                    <>
                      <div className={styles.menuDivider} />
                      <button
                        type="button"
                        className={`${styles.menuItem} ${styles.menuItemDanger}`}
                        onClick={handleRemoveFromCurrentFolder}
                      >
                        Remove from this folder
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Delete Selected */}
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.deleteBtn}`}
            onClick={() => onRequestDelete([...selectedPhotoIds], `${count} photos`)}
            title={`Remove selected photos from the library (${isMac() ? '⌫' : 'Del'})`}
          >
            <Trash2 size={13} strokeWidth={1.5} />
            <span>Remove ({count})</span>
          </button>
        </div>
      </div>

    </>
  );
}
