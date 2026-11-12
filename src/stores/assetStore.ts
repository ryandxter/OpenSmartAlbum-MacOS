import { create } from 'zustand';
import { listen } from '@tauri-apps/api/event';
import { frameAssetService, FrameAssetMeta, FrameSlotPayload } from '../services/frameAssetService';
import { enrichIconifyResults, searchOpenversePhotos } from '../services/freeAssets';
import { canvaService, CanvaAuthStatus, CanvaFolderInfo } from '../services/canvaService';
import { isTauri } from '../utils/platform';

export type AssetShapeFilter = 'all' | 'rectangle' | 'square' | 'oval' | 'arch' | 'circle';

interface AssetState {
  assets: FrameAssetMeta[];
  openLibraryResults: FrameAssetMeta[];
  openverseResults: FrameAssetMeta[];
  openLibrarySource: 'icons' | 'photos';
  canvaItems: FrameAssetMeta[];
  canvaFolders: CanvaFolderInfo[];
  currentCanvaFolderId: string;
  currentCanvaFolderName: string;
  canvaStatus: CanvaAuthStatus | null;
  activeTab: 'frames' | 'elements' | 'openlibrary' | 'canva';
  selectedShape: AssetShapeFilter;
  searchQuery: string;
  isLoading: boolean;
  isSyncing: boolean;
  isOpenSearching: boolean;
  isCanvaConnecting: boolean;
  isCanvaLoading: boolean;

  loadAssets: () => Promise<void>;
  syncCatalog: (url?: string) => Promise<void>;
  downloadAsset: (id: string, remoteUrl: string) => Promise<FrameAssetMeta | null>;
  searchOpenLibrary: (query: string) => Promise<void>;
  searchOpenverse: (query: string) => Promise<void>;
  setOpenLibrarySource: (source: 'icons' | 'photos') => void;
  loadCanvaStatus: () => Promise<void>;
  connectCanva: () => Promise<void>;
  completeCanvaOAuth: (code: string) => Promise<void>;
  disconnectCanva: () => Promise<void>;
  loadCanvaAssets: (folderId?: string, folderName?: string) => Promise<void>;
  selectCanvaFolder: (folderId: string, folderName: string) => Promise<void>;
  importAsset: (
    filePath: string,
    category: 'frame' | 'element',
    shape?: string,
    customSlot?: FrameSlotPayload
  ) => Promise<FrameAssetMeta | null>;
  deleteAsset: (id: string) => Promise<void>;
  setActiveTab: (tab: 'frames' | 'elements' | 'openlibrary' | 'canva') => void;
  setSelectedShape: (shape: AssetShapeFilter) => void;
  setSearchQuery: (query: string) => void;
}

