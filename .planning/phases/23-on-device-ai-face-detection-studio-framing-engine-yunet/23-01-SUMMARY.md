# Plan Summary: 23-01 — Rust On-Device YuNet Face Detection Engine & Tauri IPC Commands

**Phase:** Phase 23 — On-Device AI Face Detection & Studio Framing Engine (YuNet)  
**Milestone:** v1.4.0 (Workflow & Canvas Precision Suite)  
**Status:** Completed  

---

## Executive Summary

Plan 23-01 delivered a 100% offline, ultra-fast on-device AI Face and 5-Landmark Detection Engine natively compiled in the Tauri Rust backend. Powered by the official OpenCV YuNet ONNX model embedded directly into the binary and executed via `tract-onnx` (pure Rust, zero external dynamic C++ dependencies), the engine performs multi-stride anchor generation, bounding box decoding, 5 facial landmark localization (eyes, nose, mouth corners), Greedy IoU Non-Maximum Suppression (NMS), facial symmetry and head roll angle computation, and composite Hero Quality Scoring ($0-100$).

---

## Delivered Key Changes

1. **Model Embedding & Rust Dependencies (`src-tauri/Cargo.toml` & `models/`)**:
   - Added `tract-onnx = "0.21.8"` and `ndarray = "0.15"` for pure static compilation.
   - Embedded `face_detection_yunet_2023mar.onnx` (~232 KB) binary with static OnceLock initialization.

2. **Data Models (`src-tauri/src/photo_engine/face_types.rs`)**:
   - `FaceLandmarks` (normalized coordinates for right eye, left eye, nose tip, right mouth, left mouth).
   - `DetectedFace` (normalized bounding box, confidence score, 5 landmarks, head roll degrees, eye distance, symmetry ratio, sharpness metric, hero candidate flag).
   - `PhotoFaceData` (image dimensions, face list, hero quality score, optical focal point, eye-level line, detection latency).

3. **Inference Pipeline & Post-Processing (`src-tauri/src/photo_engine/face_detector.rs`)**:
   - Preprocessing: letterbox scaling to $640 \times 640$ px, BGR float32 tensor conversion.
   - Output parsing: FPN multi-stride decoding across strides 8, 16, 32 for classification, objectness, bounding box regressions, and 5-point landmarks.
   - Postprocessing: Greedy IoU Non-Maximum Suppression (threshold 0.35), unpadding/unscaling back to original photo aspect ratio, Laplacian sharpness estimation, and Rayon multi-threaded batch inference.

4. **Tauri IPC Commands (`src-tauri/src/commands/photo_commands.rs` & `src-tauri/src/lib.rs`)**:
   - `detect_photo_faces(image_path: String) -> Result<PhotoFaceData, String>`
   - `detect_photos_faces_batch(image_paths: Vec<String>) -> Result<Vec<PhotoFaceData>, String>`

5. **Exhaustive Unit Test Suite**:
   - 6 dedicated unit tests covering model compilation, letterbox preprocessing, IoU calculation, NMS deduplication, Rayon batch detection, and latency benchmarks.

---

## Verification

```bash
cargo test --lib --manifest-path src-tauri/Cargo.toml # Passed (60/60 tests)
```
