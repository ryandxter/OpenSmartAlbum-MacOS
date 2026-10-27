import { useEffect, useState } from 'react';
import {
  Palette,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Unlink,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { canvaService, CanvaAuthStatus } from '../../../services/canvaService';
import { isTauri } from '../../../utils/platform';
import styles from '../SettingsDialog.module.css';

export function CanvaSettingsTab() {
  const [authStatus, setAuthStatus] = useState<CanvaAuthStatus>({
    is_connected: false,
    client_id: 'OC-AaF8fmOD6b3W',
    redirect_uri: 'https://auth-osa.rvmeur.com/canva/callback',
    display_name: null,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadStatus = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const status = await canvaService.getAuthStatus();
      setAuthStatus(status);
    } catch (err) {
      setErrorMessage(`Failed to check Canva connection: ${String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const handleConnect = async () => {
    if (!isTauri()) {
      setErrorMessage('Canva OAuth connection requires the native macOS desktop application.');
      return;
    }
    setIsBusy(true);
    setErrorMessage(null);
    setNotice('Opening Canva authorization in your default browser…');
    try {
      const result = await canvaService.startOAuth();
      setAuthStatus(result);
      if (result.is_connected) {
        setNotice('Successfully connected to Canva! Assets are now accessible in the Assets inspector.');
      }
    } catch (err) {
      setErrorMessage(`Canva authorization was cancelled or failed: ${String(err)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!isTauri() || isBusy) return;
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await canvaService.disconnect();
      setAuthStatus({
        is_connected: false,
        client_id: 'OC-AaF8fmOD6b3W',
        redirect_uri: 'https://auth-osa.rvmeur.com/canva/callback',
        display_name: null,
      });
      setNotice('Canva account disconnected. Local session tokens have been cleared.');
    } catch (err) {
      setErrorMessage(`Failed to disconnect: ${String(err)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSyncAssets = async () => {
    if (!isTauri() || !authStatus.is_connected || isBusy) return;
    setIsBusy(true);
    setErrorMessage(null);
    setNotice('Synchronizing Canva folders and visual elements…');
    try {
      const assets = await canvaService.listAssets();
      setNotice(`Synchronized ${assets.length} Canva assets with your studio catalog.`);
    } catch (err) {
      setErrorMessage(`Asset synchronization failed: ${String(err)}`);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>Canva &amp; Cloud Integrations</div>
        <div className={styles.sectionSubtitle}>
          Connect your Canva account to access branded templates, cloud graphic assets, and synchronize designs directly with your album spreads.
        </div>
      </div>

      {/* Account Status Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.cardTitle}>
              <span>Canva Account</span>
              <span
                className={
                  authStatus.is_connected
                    ? styles.statusBadgeActive
                    : styles.statusBadgeMuted
                }
              >
                {isLoading ? 'Checking…' : authStatus.is_connected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <div className={styles.cardSubtitle}>
              {authStatus.is_connected
                ? 'Your Canva workspace is connected and ready for asset insertion.'
                : 'Authenticate with Canva to import stickers, graphics, and elements without leaving the app.'}
            </div>
          </div>
        </div>

        <div className={styles.generalCardBody}>
          <div className={styles.cacheMetricPanel}>
            <div className={styles.cacheMetricIcon}>
              <Palette size={20} strokeWidth={1.5} />
            </div>
            <div className={styles.cacheMetricCopy}>
              <strong>
                {authStatus.is_connected
                  ? (authStatus.display_name || 'Canva Studio User')
                  : 'Canva Connect Apps SDK'}
              </strong>
              <span>
                {authStatus.is_connected
                  ? 'Active session token verified via auth-osa.rvmeur.com gateway'
                  : 'Zero-hassle OAuth 2.0 PKCE with production redirect gateway'}
              </span>
            </div>
            <div>
              {authStatus.is_connected ? (
                <button
                  type="button"
                  className={styles.generalActionButton}
                  onClick={handleDisconnect}
                  disabled={isBusy}
                  style={{ color: 'var(--color-danger, #ef4444)' }}
                >
                  <Unlink size={14} strokeWidth={1.5} />
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  className={`${styles.generalActionButton} ${styles.generalActionButtonPrimary}`}
                  onClick={handleConnect}
                  disabled={isBusy || isLoading}
                >
                  <ExternalLink size={14} strokeWidth={1.5} />
                  {isBusy ? 'Connecting…' : 'Connect Account'}
                </button>
              )}
            </div>
          </div>

          {authStatus.is_connected && (
            <div className={styles.actionStrip}>
              <div className={styles.actionStripCopy}>
                <strong>Library Sync</strong>
                <span>Sync your latest Canva uploaded assets and brand templates.</span>
              </div>
              <button
                type="button"
                className={styles.generalActionButton}
                onClick={handleSyncAssets}
                disabled={isBusy}
              >
                <RefreshCw size={14} strokeWidth={1.5} className={isBusy ? styles.spinIcon : ''} />
                Sync Assets
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Gateway & Security Configuration Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.cardTitle}>Production Gateway &amp; Security</div>
            <div className={styles.cardSubtitle}>
              Secure authorization parameters configured for desktop production release.
            </div>
          </div>
        </div>

        <div className={styles.generalCardBody}>
          <div className={styles.compactSummaryRow}>
            <div>
              <div className={styles.infoLabelStrong}>Auth Gateway Domain</div>
              <div className={styles.infoHint}>Automated TLS reverse-proxy gateway hosted on Cloudflare/Muse</div>
            </div>
            <span className={styles.summaryPillSuccess}>auth-osa.rvmeur.com</span>
          </div>

          <div className={styles.compactSummaryRow}>
            <div>
              <div className={styles.infoLabelStrong}>Registered Redirect URI</div>
              <div className={styles.infoHint}>Canva Developer Portal authorized callback endpoint</div>
            </div>
            <code style={{ fontSize: '11px', color: 'var(--color-text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
              https://auth-osa.rvmeur.com/canva/callback
            </code>
          </div>

          <div className={styles.compactSummaryRow}>
            <div>
              <div className={styles.infoLabelStrong}>Client Identification</div>
              <div className={styles.infoHint}>Canva Integration App Client ID</div>
            </div>
            <span className={styles.summaryPill}>OC-AaF8fmOD6b3W</span>
          </div>

          <div className={styles.compactSummaryRow}>
            <div>
              <div className={styles.infoLabelStrong}>Security Protocol</div>
              <div className={styles.infoHint}>Authorization Code Flow with S256 PKCE &amp; Local Secret Isolation</div>
            </div>
            <span className={styles.summaryPillSuccess}>
              <ShieldCheck size={12} strokeWidth={1.5} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              Active
            </span>
          </div>
        </div>
      </div>

      {/* Hybrid Open CC0 Library Info Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.cardTitle}>CC0 Open Asset Library</div>
            <div className={styles.cardSubtitle}>
              Curated public domain illustrations, floral borders, and stickers integrated alongside Canva.
            </div>
          </div>
        </div>

        <div className={styles.generalCardBody}>
          <div className={styles.compactSummaryRow}>
            <div>
              <div className={styles.infoLabelStrong}>Open Library Providers</div>
              <div className={styles.infoHint}>Unsplash, Wikimedia Commons, and Openverse CC0 curated vectors</div>
            </div>
            <span className={styles.summaryPillSuccess}>Ready &amp; Built-in</span>
          </div>
          <div className={styles.compactSummaryRow}>
            <div>
              <div className={styles.infoLabelStrong}>Offline Caching</div>
              <div className={styles.infoHint}>Downloaded stickers and vectors are cached locally for zero-latency editing</div>
            </div>
            <span className={styles.summaryPill}>Cached locally</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {notice && (
        <div className={styles.generalNotice} role="status">
          <CheckCircle2 size={15} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{notice}</span>
        </div>
      )}
      {errorMessage && (
        <div className={`${styles.generalNotice} ${styles.generalNoticeError}`} role="alert">
          <AlertCircle size={15} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
