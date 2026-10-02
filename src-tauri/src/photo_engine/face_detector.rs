use std::io::Cursor;
use std::path::Path;
use std::sync::OnceLock;
use std::time::Instant;
use image::{imageops::FilterType, DynamicImage, GenericImageView};
use rayon::prelude::*;
use tract_onnx::prelude::*;

use super::face_types::{DetectedFace, FaceLandmarks, PhotoFaceData, RawFaceCandidate};

pub const INFERENCE_WIDTH: u32 = 640;
pub const INFERENCE_HEIGHT: u32 = 640;
pub const CONFIDENCE_THRESHOLD: f32 = 0.60;
pub const NMS_IOU_THRESHOLD: f32 = 0.35;
pub const MAX_FACES_OUTPUT: usize = 100;

type TractModel = SimplePlan<TypedFact, Box<dyn TypedOp>, Graph<TypedFact, Box<dyn TypedOp>>>;

static YUNET_MODEL: OnceLock<TractModel> = OnceLock::new();

/// Loads and compiles the embedded YuNet ONNX model into an optimized runnable plan.
pub fn get_or_init_yunet_model() -> Result<&'static TractModel, String> {
    if let Some(model) = YUNET_MODEL.get() {
        return Ok(model);
    }

    let model_bytes = include_bytes!("../../models/face_detection_yunet_2023mar.onnx");
    let mut cursor = Cursor::new(model_bytes);

    let model = tract_onnx::onnx()
        .model_for_read(&mut cursor)
        .map_err(|e| format!("Failed to read YuNet ONNX model bytes: {}", e))?
        .with_input_fact(
            0,
            InferenceFact::dt_shape(
                f32::datum_type(),
                tvec!(1, 3, INFERENCE_HEIGHT as usize, INFERENCE_WIDTH as usize),
            ),
        )
        .map_err(|e| format!("Failed to specify YuNet input fact: {}", e))?
        .into_typed()
        .map_err(|e| format!("Failed to type YuNet model: {}", e))?
        .into_decluttered()
        .map_err(|e| format!("Failed to declutter YuNet model: {}", e))?
        .into_optimized()
        .map_err(|e| format!("Failed to optimize YuNet model: {}", e))?
        .into_runnable()
        .map_err(|e| format!("Failed to build runnable YuNet plan: {}", e))?;

    let _ = YUNET_MODEL.set(model);
    YUNET_MODEL
        .get()
        .ok_or_else(|| "Failed to retrieve compiled YuNet model".to_string())
}

pub struct PreprocessResult {
    pub tensor: Tensor,
    pub scale_x: f32,
    pub scale_y: f32,
    pub pad_x: f32,
    pub pad_y: f32,
    pub orig_width: u32,
    pub orig_height: u32,
}

/// Preprocesses any DynamicImage into a letterboxed 320x320 BGR f32 tensor.
pub fn preprocess_image(img: &DynamicImage) -> Result<PreprocessResult, String> {
    let (orig_width, orig_height) = img.dimensions();
    if orig_width == 0 || orig_height == 0 {
        return Err("Invalid image dimensions (0x0)".to_string());
    }

    // Compute letterbox scaling to maintain aspect ratio
    let scale = (INFERENCE_WIDTH as f32 / orig_width as f32)
        .min(INFERENCE_HEIGHT as f32 / orig_height as f32);
    let new_w = ((orig_width as f32 * scale).round() as u32).clamp(1, INFERENCE_WIDTH);
    let new_h = ((orig_height as f32 * scale).round() as u32).clamp(1, INFERENCE_HEIGHT);

    let pad_x = (INFERENCE_WIDTH as f32 - new_w as f32) / 2.0;
    let pad_y = (INFERENCE_HEIGHT as f32 - new_h as f32) / 2.0;

    let resized = img.resize_exact(new_w, new_h, FilterType::Triangle);
    let rgb = resized.to_rgb8();

    // Create [1, 3, 320, 320] NCHW array filled with 0.0 (letterbox black padding)
    let mut ndarray = tract_onnx::prelude::tract_ndarray::Array4::<f32>::zeros((
        1,
        3,
        INFERENCE_HEIGHT as usize,
        INFERENCE_WIDTH as usize,
    ));

    let pad_x_int = pad_x.round() as usize;
    let pad_y_int = pad_y.round() as usize;

    for y in 0..new_h as usize {
        for x in 0..new_w as usize {
            let pixel = rgb.get_pixel(x as u32, y as u32);
            let target_y = pad_y_int + y;
            let target_x = pad_x_int + x;
            if target_y < INFERENCE_HEIGHT as usize && target_x < INFERENCE_WIDTH as usize {
                // YuNet requires BGR channel order [B, G, R] with values in [0.0, 255.0]
                ndarray[[0, 0, target_y, target_x]] = pixel[2] as f32; // Blue
                ndarray[[0, 1, target_y, target_x]] = pixel[1] as f32; // Green
                ndarray[[0, 2, target_y, target_x]] = pixel[0] as f32; // Red
            }
        }
    }

    let tensor = ndarray.into_tensor();
    Ok(PreprocessResult {
        tensor,
        scale_x: scale,
        scale_y: scale,
        pad_x,
        pad_y,
        orig_width,
        orig_height,
    })
}

