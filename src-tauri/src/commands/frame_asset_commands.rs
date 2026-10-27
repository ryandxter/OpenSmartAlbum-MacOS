use crate::frame_asset_cache::{
    self, detect_transparent_hole_bounds, list_cached_frame_assets as list_disk_assets,
    save_frame_asset_to_cache, FrameAssetCacheStats, FrameAssetMeta, FrameSlotPayload,
};
use image::DynamicImage;
use std::fs;
use std::io::Read;
use std::path::Path;
use std::time::SystemTime;
use tauri::AppHandle;
use uuid::Uuid;

const BUILTIN_CATALOG_JSON: &str = include_str!("../../resources/assets/catalog.json");

/// Decodes standard bitmap formats or rasterizes vector SVGs with subpixel antialiasing.
pub fn decode_or_rasterize_image(bytes: &[u8]) -> Result<DynamicImage, String> {
    let is_svg = bytes.starts_with(b"<svg")
        || bytes.starts_with(b"<?xml")
        || std::str::from_utf8(bytes).map(|s| s.contains("<svg")).unwrap_or(false);

    if is_svg {
        let opt = resvg::usvg::Options::default();
        let rtree = resvg::usvg::Tree::from_data(bytes, &opt)
            .map_err(|e| format!("Failed to parse SVG: {}", e))?;
        let pixmap_size = rtree.size().to_int_size();
        let target_w = (pixmap_size.width() * 2).clamp(512, 2048);
        let target_h = (pixmap_size.height() * 2).clamp(512, 2048);
        let mut pixmap = resvg::tiny_skia::Pixmap::new(target_w, target_h)
            .ok_or("Failed to create pixmap")?;
        let transform = resvg::tiny_skia::Transform::from_scale(
            target_w as f32 / pixmap_size.width() as f32,
            target_h as f32 / pixmap_size.height() as f32,
        );
        resvg::render(&rtree, transform, &mut pixmap.as_mut());
        let png_bytes = pixmap.encode_png().map_err(|e| format!("PNG encode failed: {}", e))?;
        image::load_from_memory(&png_bytes).map_err(|e| format!("Image decode failed: {}", e))
    } else {
        image::load_from_memory(bytes).map_err(|e| format!("Failed to decode image: {}", e))
    }
}

#[tauri::command]
pub async fn list_cached_frame_assets(app: AppHandle) -> Result<Vec<FrameAssetMeta>, String> {
    let mut assets = Vec::new();

    // 1. Load locally cached / imported assets (which automatically seeds bundled assets)
    if let Ok(local_items) = list_disk_assets(&app) {
        for mut item in local_items {
            item.is_pro = false;
            assets.push(item);
        }
    }

    // 2. Load built-in catalog if any item is not yet present on disk
    if let Ok(builtin) = serde_json::from_str::<Vec<FrameAssetMeta>>(BUILTIN_CATALOG_JSON) {
        for mut item in builtin {
            item.is_pro = false;
            if let Some(pos) = assets.iter().position(|a| a.id == item.id) {
                // Ensure local_path is preserved from disk
                if assets[pos].local_path.is_empty() && !item.local_path.is_empty() {
                    assets[pos].local_path = item.local_path;
                }
            } else {
                assets.push(item);
            }
        }
    }

    Ok(assets)
}

