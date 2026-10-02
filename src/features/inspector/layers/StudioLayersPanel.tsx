import React, { useState, useMemo, useCallback } from 'react';
import {
  Search,
  X,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Layers,
  ArrowUpToLine,
  ArrowDownToLine,
} from 'lucide-react';
import { useAlbumStore } from '../../../stores/albumStore';
import { useEditorStore } from '../../../stores/editorStore';
import { useCarouselStore } from '../../../stores/carouselStore';
import { getAllAlbumSpreads } from '../../../domain/album';
import {
  normalizeAlbumElementToLayer,
  normalizeCarouselElementToLayer,
  StudioLayer,
} from './types';
import { LayerCard } from './LayerCard';
import { useLayersDragAndDrop } from './useLayersDragAndDrop';
import styles from './StudioLayersPanel.module.css';

export interface StudioLayersPanelProps {
  mode?: 'print' | 'carousel';
}

export function StudioLayersPanel({ mode = 'print' }: StudioLayersPanelProps) {
  // Search Query State
  const [filterQuery, setFilterQuery] = useState('');

  // Print Mode Selectors
  const currentAlbum = useAlbumStore((s) => s.currentAlbum);
  const activeSpreadId = useAlbumStore((s) => s.activeSpreadId);
  const reorderAlbumLayers = useAlbumStore((s) => s.reorderLayers);
  const toggleAlbumVisibility = useAlbumStore((s) => s.toggleElementVisibility);
  const toggleAlbumLock = useAlbumStore((s) => s.toggleElementLock);
  const renameAlbumElement = useAlbumStore((s) => s.renameElement);
  const setAllAlbumLock = useAlbumStore((s) => s.setAllElementsLock);
  const setAllAlbumVisibility = useAlbumStore((s) => s.setAllElementsVisibility);
  const deleteAlbumElement = useAlbumStore((s) => s.deleteSingleElement);

  // Editor Store Selection
  const selectedFrameIds = useEditorStore((s) => s.selectedFrameIds);
  const selectFrame = useEditorStore((s) => s.selectFrame);
  const clearSelection = useEditorStore((s) => s.clearSelection);

  // Carousel Mode Selectors
  const currentCarousel = useCarouselStore((s) => s.currentCarousel);
  const activeSlideIndex = useCarouselStore((s) => s.activeSlideIndex);
  const carouselSelectedIds = useCarouselStore((s) => s.selectedFrameIds);
  const reorderCarouselLayers = useCarouselStore((s) => s.reorderLayers);
  const toggleCarouselVisibility = useCarouselStore((s) => s.toggleElementVisibility);
  const toggleCarouselLock = useCarouselStore((s) => s.toggleElementLock);
  const renameCarouselElement = useCarouselStore((s) => s.renameElement);
  const setAllCarouselLock = useCarouselStore((s) => s.setAllElementsLock);
  const setAllCarouselVisibility = useCarouselStore((s) => s.setAllElementsVisibility);
  const deleteCarouselElement = useCarouselStore((s) => s.deleteSingleElement);
  const toggleCarouselSelection = useCarouselStore((s) => s.toggleFrameSelection);
  const setCarouselSelectedIds = useCarouselStore((s) => s.setSelectedFrameIds);

  // Active target elements normalization
  const allSpreads = currentAlbum ? getAllAlbumSpreads(currentAlbum) : [];
  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];

  const activeSlide = currentCarousel?.slides[activeSlideIndex];

  // Inverted UI Layers List (Slot 0 = Frontmost / Highest Z-Index)
  const rawLayers: StudioLayer[] = useMemo(() => {
    if (mode === 'carousel') {
      const elements = activeSlide?.elements || [];
      const total = elements.length;
      return elements
        .map((el, idx) => normalizeCarouselElementToLayer(el, idx, total))
        .reverse();
    }
    const elements = activeSpread?.elements || [];
    const total = elements.length;
    return elements
      .map((el, idx) => normalizeAlbumElementToLayer(el, idx, total))
      .reverse();
  }, [mode, activeSlide?.elements, activeSpread?.elements]);

  // Filtered Layers
  const layers: StudioLayer[] = useMemo(() => {
    if (!filterQuery.trim()) return rawLayers;
    const q = filterQuery.toLowerCase();
    return rawLayers.filter(
      (l) =>
        (l.name && l.name.toLowerCase().includes(q)) ||
        l.defaultTitle.toLowerCase().includes(q) ||
        l.kind.toLowerCase().includes(q) ||
        (l.textSnippet && l.textSnippet.toLowerCase().includes(q))
    );
  }, [rawLayers, filterQuery]);

  const activeSelectedIds = mode === 'carousel' ? carouselSelectedIds : selectedFrameIds;

  // Reorder Commit Callback
  const handleCommitReorder = useCallback(
    (movingIds: string[], targetSlotIndex: number) => {
      if (filterQuery.trim()) return; // Disable reordering while actively searching
      if (mode === 'carousel') {
        reorderCarouselLayers(activeSlideIndex, movingIds, targetSlotIndex);
      } else if (activeSpread) {
        reorderAlbumLayers(activeSpread.id, movingIds, targetSlotIndex);
      }
    },
    [mode, activeSlideIndex, activeSpread, filterQuery, reorderCarouselLayers, reorderAlbumLayers]
  );

  const {
    isDragging,
    draggedLayerId,
    indicatorY,
    containerRef,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  } = useLayersDragAndDrop({
    layers,
    selectedIds: activeSelectedIds,
    onCommitReorder: handleCommitReorder,
  });

  // Master Actions
  const allLocked = rawLayers.length > 0 && rawLayers.every((l) => l.locked);
  const allHidden = rawLayers.length > 0 && rawLayers.every((l) => l.hidden);

  const handleToggleAllLock = () => {
    if (mode === 'carousel') {
      setAllCarouselLock(activeSlideIndex, !allLocked);
    } else if (activeSpread) {
      setAllAlbumLock(activeSpread.id, !allLocked);
    }
  };

  const handleToggleAllVisibility = () => {
    if (mode === 'carousel') {
      setAllCarouselVisibility(activeSlideIndex, allHidden);
    } else if (activeSpread) {
      setAllAlbumVisibility(activeSpread.id, allHidden);
    }
  };

  // Selection Handler
  const handleSelectLayer = (e: React.MouseEvent, layerId: string) => {
    const isMulti = Boolean(e.shiftKey || e.metaKey || e.ctrlKey);
    if (mode === 'carousel') {
      toggleCarouselSelection(layerId, isMulti);
    } else {
      selectFrame(layerId, isMulti);
    }
  };

  const handleClearSelection = () => {
    if (mode === 'carousel') {
      setCarouselSelectedIds([]);
    } else {
      clearSelection();
    }
  };

  const handleBringToFront = () => {
    if (activeSelectedIds.length === 0) return;
    handleCommitReorder(activeSelectedIds, 0);
  };

  const handleSendToBack = () => {
    if (activeSelectedIds.length === 0) return;
    handleCommitReorder(activeSelectedIds, rawLayers.length);
  };

  // Layer Row Actions
  const handleToggleVisibility = (id: string) => {
    if (mode === 'carousel') {
      toggleCarouselVisibility(activeSlideIndex, id);
    } else if (activeSpread) {
      toggleAlbumVisibility(activeSpread.id, id);
    }
  };

  const handleToggleLock = (id: string) => {
    if (mode === 'carousel') {
      toggleCarouselLock(activeSlideIndex, id);
    } else if (activeSpread) {
      toggleAlbumLock(activeSpread.id, id);
    }
  };

  const handleRename = (id: string, name: string) => {
    if (mode === 'carousel') {
      renameCarouselElement(activeSlideIndex, id, name);
    } else if (activeSpread) {
      renameAlbumElement(activeSpread.id, id, name);
    }
  };

  const handleDelete = (id: string) => {
    if (mode === 'carousel') {
      deleteCarouselElement(activeSlideIndex, id);
    } else if (activeSpread) {
      deleteAlbumElement(activeSpread.id, id);
    }
  };

  return (
    <div className={styles.layersContainer}>
      {/* 1. Header Bar */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.contextBadge}>
            <Layers size={13} className={styles.headerIcon} />
            <span className={styles.contextText}>
              {mode === 'carousel'
                ? `Slide ${activeSlideIndex + 1} (${rawLayers.length})`
                : `${activeSpread?.name || 'Spread'} (${rawLayers.length})`}
            </span>
          </div>

          <div className={styles.batchActions}>
            <button
              type="button"
              className={styles.headerActionBtn}
              title={allLocked ? 'Unlock All (⌥⇧⌘L)' : 'Lock All (⇧⌘L)'}
              onClick={handleToggleAllLock}
              aria-label={allLocked ? 'Unlock all layers' : 'Lock all layers'}
            >
              {allLocked ? <Lock size={13} className={styles.lockActive} /> : <Unlock size={13} />}
            </button>
            <button
              type="button"
              className={styles.headerActionBtn}
              title={allHidden ? 'Show All (⇧⌘H)' : 'Hide All (⇧⌘H)'}
              onClick={handleToggleAllVisibility}
              aria-label={allHidden ? 'Show all layers' : 'Hide all layers'}
            >
              {allHidden ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>

        {/* 2. Contextual Selection Action Strip vs Search Filter */}
        {activeSelectedIds.length > 0 ? (
          <div className={styles.selectionBar}>
            <span className={styles.selectedCountBadge}>
              {activeSelectedIds.length} Selected
            </span>
            <div className={styles.selectionActions}>
              <button
                type="button"
                className={styles.stepperBtn}
                title="Bring to Front (⇧⌘])"
                aria-label="Bring to Front"
                onClick={handleBringToFront}
              >
                <ArrowUpToLine size={13} />
              </button>
              <button
                type="button"
                className={styles.stepperBtn}
                title="Send to Back (⇧⌘[)"
                aria-label="Send to Back"
                onClick={handleSendToBack}
              >
                <ArrowDownToLine size={13} />
              </button>
              <button
                type="button"
                className={styles.stepperBtn}
                title="Deselect All (Esc)"
                aria-label="Deselect All"
                onClick={handleClearSelection}
              >
                <X size={13} />
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.searchBar}>
            <Search size={12} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Filter layers..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
            />
            {filterQuery && (
              <button
                type="button"
                className={styles.clearSearchBtn}
                onClick={() => setFilterQuery('')}
                title="Clear filter"
                aria-label="Clear filter"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. Scrollable Layer Cards List */}
      <div
        ref={containerRef}
        className={styles.listContainer}
        role="listbox"
        aria-label="Layer Hierarchy"
        aria-multiselectable="true"
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
      >
        {/* Insertion Line Indicator */}
        {isDragging && indicatorY !== null && (
          <div
            className={styles.insertionLine}
            style={{ top: `${indicatorY}px` }}
            aria-hidden="true"
          />
        )}

        {layers.length === 0 ? (
          <div className={styles.emptyState}>
            <Layers size={28} className={styles.emptyIcon} />
            <span className={styles.emptyTitle}>No layers on active {mode === 'carousel' ? 'slide' : 'spread'}</span>
            <span className={styles.emptySubtitle}>Drag photos from tray or press T to add text</span>
          </div>
        ) : (
          layers.map((layer, index) => (
            <LayerCard
              key={layer.id}
              layer={layer}
              index={index}
              isSelected={activeSelectedIds.includes(layer.id)}
              isMultiSelected={activeSelectedIds.length > 1 && activeSelectedIds.includes(layer.id)}
              isDragging={isDragging && draggedLayerId === layer.id}
              onSelect={handleSelectLayer}
              onToggleVisibility={handleToggleVisibility}
              onToggleLock={handleToggleLock}
              onRename={handleRename}
              onDelete={handleDelete}
              onDragStartHandle={handleDragStart}
              onDragOverHandle={handleDragOver}
            />
          ))
        )}
      </div>
    </div>
  );
}