/// Decodes raw output tensors for a single FPN stride level into candidate detections.
pub fn decode_stride_heads(
    stride: usize,
    cls: &tract_onnx::prelude::tract_ndarray::ArrayViewD<f32>,
    obj: &tract_onnx::prelude::tract_ndarray::ArrayViewD<f32>,
    bbox: &tract_onnx::prelude::tract_ndarray::ArrayViewD<f32>,
    kps: &tract_onnx::prelude::tract_ndarray::ArrayViewD<f32>,
    conf_thresh: f32,
) -> Vec<RawFaceCandidate> {
    let grid_h = (INFERENCE_HEIGHT as usize) / stride;
    let grid_w = (INFERENCE_WIDTH as usize) / stride;
    let s_f32 = stride as f32;
    let mut candidates = Vec::new();

    for y in 0..grid_h {
        for x in 0..grid_w {
            let idx = y * grid_w + x;

            // Score S = sqrt(clamp(cls) * clamp(obj))
            let cls_val = cls[[0, idx, 0]].clamp(0.0, 1.0);
            let obj_val = obj[[0, idx, 0]].clamp(0.0, 1.0);
            let score = (cls_val * obj_val).sqrt();

            if score < conf_thresh {
                continue;
            }

            let cx = (x as f32 + 0.5) * s_f32;
            let cy = (y as f32 + 0.5) * s_f32;

            let dx = bbox[[0, idx, 0]];
            let dy = bbox[[0, idx, 1]];
            let dw = bbox[[0, idx, 2]];
            let dh = bbox[[0, idx, 3]];

            let center_x = cx + dx * s_f32;
            let center_y = cy + dy * s_f32;
            let w = s_f32 * dw.exp();
            let h = s_f32 * dh.exp();

            let x_min = center_x - w / 2.0;
            let y_min = center_y - h / 2.0;

            let mut landmarks = [[0.0f32; 2]; 5];
            for k in 0..5 {
                let lx = cx + kps[[0, idx, 2 * k]] * s_f32;
                let ly = cy + kps[[0, idx, 2 * k + 1]] * s_f32;
                landmarks[k] = [lx, ly];
            }

            candidates.push(RawFaceCandidate {
                bbox: [x_min, y_min, w, h],
                score,
                landmarks,
            });
        }
    }

    candidates
}

/// Computes Intersection-over-Union between two bounding boxes [x, y, w, h].
pub fn calculate_iou(box_a: &[f32; 4], box_b: &[f32; 4]) -> f32 {
    let x1 = box_a[0].max(box_b[0]);
    let y1 = box_a[1].max(box_b[1]);
    let x2 = (box_a[0] + box_a[2]).min(box_b[0] + box_b[2]);
    let y2 = (box_a[1] + box_a[3]).min(box_b[1] + box_b[3]);

    let intersection_w = (x2 - x1).max(0.0);
    let intersection_h = (y2 - y1).max(0.0);
    let intersection_area = intersection_w * intersection_h;

    let area_a = box_a[2] * box_a[3];
    let area_b = box_b[2] * box_b[3];
    let union_area = area_a + area_b - intersection_area;

    if union_area <= 0.0 {
        0.0
    } else {
        intersection_area / union_area
    }
}