#[tauri::command]
pub async fn sync_frame_asset_catalog(
    app: AppHandle,
    catalog_url: Option<String>,
) -> Result<Vec<FrameAssetMeta>, String> {
    let app_clone = app.clone();
    let target_url = catalog_url.unwrap_or_else(|| "https://afsn.afsun.my.id".to_string());

    // 100% Non-blocking, offline-first: attempt network scrape in background thread
    let _ = tauri::async_runtime::spawn_blocking(move || {
        let frames_endpoint = if target_url.contains("/api/") {
            target_url.clone()
        } else {
            format!("{}/api/frames/catalog", target_url.trim_end_matches('/'))
        };

        if let Ok(resp) = ureq::get(&frames_endpoint)
            .timeout(std::time::Duration::from_secs(5))
            .set("User-Agent", "OpenSmartAlbum/1.4.14 (Macintosh; Intel Mac OS X)")
            .set("X-App-Key", "afsn_app_secret_telemetry_key_2026")
            .call()
        {
            if let Ok(json) = serde_json::from_reader::<_, serde_json::Value>(resp.into_reader()) {
                if let Some(frames) = json.get("frames").and_then(|f| f.as_array()) {
                    let Ok(base_dir) = frame_asset_cache::get_frame_assets_dir(&app_clone) else { return; };
                    for f in frames {
                        let id = f.get("id").and_then(|v| v.as_str()).unwrap_or("");
                        let title = f.get("title").and_then(|v| v.as_str()).unwrap_or("Vintage Frame");
                        let shape = f.get("shape").and_then(|v| v.as_str()).unwrap_or("rectangle");
                        let file_url = f.get("fileUrl").and_then(|v| v.as_str()).unwrap_or("");
                        if !id.is_empty() && !file_url.is_empty() {
                            let asset_id = format!("afsn-frame-{}", &id[..id.len().min(8)]);
                            let asset_dir = base_dir.join(&asset_id);
                            let meta_path = asset_dir.join("meta.json");
                            if !meta_path.exists() {
                                let slot_x = f.get("slotX").and_then(|v| v.as_f64()).unwrap_or(10.0) / 100.0;
                                let slot_y = f.get("slotY").and_then(|v| v.as_f64()).unwrap_or(10.0) / 100.0;
                                let slot_w = f.get("slotWidth").and_then(|v| v.as_f64()).unwrap_or(80.0) / 100.0;
                                let slot_h = f.get("slotHeight").and_then(|v| v.as_f64()).unwrap_or(80.0) / 100.0;
                                let meta = FrameAssetMeta {
                                    id: asset_id,
                                    title: format!("Vintage Frame {}", title),
                                    category: "frame".to_string(),
                                    shape: if shape == "rect" { "rectangle".to_string() } else { shape.to_string() },
                                    slot: Some(FrameSlotPayload {
                                        slot_x: (slot_x * 1000.0).round() / 1000.0,
                                        slot_y: (slot_y * 1000.0).round() / 1000.0,
                                        slot_width: (slot_w * 1000.0).round() / 1000.0,
                                        slot_height: (slot_h * 1000.0).round() / 1000.0,
                                        shape: Some(shape.to_string()),
                                    }),
                                    is_pro: false,
                                    local_path: String::new(),
                                    thumb_path: String::new(),
                                    remote_url: Some(format!("https://afsn.afsun.my.id{}", file_url)),
                                    tags: vec!["vintage".to_string(), "frame".to_string()],
                                    created_at: None,
                                };
                                let _ = fs::create_dir_all(&asset_dir);
                                let _ = fs::write(meta_path, serde_json::to_string_pretty(&meta).unwrap_or_default());
                            }
                        }
                    }
                }
            }
        }
    }).await;

    list_cached_frame_assets(app).await
}

#[tauri::command]
pub async fn download_frame_asset(
    app: AppHandle,
    id: String,
    remote_url: String,
) -> Result<FrameAssetMeta, String> {
    let base_dir = frame_asset_cache::get_frame_assets_dir(&app)?;
    let asset_dir = base_dir.join(&id);
    let meta_path = asset_dir.join("meta.json");
    let asset_path = asset_dir.join("asset.png");

    // 1. If already downloaded, return local metadata
    if meta_path.exists() && asset_path.exists() {
        if let Ok(content) = fs::read_to_string(&meta_path) {
            if let Ok(mut meta) = serde_json::from_str::<FrameAssetMeta>(&content) {
                meta.is_pro = false;
                meta.local_path = asset_path.to_string_lossy().to_string();
                return Ok(meta);
            }
        }
    }

    if remote_url.is_empty() {
        return Err(format!("No remote URL available for asset {}", id));
    }

    // 2. Download from remote_url using ureq in blocking thread
    let id_clone = id.clone();
    let url_clone = remote_url.clone();
    let app_handle = app.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let resp = ureq::get(&url_clone)
            .timeout(std::time::Duration::from_secs(15))
            .set("User-Agent", "OpenSmartAlbum/1.4.14 (Macintosh; Intel Mac OS X)")
            .call()
            .map_err(|e| format!("Network error downloading asset {}: {}", id_clone, e))?;

        let mut bytes = Vec::new();
        resp.into_reader()
            .read_to_end(&mut bytes)
            .map_err(|e| format!("Failed to read response body: {}", e))?;

        let img = decode_or_rasterize_image(&bytes)
            .map_err(|e| format!("Failed to decode downloaded image: {}", e))?;

        let is_frame = id_clone.contains("frame");
        let slot = if is_frame {
            detect_transparent_hole_bounds(&img)
        } else {
            None
        };

        let meta = FrameAssetMeta {
            id: id_clone.clone(),
            title: id_clone.replace("-", " "),
            category: if is_frame { "frame".to_string() } else { "element".to_string() },
            shape: slot.as_ref().and_then(|s| s.shape.clone()).unwrap_or_else(|| "rectangle".to_string()),
            slot,
            is_pro: false,
            local_path: String::new(),
            thumb_path: String::new(),
            remote_url: Some(url_clone),
            tags: vec!["downloaded".to_string(), "free".to_string()],
            created_at: Some(
                SystemTime::now()
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .map(|d| d.as_secs().to_string())
                    .unwrap_or_default(),
            ),
        };

        save_frame_asset_to_cache(&app_handle, &id_clone, &img, meta)
    })
    .await
    .map_err(|e| format!("Spawn error: {}", e))?
}

