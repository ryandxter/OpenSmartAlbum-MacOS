import { create } from 'zustand';
import { listen } from '@tauri-apps/api/event';
import { frameAssetService, FrameAssetMeta, FrameSlotPayload } from '../services/frameAssetService';
import { canvaService, CanvaAuthStatus } from '../services/canvaService';
import { isTauri } from '../utils/platform';

export type AssetShapeFilter = 'all' | 'rectangle' | 'square' | 'oval' | 'arch' | 'circle';

interface AssetState {
  assets: FrameAssetMeta[];
  openLibraryResults: FrameAssetMeta[];
  canvaItems: FrameAssetMeta[];
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
  loadCanvaStatus: () => Promise<void>;
  connectCanva: () => Promise<void>;
  completeCanvaOAuth: (code: string) => Promise<void>;
  disconnectCanva: () => Promise<void>;
  loadCanvaAssets: () => Promise<void>;
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
  canvaItems: [],
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
      });
    } catch (err) {
      console.error('[assetStore] Failed disconnecting Canva:', err);
    }
  },

  loadCanvaAssets: async () => {
    set({ isCanvaLoading: true });
    try {
      const items = await canvaService.listAssets();
      set({ canvaItems: items, isCanvaLoading: false });
    } catch (err) {
      console.error('[assetStore] Failed loading Canva assets:', err);
      set({ isCanvaLoading: false });
    }
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
        set((s) => ({
          assets: s.assets.some((a) => a.id === id)
            ? s.assets.map((a) => (a.id === id ? downloaded : a))
            : [downloaded, ...s.assets],
          openLibraryResults: s.openLibraryResults.map((a) => (a.id === id ? downloaded : a)),
        }));
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
      set({ openLibraryResults: results, isOpenSearching: false });
    } catch (err) {
      console.error('[assetStore] Failed searching open library:', err);
      set({ isOpenSearching: false });
    }
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
