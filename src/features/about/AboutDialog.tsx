import React from 'react';
import { RefreshCw, ExternalLink, Heart, Coffee } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { APP_CONFIG } from '../../config/app';
import { useAppStore } from '../../stores/appStore';
import { formatPlatform, isTauri } from '../../utils/platform';
import appLogo from '../../assets/app-logo.png';
import styles from './AboutDialog.module.css';

export function AboutDialog() {
  const isAboutOpen = useAppStore((s) => s.isAboutOpen);
  const closeAbout = useAppStore((s) => s.closeAbout);
  const openUpdateModal = useAppStore((s) => s.openUpdateModal);
  const openSupportModal = useAppStore((s) => s.openSupportModal);
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
      title="About AFSNSmartAlbum"
      width={480}
      noPadding
    >
      <div className={styles.container}>
        {/* 1. Hero Section with App Logo */}
        <div className={styles.heroSection}>
          <div className={styles.logoWrapper}>
            <img src={appLogo} alt="AFSNSmartAlbum Logo" className={styles.logoImg} />
          </div>

          <div className={styles.brandText}>
            <h2 className={styles.appName}>AFSNSmartAlbum</h2>
            <p className={styles.tagline}>
              Professional Offline Desktop Photo Album Layout Application
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

        {/* 2. Specs & Official Website Card */}
        <div className={styles.specCard}>
          <div className={styles.specRow}>
            <span className={styles.specLabel}>Developer</span>
            <span className={styles.specValue}>Asrofims · Afsunmedia</span>
          </div>
          <div className={styles.specRow}>
            <span className={styles.specLabel}>Website</span>
            <a
              href={APP_CONFIG.website || 'https://app.afsun.my.id'}
              className={styles.linkValue}
              onClick={handleLinkClick(APP_CONFIG.website || 'https://app.afsun.my.id')}
              target="_blank"
              rel="noopener noreferrer"
              title="Visit official website (app.afsun.my.id)"
            >
              <span>app.afsun.my.id</span>
              <ExternalLink size={12} strokeWidth={1.5} />
            </a>
          </div>
          <div className={styles.specRow}>
            <span className={styles.specLabel}>Platform</span>
            <span className={styles.specValue}>{formatPlatform(appInfo.platform)}</span>
          </div>
        </div>

        {/* 3. Support Independent Development (QRIS) */}
        <div className={styles.supportCard}>
          <div className={styles.supportInfo}>
            <div className={styles.supportTitle}>
              <Heart size={14} strokeWidth={1.5} color="#ec4899" />
              <span>Support Development</span>
            </div>
            <div className={styles.supportDesc}>
              Fund future layout templates, algorithms & updates via QRIS
            </div>
          </div>
          <button
            type="button"
            className={styles.donateBtn}
            onClick={() => {
              closeAbout();
              openSupportModal();
            }}
          >
            <Coffee size={14} strokeWidth={1.5} />
            <span>Donate (QRIS)</span>
          </button>
        </div>

        {/* 4. Footer */}
        <div className={styles.footer}>
          <span>Copyright © 2026 Afsunmedia. All rights reserved.</span>
        </div>
      </div>
    </Dialog>
  );
}