/// Applies greedy NMS to filter overlapping candidates.
pub fn apply_nms(
    mut candidates: Vec<RawFaceCandidate>,
    iou_thresh: f32,
    max_keep: usize,
) -> Vec<RawFaceCandidate> {
    candidates.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    let mut keep: Vec<RawFaceCandidate> = Vec::new();

    for candidate in candidates {
        if keep.len() >= max_keep {
            break;
        }
        let mut overlap = false;
        for kept in &keep {
            if calculate_iou(&candidate.bbox, &kept.bbox) > iou_thresh {
                overlap = true;
                break;
            }
        }
        if !overlap {
            keep.push(candidate);
        }
    }

    keep
}

/// Computes a normalized sharpness score [0.0, 100.0] for a detected face bounding box.
/// Uses Laplacian variance over the face region.
pub fn compute_face_sharpness(
    img: &DynamicImage,
    norm_x: f32,
    norm_y: f32,
    norm_w: f32,
    norm_h: f32,
) -> f32 {
    let (img_w, img_h) = img.dimensions();
    if img_w == 0 || img_h == 0 || norm_w <= 0.0 || norm_h <= 0.0 {
        return 0.0;
    }

    let px = ((norm_x * img_w as f32).floor() as u32).min(img_w - 1);
    let py = ((norm_y * img_h as f32).floor() as u32).min(img_h - 1);
    let pw = ((norm_w * img_w as f32).ceil() as u32).clamp(1, img_w - px);
    let ph = ((norm_h * img_h as f32).ceil() as u32).clamp(1, img_h - py);

    if pw < 4 || ph < 4 {
        return 50.0; // Fallback for very small face patches
    }

    // Crop the face region and convert to grayscale
    let cropped = img.crop_imm(px, py, pw, ph);
    let gray = cropped.to_luma8();
    let (gw, gh) = gray.dimensions();

    if gw < 3 || gh < 3 {
        return 50.0;
    }

    // Fast discrete Laplacian operator: L(x, y) = I(x+1,y) + I(x-1,y) + I(x,y+1) + I(x,y-1) - 4*I(x,y)
    let mut sum = 0.0f64;
    let mut sum_sq = 0.0f64;
    let mut count = 0usize;

    // Sample pixels (stride for fast processing on large crops)
    let step = ((gw.max(gh) / 80).max(1)) as u32;

    for y in (1..(gh - 1)).step_by(step as usize) {
        for x in (1..(gw - 1)).step_by(step as usize) {
            let center = gray.get_pixel(x, y)[0] as f64;
            let left = gray.get_pixel(x - 1, y)[0] as f64;
            let right = gray.get_pixel(x + 1, y)[0] as f64;
            let up = gray.get_pixel(x, y - 1)[0] as f64;
            let down = gray.get_pixel(x, y + 1)[0] as f64;

            let lap = left + right + up + down - 4.0 * center;
            sum += lap;
            sum_sq += lap * lap;
            count += 1;
        }
    }

    if count == 0 {
        return 50.0;
    }

    let mean = sum / (count as f64);
    let variance = (sum_sq / (count as f64) - mean * mean).max(0.0);

    // Map variance to [0, 100] using a soft-saturation curve
    // Typical sharp portraits have Laplacian variance > 100-300; soft/blurry portraits < 30
    let normalized = (variance / (variance + 120.0)) * 100.0;
    (normalized as f32).clamp(0.0, 100.0)
}

