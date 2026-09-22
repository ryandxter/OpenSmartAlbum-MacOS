import React, { useEffect, useState, useMemo } from 'react';
import {
  Settings,
  Magnet,
  LayoutGrid,
  Keyboard,
  LayoutTemplate,
  History,
  ShieldCheck,
  HardDrive,
  Trash2,
  RefreshCw,
  Columns2,
  Crosshair,
  Scan,
  Grid2x2,
  Ruler,
  Maximize2,
  Info,
  Search,
  SearchX,
  X,
  Sparkles,
} from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Switch } from '../../components/ui/Switch';
import { useAppStore } from '../../stores/appStore';
import { useEditorStore } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import { convertUnit, Unit, UNIT_LABELS } from '../../domain/units';
import { SNAPPING_LEVELS, SnappingLevel } from '../../domain/editor';
import type { AutoSaveIntervalSeconds, StartupBehavior } from '../../domain/appPreferences';
import { isTauri } from '../../utils/platform';
import styles from './SettingsDialog.module.css';

// ---------------------------------------------------------------------------
// Keyboard Shortcuts Data
// ---------------------------------------------------------------------------
interface ShortcutDef {
  id: string;
  category: string;
  action: string;
  combos: Array<string[]>;
  scope: string;
  note?: string;
  keywords?: string;
}

const SHORTCUT_CATEGORIES = [
  'All',
  'Panels & Navigation',
  'Canvas & Selection',
  'Photo & Crop',
  'Transform & Layout',
  'Locking & Grouping',
  'Clipboard',
  'Text & Typography',
  'File & Project',
] as const;

