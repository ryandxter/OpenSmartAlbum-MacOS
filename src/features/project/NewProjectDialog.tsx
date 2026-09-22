import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  BookOpen,
  RectangleHorizontal,
  RectangleVertical,
  Square,
  Scan,
  Palette,
  Bookmark,
  Star,
  Trash2,
  Maximize2,
  ArrowLeftRight,
  Check,
  Columns2,
  Eye,
  Smartphone,
  Grid2x2,
  Layers,
} from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { NumberInput } from '../../components/ui/NumberInput';
import { Select } from '../../components/ui/Select';
import { ColorPicker } from '../../components/ui/ColorPicker';
import { Switch } from '../../components/ui/Switch';
import { useProjectStore } from '../../stores/projectStore';
import { Unit, UNIT_OPTIONS, convertUnit, formatDimensions, toPixels, getMaxGapForUnit } from '../../domain/units';
import {
  AlbumPreset,
  CUSTOM_PRESET_ID,
  findMatchingPreset,
  formatPresetLabel,
  getPresetById,
  getAllPresets,
  saveCustomPreset,
  deleteCustomPreset,
} from '../../domain/presets';
import { validateProjectSettings } from '../../domain/project';
import { useCarouselStore } from '../../stores/carouselStore';
import { CarouselRatio, CAROUSEL_RATIO_PRESETS } from '../../domain/carousel';
import styles from './NewProjectDialog.module.css';