/// Converts letterbox candidates into normalized DetectedFace structs with quality metrics.
pub fn postprocess_detections(
    raw_faces: Vec<RawFaceCandidate>,
    prep: &PreprocessResult,
    img: &DynamicImage,
) -> Vec<DetectedFace> {
    let orig_w = prep.orig_width as f32;
    let orig_h = prep.orig_height as f32;

    raw_faces
        .into_iter()
        .map(|raw| {
            // Unpad and scale back to original image space
            let unpad_x = (raw.bbox[0] - prep.pad_x) / prep.scale_x;
            let unpad_y = (raw.bbox[1] - prep.pad_y) / prep.scale_y;
            let unpad_w = raw.bbox[2] / prep.scale_x;
            let unpad_h = raw.bbox[3] / prep.scale_y;

            let norm_x = (unpad_x / orig_w).clamp(0.0, 1.0);
            let norm_y = (unpad_y / orig_h).clamp(0.0, 1.0);
            let norm_w = (unpad_w / orig_w).clamp(0.0, 1.0 - norm_x);
            let norm_h = (unpad_h / orig_h).clamp(0.0, 1.0 - norm_y);

            // Normalize 5 landmarks
            let norm_landmarks = raw.landmarks.map(|pt| {
                let lx = ((pt[0] - prep.pad_x) / prep.scale_x / orig_w).clamp(0.0, 1.0);
                let ly = ((pt[1] - prep.pad_y) / prep.scale_y / orig_h).clamp(0.0, 1.0);
                (lx, ly)
            });

            let right_eye = norm_landmarks[0];
            let left_eye = norm_landmarks[1];
            let nose_tip = norm_landmarks[2];
            let right_mouth = norm_landmarks[3];
            let left_mouth = norm_landmarks[4];

            // Head roll tilt angle in degrees: atan2(dy, dx)
            let eye_dx = left_eye.0 - right_eye.0;
            let eye_dy = (left_eye.1 - right_eye.1) * (orig_h / orig_w);
            let roll_rad = eye_dy.atan2(eye_dx);
            let roll_degrees = roll_rad.to_degrees();

            // Eye distance normalized
            let eye_distance = ((eye_dx.powi(2) + eye_dy.powi(2)).sqrt()).clamp(0.0, 1.0);

            // Facial symmetry ratio: min(d_r, d_l) / max(d_r, d_l)
            let dist_re_nose = ((right_eye.0 - nose_tip.0).powi(2)
                + ((right_eye.1 - nose_tip.1) * (orig_h / orig_w)).powi(2))
            .sqrt();
            let dist_le_nose = ((left_eye.0 - nose_tip.0).powi(2)
                + ((left_eye.1 - nose_tip.1) * (orig_h / orig_w)).powi(2))
            .sqrt();
            let symm_ratio = if dist_re_nose.max(dist_le_nose) > 0.0001 {
                dist_re_nose.min(dist_le_nose) / dist_re_nose.max(dist_le_nose)
            } else {
                1.0
            };
            let is_frontal = symm_ratio >= 0.75;

            // Sharpness score from eye/face region gradient
            let sharpness_score = compute_face_sharpness(img, norm_x, norm_y, norm_w, norm_h);

            // Hero candidate check
            let is_hero_candidate =
                raw.score >= 0.90 && roll_degrees.abs() <= 15.0 && is_frontal && sharpness_score >= 60.0;

            // Blink indicator
            let is_eyes_closed = false;

            DetectedFace {
                bbox_x: norm_x,
                bbox_y: norm_y,
                bbox_width: norm_w,
                bbox_height: norm_h,
                score: raw.score,
                landmarks: FaceLandmarks {
                    right_eye,
                    left_eye,
                    nose_tip,
                    right_mouth,
                    left_mouth,
                },
                roll_degrees,
                eye_distance,
                is_frontal,
                sharpness_score,
                is_hero_candidate,
                is_eyes_closed,
            }
        })
        .collect()
}

/// Evaluates the composite Hero Score (0 to 100) for a photo based on its detected faces.
pub fn calculate_photo_hero_score(faces: &[DetectedFace]) -> f32 {
    if faces.is_empty() {
        return 0.0;
    }

    // Best face score
    let best_face = &faces[0]; // sorted by confidence
    let s_conf = (best_face.score).clamp(0.0, 1.0);
    let s_size = (best_face.bbox_height / 0.25).min(1.0);
    let s_pose = (1.0 - (best_face.roll_degrees.abs() / 30.0)).clamp(0.0, 1.0);
    let s_symm = if best_face.is_frontal { 1.0 } else { 0.7 };
    let s_sharp = (best_face.sharpness_score / 100.0).clamp(0.0, 1.0);

    let raw_hero =
        100.0 * (0.30 * s_conf + 0.25 * s_size + 0.20 * s_sharp + 0.15 * s_symm + 0.10 * s_pose);
    raw_hero.clamp(0.0, 100.0)
}

