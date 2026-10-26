import { useEffect, useState } from 'react';
import { HardDrive, Trash2, RefreshCw, Sparkles } from 'lucide-react';
import { frameAssetService } from '../../../services/frameAssetService';
import { isTauri } from '../../../utils/platform';
import styles from '../SettingsDialog.module.css';

interface CacheMetric {
  fileCount: number;
  totalBytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, idx);
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export function StorageSettingsTab() {
  const [photoStats, setPhotoStats] = useState<CacheMetric>({ fileCount: 0, totalBytes: 0 });
  const [frameStats, setFrameStats] = useState<CacheMetric>({ fileCount: 0, totalBytes: 0 });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const fetchStats = async () => {
    if (!isTauri()) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const [photoRes, frameRes] = await Promise.all([
        invoke<CacheMetric>('get_photo_cache_stats').catch(() => ({ fileCount: 0, totalBytes: 0 })),
        frameAssetService.getFrameAssetsStorageStats().catch(() => ({ fileCount: 0, totalBytes: 0 })),
      ]);
      setPhotoStats(photoRes);
      setFrameStats(frameRes);
    } catch (err) {
      console.warn('[StorageSettingsTab] Failed to load cache stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchStats();
  }, []);

  const handleCleanPhotoCache = async () => {
    if (!isTauri() || isBusy) return;
    setIsBusy(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const cleaned = await invoke<{ removedFiles: number; reclaimedBytes: number }>('clean_unused_photo_cache');
      await fetchStats();
      setNotice(
        cleaned.removedFiles > 0
          ? `Reclaimed ${formatBytes(cleaned.reclaimedBytes)} (${cleaned.removedFiles} files).`
          : 'No unused preview files found.'
      );
    } catch (err) {
      setNotice(`Cleanup failed: ${String(err)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleClearFrameAssets = async () => {
    if (!isTauri() || isBusy) return;
    setIsBusy(true);
    try {
      await frameAssetService.clearFrameAssetsCache();
      await frameAssetService.syncCatalog();
      await fetchStats();
      setNotice('Frame assets cache cleared and reset to default catalog.');
    } catch (err) {
      setNotice(`Clear failed: ${String(err)}`);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>Local Storage &amp; Asset Cache</div>
        <div className={styles.sectionSubtitle}>
          Monitor disk space utilized by cached thumbnails, full-resolution previews, and decorative frame assets.
        </div>
      </div>

      {/* Photo Preview Cache Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.cardTitle}>Photo Preview Cache</div>
            <div className={styles.cardSubtitle}>
              Temporary downsampled previews and filmstrip thumbnails. Original photos are never modified.
            </div>
          </div>
        </div>

        <div className={styles.generalCardBody}>
          <div className={styles.cacheMetricPanel}>
            <div className={styles.cacheMetricIcon}>
              <HardDrive size={18} strokeWidth={1.5} />
            </div>
            <div className={styles.cacheMetricCopy}>
              <strong>Photo Previews &amp; Thumbnails</strong>
              <span>
                {isLoading ? 'Calculating usage…' : `${photoStats.fileCount} generated files`}
              </span>
            </div>
            <span className={styles.cacheSizeValue}>
              {isLoading ? '—' : formatBytes(photoStats.totalBytes)}
            </span>
          </div>

          <div className={styles.actionStrip}>
            <div className={styles.actionStripCopy}>
              <strong>Clean Up Unused Previews</strong>
              <span>Reclaims storage from closed and inactive projects.</span>
            </div>
            <button
              type="button"
              className={styles.generalActionButton}
              onClick={handleCleanPhotoCache}
              disabled={!isTauri() || isLoading || isBusy}
            >
              <Trash2 size={14} strokeWidth={1.5} />
              Clean Up
            </button>
          </div>
        </div>
      </div>

      {/* Decorative Frame Overlays & Graphics Cache Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.cardTitle}>Decorative Frame Assets Cache</div>
            <div className={styles.cardSubtitle}>
              Custom imported frames, stickers, and locally cached visual assets.
            </div>
          </div>
        </div>

        <div className={styles.generalCardBody}>
          <div className={styles.cacheMetricPanel}>
            <div className={styles.cacheMetricIcon}>
              <Sparkles size={18} strokeWidth={1.5} />
            </div>
            <div className={styles.cacheMetricCopy}>
              <strong>Frame Overlays &amp; Stickers</strong>
              <span>
                {isLoading ? 'Calculating usage…' : `${frameStats.fileCount} cached assets`}
              </span>
            </div>
            <span className={styles.cacheSizeValue}>
              {isLoading ? '—' : formatBytes(frameStats.totalBytes)}
            </span>
          </div>

          <div className={styles.actionStrip}>
            <div className={styles.actionStripCopy}>
              <strong>Reset Asset Cache</strong>
              <span>Clears imported assets and restores default offline catalog.</span>
            </div>
            <button
              type="button"
              className={styles.generalActionButton}
              onClick={handleClearFrameAssets}
              disabled={!isTauri() || isLoading || isBusy}
            >
              <RefreshCw size={14} strokeWidth={1.5} />
              Reset Cache
            </button>
          </div>
        </div>
      </div>

      {notice && (
        <div className={styles.generalNotice} role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