export function NewProjectDialog() {
  const isOpen = useProjectStore((s) => s.isNewProjectOpen);
  const closeNewProject = useProjectStore((s) => s.closeNewProject);
  const createNewProject = useProjectStore((s) => s.createNewProject);

  const initializeCarousel = useCarouselStore((s) => s.initializeCarousel);

  // Project mode selector: album (print) or carousel (social media)
  const [projectMode, setProjectMode] = useState<'album' | 'carousel'>('album');

  // Carousel-specific settings
  const [carouselRatio, setCarouselRatio] = useState<CarouselRatio>('4:5');
  const [carouselSlideCount, setCarouselSlideCount] = useState(5);
  const [carouselBgColor, setCarouselBgColor] = useState('#FFFFFF');
  const [carouselName, setCarouselName] = useState('Untitled Carousel');

  const [allPresets, setAllPresets] = useState<AlbumPreset[]>([]);
  const [isSavePresetOpen, setIsSavePresetOpen] = useState(false);
  const [customPresetName, setCustomPresetName] = useState('');
  const [presetSaveSuccess, setPresetSaveSuccess] = useState<string | null>(null);

  const [name, setName] = useState('Untitled Album');
  const [presetId, setPresetId] = useState<string>('square-20x20-cm');
  const [canvasWidth, setCanvasWidth] = useState(20);
  const [canvasHeight, setCanvasHeight] = useState(20);
  const [canvasUnit, setCanvasUnit] = useState<Unit>('cm');
  const [canvasDpi, setCanvasDpi] = useState(300);

  const [spacingValue, setSpacingValue] = useState(2);
  const [spacingUnit, setSpacingUnit] = useState<Unit>('cm');

  // Safe Margin
  const [marginEnabled, setMarginEnabled] = useState(true);
  const [isMargin4S, setIsMargin4S] = useState(false);
  const [marginValue, setMarginValue] = useState(2);
  const [marginTop, setMarginTop] = useState(2);
  const [marginBottom, setMarginBottom] = useState(2);
  const [marginOutside, setMarginOutside] = useState(2);
  const [marginSpine, setMarginSpine] = useState(2);
  const [marginUnit, setMarginUnit] = useState<Unit>('cm');

  // Border
  const [borderEnabled, setBorderEnabled] = useState(false);
  const [borderWidth, setBorderWidth] = useState(0.1);
  const [borderUnit, setBorderUnit] = useState<Unit>('cm');
  const [borderColor, setBorderColor] = useState('#FFFFFF');

  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [activeTab, setActiveTab] = useState<'page' | 'margins' | 'appearance'>('page');


  // Helper to round values cleanly based on unit
  const roundUnit = (val: number, unit: Unit): number => {
    if (unit === 'inch') return Math.round(val * 100) / 100;
    if (unit === 'cm') return Math.round(val * 100) / 100;
    if (unit === 'mm') return Math.round(val * 10) / 10;
    if (unit === 'px') return Math.round(val * 10) / 10;
    return Math.round(val);
  };

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      const presets = getAllPresets();
      setAllPresets(presets);
      setProjectMode('album');
      setCarouselName('Untitled Carousel');
      setCarouselRatio('4:5');
      setCarouselSlideCount(5);
      setCarouselBgColor('#FFFFFF');
      setName('Untitled Album');
      setPresetId('square-20x20-cm');
      setCanvasWidth(20);
      setCanvasHeight(20);
      setCanvasUnit('cm');
      setCanvasDpi(300);
      setSpacingValue(2);
      setSpacingUnit('cm');
      setMarginEnabled(true);
      setIsMargin4S(false);
      setMarginValue(2);
      setMarginTop(2);
      setMarginBottom(2);
      setMarginOutside(2);
      setMarginSpine(2);
      setMarginUnit('cm');
      setBorderEnabled(false); // Default disabled
      setBorderWidth(0.1);
      setBorderUnit('cm');
      setBorderColor('#FFFFFF');
      setBackgroundColor('#FFFFFF');
      setErrorMessage(null);
      setIsSubmitting(false);
      setIsSavePresetOpen(false);
      setCustomPresetName('');
      setPresetSaveSuccess(null);
      setActiveTab('page');
    }
  }, [isOpen]);

  // Preset Selection with full unit synchronization and custom settings loading
  const handlePresetSelect = (id: string) => {
    setPresetId(id);
    if (id === CUSTOM_PRESET_ID) return;

    const preset = allPresets.find((p) => p.id === id) || getPresetById(id);
    if (preset) {
      // Convert preset dimensions to user's active canvasUnit so their unit selection is strictly preserved
      const targetW = roundUnit(convertUnit(preset.width, preset.unit, canvasUnit, canvasDpi), canvasUnit);
      const targetH = roundUnit(convertUnit(preset.height, preset.unit, canvasUnit, canvasDpi), canvasUnit);
      setCanvasWidth(targetW);
      setCanvasHeight(targetH);
      if (preset.dpi) setCanvasDpi(preset.dpi);

      if (preset.isCustom) {
        if (preset.spacingValue !== undefined) {
          const sp = roundUnit(convertUnit(preset.spacingValue, preset.spacingUnit || preset.unit, spacingUnit, canvasDpi), spacingUnit);
          setSpacingValue(sp);
        }
        if (preset.marginValue !== undefined) {
          const mv = roundUnit(convertUnit(preset.marginValue, preset.marginUnit || preset.unit, marginUnit, canvasDpi), marginUnit);
          setMarginValue(mv);
          setMarginTop(mv);
          setMarginBottom(mv);
          setMarginOutside(mv);
          setMarginSpine(mv);
        }
        if (preset.borderWidth !== undefined) {
          const bw = roundUnit(convertUnit(preset.borderWidth, preset.borderUnit || preset.unit, borderUnit, canvasDpi), borderUnit);
          setBorderWidth(bw);
        }
        if (preset.marginEnabled !== undefined) setMarginEnabled(preset.marginEnabled);
        if (preset.borderEnabled !== undefined) setBorderEnabled(preset.borderEnabled);
        if (preset.borderColor) setBorderColor(preset.borderColor);
        if (preset.backgroundColor) setBackgroundColor(preset.backgroundColor);
      }
    }
  };

  // Save current settings as a reusable custom preset
  const handleSaveCustomPreset = () => {
    const trimmed = customPresetName.trim();
    if (!trimmed) return;

    const newPreset: AlbumPreset = {
      id: `custom-${Date.now()}`,
      name: trimmed,
      width: canvasWidth,
      height: canvasHeight,
      unit: canvasUnit,
      dpi: canvasDpi,
      isCustom: true,
      spacingValue,
      spacingUnit,
      marginEnabled,
      marginValue,
      marginUnit,
      borderEnabled,
      borderWidth,
      borderUnit,
      borderColor,
      backgroundColor,
    };

    const updated = saveCustomPreset(newPreset);
    setAllPresets(updated);
    setPresetId(newPreset.id);
    setIsSavePresetOpen(false);
    setCustomPresetName('');
    setPresetSaveSuccess(`Preset "${trimmed}" saved!`);
    setTimeout(() => setPresetSaveSuccess(null), 3500);
  };

  // Delete a saved custom preset
  const handleDeleteCustomPreset = (idToDelete: string) => {
    const updated = deleteCustomPreset(idToDelete);
    setAllPresets(updated);
    setPresetId('square-8x8');
    handlePresetSelect('square-8x8');
  };

  // Synchronize all units across the entire project dialog with automatic mathematical conversion
  const handleUnitChange = (newUnitStr: string) => {
    const newUnit = newUnitStr as Unit;
    if (newUnit === canvasUnit) return;

    // Convert Page Dimensions
    const convertedW = roundUnit(convertUnit(canvasWidth, canvasUnit, newUnit, canvasDpi), newUnit);
    const convertedH = roundUnit(convertUnit(canvasHeight, canvasUnit, newUnit, canvasDpi), newUnit);
    setCanvasWidth(convertedW);
    setCanvasHeight(convertedH);
    setCanvasUnit(newUnit);

    // Convert Safe Margin
    const convertedMargin = roundUnit(convertUnit(marginValue, marginUnit, newUnit, canvasDpi), newUnit);
    setMarginValue(convertedMargin);
    setMarginTop(roundUnit(convertUnit(marginTop, marginUnit, newUnit, canvasDpi), newUnit));
    setMarginBottom(roundUnit(convertUnit(marginBottom, marginUnit, newUnit, canvasDpi), newUnit));
    setMarginOutside(roundUnit(convertUnit(marginOutside, marginUnit, newUnit, canvasDpi), newUnit));
    setMarginSpine(roundUnit(convertUnit(marginSpine, marginUnit, newUnit, canvasDpi), newUnit));
    setMarginUnit(newUnit);

    // Convert Spacing
    const convertedSpacing = Math.min(
      roundUnit(convertUnit(spacingValue, spacingUnit, newUnit, canvasDpi), newUnit),
      getMaxGapForUnit(newUnit)
    );
    setSpacingValue(convertedSpacing);
    setSpacingUnit(newUnit);

    // Convert Border
    const convertedBorder = roundUnit(convertUnit(borderWidth, borderUnit, newUnit, canvasDpi), newUnit);
    setBorderWidth(convertedBorder);
    setBorderUnit(newUnit);

    const matched = findMatchingPreset(convertedW, convertedH, newUnit, canvasDpi);
    setPresetId(matched ? matched.id : CUSTOM_PRESET_ID);
  };

  // Width & Height changes
  const handleWidthChange = (val: number) => {
    setCanvasWidth(val);
    const matched = findMatchingPreset(val, canvasHeight, canvasUnit, canvasDpi);
    setPresetId(matched ? matched.id : CUSTOM_PRESET_ID);
  };

  const handleHeightChange = (val: number) => {
    setCanvasHeight(val);
    const matched = findMatchingPreset(canvasWidth, val, canvasUnit, canvasDpi);
    setPresetId(matched ? matched.id : CUSTOM_PRESET_ID);
  };

  // Orientation Selector
  const handleOrientation = (mode: 'square' | 'portrait' | 'landscape') => {
    if (mode === 'square') {
      const size = canvasWidth;
      setCanvasWidth(size);
      setCanvasHeight(size);
      const matched = findMatchingPreset(size, size, canvasUnit, canvasDpi);
      setPresetId(matched ? matched.id : CUSTOM_PRESET_ID);
    } else if (mode === 'portrait') {
      if (canvasWidth > canvasHeight) {
        const w = canvasHeight;
        const h = canvasWidth;
        setCanvasWidth(w);
        setCanvasHeight(h);
        const matched = findMatchingPreset(w, h, canvasUnit, canvasDpi);
        setPresetId(matched ? matched.id : CUSTOM_PRESET_ID);
      } else if (Math.abs(canvasWidth - canvasHeight) < 0.001) {
        const h = Math.round(canvasWidth * 1.25 * 10) / 10;
        setCanvasHeight(h);
        const matched = findMatchingPreset(canvasWidth, h, canvasUnit, canvasDpi);
        setPresetId(matched ? matched.id : CUSTOM_PRESET_ID);
      }
    } else if (mode === 'landscape') {
      if (canvasHeight > canvasWidth) {
        const w = canvasHeight;
        const h = canvasWidth;
        setCanvasWidth(w);
        setCanvasHeight(h);
        const matched = findMatchingPreset(w, h, canvasUnit, canvasDpi);
        setPresetId(matched ? matched.id : CUSTOM_PRESET_ID);
      } else if (Math.abs(canvasWidth - canvasHeight) < 0.001) {
        const w = Math.round(canvasHeight * 1.25 * 10) / 10;
        setCanvasWidth(w);
        const matched = findMatchingPreset(w, canvasHeight, canvasUnit, canvasDpi);
        setPresetId(matched ? matched.id : CUSTOM_PRESET_ID);
      }
    }
  };

  // Swap Width & Height
  const handleSwapDimensions = () => {
    const nextW = canvasHeight;
    const nextH = canvasWidth;
    setCanvasWidth(nextW);
    setCanvasHeight(nextH);
    const matched = findMatchingPreset(nextW, nextH, canvasUnit, canvasDpi);
    setPresetId(matched ? matched.id : CUSTOM_PRESET_ID);
  };

  const currentOrientation =
    Math.abs(canvasWidth - canvasHeight) < 0.01
      ? 'square'
      : canvasWidth < canvasHeight
      ? 'portrait'
      : 'landscape';

  // Calculate spread dimensions (Spread = 2 pages side-by-side)
  const spreadWidth = canvasWidth * 2;
  const spreadHeight = canvasHeight;

  // Pixel calculations
  const spreadPxW = Math.round(toPixels(spreadWidth, canvasUnit, canvasDpi));
  const spreadPxH = Math.round(toPixels(spreadHeight, canvasUnit, canvasDpi));
  const megapixels = ((spreadPxW * spreadPxH) / 1_000_000).toFixed(1);

  // Live preview aspect ratio box calculation
  const previewRatio = spreadWidth / spreadHeight;
  let previewBoxW = 200;
  let previewBoxH = Math.round(200 / previewRatio);
  if (previewBoxH > 115) {
    previewBoxH = 115;
    previewBoxW = Math.round(115 * previewRatio);
  }
  if (previewBoxW > 220) {
    previewBoxW = 220;
    previewBoxH = Math.round(220 / previewRatio);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // --- Carousel mode: initialize carousel store and create a minimal project ---
    if (projectMode === 'carousel') {
      const preset = CAROUSEL_RATIO_PRESETS[carouselRatio];
      const carouselSettings = {
        name: carouselName.trim() || 'Untitled Carousel',
        canvas: {
          width: preset.width,
          height: preset.height,
          unit: 'px' as const,
          dpi: 96,
        },
        spacing: { value: 0, unit: 'px' as const },
        margin: { enabled: false, value: 0, unit: 'px' as const, top: 0, bottom: 0, outside: 0, spine: 0 },
        border: { enabled: false, width: 0, unit: 'px' as const, color: '#FFFFFF' },
        background: { type: 'solid' as const, color: carouselBgColor },
      };
      try {
        setIsSubmitting(true);
        const project = await createNewProject(carouselSettings);
        // Initialize carousel store for this project after creation
        const projectId = (project as { id?: string })?.id ?? `carousel-${Date.now()}`;
        initializeCarousel(projectId, carouselRatio, carouselSlideCount);
      } catch (err) {
        console.error('[AFSN] Error creating carousel project:', err);
        setErrorMessage(`Failed to create project: ${err}`);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // --- Album / Print mode ---
    const settings = {
      name: name.trim() || 'Untitled Album',
      canvas: {
        width: canvasWidth,
        height: canvasHeight,
        unit: canvasUnit,
        dpi: canvasDpi,
      },
      spacing: {
        value: spacingValue,
        unit: spacingUnit,
      },
      margin: {
        enabled: marginEnabled,
        value: marginValue,
        unit: marginUnit,
        top: isMargin4S ? marginTop : marginValue,
        bottom: isMargin4S ? marginBottom : marginValue,
        outside: isMargin4S ? marginOutside : marginValue,
        spine: isMargin4S ? marginSpine : marginValue,
      },
      border: {
        enabled: borderEnabled,
        width: borderWidth,
        unit: borderUnit,
        color: borderColor,
      },
      background: {
        type: 'solid' as const,
        color: backgroundColor,
      },
    };

    const validationErrors = validateProjectSettings(settings);
    if (validationErrors.length > 0) {
      setErrorMessage(validationErrors[0]!.message);
      return;
    }

    try {
      setIsSubmitting(true);
      await createNewProject(settings);
    } catch (err) {
      console.error('[AFSN] Error creating project:', err);
      setErrorMessage(`Failed to create project: ${err}`);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <Dialog
      isOpen={isOpen}
      onClose={closeNewProject}
      title={projectMode === 'carousel' ? 'New Instagram Carousel Project' : 'New Album Project'}
      width={840}
      closeOnOverlayClick={false}
      closeOnEscape={false}
    >
      <form onSubmit={handleSubmit} onContextMenu={(e) => e.preventDefault()}>
        {/* Project Type Mode Selector */}
        <div className={styles.modeSwitcher}>
          <button
            type="button"
            className={`${styles.modeBtn} ${projectMode === 'album' ? styles.modeBtnActive : ''}`}
            onClick={() => setProjectMode('album')}
          >
            <Layers size={14} strokeWidth={1.5} />
            <span>Print Album</span>
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${projectMode === 'carousel' ? styles.modeBtnActive : ''}`}
            onClick={() => setProjectMode('carousel')}
          >
            <Smartphone size={14} strokeWidth={1.5} />
            <span>Instagram Carousel</span>
          </button>
        </div>

        {errorMessage && (
          <div className={styles.errorBanner}>
            <AlertCircle size={16} strokeWidth={1.5} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ——— CAROUSEL MODE FORM ——— */}
        {projectMode === 'carousel' && (
          <div className={styles.dialogContainer}>
            {/* Left Column: Carousel Settings */}
            <div className={styles.leftColumn}>
              {/* Project Name */}
              <div className={styles.nameRow}>
                <span className={styles.nameIcon}>
                  <Smartphone size={14} strokeWidth={1.5} />
                </span>
                <input
                  type="text"
                  className={styles.nameInput}
                  value={carouselName}
                  onChange={(e) => setCarouselName(e.target.value)}
                  placeholder="Carousel Project Name (e.g. Client Shoot June 2026)"
                  autoFocus
                />
              </div>

              {/* Aspect Ratio Picker */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>
                    <Grid2x2 size={14} strokeWidth={1.5} />
                    Slide Aspect Ratio
                  </span>
                  <span className={styles.cardSubtitle}>Instagram feed format</span>
                </div>
                <div className={styles.carouselRatioGrid}>
                  {(Object.entries(CAROUSEL_RATIO_PRESETS) as [CarouselRatio, typeof CAROUSEL_RATIO_PRESETS[CarouselRatio]][]).map(([key, preset]) => (
                    <button
                      key={key}
                      type="button"
                      className={`${styles.carouselRatioTile} ${carouselRatio === key ? styles.carouselRatioTileActive : ''}`}
                      onClick={() => setCarouselRatio(key)}
                    >
                      <div
                        className={styles.carouselRatioIcon}
                        style={{
                          width: key === '1:1' ? 36 : key === '4:5' ? 29 : 20,
                          height: key === '1:1' ? 36 : key === '4:5' ? 36 : 36,
                        }}
                      />
                      <span className={styles.carouselRatioLabel}>{key}</span>
                      <span className={styles.carouselRatioDesc}>{key === '1:1' ? 'Square Feed' : key === '4:5' ? 'Portrait Feed' : 'Story / Reel'}</span>
                      <span className={styles.carouselRatioSize}>{preset.width} × {preset.height}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Slide Count */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>
                    <Columns2 size={14} strokeWidth={1.5} />
                    Number of Slides
                  </span>
                  <span className={styles.cardSubtitle}>1 – 10 slides</span>
                </div>
                <div className={styles.carouselSlideRow}>
                  <button
                    type="button"
                    className={styles.carouselCountBtn}
                    onClick={() => setCarouselSlideCount(Math.max(1, carouselSlideCount - 1))}
                    disabled={carouselSlideCount <= 1}
                    aria-label="Decrease slide count"
                  >−</button>
                  <span className={styles.carouselCountValue}>{carouselSlideCount}</span>
                  <button
                    type="button"
                    className={styles.carouselCountBtn}
                    onClick={() => setCarouselSlideCount(Math.min(10, carouselSlideCount + 1))}
                    disabled={carouselSlideCount >= 10}
                    aria-label="Increase slide count"
                  >+</button>
                  <span className={styles.carouselCountUnit}>slides</span>
                </div>
              </div>

              {/* Background Color */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>
                    <Palette size={14} strokeWidth={1.5} />
                    Slide Background Color
                  </span>
                </div>
                <ColorPicker label="Background Color" value={carouselBgColor} onChange={setCarouselBgColor} />
              </div>

              {/* Auto-Crop Badge */}
              <div className={styles.seamlessSpineBadge}>
                <Check size={13} strokeWidth={1.5} />
                <span>Auto-Crop enabled — photos will be cropped to {carouselRatio} automatically</span>
              </div>
            </div>

            {/* Right Column: Carousel Preview */}
            <div className={styles.rightColumn}>
              <div className={styles.previewHeader}>
                <span className={styles.previewHeading}>
                  <Eye size={13} strokeWidth={1.5} />
                  Slide Preview
                </span>
                <span className={styles.aspectBadge}>{carouselRatio} · {CAROUSEL_RATIO_PRESETS[carouselRatio].width} × {CAROUSEL_RATIO_PRESETS[carouselRatio].height} px</span>
              </div>

              {/* Single Slide Mockup */}
              <div className={styles.mockupStage}>
                {(() => {
                  const preset = CAROUSEL_RATIO_PRESETS[carouselRatio];
                  const ratio = preset.width / preset.height;
                  let w = 160;
                  let h = Math.round(160 / ratio);
                  if (h > 220) { h = 220; w = Math.round(220 * ratio); }
                  return (
                    <div
                      style={{
                        width: `${w}px`,
                        height: `${h}px`,
                        backgroundColor: carouselBgColor,
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                      }}
                    >
                      <Smartphone size={28} strokeWidth={1} style={{ opacity: 0.15 }} />
                      <span style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>
                        Slide 1 of {carouselSlideCount}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Carousel Specs */}
              <div className={styles.specsCard}>
                <div className={styles.specRow}>
                  <span className={styles.specLabel}>Format:</span>
                  <span className={styles.specValue}>Instagram Carousel</span>
                </div>
                <div className={styles.specRow}>
                  <span className={styles.specLabel}>Ratio:</span>
                  <span className={styles.specValue}>{carouselRatio} — {CAROUSEL_RATIO_PRESETS[carouselRatio].label.split('—')[1]?.trim()}</span>
                </div>
                <div className={styles.specDivider} />
                <div className={styles.specRow}>
                  <span className={styles.specLabel}>Slide Canvas:</span>
                  <span className={styles.specValueHighlight}>{CAROUSEL_RATIO_PRESETS[carouselRatio].width} × {CAROUSEL_RATIO_PRESETS[carouselRatio].height} px</span>
                </div>
                <div className={styles.specRow}>
                  <span className={styles.specLabel}>Total Slides:</span>
                  <span className={styles.specValue}>{carouselSlideCount}</span>
                </div>
                <div className={styles.specDivider} />
                <div className={styles.specRow}>
                  <span className={styles.specLabel}>Auto-Crop:</span>
                  <span className={styles.specValue}>Enabled ({carouselRatio})</span>
                </div>
                <div className={styles.specRow}>
                  <span className={styles.specLabel}>Resolution:</span>
                  <span className={styles.specValue}>72 DPI (Screen)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ——— ALBUM / PRINT MODE FORM ——— */}
        {projectMode === 'album' && (
        <div className={styles.dialogContainer}>
          {/* Left Column: Form Configuration */}
          <div className={styles.leftColumn}>

            {/* Compact Project Name Input */}
            <div className={styles.nameRow}>
              <span className={styles.nameIcon}>
                <BookOpen size={14} strokeWidth={1.5} />
              </span>
              <input
                type="text"
                className={styles.nameInput}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Album Project Name (e.g. Wedding Album 2026)"
                autoFocus
              />
            </div>

            {/* Category Navigation Tabs */}
            <div className={styles.tabsNav}>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'page' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('page')}
              >
                <RectangleHorizontal size={14} strokeWidth={1.5} />
                <span>Page & Canvas</span>
              </button>

              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'margins' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('margins')}
              >
                <Scan size={14} strokeWidth={1.5} />
                <span>Margins & Gap</span>
              </button>

              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'appearance' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('appearance')}
              >
                <Palette size={14} strokeWidth={1.5} />
                <span>Appearance</span>
              </button>
            </div>

            {/* TAB 1: Page Dimensions & Canvas Settings */}
            {activeTab === 'page' && (
              <div className={styles.tabContent}>
                {/* Album Preset Selection Card */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                      <Bookmark size={14} strokeWidth={1.5} />
                      Album Presets
                    </span>
                    <span className={styles.cardSubtitle}>Standard & Custom Sizes</span>
                  </div>

                  <div className={styles.presetRow}>
                    <div className={styles.presetSelectWrapper}>
                      <Select
                        label="Preset Template"
                        value={presetId}
                        options={[
                          ...allPresets.map((p) => ({
                            value: p.id,
                            label: formatPresetLabel(p, canvasUnit, canvasDpi),
                          })),
                          { value: CUSTOM_PRESET_ID, label: 'Custom Dimensions' },
                        ]}
                        onChange={handlePresetSelect}
                      />
                    </div>

                    <button
                      type="button"
                      className={styles.presetActionBtn}
                      onClick={() => {
                        setCustomPresetName(`${canvasWidth}×${canvasHeight} ${canvasUnit} Custom`);
                        setIsSavePresetOpen(!isSavePresetOpen);
                      }}
                      title="Save current dimensions as reusable preset"
                    >
                      <Star size={13} strokeWidth={1.5} />
                      <span>Save Preset</span>
                    </button>

                    {Boolean(allPresets.find((p) => p.id === presetId)?.isCustom) && (
                      <button
                        type="button"
                        className={styles.presetDeleteBtn}
                        onClick={() => handleDeleteCustomPreset(presetId)}
                        title="Delete this custom preset"
                      >
                        <Trash2 size={13} strokeWidth={1.5} />
                      </button>
                    )}
                  </div>

                  {isSavePresetOpen && (
                    <div className={styles.savePresetDrawer}>
                      <div className={styles.savePresetTitle}>
                        <Bookmark size={12} strokeWidth={1.5} />
                        Save Configuration as Custom Preset
                      </div>
                      <input
                        type="text"
                        className={styles.savePresetInput}
                        value={customPresetName}
                        onChange={(e) => setCustomPresetName(e.target.value)}
                        placeholder="Preset Name (e.g. 10x10 Wedding Standard)"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveCustomPreset();
                          } else if (e.key === 'Escape') {
                            setIsSavePresetOpen(false);
                          }
                        }}
                      />
                      <div className={styles.savePresetActions}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsSavePresetOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={handleSaveCustomPreset}
                          disabled={!customPresetName.trim()}
                        >
                          Save Preset
                        </Button>
                      </div>
                    </div>
                  )}

                  {presetSaveSuccess && (
                    <div className={styles.seamlessSpineBadge}>
                      ✓ {presetSaveSuccess}
                    </div>
                  )}
                </div>

                {/* Dimensions & Orientation Card */}
                <div className={styles.card}>
                  <div className={styles.orientationHeader}>
                    <span className={styles.cardTitle}>
                      <Maximize2 size={14} strokeWidth={1.5} />
                      Page Geometry & Orientation
                    </span>
                    <button
                      type="button"
                      className={styles.swapBtn}
                      onClick={handleSwapDimensions}
                      title="Swap Width and Height"
                    >
                      <ArrowLeftRight size={12} strokeWidth={1.5} />
                      <span>Swap W ↔ H</span>
                    </button>
                  </div>

                  {/* Visual Orientation Tiles */}
                  <div className={styles.orientationGrid}>
                    <button
                      type="button"
                      className={`${styles.orientTile} ${currentOrientation === 'square' ? styles.orientTileActive : ''}`}
                      onClick={() => handleOrientation('square')}
                    >
                      <div className={styles.orientIconBox}>
                        <Square size={16} strokeWidth={1.5} />
                      </div>
                      <span className={styles.orientLabel}>Square</span>
                    </button>

                    <button
                      type="button"
                      className={`${styles.orientTile} ${currentOrientation === 'portrait' ? styles.orientTileActive : ''}`}
                      onClick={() => handleOrientation('portrait')}
                    >
                      <div className={styles.orientIconBox}>
                        <RectangleVertical size={16} strokeWidth={1.5} />
                      </div>
                      <span className={styles.orientLabel}>Portrait</span>
                    </button>

                    <button
                      type="button"
                      className={`${styles.orientTile} ${currentOrientation === 'landscape' ? styles.orientTileActive : ''}`}
                      onClick={() => handleOrientation('landscape')}
                    >
                      <div className={styles.orientIconBox}>
                        <RectangleHorizontal size={16} strokeWidth={1.5} />
                      </div>
                      <span className={styles.orientLabel}>Landscape</span>
                    </button>
                  </div>

                  {/* Physical Dimensions & Resolution */}
                  <div className={styles.inputRow}>
                    <div className={styles.flex1}>
                      <NumberInput
                        label="Width"
                        value={canvasWidth}
                        onChange={handleWidthChange}
                        min={1}
                        max={2000}
                        step={canvasUnit === 'inch' ? 0.5 : 1}
                      />
                    </div>

                    <div className={styles.flex1}>
                      <NumberInput
                        label="Height"
                        value={canvasHeight}
                        onChange={handleHeightChange}
                        min={1}
                        max={2000}
                        step={canvasUnit === 'inch' ? 0.5 : 1}
                      />
                    </div>

                    <div style={{ width: '85px' }}>
                      <Select
                        label="Unit"
                        value={canvasUnit}
                        options={UNIT_OPTIONS}
                        onChange={handleUnitChange}
                      />
                    </div>

                    <div style={{ width: '100px' }}>
                      <NumberInput
                        label="Resolution"
                        value={canvasDpi}
                        onChange={setCanvasDpi}
                        min={72}
                        max={1200}
                        step={50}
                        suffix="DPI"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Margins & Spacing Settings */}
            {activeTab === 'margins' && (
              <div className={styles.tabContent}>
                {/* Safe Zone Margins Card */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={styles.cardTitle}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="18" height="18" x="3" y="3" rx="2" />
                          <path d="M7 7h10v10H7z" strokeDasharray="2 2" />
                        </svg>
                        Safe Zone Margins
                      </span>
                    </div>

                    {marginEnabled && (
                      <div className={styles.segmentedGroup}>
                        <button
                          type="button"
                          className={`${styles.segmentBtn} ${!isMargin4S ? styles.segmentBtnActive : ''}`}
                          onClick={() => setIsMargin4S(false)}
                          title="Uniform margin on all sides"
                        >
                          Uniform
                        </button>
                        <button
                          type="button"
                          className={`${styles.segmentBtn} ${isMargin4S ? styles.segmentBtnActive : ''}`}
                          onClick={() => setIsMargin4S(true)}
                          title="Independent 4-sided margins"
                        >
                          4-Sided
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '2px 0 4px 0' }}>
                    <Switch
                      checked={marginEnabled}
                      onChange={setMarginEnabled}
                      label="Enable safe margin guide lines"
                      size="sm"
                    />
                  </div>

                  {marginEnabled && !isMargin4S && (
                    <div className={styles.inputRow}>
                      <div className={styles.flex1}>
                        <NumberInput
                          label="Safe Margin (All Sides)"
                          value={marginValue}
                          onChange={setMarginValue}
                          min={0}
                          max={1000}
                          step={canvasUnit === 'inch' ? 0.05 : canvasUnit === 'cm' ? 0.1 : 0.5}
                          precision={canvasUnit === 'inch' || canvasUnit === 'cm' ? 2 : 1}
                        />
                      </div>
                      <div className={styles.unitSelectBox}>
                        <Select
                          label="Unit"
                          value={marginUnit}
                          options={UNIT_OPTIONS}
                          onChange={handleUnitChange}
                        />
                      </div>
                    </div>
                  )}

                  {marginEnabled && isMargin4S && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div className={styles.margin4sGrid}>
                        <div>
                          <NumberInput
                            label="Top (⤒)"
                            value={marginTop}
                            onChange={setMarginTop}
                            min={0}
                            max={1000}
                            step={canvasUnit === 'inch' ? 0.05 : canvasUnit === 'cm' ? 0.1 : 0.5}
                            precision={canvasUnit === 'inch' || canvasUnit === 'cm' ? 2 : 1}
                          />
                        </div>
                        <div>
                          <NumberInput
                            label="Bottom (⤓)"
                            value={marginBottom}
                            onChange={setMarginBottom}
                            min={0}
                            max={1000}
                            step={canvasUnit === 'inch' ? 0.05 : canvasUnit === 'cm' ? 0.1 : 0.5}
                            precision={canvasUnit === 'inch' || canvasUnit === 'cm' ? 2 : 1}
                          />
                        </div>
                        <div title="Outer trim margin protected from paper cutting">
                          <NumberInput
                            label="Outside Trim (⇤)"
                            value={marginOutside}
                            onChange={setMarginOutside}
                            min={0}
                            max={1000}
                            step={canvasUnit === 'inch' ? 0.05 : canvasUnit === 'cm' ? 0.1 : 0.5}
                            precision={canvasUnit === 'inch' || canvasUnit === 'cm' ? 2 : 1}
                          />
                        </div>
                        <div title="Spine crease margin. Set to 0 for seamless continuous layout across pages 1 and 2">
                          <NumberInput
                            label="Spine Fold (⇥)"
                            value={marginSpine}
                            onChange={setMarginSpine}
                            min={0}
                            max={1000}
                            step={canvasUnit === 'inch' ? 0.05 : canvasUnit === 'cm' ? 0.1 : 0.5}
                            precision={canvasUnit === 'inch' || canvasUnit === 'cm' ? 2 : 1}
                          />
                        </div>
                      </div>

                      {marginSpine === 0 && (
                        <div className={styles.seamlessSpineBadge}>
                          <Check size={14} strokeWidth={1.5} />
                          <span>Continuous Seamless Spread: 0 Spine Margin</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Photo Spacing Card */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                      <Columns2 size={14} strokeWidth={1.5} />
                      Photo Spacing & Gap
                    </span>
                    <span className={styles.cardSubtitle}>Inter-frame distance</span>
                  </div>

                  <div className={styles.inputRow}>
                    <div className={styles.flex1}>
                      <NumberInput
                        label="Default Frame Spacing"
                        value={spacingValue}
                        onChange={(val) => setSpacingValue(Math.max(0, Math.min(val, getMaxGapForUnit(spacingUnit))))}
                        min={0}
                        max={getMaxGapForUnit(spacingUnit)}
                        step={spacingUnit === 'inch' ? 0.025 : spacingUnit === 'cm' ? 0.05 : 0.5}
                        precision={spacingUnit === 'inch' || spacingUnit === 'cm' ? 2 : 1}
                      />
                    </div>
                    <div className={styles.unitSelectBox}>
                      <Select
                        label="Unit"
                        value={spacingUnit}
                        options={UNIT_OPTIONS}
                        onChange={() => {}}
                        disabled
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Appearance & Styling Settings */}
            {activeTab === 'appearance' && (
              <div className={styles.tabContent}>
                {/* Spread Background Card */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                      <Palette size={14} strokeWidth={1.5} />
                      Spread Background Color
                    </span>
                    <span className={styles.cardSubtitle}>Canvas solid fill</span>
                  </div>

                  <ColorPicker
                    label="Background Color"
                    value={backgroundColor}
                    onChange={setBackgroundColor}
                  />
                </div>

                {/* Photo Border Card */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                      <Square size={14} strokeWidth={1.5} />
                      Photo Frame Border
                    </span>
                  </div>

                  <div style={{ padding: '2px 0 4px 0' }}>
                    <Switch
                      checked={borderEnabled}
                      onChange={setBorderEnabled}
                      label="Add border stroke to photo frames"
                      size="sm"
                    />
                  </div>

                  {borderEnabled && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
                      <div className={styles.inputRow}>
                        <div className={styles.flex1}>
                          <NumberInput
                            label="Border Stroke Width"
                            value={borderWidth}
                            onChange={setBorderWidth}
                            min={0.01}
                            max={500}
                            step={canvasUnit === 'inch' ? 0.01 : canvasUnit === 'cm' ? 0.02 : canvasUnit === 'px' ? 1 : 0.2}
                          />
                        </div>
                        <div className={styles.unitSelectBox}>
                          <Select
                            label="Unit"
                            value={borderUnit}
                            options={UNIT_OPTIONS}
                            onChange={handleUnitChange}
                          />
                        </div>
                      </div>

                      <ColorPicker
                        label="Border Stroke Color"
                        value={borderColor}
                        onChange={setBorderColor}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Studio Live Spread Preview & Print Specs */}
          <div className={styles.rightColumn}>
            <div className={styles.previewHeader}>
              <span className={styles.previewHeading}>
                <Eye size={13} strokeWidth={1.5} />
                Live Spread Preview
              </span>
              <span className={styles.aspectBadge}>
                {currentOrientation.toUpperCase()} · {(canvasWidth / canvasHeight).toFixed(2)}:1
              </span>
            </div>

            {/* Realistic 3D Mockup Stage */}
            <div className={styles.mockupStage}>
              <div
                className={styles.albumSpread}
                style={{
                  width: `${previewBoxW}px`,
                  height: `${previewBoxH}px`,
                  backgroundColor: backgroundColor,
                }}
              >
                {/* Left Album Page */}
                <div className={styles.albumPageLeft}>
                  {marginEnabled && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '8px',
                        bottom: '8px',
                        left: '12px',
                        right: isMargin4S && marginSpine === 0 ? '0px' : '8px',
                        border: '1px dashed rgba(228, 228, 231, 0.55)',
                        borderRight: isMargin4S && marginSpine === 0 ? 'none' : '1px dashed rgba(228, 228, 231, 0.55)',
                        pointerEvents: 'none',
                      }}
                      title="Safe Margin Guide"
                    />
                  )}
                  <div
                    className={styles.photoPlaceholder}
                    style={{
                      borderWidth: borderEnabled ? '1.5px' : '0',
                      borderColor: borderColor,
                    }}
                  />
                  <span className={styles.pageNumberBadge}>1</span>
                </div>

                {/* 3D Center Spine Crease */}
                <div className={styles.albumSpine} />

                {/* Right Album Page */}
                <div className={styles.albumPageRight}>
                  {marginEnabled && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '8px',
                        bottom: '8px',
                        left: isMargin4S && marginSpine === 0 ? '0px' : '8px',
                        right: '12px',
                        border: '1px dashed rgba(228, 228, 231, 0.55)',
                        borderLeft: isMargin4S && marginSpine === 0 ? 'none' : '1px dashed rgba(228, 228, 231, 0.55)',
                        pointerEvents: 'none',
                      }}
                      title="Safe Margin Guide"
                    />
                  )}
                  <div
                    className={styles.photoPlaceholder}
                    style={{
                      borderWidth: borderEnabled ? '1.5px' : '0',
                      borderColor: borderColor,
                    }}
                  />
                  <span className={styles.pageNumberBadge}>2</span>
                </div>
              </div>
            </div>

            {/* Studio Print Specifications */}
            <div className={styles.specsCard}>
              <div className={styles.specRow}>
                <span className={styles.specLabel}>Single Page:</span>
                <span className={styles.specValue}>
                  {formatDimensions(canvasWidth, canvasHeight, canvasUnit)}
                </span>
              </div>
              <div className={styles.specRow}>
                <span className={styles.specLabel}>Open Spread:</span>
                <span className={styles.specValue}>
                  {formatDimensions(spreadWidth, spreadHeight, canvasUnit)}
                </span>
              </div>
              <div className={styles.specDivider} />
              <div className={styles.specRow}>
                <span className={styles.specLabel}>Print Canvas:</span>
                <span className={styles.specValueHighlight}>
                  {spreadPxW} × {spreadPxH} px
                </span>
              </div>
              <div className={styles.specRow}>
                <span className={styles.specLabel}>Resolution:</span>
                <span className={styles.specValue}>{canvasDpi} DPI ({megapixels} MP)</span>
              </div>
              <div className={styles.specDivider} />
              <div className={styles.specRow}>
                <span className={styles.specLabel}>Safe Margins:</span>
                <span className={styles.specValue}>
                  {marginEnabled
                    ? isMargin4S
                      ? `T:${marginTop} B:${marginBottom} O:${marginOutside} S:${marginSpine} ${marginUnit}`
                      : `${marginValue} ${marginUnit}`
                    : 'None'}
                </span>
              </div>
              <div className={styles.specRow}>
                <span className={styles.specLabel}>Photo Gap:</span>
                <span className={styles.specValue}>{spacingValue} {spacingUnit}</span>
              </div>
              <div className={styles.specRow}>
                <span className={styles.specLabel}>Photo Border:</span>
                <span className={styles.specValue}>
                  {borderEnabled ? `${borderWidth} ${borderUnit}` : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        </div>
        )} {/* end album conditional */}

        {/* Dialog Footer Actions */}
        <div className={styles.dialogFooter}>
          <Button
            type="button"
            variant="ghost"
            onClick={closeNewProject}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Creating Project...'
              : projectMode === 'carousel'
              ? 'Create Carousel Project'
              : 'Create Album Project'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