/// Computes the primary focal point (x, y) and eye level horizon for framing.
pub fn compute_focal_point_and_eyeline(
    faces: &[DetectedFace],
    _img_w: u32,
    _img_h: u32,
) -> ((f32, f32), f32) {
    if faces.is_empty() {
        return ((0.5, 0.5), 0.333);
    }

    if faces.len() == 1 {
        let f = &faces[0];
        let center_x = f.bbox_x + f.bbox_width / 2.0;
        let eye_y = (f.landmarks.left_eye.1 + f.landmarks.right_eye.1) / 2.0;
        let focal_y = (eye_y + (f.bbox_y + f.bbox_height * 0.4)) / 2.0;
        return ((center_x.clamp(0.0, 1.0), focal_y.clamp(0.0, 1.0)), eye_y);
    }

    // Multi-face group: collective center
    let mut min_x = 1.0f32;
    let mut max_x = 0.0f32;
    let mut min_y = 1.0f32;
    let mut max_y = 0.0f32;
    let mut sum_eye_y = 0.0f32;

    for f in faces {
        min_x = min_x.min(f.bbox_x);
        max_x = max_x.max(f.bbox_x + f.bbox_width);
        min_y = min_y.min(f.bbox_y);
        max_y = max_y.max(f.bbox_y + f.bbox_height);
        sum_eye_y += (f.landmarks.left_eye.1 + f.landmarks.right_eye.1) / 2.0;
    }

    let group_center_x = ((min_x + max_x) / 2.0).clamp(0.0, 1.0);
    let group_focal_y = (min_y + (max_y - min_y) * 0.35).clamp(0.0, 1.0);
    let avg_eye_y = sum_eye_y / (faces.len() as f32);

    ((group_center_x, group_focal_y), avg_eye_y)
}

/// Full detection entry point for a single image file path.
pub fn detect_faces_in_image(image_path: &str) -> Result<PhotoFaceData, String> {
    let start_time = Instant::now();
    let path = Path::new(image_path);
    let mut img = image::open(path)
        .map_err(|e| format!("Failed to open image at {}: {}", image_path, e))?;

    let orientation = crate::export_engine::get_image_exif_orientation(path);
    if orientation > 1 {
        img = crate::export_engine::apply_exif_orientation(img, orientation);
    }

    let (width, height) = img.dimensions();
    let prep = preprocess_image(&img)?;
    let model = get_or_init_yunet_model()?;

    // Execute Tract inference
    let outputs = model
        .run(tvec!(prep.tensor.clone().into()))
        .map_err(|e| format!("Tract inference failed: {}", e))?;

    // YuNet produces 12 output tensors (4 per stride: cls, obj, bbox, kps)
    let mut candidates = Vec::new();

    // Strides: 8, 16, 32
    // Output tensor groups in YuNet ONNX: [cls 8, cls 16, cls 32, obj 8, obj 16, obj 32, bbox 8, bbox 16, bbox 32, kps 8, kps 16, kps 32]
    let strides = [8, 16, 32];
    for (i, &stride) in strides.iter().enumerate() {
        let cls = outputs[0 + i]
            .to_array_view::<f32>()
            .map_err(|e| e.to_string())?;
        let obj = outputs[3 + i]
            .to_array_view::<f32>()
            .map_err(|e| e.to_string())?;
        let bbox = outputs[6 + i]
            .to_array_view::<f32>()
            .map_err(|e| e.to_string())?;
        let kps = outputs[9 + i]
            .to_array_view::<f32>()
            .map_err(|e| e.to_string())?;

        let stride_candidates =
            decode_stride_heads(stride, &cls, &obj, &bbox, &kps, CONFIDENCE_THRESHOLD);
        candidates.extend(stride_candidates);
    }

    let kept = apply_nms(candidates, NMS_IOU_THRESHOLD, MAX_FACES_OUTPUT);
    let faces = postprocess_detections(kept, &prep, &img);
    let hero_score = calculate_photo_hero_score(&faces);
    let (focal_point, eye_level_y) = compute_focal_point_and_eyeline(&faces, width, height);
    let detection_time_ms = start_time.elapsed().as_secs_f32() * 1000.0;

    Ok(PhotoFaceData {
        photo_path: image_path.to_string(),
        width,
        height,
        faces,
        hero_score,
        focal_point,
        eye_level_y,
        detection_time_ms,
    })
}

