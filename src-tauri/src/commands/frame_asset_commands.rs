use crate::frame_asset_cache::{
    self, detect_transparent_hole_bounds, list_cached_frame_assets as list_disk_assets,
    save_frame_asset_to_cache, FrameAssetCacheStats, FrameAssetMeta, FrameSlotPayload,
};
use image::ImageReader;
use std::path::Path;
use std::time::SystemTime;
use tauri::AppHandle;
use uuid::Uuid;

const BUILTIN_CATALOG_JSON: &str = include_str!("../../resources/assets/catalog.json");

#[tauri::command]
pub async fn list_cached_frame_assets(app: AppHandle) -> Result<Vec<FrameAssetMeta>, String> {
    let mut assets = Vec::new();

    // 1. Load built-in catalog
    if let Ok(builtin) = serde_json::from_str::<Vec<FrameAssetMeta>>(BUILTIN_CATALOG_JSON) {
        for mut item in builtin {
            item.is_pro = false;
            assets.push(item);
        }
    }

    // 2. Load locally cached / imported assets
    if let Ok(local_items) = list_disk_assets(&app) {
        for mut item in local_items {
            item.is_pro = false;
            // Overwrite or append
            if let Some(pos) = assets.iter().position(|a| a.id == item.id) {
                assets[pos] = item;
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
    _catalog_url: Option<String>,
) -> Result<Vec<FrameAssetMeta>, String> {
    // 100% Offline-first: returns local assets immediately with zero network telemetry.
    list_cached_frame_assets(app).await
}

#[tauri::command]
pub async fn download_frame_asset(
    _app: AppHandle,
    id: String,
    _remote_url: String,
) -> Result<FrameAssetMeta, String> {
    Err(format!("Asset {} is already available in the offline catalog", id))
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

    let img = ImageReader::open(path)
        .map_err(|e| format!("Failed to open image file: {}", e))?
        .decode()
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
