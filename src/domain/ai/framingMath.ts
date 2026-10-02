import { PhotoFaceData, StudioFramingPreset, STUDIO_PRESET_CONFIGS, FramingConfig } from './faceDetection';

export interface CropFramingResult {
  cropX: number;     // Normalized pan [-1.0, 1.0]
  cropY: number;     // Normalized pan [-1.0, 1.0]
  cropScale: number; // Zoom multiplier >= 1.0
}

export interface FrameDimensions {
  frameWidth: number;
  frameHeight: number;
  imageWidth: number;
  imageHeight: number;
}

/**
 * Calculates rendered cover photo dimensions inside a frame given a zoom scale.
 */
export function calculateCoverDimensions(
  frameWidth: number,
  frameHeight: number,
  imageWidth: number,
  imageHeight: number,
  scale: number = 1.0
): { renderedWidth: number; renderedHeight: number; deltaX: number; deltaY: number } {
  const safeImageW = Math.max(1, imageWidth);
  const safeImageH = Math.max(1, imageHeight);
  const photoAspect = safeImageW / safeImageH;

  const safeFrameW = Math.max(1, frameWidth);
  const safeFrameH = Math.max(1, frameHeight);
  const frameAspect = safeFrameW / safeFrameH;

  let baseWidth: number;
  let baseHeight: number;

  if (photoAspect > frameAspect) {
    // Height fits frame; width exceeds frame
    baseHeight = safeFrameH;
    baseWidth = safeFrameH * photoAspect;
  } else {
    // Width fits frame; height exceeds frame
    baseWidth = safeFrameW;
    baseHeight = safeFrameW / photoAspect;
  }

  const renderedWidth = baseWidth * scale;
  const renderedHeight = baseHeight * scale;
  const deltaX = Math.max(0, renderedWidth - safeFrameW);
  const deltaY = Math.max(0, renderedHeight - safeFrameH);

  return { renderedWidth, renderedHeight, deltaX, deltaY };
}

/**
 * Inverts target photo coordinate (uTarget, vTarget) in [0, 1] to target frame position (xTarget, yTarget).
 * Solves for normalized cropX and cropY pan offsets in [-1.0, 1.0].
 */
export function solveCropPanOffsets(
  uTarget: number,
  vTarget: number,
  xTarget: number,
  yTarget: number,
  frameWidth: number,
  frameHeight: number,
  renderedWidth: number,
  renderedHeight: number
): { cropX: number; cropY: number } {
  const deltaX = renderedWidth - frameWidth;
  const deltaY = renderedHeight - frameHeight;

  let cropX = 0;
  if (deltaX > 0.001) {
    // Formula: cropX = (2 * xTarget - frameWidth + renderedWidth * (1 - 2 * uTarget)) / deltaX
    const numX = 2 * xTarget - frameWidth + renderedWidth * (1 - 2 * uTarget);
    cropX = Math.max(-1.0, Math.min(1.0, numX / deltaX));
  }

  let cropY = 0;
  if (deltaY > 0.001) {
    // Formula: cropY = (2 * yTarget - frameHeight + renderedHeight * (1 - 2 * vTarget)) / deltaY
    const numY = 2 * yTarget - frameHeight + renderedHeight * (1 - 2 * vTarget);
    cropY = Math.max(-1.0, Math.min(1.0, numY / deltaY));
  }

  return {
    cropX: Number(cropX.toFixed(4)),
    cropY: Number(cropY.toFixed(4)),
  };
}

/**
 * Computes optimal cropX, cropY, and cropScale for a photo given face data and a studio preset.
 */
