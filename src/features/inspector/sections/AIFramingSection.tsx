import React, { useState } from 'react';
import { RefreshCw, RotateCcw, User, Users } from 'lucide-react';
import { useAlbumStore } from '../../../stores/albumStore';
import { useCarouselStore } from '../../../stores/carouselStore';
import { usePhotoStore } from '../../../stores/photoStore';
import { useEditorStore } from '../../../stores/editorStore';
import { PhotoFrameElement } from '../../../domain/editor';
import { CarouselPhotoFrame } from '../../../domain/carousel';
import {
  PhotoFaceData,
  StudioFramingPreset,
  STUDIO_PRESET_CONFIGS,
  isHeroShot,
} from '../../../domain/ai/faceDetection';
import styles from './AIFramingSection.module.css';

export interface AIFramingSectionProps {
  element: PhotoFrameElement | CarouselPhotoFrame;
  faceData?: PhotoFaceData | null;
  onToast?: (msg: string) => void;
  activeMode?: 'print' | 'carousel';
}

export const AIFramingSection: React.FC<AIFramingSectionProps> = ({
  element,
  faceData,
  onToast,
  activeMode = 'print',
}) => {
  const isAnalyzing = usePhotoStore((s) => s.isAnalyzingFaces);
  const analyzePhotoFaces = usePhotoStore((s) => s.analyzePhotoFaces);

  const applyStudioFramingAlbum = useAlbumStore((s) => s.applyStudioFramingPreset);
  const applyStudioFramingCarousel = useCarouselStore((s) => s.applyStudioFramingPreset);
  const updateAlbumFrame = useEditorStore((s) => s.updateFrameGeometry);
  const updateCarouselFrame = useCarouselStore((s) => s.updatePhotoFrame);
  const activeSpreadId = useAlbumStore((s) => s.activeSpreadId);

  const currentPreset: StudioFramingPreset = element.faceFramingPreset || 'natural_center';
  const baseConfig = STUDIO_PRESET_CONFIGS[currentPreset] || STUDIO_PRESET_CONFIGS.natural_center;

  const [headroom, setHeadroom] = useState<number>(
    element.faceHeadroomRatio ?? baseConfig.headroomRatio
  );
  const [eyeLine, setEyeLine] = useState<number>(
    element.faceEyeLineRatio ?? baseConfig.eyeLineTargetRatio
  );
  const [shoulder, setShoulder] = useState<number>(
    element.faceShoulderRatio ?? baseConfig.shoulderRatio
  );

  const applyFraming = (preset: StudioFramingPreset, custom?: { headroom?: number; eyeLine?: number; shoulder?: number }) => {
    const config = {
      headroomRatio: custom?.headroom ?? headroom,
      eyeLineTargetRatio: custom?.eyeLine ?? eyeLine,
      shoulderRatio: custom?.shoulder ?? shoulder,
    };

    if (activeMode === 'carousel') {
      applyStudioFramingCarousel(element.id, preset, config);
    } else {
      applyStudioFramingAlbum(element.id, preset, config);
    }
  };

  const handlePresetChange = (preset: StudioFramingPreset) => {
    const presetDefaults = STUDIO_PRESET_CONFIGS[preset] || STUDIO_PRESET_CONFIGS.natural_center;
    setHeadroom(presetDefaults.headroomRatio);
    setEyeLine(presetDefaults.eyeLineTargetRatio);
    setShoulder(presetDefaults.shoulderRatio);
    applyFraming(preset, {
      headroom: presetDefaults.headroomRatio,
      eyeLine: presetDefaults.eyeLineTargetRatio,
      shoulder: presetDefaults.shoulderRatio,
    });
    onToast?.(`Applied studio framing: ${preset.replace(/_/g, ' ')}`);
  };

  const handleToggleReticles = () => {
    const nextVal = !element.showFaceReticles;
    if (activeMode === 'carousel') {
      updateCarouselFrame(element.id, { showFaceReticles: nextVal });
    } else if (activeSpreadId) {
      updateAlbumFrame(activeSpreadId, element.id, { showFaceReticles: nextVal });
    }
  };

  const handleReanalyze = async () => {
    if (!element.photoId) {
      onToast?.('No photo assigned to frame');
      return;
    }
    const result = await analyzePhotoFaces(element.photoId);
    if (result) {
      onToast?.(`Face analysis complete: ${result.faces.length} face(s) detected`);
      applyFraming(currentPreset);
    } else {
      onToast?.('Face analysis could not find faces');
    }
  };

  const handleResetCrop = () => {
    if (activeMode === 'carousel') {
      updateCarouselFrame(element.id, {
        cropX: 0,
        cropY: 0,
        cropScale: 1.0,
        faceFramingPreset: undefined,
      });
    } else if (activeSpreadId) {
      updateAlbumFrame(activeSpreadId, element.id, {
        cropX: 0,
        cropY: 0,
        cropScale: 1.0,
        faceFramingPreset: undefined,
      });
    }
    onToast?.('Reset crop to optical center');
  };

  const faces = faceData?.faces || [];
  const faceCount = faces.length;
  const isHero = isHeroShot(faceData);
  const latency = faceData?.detectionTimeMs ? `${Math.round(faceData.detectionTimeMs)}ms` : 'YuNet AI';

  return (
    <div className={styles.container}>
      {/* Face Telemetry Preview Card */}
      <div className={styles.previewCard}>
        <div className={styles.previewIconWrapper}>
          {faceCount > 1 ? <Users size={18} /> : <User size={18} />}
        </div>
        <div className={styles.previewDetails}>
          <div className={styles.previewTitle}>
            {faceCount === 0
              ? 'No Faces Detected'
              : faceCount === 1 && faces[0]
              ? `1 Face Detected (${Math.round(faces[0].score * 100)}% conf)`
              : `${faceCount} Faces Detected (Group)`}
          </div>
          <div className={styles.previewMeta}>
            <span className={styles.latencyTag}>{latency}</span>
            {isHero && <span className={styles.heroTag}>✨ HERO SHOT</span>}
          </div>
        </div>
      </div>

      {/* Studio Framing Preset Dropdown */}
      <div className={styles.propGroup}>
        <div className={styles.groupHeader}>
          <span className={styles.label}>Studio Framing Preset</span>
        </div>
        <select
          className={styles.presetSelect}
          value={currentPreset}
          onChange={(e) => handlePresetChange(e.target.value as StudioFramingPreset)}
          aria-label="Studio Framing Preset"
        >
          <option value="pasfoto_formal">Pasfoto Formal (3x4 / 4x6 ID)</option>
          <option value="wisuda_uny">Wisuda UNY 50% Shoulder</option>
          <option value="rule_of_thirds">Portrait Rule-of-Thirds</option>
          <option value="natural_center">Natural Center</option>
          <option value="group_auto_centering">Group Auto-Centering</option>
          <option value="custom">Custom Manual Framing</option>
        </select>
      </div>

      {/* Eye Level Horizon Quick Controls */}
      <div className={styles.propGroup}>
        <div className={styles.groupHeader}>
          <span className={styles.label}>Eye-Level Horizon</span>
          <span className={styles.valLabel}>{Math.round(eyeLine * 100)}%</span>
        </div>
        <div className={styles.segmentedGroup}>
          <button
            type="button"
            className={`${styles.segmentedBtn} ${Math.abs(eyeLine - 0.333) < 0.02 ? styles.segmentedBtnActive : ''}`}
            onClick={() => {
              setEyeLine(0.333);
              applyFraming('custom', { eyeLine: 0.333 });
            }}
          >
            Upper 1/3 (33%)
          </button>
          <button
            type="button"
            className={`${styles.segmentedBtn} ${Math.abs(eyeLine - 0.40) < 0.02 ? styles.segmentedBtnActive : ''}`}
            onClick={() => {
              setEyeLine(0.40);
              applyFraming('custom', { eyeLine: 0.40 });
            }}
          >
            Pasfoto (40%)
          </button>
          <button
            type="button"
            className={`${styles.segmentedBtn} ${Math.abs(eyeLine - 0.50) < 0.02 ? styles.segmentedBtnActive : ''}`}
            onClick={() => {
              setEyeLine(0.50);
              applyFraming('custom', { eyeLine: 0.50 });
            }}
          >
            Center (50%)
          </button>
        </div>
      </div>

      {/* Headroom Clearance Slider */}
      <div className={styles.propGroup}>
        <div className={styles.groupHeader}>
          <span className={styles.label}>Headroom Clearance</span>
          <span className={styles.valLabel}>{Math.round(headroom * 100)}%</span>
        </div>
        <div className={styles.sliderRow}>
          <input
            type="range"
            min="0.02"
            max="0.30"
            step="0.01"
            className={styles.slider}
            value={headroom}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setHeadroom(val);
              applyFraming('custom', { headroom: val });
            }}
            aria-label="Headroom Clearance"
          />
        </div>
      </div>

      {/* Shoulder Clearance Ratio Slider */}
      <div className={styles.propGroup}>
        <div className={styles.groupHeader}>
          <span className={styles.label}>Shoulder Ratio</span>
          <span className={styles.valLabel}>{Math.round(shoulder * 100)}%</span>
        </div>
        <div className={styles.sliderRow}>
          <input
            type="range"
            min="0.20"
            max="0.80"
            step="0.02"
            className={styles.slider}
            value={shoulder}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setShoulder(val);
              applyFraming('custom', { shoulder: val });
            }}
            aria-label="Shoulder Ratio"
          />
        </div>
      </div>

      {/* Canvas Visual Guides Checkbox */}
      <label className={styles.toggleRow}>
        <input
          type="checkbox"
          className={styles.toggleInput}
          checked={Boolean(element.showFaceReticles)}
          onChange={handleToggleReticles}
        />
        <span>Show Face Reticle & Landmarks (⇧F)</span>
      </label>

      {/* Action Buttons */}
      <div className={styles.btnGrid}>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={handleReanalyze}
          disabled={isAnalyzing}
          title="Re-run YuNet on-device face detector"
        >
          <RefreshCw size={13} className={isAnalyzing ? 'animate-spin' : ''} />
          <span>{isAnalyzing ? 'Analyzing...' : 'Re-Analyze'}</span>
        </button>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={handleResetCrop}
          title="Reset pan and zoom back to optical center"
        >
          <RotateCcw size={13} />
          <span>Reset Crop</span>
        </button>
      </div>
    </div>
  );
};