#[tauri::command]
pub async fn import_custom_frame_asset(
    app: AppHandle,
    file_path: String,
    category: String,
    shape: Option<String>,
    custom_slot: Option<FrameSlotPayload>,
) -> Result<FrameAssetMeta, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    let file_name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("custom_asset")
        .to_string();

    let bytes = fs::read(path).map_err(|e| format!("Failed to read image file: {}", e))?;
    let img = decode_or_rasterize_image(&bytes)
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    let slot = if category == "frame" {
        custom_slot.or_else(|| detect_transparent_hole_bounds(&img))
    } else {
        None
    };

    let asset_id = format!("custom-{}-{}", category, Uuid::new_v4().to_string().chars().take(8).collect::<String>());

    let meta = FrameAssetMeta {
        id: asset_id.clone(),
        title: file_name,
        category,
        shape: shape.unwrap_or_else(|| "rectangle".to_string()),
        slot,
        is_pro: false,
        local_path: String::new(),
        thumb_path: String::new(),
        remote_url: None,
        tags: vec!["custom".to_string(), "imported".to_string()],
        created_at: Some(
            SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .map(|d| d.as_secs().to_string())
                .unwrap_or_default(),
        ),
    };

    save_frame_asset_to_cache(&app, &asset_id, &img, meta)
}

#[tauri::command]
pub async fn delete_cached_frame_asset(app: AppHandle, id: String) -> Result<(), String> {
    frame_asset_cache::delete_cached_frame_asset(&app, &id)
}

#[tauri::command]
pub async fn pick_frame_asset_file_dialog() -> Result<Option<String>, String> {
    let picked = tauri::async_runtime::spawn_blocking(|| {
        rfd::FileDialog::new()
            .set_title("Import Decorative Frame or Graphic Element")
            .add_filter("Images (*.png, *.webp, *.svg)", &["png", "webp", "svg"])
            .pick_file()
    })
    .await
    .map_err(|e| format!("Dialog thread failed: {}", e))?;

    Ok(picked.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn get_frame_assets_storage_stats(app: AppHandle) -> Result<FrameAssetCacheStats, String> {
    frame_asset_cache::get_frame_assets_storage_stats(&app)
}

#[tauri::command]
pub async fn clear_frame_assets_cache(app: AppHandle) -> Result<(), String> {
    frame_asset_cache::clear_frame_assets_cache(&app)
}

fn url_encode(input: &str) -> String {
    let mut encoded = String::new();
    for byte in input.bytes() {
        if byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_' || byte == b'.' || byte == b'~' {
            encoded.push(byte as char);
        } else if byte == b' ' {
            encoded.push('+');
        } else {
            encoded.push_str(&format!("%{:02X}", byte));
        }
    }
    encoded
}

#[tauri::command]
pub async fn search_open_library_assets(
    query: String,
    limit: Option<usize>,
) -> Result<Vec<FrameAssetMeta>, String> {
    let clean_query = query.trim().to_lowercase();
    if clean_query.is_empty() {
        return Ok(Vec::new());
    }

    let search_limit = limit.unwrap_or(30).clamp(1, 64);
    let encoded_query = url_encode(&clean_query);
    let url = format!(
        "https://api.iconify.design/search?query={}&limit={}",
        encoded_query, search_limit
    );

    let res = tauri::async_runtime::spawn_blocking(move || {
        let resp = ureq::get(&url)
            .timeout(std::time::Duration::from_secs(6))
            .set("User-Agent", "OpenSmartAlbum/1.4.14 (Macintosh; Intel Mac OS X)")
            .call()
            .map_err(|e| format!("Open Library request failed: {}", e))?;

        let json = serde_json::from_reader::<_, serde_json::Value>(resp.into_reader())
            .map_err(|e| format!("Failed to parse JSON response: {}", e))?;

        let mut results = Vec::new();
        if let Some(icons) = json.get("icons").and_then(|v| v.as_array()) {
            for icon_val in icons {
                if let Some(full_name) = icon_val.as_str() {
                    let parts: Vec<&str> = full_name.split(|c| c == ':' || c == '/').collect();
                    if parts.len() >= 2 {
                        let prefix = parts[0];
                        let name = parts[1];
                        let asset_id = format!("openlib-{}-{}", prefix, name);
                        let title = format!("{} ({})", name.replace('-', " "), prefix);
                        let is_frame = clean_query.contains("frame")
                            || clean_query.contains("border")
                            || name.contains("frame")
                            || name.contains("border");

                        let remote_url = format!(
                            "https://api.iconify.design/{}/{}.svg?width=512&height=512",
                            prefix, name
                        );

                        let meta = FrameAssetMeta {
                            id: asset_id,
                            title,
                            category: if is_frame { "frame".to_string() } else { "element".to_string() },
                            shape: "rectangle".to_string(),
                            slot: None,
                            is_pro: false,
                            local_path: String::new(),
                            thumb_path: String::new(),
                            remote_url: Some(remote_url),
                            tags: vec!["open-library".to_string(), prefix.to_string(), clean_query.clone()],
                            created_at: None,
                        };
                        results.push(meta);
                    }
                }
            }
        }
        Ok::<Vec<FrameAssetMeta>, String>(results)
    })
    .await
    .map_err(|e| format!("Task spawn error: {}", e))??;

    Ok(res)
}