export function calculateOptimalStudioCrop(
  dims: FrameDimensions,
  faceData?: PhotoFaceData | null,
  preset: StudioFramingPreset = 'natural_center',
  customConfig?: Partial<FramingConfig>
): CropFramingResult {
  const { frameWidth, frameHeight, imageWidth, imageHeight } = dims;

  // Fallback if no faces detected or no face data provided: Optical Center
  if (!faceData || !faceData.faces || faceData.faces.length === 0) {
    return { cropX: 0, cropY: 0, cropScale: 1.0 };
  }

  const baseConfig = STUDIO_PRESET_CONFIGS[preset] || STUDIO_PRESET_CONFIGS.natural_center;
  const config: FramingConfig = { ...baseConfig, ...customConfig };

  const faces = faceData.faces;
  const primaryFace = faces[0];
  if (!primaryFace) {
    return { cropX: 0, cropY: 0, cropScale: 1.0 };
  }

  // 1. Determine target face focal center (uTarget, vTarget) in normalized photo space [0, 1]
  let uTarget: number;
  let vTarget: number;
  let normFaceHeight: number;

  if (preset === 'group_auto_centering' && faces.length > 1) {
    // Group super-bounding box
    let minX = 1.0;
    let maxX = 0.0;
    let minY = 1.0;
    let maxY = 0.0;
    for (const f of faces) {
      minX = Math.min(minX, f.bboxX);
      maxX = Math.max(maxX, f.bboxX + f.bboxWidth);
      minY = Math.min(minY, f.bboxY);
      maxY = Math.max(maxY, f.bboxY + f.bboxHeight);
    }
    uTarget = (minX + maxX) / 2;
    vTarget = minY + (maxY - minY) * 0.35;
    normFaceHeight = maxY - minY;
  } else {
    // Single or primary face focal point
    uTarget = primaryFace.bboxX + primaryFace.bboxWidth / 2;
    // Eye level horizontal line
    const eyeY = primaryFace.landmarks
      ? (primaryFace.landmarks.leftEye[1] + primaryFace.landmarks.rightEye[1]) / 2
      : primaryFace.bboxY + primaryFace.bboxHeight * 0.35;
    vTarget = eyeY;
    normFaceHeight = primaryFace.bboxHeight;
  }

  // 2. Compute Auto-Zoom Scale to match desired subject proportion
  const baseDims = calculateCoverDimensions(frameWidth, frameHeight, imageWidth, imageHeight, 1.0);
  const unzoomedFacePx = normFaceHeight * baseDims.renderedHeight;
  const targetFacePx = config.faceScaleFraction * frameHeight;

  let cropScale = 1.0;
  if (unzoomedFacePx > 0) {
    const rawScale = targetFacePx / unzoomedFacePx;
    // Clamp zoom scale between 1.0 and 3.5 to prevent pixelation
    cropScale = Math.max(1.0, Math.min(3.5, Number(rawScale.toFixed(3))));
  }

  // 3. Compute target canvas frame position (xTarget, yTarget) in pixels [0, W_f] x [0, H_f]
  let xTarget = frameWidth / 2; // default center X

  // Look-room / Lead-room lateral offset for Rule of Thirds
  if (config.lockGazeOffset && preset === 'rule_of_thirds') {
    const landmarks = primaryFace.landmarks;
    let lookingRight = primaryFace.rollDegrees > 5;
    let lookingLeft = primaryFace.rollDegrees < -5;

    if (landmarks && landmarks.rightEye && landmarks.leftEye && landmarks.noseTip) {
      const dRight = landmarks.noseTip[0] - landmarks.rightEye[0];
      const dLeft = landmarks.leftEye[0] - landmarks.noseTip[0];
      if (dRight > dLeft * 1.25) {
        lookingRight = true;
      } else if (dLeft > dRight * 1.25) {
        lookingLeft = true;
      }
    }

    if (lookingRight && !lookingLeft) {
      // Facing right -> place on left third
      xTarget = frameWidth * 0.333;
    } else if (lookingLeft && !lookingRight) {
      // Facing left -> place on right third
      xTarget = frameWidth * 0.667;
    }
  }

  // Target Y based on eyeLineTargetRatio (e.g. 0.333 for upper third, 0.40 for formal ID)
  const yTarget = frameHeight * config.eyeLineTargetRatio;

  // 4. Invert photo coordinates to solve for cropX and cropY
  const coverDims = calculateCoverDimensions(frameWidth, frameHeight, imageWidth, imageHeight, cropScale);
  const { cropX, cropY } = solveCropPanOffsets(
    uTarget,
    vTarget,
    xTarget,
    yTarget,
    frameWidth,
    frameHeight,
    coverDims.renderedWidth,
    coverDims.renderedHeight
  );

  return { cropX, cropY, cropScale };
}

/**
 * Computes face focal point centering when a photo is dragged into a custom shape mask (oval, star, polygon).
 * Adds 15% safety buffer to prevent mask vertices from clipping facial features.
 */
export function calculateShapeMaskFaceCrop(
  dims: FrameDimensions,
  faceData?: PhotoFaceData | null
): CropFramingResult {
  return calculateOptimalStudioCrop(dims, faceData, 'natural_center', {
    headroomRatio: 0.15,
    faceScaleFraction: 0.35,
  });
}
