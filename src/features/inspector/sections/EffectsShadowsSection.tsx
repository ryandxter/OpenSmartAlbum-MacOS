import { useState } from 'react';
import { Palette, RotateCcw, FlipHorizontal, FlipVertical } from 'lucide-react';
import { useEditorStore } from '../../../stores/editorStore';
import { useAlbumStore } from '../../../stores/albumStore';
import { useCarouselStore } from '../../../stores/carouselStore';
import { useProjectStore } from '../../../stores/projectStore';
import { ColorPicker } from '../../../components/ui/ColorPicker';
import { Switch } from '../../../components/ui/Switch';
import { NumberInput } from '../../../components/ui/NumberInput';
import { OpacityControl } from '../../editor/OpacityControl';
import { getAllAlbumSpreads } from '../../../domain/album';
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
  const flipAlbumElements = useAlbumStore((s) => s.flipElements);
  const updateAlbumVisualEffects = useAlbumStore((s) => s.updateElementVisualEffects);
  const selectedFrameIds = useEditorStore((s) => s.selectedFrameIds);

  // Carousel state
  const currentCarousel = useCarouselStore((s) => s.currentCarousel);
  const activeSlideIndex = useCarouselStore((s) => s.activeSlideIndex);
  const selectedCarouselFrameId = useCarouselStore((s) => s.selectedFrameId);
  const selectedCarouselFrameIds = useCarouselStore((s) => s.selectedFrameIds);
  const flipCarouselElements = useCarouselStore((s) => s.flipElements);
  const updateCarouselVisualEffects = useCarouselStore((s) => s.updateElementVisualEffects);

  // Project state
  const currentProject = useProjectStore((s) => s.currentProject);
  const canvasUnit: CanvasUnit = isCarousel ? 'px' : (currentProject?.canvasUnit || 'mm');

  const [bgScope, setBgScope] = useState<'spread' | 'left' | 'right'>('spread');

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

  // 2. NO ELEMENTS SELECTED: Spread Background Color & Propagation
  const activeSpreadBg = activeSpread?.backgroundColor || '#FFFFFF';
  const currentScopeColor =
    bgScope === 'left'
      ? activeSpread?.leftPage?.backgroundColor || activeSpreadBg
      : bgScope === 'right'
      ? activeSpread?.rightPage?.backgroundColor || activeSpreadBg
      : activeSpreadBg;

  return (
    <div>
      <div className={styles.propGroup}>
        <div className={styles.groupHeader}>
          <span className={styles.label}>Spread Background</span>
        </div>

        {/* Scope Segmented Control */}
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

        {/* Color Picker */}
        <div style={{ marginBottom: '10px' }}>
          <ColorPicker
            value={currentScopeColor}
            onChange={(newColor) => {
              if (activeSpread) {
                updateSpreadBackgroundColor(activeSpread.id, newColor, bgScope);
              }
            }}
            presetColors={[
              '#FFFFFF', '#F8FAFC', '#FDFBF7', '#E2E8F0', '#CBD5E1', '#94A3B8',
              '#64748B', '#475569', '#334155', '#1E293B', '#0F172A', '#000000',
            ]}
          />
        </div>

        {/* Propagate to All Spreads */}
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => {
            applyBackgroundColorToAllSpreads(currentScopeColor);
            onToast?.(`✓ Applied ${currentScopeColor} background to all spreads`);
          }}
          title="Apply background color to all spreads in the album"
        >
          <Palette size={13} strokeWidth={1.5} />
          <span>Apply Background to All Spreads</span>
        </button>
      </div>
    </div>
  );
}
