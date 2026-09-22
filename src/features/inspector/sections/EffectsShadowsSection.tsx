import { useState } from 'react';
import { Palette } from 'lucide-react';
import { useEditorStore } from '../../../stores/editorStore';
import { useAlbumStore } from '../../../stores/albumStore';
import { ColorPicker } from '../../../components/ui/ColorPicker';
import { OpacityControl } from '../../editor/OpacityControl';
import { getAllAlbumSpreads } from '../../../domain/album';
import styles from '../InspectorShared.module.css';

interface EffectsShadowsSectionProps {
  onToast?: (msg: string) => void;
}

export function EffectsShadowsSection({ onToast }: EffectsShadowsSectionProps) {
  const currentAlbum = useAlbumStore((s) => s.currentAlbum);
  const activeSpreadId = useAlbumStore((s) => s.activeSpreadId);
  const updateSpreadBackgroundColor = useAlbumStore((s) => s.updateSpreadBackgroundColor);
  const applyBackgroundColorToAllSpreads = useAlbumStore((s) => s.applyBackgroundColorToAllSpreads);
  const selectedFrameIds = useEditorStore((s) => s.selectedFrameIds);

  const [bgScope, setBgScope] = useState<'spread' | 'left' | 'right'>('spread');

  const allSpreads = currentAlbum ? getAllAlbumSpreads(currentAlbum) : [];
  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];

  const selectedElements = (activeSpread?.elements || []).filter((el) =>
    selectedFrameIds.includes(el.id)
  );

  // 1. ELEMENTS SELECTED: Opacity & Shadows
  if (selectedElements.length > 0) {
    return (
      <div>
        {/* Opacity Control */}
        <div className={styles.propGroup}>
          <div className={styles.groupHeader}>
            <span className={styles.label}>Object Opacity</span>
          </div>
          {activeSpread && (
            <OpacityControl
              spreadId={activeSpread.id}
              elements={selectedElements}
            />
          )}
        </div>

        <div className={styles.divider} />

        {/* Drop Shadow Preview / Quick Shell */}
        <div className={styles.propGroup}>
          <div className={styles.groupHeader}>
            <span className={styles.label}>Drop Shadow</span>
            <span className={styles.subLabel} style={{ fontSize: '9px', textTransform: 'uppercase', opacity: 0.6 }}>
              Canvas
            </span>
          </div>

          <div className={styles.emptyHint} style={{ textAlign: 'left', padding: '4px 0' }}>
            Interactive drop shadow styling for frames and text boxes is computed dynamically during canvas rendering.
          </div>
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
