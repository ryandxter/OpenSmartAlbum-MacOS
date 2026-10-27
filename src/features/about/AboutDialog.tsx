import React from 'react';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { APP_CONFIG } from '../../config/app';
import { useAppStore } from '../../stores/appStore';
import { formatPlatform, isTauri } from '../../utils/platform';
import appIcon from '../../assets/app-icon.png';
import styles from './AboutDialog.module.css';

export function AboutDialog() {
  const isAboutOpen = useAppStore((s) => s.isAboutOpen);
  const closeAbout = useAppStore((s) => s.closeAbout);
  const openUpdateModal = useAppStore((s) => s.openUpdateModal);
  const appInfo = useAppStore((s) => s.appInfo);

  const handleStartUpdateCheck = () => {
    openUpdateModal();
  };

  const handleLinkClick = (url: string) => (e: React.MouseEvent) => {
    if (!url) return;
    if (isTauri()) {
      e.preventDefault();
      import('@tauri-apps/plugin-shell').then(({ open }) => open(url));
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Dialog
      isOpen={isAboutOpen}
      onClose={closeAbout}
      title="About OpenSmartAlbum"
      width={480}
      noPadding
    >
      <div className={styles.container}>
        {/* 1. Hero Section with App Icon */}
        <div className={styles.heroSection}>
          <div className={styles.logoWrapper}>
            <img src={appIcon} alt="OpenSmartAlbum Icon" className={styles.logoImg} />
          </div>

          <div className={styles.brandText}>
            <h2 className={styles.appName}>OpenSmartAlbum</h2>
            <p className={styles.tagline}>
              Professional Offline Desktop Photo Album Layout & Social Studio
            </p>
          </div>

          <div className={styles.versionRow}>
            <span className={styles.versionBadge}>{appInfo.version}</span>
            <button
              type="button"
              className={styles.updateBtn}
              onClick={handleStartUpdateCheck}
              title="Check for software updates"
            >
              <RefreshCw size={12} strokeWidth={1.5} />
              <span>Check Updates</span>
            </button>
          </div>
        </div>

        {/* 2. Specs & Details Card */}
        <div className={styles.specCard}>
          <div className={styles.specRow}>
            <span className={styles.specLabel}>Architecture</span>
            <span className={styles.specValue}>100% Pure Rust Image Engine · Tauri 2</span>
          </div>
          <div className={styles.specRow}>
            <span className={styles.specLabel}>Platform</span>
            <span className={styles.specValue}>{formatPlatform(appInfo.platform)}</span>
          </div>
          <div className={styles.specRow}>
            <span className={styles.specLabel}>Website</span>
            <a
              href={APP_CONFIG.website}
              className={styles.linkValue}
              onClick={handleLinkClick(APP_CONFIG.website)}
              target="_blank"
              rel="noopener noreferrer"
              title="Visit open-source project repository"
            >
              <span>{APP_CONFIG.website.replace('https://', '')}</span>
              <ExternalLink size={12} strokeWidth={1.5} />
            </a>
          </div>
          <div className={styles.specRow}>
            <span className={styles.specLabel}>License</span>
            <span className={styles.specValue}>100% Free & Open-Source (MIT / GPLv3)</span>
          </div>
        </div>

        {/* 3. Footer */}
        <div className={styles.footer}>
          <span>OpenSmartAlbum · 100% Free & Open-Source Studio for macOS · Zero DRM</span>
        </div>
      </div>
    </Dialog>
  );
}
