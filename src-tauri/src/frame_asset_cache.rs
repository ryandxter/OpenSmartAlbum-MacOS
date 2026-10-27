use std::fs;
use std::path::PathBuf;
use image::{DynamicImage, GenericImageView};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FrameSlotPayload {
    #[serde(rename = "slotX")]
    pub slot_x: f64,
    #[serde(rename = "slotY")]
    pub slot_y: f64,
    #[serde(rename = "slotWidth")]
    pub slot_width: f64,
    #[serde(rename = "slotHeight")]
    pub slot_height: f64,
    pub shape: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameAssetMeta {
    pub id: String,
    pub title: String,
    pub category: String, // "frame" | "element"
    pub shape: String,    // "rectangle" | "square" | "oval" | "arch" | "circle"
    pub slot: Option<FrameSlotPayload>,
    pub is_pro: bool,
    pub local_path: String,
    pub thumb_path: String,
    pub remote_url: Option<String>,
    pub tags: Vec<String>,
    pub created_at: Option<String>,
}

pub fn get_frame_assets_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?
        .join("frame_assets");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create frame_assets dir: {}", e))?;
    }
    Ok(dir)
}

/// Detects the central transparent aperture (contentRect) in a decorative frame image.
pub fn detect_transparent_hole_bounds(img: &DynamicImage) -> Option<FrameSlotPayload> {
    let (width, height) = img.dimensions();
    if width < 10 || height < 10 {
        return None;
    }

    let rgba = img.to_rgba8();

    // Focus search in central 85% region
    let min_x_bound = (width as f64 * 0.05) as u32;
    let max_x_bound = (width as f64 * 0.95) as u32;
    let min_y_bound = (height as f64 * 0.05) as u32;
    let max_y_bound = (height as f64 * 0.95) as u32;

    let mut hole_min_x = u32::MAX;
    let mut hole_max_x = 0;
    let mut hole_min_y = u32::MAX;
    let mut hole_max_y = 0;
    let mut transparent_count = 0;

    for y in min_y_bound..max_y_bound {
        for x in min_x_bound..max_x_bound {
            let pixel = rgba.get_pixel(x, y);
            // Alpha threshold for transparency (< 32 out of 255)
            if pixel[3] < 32 {
                transparent_count += 1;
                if x < hole_min_x { hole_min_x = x; }
                if x > hole_max_x { hole_max_x = x; }
                if y < hole_min_y { hole_min_y = y; }
                if y > hole_max_y { hole_max_y = y; }
            }
        }
    }

    let total_scanned = (max_x_bound - min_x_bound) * (max_y_bound - min_y_bound);
    if transparent_count >= total_scanned / 25 && hole_min_x < hole_max_x && hole_min_y < hole_max_y {
        let slot_x = hole_min_x as f64 / width as f64;
        let slot_y = hole_min_y as f64 / height as f64;
        let slot_width = (hole_max_x - hole_min_x) as f64 / width as f64;
        let slot_height = (hole_max_y - hole_min_y) as f64 / height as f64;

        Some(FrameSlotPayload {
            slot_x: (slot_x * 1000.0).round() / 1000.0,
            slot_y: (slot_y * 1000.0).round() / 1000.0,
            slot_width: (slot_width * 1000.0).round() / 1000.0,
            slot_height: (slot_height * 1000.0).round() / 1000.0,
            shape: Some("rectangle".to_string()),
        })
    } else {
        Some(FrameSlotPayload {
            slot_x: 0.1,
            slot_y: 0.1,
            slot_width: 0.8,
            slot_height: 0.8,
            shape: Some("rectangle".to_string()),
        })
    }
}

