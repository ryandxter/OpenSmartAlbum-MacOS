import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { isTauri } from '../utils/platform';
import type { AssetLicenseInfo } from '../domain/editor';

export interface FrameSlotPayload {
  slotX: number;
  slotY: number;
  slotWidth: number;
  slotHeight: number;
  shape?: string;
}

export interface FrameAssetMeta {
  id: string;
  title: string;
  category: 'frame' | 'element';
  shape: string; // 'rectangle' | 'square' | 'oval' | 'arch' | 'circle'
  slot?: FrameSlotPayload | null;
  is_pro: boolean;
  local_path: string;
  thumb_path: string;
  remote_url?: string | null;
  tags: string[];
  created_at?: string | null;
  /** License provenance for free-asset results (TS-side; not a Rust field) */
  license?: AssetLicenseInfo | null;
  /** Natural width/height ratio for raster results, when the provider reports dimensions */
  aspect?: number | null;
}

/** One raw Openverse image record, as returned by the API (pre-filter). */
export interface OpenverseRawResult {
  id: string;
  title?: string;
  url: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  license: string;
  license_url?: string;
  creator?: string;
  attribution?: string;
  foreign_landing_url?: string;
}

export interface OpenverseSearchResponse {
  results?: OpenverseRawResult[];
}

export const frameAssetService = {
  async listFrameAssets(): Promise<FrameAssetMeta[]> {
    if (!isTauri()) {
      return [];
    }
    try {
      return await invoke<FrameAssetMeta[]>('list_cached_frame_assets');
    } catch (err) {
      console.error('[frameAssetService] Failed to list frame assets:', err);
      return [];
    }
  },

  async syncCatalog(catalogUrl?: string): Promise<FrameAssetMeta[]> {
    if (!isTauri()) {
      return [];
    }
    try {
      return await invoke<FrameAssetMeta[]>('sync_frame_asset_catalog', { catalogUrl });
    } catch (err) {
      console.warn('[frameAssetService] Catalog sync fallback:', err);
      return await this.listFrameAssets();
    }
  },

  async downloadAsset(id: string, remoteUrl: string): Promise<FrameAssetMeta | null> {
    if (!isTauri()) return null;
    try {
      return await invoke<FrameAssetMeta>('download_frame_asset', { id, remoteUrl });
    } catch (err) {
      console.warn('[frameAssetService] Download failed:', err);
      return null;
    }
  },

  async importCustomAsset(
    filePath: string,
    category: 'frame' | 'element' = 'frame',
    shape?: string,
    customSlot?: FrameSlotPayload
  ): Promise<FrameAssetMeta> {
    return await invoke<FrameAssetMeta>('import_custom_frame_asset', {
      filePath,
      category,
      shape: shape || 'rectangle',
      customSlot: customSlot || null,
    });
  },

  async deleteAsset(id: string): Promise<void> {
    await invoke('delete_cached_frame_asset', { id });
  },

  async pickFrameAssetFileDialog(): Promise<string | null> {
    if (!isTauri()) return null;
    return await invoke<string | null>('pick_frame_asset_file_dialog');
  },

  async getFrameAssetsStorageStats(): Promise<{ fileCount: number; totalBytes: number }> {
    if (!isTauri()) return { fileCount: 0, totalBytes: 0 };
    return await invoke<{ fileCount: number; totalBytes: number }>('get_frame_assets_storage_stats');
  },

  async clearFrameAssetsCache(): Promise<void> {
    if (!isTauri()) return;
    await invoke('clear_frame_assets_cache');
  },

  async searchOpenLibrary(query: string, limit = 30): Promise<FrameAssetMeta[]> {
    if (!isTauri()) return [];
    try {
      return await invoke<FrameAssetMeta[]>('search_open_library_assets', { query, limit });
    } catch (err) {
      console.warn('[frameAssetService] Open Library search failed:', err);
      return [];
    }
  },

  /**
   * Openverse photo search via the Rust `search_openverse_photos`
   * command. Unlike searchOpenLibrary this deliberately does NOT
   * swallow errors: freeAssets.searchOpenversePhotos surfaces them in
   * the UI, and the Rust side returns precise messages (HTTP status +
   * body snippet, or the transport error).
   */
  async searchOpenverse(query: string, limit = 24): Promise<OpenverseSearchResponse> {
    if (!isTauri()) throw new Error('Openverse search requires the desktop app');
    return await invoke<OpenverseSearchResponse>('search_openverse_photos', { query, limit });
  },

  resolveAssetUrl(asset: FrameAssetMeta, preferThumb = false): string {
    const targetPath = preferThumb && asset.thumb_path ? asset.thumb_path : asset.local_path;
    if (targetPath) {
      return convertFileSrc(targetPath);
    }
    if (asset.remote_url) {
      return asset.remote_url;
    }
    return '';
  },
};
