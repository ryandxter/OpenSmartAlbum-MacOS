import { invoke } from '@tauri-apps/api/core';

export interface PhotoFaceLandmarks {
  rightEye: [number, number];   // Normalized [0.0, 1.0] (subject's right / viewer's left)
  leftEye: [number, number];    // Normalized [0.0, 1.0] (subject's left / viewer's right)
  noseTip: [number, number];    // Nose apex
  rightMouth: [number, number]; // Subject's right mouth corner
  leftMouth: [number, number];  // Subject's left mouth corner
}

export interface DetectedFace {
  bboxX: number;              // Normalized top-left X [0.0, 1.0]
  bboxY: number;              // Normalized top-left Y [0.0, 1.0]
  bboxWidth: number;          // Normalized width [0.0, 1.0]
  bboxHeight: number;         // Normalized height [0.0, 1.0]
  score: number;              // YuNet composite confidence score [0.0, 1.0]
  landmarks: PhotoFaceLandmarks;
  rollDegrees: number;        // Tilt angle (-180 to 180)
  eyeDistance: number;        // Normalized inter-pupillary distance
  isFrontal: boolean;         // Facial symmetry ratio >= 0.75
  sharpnessScore: number;     // Clarity metric [0 - 100]
  isHeroCandidate: boolean;   // Evaluated hero candidate
  isEyesClosed: boolean;      // Blink indicator
}

export interface PhotoFaceData {
  photoPath: string;
  width: number;
  height: number;
  faces: DetectedFace[];
  heroScore: number;          // Aggregate quality score [0 - 100]
  sharpnessScore?: number;    // Aggregate sharpness [0 - 100]
  focalPoint: [number, number] | { x: number; y: number }; // Normalized (0..1, 0..1)
  eyeLevelY: number;          // Normalized eye horizon (0..1)
  detectionTimeMs?: number;
}

export type StudioFramingPreset =
  | 'pasfoto_formal'
  | 'wisuda_uny'
  | 'rule_of_thirds'
  | 'natural_center'
  | 'group_auto_centering'
  | 'custom';

export interface FramingConfig {
  preset: StudioFramingPreset;
  headroomRatio: number;      // e.g. 0.10 for 10%
  eyeLineTargetRatio: number; // e.g. 0.333 for Top 1/3, 0.40 for pasfoto, 0.50 for center
  shoulderRatio: number;      // e.g. 0.50 for 50% shoulder clearance
  faceScaleFraction: number;  // Desired face fraction of frame height
  lockGazeOffset: boolean;    // Apply lateral offset based on head orientation
}

export const STUDIO_PRESET_CONFIGS: Record<StudioFramingPreset, FramingConfig> = {
  pasfoto_formal: {
    preset: 'pasfoto_formal',
    headroomRatio: 0.10,
    eyeLineTargetRatio: 0.40,
    shoulderRatio: 0.35,
    faceScaleFraction: 0.65,
    lockGazeOffset: false,
  },
  wisuda_uny: {
    preset: 'wisuda_uny',
    headroomRatio: 0.14,
    eyeLineTargetRatio: 0.333,
    shoulderRatio: 0.50,
    faceScaleFraction: 0.45,
    lockGazeOffset: false,
  },
  rule_of_thirds: {
    preset: 'rule_of_thirds',
    headroomRatio: 0.12,
    eyeLineTargetRatio: 0.333,
    shoulderRatio: 0.45,
    faceScaleFraction: 0.35,
    lockGazeOffset: true,
  },
  natural_center: {
    preset: 'natural_center',
    headroomRatio: 0.12,
    eyeLineTargetRatio: 0.50,
    shoulderRatio: 0.50,
    faceScaleFraction: 0.40,
    lockGazeOffset: false,
  },
  group_auto_centering: {
    preset: 'group_auto_centering',
    headroomRatio: 0.15,
    eyeLineTargetRatio: 0.35,
    shoulderRatio: 0.60,
    faceScaleFraction: 0.50,
    lockGazeOffset: false,
  },
  custom: {
    preset: 'custom',
    headroomRatio: 0.10,
    eyeLineTargetRatio: 0.333,
    shoulderRatio: 0.50,
    faceScaleFraction: 0.45,
    lockGazeOffset: false,
  },
};

/**
 * Invokes native YuNet face detection for a single photo.
 */
export async function detectPhotoFaces(filePath: string): Promise<PhotoFaceData> {
  return await invoke<PhotoFaceData>('detect_photo_faces', { imagePath: filePath });
}

/**
 * Invokes native Rayon batch face detection across multiple photos.
 */
export async function detectPhotosFacesBatch(filePaths: string[]): Promise<PhotoFaceData[]> {
  return await invoke<PhotoFaceData[]>('detect_photos_faces_batch', { imagePaths: filePaths });
}

/**
 * Returns true if photo qualifies as a Standout Hero Shot (score >= 85).
 */
export function isHeroShot(faceData?: PhotoFaceData | null): boolean {
  if (!faceData || !faceData.faces || faceData.faces.length === 0) return false;
  return faceData.heroScore >= 85;
}

/**
 * Formats a short badge string for face count and confidence.
 */
export function formatFaceTelemetryBadge(faceData?: PhotoFaceData | null): string {
  if (!faceData || !faceData.faces || faceData.faces.length === 0) {
    return 'No Faces';
  }
  if (faceData.faces.length === 1 && faceData.faces[0]) {
    const conf = Math.round(faceData.faces[0].score * 100);
    return `👤 1 Face • ${conf}%`;
  }
  return `👥 ${faceData.faces.length} Faces`;
}