const SHORTCUTS: ShortcutDef[] = [
  // 1. Panels, navigation, and viewport
  {
    id: 'nav-props',
    category: 'Panels & Navigation',
    action: 'Open Properties Panel',
    combos: [['P']],
    scope: 'Workspace',
    keywords: 'inspector sidebar properties',
  },
  {
    id: 'nav-lock',
    category: 'Panels & Navigation',
    action: 'Open Locked Elements Panel',
    combos: [['L']],
    scope: 'Workspace',
    keywords: 'lock protect sidebar',
  },
  {
    id: 'nav-smart-layout',
    category: 'Panels & Navigation',
    action: 'Open Smart Layout Panel',
    combos: [['G']],
    scope: 'Workspace',
    keywords: 'grid templates smart layout auto',
  },
  {
    id: 'nav-next-spread',
    category: 'Panels & Navigation',
    action: 'Go to Next Spread',
    combos: [['Page Down'], ['Alt', 'Right Arrow']],
    scope: 'Workspace',
    keywords: 'next page spread navigation flip right',
  },
  {
    id: 'nav-previous-spread',
    category: 'Panels & Navigation',
    action: 'Go to Previous Spread',
    combos: [['Page Up'], ['Alt', 'Left Arrow']],
    scope: 'Workspace',
    keywords: 'previous page spread navigation flip left',
  },
  {
    id: 'nav-pan-tool',
    category: 'Panels & Navigation',
    action: 'Pan Canvas View',
    combos: [['Space', 'Drag'], ['Middle Mouse', 'Drag']],
    scope: 'Canvas',
    note: 'Hold Space while dragging, or drag with the middle mouse button.',
    keywords: 'hand pan move canvas view scroll',
  },
  {
    id: 'nav-zoom-canvas-standard',
    category: 'Panels & Navigation',
    action: 'Zoom Canvas',
    combos: [['Ctrl', 'Wheel']],
    scope: 'Canvas',
    note: 'Changes zoom in 5% steps around the pointer.',
    keywords: 'zoom canvas magnify scale mouse wheel in out 5 percent',
  },
  {
    id: 'nav-zoom-canvas-fine',
    category: 'Panels & Navigation',
    action: 'Fine Zoom Canvas',
    combos: [['Ctrl', 'Shift', 'Wheel']],
    scope: 'Canvas',
    note: 'Changes zoom in precise 1% steps around the pointer.',
    keywords: 'zoom canvas magnify fine precision wheel 1 percent',
  },
  {
    id: 'nav-zoom-canvas-keyboard',
    category: 'Panels & Navigation',
    action: 'Zoom In / Out by 15%',
    combos: [['Ctrl', '+'], ['Ctrl', '-']],
    scope: 'Workspace',
    keywords: 'zoom canvas keyboard plus minus 15 percent',
  },
  {
    id: 'nav-reset-zoom',
    category: 'Panels & Navigation',
    action: 'Fit Spread to Screen & Center',
    combos: [['Ctrl', '0']],
    scope: 'Workspace',
    keywords: 'zoom reset view fit center middle 100 percent',
  },
  {
    id: 'nav-filmstrip-scroll',
    category: 'Panels & Navigation',
    action: 'Scroll Filmstrip Photos',
    combos: [['Wheel']],
    scope: 'Filmstrip',
    note: 'Hover the filmstrip; a vertical wheel scroll moves it horizontally.',
    keywords: 'filmstrip scroll photos gallery mouse wheel horizontal browse next previous',
  },

  // 2. Canvas selection
  {
    id: 'canvas-select',
    category: 'Canvas & Selection',
    action: 'Select Frame or Element',
    combos: [['Click']],
    scope: 'Canvas',
    keywords: 'pick select highlight target',
  },
  {
    id: 'canvas-multi-select',
    category: 'Canvas & Selection',
    action: 'Add or Remove from Selection',
    combos: [['Shift', 'Click'], ['Ctrl', 'Click']],
    scope: 'Canvas',
    keywords: 'multiple select add remove toggle frame element',
  },
  {
    id: 'canvas-marquee-select',
    category: 'Canvas & Selection',
    action: 'Marquee-Select Elements',
    combos: [['Drag', 'Empty Area']],
    scope: 'Canvas',
    note: 'Hold Shift or Ctrl to add to the current selection.',
    keywords: 'multiple select range box marquee empty canvas',
  },
  {
    id: 'canvas-select-all',
    category: 'Canvas & Selection',
    action: 'Select All in Active Area',
    combos: [['Ctrl', 'A']],
    scope: 'Pointer Context',
    note: 'Targets the canvas, filmstrip, or spread drawer under the pointer.',
    keywords: 'all select spread frames photos filmstrip drawer entire',
  },
  {
    id: 'canvas-duplicate',
    category: 'Canvas & Selection',
    action: 'Duplicate Selected Frame(s)',
    combos: [['Ctrl', 'D']],
    scope: 'Canvas',
    keywords: 'duplicate copy clone make copy',
  },
  {
    id: 'canvas-delete',
    category: 'Canvas & Selection',
    action: 'Delete Selected Canvas Element(s)',
    combos: [['Delete'], ['Backspace']],
    scope: 'Canvas',
    keywords: 'remove trash clear delete frame photo text canvas',
  },
  {
    id: 'filmstrip-delete',
    category: 'Canvas & Selection',
    action: 'Delete Selected Library Photo(s)',
    combos: [['Delete'], ['Backspace']],
    scope: 'Filmstrip',
    note: 'Opens a confirmation before removing photos from the library.',
    keywords: 'remove trash delete library photos filmstrip',
  },
  {
    id: 'spread-delete',
    category: 'Canvas & Selection',
    action: 'Delete Selected Spread(s)',
    combos: [['Delete']],
    scope: 'Spread Drawer',
    note: 'The spread drawer must be hovered or focused.',
    keywords: 'remove delete page spread drawer',
  },
  {
    id: 'canvas-clear-selection',
    category: 'Canvas & Selection',
    action: 'Clear Selection or Cancel Active Action',
    combos: [['Esc']],
    scope: 'Active Area',
    note: 'Also cancels an active photo swap drag.',
    keywords: 'escape deselect cancel selection swap drag',
  },

  // 3. Photo placement and crop mode
  {
    id: 'crop-enter',
    category: 'Photo & Crop',
    action: 'Enter Crop Mode',
    combos: [['Double-click', 'Photo']],
    scope: 'Photo Frame',
    keywords: 'crop pan zoom scale image photo inside frame',
  },
  {
    id: 'crop-pan',
    category: 'Photo & Crop',
    action: 'Pan Photo Inside Frame',
    combos: [['Drag', 'Photo']],
    scope: 'Crop Mode',
    keywords: 'crop pan move image photo inside frame',
  },
  {
    id: 'crop-zoom',
    category: 'Photo & Crop',
    action: 'Zoom Photo Inside Frame',
    combos: [['Wheel']],
    scope: 'Crop Mode',
    note: 'Uses precise 2% crop-zoom steps.',
    keywords: 'crop zoom scale image photo wheel 2 percent',
  },
  {
    id: 'crop-pan-keyboard',
    category: 'Photo & Crop',
    action: 'Nudge Crop Position',
    combos: [['Arrow Keys'], ['Shift', 'Arrow Keys']],
    scope: 'Crop Mode',
    note: 'Shift uses a larger movement step.',
    keywords: 'crop pan nudge image arrow precision fast',
  },
  {
    id: 'crop-rotate',
    category: 'Photo & Crop',
    action: 'Rotate Photo Content 90°',
    combos: [['R'], ['Shift', 'R']],
    scope: 'Crop Mode',
    note: 'R rotates clockwise; Shift+R rotates counterclockwise.',
    keywords: 'crop rotate image photo clockwise counterclockwise',
  },
  {
    id: 'crop-exit',
    category: 'Photo & Crop',
    action: 'Exit Crop Mode',
    combos: [['Enter'], ['Esc'], ['Click', 'Empty Area']],
    scope: 'Crop Mode',
    note: 'Clicking inside the active photo keeps Crop Mode active.',
    keywords: 'done exit finish crop deselect escape empty canvas pasteboard',
  },
  {
    id: 'photo-replace-drop',
    category: 'Photo & Crop',
    action: 'Replace Photo in Frame',
    combos: [['Alt', 'Drop']],
    scope: 'Filmstrip → Canvas',
    note: 'Drop one filmstrip photo onto an unlocked photo frame.',
    keywords: 'replace switch photo filmstrip canvas frame alt drop',
  },

  // 4. Transform, rotation, and layout
  {
    id: 'transform-swap',
    category: 'Transform & Layout',
    action: 'Swap 2 Selected Photos',
    combos: [['S']],
    scope: 'Canvas',
    note: 'Requires exactly two selected photo frames; this takes priority over Shuffle.',
    keywords: 'swap switch exchange replace photo images positions',
  },
  {
    id: 'transform-rotate',
    category: 'Transform & Layout',
    action: 'Rotate Frame 90° Clockwise',
    combos: [['R'], ['Shift', 'R']],
    scope: 'Canvas',
    note: 'R rotates clockwise; Shift+R rotates counterclockwise.',
    keywords: 'rotate 90 orientation landscape portrait turn angle',
  },
  {
    id: 'transform-cycle-layout',
    category: 'Transform & Layout',
    action: 'Cycle Next Smart Layout',
    combos: [['Space'], ['Shift', 'Space']],
    scope: 'Smart Layout',
    note: 'Space selects the next variant; Shift+Space selects the previous variant.',
    keywords: 'cycle layout template shuffle arrange smart',
  },
  {
    id: 'transform-shuffle',
    category: 'Transform & Layout',
    action: 'Shuffle Photo Placement',
    combos: [['S']],
    scope: 'Smart Layout',
    note: 'Used when the Smart Layout HUD is active and two photos are not selected for Swap.',
    keywords: 'shuffle positions random smart layout rearrange',
  },
  {
    id: 'transform-axis-lock',
    category: 'Transform & Layout',
    action: 'Orthogonal Axis-Lock Drag',
    combos: [['Shift', 'Drag']],
    scope: 'Canvas',
    keywords: 'axis lock straight horizontal vertical constrain 45 90 drag',
  },
  {
    id: 'transform-drag-dup',
    category: 'Transform & Layout',
    action: 'Quick Drag-Duplicate',
    combos: [['Alt', 'Drag']],
    scope: 'Canvas',
    keywords: 'quick duplicate drag copy instant clone',
  },
  {
    id: 'transform-bypass-snap',
    category: 'Transform & Layout',
    action: 'Bypass Magnetic Snapping',
    combos: [['Ctrl', 'Drag']],
    scope: 'Canvas',
    keywords: 'bypass snap magnet ignore disable temporarily align',
  },
  {
    id: 'transform-nudge',
    category: 'Transform & Layout',
    action: 'Nudge Selected Element(s)',
    combos: [['Arrow Keys']],
    scope: 'Canvas',
    note: 'Uses the base step for the project unit: 1 px/mm, 0.1 cm, or 0.05 in.',
    keywords: 'nudge move unit fine arrow precision position',
  },
  {
    id: 'transform-nudge-fast',
    category: 'Transform & Layout',
    action: 'Nudge by 5× Step',
    combos: [['Shift', 'Arrow Keys']],
    scope: 'Canvas',
    keywords: 'fast nudge arrow step jump five times',
  },
  {
    id: 'transform-swap-handle',
    category: 'Transform & Layout',
    action: 'Swap Photo Content by Dragging',
    combos: [['Drag', '⇄ Handle']],
    scope: 'Canvas',
    note: 'Select one unlocked photo, then drag the center handle onto another photo frame.',
    keywords: 'swap switch exchange photo content handle drag release',
  },

  // 5. Locking & grouping
  {
    id: 'lock-frame',
    category: 'Locking & Grouping',
    action: 'Lock Selected Frame(s)',
    combos: [['Ctrl', 'L']],
    scope: 'Canvas',
    keywords: 'lock protect secure freeze movement position',
  },
  {
    id: 'unlock-frame',
    category: 'Locking & Grouping',
    action: 'Unlock Selected Frame(s)',
    combos: [['Alt', 'L'], ['Ctrl', 'Shift', 'L']],
    scope: 'Canvas',
    keywords: 'unlock unfreeze release',
  },
  {
    id: 'unlock-all',
    category: 'Locking & Grouping',
    action: 'Unlock All Frames on Spread',
    combos: [['Ctrl', 'Alt', 'L']],
    scope: 'Canvas',
    note: 'Alt+L also unlocks all when no canvas element is selected.',
    keywords: 'unlock all frames spread entire',
  },
  {
    id: 'group-frames',
    category: 'Locking & Grouping',
    action: 'Group Selected Frames',
    combos: [['Ctrl', 'G']],
    scope: 'Canvas',
    keywords: 'group combine bind cluster',
  },
  {
    id: 'ungroup-frames',
    category: 'Locking & Grouping',
    action: 'Ungroup Selected Frames',
    combos: [['Ctrl', 'Shift', 'G']],
    scope: 'Canvas',
    keywords: 'ungroup separate split isolate',
  },

  // 6. Clipboard
  {
    id: 'clip-copy',
    category: 'Clipboard',
    action: 'Copy Selected Item(s)',
    combos: [['Ctrl', 'C']],
    scope: 'Active Selection',
    note: 'Copies canvas elements, or selected photos when the filmstrip is active.',
    keywords: 'copy clipboard frame photo filmstrip duplicate memory',
  },
  {
    id: 'clip-paste',
    category: 'Clipboard',
    action: 'Paste Frames',
    combos: [['Ctrl', 'V']],
    scope: 'Canvas',
    keywords: 'paste insert place frame',
  },
  {
    id: 'clip-paste-in-place',
    category: 'Clipboard',
    action: 'Paste in Place',
    combos: [['Ctrl', 'Shift', 'V']],
    scope: 'Canvas',
    keywords: 'paste in place exact coordinate alignment original',
  },
  {
    id: 'clip-paste-all-spreads',
    category: 'Clipboard',
    action: 'Paste to All Spreads',
    combos: [['Ctrl', 'Alt', 'V']],
    scope: 'Canvas',
    keywords: 'paste all spreads repeat bulk batch header footer',
  },

  // 7. Text and typography
  {
    id: 'text-add',
    category: 'Text & Typography',
    action: 'Add New Text Box',
    combos: [['T']],
    scope: 'Canvas',
    keywords: 'text box typography caption heading font',
  },
  {
    id: 'text-edit',
    category: 'Text & Typography',
    action: 'Edit Text Content Inline',
    combos: [['Double-click', 'Text']],
    scope: 'Text Frame',
    keywords: 'edit type write double click inline rich text',
  },
  {
    id: 'text-format-bold',
    category: 'Text & Typography',
    action: 'Bold / Italic / Underline',
    combos: [['Ctrl', 'B'], ['Ctrl', 'I'], ['Ctrl', 'U']],
    scope: 'Text Editing',
    keywords: 'bold italic underline style typography font weight',
  },
  {
    id: 'text-commit',
    category: 'Text & Typography',
    action: 'Commit & Save Text Changes',
    combos: [['Ctrl', 'Enter']],
    scope: 'Text Editing',
    keywords: 'commit done finish save text exit edit',
  },
  {
    id: 'text-cancel',
    category: 'Text & Typography',
    action: 'Cancel Inline Text Changes',
    combos: [['Esc']],
    scope: 'Text Editing',
    keywords: 'cancel discard escape text edit',
  },
  {
    id: 'text-fit-content',
    category: 'Text & Typography',
    action: 'Fit Text Frame to Content',
    combos: [['Ctrl', 'Alt', 'C']],
    scope: 'Canvas',
    note: 'Requires one unlocked text frame to be selected.',
    keywords: 'fit frame content text hug resize ctrl alt c',
  },

  // 8. File and project operations
  {
    id: 'file-save',
    category: 'File & Project',
    action: 'Save Project',
    combos: [['Ctrl', 'S']],
    scope: 'Project',
    keywords: 'save disk project write store',
  },
  {
    id: 'file-save-as',
    category: 'File & Project',
    action: 'Save Project As (.afsn)',
    combos: [['Ctrl', 'Shift', 'S']],
    scope: 'Project',
    keywords: 'save as afsn new file copy backup',
  },
  {
    id: 'file-open',
    category: 'File & Project',
    action: 'Open Project',
    combos: [['Ctrl', 'O']],
    scope: 'Project',
    keywords: 'open file load project afsn browse',
  },
  {
    id: 'file-new',
    category: 'File & Project',
    action: 'Create New Project',
    combos: [['Ctrl', 'N']],
    scope: 'Project',
    keywords: 'new project wizard create fresh album',
  },
  {
    id: 'file-export',
    category: 'File & Project',
    action: 'Export High-Resolution Album',
    combos: [['Ctrl', 'E']],
    scope: 'Project',
    keywords: 'export print jpg pdf high res render dpi output',
  },
  {
    id: 'file-undo',
    category: 'File & Project',
    action: 'Undo Action',
    combos: [['Ctrl', 'Z']],
    scope: 'Workspace',
    keywords: 'undo revert step back history',
  },
  {
    id: 'file-redo',
    category: 'File & Project',
    action: 'Redo Action',
    combos: [['Ctrl', 'Y'], ['Ctrl', 'Shift', 'Z']],
    scope: 'Workspace',
    keywords: 'redo forward repeat history',
  },
  {
    id: 'file-shortcuts',
    category: 'File & Project',
    action: 'Open Shortcuts Reference',
    combos: [['F1'], ['?']],
    scope: 'Workspace',
    keywords: 'help shortcuts hotkeys f1 cheat sheet',
  },
];

