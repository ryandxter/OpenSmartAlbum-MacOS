import { create } from 'zustand';
import {
  LayoutTemplate,
  LayoutTemplateSpec,
  LayoutTemplateFolder,
  TemplateSlot,
  StagedImportPreview,
  StagedExportPreview,
  TemplateTargetArea,
  TemplatePlacementMode,
  TemplateApplyStyleOptions,
  getProjectDimensionsInCanvasUnit,
} from '../domain/templates';
import { useAlbumStore } from './albumStore';
import { useProjectStore } from './projectStore';
import { useCarouselStore } from './carouselStore';
import type { CarouselPhotoFrame } from '../domain/carousel';
import type { PhotoFrameElement } from '../domain/editor';

export interface ApplyTemplatePreferences {
  targetArea: TemplateTargetArea;
  placementMode: TemplatePlacementMode;
  styleOpts: TemplateApplyStyleOptions;
}

export const DEFAULT_APPLY_PREFERENCES: ApplyTemplatePreferences = {
  targetArea: 'spread',
  placementMode: 'fit_safe_margin',
  styleOpts: {
    geometryOnly: false,
    borders: true,
    cornerRadii: true,
    shadows: true,
    effects: true,
    opacity: true,
    frameOverlays: true,
  },
};

interface TemplateStoreState {
  templates: LayoutTemplate[];
  folders: LayoutTemplateFolder[];
  activeFolderId: string | null; // null = All, 'unfiled' = Unfiled, or folder UUID
  searchQuery: string;
  filterType: 'all' | 'spread' | 'post';
  isLoading: boolean;
  isSaving: boolean;

  // Staged Import modal state
  isImportModalOpen: boolean;
  stagedImport: StagedImportPreview | null;

  // Apply Template Dialog state
  isApplyModalOpen: boolean;
  selectedTemplateForApply: LayoutTemplate | null;
  lastApplyOptions: ApplyTemplatePreferences;

  // State setters
  setActiveFolderId: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setFilterType: (t: 'all' | 'spread' | 'post') => void;
  openApplyModal: (template: LayoutTemplate) => void;
  closeApplyModal: () => void;
  setLastApplyOptions: (opts: Partial<ApplyTemplatePreferences>) => void;

  // CRUD Actions
  loadTemplates: () => Promise<void>;
  saveCurrentAsTemplate: (name: string, folderId?: string | null) => Promise<LayoutTemplate | null>;
  overwriteTemplate: (id: string, payload?: string | LayoutTemplateSpec) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;

  // Folder Actions
  createFolder: (name: string) => Promise<LayoutTemplateFolder | null>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  moveTemplatesToFolder: (templateIds: string[], folderId: string | null) => Promise<void>;

  // Staged Import & Export Actions
  prepareImport: (filePath: string) => Promise<StagedImportPreview | null>;
  executeImport: (token: string, resolution: 'overwrite' | 'keep_both') => Promise<void>;
  cancelImport: (token?: string) => Promise<void>;
  exportTemplate: (templateId: string, targetPath?: string) => Promise<string | null>;
  exportPackage: (templateIds: string[], targetPath?: string) => Promise<string | null>;
}

// Helper to safely invoke Tauri commands
async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

