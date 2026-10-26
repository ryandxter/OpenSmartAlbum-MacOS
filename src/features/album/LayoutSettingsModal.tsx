import { X, Sliders } from 'lucide-react';
import {
  AdaptiveLayoutMood,
  MOOD_PRESETS,
  LockedAnchorStrategy,
} from '../../domain/adaptiveLayout';
import { useAppStore } from '../../stores/appStore';
import styles from './LayoutSettingsModal.module.css';

interface LayoutSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MOOD_OPTIONS: Array<{ id: AdaptiveLayoutMood; name: string; icon: string }> = [
  { id: 'balanced', name: 'Balanced', icon: '⚖️' },
  { id: 'airy', name: 'Airy', icon: '🍃' },
  { id: 'compact', name: 'Compact', icon: '📐' },
  { id: 'hero', name: 'Hero', icon: '🌟' },
  { id: 'uniform', name: 'Uniform', icon: '🔲' },
];

export function LayoutSettingsModal({ isOpen, onClose }: LayoutSettingsModalProps) {
  const settings = useAppStore((s) => s.adaptiveLayoutSettings);
  const updateSettings = useAppStore((s) => s.updateAdaptiveLayoutSettings);
  const resetSettings = useAppStore((s) => s.resetAdaptiveLayoutSettings);

  if (!isOpen) return null;

  const handleSelectMood = (mood: AdaptiveLayoutMood) => {
    const preset = MOOD_PRESETS[mood];
    updateSettings({
      mood,
      ...preset,
    });
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sliders size={14} color="#38bdf8" />
              <h3 className={styles.title}>Layout Generator Tuning</h3>
            </div>
            <p className={styles.subtitle}>Fine-tune mood presets, canvas density, and breathing room</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          {/* Mood Presets */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>Mood Preset</span>
              <span className={styles.valueBadge}>{settings.mood.toUpperCase()}</span>
            </div>
            <div className={styles.presetsGrid}>
              {MOOD_OPTIONS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`${styles.presetBtn} ${settings.mood === m.id ? styles.presetBtnActive : ''}`}
                  onClick={() => handleSelectMood(m.id)}
                >
                  <span className={styles.presetIcon}>{m.icon}</span>
                  <span className={styles.presetName}>{m.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Canvas Density */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>Canvas Density</span>
              <span className={styles.valueBadge}>{Math.round(settings.canvasDensity * 100)}%</span>
            </div>
            <div className={styles.sliderRow}>
              <input
                type="range"
                className={styles.slider}
                min={50}
                max={95}
                step={5}
                value={Math.round(settings.canvasDensity * 100)}
                onChange={(e) => updateSettings({ canvasDensity: Number(e.target.value) / 100 })}
              />
            </div>
          </div>

          {/* Photo Spacing Mode */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>Photo Spacing</span>
              <span className={styles.valueBadge}>{settings.spacingMode === 'breathing' ? 'Breathing (+50%)' : 'Fixed'}</span>
            </div>
            <div className={styles.segmentedRow}>
              <button
                type="button"
                className={`${styles.segmentedBtn} ${settings.spacingMode === 'fixed' ? styles.segmentedBtnActive : ''}`}
                onClick={() => updateSettings({ spacingMode: 'fixed' })}
              >
                Fixed
              </button>
              <button
                type="button"
                className={`${styles.segmentedBtn} ${settings.spacingMode === 'breathing' ? styles.segmentedBtnActive : ''}`}
                onClick={() => updateSettings({ spacingMode: 'breathing' })}
              >
                Breathing
              </button>
            </div>
          </div>

          {/* Size Contrast */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>Size Contrast</span>
              <span className={styles.valueBadge}>{settings.sizeContrast}</span>
            </div>
            <div className={styles.sliderRow}>
              <input
                type="range"
                className={styles.slider}
                min={0}
                max={100}
                step={5}
                value={settings.sizeContrast}
                onChange={(e) => updateSettings({ sizeContrast: Number(e.target.value) })}
              />
            </div>
          </div>

          {/* Locked Anchor Strategy */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>Pinned Anchor Strategy</span>
              <span className={styles.valueBadge}>{settings.lockedAnchorStrategy.toUpperCase()}</span>
            </div>
            <div className={styles.segmentedRow}>
              {(['avoid', 'wrap', 'fill'] as LockedAnchorStrategy[]).map((strat) => (
                <button
                  key={strat}
                  type="button"
                  className={`${styles.segmentedBtn} ${settings.lockedAnchorStrategy === strat ? styles.segmentedBtnActive : ''}`}
                  onClick={() => updateSettings({ lockedAnchorStrategy: strat })}
                >
                  {strat.charAt(0).toUpperCase() + strat.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.btnReset} onClick={resetSettings}>
            Reset Defaults
          </button>
          <button type="button" className={styles.btnApply} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