interface PhotoCacheStats {
  fileCount: number;
  totalBytes: number;
}

interface CacheCleanupResult {
  removedFiles: number;
  reclaimedBytes: number;
}

function formatCacheBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** unitIndex);
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

const AUTO_SAVE_INTERVAL_OPTIONS: Array<{ value: AutoSaveIntervalSeconds; label: string }> = [
  { value: 10, label: '10 sec' },
  { value: 30, label: '30 sec' },
  { value: 60, label: '1 min' },
  { value: 300, label: '5 min' },
];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function SettingsDialog() {
  const isOpen = useAppStore((s) => s.isSettingsOpen);
  const closeSettings = useAppStore((s) => s.closeSettings);
  const activeTab = useAppStore((s) => s.settingsActiveTab);
  const setActiveTab = useAppStore((s) => s.setSettingsActiveTab);
  const appInfo = useAppStore((s) => s.appInfo);
  const openUpdateModal = useAppStore((s) => s.openUpdateModal);
  const updateStatus = useAppStore((s) => s.updateStatus);
  const preferences = useAppStore((s) => s.preferences);
  const updatePreferences = useAppStore((s) => s.updatePreferences);

  const {
    snappingConfig,
    updateSnappingConfig,
    multiResizeGapMode,
    setMultiResizeGapMode,
  } = useEditorStore();
  const { currentProject } = useProjectStore();

  // Shortcuts search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [confirmAction, setConfirmAction] = useState<'unused_cache' | null>(null);
  const [isGeneralActionBusy, setIsGeneralActionBusy] = useState(false);
  const [generalActionError, setGeneralActionError] = useState<string | null>(null);
  const [generalActionNotice, setGeneralActionNotice] = useState<string | null>(null);
  const [cacheStats, setCacheStats] = useState<PhotoCacheStats | null>(null);
  const [isCacheStatsLoading, setIsCacheStatsLoading] = useState(false);

  useEffect(() => {
    if (!generalActionNotice) return;
    const timeout = window.setTimeout(() => setGeneralActionNotice(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [generalActionNotice]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'general') return;
    if (!isTauri()) {
      setCacheStats({ fileCount: 0, totalBytes: 0 });
      return;
    }

    let cancelled = false;
    setIsCacheStatsLoading(true);
    import('@tauri-apps/api/core')
      .then(({ invoke }) => invoke<PhotoCacheStats>('get_photo_cache_stats'))
      .then((stats) => {
        if (!cancelled) setCacheStats(stats);
      })
      .catch((error) => {
        if (!cancelled) setGeneralActionError(`Cache information is unavailable: ${String(error)}`);
      })
      .finally(() => {
        if (!cancelled) setIsCacheStatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeTab]);

  const handleConfirmedGeneralAction = async () => {
    const action = confirmAction;
    if (!action) return;
    setIsGeneralActionBusy(true);
    setGeneralActionError(null);
    setGeneralActionNotice(null);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const cleaned = await invoke<CacheCleanupResult>('clean_unused_photo_cache');
      const stats = await invoke<PhotoCacheStats>('get_photo_cache_stats');
      setCacheStats(stats);
      setGeneralActionNotice(
        cleaned.removedFiles > 0
          ? `Removed ${cleaned.removedFiles} unused cache ${cleaned.removedFiles === 1 ? 'file' : 'files'} and reclaimed ${formatCacheBytes(cleaned.reclaimedBytes)}.`
          : 'No unused cache files were found.'
      );
      setConfirmAction(null);
    } catch (error) {
      setGeneralActionError(`The operation could not be completed: ${String(error)}`);
    } finally {
      setIsGeneralActionBusy(false);
    }
  };

  const updateStatusPresentation = useMemo(() => {
    if (!preferences.automaticUpdateChecks && updateStatus === 'idle') {
      return { label: 'Manual', className: styles.statusBadgeMuted };
    }
    switch (updateStatus) {
      case 'checking': return { label: 'Checking…', className: styles.statusBadgeMuted };
      case 'available': return { label: 'Update Available', className: styles.statusBadgeWarning };
      case 'downloading': return { label: 'Downloading', className: styles.statusBadgeWarning };
      case 'ready': return { label: 'Restart Required', className: styles.statusBadgeWarning };
      case 'uptodate': return { label: 'Up to Date', className: styles.statusBadgeActive };
      case 'error': return { label: 'Check Unavailable', className: styles.statusBadgeDanger };
      default: return { label: 'Not Checked', className: styles.statusBadgeMuted };
    }
  }, [preferences.automaticUpdateChecks, updateStatus]);

  // Filter shortcuts
  const filteredShortcuts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return SHORTCUTS.filter((s) => {
      const matchesCategory = categoryFilter === 'All' || s.category === categoryFilter;
      if (!matchesCategory) return false;
      if (!query) return true;
      const matchAction = s.action.toLowerCase().includes(query);
      const matchCat = s.category.toLowerCase().includes(query);
      const matchScope = s.scope.toLowerCase().includes(query);
      const matchNote = s.note?.toLowerCase().includes(query) ?? false;
      const matchKeywords = s.keywords?.toLowerCase().includes(query) ?? false;
      const matchKeys = s.combos.some((combo) =>
        combo.some((k) => k.toLowerCase().includes(query))
      );
      return matchAction || matchCat || matchScope || matchNote || matchKeywords || matchKeys;
    });
  }, [searchQuery, categoryFilter]);

  // Group filtered shortcuts by category
  const groupedShortcuts = useMemo(() => {
    const groups: Record<string, ShortcutDef[]> = {};
    for (const s of filteredShortcuts) {
      let group = groups[s.category];
      if (!group) {
        group = [];
        groups[s.category] = group;
      }
      group.push(s);
    }
    return groups;
  }, [filteredShortcuts]);

  const activeUnit: Unit = currentProject?.canvasUnit || 'mm';
  const activeDpi: number = currentProject?.canvasDpi || 300;
  const unitLabel = UNIT_LABELS[activeUnit] || activeUnit;

  const activeLevelObj: SnappingLevel = useMemo(() => {
    const defaultLevel = SNAPPING_LEVELS[1]!;
    const currentMm = snappingConfig.threshold;
    if (!currentMm || currentMm <= 0.2) {
      return defaultLevel; // Default Level 2 (15 px / 1.27 mm)
    }
    let closest: SnappingLevel = defaultLevel;
    let minDiff = Infinity;
    for (const lvl of SNAPPING_LEVELS) {
      const diff = Math.abs(currentMm - lvl.mm);
      if (diff < minDiff) {
        minDiff = diff;
        closest = lvl;
      }
    }
    return closest;
  }, [snappingConfig.threshold]);

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={closeSettings}
        title="Preferences"
        width={780}
        height={580}
        noPadding
        closeOnEscape={!confirmAction}
      >
      <div className={styles.container}>
        {/* Left Navigation Sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarNav}>
            <div className={styles.sidebarHeader}>Preferences</div>

            {/* Tab 1: General */}
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'general' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('general')}
            >
              <span className={styles.tabIcon}>
                <Settings size={18} strokeWidth={1.5} />
              </span>
              <span>General</span>
            </button>

            {/* Tab 2: Canvas & Snapping */}
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'snapping' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('snapping')}
            >
              <span className={styles.tabIcon}>
                <Magnet size={18} strokeWidth={1.5} />
              </span>
              <span>Canvas & Snapping</span>
            </button>

            {/* Tab 3: Layout & Spacing */}
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'layout' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('layout')}
            >
              <span className={styles.tabIcon}>
                <LayoutGrid size={18} strokeWidth={1.5} />
              </span>
              <span>Multi-Frame Resize</span>
            </button>

            {/* Tab 4: Keyboard Shortcuts */}
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'shortcuts' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('shortcuts')}
            >
              <span className={styles.tabIcon}>
                <Keyboard size={18} strokeWidth={1.5} />
              </span>
              <span>Shortcuts</span>
            </button>
          </div>

          {/* Sidebar Footer */}
          <div className={styles.sidebarFooter}>
            <div className={styles.versionBadge}>
              <span>AFSNSmartAlbum</span>
              <span className={styles.versionPill}>{appInfo.version}</span>
            </div>
          </div>
        </div>

        {/* Right Content Area */}
        <div className={styles.contentPane}>
          {/* ================================================================ */}
          {/* 1. General Tab                                                    */}
          {/* ================================================================ */}
          {activeTab === 'general' && (
            <div className={styles.tabContent}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>General</div>
                <div className={styles.sectionSubtitle}>
                  Configure startup behavior, saving safeguards, local storage, and software updates.
                </div>
              </div>

              {/* Startup & Projects Card */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <div className={styles.cardTitle}>Startup &amp; Projects</div>
                    <div className={styles.cardSubtitle}>
                      Choose what appears when AFSNSmartAlbum starts and manage project history.
                    </div>
                  </div>
                </div>

                <div className={styles.generalCardBody}>
                  <div className={styles.controlLabelRow}>
                    <div>
                      <div className={styles.infoLabelStrong}>On Launch</div>
                      <div className={styles.infoHint}>A project file opened from Windows always takes priority.</div>
                    </div>
                  </div>
                  <div className={styles.startupChoiceGrid} role="radiogroup" aria-label="On launch">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={preferences.startupBehavior === 'welcome'}
                      className={`${styles.startupChoice} ${preferences.startupBehavior === 'welcome' ? styles.startupChoiceActive : ''}`}
                      onClick={() => updatePreferences({ startupBehavior: 'welcome' as StartupBehavior })}
                    >
                      <span className={styles.startupChoiceIcon}>
                        <LayoutTemplate size={17} strokeWidth={1.5} aria-hidden="true" />
                      </span>
                      <span className={styles.startupChoiceText}>
                        <strong>Welcome Screen</strong>
                        <small>Start from your recent projects</small>
                      </span>
                      <span className={styles.choiceIndicator} aria-hidden="true">
                        {preferences.startupBehavior === 'welcome' && <span />}
                      </span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={preferences.startupBehavior === 'reopen_last'}
                      className={`${styles.startupChoice} ${preferences.startupBehavior === 'reopen_last' ? styles.startupChoiceActive : ''}`}
                      onClick={() => updatePreferences({ startupBehavior: 'reopen_last' as StartupBehavior })}
                    >
                      <span className={styles.startupChoiceIcon}>
                        <History size={17} strokeWidth={1.5} aria-hidden="true" />
                      </span>
                      <span className={styles.startupChoiceText}>
                        <strong>Last Project</strong>
                        <small>Continue where you left off</small>
                      </span>
                      <span className={styles.choiceIndicator} aria-hidden="true">
                        {preferences.startupBehavior === 'reopen_last' && <span />}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Saving & Recovery Card */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <div className={styles.cardTitle}>
                      <span>Saving &amp; Recovery</span>
                      <span className={preferences.autoSaveEnabled ? styles.statusBadgeActive : styles.statusBadgeMuted}>
                        {preferences.autoSaveEnabled ? 'Auto-Save On' : 'Manual Save'}
                      </span>
                    </div>
                    <div className={styles.cardSubtitle}>
                      Automatically save project files while keeping crash-recovery snapshots continuously protected.
                    </div>
                  </div>
                  <Switch
                    checked={preferences.autoSaveEnabled}
                    onChange={(autoSaveEnabled) => updatePreferences({ autoSaveEnabled })}
                    size="md"
                  />
                </div>

                <div className={styles.generalCardBody}>
                  <div className={styles.controlLabelRow}>
                    <div>
                      <div className={styles.infoLabelStrong}>Auto-Save After Inactivity</div>
                      <div className={styles.infoHint}>Applies after the project has been saved as an .afsn file.</div>
                    </div>
                  </div>
                  <div
                    className={`${styles.intervalSegment} ${!preferences.autoSaveEnabled ? styles.controlDisabled : ''}`}
                    role="radiogroup"
                    aria-label="Auto-save interval"
                    aria-disabled={!preferences.autoSaveEnabled}
                  >
                    {AUTO_SAVE_INTERVAL_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={preferences.autoSaveIntervalSeconds === option.value}
                        className={`${styles.intervalOption} ${preferences.autoSaveIntervalSeconds === option.value ? styles.intervalOptionActive : ''}`}
                        onClick={() => updatePreferences({ autoSaveIntervalSeconds: option.value })}
                        disabled={!preferences.autoSaveEnabled}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className={styles.compactSummaryRow}>
                    <span>
                      <ShieldCheck size={13} strokeWidth={1.5} aria-hidden="true" />
                      Recovery snapshots stay protected
                    </span>
                    <span className={styles.summaryPillSuccess}>Always On</span>
                  </div>
                </div>
              </div>

              {/* Storage & Cache Card */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <div className={styles.cardTitle}>Storage &amp; Cache</div>
                    <div className={styles.cardSubtitle}>
                      Thumbnail and canvas preview files are stored locally and can be regenerated from original photos.
                    </div>
                  </div>
                </div>

                <div className={styles.generalCardBody}>
                  <div className={styles.cacheMetricPanel}>
                    <div className={styles.cacheMetricIcon}>
                      <HardDrive size={18} strokeWidth={1.5} aria-hidden="true" />
                    </div>
                    <div className={styles.cacheMetricCopy}>
                      <strong>Photo Preview Cache</strong>
                      <span>
                        {isCacheStatsLoading
                          ? 'Calculating local cache usage…'
                          : `${cacheStats?.fileCount ?? 0} generated ${cacheStats?.fileCount === 1 ? 'file' : 'files'}`}
                      </span>
                    </div>
                    <span className={styles.cacheSizeValue}>{isCacheStatsLoading ? '—' : formatCacheBytes(cacheStats?.totalBytes ?? 0)}</span>
                  </div>
                  <div className={styles.actionStrip}>
                    <div className={styles.actionStripCopy}>
                      <strong>Unused Cache</strong>
                      <span>Active project previews and original photos remain untouched.</span>
                    </div>
                    <button
                      type="button"
                      className={styles.generalActionButton}
                      onClick={() => setConfirmAction('unused_cache')}
                      disabled={!isTauri() || isCacheStatsLoading || isGeneralActionBusy}
                    >
                      <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                      Clean Up
                    </button>
                  </div>
                  {(generalActionNotice || generalActionError) && (
                    <div
                      className={`${styles.generalNotice} ${generalActionError ? styles.generalNoticeError : ''}`}
                      role={generalActionError ? 'alert' : 'status'}
                    >
                      {generalActionError || generalActionNotice}
                    </div>
                  )}
                </div>
              </div>

              {/* Software Updates Card */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div style={{ flex: 1 }}>
                    <div className={styles.cardTitle}>
                      <span>Software Updates</span>
                      <span className={updateStatusPresentation.className}>{updateStatusPresentation.label}</span>
                    </div>
                    <div className={styles.cardSubtitle}>
                      Keep the application current while preserving full control over network checks.
                    </div>
                  </div>
                  <Switch
                    checked={preferences.automaticUpdateChecks}
                    onChange={(automaticUpdateChecks) => updatePreferences({ automaticUpdateChecks })}
                    size="md"
                  />
                </div>

                <div className={styles.generalCardBody}>
                  <div className={styles.compactSummaryRow}>
                    <div>
                      <div className={styles.infoLabelStrong}>Automatic Update Checks</div>
                      <div className={styles.infoHint}>Checks silently after startup; offline use is never interrupted.</div>
                    </div>
                    <span className={preferences.automaticUpdateChecks ? styles.summaryPillSuccess : styles.summaryPill}>
                      {preferences.automaticUpdateChecks ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className={styles.actionStrip}>
                    <div className={styles.actionStripCopy}>
                      <strong>Installed Release</strong>
                      <span>{appInfo.version}</span>
                    </div>
                    <button
                      type="button"
                      className={`${styles.generalActionButton} ${styles.generalActionButtonPrimary}`}
                      onClick={openUpdateModal}
                    >
                      <RefreshCw size={14} strokeWidth={1.5} aria-hidden="true" />
                      Check Now
                    </button>
                  </div>
                </div>
              </div>

              </div>
          )}

          {/* ================================================================ */}
          {/* 2. Canvas & Snapping Tab                                          */}
          {/* ================================================================ */}
          {activeTab === 'snapping' && (
            <div className={styles.tabContent}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>Smart Magnetic Snapping</div>
                <div className={styles.sectionSubtitle}>
                  Configure real-time magnetic alignment targets and dynamic guidelines on the canvas.
                </div>
              </div>

              {/* Master Snapping Switch Card */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <div className={styles.cardTitle}>
                      <span>Enable Magnetic Snapping</span>
                      <span className={snappingConfig.enabled ? styles.statusBadgeActive : styles.statusBadgeMuted}>
                        {snappingConfig.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <div className={styles.cardSubtitle}>
                      Automatically snap photos to edges, centers, margins, and neighboring frames (hold Ctrl to bypass).
                    </div>
                  </div>
                  <Switch
                    checked={snappingConfig.enabled}
                    onChange={(enabled) => updateSnappingConfig({ enabled })}
                    size="md"
                  />
                </div>

                {/* Calibrated Snapping Levels */}
                <div className={styles.thresholdSection}>
                  <div className={styles.thresholdHeaderRow}>
                    <div>
                      <div className={styles.cardSubtitle} style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        Snapping Distance Threshold
                      </div>
                      <div className={styles.cardSubtitle} style={{ marginTop: '2px' }}>
                        Calibrated magnetic attraction levels for smooth and effortless frame alignment.
                      </div>
                    </div>
                  </div>

                  <div className={styles.levelPillsContainer}>
                    {SNAPPING_LEVELS.map((lvl) => {
                      const isActive = activeLevelObj.level === lvl.level;
                      return (
                        <button
                          key={lvl.level}
                          type="button"
                          className={`${styles.levelPill} ${isActive ? styles.levelPillActive : ''}`}
                          onClick={() => updateSnappingConfig({ threshold: lvl.mm })}
                          title={`Level ${lvl.level} (${lvl.name}) — ${lvl.px} px`}
                        >
                          <div className={styles.levelPillTitle}>Level {lvl.level}</div>
                          <div className={styles.levelPillSubtitle}>{lvl.name}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Level Detail Banner */}
                  <div className={styles.levelDetailBanner}>
                    <span className={styles.levelDetailIcon}>🧲</span>
                    <div className={styles.levelDetailContent}>
                      <div className={styles.levelDetailHeading}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>Level {activeLevelObj.level} • {activeLevelObj.name} Snapping</span>
                          {activeLevelObj.isDefault && (
                            <span className={styles.levelPillDefaultTag}>Default</span>
                          )}
                        </div>
                        <span className={styles.levelDetailMetricBadge}>
                          {activeUnit === 'px'
                            ? `${activeLevelObj.px} px`
                            : `${activeLevelObj.px} px (~${convertUnit(activeLevelObj.mm, 'mm', activeUnit, activeDpi, activeUnit === 'mm' ? 1 : 2)} ${unitLabel})`}
                        </span>
                      </div>
                      <div className={styles.levelDetailDesc}>
                        {activeLevelObj.desc}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Granular Snapping Targets Card */}
              <div className={styles.card}>
                <div className={styles.cardTitle} style={{ marginBottom: '14px' }}>
                  Snapping Reference Targets
                </div>

                <div className={styles.targetList}>
                  {/* 1. Page & Spine Edges */}
                  <div
                    className={`${styles.targetItem} ${!snappingConfig.enabled ? styles.targetItemDisabled : ''}`}
                    onClick={() => snappingConfig.enabled && updateSnappingConfig({ snapToPageEdges: !snappingConfig.snapToPageEdges })}
                  >
                    <div className={styles.targetInfo}>
                      <div className={styles.targetIcon}>
                        <Columns2 size={16} strokeWidth={1.5} />
                      </div>
                      <div className={styles.targetText}>
                        <span className={styles.targetTitle}>Page & Spine Edges</span>
                        <span className={styles.targetDesc}>
                          Outer spread boundary edges (Top, Bottom, Left, Right) and center gutter / spine crease lines.
                        </span>
                      </div>
                    </div>
                    <Switch
                      checked={snappingConfig.snapToPageEdges}
                      onChange={(checked) => updateSnappingConfig({ snapToPageEdges: checked })}
                      disabled={!snappingConfig.enabled}
                      size="sm"
                    />
                  </div>

                  {/* 2. Page Centers */}
                  <div
                    className={`${styles.targetItem} ${!snappingConfig.enabled ? styles.targetItemDisabled : ''}`}
                    onClick={() => snappingConfig.enabled && updateSnappingConfig({ snapToPageCenters: !snappingConfig.snapToPageCenters })}
                  >
                    <div className={styles.targetInfo}>
                      <div className={styles.targetIcon}>
                        <Crosshair size={16} strokeWidth={1.5} />
                      </div>
                      <div className={styles.targetText}>
                        <span className={styles.targetTitle}>Page Optical Centerlines</span>
                        <span className={styles.targetDesc}>
                          Center axes of the Left Facing Page, Right Facing Page, and full Open Spread.
                        </span>
                      </div>
                    </div>
                    <Switch
                      checked={snappingConfig.snapToPageCenters}
                      onChange={(checked) => updateSnappingConfig({ snapToPageCenters: checked })}
                      disabled={!snappingConfig.enabled}
                      size="sm"
                    />
                  </div>

                  {/* 3. Safe Zone Margins */}
                  <div
                    className={`${styles.targetItem} ${!snappingConfig.enabled ? styles.targetItemDisabled : ''}`}
                    onClick={() => snappingConfig.enabled && updateSnappingConfig({ snapToMargins: !snappingConfig.snapToMargins })}
                  >
                    <div className={styles.targetInfo}>
                      <div className={styles.targetIcon}>
                        <Scan size={16} strokeWidth={1.5} />
                      </div>
                      <div className={styles.targetText}>
                        <span className={styles.targetTitle}>Safe Zone Margins</span>
                        <span className={styles.targetDesc}>
                          Safe area cut allowance guides (Blue dashed boundary lines).
                        </span>
                      </div>
                    </div>
                    <Switch
                      checked={snappingConfig.snapToMargins}
                      onChange={(checked) => updateSnappingConfig({ snapToMargins: checked })}
                      disabled={!snappingConfig.enabled}
                      size="sm"
                    />
                  </div>

                  {/* 4. Adjacent Photo Frames */}
                  <div
                    className={`${styles.targetItem} ${!snappingConfig.enabled ? styles.targetItemDisabled : ''}`}
                    onClick={() => snappingConfig.enabled && updateSnappingConfig({ snapToFrames: !snappingConfig.snapToFrames })}
                  >
                    <div className={styles.targetInfo}>
                      <div className={styles.targetIcon}>
                        <Grid2x2 size={16} strokeWidth={1.5} />
                      </div>
                      <div className={styles.targetText}>
                        <span className={styles.targetTitle}>Adjacent Photo Frames</span>
                        <span className={styles.targetDesc}>
                          Align to collinear edges (Left, Top, Right, Bottom) and centerlines of other photos on the spread.
                        </span>
                      </div>
                    </div>
                    <Switch
                      checked={snappingConfig.snapToFrames}
                      onChange={(checked) => updateSnappingConfig({ snapToFrames: checked })}
                      disabled={!snappingConfig.enabled}
                      size="sm"
                    />
                  </div>

                  {/* 5. Equidistant Gap Spacing */}
                  <div
                    className={`${styles.targetItem} ${!snappingConfig.enabled ? styles.targetItemDisabled : ''}`}
                    onClick={() => snappingConfig.enabled && updateSnappingConfig({ snapToEqualGaps: !snappingConfig.snapToEqualGaps })}
                  >
                    <div className={styles.targetInfo}>
                      <div className={styles.targetIcon}>
                        <Ruler size={16} strokeWidth={1.5} />
                      </div>
                      <div className={styles.targetText}>
                        <span className={styles.targetTitle}>Equidistant Gap Spacing</span>
                        <span className={styles.targetDesc}>
                          Automatically detect equal inter-frame gap distances and render dynamic gap indicator HUD lines.
                        </span>
                      </div>
                    </div>
                    <Switch
                      checked={snappingConfig.snapToEqualGaps}
                      onChange={(checked) => updateSnappingConfig({ snapToEqualGaps: checked })}
                      disabled={!snappingConfig.enabled}
                      size="sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* 3. Multi-Frame Resize Tab                                           */}
          {/* ================================================================ */}
          {activeTab === 'layout' && (
            <div className={styles.tabContent}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>Multi-Frame Resize Behavior</div>
                <div className={styles.sectionSubtitle}>
                  Configure inter-frame gap preservation rules when resizing multiple selected photos.
                </div>
              </div>

              {/* Multi-Frame Resize Gap Mode (2-Card Selector) */}
              <div className={styles.card}>
                <div className={styles.cardTitle} style={{ marginBottom: '6px' }}>
                  Multi-Frame Resize Gap Behavior
                </div>
                <div className={styles.cardSubtitle} style={{ marginBottom: '14px' }}>
                  Determines how the inter-frame gaps behave when resizing a multi-selection group of photos.
                </div>

                <div className={styles.modeGrid}>
                  {/* Mode 1: Proportional */}
                  <div
                    className={`${styles.modeCard} ${multiResizeGapMode === 'proportional' ? styles.modeCardActive : ''}`}
                    onClick={() => setMultiResizeGapMode('proportional')}
                  >
                    <div className={styles.modeCardHeader}>
                      <div className={styles.modeIcon}>
                        <Maximize2 size={15} strokeWidth={1.5} />
                      </div>
                      <div className={`${styles.radioIndicator} ${multiResizeGapMode === 'proportional' ? styles.radioIndicatorActive : ''}`}>
                        {multiResizeGapMode === 'proportional' && <div className={styles.radioDot} />}
                      </div>
                    </div>

                    <div className={styles.modeTitle}>Proportional Visual Gap</div>

                    <div>
                      <span className={styles.modeBadge}>Recommended</span>
                    </div>

                    <div className={styles.modeDesc}>
                      Scales inter-frame gaps proportionally with photo dimensions so the white space always looks harmonious and identical in visual proportion at any size.
                    </div>
                  </div>

                  {/* Mode 2: Fixed Gap */}
                  <div
                    className={`${styles.modeCard} ${multiResizeGapMode === 'fixed_gap' ? styles.modeCardActive : ''}`}
                    onClick={() => setMultiResizeGapMode('fixed_gap')}
                  >
                    <div className={styles.modeCardHeader}>
                      <div className={styles.modeIcon}>
                        <Columns2 size={15} strokeWidth={1.5} />
                      </div>
                      <div className={`${styles.radioIndicator} ${multiResizeGapMode === 'fixed_gap' ? styles.radioIndicatorActive : ''}`}>
                        {multiResizeGapMode === 'fixed_gap' && <div className={styles.radioDot} />}
                      </div>
                    </div>

                    <div className={styles.modeTitle}>Strict Fixed Physical Gap</div>

                    <div>
                      <span className={styles.modeBadge} style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-text-primary)', borderColor: 'var(--color-accent-border)' }}>
                        2D Topological Graph
                      </span>
                    </div>

                    <div className={styles.modeDesc}>
                      Preserves the exact physical millimeter gap spacing between adjacent frames using 2D Topological Neighbor Graph math across all dimensions.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* 4. Keyboard Shortcuts Tab                                         */}
          {/* ================================================================ */}
          {activeTab === 'shortcuts' && (
            <div className={styles.tabContent}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>Shortcuts &amp; Gestures</div>
                <div className={styles.sectionSubtitle}>
                  Context-aware keyboard shortcuts and canvas gestures for faster album editing.
                </div>
              </div>

              <div className={styles.shortcutGuide} role="note">
                <div className={styles.shortcutGuideIcon} aria-hidden="true">
                  <Info size={15} strokeWidth={1.5} />
                </div>
                <div className={styles.shortcutGuideContent}>
                  <div className={styles.shortcutGuideTitle}>Context-aware shortcuts</div>
                  <div className={styles.shortcutGuideText}>
                    Each shortcut applies to the context shown on its label. Shortcuts are paused while typing.
                  </div>
                </div>
              </div>

              {/* Search & Category Filter Toolbar */}
              <div className={styles.shortcutsToolbar}>
                <div className={styles.searchBox}>
                  <span className={styles.searchIcon}>
                    <Search size={14} strokeWidth={1.5} />
                  </span>
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Search by action, key, context, or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className={styles.clearSearchBtn}
                      onClick={() => setSearchQuery('')}
                      title="Clear search"
                    >
                      <X size={12} strokeWidth={1.5} />
                    </button>
                  )}
                </div>

                <div className={styles.chipList}>
                  {SHORTCUT_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`${styles.chipBtn} ${categoryFilter === cat ? styles.chipBtnActive : ''}`}
                      onClick={() => setCategoryFilter(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shortcut Items Grid */}
              {Object.keys(groupedShortcuts).length > 0 ? (
                Object.entries(groupedShortcuts).map(([category, items]) => (
                  <div key={category} className={styles.shortcutCategory}>
                    <div className={styles.categoryTitle}>
                      <Sparkles size={12} strokeWidth={1.5} />
                      {category}
                    </div>

                    <div className={styles.shortcutGrid}>
                      {items.map((item) => (
                        <div key={item.id} className={styles.shortcutRow}>
                          <div className={styles.shortcutAction}>
                            <div className={styles.shortcutActionHeader}>
                              <span>{item.action}</span>
                              <span className={styles.shortcutScope}>{item.scope}</span>
                            </div>
                            {item.note && (
                              <div className={styles.shortcutNote}>{item.note}</div>
                            )}
                          </div>

                          <div className={styles.shortcutKeys}>
                            {item.combos.map((combo, comboIdx) => (
                              <React.Fragment key={comboIdx}>
                                {comboIdx > 0 && (
                                  <span className={styles.shortcutAlternative}>or</span>
                                )}
                                {combo.map((keyToken, tokenIdx) => (
                                  <React.Fragment key={tokenIdx}>
                                    {tokenIdx > 0 && <span className={styles.shortcutJoin}>+</span>}
                                    <kbd className={styles.kbd}>{keyToken}</kbd>
                                  </React.Fragment>
                                ))}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.emptySearch}>
                  <SearchX size={32} strokeWidth={1.5} />
                  <div className={styles.emptySearchTitle}>No shortcuts found</div>
                  <div className={styles.emptySearchDesc}>
                    No keyboard shortcuts match &quot;{searchQuery}&quot;. Try a different keyword or select &apos;All&apos;.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </Dialog>
      <ConfirmDialog
        isOpen={confirmAction !== null}
        title="Clean Unused Cache"
        message="Remove generated cache files that are no longer used by any project?"
        detail="Active thumbnails and previews remain untouched. This operation cannot be undone, but removed cache files are not original photos."
        confirmText="Clean Cache"
        variant="warning"
        isLoading={isGeneralActionBusy}
        loadingText="Cleaning…"
        error={generalActionError}
        onConfirm={handleConfirmedGeneralAction}
        onCancel={() => {
          if (!isGeneralActionBusy) {
            setConfirmAction(null);
            setGeneralActionError(null);
          }
        }}
      />
    </>
  );
}