export const useAssetStore = create<AssetState>((set, get) => {
  if (isTauri()) {
    void listen<CanvaAuthStatus>('canva-oauth-success', (event) => {
      if (event.payload) {
        set({ canvaStatus: event.payload, isCanvaConnecting: false });
        void get().loadCanvaAssets();
      } else {
        void get().loadCanvaStatus();
      }
    });
  }

  return {
  assets: [],
  openLibraryResults: [],
  openverseResults: [],
  openLibrarySource: 'icons',
  canvaItems: [],
  canvaFolders: [],
  currentCanvaFolderId: 'uploads',
  currentCanvaFolderName: 'Uploads (Media & Aset)',
  canvaStatus: null,
  activeTab: 'frames',
  selectedShape: 'all',
  searchQuery: '',
  isLoading: false,
  isSyncing: false,
  isOpenSearching: false,
  isCanvaConnecting: false,
  isCanvaLoading: false,

  loadAssets: async () => {
    set({ isLoading: true });
    try {
      const items = await frameAssetService.listFrameAssets();
      set({ assets: items, isLoading: false });
    } catch (err) {
      console.error('[assetStore] Failed to load assets:', err);
      set({ isLoading: false });
    }
  },

  loadCanvaStatus: async () => {
    try {
      const status = await canvaService.getAuthStatus();
      set({ canvaStatus: status });
      if (status.is_connected) {
        void get().loadCanvaAssets();
      }
    } catch (err) {
      console.warn('[assetStore] Failed loading Canva status:', err);
    }
  },

  connectCanva: async () => {
    set({ isCanvaConnecting: true });
    try {
      const status = await canvaService.startOAuth();
      set({ canvaStatus: status, isCanvaConnecting: false });
      if (status.is_connected) {
        void get().loadCanvaAssets();
      }
    } catch (err) {
      console.error('[assetStore] Failed connecting Canva:', err);
      set({ isCanvaConnecting: false });
      throw err;
    }
  },

  completeCanvaOAuth: async (code: string) => {
    set({ isCanvaConnecting: true });
    try {
      const status = await canvaService.completeOAuth(code);
      set({ canvaStatus: status, isCanvaConnecting: false });
      if (status.is_connected) {
        void get().loadCanvaAssets();
      }
    } catch (err) {
      console.error('[assetStore] Failed completing Canva OAuth:', err);
      set({ isCanvaConnecting: false });
      throw err;
    }
  },

  disconnectCanva: async () => {
    try {
      await canvaService.disconnect();
      set({
        canvaStatus: {
          is_connected: false,
          client_id: 'OC-AaF8fmOD6b3W',
          redirect_uri: 'https://auth-osa.rvmeur.com/canva/callback',
          display_name: null,
        },
        canvaItems: [],
        canvaFolders: [],
        currentCanvaFolderId: 'uploads',
        currentCanvaFolderName: 'Uploads (Media & Aset)',
      });
    } catch (err) {
      console.error('[assetStore] Failed disconnecting Canva:', err);
    }
  },

  loadCanvaAssets: async (folderId?: string, folderName?: string) => {
    set({ isCanvaLoading: true });
    try {
      const targetId = folderId || get().currentCanvaFolderId || 'uploads';
      const targetName = folderName || (targetId === 'uploads' ? 'Uploads (Media & Aset)' : get().currentCanvaFolderName);
      const res = await canvaService.listAssets(targetId);
      set({
        canvaItems: res.assets,
        canvaFolders: res.folders,
        currentCanvaFolderId: res.current_folder,
        currentCanvaFolderName: targetName,
        isCanvaLoading: false,
      });
    } catch (err) {
      console.error('[assetStore] Failed loading Canva assets:', err);
      set({ isCanvaLoading: false });
    }
  },

  selectCanvaFolder: async (folderId: string, folderName: string) => {
    await get().loadCanvaAssets(folderId, folderName);
  },

  syncCatalog: async (url?: string) => {
    set({ isSyncing: true });
    try {
      const items = await frameAssetService.syncCatalog(url);
      set({ assets: items, isSyncing: false });
    } catch (err) {
      console.error('[assetStore] Failed to sync catalog:', err);
      set({ isSyncing: false });
    }
  },

  downloadAsset: async (id: string, remoteUrl: string) => {
    try {
      const downloaded = await frameAssetService.downloadAsset(id, remoteUrl);
      if (downloaded) {
        // The Rust download step returns a SYNTHETIC meta: title derived
        // from the id, generic tags, and no search-time license. Merge it
        // over the search record so the local paths land but the title,
        // tags, aspect and license provenance survive — in state AND in
        // the value returned to insert callers.
        const s0 = get();
        const existing =
          s0.openLibraryResults.find((a) => a.id === id) ??
          s0.openverseResults.find((a) => a.id === id) ??
          s0.assets.find((a) => a.id === id);
        const enriched: FrameAssetMeta = {
          ...downloaded,
          title: existing?.title ?? downloaded.title,
          tags: existing?.tags?.length ? existing.tags : downloaded.tags,
          license: downloaded.license ?? existing?.license ?? null,
          aspect: existing?.aspect ?? null,
        };
        const swap = (a: FrameAssetMeta): FrameAssetMeta => (a.id === id ? enriched : a);
        set((s) => ({
          assets: s.assets.some((a) => a.id === id) ? s.assets.map(swap) : [enriched, ...s.assets],
          openLibraryResults: s.openLibraryResults.map(swap),
          openverseResults: s.openverseResults.map(swap),
        }));
        return enriched;
      }
      return downloaded;
    } catch (err) {
      console.error('[assetStore] Failed to download asset:', err);
      return null;
    }
  },

  searchOpenLibrary: async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      set({ openLibraryResults: [] });
      return;
    }
    set({ isOpenSearching: true });
    try {
      const results = await frameAssetService.searchOpenLibrary(trimmed, 36);
      // Keep only permissive-license icon sets (MIT/ISC/Apache) and
      // attach license provenance to each surviving result.
      set({ openLibraryResults: enrichIconifyResults(results), isOpenSearching: false });
    } catch (err) {
      console.error('[assetStore] Failed searching open library:', err);
      set({ isOpenSearching: false });
    }
  },

  searchOpenverse: async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      set({ openverseResults: [] });
      return;
    }
    set({ isOpenSearching: true });
    try {
      const results = await searchOpenversePhotos(trimmed, 24);
      set({ openverseResults: results, isOpenSearching: false });
    } catch (err) {
      console.error('[assetStore] Failed searching Openverse:', err);
      set({ isOpenSearching: false });
    }
  },

  setOpenLibrarySource: (source: 'icons' | 'photos') => {
    set({ openLibrarySource: source });
  },

  importAsset: async (filePath, category, shape, customSlot) => {
    try {
      const imported = await frameAssetService.importCustomAsset(filePath, category, shape, customSlot);
      await get().loadAssets();
      return imported;
    } catch (err) {
      console.error('[assetStore] Failed to import asset:', err);
      return null;
    }
  },

  deleteAsset: async (id) => {
    try {
      await frameAssetService.deleteAsset(id);
      set((s) => ({ assets: s.assets.filter((a) => a.id !== id) }));
    } catch (err) {
      console.error('[assetStore] Failed to delete asset:', err);
    }
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedShape: (shape) => set({ selectedShape: shape }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  };
});
