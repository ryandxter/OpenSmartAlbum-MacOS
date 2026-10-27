import { useState } from 'react';
import { Palette, RotateCcw, FlipHorizontal, FlipVertical, Image as ImageIcon, Trash2, Upload, Sparkles } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useEditorStore } from '../../../stores/editorStore';
import { useAlbumStore } from '../../../stores/albumStore';
import { useCarouselStore } from '../../../stores/carouselStore';
import { useProjectStore } from '../../../stores/projectStore';
import { usePhotoStore } from '../../../stores/photoStore';
import { ColorPicker } from '../../../components/ui/ColorPicker';
import { Switch } from '../../../components/ui/Switch';
import { NumberInput } from '../../../components/ui/NumberInput';
import { OpacityControl } from '../../editor/OpacityControl';
import { getAllAlbumSpreads, SpreadBackgroundImage } from '../../../domain/album';
import { Photo } from '../../../domain/photo';
import {
  effectSliderToPhysical,
  physicalToEffectSlider,
  type CanvasUnit,
} from '../../../domain/editor';
import styles from '../InspectorShared.module.css';

interface EffectsShadowsSectionProps {
  onToast?: (msg: string) => void;
  activeMode?: 'print' | 'carousel';
}

function getCommonValue<T>(
  elements: any[],
  getter: (el: any) => T,
  defaultValue: T
): { value: T; isMixed: boolean } {
  if (elements.length === 0) return { value: defaultValue, isMixed: false };
  const first = getter(elements[0]);
  const isMixed = elements.some((el) => getter(el) !== first);
  return { value: isMixed ? defaultValue : first, isMixed };
}

