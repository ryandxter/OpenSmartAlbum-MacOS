import { useEffect, useState, useMemo } from 'react';
import { Search, Plus, Sparkles, Image as ImageIcon, Box } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useAssetStore, AssetShapeFilter } from '../../stores/assetStore';
import type { FrameAssetMeta } from '../../services/frameAssetService';
import { useAlbumStore } from '../../stores/albumStore';
import { useCarouselStore } from '../../stores/carouselStore';
import { useEditorStore } from '../../stores/editorStore';
import { ImportCustomAssetModal } from './ImportCustomAssetModal';
import styles from './AssetsPanel.module.css';

interface AssetsPanelProps {
  onApplyToast?: (msg: string) => void;
  activeMode?: 'print' | 'carousel';
}

const SHAPE_FILTERS: Array<{ id: AssetShapeFilter; label: string }> = [
  { id: 'all', label: 'All Shapes' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'square', label: 'Square' },
  { id: 'oval', label: 'Oval' },
  { id: 'arch', label: 'Arch' },
  { id: 'circle', label: 'Circle' },
];

export function AssetsPanel({ onApplyToast, activeMode = 'print' }: AssetsPanelProps) {
  const {
    assets,
    activeTab,
    selectedShape,
    searchQuery,
    isLoading,
    loadAssets,
    syncCatalog,
    setActiveTab,
    setSelectedShape,
    setSearchQuery,
  } = useAssetStore();

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Print selection
  const activeSpreadId = useAlbumStore((s) => s.activeSpreadId);
  const selectedFrameIds = useEditorStore((s) => s.selectedFrameIds);

  // Carousel selection
  const activeSlideIndex = useCarouselStore((s) => s.activeSlideIndex);
  const selectedCarouselFrameIds = useCarouselStore((s) => s.selectedFrameIds);

  useEffect(() => {
    void loadAssets().then(() => {
      const current = useAssetStore.getState().assets;
      if (current.length === 0) {
        void syncCatalog();
      }
    });
  }, [loadAssets, syncCatalog]);

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      // 1. Tab category filter
      const expectedCat = activeTab === 'frames' ? 'frame' : 'element';
      if (asset.category !== expectedCat) return false;

      // 2. Shape filter (mainly for frames)
      if (selectedShape !== 'all' && asset.shape.toLowerCase() !== selectedShape.toLowerCase()) {
        return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = asset.title.toLowerCase().includes(q);
        const tagMatch = (asset.tags || []).some((t) => t.toLowerCase().includes(q));
        if (!titleMatch && !tagMatch) return false;
      }

      return true;
    });
  }, [assets, activeTab, selectedShape, searchQuery]);

  const handleCardClick = (asset: FrameAssetMeta) => {
    if (activeMode === 'carousel') {
      if (activeTab === 'frames') {
        if (selectedCarouselFrameIds.length === 1) {
          useCarouselStore.getState().applyFrameOverlayToPhoto(selectedCarouselFrameIds[0]!, asset);
          onApplyToast?.(`✓ Applied ${asset.title} frame overlay`);
        } else {
          onApplyToast?.('ℹ Select a photo frame to apply this frame overlay');
        }
      } else {
        useCarouselStore.getState().addGraphicElement(activeSlideIndex, asset);
        onApplyToast?.(`✓ Added ${asset.title} sticker to slide`);
      }
    } else {
      if (activeTab === 'frames') {
        if (selectedFrameIds.length === 1 && activeSpreadId) {
          useAlbumStore.getState().applyFrameOverlayToPhoto(activeSpreadId, selectedFrameIds[0]!, asset);
          onApplyToast?.(`✓ Applied ${asset.title} frame overlay`);
        } else {
          onApplyToast?.('ℹ Select a photo frame to apply this frame overlay');
        }
      } else {
        if (activeSpreadId) {
          useAlbumStore.getState().addGraphicElement(activeSpreadId, asset);
          onApplyToast?.(`✓ Added ${asset.title} sticker to spread`);
        }
      }
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, asset: FrameAssetMeta) => {
    e.dataTransfer.setData('application/x-smartalbum-asset', JSON.stringify(asset));
    e.dataTransfer.setData('text/plain', asset.id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className={styles.container}>
      {/* Header with Category Tabs, Search, and Import */}
      <div className={styles.header}>
        {/* Category Tabs: Frames vs Elements */}
        <div className={styles.categoryTabs}>
          <button
            type="button"
            className={`${styles.categoryTab} ${activeTab === 'frames' ? styles.categoryTabActive : ''}`}
            onClick={() => setActiveTab('frames')}
          >
            <ImageIcon size={13} />
            <span>Frames</span>
          </button>
          <button
            type="button"
            className={`${styles.categoryTab} ${activeTab === 'elements' ? styles.categoryTabActive : ''}`}
            onClick={() => setActiveTab('elements')}
          >
            <Sparkles size={13} />
            <span>Elements</span>
          </button>
        </div>

        {/* Actions Row: Search + Import Custom */}
        <div className={styles.actionsRow}>
          <div className={styles.searchInputWrapper}>
            <Search size={13} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={styles.importBtn}
            onClick={() => setIsImportModalOpen(true)}
            title="Import custom PNG/SVG frame or sticker"
          >
            <Plus size={13} />
            <span>Import</span>
          </button>
        </div>

        {/* Shape Filter Chips (for frames) */}
        {activeTab === 'frames' && (
          <div className={styles.shapeChipsRow}>
            {SHAPE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`${styles.shapeChip} ${selectedShape === f.id ? styles.shapeChipActive : ''}`}
                onClick={() => setSelectedShape(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid of Assets */}
      <div className={styles.gridContent}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <span>Loading assets...</span>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className={styles.emptyState}>
            <Box size={28} className={styles.emptyIcon} />
            <span className={styles.emptyText}>No {activeTab} found</span>
            <span className={styles.emptySubtext}>
              {searchQuery ? 'Try clearing search filters or import a custom asset' : 'Import your own PNG/SVG asset to get started'}
            </span>
          </div>
        ) : (
          filteredAssets.map((asset) => {
            const rawSrc = asset.thumb_path || asset.local_path || asset.remote_url || '';
            const imgSrc = rawSrc.startsWith('http') ? rawSrc : convertFileSrc(rawSrc);

            return (
              <div
                key={asset.id}
                className={styles.assetCard}
                onClick={() => handleCardClick(asset)}
                draggable
                onDragStart={(e) => handleDragStart(e, asset)}
                title={`${asset.title} • Drag onto canvas or click to apply`}
              >
                <div className={styles.thumbWrapper}>
                  {imgSrc ? (
                    <img src={imgSrc} alt={asset.title} className={styles.thumbImg} loading="lazy" />
                  ) : (
                    <Box size={24} color="#52525b" />
                  )}
                  <span className={styles.badgeFree}>100% Free</span>
                  {asset.shape && (
                    <span className={styles.shapeBadge}>{asset.shape}</span>
                  )}
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.assetTitle}>{asset.title}</span>
                  <span className={styles.assetTag}>{asset.tags?.[0] || asset.category}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Import Modal */}
      {isImportModalOpen && (
        <ImportCustomAssetModal
          isOpen={isImportModalOpen}
          initialCategory={activeTab === 'frames' ? 'frame' : 'element'}
          onClose={() => setIsImportModalOpen(false)}
          onImported={(newAsset: FrameAssetMeta) => {
            setIsImportModalOpen(false);
            onApplyToast?.(`✓ Imported ${newAsset.title}`);
          }}
        />
      )}
    </div>
  );
}
