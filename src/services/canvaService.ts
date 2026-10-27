import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../utils/platform';
import type { FrameAssetMeta } from './frameAssetService';

export interface CanvaAuthStatus {
  is_connected: boolean;
  client_id: string;
  redirect_uri: string;
  display_name: string | null;
}

export const canvaService = {
  async getAuthStatus(): Promise<CanvaAuthStatus> {
    if (!isTauri()) {
      return {
        is_connected: false,
        client_id: 'OC-AaF8fmOD6b3W',
        redirect_uri: 'https://auth-osa.rvmeur.com/canva/callback',
        display_name: null,
      };
    }
    try {
      return await invoke<CanvaAuthStatus>('get_canva_auth_status');
    } catch (err) {
      console.warn('[canvaService] Failed to get auth status:', err);
      return {
        is_connected: false,
        client_id: 'OC-AaF8fmOD6b3W',
        redirect_uri: 'https://auth-osa.rvmeur.com/canva/callback',
        display_name: null,
      };
    }
  },

  async startOAuth(
    clientId?: string,
    clientSecret?: string,
    redirectUri?: string
  ): Promise<CanvaAuthStatus> {
    if (!isTauri()) {
      throw new Error('Canva integration requires Tauri desktop environment');
    }
    return await invoke<CanvaAuthStatus>('start_canva_oauth', {
      clientId: clientId || null,
      clientSecret: clientSecret || null,
      redirectUri: redirectUri || null,
    });
  },

  async disconnect(): Promise<void> {
    if (!isTauri()) return;
    await invoke('disconnect_canva');
  },

  async saveCredentials(clientId?: string, clientSecret?: string): Promise<void> {
    if (!isTauri()) return;
    await invoke('save_canva_credentials', {
      clientId: clientId || null,
      clientSecret: clientSecret || null,
    });
  },

  async listAssets(folderId?: string): Promise<FrameAssetMeta[]> {
    if (!isTauri()) return [];
    try {
      return await invoke<FrameAssetMeta[]>('list_canva_assets', {
        folderId: folderId || null,
      });
    } catch (err) {
      console.error('[canvaService] Failed to list Canva assets:', err);
      return [];
    }
  },

  async downloadAsset(id: string, remoteUrl: string, title: string): Promise<FrameAssetMeta | null> {
    if (!isTauri()) return null;
    try {
      return await invoke<FrameAssetMeta>('download_canva_asset', {
        id,
        remoteUrl,
        title,
      });
    } catch (err) {
      console.error('[canvaService] Failed to download Canva asset:', err);
      return null;
    }
  },
};
