import React from 'react';
import { Group, Line, Circle, Text } from 'react-konva';
import { PhotoFaceData } from '../../domain/ai/faceDetection';

export interface KonvaFaceReticleOverlayProps {
  faceData?: PhotoFaceData | null;
  imgX: number;
  imgY: number;
  imgW: number;
  imgH: number;
  frameW: number;
  frameH: number;
  eyeLineRatio?: number;
  visible?: boolean;
}

/**
 * High-performance Konva vector reticle overlay for AI YuNet face bounding boxes,
 * 5-point facial landmarks, and eye-line horizon guide.
 * All nodes have `listening={false}` to ensure 0ms canvas dragging overhead.
 */
export const KonvaFaceReticleOverlay: React.FC<KonvaFaceReticleOverlayProps> = ({
  faceData,
  imgX,
  imgY,
  imgW,
  imgH,
  frameW,
  frameH,
  eyeLineRatio = 0.333,
  visible = true,
}) => {
  if (!visible || !faceData || !faceData.faces || faceData.faces.length === 0) {
    return null;
  }

  const primaryFace = faceData.faces[0];
  const primaryEyeY = primaryFace
    ? imgY + ((primaryFace.landmarks.leftEye[1] + primaryFace.landmarks.rightEye[1]) / 2) * imgH
    : frameH * eyeLineRatio;

  const lineStartX = Math.min(0, imgX);
  const lineEndX = Math.max(frameW, imgX + imgW);

  return (
    <Group listening={false}>
      {/* Eye-Line Horizon Across Frame */}
      <Line
        points={[lineStartX, primaryEyeY, lineEndX, primaryEyeY]}
        stroke="#38bdf8"
        strokeWidth={1}
        dash={[4, 4]}
        opacity={0.85}
        listening={false}
      />
      <Text
        x={lineStartX + 6}
        y={primaryEyeY - 13}
        text={`[EYE-LINE: ${(eyeLineRatio * 100).toFixed(1)}%]`}
        fill="#38bdf8"
        fontSize={9}
        fontFamily="monospace"
        listening={false}
      />

      {/* Face Bounding Box Brackets & Landmarks */}
      {faceData.faces.map((face, faceIdx) => {
        const fx = imgX + face.bboxX * imgW;
        const fy = imgY + face.bboxY * imgH;
        const fw = face.bboxWidth * imgW;
        const fh = face.bboxHeight * imgH;
        const bLen = Math.max(6, Math.min(16, fw * 0.2, fh * 0.2));

        const leftEyeX = imgX + face.landmarks.leftEye[0] * imgW;
        const leftEyeY = imgY + face.landmarks.leftEye[1] * imgH;
        const rightEyeX = imgX + face.landmarks.rightEye[0] * imgW;
        const rightEyeY = imgY + face.landmarks.rightEye[1] * imgH;
        const noseX = imgX + face.landmarks.noseTip[0] * imgW;
        const noseY = imgY + face.landmarks.noseTip[1] * imgH;
        const mouthLeftX = imgX + face.landmarks.leftMouth[0] * imgW;
        const mouthLeftY = imgY + face.landmarks.leftMouth[1] * imgH;
        const mouthRightX = imgX + face.landmarks.rightMouth[0] * imgW;
        const mouthRightY = imgY + face.landmarks.rightMouth[1] * imgH;

        return (
          <Group key={`face-reticle-${faceIdx}`} listening={false}>
            {/* ⌜ Top-Left Bracket */}
            <Line
              points={[fx, fy + bLen, fx, fy, fx + bLen, fy]}
              stroke="#38bdf8"
              strokeWidth={1.5}
              listening={false}
            />
            {/* ⌝ Top-Right Bracket */}
            <Line
              points={[fx + fw - bLen, fy, fx + fw, fy, fx + fw, fy + bLen]}
              stroke="#38bdf8"
              strokeWidth={1.5}
              listening={false}
            />
            {/* ⌞ Bottom-Left Bracket */}
            <Line
              points={[fx, fy + fh - bLen, fx, fy + fh, fx + bLen, fy + fh]}
              stroke="#38bdf8"
              strokeWidth={1.5}
              listening={false}
            />
            {/* ⌟ Bottom-Right Bracket */}
            <Line
              points={[fx + fw - bLen, fy + fh, fx + fw, fy + fh, fx + fw, fy + fh - bLen]}
              stroke="#38bdf8"
              strokeWidth={1.5}
              listening={false}
            />

            {/* Landmark: Left Eye */}
            <Circle
              x={leftEyeX}
              y={leftEyeY}
              radius={2.5}
              stroke="#38bdf8"
              fill="rgba(56, 189, 248, 0.5)"
              strokeWidth={1}
              listening={false}
            />
            {/* Landmark: Right Eye */}
            <Circle
              x={rightEyeX}
              y={rightEyeY}
              radius={2.5}
              stroke="#38bdf8"
              fill="rgba(56, 189, 248, 0.5)"
              strokeWidth={1}
              listening={false}
            />
            {/* Landmark: Nose Tip */}
            <Circle
              x={noseX}
              y={noseY}
              radius={2}
              stroke="#38bdf8"
              fill="#38bdf8"
              strokeWidth={1}
              listening={false}
            />
            {/* Landmark: Mouth Line */}
            <Line
              points={[mouthLeftX, mouthLeftY, mouthRightX, mouthRightY]}
              stroke="#38bdf8"
              strokeWidth={1}
              listening={false}
            />
            {/* Landmark: Mouth Left & Right Dots */}
            <Circle
              x={mouthLeftX}
              y={mouthLeftY}
              radius={1.5}
              fill="#38bdf8"
              listening={false}
            />
            <Circle
              x={mouthRightX}
              y={mouthRightY}
              radius={1.5}
              fill="#38bdf8"
              listening={false}
            />
          </Group>
        );
      })}
    </Group>
  );
};
