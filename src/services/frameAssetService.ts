import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { isTauri } from '../utils/platform';

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

  async importCustomAsset(
    filePath: string,
    category: 'frame' | 'element' = 'frame',
    shape?: string
  ): Promise<FrameAssetMeta> {
    return await invoke<FrameAssetMeta>('import_custom_frame_asset', {
      filePath,
      category,
      shape: shape || 'rectangle',
    });
  },

  async deleteAsset(id: string): Promise<void> {
    await invoke('delete_cached_frame_asset', { id });
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
