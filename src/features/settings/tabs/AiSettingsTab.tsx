import { useState } from 'react';
import { Sparkles, RefreshCw, Trash2 } from 'lucide-react';
import { useAppStore } from '../../../stores/appStore';
import { usePhotoStore } from '../../../stores/photoStore';
import { useProjectStore } from '../../../stores/projectStore';
import { Switch } from '../../../components/ui/Switch';
import type { AiSensitivityLevel } from '../../../domain/appPreferences';
import styles from '../SettingsDialog.module.css';

const SENSITIVITY_OPTIONS: Array<{ id: AiSensitivityLevel; label: string; value: string; desc: string }> = [
  { id: 'high', label: 'High Sensitivity', value: '0.50', desc: 'Detects smaller, distant, or profile faces' },
  { id: 'balanced', label: 'Balanced (Default)', value: '0.58', desc: 'Optimal for wedding, event & family albums' },
  { id: 'strict', label: 'Strict', value: '0.70', desc: 'Detects clear, frontal portraits with high certainty' },
];

export function AiSettingsTab() {
  const preferences = useAppStore((s) => s.preferences);
  const updatePreferences = useAppStore((s) => s.updatePreferences);

  const currentProject = useProjectStore((s) => s.currentProject);
  const photoAiAnalyses = usePhotoStore((s) => s.photoAiAnalyses);
  const aiProgress = usePhotoStore((s) => s.aiProgress);
  const startProjectAiAnalysis = usePhotoStore((s) => s.startProjectAiAnalysis);
  const clearProjectAiAnalyses = usePhotoStore((s) => s.clearProjectAiAnalyses);

  const [notice, setNotice] = useState<string | null>(null);

  const analyzedCount = Object.keys(photoAiAnalyses).length;

  const handleReanalyze = async () => {
    if (!currentProject) return;
    const sensValue =
      preferences.aiSensitivity === 'high' ? 0.50 : preferences.aiSensitivity === 'strict' ? 0.70 : 0.58;
    await startProjectAiAnalysis(currentProject.id, sensValue);
    setNotice('Face analysis started in the background.');
  };

  const handleClearCache = async () => {
    if (!currentProject) return;
    await clearProjectAiAnalyses(currentProject.id);
    setNotice('Face detection cache cleared for current project.');
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>AI Face Detection &amp; Smart Framing</div>
        <div className={styles.sectionSubtitle}>
          Configure embedded YuNet neural face detection, hero scoring, and automatic crop alignment safeguards.
        </div>
      </div>

      {/* Auto-Analyze Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div style={{ flex: 1 }}>
            <div className={styles.cardTitle}>Automatic Face Analysis</div>
            <div className={styles.cardSubtitle}>
              Run background neural face detection automatically when importing new photos.
            </div>
          </div>
          <Switch
            checked={preferences.aiAutoAnalyzeOnImport}
            onChange={(aiAutoAnalyzeOnImport) => updatePreferences({ aiAutoAnalyzeOnImport })}
            size="md"
          />
        </div>
      </div>

      {/* Sensitivity Tiers Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.cardTitle}>Detection Confidence &amp; Sensitivity</div>
            <div className={styles.cardSubtitle}>
              Threshold for identifying human faces and computing 5-point facial landmarks.
            </div>
          </div>
        </div>

        <div className={styles.generalCardBody} style={{ gap: 8, display: 'flex', flexDirection: 'column' }}>
          {SENSITIVITY_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: preferences.aiSensitivity === opt.id ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)',
                background: preferences.aiSensitivity === opt.id ? 'rgba(56, 189, 248, 0.08)' : '#27272a',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="aiSensitivity"
                checked={preferences.aiSensitivity === opt.id}
                onChange={() => updatePreferences({ aiSensitivity: opt.id })}
                style={{ marginTop: 3, accentColor: '#38bdf8' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 13, color: '#f4f4f5' }}>{opt.label}</strong>
                  <span style={{ fontSize: 11, color: '#a1a1aa' }}>Threshold {opt.value}</span>
                </div>
                <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 2 }}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Smart Framing & Layout Safeguards Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.cardTitle}>Face-Aware Smart Layout &amp; Safeguards</div>
            <div className={styles.cardSubtitle}>
              Rules applied by the Adaptive Layout and Auto-Flow storytelling engines.
            </div>
          </div>
        </div>

        <div className={styles.generalCardBody}>
          {/* Rule 1: Prioritize Hero Faces */}
          <div className={styles.actionStrip} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10 }}>
            <div className={styles.actionStripCopy}>
              <strong>Prioritize Sharp Faces for Hero Slots</strong>
              <span>Automatically place high-quality portraits with open eyes into dominant layout frames.</span>
            </div>
            <Switch
              checked={preferences.aiPrioritizeHeroFaces}
              onChange={(aiPrioritizeHeroFaces) => updatePreferences({ aiPrioritizeHeroFaces })}
              size="md"
            />
          </div>

          {/* Rule 2: Face-Aware Orientation */}
          <div className={styles.actionStrip} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10 }}>
            <div className={styles.actionStripCopy}>
              <strong>Face-Aware Orientation Matching</strong>
              <span>Align frame aspect ratios with the visual direction and distribution of faces.</span>
            </div>
            <Switch
              checked={preferences.aiFaceAwareOrientation}
              onChange={(aiFaceAwareOrientation) => updatePreferences({ aiFaceAwareOrientation })}
              size="md"
            />
          </div>

          {/* Rule 3: Spine Gutter Avoidance */}
          <div className={styles.actionStrip}>
            <div className={styles.actionStripCopy}>
              <strong>Spine Gutter Clearance (Print Album)</strong>
              <span>Automatically shift horizontal crop to prevent faces from crossing physical book folds.</span>
            </div>
            <Switch
              checked={preferences.aiSpineGutterAvoidance}
              onChange={(aiSpineGutterAvoidance) => updatePreferences({ aiSpineGutterAvoidance })}
              size="md"
            />
          </div>
        </div>
      </div>

      {/* Project AI Cache Maintenance */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.cardTitle}>Project AI Cache Maintenance</div>
            <div className={styles.cardSubtitle}>
              {currentProject ? `Active Project: "${currentProject.name}"` : 'No active project loaded'}
            </div>
          </div>
        </div>

        <div className={styles.generalCardBody}>
          <div className={styles.cacheMetricPanel}>
            <div className={styles.cacheMetricIcon}>
              <Sparkles size={18} strokeWidth={1.5} />
            </div>
            <div className={styles.cacheMetricCopy}>
              <strong>Analyzed Photo Telemetry</strong>
              <span>
                {aiProgress?.isAnalyzing
                  ? `Analyzing: ${aiProgress.completed} / ${aiProgress.total} photos…`
                  : `${analyzedCount} photos analyzed in SQLite`}
              </span>
            </div>
            <span className={styles.cacheSizeValue}>{analyzedCount}</span>
          </div>

          <div className={styles.actionStrip}>
            <div className={styles.actionStripCopy}>
              <strong>Re-analyze Project Faces</strong>
              <span>Run neural detection on all photos in the current project using active sensitivity.</span>
            </div>
            <button
              type="button"
              className={styles.generalActionButton}
              onClick={handleReanalyze}
              disabled={!currentProject || Boolean(aiProgress?.isAnalyzing)}
            >
              <RefreshCw size={14} strokeWidth={1.5} />
              Re-analyze
            </button>
          </div>

          <div className={styles.actionStrip}>
            <div className={styles.actionStripCopy}>
              <strong>Reset Face Telemetry</strong>
              <span>Clears persistent SQLite analysis data for this project.</span>
            </div>
            <button
              type="button"
              className={styles.generalActionButton}
              onClick={handleClearCache}
              disabled={!currentProject || Boolean(aiProgress?.isAnalyzing)}
            >
              <Trash2 size={14} strokeWidth={1.5} />
              Clear Cache
            </button>
          </div>
        </div>
      </div>

      {notice && (
        <div className={styles.generalNotice} role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
