import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Plus,
  BookmarkPlus,
  Star,
  MoreVertical,
  Folder,
  Trash2,
  Download,
  Zap,
  X,
} from 'lucide-react';
import {
  LayoutTemplate,
  LayoutTemplateSpec,
  generateTemplateSvgPreview,
  applyTemplateToSpread,
  applyTemplateToSlide,
} from '../../domain/templates';
import { useTemplateStore } from '../../stores/templateStore';
import { useAlbumStore } from '../../stores/albumStore';
import { useProjectStore } from '../../stores/projectStore';
import { useCarouselStore } from '../../stores/carouselStore';
import { useHistoryStore } from '../../stores/historyStore';
import { ApplyTemplateDialog } from './ApplyTemplateDialog';
import styles from './MyTemplatesView.module.css';

interface MyTemplatesViewProps {
  onApplyToast?: (msg: string) => void;
  activeMode?: 'print' | 'carousel';
}

export function MyTemplatesView({ onApplyToast, activeMode = 'print' }: MyTemplatesViewProps) {
  const {
    templates,
    folders,
    activeFolderId,
    searchQuery,
    filterType,
    isSaving,
    isApplyModalOpen,
    selectedTemplateForApply,
    lastApplyOptions,
    loadTemplates,
    saveCurrentAsTemplate,
    deleteTemplate,
    toggleFavorite,
    createFolder,
    moveTemplatesToFolder,
    exportTemplate,
    setActiveFolderId,
    setSearchQuery,
    setFilterType,
    openApplyModal,
    closeApplyModal,
  } = useTemplateStore();

  const [activeMenuTemplateId, setActiveMenuTemplateId] = useState<string | null>(null);

  // Save Modal State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [saveTemplateName, setSaveTemplateName] = useState<string>('');
  const [saveFolderId, setSaveFolderId] = useState<string>('');

  // Folder Manager State
  const [isFolderModalOpen, setIsFolderModalOpen] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');

  // Move Modal State
  const [moveTemplateId, setMoveTemplateId] = useState<string | null>(null);
  const [targetMoveFolderId, setTargetMoveFolderId] = useState<string>('');

  // Initial load
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Close context menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuTemplateId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates
      .filter((tpl) => {
        // Folder filter
        if (activeFolderId === 'unfiled') {
          if (tpl.folderId) return false;
        } else if (activeFolderId) {
          if (tpl.folderId !== activeFolderId) return false;
        }

        const spec: LayoutTemplateSpec =
          typeof tpl.payload === 'string'
            ? (() => {
                try {
                  return JSON.parse(tpl.payload);
                } catch {
                  return { name: tpl.name || '', slots: [] };
                }
              })()
            : tpl.payload;

        // Type filter
        const kind = spec.canvas?.kind || 'spread';
        if (filterType === 'spread' && kind !== 'spread') return false;
        if (filterType === 'post' && kind !== 'post' && kind !== 'slide' && kind !== 'single') return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const nameMatch = (tpl.name || spec.name || '').toLowerCase().includes(q);
          if (!nameMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Favorite first, then updated
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      });
  }, [templates, activeFolderId, filterType, searchQuery]);

  // Quick Apply execution (Shift + Click)
  const handleQuickApply = useCallback(
    (tpl: LayoutTemplate) => {
      const spec: LayoutTemplateSpec =
        typeof tpl.payload === 'string'
          ? (() => {
              try {
                return JSON.parse(tpl.payload);
              } catch {
                return { name: tpl.name || 'Template', slots: [] };
              }
            })()
          : tpl.payload;

      if (activeMode === 'carousel') {
        const carousel = useCarouselStore.getState().currentCarousel;
        const slideIndex = useCarouselStore.getState().activeSlideIndex;
        if (!carousel || !carousel.slides[slideIndex]) return;

        const currentSlide = carousel.slides[slideIndex]!;
        useCarouselStore.getState().pushHistory();

        const updatedSlide = applyTemplateToSlide(
          spec,
          currentSlide,
          carousel.slideWidthPx || 1080,
          carousel.slideHeightPx || 1080,
          lastApplyOptions.placementMode,
          lastApplyOptions.styleOpts
        );

        const nextSlides = carousel.slides.map((s, idx) =>
          idx === slideIndex ? updatedSlide : s
        );

        useCarouselStore.setState({
          currentCarousel: { ...carousel, slides: nextSlides },
          saveStatus: 'unsaved',
        });
      } else {
        // Print Mode
        const album = useAlbumStore.getState().currentAlbum;
        const activeSpreadId = useAlbumStore.getState().activeSpreadId;
        const project = useProjectStore.getState().currentProject;

        if (!album || !project) return;

        const isCover = album.coverSpread?.id === activeSpreadId;
        const currentSpread = isCover
          ? album.coverSpread
          : album.spreads.find((s) => s.id === activeSpreadId) || album.spreads[0];

        if (!currentSpread) return;

        useHistoryStore.getState().pushState(album);

        const updatedSpread = applyTemplateToSpread(
          spec,
          currentSpread,
          project,
          lastApplyOptions.targetArea,
          lastApplyOptions.placementMode,
          lastApplyOptions.styleOpts
        );

        if (isCover) {
          useAlbumStore.setState({
            currentAlbum: { ...album, coverSpread: updatedSpread },
            saveStatus: 'unsaved',
          });
        } else {
          const nextSpreads = album.spreads.map((s) =>
            s.id === updatedSpread.id ? updatedSpread : s
          );
          useAlbumStore.setState({
            currentAlbum: { ...album, spreads: nextSpreads },
            saveStatus: 'unsaved',
          });
        }
      }

      onApplyToast?.(`⚡ Quick Applied: ${spec.name}`);
    },
    [activeMode, lastApplyOptions, onApplyToast]
  );

  const handleCardClick = (e: React.MouseEvent, tpl: LayoutTemplate) => {
    if (e.shiftKey) {
      e.preventDefault();
      handleQuickApply(tpl);
    } else {
      openApplyModal(tpl);
    }
  };

  const handleOpenSaveModal = () => {
    setSaveTemplateName('');
    setSaveFolderId(activeFolderId && activeFolderId !== 'unfiled' ? activeFolderId : '');
    setIsSaveModalOpen(true);
  };

  const handleConfirmSave = async () => {
    if (!saveTemplateName.trim()) return;
    const folder = saveFolderId.trim() ? saveFolderId : null;
    const created = await saveCurrentAsTemplate(saveTemplateName.trim(), folder);
    if (created) {
      onApplyToast?.(`Saved layout template: ${created.name}`);
      setIsSaveModalOpen(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const fld = await createFolder(newFolderName.trim());
    if (fld) {
      onApplyToast?.(`Created folder: ${fld.name}`);
      setNewFolderName('');
      setIsFolderModalOpen(false);
    }
  };

  const handleConfirmMove = async () => {
    if (!moveTemplateId) return;
    const folder = targetMoveFolderId.trim() ? targetMoveFolderId : null;
    await moveTemplatesToFolder([moveTemplateId], folder);
    onApplyToast?.('Template moved to folder');
    setMoveTemplateId(null);
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.searchBar} style={{ flex: 1 }}>
            <Search size={12} color="#71717a" />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', padding: 0 }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            type="button"
            className={styles.saveBtn}
            onClick={handleOpenSaveModal}
            title="Save current layout as a custom template"
          >
            <BookmarkPlus size={13} strokeWidth={2} />
            <span>Save Layout</span>
          </button>
        </div>

        {/* Filter and Folder Row */}
        <div className={styles.filterRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <select
              className={styles.folderSelect}
              value={activeFolderId || ''}
              onChange={(e) => setActiveFolderId(e.target.value || null)}
            >
              <option value="">All Folders ({templates.length})</option>
              <option value="unfiled">Unfiled</option>
              {folders.map((fld) => (
                <option key={fld.id} value={fld.id}>
                  📁 {fld.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              className={styles.menuBtn}
              onClick={() => setIsFolderModalOpen(true)}
              title="Create new folder"
            >
              <Plus size={13} />
            </button>
          </div>

          <div className={styles.typeFilterGroup}>
            <button
              type="button"
              className={`${styles.typeBtn} ${filterType === 'all' ? styles.typeBtnActive : ''}`}
              onClick={() => setFilterType('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`${styles.typeBtn} ${filterType === 'spread' ? styles.typeBtnActive : ''}`}
              onClick={() => setFilterType('spread')}
            >
              Spread
            </button>
            <button
              type="button"
              className={`${styles.typeBtn} ${filterType === 'post' ? styles.typeBtnActive : ''}`}
              onClick={() => setFilterType('post')}
            >
              Post
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Template Cards */}
      <div className={styles.cardGrid}>
        {filteredTemplates.map((tpl) => {
          const spec: LayoutTemplateSpec =
            typeof tpl.payload === 'string'
              ? (() => {
                  try {
                    return JSON.parse(tpl.payload);
                  } catch {
                    return { name: tpl.name || '', slots: [] };
                  }
                })()
              : tpl.payload;

          const slotCount = spec.slots ? spec.slots.length : 0;
          const svgPreview = generateTemplateSvgPreview(spec, 130, 65);
          const isMenuOpen = activeMenuTemplateId === tpl.id;

          return (
            <div
              key={tpl.id}
              className={styles.templateCard}
              onClick={(e) => handleCardClick(e, tpl)}
              title="Click to configure and apply. Shift+Click to Quick Apply."
            >
              <div
                className={styles.svgWrapper}
                dangerouslySetInnerHTML={{ __html: svgPreview }}
              />

              <div className={styles.cardMeta}>
                <div className={styles.cardTitleRow}>
                  <span className={styles.templateTitle} title={tpl.name || spec.name}>
                    {tpl.name || spec.name}
                  </span>
                  <button
                    type="button"
                    className={`${styles.starBtn} ${tpl.isFavorite ? styles.starActive : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(tpl.id);
                    }}
                    title={tpl.isFavorite ? 'Unmark favorite' : 'Mark as favorite'}
                  >
                    <Star size={12} fill={tpl.isFavorite ? 'currentColor' : 'none'} strokeWidth={1.5} />
                  </button>
                </div>

                <div className={styles.badgeRow}>
                  <span className={styles.slotBadge}>
                    {slotCount} {slotCount === 1 ? 'Slot' : 'Slots'}
                  </span>

                  <button
                    type="button"
                    className={styles.menuBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuTemplateId(isMenuOpen ? null : tpl.id);
                    }}
                    title="Template options"
                  >
                    <MoreVertical size={13} />
                  </button>
                </div>

                <span className={styles.quickApplyHint}>Shift + Click for Quick Apply</span>
              </div>

              {/* Contextual Menu */}
              {isMenuOpen && (
                <div className={styles.contextMenu} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => {
                      setActiveMenuTemplateId(null);
                      handleQuickApply(tpl);
                    }}
                  >
                    <Zap size={12} color="#38bdf8" />
                    <span>Quick Apply</span>
                  </button>

                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => {
                      setActiveMenuTemplateId(null);
                      setMoveTemplateId(tpl.id);
                      setTargetMoveFolderId(tpl.folderId || '');
                    }}
                  >
                    <Folder size={12} />
                    <span>Move to Folder...</span>
                  </button>

                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={async () => {
                      setActiveMenuTemplateId(null);
                      const exported = await exportTemplate(tpl.id);
                      if (exported) {
                        onApplyToast?.(`Exported template package: ${spec.name}`);
                      }
                    }}
                  >
                    <Download size={12} />
                    <span>Export (.afsnt)</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.menuItem} ${styles.menuItemDanger}`}
                    onClick={() => {
                      setActiveMenuTemplateId(null);
                      if (confirm(`Delete template "${tpl.name || spec.name}"?`)) {
                        deleteTemplate(tpl.id);
                        onApplyToast?.('Template deleted');
                      }
                    }}
                  >
                    <Trash2 size={12} />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {filteredTemplates.length === 0 && (
          <div className={styles.emptyState} style={{ gridColumn: '1 / -1' }}>
            <span className={styles.emptyTitle}>
              {searchQuery ? 'No matching templates' : 'No templates in this view'}
            </span>
            <p style={{ margin: 0 }}>
              {searchQuery
                ? 'Try a different search keyword.'
                : 'Save your current spread or slide layout using the button above, or drop .afsnt / .afsnp files into Albumaker to import.'}
            </p>
          </div>
        )}
      </div>

      {/* Save Layout Modal */}
      {isSaveModalOpen && (
        <div className={styles.modalBackdrop} onClick={() => setIsSaveModalOpen(false)}>
          <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Save Current Layout as Template</span>
              <button
                type="button"
                className={styles.menuBtn}
                onClick={() => setIsSaveModalOpen(false)}
              >
                <X size={15} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Template Name</label>
                <input
                  type="text"
                  className={styles.modalInput}
                  placeholder="e.g. Wedding 4-Up Grid"
                  autoFocus
                  value={saveTemplateName}
                  onChange={(e) => setSaveTemplateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmSave();
                  }}
                />
              </div>

              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Assign to Folder</label>
                <select
                  className={styles.folderSelect}
                  style={{ width: '100%', maxWidth: '100%' }}
                  value={saveFolderId}
                  onChange={(e) => setSaveFolderId(e.target.value)}
                >
                  <option value="">None (Unfiled)</option>
                  {folders.map((fld) => (
                    <option key={fld.id} value={fld.id}>
                      📁 {fld.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnCancel}
                onClick={() => setIsSaveModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnConfirm}
                disabled={!saveTemplateName.trim() || isSaving}
                onClick={handleConfirmSave}
              >
                {isSaving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {isFolderModalOpen && (
        <div className={styles.modalBackdrop} onClick={() => setIsFolderModalOpen(false)}>
          <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Create Template Folder</span>
              <button
                type="button"
                className={styles.menuBtn}
                onClick={() => setIsFolderModalOpen(false)}
              >
                <X size={15} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Folder Name</label>
                <input
                  type="text"
                  className={styles.modalInput}
                  placeholder="e.g. Minimalist, Commercial, Weddings"
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFolder();
                  }}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnCancel}
                onClick={() => setIsFolderModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnConfirm}
                disabled={!newFolderName.trim()}
                onClick={handleCreateFolder}
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Template Modal */}
      {moveTemplateId && (
        <div className={styles.modalBackdrop} onClick={() => setMoveTemplateId(null)}>
          <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Move Template to Folder</span>
              <button
                type="button"
                className={styles.menuBtn}
                onClick={() => setMoveTemplateId(null)}
              >
                <X size={15} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Select Destination Folder</label>
                <select
                  className={styles.folderSelect}
                  style={{ width: '100%', maxWidth: '100%' }}
                  value={targetMoveFolderId}
                  onChange={(e) => setTargetMoveFolderId(e.target.value)}
                >
                  <option value="">Unfiled</option>
                  {folders.map((fld) => (
                    <option key={fld.id} value={fld.id}>
                      📁 {fld.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnCancel}
                onClick={() => setMoveTemplateId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnConfirm}
                onClick={handleConfirmMove}
              >
                Move Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply Template Dialog */}
      <ApplyTemplateDialog
        isOpen={isApplyModalOpen}
        onClose={closeApplyModal}
        template={selectedTemplateForApply}
        activeMode={activeMode}
        onApplyToast={onApplyToast}
      />
    </div>
  );
}
