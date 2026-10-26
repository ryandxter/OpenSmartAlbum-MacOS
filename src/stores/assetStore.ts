import { create } from 'zustand';
import { frameAssetService, FrameAssetMeta, FrameSlotPayload } from '../services/frameAssetService';

export type AssetShapeFilter = 'all' | 'rectangle' | 'square' | 'oval' | 'arch' | 'circle';

interface AssetState {
  assets: FrameAssetMeta[];
  activeTab: 'frames' | 'elements';
  selectedShape: AssetShapeFilter;
  searchQuery: string;
  isLoading: boolean;
  isSyncing: boolean;

  loadAssets: () => Promise<void>;
  syncCatalog: (url?: string) => Promise<void>;
  importAsset: (
    filePath: string,
    category: 'frame' | 'element',
    shape?: string,
    customSlot?: FrameSlotPayload
  ) => Promise<FrameAssetMeta | null>;
  deleteAsset: (id: string) => Promise<void>;
  setActiveTab: (tab: 'frames' | 'elements') => void;
  setSelectedShape: (shape: AssetShapeFilter) => void;
  setSearchQuery: (query: string) => void;
}

export const useAssetStore = create<AssetState>((set, get) => ({
  assets: [],
  activeTab: 'frames',
  selectedShape: 'all',
  searchQuery: '',
  isLoading: false,
  isSyncing: false,

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
}));
