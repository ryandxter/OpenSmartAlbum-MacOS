import { useEffect, useState, useMemo } from 'react';
import { Search, Plus, Sparkles, Image as ImageIcon, Box, RefreshCw, Globe, Loader2, Palette, ExternalLink, Unlink } from 'lucide-react';
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

const OPEN_LIBRARY_QUICK_TAGS = [
  'Wedding',
  'Floral',
  'Hearts',
  'Banners',
  'Stars',
  'Camera',
  'Border',
  'Ribbon',
  'Vintage',
  'Rings',
];

export function AssetsPanel({ onApplyToast, activeMode = 'print' }: AssetsPanelProps) {
  const {
    assets,
    openLibraryResults,
    canvaItems,
    canvaStatus,
    activeTab,
    selectedShape,
    searchQuery,
    isLoading,
    isSyncing,
    isOpenSearching,
    isCanvaConnecting,
    isCanvaLoading,
    loadAssets,
    syncCatalog,
    downloadAsset,
    searchOpenLibrary,
    loadCanvaStatus,
    connectCanva,
    disconnectCanva,
    loadCanvaAssets,
    setActiveTab,
    setSelectedShape,
    setSearchQuery,
  } = useAssetStore();

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedLibraryTag, setSelectedLibraryTag] = useState<string>('Wedding');

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
    void loadCanvaStatus();
  }, [loadAssets, syncCatalog, loadCanvaStatus]);

  const handleManualSync = async () => {
    onApplyToast?.('⏳ Syncing online assets catalog...');
    try {
      await syncCatalog();
      onApplyToast?.('✓ Synced 100% free assets catalog');
    } catch {
      onApplyToast?.('ℹ Using local offline assets catalog');
    }
  };

  const handleConnectCanva = async () => {
    onApplyToast?.('⏳ Opening browser for Canva OAuth authorization...');
    try {
      await connectCanva();
      onApplyToast?.('✓ Canva account successfully connected!');
    } catch (err) {
      onApplyToast?.(`❌ Canva connection failed: ${err}`);
    }
  };

  const handleDisconnectCanva = async () => {
    await disconnectCanva();
    onApplyToast?.('ℹ Canva account disconnected');
  };

  const filteredAssets = useMemo(() => {
    if (activeTab === 'openlibrary') {
      return openLibraryResults;
    }
    if (activeTab === 'canva') {
      if (!searchQuery.trim()) return canvaItems;
      const q = searchQuery.toLowerCase().trim();
      return canvaItems.filter((item) =>
        item.title.toLowerCase().includes(q) || (item.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }
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
  }, [assets, openLibraryResults, canvaItems, activeTab, selectedShape, searchQuery]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (activeTab === 'openlibrary') {
      const q = searchQuery.trim() || selectedLibraryTag || 'wedding';
      void searchOpenLibrary(q);
    }
  };

  const handleSelectQuickTag = (tag: string) => {
    setSelectedLibraryTag(tag);
    setSearchQuery(tag);
    void searchOpenLibrary(tag);
  };

  const handleCardClick = async (asset: FrameAssetMeta) => {
    let effectiveAsset = asset;
    if (!effectiveAsset.local_path && effectiveAsset.remote_url) {
      onApplyToast?.(`⏳ Downloading ${asset.title}...`);
      const downloaded = await downloadAsset(asset.id, effectiveAsset.remote_url);
      if (downloaded) {
        effectiveAsset = downloaded;
      }
    }

    if (activeMode === 'carousel') {
      if (activeTab === 'frames' || ((activeTab === 'openlibrary' || activeTab === 'canva') && effectiveAsset.category === 'frame')) {
        if (selectedCarouselFrameIds.length === 1) {
          useCarouselStore.getState().applyFrameOverlayToPhoto(selectedCarouselFrameIds[0]!, effectiveAsset);
          onApplyToast?.(`✓ Applied ${effectiveAsset.title} frame overlay`);
        } else {
          onApplyToast?.('ℹ Select a photo frame to apply this frame overlay');
        }
      } else {
        useCarouselStore.getState().addGraphicElement(activeSlideIndex, effectiveAsset);
        onApplyToast?.(`✓ Added ${effectiveAsset.title} sticker to slide`);
      }
    } else {
      if (activeTab === 'frames' || ((activeTab === 'openlibrary' || activeTab === 'canva') && effectiveAsset.category === 'frame')) {
        if (selectedFrameIds.length === 1 && activeSpreadId) {
          useAlbumStore.getState().applyFrameOverlayToPhoto(activeSpreadId, selectedFrameIds[0]!, effectiveAsset);
          onApplyToast?.(`✓ Applied ${effectiveAsset.title} frame overlay`);
        } else {
          onApplyToast?.('ℹ Select a photo frame to apply this frame overlay');
        }
      } else {
        if (activeSpreadId) {
          useAlbumStore.getState().addGraphicElement(activeSpreadId, effectiveAsset);
          onApplyToast?.(`✓ Added ${effectiveAsset.title} sticker to spread`);
        }
      }
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, asset: FrameAssetMeta) => {
    if (!asset.local_path && asset.remote_url) {
      void downloadAsset(asset.id, asset.remote_url);
    }
    e.dataTransfer.setData('application/x-smartalbum-asset', JSON.stringify(asset));
    e.dataTransfer.setData('text/plain', asset.id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className={styles.container}>
      {/* Header with Category Tabs, Search, and Import */}
      <div className={styles.header}>
        {/* Category Tabs: Frames vs Elements vs Open Library vs Canva */}
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
          <button
            type="button"
            className={`${styles.categoryTab} ${activeTab === 'openlibrary' ? styles.categoryTabActive : ''}`}
            onClick={() => {
              setActiveTab('openlibrary');
              if (openLibraryResults.length === 0) {
                void searchOpenLibrary('wedding');
              }
            }}
            title="Search 200,000+ open-source CC0 vectors, icons & illustrations"
          >
            <Globe size={13} />
            <span>Open Library</span>
          </button>
          <button
            type="button"
            className={`${styles.categoryTab} ${activeTab === 'canva' ? styles.categoryTabActive : ''}`}
            onClick={() => {
              setActiveTab('canva');
              if (canvaStatus?.is_connected && canvaItems.length === 0) {
                void loadCanvaAssets();
              }
            }}
            title="Access your Canva designs and uploaded assets via Canva Connect API"
          >
            <Palette size={13} />
            <span>Canva</span>
          </button>
        </div>

        {/* Actions Row: Search + Sync + Import Custom */}
        <form onSubmit={handleSearchSubmit} className={styles.actionsRow}>
          <div className={styles.searchInputWrapper}>
            <Search size={13} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder={
                activeTab === 'openlibrary'
                  ? 'Search 200k+ open vectors (Press Enter)...'
                  : activeTab === 'canva'
                  ? 'Search your Canva assets...'
                  : `Search ${activeTab}...`
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearchSubmit();
                }
              }}
            />
          </div>
          {activeTab !== 'openlibrary' && activeTab !== 'canva' && (
            <>
              <button
                type="button"
                className={styles.syncBtn}
                onClick={handleManualSync}
                disabled={isSyncing}
                title="Sync & scrape 100% free online assets from upstream/community"
              >
                <RefreshCw size={13} className={isSyncing ? styles.spinning : ''} />
              </button>
              <button
                type="button"
                className={styles.importBtn}
                onClick={() => setIsImportModalOpen(true)}
                title="Import custom PNG/SVG frame or sticker"
              >
                <Plus size={13} />
                <span>Import</span>
              </button>
            </>
          )}
          {activeTab === 'canva' && canvaStatus?.is_connected && (
            <button
              type="button"
              className={styles.syncBtn}
              onClick={() => void loadCanvaAssets()}
              disabled={isCanvaLoading}
              title="Refresh Canva Assets"
            >
              <RefreshCw size={13} className={isCanvaLoading ? styles.spinning : ''} />
            </button>
          )}
        </form>

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

        {/* Quick Suggestion Chips (for Open Library) */}
        {activeTab === 'openlibrary' && (
          <div className={styles.libraryChipsRow}>
            {OPEN_LIBRARY_QUICK_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`${styles.libraryChip} ${selectedLibraryTag === tag ? styles.libraryChipActive : ''}`}
                onClick={() => handleSelectQuickTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid of Assets */}
      <div className={styles.gridContent}>
        {/* Canva Not Connected State */}
        {activeTab === 'canva' && !canvaStatus?.is_connected ? (
          <div className={styles.canvaConnectCard}>
            <div className={styles.canvaLogoCircle}>C</div>
            <h3 className={styles.canvaTitle}>Connect with Canva</h3>
            <p className={styles.canvaSubtitle}>
              Hubungkan akun Canva Anda secara resmi via Canva Connect API / Apps SDK untuk menarik desain dan aset elemen foto Anda langsung ke kanvas.
            </p>
            <div className={styles.canvaMetaBox}>
              <div className={styles.canvaMetaRow}>
                <span>App Client ID:</span>
                <span className={styles.canvaMetaVal}>OC-AaF8fmOD6b3W</span>
              </div>
              <div className={styles.canvaMetaRow}>
                <span>Redirect URI:</span>
                <span className={styles.canvaMetaVal}>http://127.0.0.1:3001/oauth/redirect</span>
              </div>
            </div>
            <button
              type="button"
              className={styles.canvaConnectBtn}
              onClick={handleConnectCanva}
              disabled={isCanvaConnecting}
            >
              {isCanvaConnecting ? (
                <>
                  <Loader2 size={14} className={styles.spinning} />
                  <span>Menunggu Otorisasi Browser...</span>
                </>
              ) : (
                <>
                  <ExternalLink size={14} />
                  <span>Otorisasi dengan Akun Canva</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <>
            {/* Canva Connected Header Bar */}
            {activeTab === 'canva' && canvaStatus?.is_connected && (
              <div className={styles.canvaAccountBar}>
                <div className={styles.canvaAccountInfo}>
                  <Palette size={14} color="#c084fc" />
                  <span>
                    Terhubung: <strong>{canvaStatus.display_name || 'Canva Member'}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.canvaDisconnectBtn}
                  onClick={handleDisconnectCanva}
                  title="Putus koneksi Canva"
                >
                  <Unlink size={11} style={{ display: 'inline', marginRight: 4 }} />
                  Disconnect
                </button>
              </div>
            )}

            {isLoading || isOpenSearching || isCanvaLoading ? (
              <div className={styles.loadingState}>
                <Loader2 size={24} className={styles.spinning} />
                <span>
                  {isOpenSearching
                    ? 'Searching 200,000+ open-source vectors...'
                    : isCanvaLoading
                    ? 'Memuat aset Canva Anda...'
                    : 'Loading assets...'}
                </span>
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className={styles.emptyState}>
                <Box size={28} className={styles.emptyIcon} />
                <span className={styles.emptyText}>
                  {activeTab === 'openlibrary'
                    ? 'No vectors found'
                    : activeTab === 'canva'
                    ? 'Belum ada aset/desain ditemukan di Canva'
                    : `No ${activeTab} found`}
                </span>
                <span className={styles.emptySubtext}>
                  {activeTab === 'openlibrary'
                    ? 'Try searching other keywords like wedding, heart, star, flower, or vintage'
                    : activeTab === 'canva'
                    ? 'Aset yang Anda upload atau desain di Canva akan muncul di sini secara otomatis'
                    : searchQuery
                    ? 'Try clearing search filters or sync online assets'
                    : 'Sync online assets or import your own PNG/SVG asset'}
                </span>
              </div>
            ) : (
              filteredAssets.map((asset) => {
                const rawSrc = asset.thumb_path || asset.local_path || asset.remote_url || '';
                const imgSrc = rawSrc.startsWith('http') ? rawSrc : (rawSrc ? convertFileSrc(rawSrc) : '');

                return (
                  <div
                    key={asset.id}
                    className={styles.assetCard}
                    onClick={() => void handleCardClick(asset)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, asset)}
                    title={`${asset.title} • Drag onto canvas or click to apply`}
                  >
                    <div className={styles.thumbWrapper}>
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={asset.title}
                          className={styles.thumbImg}
                          loading="lazy"
                          onError={() => {
                            if (asset.remote_url && !asset.local_path) {
                              void downloadAsset(asset.id, asset.remote_url);
                            }
                          }}
                        />
                      ) : (
                        <Box size={24} color="#52525b" />
                      )}
                      <span className={activeTab === 'canva' ? styles.badgeCanva : styles.badgeFree}>
                        {activeTab === 'openlibrary'
                          ? 'CC0 / Free'
                          : activeTab === 'canva'
                          ? 'Canva'
                          : '100% Free'}
                      </span>
                      {asset.shape && asset.category === 'frame' && (
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
          </>
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
