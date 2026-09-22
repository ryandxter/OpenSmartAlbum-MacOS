import { useState, useRef, useEffect } from 'react';
import {
  FolderOpen,
  FilePlus,
  Save,
  Download,
  Package,
  X,
  Info,
  Keyboard,
  Settings,
  Undo2,
  Redo2,
  Type,
  BookOpen,
  Layers,
  PanelRight,
  PanelRightClose,
  ChevronDown,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useAlbumStore } from '../../stores/albumStore';
import { useAppStore } from '../../stores/appStore';
import { useHistoryStore } from '../../stores/historyStore';
import { usePhotoStore } from '../../stores/photoStore';
import { useEditorStore } from '../../stores/editorStore';
import styles from './AppTitleBar.module.css';

export interface AppTitleBarProps {
  onOpenExportDialog: () => void;
  onToggleProperties: () => void;
  isPropertiesOpen: boolean;
  showToast: (msg: string) => void;
  confirmSafeAction: (action: () => void | Promise<void>) => void;
  zoomLevel?: number;
  onZoomChange?: (updater: (prev: number) => number) => void;
  onFitToScreen?: () => void;
  activeMode?: 'print' | 'carousel';
  onModeSelect?: (mode: 'print' | 'carousel') => void;
}

export function AppTitleBar({
  onOpenExportDialog,
  onToggleProperties,
  isPropertiesOpen,
  showToast,
  confirmSafeAction,
  zoomLevel,
  onZoomChange,
  onFitToScreen,
  activeMode = 'print',
  onModeSelect,
}: AppTitleBarProps) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const openNewProject = useProjectStore((s) => s.openNewProject);
  const closeProject = useProjectStore((s) => s.closeProject);
  const updateProjectName = useProjectStore((s) => s.updateProjectName);
  const saveProject = useProjectStore((s) => s.saveProject);
  const exportProjectAsAfsn = useProjectStore((s) => s.exportProjectAsAfsn);
  const exportCompleteProjectPackageWithPhotos = useProjectStore((s) => s.exportCompleteProjectPackageWithPhotos);
  const importProjectFromAfsn = useProjectStore((s) => s.importProjectFromAfsn);

  const activeSpreadId = useAlbumStore((s) => s.activeSpreadId);
  const saveStatus = useAlbumStore((s) => s.saveStatus);
  const lastSavedAt = useAlbumStore((s) => s.lastSavedAt);
  const undo = useAlbumStore((s) => s.undo);
  const redo = useAlbumStore((s) => s.redo);

  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);

  const openAbout = useAppStore((s) => s.openAbout);
  const openSettings = useAppStore((s) => s.openSettings);
  const openUpdateModal = useAppStore((s) => s.openUpdateModal);
  const updateAvailableVersion = useAppStore((s) => s.updateAvailableVersion);
  const updateStatus = useAppStore((s) => s.updateStatus);
  const updateProgress = useAppStore((s) => s.updateProgress);

  const addTextToSpread = useEditorStore((s) => s.addTextToSpread);
  const setEditingTextElementId = useEditorStore((s) => s.setEditingTextElementId);

  // Dropdown menus
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [isHelpMenuOpen, setIsHelpMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const helpMenuRef = useRef<HTMLDivElement>(null);

  // Project title inline editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setIsFileMenuOpen(false);
      }
      if (helpMenuRef.current && !helpMenuRef.current.contains(e.target as Node)) {
        setIsHelpMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCommitTitle = async () => {
    const clean = editingTitle.trim();
    if (clean && currentProject && clean !== currentProject.name) {
      try {
        await updateProjectName(clean);
        showToast(`Renamed project to: ${clean}`);
      } catch (err: any) {
        showToast(`⚠️ ${err?.message || err || 'Failed to rename project'}`);
      }
    }
    setIsEditingTitle(false);
  };

  return (
    <header className={styles.titleBar} data-tauri-drag-region>
      {/* Left Section: File & Help Menus, History */}
      <div className={styles.leftSection}>
        {/* File Menu */}
        <div className={styles.menuContainer} ref={fileMenuRef}>
          <button
            type="button"
            className={`${styles.menuBtn} ${isFileMenuOpen ? styles.menuBtnOpen : ''}`}
            onClick={() => setIsFileMenuOpen((v) => !v)}
            title="File Menu"
          >
            <span>File</span>
            <ChevronDown size={12} strokeWidth={1.5} />
          </button>

          {isFileMenuOpen && (
            <div className={styles.dropdownMenu}>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  setIsFileMenuOpen(false);
                  confirmSafeAction(() => openNewProject());
                }}
              >
                <span className={styles.menuItemLeft}>
                  <FilePlus size={14} strokeWidth={1.5} />
                  <span>New Project...</span>
                </span>
                <span className={styles.shortcutText}>⌘N</span>
              </button>

              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  setIsFileMenuOpen(false);
                  confirmSafeAction(async () => {
                    const ok = await importProjectFromAfsn();
                    if (ok) showToast('✓ Project opened successfully');
                  });
                }}
              >
                <span className={styles.menuItemLeft}>
                  <FolderOpen size={14} strokeWidth={1.5} />
                  <span>Open Project...</span>
                </span>
                <span className={styles.shortcutText}>⌘O</span>
              </button>

              {currentProject && (
                <>
                  <div className={styles.menuDivider} />

                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => {
                      setIsFileMenuOpen(false);
                      usePhotoStore.getState().importFiles(currentProject.id);
                    }}
                  >
                    <span className={styles.menuItemLeft}>
                      <FolderOpen size={14} strokeWidth={1.5} />
                      <span>Import Photos...</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => {
                      setIsFileMenuOpen(false);
                      usePhotoStore.getState().importFolder(currentProject.id);
                    }}
                  >
                    <span className={styles.menuItemLeft}>
                      <FolderOpen size={14} strokeWidth={1.5} />
                      <span>Import Entire Folder...</span>
                    </span>
                  </button>

                  <div className={styles.menuDivider} />

                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={async () => {
                      setIsFileMenuOpen(false);
                      const res = await saveProject();
                      if (res.success) {
                        const fileName = res.filePath ? (res.filePath.split(/[\\/]/).pop() || res.filePath) : '';
                        showToast(fileName ? `✓ Project saved to: ${fileName}` : '✓ Project saved to database');
                      }
                    }}
                  >
                    <span className={styles.menuItemLeft}>
                      <Save size={14} strokeWidth={1.5} />
                      <span>Save</span>
                    </span>
                    <span className={styles.shortcutText}>⌘S</span>
                  </button>

                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={async () => {
                      setIsFileMenuOpen(false);
                      const path = await exportProjectAsAfsn();
                      if (path) showToast(`✓ Project saved as: ${path.split(/[\\/]/).pop() || path}`);
                    }}
                  >
                    <span className={styles.menuItemLeft}>
                      <Save size={14} strokeWidth={1.5} />
                      <span>Save As (.afsn)...</span>
                    </span>
                    <span className={styles.shortcutText}>⌘⇧S</span>
                  </button>

                  <div className={styles.menuDivider} />

                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => {
                      setIsFileMenuOpen(false);
                      onOpenExportDialog();
                    }}
                  >
                    <span className={styles.menuItemLeft}>
                      <Download size={14} strokeWidth={1.5} />
                      <span>Export Album...</span>
                    </span>
                    <span className={styles.shortcutText}>⌘E</span>
                  </button>

                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={async () => {
                      setIsFileMenuOpen(false);
                      await exportCompleteProjectPackageWithPhotos();
                    }}
                  >
                    <span className={styles.menuItemLeft}>
                      <Package size={14} strokeWidth={1.5} />
                      <span>Export Project Package (.zip)...</span>
                    </span>
                  </button>

                  <div className={styles.menuDivider} />

                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => {
                      setIsFileMenuOpen(false);
                      openSettings('shortcuts');
                    }}
                  >
                    <span className={styles.menuItemLeft}>
                      <Keyboard size={14} strokeWidth={1.5} />
                      <span>Keyboard Shortcuts...</span>
                    </span>
                    <span className={styles.shortcutText}>F1</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Help Menu */}
        <div className={styles.menuContainer} ref={helpMenuRef}>
          <button
            type="button"
            className={`${styles.menuBtn} ${isHelpMenuOpen ? styles.menuBtnOpen : ''}`}
            onClick={() => setIsHelpMenuOpen((v) => !v)}
            title="Help Menu"
          >
            <span>Help</span>
            <ChevronDown size={12} strokeWidth={1.5} />
          </button>

          {isHelpMenuOpen && (
            <div className={styles.dropdownMenu}>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  setIsHelpMenuOpen(false);
                  openSettings('general');
                }}
              >
                <span className={styles.menuItemLeft}>
                  <Settings size={14} strokeWidth={1.5} />
                  <span>Settings...</span>
                </span>
                <span className={styles.shortcutText}>⌘,</span>
              </button>

              <div className={styles.menuDivider} />

              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  setIsHelpMenuOpen(false);
                  openAbout();
                }}
              >
                <span className={styles.menuItemLeft}>
                  <Info size={14} strokeWidth={1.5} />
                  <span>About OpenSmartAlbum</span>
                </span>
              </button>
            </div>
          )}
        </div>

        {currentProject && (
          <>
            <div className={styles.separator} />

            {/* Undo / Redo */}
            <div className={styles.historyGroup}>
              <button
                type="button"
                className={styles.historyBtn}
                onClick={undo}
                disabled={!canUndo}
                title="Undo (⌘Z)"
              >
                <Undo2 size={14} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                className={styles.historyBtn}
                onClick={redo}
                disabled={!canRedo}
                title="Redo (⌘⇧Z)"
              >
                <Redo2 size={14} strokeWidth={1.5} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Center Section: Project Title, Unsaved Status & Drag Region */}
      <div className={styles.centerSection} data-tauri-drag-region>
        {currentProject && (
          <div className={styles.projectTitleBadge}>
            <span
              className={`${styles.statusDot} ${saveStatus === 'unsaved' ? styles.statusDotUnsaved : ''}`}
              title={
                saveStatus === 'unsaved'
                  ? 'Unsaved changes (⌘S to save)'
                  : saveStatus === 'saving'
                  ? 'Saving changes...'
                  : `All changes saved${lastSavedAt ? ` (${lastSavedAt})` : ''}`
              }
            />
            {isEditingTitle ? (
              <input
                type="text"
                className={styles.projectNameInput}
                value={editingTitle}
                autoFocus
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={handleCommitTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommitTitle();
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
              />
            ) : (
              <span
                className={styles.projectNameText}
                onClick={() => {
                  setEditingTitle(currentProject.name);
                  setIsEditingTitle(true);
                }}
                title="Click to rename project"
              >
                {currentProject.name}
              </span>
            )}
            <button
              type="button"
              className={styles.closeProjectBtn}
              onClick={() => confirmSafeAction(() => closeProject())}
              title="Close active project"
            >
              <X size={12} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      {/* Right Section: Mode Switcher, Quick Actions & Properties */}
      <div className={styles.rightSection}>
        {currentProject && (
          <>
            {/* Mode Switcher Segmented Shell (Phase 3 readiness) */}
            <div className={styles.modeSwitcher} role="group" aria-label="Editor Mode">
              <button
                type="button"
                className={`${styles.modeBtn} ${activeMode === 'print' ? styles.modeActive : ''}`}
                onClick={() => onModeSelect?.('print')}
                title="Print Album Mode"
              >
                <BookOpen size={13} strokeWidth={1.5} />
                <span>Print Album</span>
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${activeMode === 'carousel' ? styles.modeActive : ''}`}
                onClick={() => {
                  onModeSelect?.('carousel');
                }}
                title="Instagram Carousel Mode (Coming in Phase 3)"
              >
                <Layers size={13} strokeWidth={1.5} />
                <span>Social Carousel</span>
                <span className={styles.modeBadge}>Soon</span>
              </button>
            </div>

            {/* Zoom Controls */}
            {zoomLevel !== undefined && onZoomChange && (
              <div className={styles.zoomControls}>
                <button
                  type="button"
                  className={styles.zoomBtn}
                  onClick={() => onZoomChange((z) => Math.max(25, z - 15))}
                  title="Zoom Out (⌘−)"
                >
                  −
                </button>
                <span className={styles.zoomLevelText}>{zoomLevel}%</span>
                <button
                  type="button"
                  className={styles.zoomBtn}
                  onClick={() => onZoomChange((z) => Math.min(350, z + 15))}
                  title="Zoom In (⌘+)"
                >
                  +
                </button>
                {onFitToScreen && (
                  <button
                    type="button"
                    className={styles.zoomFitBtn}
                    onClick={onFitToScreen}
                    title="Fit Spread to Screen (⌘0)"
                  >
                    Fit
                  </button>
                )}
              </div>
            )}

            {/* Add Text Tool */}
            <button
              type="button"
              className={styles.addTextBtn}
              onClick={() => {
                if (!activeSpreadId) return;
                const newId = addTextToSpread(activeSpreadId);
                if (newId) {
                  setEditingTextElementId(newId);
                  showToast('✓ Added Text Box. Double-click or type to edit.');
                }
              }}
              title="Add Text Box (T)"
            >
              <Type size={13} strokeWidth={1.5} />
              <span>Add Text</span>
            </button>

            {/* Export Album Button */}
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={onOpenExportDialog}
              title="Export Album for Print (⌘E)"
            >
              <Download size={13} strokeWidth={1.5} />
              <span>Export</span>
            </button>

            {/* Properties Toggle Button */}
            <button
              type="button"
              className={`${styles.actionBtn} ${isPropertiesOpen ? styles.actionBtnActive : ''}`}
              onClick={onToggleProperties}
              title={isPropertiesOpen ? 'Hide Properties Panel' : 'Show Properties Panel'}
            >
              {isPropertiesOpen ? (
                <PanelRightClose size={14} strokeWidth={1.5} />
              ) : (
                <PanelRight size={14} strokeWidth={1.5} />
              )}
              <span>Properties</span>
            </button>
          </>
        )}

        {/* Update Notification */}
        {updateStatus === 'downloading' ? (
          <button
            type="button"
            className={`${styles.updateBtn} ${styles.updateBtnDownloading}`}
            onClick={openUpdateModal}
            title="Update is downloading in background. Click to view progress."
          >
            <RefreshCw size={12} strokeWidth={1.5} className={styles.spinnerMini} />
            <span>{updateProgress.percent > 0 ? `${updateProgress.percent}%` : 'Downloading...'}</span>
          </button>
        ) : updateStatus === 'ready' ? (
          <button
            type="button"
            className={`${styles.updateBtn} ${styles.updateBtnReady}`}
            onClick={openUpdateModal}
            title="Update is ready to install. Click to restart."
          >
            <RefreshCw size={12} strokeWidth={1.5} />
            <span>Restart to Update</span>
          </button>
        ) : updateAvailableVersion ? (
          <button
            type="button"
            className={`${styles.updateBtn} ${styles.updateBtnReady}`}
            onClick={openUpdateModal}
            title={`Update to ${updateAvailableVersion} is available. Click to install.`}
          >
            <Zap size={12} strokeWidth={1.5} />
            <span>Update {updateAvailableVersion.startsWith('v') ? updateAvailableVersion : `v${updateAvailableVersion}`}</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}