export const useTemplateStore = create<TemplateStoreState>((set, get) => ({
  templates: [],
  folders: [],
  activeFolderId: null,
  searchQuery: '',
  filterType: 'all',
  isLoading: false,
  isSaving: false,

  isImportModalOpen: false,
  stagedImport: null,

  isApplyModalOpen: false,
  selectedTemplateForApply: null,
  lastApplyOptions: DEFAULT_APPLY_PREFERENCES,

  setActiveFolderId: (activeFolderId) => set({ activeFolderId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFilterType: (filterType) => set({ filterType }),

  openApplyModal: (selectedTemplateForApply) =>
    set({ isApplyModalOpen: true, selectedTemplateForApply }),
  closeApplyModal: () =>
    set({ isApplyModalOpen: false, selectedTemplateForApply: null }),

  setLastApplyOptions: (opts) =>
    set((s) => ({
      lastApplyOptions: {
        ...s.lastApplyOptions,
        ...opts,
        styleOpts: {
          ...s.lastApplyOptions.styleOpts,
          ...(opts.styleOpts || {}),
        },
      },
    })),

  loadTemplates: async () => {
    set({ isLoading: true });
    try {
      const [tplRows, fldRows] = await Promise.all([
        tauriInvoke<any[]>('list_layout_templates').catch((err) => {
          console.warn('[templateStore] list_layout_templates fallback:', err);
          return [];
        }),
        tauriInvoke<any[]>('list_layout_template_folders').catch((err) => {
          console.warn('[templateStore] list_layout_template_folders fallback:', err);
          return [];
        }),
      ]);

      const templates: LayoutTemplate[] = (tplRows || []).map((row) => {
        let parsedPayload: LayoutTemplateSpec;
        try {
          parsedPayload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
        } catch {
          parsedPayload = {
            id: row.id,
            name: 'Custom Template',
            slots: [],
          };
        }
        return {
          id: row.id,
          name: parsedPayload.name || 'Custom Template',
          folderId: row.folderId ?? row.folder_id ?? null,
          payload: parsedPayload,
          isFavorite: Boolean(row.isFavorite ?? row.is_favorite),
          createdAt: row.createdAt ?? row.created_at,
          updatedAt: row.updatedAt ?? row.updated_at,
        };
      });

      const folders: LayoutTemplateFolder[] = (fldRows || []).map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.createdAt ?? row.created_at,
        updatedAt: row.updatedAt ?? row.updated_at,
      }));

      set({ templates, folders, isLoading: false });
    } catch (err) {
      console.error('[templateStore] Failed to load templates:', err);
      set({ isLoading: false });
    }
  },

  saveCurrentAsTemplate: async (name: string, folderId: string | null = null) => {
    set({ isSaving: true });
    try {
      const project = useProjectStore.getState().currentProject;
      const isCarousel = project?.projectType === 'carousel';

      let spec: LayoutTemplateSpec;

      if (isCarousel) {
        const carousel = useCarouselStore.getState().currentCarousel;
        const slideIndex = useCarouselStore.getState().activeSlideIndex;
        const activeSlide = carousel?.slides[slideIndex];
        const slideW = carousel?.slideWidthPx || 1080;
        const slideH = carousel?.slideHeightPx || 1080;

        const candidateElements = (activeSlide?.elements || []).filter(
          (el): el is CarouselPhotoFrame => el.type === 'photo' && !el.excludeFromAdaptiveLayout
        );

        const slots: TemplateSlot[] = candidateElements.map((el, idx) => ({
          id: `slot-${idx + 1}`,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          rotation: el.rotation || 0,
          zIndex: el.zIndex ?? (idx + 1),
          style: {
            borderEnabled: el.borderEnabled ?? false,
            borderWidth: el.borderWidth ?? 0,
            borderColor: el.borderColor ?? '#000000',
            cornerRadii: el.cornerRadius ?? 0,
            shadowEnabled: el.shadowEnabled ?? false,
            shadowBlur: el.shadowBlur ?? 10,
            shadowOffsetX: el.shadowOffsetX ?? 0,
            shadowOffsetY: el.shadowOffsetY ?? 4,
            shadowOpacity: el.shadowOpacity ?? 0.25,
            shadowColor: el.shadowColor ?? '#000000',
            opacity: el.opacity ?? 100,
            noiseAmount: el.noiseAmount ?? 0,
            blurRadius: el.blurRadius ?? 0,
            grayscaleAmount: el.grayscaleAmount ?? 0,
          },
          frameAssetId: el.frameAssetId ?? null,
          frameAssetTitle: el.frameAssetTitle ?? null,
          frameAssetUrl: el.frameAssetUrl ?? null,
          frameAssetLocalPath: el.frameAssetLocalPath ?? null,
          frameAssetSlot: el.frameAssetSlot ?? null,
          frameAssetIsPro: false,
        }));

        spec = {
          version: 1,
          name: name.trim() || 'Carousel Slide Template',
          canvas: {
            kind: 'post',
            width: slideW,
            height: slideH,
            pageWidth: slideW,
            gutterWidth: 0,
            unit: 'px',
            dpi: 72,
          },
          slots,
        };
      } else {
        // Print Album
        const album = useAlbumStore.getState().currentAlbum;
        const activeSpreadId = useAlbumStore.getState().activeSpreadId;
        const activeSpread =
          album?.spreads.find((s) => s.id === activeSpreadId) ||
          (album?.coverSpread?.id === activeSpreadId ? album.coverSpread : album?.spreads[0]);

        if (!activeSpread || !project) {
          throw new Error('No active spread to save as template');
        }

        const dims = getProjectDimensionsInCanvasUnit(project, activeSpread);
        const isCover = album?.coverSpread?.id === activeSpread.id;
        const isSpread = !isCover;
        const spreadW = isCover
          ? (activeSpread.leftPage ? activeSpread.leftPage.width : dims.pageWidth) +
            (activeSpread.rightPage ? activeSpread.rightPage.width : 0) +
            dims.gutterWidth
          : dims.pageWidth * 2 + dims.gutterWidth;
        const spreadH = dims.pageHeight;
        const spineX = dims.pageWidth + dims.gutterWidth / 2;

        const candidateElements = (activeSpread.elements || []).filter(
          (el): el is PhotoFrameElement => el.type === 'photo' && !el.excludeFromAdaptiveLayout
        );

        const slots: TemplateSlot[] = candidateElements.map((el, idx) => ({
          id: `slot-${idx + 1}`,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          rotation: el.rotation || 0,
          zIndex: el.zIndex ?? (idx + 1),
          page: isSpread ? (el.x < spineX ? 'left' : 'right') : 'full',
          style: {
            borderEnabled: el.borderEnabled ?? false,
            borderWidth: el.borderWidth ?? 0,
            borderColor: el.borderColor ?? '#000000',
            cornerRadii: el.cornerRadius ?? 0,
            shadowEnabled: el.shadowEnabled ?? false,
            shadowBlur: el.shadowBlur ?? 10,
            shadowOffsetX: el.shadowOffsetX ?? 0,
            shadowOffsetY: el.shadowOffsetY ?? 4,
            shadowOpacity: el.shadowOpacity ?? 0.25,
            shadowColor: el.shadowColor ?? '#000000',
            opacity: el.opacity ?? 100,
            noiseAmount: el.noiseAmount ?? 0,
            blurRadius: el.blurRadius ?? 0,
            grayscaleAmount: el.grayscaleAmount ?? 0,
          },
          frameAssetId: el.frameAssetId ?? null,
          frameAssetTitle: el.frameAssetTitle ?? null,
          frameAssetUrl: el.frameAssetUrl ?? null,
          frameAssetLocalPath: el.frameAssetLocalPath ?? null,
          frameAssetSlot: el.frameAssetSlot ?? null,
          frameAssetIsPro: false,
        }));

        spec = {
          version: 1,
          name: name.trim() || 'Custom Spread Template',
          canvas: {
            kind: isSpread ? 'spread' : 'single',
            width: spreadW,
            height: spreadH,
            pageWidth: dims.pageWidth,
            gutterWidth: dims.gutterWidth,
            unit: project.canvasUnit,
            dpi: project.canvasDpi || 300,
          },
          slots,
        };
      }

      const row = await tauriInvoke<any>('save_layout_template', {
        id: null,
        payload: JSON.stringify(spec),
        isFavorite: false,
        folderId: folderId || null,
      });

      await get().loadTemplates();

      const created: LayoutTemplate = {
        id: row.id,
        name: spec.name,
        folderId: row.folderId ?? row.folder_id ?? folderId,
        payload: spec,
        isFavorite: false,
        createdAt: row.createdAt ?? row.created_at,
        updatedAt: row.updatedAt ?? row.updated_at,
      };

      set({ isSaving: false });
      return created;
    } catch (err) {
      console.error('[templateStore] Failed to save template:', err);
      set({ isSaving: false });
      return null;
    }
  },

  overwriteTemplate: async (id: string, payload?: string | LayoutTemplateSpec) => {
    try {
      let payloadStr: string;
      if (typeof payload === 'string') {
        payloadStr = payload;
      } else if (payload && typeof payload === 'object') {
        payloadStr = JSON.stringify(payload);
      } else {
        const existing = get().templates.find((t) => t.id === id);
        if (!existing) return;
        payloadStr = typeof existing.payload === 'string' ? existing.payload : JSON.stringify(existing.payload);
      }

      await tauriInvoke('overwrite_layout_template', { id, payload: payloadStr });
      await get().loadTemplates();
    } catch (err) {
      console.error('[templateStore] Failed to overwrite template:', err);
    }
  },

  deleteTemplate: async (id: string) => {
    try {
      set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }));
      await tauriInvoke('delete_layout_template', { id });
      await get().loadTemplates();
    } catch (err) {
      console.error('[templateStore] Failed to delete template:', err);
      await get().loadTemplates();
    }
  },

  toggleFavorite: async (id: string) => {
    const tpl = get().templates.find((t) => t.id === id);
    if (!tpl) return;
    const nextFavorite = !tpl.isFavorite;

    set((s) => ({
      templates: s.templates.map((t) => (t.id === id ? { ...t, isFavorite: nextFavorite } : t)),
    }));

    try {
      await tauriInvoke('toggle_layout_template_favorite', { id, isFavorite: nextFavorite });
    } catch (err) {
      console.error('[templateStore] Failed to toggle favorite:', err);
      await get().loadTemplates();
    }
  },

  createFolder: async (name: string) => {
    try {
      const row = await tauriInvoke<any>('create_layout_template_folder', {
        id: null,
        name: name.trim(),
      });
      await get().loadTemplates();
      return {
        id: row.id,
        name: row.name,
        createdAt: row.createdAt ?? row.created_at,
        updatedAt: row.updatedAt ?? row.updated_at,
      };
    } catch (err) {
      console.error('[templateStore] Failed to create folder:', err);
      return null;
    }
  },

  renameFolder: async (id: string, name: string) => {
    try {
      await tauriInvoke('rename_layout_template_folder', { id, newName: name.trim() });
      await get().loadTemplates();
    } catch (err) {
      console.error('[templateStore] Failed to rename folder:', err);
    }
  },

  deleteFolder: async (id: string) => {
    try {
      await tauriInvoke('delete_layout_template_folder', { id });
      if (get().activeFolderId === id) {
        set({ activeFolderId: null });
      }
      await get().loadTemplates();
    } catch (err) {
      console.error('[templateStore] Failed to delete folder:', err);
    }
  },

  moveTemplatesToFolder: async (templateIds: string[], folderId: string | null) => {
    try {
      await tauriInvoke('move_templates_to_folder', {
        templateIds,
        folderId: folderId || null,
      });
      await get().loadTemplates();
    } catch (err) {
      console.error('[templateStore] Failed to move templates to folder:', err);
    }
  },

  prepareImport: async (filePath: string) => {
    try {
      const isPkg = filePath.toLowerCase().endsWith('.osatp') || filePath.toLowerCase().endsWith('.afsnp');
      const cmd = isPkg ? 'prepare_import_layout_template_package' : 'prepare_import_layout_template';
      const preview = await tauriInvoke<StagedImportPreview>(cmd, { filePath });
      set({ stagedImport: preview, isImportModalOpen: true });
      return preview;
    } catch (err) {
      console.error('[templateStore] Failed to prepare import:', err);
      return null;
    }
  },

  executeImport: async (token: string, resolution: 'overwrite' | 'keep_both') => {
    try {
      await tauriInvoke('execute_staged_template_import', { token, resolution });
      set({ stagedImport: null, isImportModalOpen: false });
      await get().loadTemplates();
    } catch (err) {
      console.error('[templateStore] Failed to execute import:', err);
      throw err;
    }
  },

  cancelImport: async (token?: string) => {
    const t = token || get().stagedImport?.token;
    if (t) {
      try {
        await tauriInvoke('cancel_staged_template_op', { token: t });
      } catch (err) {
        console.warn('[templateStore] cancel_staged_template_op error:', err);
      }
    }
    set({ stagedImport: null, isImportModalOpen: false });
  },

  exportTemplate: async (templateId: string, targetPath?: string) => {
    try {
      let finalPath = targetPath;
      if (!finalPath) {
        const tpl = get().templates.find((t) => t.id === templateId);
        const name = tpl?.name || 'custom_template';
        const picked = await tauriInvoke<string | null>('pick_template_export_save_dialog', {
          suggestedName: name,
          isPackage: false,
        });
        if (!picked) return null;
        finalPath = picked;
      }

      const preview = await tauriInvoke<StagedExportPreview>('prepare_export_layout_template', {
        templateIds: [templateId],
        targetPath: finalPath,
      });

      const result = await tauriInvoke<string>('execute_staged_template_export', {
        token: preview.token,
      });
      return result;
    } catch (err) {
      console.error('[templateStore] Failed to export template:', err);
      return null;
    }
  },

  exportPackage: async (templateIds: string[], targetPath?: string) => {
    try {
      let finalPath = targetPath;
      if (!finalPath) {
        const picked = await tauriInvoke<string | null>('pick_template_export_save_dialog', {
          suggestedName: 'OpenSmartAlbum_Template_Bundle',
          isPackage: true,
        });
        if (!picked) return null;
        finalPath = picked;
      }

      const preview = await tauriInvoke<StagedExportPreview>('prepare_export_layout_template', {
        templateIds,
        targetPath: finalPath,
      });

      const result = await tauriInvoke<string>('execute_staged_template_export', {
        token: preview.token,
      });
      return result;
    } catch (err) {
      console.error('[templateStore] Failed to export package:', err);
      return null;
    }
  },
}));