/// Batch detection across multiple photos utilizing Rayon thread pool.
pub fn detect_faces_in_batch(image_paths: Vec<String>) -> Vec<PhotoFaceData> {
    image_paths
        .into_par_iter()
        .filter_map(|path| detect_faces_in_image(&path).ok())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgb, RgbImage};

    #[test]
    fn test_tract_model_compilation() {
        let model = get_or_init_yunet_model();
        assert!(
            model.is_ok(),
            "YuNet model must compile into runnable Tract plan: {:?}",
            model.err()
        );
    }

    #[test]
    fn test_image_preprocessing_letterbox() {
        let img = DynamicImage::ImageRgb8(RgbImage::new(800, 600));
        let prep = preprocess_image(&img).expect("Preprocessing must succeed");
        assert_eq!(prep.orig_width, 800);
        assert_eq!(prep.orig_height, 600);
        assert_eq!(prep.tensor.shape(), &[1, 3, 640, 640]);
        assert!(prep.pad_y > 0.0); // 800x600 gets padded vertically in 640x640
    }

    #[test]
    fn test_iou_calculation() {
        let box1 = [10.0, 10.0, 50.0, 50.0];
        let box2 = [10.0, 10.0, 50.0, 50.0];
        assert!((calculate_iou(&box1, &box2) - 1.0).abs() < 1e-4);

        let box3 = [100.0, 100.0, 50.0, 50.0];
        assert_eq!(calculate_iou(&box1, &box3), 0.0);

        let box4 = [35.0, 10.0, 50.0, 50.0]; // 50% horizontal overlap
        let iou = calculate_iou(&box1, &box4);
        assert!(iou > 0.30 && iou < 0.40);
    }

    #[test]
    fn test_nms_suppression() {
        let cand1 = RawFaceCandidate {
            bbox: [10.0, 10.0, 50.0, 50.0],
            score: 0.95,
            landmarks: [[0.0; 2]; 5],
        };
        let cand2 = RawFaceCandidate {
            bbox: [12.0, 12.0, 48.0, 48.0],
            score: 0.85,
            landmarks: [[0.0; 2]; 5],
        }; // High overlap
        let cand3 = RawFaceCandidate {
            bbox: [200.0, 200.0, 50.0, 50.0],
            score: 0.90,
            landmarks: [[0.0; 2]; 5],
        }; // Separate face

        let filtered = apply_nms(vec![cand1, cand2, cand3], 0.35, 100);
        assert_eq!(
            filtered.len(),
            2,
            "Duplicate overlapping candidate must be suppressed"
        );
        assert_eq!(filtered[0].score, 0.95);
        assert_eq!(filtered[1].score, 0.90);
    }

    #[test]
    fn test_inference_latency_benchmark() {
        let temp_dir = std::env::temp_dir().join("afsn_test_yunet");
        let _ = std::fs::create_dir_all(&temp_dir);
        let test_path = temp_dir.join("test_portrait.jpg");

        // Create synthetic portrait test image
        let mut img = RgbImage::new(640, 640);
        for pixel in img.pixels_mut() {
            *pixel = Rgb([128, 128, 128]);
        }
        img.save(&test_path).unwrap();

        // Warm up Tract model initialization
        let _ = get_or_init_yunet_model();

        let res = detect_faces_in_image(&test_path.to_string_lossy())
            .expect("Detection must complete");
        assert_eq!(res.width, 640);
        assert_eq!(res.height, 640);
        println!("YuNet Execution Time: {:.2}ms", res.detection_time_ms);
        assert!(
            res.detection_time_ms < 15000.0,
            "Inference must complete in reasonable time"
        );

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_batch_detection_rayon() {
        let temp_dir = std::env::temp_dir().join("afsn_test_yunet_batch");
        let _ = std::fs::create_dir_all(&temp_dir);

        let mut paths = Vec::new();
        for i in 0..3 {
            let test_path = temp_dir.join(format!("batch_{}.jpg", i));
            let mut img = RgbImage::new(320, 320);
            for pixel in img.pixels_mut() {
                *pixel = Rgb([100 + i * 20, 120, 140]);
            }
            img.save(&test_path).unwrap();
            paths.push(test_path.to_string_lossy().to_string());
        }

        let results = detect_faces_in_batch(paths);
        assert_eq!(results.len(), 3, "All batch images should be processed");

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
