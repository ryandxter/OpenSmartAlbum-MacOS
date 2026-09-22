import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Folder,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Edit2,
  Trash2,
} from 'lucide-react';
import { usePhotoStore } from '../../stores/photoStore';
import { useProjectStore } from '../../stores/projectStore';
import { PhotoFolder } from '../../domain/photo';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import styles from './FolderTabs.module.css';

interface MenuAnchor {
  folder: PhotoFolder;
  top: number;
  left: number;
}

export function FolderTabs() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const {
    photos,
    folders,
    activeFolderId,
    selectedPhotoIds,
    setActiveFolder,
    addPhotosToFolder,
    deleteFolder,
    openCreateFolderDialog,
    openRenameFolderDialog,
  } = usePhotoStore();

  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<PhotoFolder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAnchor(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!currentProject) return null;

  const totalPhotoCount = photos.length;

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(folderId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
  };

  const handleDrop = async (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);

    // If dragged from internal photo selection
    if (selectedPhotoIds.length > 0) {
      await addPhotosToFolder(currentProject.id, folderId, selectedPhotoIds);
    }
  };

  const handleOpenMenu = (e: React.MouseEvent, folder: PhotoFolder) => {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    setMenuAnchor({
      folder,
      top: rect.bottom + 4,
      left: Math.max(10, Math.min(rect.left, window.innerWidth - 170)),
    });
  };

  const handleContextMenu = (e: React.MouseEvent, folder: PhotoFolder) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuAnchor({
      folder,
      top: Math.min(e.clientY + 4, window.innerHeight - 100),
      left: Math.max(10, Math.min(e.clientX, window.innerWidth - 170)),
    });
  };

  const handleDeleteRequest = (e: React.MouseEvent, folder: PhotoFolder) => {
    e.stopPropagation();
    setMenuAnchor(null);
    setDeleteError(null);
    setFolderToDelete(folder);
  };

  const handleConfirmDelete = async () => {
    if (!folderToDelete || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteFolder(folderToDelete.projectId, folderToDelete.id);
      setFolderToDelete(null);
    } catch (err) {
      setDeleteError(String(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRename = (e: React.MouseEvent, folder: PhotoFolder) => {
    e.stopPropagation();
    setMenuAnchor(null);
    openRenameFolderDialog(folder);
  };

  return (
    <>
      <div className={styles.container}>
        {/* Tab: All Photos */}
        <div
          className={`${styles.tabWrapper} ${activeFolderId === null ? styles.wrapperActive : ''}`}
        >
          <button
            type="button"
            className={`${styles.tab} ${styles.tabSolo} ${activeFolderId === null ? styles.tabActive : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveFolder(null);
              setMenuAnchor(null);
            }}
            title="Show all project photos"
          >
            <span className={styles.folderIcon}><Folder size={14} strokeWidth={1.5} /></span>
            <span className={styles.tabName}>All Photos</span>
            <span className={styles.tabCount}>{totalPhotoCount}</span>
          </button>
        </div>

        {/* Custom Folder Tabs */}
        {folders.map((folder) => {
          const isActive = activeFolderId === folder.id;
          const isDragOver = dragOverFolderId === folder.id;
          const isMenuOpen = menuAnchor?.folder.id === folder.id;

          return (
            <div
              key={folder.id}
              className={`${styles.tabWrapper} ${isDragOver ? styles.dragOver : ''} ${isActive ? styles.wrapperActive : ''}`}
              onDragOver={(e) => handleDragOver(e, folder.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, folder.id)}
              onContextMenu={(e) => handleContextMenu(e, folder)}
            >
              <button
                type="button"
                className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveFolder(folder.id);
                  setMenuAnchor(null);
                }}
                onDoubleClick={(e) => handleRename(e, folder)}
                title={`Folder: ${folder.name} (${folder.photoCount} photos). Double-click to rename. Drag selected photos here to add.`}
              >
                <span className={styles.folderIcon}><FolderOpen size={14} strokeWidth={1.5} /></span>
                <span className={styles.tabName}>{folder.name}</span>
                <span className={styles.tabCount}>{folder.photoCount}</span>
              </button>

              {/* 3-Dot Options Menu Button with clear SVG icon */}
              <button
                type="button"
                className={`${styles.menuTriggerBtn} ${isMenuOpen ? styles.menuTriggerActive : ''}`}
                onClick={(e) => handleOpenMenu(e, folder)}
                title="Folder options (Rename / Delete)"
                aria-label="Folder options"
              >
                <MoreHorizontal size={14} strokeWidth={1.5} />
              </button>
            </div>
          );
        })}

        {/* Add Folder Button (+ Icon Only) */}
        <button
          type="button"
          className={styles.addFolderBtn}
          onClick={(e) => {
            e.stopPropagation();
            openCreateFolderDialog();
          }}
          title="Create a new photo folder / collection"
          aria-label="New folder"
        >
          <Plus size={13} strokeWidth={2} />
        </button>
      </div>

      {/* React Portal Dropdown Menu attached directly to document.body (Immune to clipping & z-index issues) */}
      {menuAnchor && createPortal(
        <>
          <div
            className={styles.backdrop}
            onClick={(e) => {
              e.stopPropagation();
              setMenuAnchor(null);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenuAnchor(null);
            }}
          />
          <div
            className={styles.dropdownMenu}
            style={{
              position: 'fixed',
              top: `${menuAnchor.top}px`,
              left: `${menuAnchor.left}px`,
              zIndex: 99999,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={styles.menuItem}
              onClick={(e) => handleRename(e, menuAnchor.folder)}
            >
              <Edit2 size={13} strokeWidth={1.5} />
              Rename Folder
            </button>
            <button
              type="button"
              className={`${styles.menuItem} ${styles.menuItemDanger}`}
              onClick={(e) => handleDeleteRequest(e, menuAnchor.folder)}
            >
              <Trash2 size={13} strokeWidth={1.5} />
              Delete Folder
            </button>
          </div>
        </>,
        document.body
      )}

      {/* Modern Confirm Dialog for Folder Deletion */}
      <ConfirmDialog
        isOpen={folderToDelete !== null}
        title="Delete Folder Collection?"
        message={`Are you sure you want to delete the folder "${folderToDelete?.name}"?`}
        detail="Photos inside this folder will remain safely in your library. Only the folder organization tag is removed."
        confirmText="Delete Folder"
        cancelText="Keep Folder"
        variant="danger"
        isLoading={isDeleting}
        loadingText="Removing collection..."
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={() => setFolderToDelete(null)}
      />
    </>
  );
}
