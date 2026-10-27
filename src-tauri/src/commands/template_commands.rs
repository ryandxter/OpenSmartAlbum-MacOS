use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, State};
use crate::db::{Database, LayoutTemplateFolderRow, LayoutTemplateRow};
use crate::db::template_io::{
    cancel_staged_template_op as cancel_op,
    execute_staged_template_export as exec_export,
    execute_staged_template_import as exec_import,
    prepare_export_layout_template as prep_export,
    prepare_import_layout_template as prep_import_single,
    prepare_import_layout_template_package as prep_import_pkg,
    StagedExportPreview, StagedImportPreview,
};

#[tauri::command]
pub fn save_layout_template(
    db: State<'_, Database>,
    id: Option<String>,
    payload: String,
    is_favorite: Option<bool>,
    folder_id: Option<String>,
) -> Result<LayoutTemplateRow, String> {
    let template_id = id.filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    db.save_layout_template(
        &template_id,
        &payload,
        is_favorite.unwrap_or(false),
        folder_id.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn overwrite_layout_template(
    db: State<'_, Database>,
    id: String,
    payload: String,
) -> Result<LayoutTemplateRow, String> {
    db.overwrite_layout_template(&id, &payload)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_layout_template(
    db: State<'_, Database>,
    id: String,
) -> Result<Option<LayoutTemplateRow>, String> {
    db.get_layout_template(&id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_layout_templates(
    db: State<'_, Database>,
) -> Result<Vec<LayoutTemplateRow>, String> {
    db.list_layout_templates()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_layout_template(
    db: State<'_, Database>,
    id: String,
) -> Result<(), String> {
    db.delete_layout_template(&id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_layout_template_favorite(
    db: State<'_, Database>,
    id: String,
    is_favorite: bool,
) -> Result<(), String> {
    db.toggle_layout_template_favorite(&id, is_favorite)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn move_templates_to_folder(
    db: State<'_, Database>,
    template_ids: Vec<String>,
    folder_id: Option<String>,
) -> Result<(), String> {
    db.move_templates_to_folder(&template_ids, folder_id.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_layout_template_folder(
    db: State<'_, Database>,
    id: Option<String>,
    name: String,
) -> Result<LayoutTemplateFolderRow, String> {
    let folder_id = id.filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    db.create_layout_template_folder(&folder_id, &name)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_layout_template_folder(
    db: State<'_, Database>,
    id: String,
    new_name: String,
) -> Result<(), String> {
    db.rename_layout_template_folder(&id, &new_name)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_layout_template_folder(
    db: State<'_, Database>,
    id: String,
) -> Result<(), String> {
    db.delete_layout_template_folder(&id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_layout_template_folders(
    db: State<'_, Database>,
) -> Result<Vec<LayoutTemplateFolderRow>, String> {
    db.list_layout_template_folders()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn prepare_import_layout_template(
    db: State<'_, Database>,
    file_path: String,
) -> Result<StagedImportPreview, String> {
    prep_import_single(Path::new(&file_path), &db)
}

#[tauri::command]
pub fn prepare_import_layout_template_package(
    db: State<'_, Database>,
    file_path: String,
) -> Result<StagedImportPreview, String> {
    prep_import_pkg(Path::new(&file_path), &db)
}

#[tauri::command]
pub fn execute_staged_template_import(
    app: AppHandle,
    db: State<'_, Database>,
    token: String,
    resolution: String,
) -> Result<Vec<LayoutTemplateRow>, String> {
    let app_data_dir = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    let frames_dir = app_data_dir.join("frames");
    exec_import(&token, &resolution, Some(&frames_dir), &db)
}

#[tauri::command]
pub fn cancel_staged_template_op(
    token: String,
) -> Result<bool, String> {
    Ok(cancel_op(&token))
}

#[tauri::command]
pub fn prepare_export_layout_template(
    db: State<'_, Database>,
    template_ids: Vec<String>,
    target_path: String,
) -> Result<StagedExportPreview, String> {
    prep_export(&template_ids, Path::new(&target_path), &db)
}

#[tauri::command]
pub fn execute_staged_template_export(
    token: String,
) -> Result<String, String> {
    exec_export(&token)
}

#[tauri::command]
pub async fn pick_template_import_file_dialog() -> Result<Option<String>, String> {
    let picked = tauri::async_runtime::spawn_blocking(|| {
        rfd::FileDialog::new()
            .set_title("Import Layout Template or Package")
            .add_filter("Layout Templates (*.osat, *.osatp)", &["osat", "osatp", "afsnt", "afsnp", "json"])
            .pick_file()
            .map(|p| p.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(picked)
}

#[tauri::command]
pub async fn pick_template_export_save_dialog(
    suggested_name: Option<String>,
    is_package: Option<bool>,
) -> Result<Option<String>, String> {
    let is_pkg = is_package.unwrap_or(false);
    let ext = if is_pkg { "osatp" } else { "osat" };
    let desc = if is_pkg {
        "OpenSmartAlbum Template Package (*.osatp)"
    } else {
        "OpenSmartAlbum Layout Template (*.osat)"
    };
    let default_name = suggested_name.unwrap_or_else(|| "custom_template".to_string());
    let filename = format!("{default_name}.{ext}");

    let picked = tauri::async_runtime::spawn_blocking(move || {
        rfd::FileDialog::new()
            .set_title("Export Layout Template")
            .set_file_name(&filename)
            .add_filter(desc, &[ext])
            .save_file()
            .map(|mut p| {
                if p.extension().is_none() {
                    p.set_extension(ext);
                }
                p.to_string_lossy().to_string()
            })
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(picked)
}
