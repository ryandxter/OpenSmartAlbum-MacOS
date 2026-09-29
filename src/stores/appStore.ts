import { create } from 'zustand';
import {
  AppPreferences,
  loadAppPreferences,
  saveAppPreferences,
  DEFAULT_APP_PREFERENCES,
} from '../domain/appPreferences';

interface AppInfo {
  version: string;
  buildNumber: string;
  platform: string;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'uptodate'
  | 'error';

export interface UpdateProgress {
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
}

interface AppState {
  // App info
  appInfo: AppInfo;
  isAppInfoLoaded: boolean;
  
  // Dialog states
  isAboutOpen: boolean;
  isSettingsOpen: boolean;
  isSupportModalOpen: boolean;
  isUpdateModalOpen: boolean;
  updateAvailableVersion: string | null;
  settingsActiveTab: string;

  // Background update state
  updateStatus: UpdateStatus;
  updateProgress: UpdateProgress;
  updateCheckResult: any;
  updateError: string | null;
  isBackgroundNoticeDismissed: boolean;
  
  // Actions
  setAppInfo: (info: AppInfo) => void;
  openAbout: () => void;
  closeAbout: () => void;
  openSettings: (tab?: string) => void;
  closeSettings: () => void;
  openSupportModal: () => void;
  closeSupportModal: () => void;
  openUpdateModal: () => void;
  closeUpdateModal: () => void;
  setUpdateAvailableVersion: (version: string | null) => void;
  setSettingsActiveTab: (tab: string) => void;
  isExitWarningOpen: boolean;
  openExitWarning: () => void;
  closeExitWarning: () => void;

  setUpdateStatus: (status: UpdateStatus) => void;
  setUpdateProgress: (downloadedBytes: number, totalBytes: number) => void;
  setUpdateCheckResult: (res: any) => void;
  setUpdateError: (err: string | null) => void;
  dismissBackgroundNotice: () => void;
  resetBackgroundNotice: () => void;

  // Preferences
  preferences: AppPreferences;
  updatePreferences: (patch: Partial<AppPreferences>) => void;
  resetPreferences: () => void;

  // Workspace Mode (ISO-01)
  activeMode: 'print' | 'carousel';
  setActiveMode: (mode: 'print' | 'carousel') => void;

  // Per-mode viewport isolation (ISO-02)
  printZoom: number;
  carouselZoom: number;
  printPan: { x: number; y: number };
  carouselPan: { x: number; y: number };
  printFitTrigger: number;
  carouselFitTrigger: number;
  setPrintZoom: (z: number) => void;
  setCarouselZoom: (z: number) => void;
  setPrintPan: (pan: { x: number; y: number }) => void;
  setCarouselPan: (pan: { x: number; y: number }) => void;
  triggerPrintFit: () => void;
  triggerCarouselFit: () => void;
  resetViewportForMode: (mode: 'print' | 'carousel') => void;
}

export const useAppStore = create<AppState>((set) => ({
  appInfo: {
    version: 'v1.0.80',
    buildNumber: '1',
    platform: 'unknown',
  },
  isAppInfoLoaded: false,
  isAboutOpen: false,
  isSettingsOpen: false,
  isSupportModalOpen: false,
  isUpdateModalOpen: false,
  updateAvailableVersion: null,
  settingsActiveTab: 'general',
  preferences: loadAppPreferences(),

  updateStatus: 'idle',
  updateProgress: {
    downloadedBytes: 0,
    totalBytes: 0,
    percent: 0,
  },
  updateCheckResult: null,
  updateError: null,
  isBackgroundNoticeDismissed: false,

  // Workspace Mode (ISO-01)
  activeMode: 'print',

  // Per-mode viewport isolation (ISO-02)
  printZoom: 100,
  carouselZoom: 100,
  printPan: { x: 0, y: 0 },
  carouselPan: { x: 0, y: 0 },
  printFitTrigger: 0,
  carouselFitTrigger: 0,

  setAppInfo: (info) => set({ appInfo: info, isAppInfoLoaded: true }),
  openAbout: () => set({ isAboutOpen: true }),
  closeAbout: () => set({ isAboutOpen: false }),
  openSettings: (tab = 'general') => set({ isSettingsOpen: true, settingsActiveTab: tab }),
  closeSettings: () => set({ isSettingsOpen: false }),
  openSupportModal: () => set({ isSupportModalOpen: true }),
  closeSupportModal: () => set({ isSupportModalOpen: false }),
  openUpdateModal: () => set({ isUpdateModalOpen: true }),
  closeUpdateModal: () => set({ isUpdateModalOpen: false }),
  setUpdateAvailableVersion: (version) => set({ updateAvailableVersion: version }),
  setSettingsActiveTab: (tab) => set({ settingsActiveTab: tab }),
  isExitWarningOpen: false,
  openExitWarning: () => set({ isExitWarningOpen: true }),
  closeExitWarning: () => set({ isExitWarningOpen: false }),

  setUpdateStatus: (status) => set({ updateStatus: status }),
  setUpdateProgress: (downloadedBytes, totalBytes) => {
    const percent =
      totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
    set({
      updateProgress: { downloadedBytes, totalBytes, percent },
    });
  },
  setUpdateCheckResult: (res) => set({ updateCheckResult: res }),
  setUpdateError: (err) => set({ updateError: err }),
  dismissBackgroundNotice: () => set({ isBackgroundNoticeDismissed: true }),
  resetBackgroundNotice: () => set({ isBackgroundNoticeDismissed: false }),
  updatePreferences: (patch) =>
    set((state) => {
      const updated = { ...state.preferences, ...patch };
      saveAppPreferences(updated);
      return { preferences: updated };
    }),
  resetPreferences: () => {
    saveAppPreferences(DEFAULT_APP_PREFERENCES);
    set({ preferences: { ...DEFAULT_APP_PREFERENCES } });
  },

  // ISO-01: Workspace Mode actions
  setActiveMode: (mode) => set({ activeMode: mode }),

  // ISO-02: Per-mode viewport actions
  setPrintZoom: (z) => set({ printZoom: Math.max(5, Math.min(350, z)) }),
  setCarouselZoom: (z) => set({ carouselZoom: Math.max(5, Math.min(350, z)) }),
  setPrintPan: (pan) => set({ printPan: pan }),
  setCarouselPan: (pan) => set({ carouselPan: pan }),
  triggerPrintFit: () => set((s) => ({ printFitTrigger: s.printFitTrigger + 1 })),
  triggerCarouselFit: () => set((s) => ({ carouselFitTrigger: s.carouselFitTrigger + 1 })),
  resetViewportForMode: (mode) => {
    if (mode === 'print') {
      set((s) => ({ printZoom: 100, printPan: { x: 0, y: 0 }, printFitTrigger: s.printFitTrigger + 1 }));
    } else {
      set((s) => ({ carouselZoom: 100, carouselPan: { x: 0, y: 0 }, carouselFitTrigger: s.carouselFitTrigger + 1 }));
    }
  },
}));
