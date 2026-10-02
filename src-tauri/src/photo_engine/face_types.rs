use serde::{Deserialize, Serialize};

/// 5-point normalized facial landmarks relative to original image dimensions [0.0, 1.0].
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FaceLandmarks {
    pub right_eye: (f32, f32),    // Subject's right eye (viewer's left)
    pub left_eye: (f32, f32),     // Subject's left eye (viewer's right)
    pub nose_tip: (f32, f32),     // Nose apex
    pub right_mouth: (f32, f32),  // Subject's right mouth corner
    pub left_mouth: (f32, f32),   // Subject's left mouth corner
}

/// Single detected human face bounding box and telemetry.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedFace {
    pub bbox_x: f32,              // Normalized top-left X [0.0, 1.0]
    pub bbox_y: f32,              // Normalized top-left Y [0.0, 1.0]
    pub bbox_width: f32,          // Normalized width [0.0, 1.0]
    pub bbox_height: f32,         // Normalized height [0.0, 1.0]
    pub score: f32,               // YuNet composite confidence score [0.0, 1.0]
    pub landmarks: FaceLandmarks,
    pub roll_degrees: f32,        // Head tilt roll angle in degrees (-180.0 to 180.0)
    pub eye_distance: f32,        // Normalized inter-pupillary distance [0.0, 1.0]
    pub is_frontal: bool,         // True if facial symmetry ratio >= 0.75
    pub sharpness_score: f32,     // High-frequency gradient clarity metric [0.0, 100.0]
    pub is_hero_candidate: bool,  // True if score >= 0.90, upright pose, and sharp
    pub is_eyes_closed: bool,     // Blink indicator based on eye/mouth proportions
}

/// Full analysis payload for an analyzed photo.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhotoFaceData {
    pub photo_path: String,
    pub width: u32,
    pub height: u32,
    pub faces: Vec<DetectedFace>,
    pub hero_score: f32,          // Aggregate quality rating [0.0, 100.0]
    pub focal_point: (f32, f32),  // Primary focal center (x, y) normalized [0.0, 1.0]
    pub eye_level_y: f32,         // Primary eye level horizontal horizon [0.0, 1.0]
    pub detection_time_ms: f32,   // Inference + post-processing duration in milliseconds
}

/// Raw anchor candidate decoded before NMS.
#[derive(Debug, Clone)]
pub struct RawFaceCandidate {
    pub bbox: [f32; 4],           // [x_min, y_min, width, height] in 320x320 letterbox pixels
    pub score: f32,
    pub landmarks: [[f32; 2]; 5], // 5 landmarks in letterbox pixels
}