export function EffectsShadowsSection({
  onToast,
  activeMode = 'print',
}: EffectsShadowsSectionProps) {
  const isCarousel = activeMode === 'carousel';

  // Album / Print state
  const currentAlbum = useAlbumStore((s) => s.currentAlbum);
  const activeSpreadId = useAlbumStore((s) => s.activeSpreadId);
  const updateSpreadBackgroundColor = useAlbumStore((s) => s.updateSpreadBackgroundColor);
  const applyBackgroundColorToAllSpreads = useAlbumStore((s) => s.applyBackgroundColorToAllSpreads);
  const setSpreadBackgroundImage = useAlbumStore((s) => s.setSpreadBackgroundImage);
  const updateSpreadBackgroundImage = useAlbumStore((s) => s.updateSpreadBackgroundImage);
  const clearSpreadBackgroundImage = useAlbumStore((s) => s.clearSpreadBackgroundImage);
  const setSpreadBackgroundColorNoise = useAlbumStore((s) => s.setSpreadBackgroundColorNoise);
  const applyBackgroundNoiseToAllSpreads = useAlbumStore((s) => s.applyBackgroundNoiseToAllSpreads);
  const updateSpreadBorder = useAlbumStore((s) => s.updateSpreadBorder);
  const applyBorderToAllSpreads = useAlbumStore((s) => s.applyBorderToAllSpreads);
  const flipAlbumElements = useAlbumStore((s) => s.flipElements);
  const updateAlbumVisualEffects = useAlbumStore((s) => s.updateElementVisualEffects);
  const selectedFrameIds = useEditorStore((s) => s.selectedFrameIds);

  // Carousel state
  const currentCarousel = useCarouselStore((s) => s.currentCarousel);
  const activeSlideIndex = useCarouselStore((s) => s.activeSlideIndex);
  const selectedCarouselFrameId = useCarouselStore((s) => s.selectedFrameId);
  const selectedCarouselFrameIds = useCarouselStore((s) => s.selectedFrameIds);
  const updateSlideBackground = useCarouselStore((s) => s.updateSlideBackground);
  const setCarouselBackgroundImage = useCarouselStore((s) => s.setSpreadBackgroundImage);
  const updateCarouselBackgroundImage = useCarouselStore((s) => s.updateSpreadBackgroundImage);
  const clearCarouselBackgroundImage = useCarouselStore((s) => s.clearSpreadBackgroundImage);
  const setCarouselBackgroundNoise = useCarouselStore((s) => s.setSpreadBackgroundColorNoise);
  const applyCarouselBackgroundNoise = useCarouselStore((s) => s.applyBackgroundNoiseToAllSpreads);
  const updateCarouselBorder = useCarouselStore((s) => s.updateSpreadBorder);
  const applyCarouselBorder = useCarouselStore((s) => s.applyBorderToAllSpreads);
  const flipCarouselElements = useCarouselStore((s) => s.flipElements);
  const updateCarouselVisualEffects = useCarouselStore((s) => s.updateElementVisualEffects);

  // Photo store
  const photos = usePhotoStore((s) => s.photos);

  // Project state
  const currentProject = useProjectStore((s) => s.currentProject);
  const canvasUnit: CanvasUnit = isCarousel ? 'px' : (currentProject?.canvasUnit || 'mm');

  const [bgMode, setBgMode] = useState<'color' | 'image'>('color');
  const [bgScope, setBgScope] = useState<'spread' | 'left' | 'right'>('spread');
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const allSpreads = currentAlbum ? getAllAlbumSpreads(currentAlbum) : [];
  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];

  const selectedElements = isCarousel
    ? (() => {
        const slide = currentCarousel?.slides[activeSlideIndex];
        const ids =
          selectedCarouselFrameIds.length > 0
            ? selectedCarouselFrameIds
            : selectedCarouselFrameId
            ? [selectedCarouselFrameId]
            : [];
        return (slide?.elements || []).filter((el) => ids.includes(el.id));
      })()
    : (activeSpread?.elements || []).filter((el) => selectedFrameIds.includes(el.id));

  const hasPhoto = selectedElements.some((el) => el.type === 'photo');
  const hasDecorativeFrame = selectedElements.some((el) => Boolean((el as any).frameAssetId));

  const updateEffects = (effects: Record<string, any>) => {
    const ids = selectedElements.map((el) => el.id);
    if (ids.length === 0) return;

    if (isCarousel) {
      updateCarouselVisualEffects(ids, effects);
    } else if (activeSpread) {
      updateAlbumVisualEffects(activeSpread.id, ids, effects);
    }
  };

  const handleFlip = (axis: 'horizontal' | 'vertical') => {
    const ids = selectedElements.map((el) => el.id);
    if (ids.length === 0) return;

    if (isCarousel) {
      flipCarouselElements(ids, axis);
    } else if (activeSpread) {
      flipAlbumElements(activeSpread.id, ids, axis);
    }
    onToast?.(`Flipped ${axis}`);
  };

  // 1. ELEMENTS SELECTED: Full Visual Effects, Flip H/V, and Drop Shadow
  if (selectedElements.length > 0) {
    const { value: flipH, isMixed: flipHMixed } = getCommonValue(
      selectedElements,
      (el) => Boolean(el.flipHorizontal),
      false
    );
    const { value: flipV, isMixed: flipVMixed } = getCommonValue(
      selectedElements,
      (el) => Boolean(el.flipVertical),
      false
    );

    // Raster Filter values (Photo frames only)
    const { value: rawGrayscale, isMixed: grayscaleMixed } = getCommonValue(
      selectedElements,
      (el) => Number(el.grayscaleAmount ?? 0),
      0
    );
    const { value: rawNoise, isMixed: noiseMixed } = getCommonValue(
      selectedElements,
      (el) => Number(el.noiseAmount ?? 0),
      0
    );
    const { value: rawBlur, isMixed: blurMixed } = getCommonValue(
      selectedElements,
      (el) => Number(el.blurRadius ?? 0),
      0
    );

    const sliderBlur = physicalToEffectSlider(rawBlur, 'blurRadius', canvasUnit, isCarousel);

    const hasAnyActiveEffects =
      rawGrayscale > 0 || rawNoise > 0 || rawBlur > 0 || grayscaleMixed || noiseMixed || blurMixed;

    // Drop Shadow values
    const { value: shadowEnabled, isMixed: shadowEnabledMixed } = getCommonValue(
      selectedElements,
      (el) => Boolean(el.shadowEnabled),
      false
    );
    const { value: shadowColor, isMixed: shadowColorMixed } = getCommonValue(
      selectedElements,
      (el) => String(el.shadowColor || '#000000'),
      '#000000'
    );
    const { value: rawShadowBlur, isMixed: shadowBlurMixed } = getCommonValue(
      selectedElements,
      (el) => Number(el.shadowBlur ?? (isCarousel ? 8 : 2)),
      isCarousel ? 8 : 2
    );
    const sliderShadowBlur = physicalToEffectSlider(rawShadowBlur, 'shadowBlur', canvasUnit, isCarousel);

    const { value: rawShadowOffsetX, isMixed: shadowOffsetXMixed } = getCommonValue(
      selectedElements,
      (el) => Number(el.shadowOffsetX ?? 0),
      0
    );
    const sliderShadowOffsetX = physicalToEffectSlider(rawShadowOffsetX, 'shadowOffset', canvasUnit, isCarousel);

    const { value: rawShadowOffsetY, isMixed: shadowOffsetYMixed } = getCommonValue(
      selectedElements,
      (el) => Number(el.shadowOffsetY ?? (isCarousel ? 4 : 1)),
      isCarousel ? 4 : 1
    );
    const sliderShadowOffsetY = physicalToEffectSlider(rawShadowOffsetY, 'shadowOffset', canvasUnit, isCarousel);

    const { value: shadowOpacityDecimal, isMixed: shadowOpacityMixed } = getCommonValue(
      selectedElements,
      (el) => Number(el.shadowOpacity ?? 0.35),
      0.35
    );
    const shadowOpacityPercent = Math.round(shadowOpacityDecimal * 100);

    return (
      <div>
        {/* Opacity Control */}
        <div className={styles.propGroup}>
          <div className={styles.groupHeader}>
            <span className={styles.label}>Object Opacity</span>
          </div>
          {!isCarousel && activeSpread ? (
            <OpacityControl spreadId={activeSpread.id} elements={selectedElements as any} />
          ) : (
            <div className={styles.sliderContainer}>
              <input
                type="range"
                className={styles.slider}
                min={0}
                max={100}
                value={Math.round((selectedElements[0]?.opacity ?? 1) * 100)}
                onChange={(e) => updateEffects({ opacity: Number(e.target.value) / 100 })}
              />
              <span className={styles.sliderBadge}>
                {Math.round((selectedElements[0]?.opacity ?? 1) * 100)}%
              </span>
            </div>
          )}
        </div>

        <div className={styles.divider} />

        {/* Mirror / Flip Controls (FX-02, D-03) */}
        <div className={styles.propGroup}>
          <div className={styles.groupHeader}>
            <span className={styles.label}>Mirror / Flip</span>
            {(flipHMixed || flipVMixed) && (
              <span className={styles.subLabel} style={{ fontStyle: 'italic', color: '#fbbf24' }}>
                Mixed
              </span>
            )}
          </div>
          <div className={styles.propGrid2}>
            <button
              type="button"
              className={`${styles.actionBtn} ${flipH && !flipHMixed ? styles.iconBtnActive : ''}`}
              onClick={() => handleFlip('horizontal')}
              title="Flip Horizontally (↔) with corner radius permutation"
              aria-pressed={flipH && !flipHMixed}
            >
              <FlipHorizontal size={13} strokeWidth={1.5} />
              <span>Horizontal</span>
            </button>
            <button
              type="button"
              className={`${styles.actionBtn} ${flipV && !flipVMixed ? styles.iconBtnActive : ''}`}
              onClick={() => handleFlip('vertical')}
              title="Flip Vertically (↕) with corner radius permutation"
              aria-pressed={flipV && !flipVMixed}
            >
              <FlipVertical size={13} strokeWidth={1.5} />
              <span>Vertical</span>
            </button>
          </div>
        </div>

        {/* Photo Raster Filter Effects (Grayscale -> Noise -> Blur, FX-01, D-01) */}
        {hasPhoto && (
          <>
            <div className={styles.divider} />

            <div className={styles.propGroup}>
              <div className={styles.groupHeader}>
                <span className={styles.label}>Photo Effects</span>
                <button
                  type="button"
                  className={styles.iconBtn}
                  disabled={!hasAnyActiveEffects}
                  onClick={() => {
                    updateEffects({
                      grayscaleAmount: 0,
                      noiseAmount: 0,
                      blurRadius: 0,
                    });
                    onToast?.('Reset photo visual effects');
                  }}
                  title="Reset Visual Effects"
                  style={{ width: '22px', height: '22px' }}
                >
                  <RotateCcw size={12} strokeWidth={1.5} />
                </button>
              </div>

              {/* 1. Grayscale */}
              <div style={{ marginBottom: '8px' }}>
                <div className={styles.groupHeader}>
                  <span className={styles.subLabel}>Grayscale</span>
                  <span className={styles.sliderBadge}>
                    {grayscaleMixed ? 'Mixed' : `${rawGrayscale}%`}
                  </span>
                </div>
                <div className={styles.sliderContainer}>
                  <input
                    type="range"
                    className={styles.slider}
                    min={0}
                    max={100}
                    value={rawGrayscale}
                    onChange={(e) => updateEffects({ grayscaleAmount: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* 2. Film Grain / Noise */}
              <div style={{ marginBottom: '8px' }}>
                <div className={styles.groupHeader}>
                  <span className={styles.subLabel}>Film Grain / Noise</span>
                  <span className={styles.sliderBadge}>
                    {noiseMixed ? 'Mixed' : `${rawNoise}%`}
                  </span>
                </div>
                <div className={styles.sliderContainer}>
                  <input
                    type="range"
                    className={styles.slider}
                    min={0}
                    max={100}
                    value={rawNoise}
                    onChange={(e) => updateEffects({ noiseAmount: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* 3. Blur */}
              <div>
                <div className={styles.groupHeader}>
                  <span className={styles.subLabel}>Gaussian Blur</span>
                  <span className={styles.sliderBadge}>
                    {blurMixed ? 'Mixed' : `${sliderBlur}`}
                  </span>
                </div>
                <div className={styles.sliderContainer}>
                  <input
                    type="range"
                    className={styles.slider}
                    min={0}
                    max={100}
                    value={sliderBlur}
                    onChange={(e) => {
                      const sliderVal = Number(e.target.value);
                      const physicalVal = effectSliderToPhysical(
                        sliderVal,
                        'blurRadius',
                        canvasUnit,
                        isCarousel
                      );
                      updateEffects({ blurRadius: physicalVal });
                    }}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <div className={styles.divider} />

        {/* Drop Shadow Group (FX-01, D-02) */}
        <div className={styles.propGroup}>
          <div className={styles.groupHeader}>
            <span className={styles.label}>Drop Shadow</span>
            {shadowEnabledMixed ? (
              <span className={styles.subLabel} style={{ fontStyle: 'italic', color: '#fbbf24' }}>
                Mixed
              </span>
            ) : (
              <Switch
                checked={shadowEnabled}
                onChange={(checked) => updateEffects({ shadowEnabled: checked })}
              />
            )}
          </div>

          {hasDecorativeFrame && (
            <div className={styles.emptyHint} style={{ textAlign: 'left', padding: '4px 0' }}>
              Standard border and drop shadow are disabled while a decorative frame overlay is attached.
            </div>
          )}

          {shadowEnabled && !hasDecorativeFrame && (
            <>
              {/* Shadow Color */}
              <div className={styles.propRow}>
                <span className={styles.subLabel}>
                  Shadow Color {shadowColorMixed ? '(Mixed)' : ''}
                </span>
                <ColorPicker
                  value={shadowColor}
                  onChange={(c) => updateEffects({ shadowColor: c })}
                />
              </div>

              {/* Shadow Opacity */}
              <div style={{ marginBottom: '8px' }}>
                <div className={styles.groupHeader}>
                  <span className={styles.subLabel}>Shadow Opacity</span>
                  <span className={styles.sliderBadge}>
                    {shadowOpacityMixed ? 'Mixed' : `${shadowOpacityPercent}%`}
                  </span>
                </div>
                <div className={styles.sliderContainer}>
                  <input
                    type="range"
                    className={styles.slider}
                    min={0}
                    max={100}
                    value={shadowOpacityPercent}
                    onChange={(e) =>
                      updateEffects({ shadowOpacity: Number(e.target.value) / 100 })
                    }
                  />
                </div>
              </div>

              {/* Shadow Blur (0-100 mapped to physical units) */}
              <div style={{ marginBottom: '8px' }}>
                <div className={styles.groupHeader}>
                  <span className={styles.subLabel}>Shadow Blur</span>
                  <span className={styles.sliderBadge}>
                    {shadowBlurMixed ? 'Mixed' : `${sliderShadowBlur}`}
                  </span>
                </div>
                <div className={styles.sliderContainer}>
                  <input
                    type="range"
                    className={styles.slider}
                    min={0}
                    max={100}
                    value={sliderShadowBlur}
                    onChange={(e) => {
                      const sliderVal = Number(e.target.value);
                      const physicalVal = effectSliderToPhysical(
                        sliderVal,
                        'shadowBlur',
                        canvasUnit,
                        isCarousel
                      );
                      updateEffects({ shadowBlur: physicalVal });
                    }}
                  />
                </div>
              </div>

              {/* Shadow Offset X & Y */}
              <div className={styles.propGrid2}>
                <NumberInput
                  label={shadowOffsetXMixed ? 'Offset X (Mixed)' : 'Offset X'}
                  value={sliderShadowOffsetX}
                  min={-100}
                  max={100}
                  onChange={(ox) => {
                    const physicalVal = effectSliderToPhysical(
                      ox,
                      'shadowOffset',
                      canvasUnit,
                      isCarousel
                    );
                    updateEffects({ shadowOffsetX: physicalVal });
                  }}
                />
                <NumberInput
                  label={shadowOffsetYMixed ? 'Offset Y (Mixed)' : 'Offset Y'}
                  value={sliderShadowOffsetY}
                  min={-100}
                  max={100}
                  onChange={(oy) => {
                    const physicalVal = effectSliderToPhysical(
                      oy,
                      'shadowOffset',
                      canvasUnit,
                      isCarousel
                    );
                    updateEffects({ shadowOffsetY: physicalVal });
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // 2. NO ELEMENTS SELECTED: Spread/Slide Background Color, Background Image, Noise & Borders
  const targetSlide = isCarousel ? currentCarousel?.slides[activeSlideIndex] : null;

  const activeSpreadBg = isCarousel
    ? (targetSlide?.backgroundColor || '#FFFFFF')
    : (activeSpread?.backgroundColor || '#FFFFFF');

  const currentScopeColor = isCarousel
    ? activeSpreadBg
    : bgScope === 'left'
    ? activeSpread?.leftPage?.backgroundColor || activeSpreadBg
    : bgScope === 'right'
    ? activeSpread?.rightPage?.backgroundColor || activeSpreadBg
    : activeSpreadBg;

  const currentBgImage = isCarousel
    ? targetSlide?.backgroundImage
    : activeSpread?.backgroundImage;

  const currentBgNoise = isCarousel
    ? (targetSlide?.backgroundColorNoise ?? 0)
    : bgScope === 'left'
    ? (activeSpread?.leftPageBackgroundColorNoise ?? activeSpread?.backgroundColorNoise ?? 0)
    : bgScope === 'right'
    ? (activeSpread?.rightPageBackgroundColorNoise ?? activeSpread?.backgroundColorNoise ?? 0)
    : (activeSpread?.backgroundColorNoise ?? 0);

  const currentBorderEnabled = isCarousel
    ? Boolean(targetSlide?.borderEnabled)
    : Boolean(activeSpread?.borderEnabled || activeSpread?.leftPageBorderEnabled || activeSpread?.rightPageBorderEnabled);

  const currentBorderTarget = isCarousel
    ? 'full'
    : activeSpread?.leftPageBorderEnabled
    ? 'left'
    : activeSpread?.rightPageBorderEnabled
    ? 'right'
    : 'both';

  const currentBorderWidth = isCarousel
    ? (targetSlide?.borderWidth ?? 4)
    : (activeSpread?.borderWidth ?? 1);

  const currentBorderColor = isCarousel
    ? (targetSlide?.borderColor || '#FFFFFF')
    : (activeSpread?.borderColor || '#000000');

  const handleDropPhoto = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const rawData =
      e.dataTransfer.getData('application/x-osa-photo-ids') ||
      e.dataTransfer.getData('application/json');
    if (!rawData) return;
    try {
      const parsed = JSON.parse(rawData);
      const photoId = Array.isArray(parsed) ? parsed[0] : parsed;
      const photo = photos.find((p) => p.id === photoId);
      if (photo) {
        if (isCarousel) {
          setCarouselBackgroundImage(activeSlideIndex, {
            photoId: photo.id,
            filePath: photo.filePath,
            fileName: photo.fileName,
            previewPath: photo.previewPath,
            thumbnailPath: photo.thumbnailPath,
            width: photo.width,
            height: photo.height,
          });
        } else if (activeSpread) {
          setSpreadBackgroundImage(
            activeSpread.id,
            {
              photoId: photo.id,
              filePath: photo.filePath,
              fileName: photo.fileName,
              previewPath: photo.previewPath,
              thumbnailPath: photo.thumbnailPath,
              width: photo.width,
              height: photo.height,
            },
            bgScope
          );
        }
        onToast?.(`Assigned ${photo.fileName} as background image`);
      }
    } catch (err) {
      console.warn('Failed to parse dropped photo for background:', err);
    }
  };

  const handleSelectPhoto = (photo: Photo) => {
    if (isCarousel) {
      setCarouselBackgroundImage(activeSlideIndex, {
        photoId: photo.id,
        filePath: photo.filePath,
        fileName: photo.fileName,
        previewPath: photo.previewPath,
        thumbnailPath: photo.thumbnailPath,
        width: photo.width,
        height: photo.height,
      });
    } else if (activeSpread) {
      setSpreadBackgroundImage(
        activeSpread.id,
        {
          photoId: photo.id,
          filePath: photo.filePath,
          fileName: photo.fileName,
          previewPath: photo.previewPath,
          thumbnailPath: photo.thumbnailPath,
          width: photo.width,
          height: photo.height,
        },
        bgScope
      );
    }
    setIsPhotoPickerOpen(false);
    onToast?.(`Assigned ${photo.fileName} as background image`);
  };

  const handleUpdateBgImagePatch = (patch: Partial<SpreadBackgroundImage>) => {
    if (isCarousel) {
      updateCarouselBackgroundImage(activeSlideIndex, patch);
    } else if (activeSpread) {
      updateSpreadBackgroundImage(activeSpread.id, patch);
    }
  };

  const handleClearBgImage = () => {
    if (isCarousel) {
      clearCarouselBackgroundImage(activeSlideIndex);
    } else if (activeSpread) {
      clearSpreadBackgroundImage(activeSpread.id);
    }
    onToast?.('Removed background image');
  };

  const handleUpdateNoise = (noise: number) => {
    if (isCarousel) {
      setCarouselBackgroundNoise(activeSlideIndex, noise);
    } else if (activeSpread) {
      setSpreadBackgroundColorNoise(activeSpread.id, noise, bgScope);
    }
  };

  const handleApplyNoiseToAll = (noise: number) => {
    if (isCarousel) {
      applyCarouselBackgroundNoise(noise);
    } else {
      applyBackgroundNoiseToAllSpreads(noise);
    }
    onToast?.(`✓ Applied background noise (${noise}%) to all ${isCarousel ? 'slides' : 'spreads'}`);
  };

  const handleUpdateBorder = (borderPatch: { borderEnabled?: boolean; borderWidth?: number; borderColor?: string }, target = currentBorderTarget) => {
    if (isCarousel) {
      updateCarouselBorder(activeSlideIndex, borderPatch);
    } else if (activeSpread) {
      updateSpreadBorder(activeSpread.id, borderPatch, target as any);
    }
  };

  const handleApplyBorderToAll = (borderPatch: { borderEnabled?: boolean; borderWidth?: number; borderColor?: string }, target = currentBorderTarget) => {
    if (isCarousel) {
      applyCarouselBorder(borderPatch);
    } else {
      applyBorderToAllSpreads(borderPatch, target as any);
    }
    onToast?.(`✓ Applied inner border to all ${isCarousel ? 'slides' : 'spreads'}`);
  };

  return (
    <div>
      <div className={styles.propGroup}>
        <div className={styles.groupHeader}>
          <span className={styles.label}>{isCarousel ? 'Slide Background' : 'Spread Background'}</span>
        </div>

        {/* Mode Switcher: Color vs Image */}
        <div className={styles.propGrid2} style={{ marginBottom: '10px' }}>
          <button
            type="button"
            className={`${styles.actionBtn} ${bgMode === 'color' ? styles.iconBtnActive : ''}`}
            onClick={() => setBgMode('color')}
          >
            <Palette size={13} strokeWidth={1.5} />
            <span>Color</span>
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${bgMode === 'image' ? styles.iconBtnActive : ''}`}
            onClick={() => setBgMode('image')}
          >
            <ImageIcon size={13} strokeWidth={1.5} />
            <span>Image</span>
          </button>
        </div>

        {/* Scope Segmented Control (Print Spread only) */}
        {!isCarousel && (
          <div className={styles.propGrid3} style={{ marginBottom: '10px' }}>
            <button
              type="button"
              className={`${styles.actionBtn} ${bgScope === 'spread' ? styles.iconBtnActive : ''}`}
              onClick={() => setBgScope('spread')}
              title="Apply to Entire Spread"
            >
              <span>Spread</span>
            </button>
            <button
              type="button"
              className={`${styles.actionBtn} ${bgScope === 'left' ? styles.iconBtnActive : ''}`}
              onClick={() => setBgScope('left')}
              title="Apply to Left Page Only"
            >
              <span>Left</span>
            </button>
            <button
              type="button"
              className={`${styles.actionBtn} ${bgScope === 'right' ? styles.iconBtnActive : ''}`}
              onClick={() => setBgScope('right')}
              title="Apply to Right Page Only"
            >
              <span>Right</span>
            </button>
          </div>
        )}

        {/* MODE A: COLOR */}
        {bgMode === 'color' && (
          <>
            <div style={{ marginBottom: '10px' }}>
              <ColorPicker
                value={currentScopeColor}
                onChange={(newColor) => {
                  if (isCarousel) {
                    updateSlideBackground(activeSlideIndex, newColor);
                  } else if (activeSpread) {
                    updateSpreadBackgroundColor(activeSpread.id, newColor, bgScope);
                  }
                }}
                presetColors={[
                  '#FFFFFF', '#F8FAFC', '#FDFBF7', '#E2E8F0', '#CBD5E1', '#94A3B8',
                  '#64748B', '#475569', '#334155', '#1E293B', '#0F172A', '#000000',
                ]}
              />
            </div>

            {/* Background Color Noise (0-100%) */}
            <div style={{ marginBottom: '10px' }}>
              <div className={styles.groupHeader}>
                <span className={styles.subLabel}>Paper / Color Grain</span>
                <span className={styles.sliderBadge}>{currentBgNoise}%</span>
              </div>
              <div className={styles.sliderContainer}>
                <input
                  type="range"
                  className={styles.slider}
                  min={0}
                  max={100}
                  value={currentBgNoise}
                  onChange={(e) => handleUpdateNoise(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Propagation Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => {
                  if (isCarousel) {
                    currentCarousel?.slides.forEach((_, idx) => updateSlideBackground(idx, currentScopeColor));
                  } else {
                    applyBackgroundColorToAllSpreads(currentScopeColor);
                  }
                  onToast?.(`✓ Applied ${currentScopeColor} background to all ${isCarousel ? 'slides' : 'spreads'}`);
                }}
                title="Apply background color to all spreads/slides"
              >
                <Palette size={13} strokeWidth={1.5} />
                <span>Apply Background to All {isCarousel ? 'Slides' : 'Spreads'}</span>
              </button>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => handleApplyNoiseToAll(currentBgNoise)}
                title="Apply background noise to all spreads/slides"
              >
                <Sparkles size={13} strokeWidth={1.5} />
                <span>Apply Noise to All {isCarousel ? 'Slides' : 'Spreads'}</span>
              </button>
            </div>
          </>
        )}

        {/* MODE B: IMAGE */}
        {bgMode === 'image' && (
          <>
            {!currentBgImage ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDropPhoto}
                onClick={() => setIsPhotoPickerOpen(true)}
                style={{
                  border: isDragOver ? '1px dashed var(--color-accent, #e4e4e7)' : '1px dashed var(--color-border, #2e2e33)',
                  borderRadius: 'var(--radius-md, 6px)',
                  background: isDragOver ? 'rgba(228, 228, 231, 0.08)' : 'var(--color-bg-secondary, #1e1e22)',
                  padding: '16px 12px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  marginBottom: '10px',
                  transition: 'all 0.15s ease',
                }}
                title="Click to choose a photo or drag from filmstrip"
              >
                <Upload size={20} strokeWidth={1.5} style={{ margin: '0 auto 6px auto', display: 'block', color: 'var(--color-text-secondary)' }} />
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                  Drop a photo from the filmstrip here or click to choose from project photos
                </div>
              </div>
            ) : (
              <div>
                {/* Thumbnail Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <img
                    src={convertFileSrc(currentBgImage.thumbnailPath || currentBgImage.previewPath || currentBgImage.filePath)}
                    alt={currentBgImage.fileName}
                    style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {currentBgImage.fileName}
                    </div>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      style={{ height: '22px', fontSize: '10px', marginTop: '4px' }}
                      onClick={() => setIsPhotoPickerOpen(true)}
                    >
                      Replace
                    </button>
                  </div>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.actionBtnDanger}`}
                    onClick={handleClearBgImage}
                    title="Remove background image"
                  >
                    <Trash2 size={13} strokeWidth={1.5} />
                  </button>
                </div>

                {/* Target Scope (Print only) */}
                {!isCarousel && (
                  <div style={{ marginBottom: '8px' }}>
                    <div className={styles.subLabel} style={{ marginBottom: '4px' }}>Target</div>
                    <div className={styles.propGrid3}>
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${(!currentBgImage.target || currentBgImage.target === 'full') ? styles.iconBtnActive : ''}`}
                        onClick={() => handleUpdateBgImagePatch({ target: 'full' })}
                      >
                        Full
                      </button>
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${currentBgImage.target === 'left' ? styles.iconBtnActive : ''}`}
                        onClick={() => handleUpdateBgImagePatch({ target: 'left' })}
                      >
                        Left
                      </button>
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${currentBgImage.target === 'right' ? styles.iconBtnActive : ''}`}
                        onClick={() => handleUpdateBgImagePatch({ target: 'right' })}
                      >
                        Right
                      </button>
                    </div>
                  </div>
                )}

                {/* Fit Selector */}
                <div style={{ marginBottom: '8px' }}>
                  <div className={styles.subLabel} style={{ marginBottom: '4px' }}>Fit Mode</div>
                  <div className={styles.propGrid3}>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${(!currentBgImage.fit || currentBgImage.fit === 'fill') ? styles.iconBtnActive : ''}`}
                      onClick={() => handleUpdateBgImagePatch({ fit: 'fill' })}
                    >
                      Fill
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${currentBgImage.fit === 'fit' ? styles.iconBtnActive : ''}`}
                      onClick={() => handleUpdateBgImagePatch({ fit: 'fit' })}
                    >
                      Fit
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${currentBgImage.fit === 'stretch' ? styles.iconBtnActive : ''}`}
                      onClick={() => handleUpdateBgImagePatch({ fit: 'stretch' })}
                    >
                      Stretch
                    </button>
                  </div>
                </div>

                {/* Opacity */}
                <div style={{ marginBottom: '8px' }}>
                  <div className={styles.groupHeader}>
                    <span className={styles.subLabel}>Opacity</span>
                    <span className={styles.sliderBadge}>{currentBgImage.opacity ?? 100}%</span>
                  </div>
                  <div className={styles.sliderContainer}>
                    <input
                      type="range"
                      className={styles.slider}
                      min={0}
                      max={100}
                      value={currentBgImage.opacity ?? 100}
                      onChange={(e) => handleUpdateBgImagePatch({ opacity: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Blur */}
                <div style={{ marginBottom: '8px' }}>
                  <div className={styles.groupHeader}>
                    <span className={styles.subLabel}>Blur</span>
                    <span className={styles.sliderBadge}>
                      {physicalToEffectSlider(currentBgImage.blurRadius ?? 0, 'blurRadius', canvasUnit, isCarousel)}
                    </span>
                  </div>
                  <div className={styles.sliderContainer}>
                    <input
                      type="range"
                      className={styles.slider}
                      min={0}
                      max={100}
                      value={physicalToEffectSlider(currentBgImage.blurRadius ?? 0, 'blurRadius', canvasUnit, isCarousel)}
                      onChange={(e) => {
                        const physVal = effectSliderToPhysical(Number(e.target.value), 'blurRadius', canvasUnit, isCarousel);
                        handleUpdateBgImagePatch({ blurRadius: physVal });
                      }}
                    />
                  </div>
                </div>

                {/* Grayscale */}
                <div style={{ marginBottom: '8px' }}>
                  <div className={styles.groupHeader}>
                    <span className={styles.subLabel}>Grayscale</span>
                    <span className={styles.sliderBadge}>{currentBgImage.grayscaleAmount ?? 0}%</span>
                  </div>
                  <div className={styles.sliderContainer}>
                    <input
                      type="range"
                      className={styles.slider}
                      min={0}
                      max={100}
                      value={currentBgImage.grayscaleAmount ?? 0}
                      onChange={(e) => handleUpdateBgImagePatch({ grayscaleAmount: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Film Grain Noise */}
                <div style={{ marginBottom: '8px' }}>
                  <div className={styles.groupHeader}>
                    <span className={styles.subLabel}>Film Grain</span>
                    <span className={styles.sliderBadge}>{currentBgImage.noiseAmount ?? 0}%</span>
                  </div>
                  <div className={styles.sliderContainer}>
                    <input
                      type="range"
                      className={styles.slider}
                      min={0}
                      max={100}
                      value={currentBgImage.noiseAmount ?? 0}
                      onChange={(e) => handleUpdateBgImagePatch({ noiseAmount: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Zoom & Reset */}
                <div style={{ marginBottom: '8px' }}>
                  <div className={styles.groupHeader}>
                    <span className={styles.subLabel}>Zoom</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className={styles.sliderBadge}>
                        {Math.round((currentBgImage.cropScale ?? 1.0) * 100)}%
                      </span>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        style={{ width: '20px', height: '20px' }}
                        onClick={() => handleUpdateBgImagePatch({ cropScale: 1.0, cropX: 0, cropY: 0 })}
                        title="Reset Crop & Zoom"
                      >
                        <RotateCcw size={11} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                  <div className={styles.sliderContainer}>
                    <input
                      type="range"
                      className={styles.slider}
                      min={100}
                      max={300}
                      value={Math.round((currentBgImage.cropScale ?? 1.0) * 100)}
                      onChange={(e) => handleUpdateBgImagePatch({ cropScale: Number(e.target.value) / 100 })}
                    />
                  </div>
                </div>

                {/* Flip Buttons */}
                <div className={styles.propGrid2} style={{ marginBottom: '10px' }}>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${currentBgImage.flipHorizontal ? styles.iconBtnActive : ''}`}
                    onClick={() => handleUpdateBgImagePatch({ flipHorizontal: !currentBgImage.flipHorizontal })}
                  >
                    <FlipHorizontal size={13} strokeWidth={1.5} />
                    <span>Horizontal</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${currentBgImage.flipVertical ? styles.iconBtnActive : ''}`}
                    onClick={() => handleUpdateBgImagePatch({ flipVertical: !currentBgImage.flipVertical })}
                  >
                    <FlipVertical size={13} strokeWidth={1.5} />
                    <span>Vertical</span>
                  </button>
                </div>

                {/* Apply to all spreads */}
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => {
                    if (isCarousel) {
                      currentCarousel?.slides.forEach((_, idx) => {
                        setCarouselBackgroundImage(idx, currentBgImage);
                      });
                    } else if (currentAlbum) {
                      currentAlbum.spreads.forEach((s) => {
                        setSpreadBackgroundImage(s.id, currentBgImage, 'spread');
                      });
                    }
                    onToast?.(`✓ Applied background image to all ${isCarousel ? 'slides' : 'spreads'}`);
                  }}
                >
                  <ImageIcon size={13} strokeWidth={1.5} />
                  <span>Apply Image to All {isCarousel ? 'Slides' : 'Spreads'}</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className={styles.divider} />

      {/* Inner Page / Spread Border Group (FX-04, D-05) */}
      <div className={styles.propGroup}>
        <div className={styles.groupHeader}>
          <span className={styles.label}>Inner Page Border</span>
          <Switch
            checked={currentBorderEnabled}
            onChange={(checked) => handleUpdateBorder({ borderEnabled: checked })}
          />
        </div>

        {currentBorderEnabled && (
          <>
            {/* Target Scope (Print Spread only) */}
            {!isCarousel && (
              <div style={{ marginBottom: '8px' }}>
                <div className={styles.subLabel} style={{ marginBottom: '4px' }}>Target Scope</div>
                <div className={styles.propGrid4}>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${currentBorderTarget === 'both' ? styles.iconBtnActive : ''}`}
                    onClick={() => handleUpdateBorder({ borderEnabled: true }, 'both')}
                  >
                    Both
                  </button>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${currentBorderTarget === 'full' ? styles.iconBtnActive : ''}`}
                    onClick={() => handleUpdateBorder({ borderEnabled: true }, 'full')}
                  >
                    Full
                  </button>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${currentBorderTarget === 'left' ? styles.iconBtnActive : ''}`}
                    onClick={() => handleUpdateBorder({ borderEnabled: true }, 'left')}
                  >
                    Left
                  </button>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${currentBorderTarget === 'right' ? styles.iconBtnActive : ''}`}
                    onClick={() => handleUpdateBorder({ borderEnabled: true }, 'right')}
                  >
                    Right
                  </button>
                </div>
              </div>
            )}

            {/* Border Color */}
            <div className={styles.propRow}>
              <span className={styles.subLabel}>Border Color</span>
              <ColorPicker
                value={currentBorderColor}
                onChange={(c) => handleUpdateBorder({ borderColor: c })}
              />
            </div>

            {/* Border Width */}
            <div style={{ marginBottom: '8px' }}>
              <NumberInput
                label="Border Width"
                value={currentBorderWidth}
                min={0.1}
                max={50}
                step={0.5}
                suffix={canvasUnit}
                onChange={(w) => handleUpdateBorder({ borderWidth: w })}
              />
            </div>

            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => handleApplyBorderToAll({
                borderEnabled: true,
                borderWidth: currentBorderWidth,
                borderColor: currentBorderColor,
              })}
            >
              <span>Apply Border to All {isCarousel ? 'Slides' : 'Spreads'}</span>
            </button>
          </>
        )}
      </div>

      {/* Project Photo Picker Modal */}
      {isPhotoPickerOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setIsPhotoPickerOpen(false)}
        >
          <div
            style={{
              background: 'var(--color-bg-secondary, #1e1e22)',
              border: '1px solid var(--color-border, #2e2e33)',
              borderRadius: '8px',
              padding: '16px',
              width: '440px',
              maxHeight: '480px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Choose Background Photo</span>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setIsPhotoPickerOpen(false)}
              >
                ✕
              </button>
            </div>
            {photos.length === 0 ? (
              <div className={styles.emptyHint}>No photos imported in project yet.</div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  overflowY: 'auto',
                  maxHeight: '360px',
                  padding: '4px',
                }}
              >
                {photos.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      aspectRatio: '1',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      border: '1px solid var(--color-border)',
                    }}
                    onClick={() => handleSelectPhoto(p)}
                  >
                    <img
                      src={convertFileSrc(p.thumbnailPath || p.previewPath || p.filePath)}
                      alt={p.fileName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