/// Saves an image buffer to `<appDataDir>/frame_assets/<id>/` along with a 256x256 thumbnail and metadata.
pub fn save_frame_asset_to_cache(
    app_handle: &AppHandle,
    id: &str,
    img: &DynamicImage,
    mut meta: FrameAssetMeta,
) -> Result<FrameAssetMeta, String> {
    let base_dir = get_frame_assets_dir(app_handle)?;
    let asset_dir = base_dir.join(id);
    fs::create_dir_all(&asset_dir).map_err(|e| e.to_string())?;

    let asset_path = asset_dir.join("asset.png");
    let thumb_path = asset_dir.join("thumb.png");
    let meta_path = asset_dir.join("meta.json");

    // Save full-res asset
    img.save_with_format(&asset_path, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to save asset image: {}", e))?;

    // Create 256x256 thumbnail
    let thumb = img.resize(256, 256, image::imageops::FilterType::Lanczos3);
    thumb.save_with_format(&thumb_path, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to save thumb image: {}", e))?;

    // Normalize is_pro to false for OpenSmartAlbum
    meta.is_pro = false;
    meta.local_path = asset_path.to_string_lossy().to_string();
    meta.thumb_path = thumb_path.to_string_lossy().to_string();

    let json = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
    fs::write(&meta_path, json).map_err(|e| e.to_string())?;

    Ok(meta)
}

/// Discovers the location of bundled starter assets on disk or in the app bundle.
pub fn find_bundled_assets_dir(app_handle: &AppHandle) -> Option<PathBuf> {
    // 1. Check Tauri resource directory
    if let Ok(res_dir) = app_handle.path().resource_dir() {
        let p1 = res_dir.join("resources").join("assets").join("bundled");
        if p1.exists() { return Some(p1); }
        let p2 = res_dir.join("assets").join("bundled");
        if p2.exists() { return Some(p2); }
    }
    // 2. Check current working directory / development paths
    let dev_candidates = [
        PathBuf::from("src-tauri/resources/assets/bundled"),
        PathBuf::from("resources/assets/bundled"),
        PathBuf::from("../src-tauri/resources/assets/bundled"),
    ];
    for p in &dev_candidates {
        if p.exists() {
            return Some(p.clone());
        }
    }
    None
}

/// Seeds bundled starter frames and graphic elements into the user's application support directory.
pub fn seed_bundled_assets_if_needed(app_handle: &AppHandle) {
    let Ok(dest_base) = get_frame_assets_dir(app_handle) else { return; };
    let Some(src_base) = find_bundled_assets_dir(app_handle) else { return; };

    let Ok(entries) = fs::read_dir(src_base) else { return; };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let folder_name = entry.file_name();
            let dest_dir = dest_base.join(&folder_name);
            let dest_asset = dest_dir.join("asset.png");
            let dest_thumb = dest_dir.join("thumb.png");
            let dest_meta = dest_dir.join("meta.json");

            if !dest_asset.exists() || !dest_meta.exists() {
                let _ = fs::create_dir_all(&dest_dir);
                let src_asset = path.join("asset.png");
                let src_thumb = path.join("thumb.png");
                let src_meta = path.join("meta.json");

                if src_asset.exists() {
                    let _ = fs::copy(&src_asset, &dest_asset);
                }
                if src_thumb.exists() {
                    let _ = fs::copy(&src_thumb, &dest_thumb);
                }
                if src_meta.exists() {
                    if let Ok(content) = fs::read_to_string(&src_meta) {
                        if let Ok(mut meta) = serde_json::from_str::<FrameAssetMeta>(&content) {
                            meta.is_pro = false;
                            meta.local_path = dest_asset.to_string_lossy().to_string();
                            meta.thumb_path = dest_thumb.to_string_lossy().to_string();
                            if let Ok(json) = serde_json::to_string_pretty(&meta) {
                                let _ = fs::write(&dest_meta, json);
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Lists all cached assets from the disk cache.
pub fn list_cached_frame_assets(app_handle: &AppHandle) -> Result<Vec<FrameAssetMeta>, String> {
    seed_bundled_assets_if_needed(app_handle);
    let base_dir = get_frame_assets_dir(app_handle)?;
    let mut assets = Vec::new();

    if let Ok(entries) = fs::read_dir(base_dir) {
        for entry in entries.flatten() {
            let meta_path = entry.path().join("meta.json");
            if meta_path.exists() {
                if let Ok(content) = fs::read_to_string(&meta_path) {
                    if let Ok(mut meta) = serde_json::from_str::<FrameAssetMeta>(&content) {
                        meta.is_pro = false;
                        let asset_file = entry.path().join("asset.png");
                        if asset_file.exists() {
                            meta.local_path = asset_file.to_string_lossy().to_string();
                        }
                        let thumb_file = entry.path().join("thumb.png");
                        if thumb_file.exists() {
                            meta.thumb_path = thumb_file.to_string_lossy().to_string();
                        }
                        assets.push(meta);
                    }
                }
            }
        }
    }

    // Sort by title
    assets.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    Ok(assets)
}

/// Deletes an asset from the disk cache.
pub fn delete_cached_frame_asset(app_handle: &AppHandle, id: &str) -> Result<(), String> {
    let base_dir = get_frame_assets_dir(app_handle)?;
    let asset_dir = base_dir.join(id);
    if asset_dir.exists() {
        fs::remove_dir_all(asset_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameAssetCacheStats {
    pub file_count: usize,
    pub total_bytes: u64,
}

pub fn get_frame_assets_storage_stats(app_handle: &AppHandle) -> Result<FrameAssetCacheStats, String> {
    let base_dir = get_frame_assets_dir(app_handle)?;
    let mut stats = FrameAssetCacheStats::default();

    if base_dir.exists() {
        if let Ok(entries) = fs::read_dir(&base_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if let Ok(sub_entries) = fs::read_dir(&path) {
                        for sub in sub_entries.flatten() {
                            if let Ok(meta) = sub.metadata() {
                                if meta.is_file() {
                                    stats.file_count += 1;
                                    stats.total_bytes += meta.len();
                                }
                            }
                        }
                    }
                } else if path.is_file() {
                    if let Ok(meta) = entry.metadata() {
                        stats.file_count += 1;
                        stats.total_bytes += meta.len();
                    }
                }
            }
        }
    }

    Ok(stats)
}

pub fn clear_frame_assets_cache(app_handle: &AppHandle) -> Result<(), String> {
    let base_dir = get_frame_assets_dir(app_handle)?;
    if base_dir.exists() {
        if let Ok(entries) = fs::read_dir(&base_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let _ = fs::remove_dir_all(path);
                } else if path.is_file() {
                    let _ = fs::remove_file(path);
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{RgbaImage, Rgba};

    #[test]
    fn test_detect_transparent_hole_bounds() {
        let mut img = RgbaImage::new(100, 100);
        // Fill borders with opaque white
        for y in 0..100 {
            for x in 0..100 {
                img.put_pixel(x, y, Rgba([255, 255, 255, 255]));
            }
        }
        // Make central 20..80 transparent (alpha = 0)
        for y in 20..80 {
            for x in 20..80 {
                img.put_pixel(x, y, Rgba([0, 0, 0, 0]));
            }
        }

        let dynamic = DynamicImage::ImageRgba8(img);
        let slot = detect_transparent_hole_bounds(&dynamic).expect("Expected slot detected");

        assert!((slot.slot_x - 0.2).abs() < 0.05);
        assert!((slot.slot_y - 0.2).abs() < 0.05);
        assert!((slot.slot_width - 0.6).abs() < 0.05);
        assert!((slot.slot_height - 0.6).abs() < 0.05);
    }
}
