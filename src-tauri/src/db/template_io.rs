use super::*;
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use zip::ZipArchive;

const MAX_PACKAGE_SIZE_BYTES: u64 = 32 * 1024 * 1024; // 32 MiB
const MAX_TEMPLATES_PER_PACKAGE: usize = 100;
const MAX_TOTAL_UNCOMPRESSED_BYTES: u64 = 64 * 1024 * 1024; // 64 MiB

fn default_unit() -> String {
    "mm".to_string()
}

fn default_dpi() -> i32 {
    300
}

fn default_page_target() -> String {
    "full".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct LayoutTemplateCanvas {
    pub kind: String, // "spread" | "post" | "slide"
    pub width: f64,
    pub height: f64,
    #[serde(default)]
    pub page_width: f64,
    #[serde(default)]
    pub gutter_width: f64,
    #[serde(default = "default_unit")]
    pub unit: String,
    #[serde(default = "default_dpi")]
    pub dpi: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct TemplateFrameStyle {
    #[serde(default)]
    pub border_enabled: bool,
    #[serde(default)]
    pub border_width: f64,
    #[serde(default = "default_border_color")]
    pub border_color: String,
    #[serde(default)]
    pub corner_radii: Option<CornerRadiusPayload>,
    #[serde(default)]
    pub shadow_enabled: Option<bool>,
    #[serde(default)]
    pub shadow_blur: Option<f64>,
    #[serde(default)]
    pub shadow_offset_x: Option<f64>,
    #[serde(default)]
    pub shadow_offset_y: Option<f64>,
    #[serde(default)]
    pub shadow_opacity: Option<f64>,
    #[serde(default)]
    pub shadow_color: Option<String>,
    #[serde(default)]
    pub noise_amount: Option<f64>,
    #[serde(default)]
    pub blur_radius: Option<f64>,
    #[serde(default)]
    pub grayscale_amount: Option<f64>,
    #[serde(default)]
    pub opacity: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct TemplateSlot {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    #[serde(default)]
    pub rotation: f64,
    #[serde(default = "default_page_target")]
    pub page: String, // "left" | "right" | "full"
    #[serde(default)]
    pub style: Option<TemplateFrameStyle>,
    #[serde(default)]
    pub frame_asset_id: Option<String>,
    #[serde(default)]
    pub frame_asset_title: Option<String>,
    #[serde(default)]
    pub frame_asset_url: Option<String>,
    #[serde(default)]
    pub frame_asset_local_path: Option<String>,
    #[serde(default)]
    pub frame_asset_slot: Option<FrameSlotPayload>,
    #[serde(default)]
    pub frame_asset_is_pro: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct LayoutTemplateSpec {
    pub version: i32,
    pub name: String,
    pub canvas: LayoutTemplateCanvas,
    pub slots: Vec<TemplateSlot>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StagedOpKind {
    Import,
    Export,
}

#[derive(Debug, Clone)]
pub struct StagedTemplateItem {
    pub id: String,
    pub name: String,
    pub payload: String,
    pub spec: LayoutTemplateSpec,
    pub source_filename: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateConflict {
    pub template_id: String,
    pub template_name: String,
    pub existing_id: Option<String>,
    pub existing_name: Option<String>,
    pub conflict_type: String, // "id_exists" | "name_exists" | "both"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplatePreviewItem {
    pub id: String,
    pub name: String,
    pub slot_count: usize,
    pub canvas_kind: String,
    pub has_frame_assets: bool,
    pub source_file: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StagedImportPreview {
    pub token: String,
    pub package_name: String,
    pub templates: Vec<TemplatePreviewItem>,
    pub conflicts: Vec<TemplateConflict>,
    pub total_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StagedExportPreview {
    pub token: String,
    pub target_path: String,
    pub template_count: usize,
    pub asset_count: usize,
    pub file_exists: bool,
}

pub struct StagedTemplateOp {
    pub token: String,
    pub kind: StagedOpKind,
    pub target_path: Option<PathBuf>,
    pub templates: Vec<StagedTemplateItem>,
    pub conflicts: Vec<TemplateConflict>,
    pub asset_files: Vec<(String, Vec<u8>)>, // (relative path e.g. "assets/frame.png", file bytes)
    pub temp_dir: Option<PathBuf>,
}

static STAGED_TEMPLATE_OPS: Mutex<Option<HashMap<String, StagedTemplateOp>>> = Mutex::new(None);

pub fn stage_template_op(op: StagedTemplateOp) {
    let mut guard = STAGED_TEMPLATE_OPS.lock().unwrap();
    let map = guard.get_or_insert_with(HashMap::new);
    map.insert(op.token.clone(), op);
}

pub fn take_staged_template_op(token: &str) -> Option<StagedTemplateOp> {
    let mut guard = STAGED_TEMPLATE_OPS.lock().unwrap();
    guard.as_mut().and_then(|map| map.remove(token))
}

pub fn cancel_staged_template_op(token: &str) -> bool {
    if let Some(op) = take_staged_template_op(token) {
        if let Some(temp_dir) = op.temp_dir {
            let _ = std::fs::remove_dir_all(&temp_dir);
        }
        true
    } else {
        false
    }
}

/// Normalizes a template payload JSON string, ensuring `frameAssetIsPro` is normalized to `false` (Anti-Feature removal).
pub fn normalize_spec_json(json_str: &str) -> Result<(String, LayoutTemplateSpec), String> {
    let mut val: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|e| format!("Invalid template JSON: {e}"))?;

    if val.get("version").is_none() {
        val["version"] = serde_json::json!(1);
    }

    if let Some(slots) = val.get_mut("slots").and_then(|s| s.as_array_mut()) {
        for slot in slots {
            if let Some(obj) = slot.as_object_mut() {
                // Pro check normalization: all custom/built-in frames are 100% free
                obj.insert("frameAssetIsPro".to_string(), serde_json::Value::Bool(false));
            }
        }
    }

    let spec: LayoutTemplateSpec = serde_json::from_value(val.clone())
        .map_err(|e| format!("Failed to parse LayoutTemplateSpec: {e}"))?;

    let normalized_json = serde_json::to_string(&val)
        .map_err(|e| format!("Failed to serialize normalized JSON: {e}"))?;

    Ok((normalized_json, spec))
}

pub fn extract_name_from_payload(payload: &str) -> Option<String> {
    serde_json::from_str::<serde_json::Value>(payload)
        .ok()
        .and_then(|v| v.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
}

pub fn slugify_filename(name: &str) -> String {
    let clean: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    let trimmed = clean.trim_matches('_');
    if trimmed.is_empty() {
        "template".to_string()
    } else {
        trimmed.to_lowercase()
    }
}

pub fn deduplicate_template_name(base_name: &str, existing_names: &[String]) -> String {
    let base_trimmed = base_name.trim();
    let candidate_copy = format!("{base_trimmed} (Copy)");
    if !existing_names.iter().any(|n| n.eq_ignore_ascii_case(&candidate_copy)) {
        return candidate_copy;
    }

    let mut index = 2;
    loop {
        let candidate = format!("{base_trimmed} ({index})");
        if !existing_names.iter().any(|n| n.eq_ignore_ascii_case(&candidate)) {
            return candidate;
        }
        index += 1;
    }
}

/// Stage alongside destination so rename replaces atomically.
fn atomic_write_file(path: &Path, content: &[u8]) -> Result<(), String> {
    if path.is_symlink() {
        return Err("Cannot overwrite a symbolic link.".to_string());
    }
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;

    let temp_path = parent.join(format!(".tmp-template-{}", uuid::Uuid::new_v4()));
    let res = (|| -> Result<(), String> {
        let mut file = File::create(&temp_path).map_err(|e| e.to_string())?;
        file.write_all(content).map_err(|e| e.to_string())?;
        file.flush().map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        drop(file);
        std::fs::rename(&temp_path, path).map_err(|e| e.to_string())?;
        Ok(())
    })();
    if res.is_err() {
        let _ = std::fs::remove_file(&temp_path);
    }
    res
}

impl Database {
    /// Save a new layout template to SQLite. Fails if template with `id` already exists.
    pub fn save_layout_template(
        &self,
        id: &str,
        payload: &str,
        is_favorite: bool,
        folder_id: Option<&str>,
    ) -> SqliteResult<LayoutTemplateRow> {
        let (normalized_payload, _) = normalize_spec_json(payload)
            .map_err(|e| rusqlite::Error::InvalidParameterName(e))?;

        let conn = self.conn.lock().unwrap();

        // If folder_id is specified, verify it exists
        if let Some(fid) = folder_id {
            let exists: i64 = conn.query_row(
                "SELECT count(*) FROM layout_template_folders WHERE id = ?1",
                [fid],
                |r| r.get(0),
            )?;
            if exists == 0 {
                return Err(rusqlite::Error::InvalidParameterName(format!(
                    "Folder '{fid}' does not exist"
                )));
            }
        }

        let fav_int = if is_favorite { 1 } else { 0 };
        conn.execute(
            "INSERT INTO layout_templates (id, payload, is_favorite, folder_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, datetime('now'), datetime('now'))",
            rusqlite::params![id, normalized_payload, fav_int, folder_id],
        )?;

        conn.query_row(
            "SELECT id, payload, is_favorite, folder_id, created_at, updated_at FROM layout_templates WHERE id = ?1",
            [id],
            |row| {
                Ok(LayoutTemplateRow {
                    id: row.get(0)?,
                    payload: row.get(1)?,
                    is_favorite: row.get::<_, i64>(2)? != 0,
                    folder_id: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            },
        )
    }

    /// Overwrite an existing layout template's payload. Fails if template not found.
    pub fn overwrite_layout_template(
        &self,
        id: &str,
        payload: &str,
    ) -> SqliteResult<LayoutTemplateRow> {
        let (normalized_payload, _) = normalize_spec_json(payload)
            .map_err(|e| rusqlite::Error::InvalidParameterName(e))?;

        let conn = self.conn.lock().unwrap();
        let rows_affected = conn.execute(
            "UPDATE layout_templates SET payload = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![normalized_payload, id],
        )?;

        if rows_affected == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }

        conn.query_row(
            "SELECT id, payload, is_favorite, folder_id, created_at, updated_at FROM layout_templates WHERE id = ?1",
            [id],
            |row| {
                Ok(LayoutTemplateRow {
                    id: row.get(0)?,
                    payload: row.get(1)?,
                    is_favorite: row.get::<_, i64>(2)? != 0,
                    folder_id: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            },
        )
    }

    /// Retrieve a single layout template by ID.
    pub fn get_layout_template(&self, id: &str) -> SqliteResult<Option<LayoutTemplateRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, payload, is_favorite, folder_id, created_at, updated_at FROM layout_templates WHERE id = ?1",
        )?;
        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(LayoutTemplateRow {
                id: row.get(0)?,
                payload: row.get(1)?,
                is_favorite: row.get::<_, i64>(2)? != 0,
                folder_id: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            }))
        } else {
            Ok(None)
        }
    }

    /// List all layout templates ordered by favorite first, then recently updated.
    pub fn list_layout_templates(&self) -> SqliteResult<Vec<LayoutTemplateRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, payload, is_favorite, folder_id, created_at, updated_at FROM layout_templates ORDER BY is_favorite DESC, updated_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(LayoutTemplateRow {
                id: row.get(0)?,
                payload: row.get(1)?,
                is_favorite: row.get::<_, i64>(2)? != 0,
                folder_id: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })?;

        let mut list = Vec::new();
        for item in rows {
            list.push(item?);
        }
        Ok(list)
    }

    /// Delete a single layout template by ID.
    pub fn delete_layout_template(&self, id: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM layout_templates WHERE id = ?1", [id])?;
        Ok(())
    }

    /// Toggle favorite flag on a layout template.
    pub fn toggle_layout_template_favorite(
        &self,
        id: &str,
        is_favorite: bool,
    ) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        let fav_int = if is_favorite { 1 } else { 0 };
        let rows_affected = conn.execute(
            "UPDATE layout_templates SET is_favorite = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![fav_int, id],
        )?;
        if rows_affected == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
        Ok(())
    }

    /// Batch move templates to a folder (or unfile if folder_id is None).
    pub fn move_templates_to_folder(
        &self,
        template_ids: &[String],
        folder_id: Option<&str>,
    ) -> SqliteResult<()> {
        if template_ids.is_empty() {
            return Ok(());
        }

        let mut conn = self.conn.lock().unwrap();

        // If folder_id specified, check that it exists
        if let Some(fid) = folder_id {
            let exists: i64 = conn.query_row(
                "SELECT count(*) FROM layout_template_folders WHERE id = ?1",
                [fid],
                |r| r.get(0),
            )?;
            if exists == 0 {
                return Err(rusqlite::Error::InvalidParameterName(format!(
                    "Target folder '{fid}' does not exist"
                )));
            }
        }

        let tx = conn.transaction()?;
        for tid in template_ids {
            tx.execute(
                "UPDATE layout_templates SET folder_id = ?1, updated_at = datetime('now') WHERE id = ?2",
                rusqlite::params![folder_id, tid],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    /// Create a new layout template folder.
    pub fn create_layout_template_folder(
        &self,
        id: &str,
        name: &str,
    ) -> SqliteResult<LayoutTemplateFolderRow> {
        let trimmed_name = name.trim();
        if trimmed_name.is_empty() {
            return Err(rusqlite::Error::InvalidParameterName(
                "Folder name cannot be empty".to_string(),
            ));
        }

        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO layout_template_folders (id, name, created_at, updated_at)
             VALUES (?1, ?2, datetime('now'), datetime('now'))",
            rusqlite::params![id, trimmed_name],
        )?;

        conn.query_row(
            "SELECT id, name, created_at, updated_at FROM layout_template_folders WHERE id = ?1",
            [id],
            |row| {
                Ok(LayoutTemplateFolderRow {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            },
        )
    }

    /// Rename an existing layout template folder.
    pub fn rename_layout_template_folder(&self, id: &str, new_name: &str) -> SqliteResult<()> {
        let trimmed_name = new_name.trim();
        if trimmed_name.is_empty() {
            return Err(rusqlite::Error::InvalidParameterName(
                "Folder name cannot be empty".to_string(),
            ));
        }

        let conn = self.conn.lock().unwrap();
        let rows_affected = conn.execute(
            "UPDATE layout_template_folders SET name = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![trimmed_name, id],
        )?;

        if rows_affected == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
        Ok(())
    }

    /// Delete a layout template folder. Any templates inside the folder are safely unfiled (folder_id set to NULL).
    pub fn delete_layout_template_folder(&self, id: &str) -> SqliteResult<()> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        tx.execute(
            "UPDATE layout_templates SET folder_id = NULL, updated_at = datetime('now') WHERE folder_id = ?1",
            [id],
        )?;
        tx.execute("DELETE FROM layout_template_folders WHERE id = ?1", [id])?;
        tx.commit()?;
        Ok(())
    }

    /// List all layout template folders alphabetically.
    pub fn list_layout_template_folders(&self) -> SqliteResult<Vec<LayoutTemplateFolderRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, created_at, updated_at FROM layout_template_folders ORDER BY name COLLATE NOCASE ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(LayoutTemplateFolderRow {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?;

        let mut folders = Vec::new();
        for f in rows {
            folders.push(f?);
        }
        Ok(folders)
    }
}

// ---------------------------------------------------------------------------
// 2-Stage Staged Import / Export Engine
// ---------------------------------------------------------------------------

fn detect_conflicts_for_items(
    db: &Database,
    items: &[StagedTemplateItem],
) -> SqliteResult<Vec<TemplateConflict>> {
    let existing = db.list_layout_templates()?;
    let mut conflicts = Vec::new();

    let existing_ids: HashMap<String, LayoutTemplateRow> = existing
        .iter()
        .map(|r| (r.id.clone(), r.clone()))
        .collect();

    let mut existing_names: HashMap<String, (String, String)> = HashMap::new();
    for r in &existing {
        if let Some(name) = extract_name_from_payload(&r.payload) {
            existing_names.insert(name.to_lowercase(), (r.id.clone(), name));
        }
    }

    for item in items {
        let id_match = existing_ids.get(&item.id);
        let name_match = existing_names.get(&item.name.to_lowercase());

        if id_match.is_some() || name_match.is_some() {
            let conflict_type = match (id_match.is_some(), name_match.is_some()) {
                (true, true) => "both",
                (true, false) => "id_exists",
                (false, true) => "name_exists",
                (false, false) => unreachable!(),
            };

            conflicts.push(TemplateConflict {
                template_id: item.id.clone(),
                template_name: item.name.clone(),
                existing_id: id_match.map(|r| r.id.clone()).or_else(|| name_match.map(|(id, _)| id.clone())),
                existing_name: name_match.map(|(_, name)| name.clone()).or_else(|| {
                    id_match.and_then(|r| extract_name_from_payload(&r.payload))
                }),
                conflict_type: conflict_type.to_string(),
            });
        }
    }

    Ok(conflicts)
}

/// Prepare import of a single `.afsnt` template file.
pub fn prepare_import_layout_template(
    file_path: &Path,
    db: &Database,
) -> Result<StagedImportPreview, String> {
    if !file_path.exists() {
        return Err(format!("Template file not found: {}", file_path.display()));
    }

    let ext = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if ext != "osat" && ext != "afsnt" && ext != "json" {
        return Err(format!(
            "Unsupported template file extension '.{}'. Expected '.osat'.",
            ext
        ));
    }

    let file_content = std::fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read template file: {e}"))?;

    let (normalized_payload, spec) = normalize_spec_json(&file_content)?;

    // Extract ID if specified in top-level JSON, or generate a fresh UUID
    let template_id = serde_json::from_str::<serde_json::Value>(&file_content)
        .ok()
        .and_then(|v| v.get("id").and_then(|i| i.as_str()).map(|s| s.to_string()))
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    let file_name = file_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "template.afsnt".to_string());

    let staged_item = StagedTemplateItem {
        id: template_id.clone(),
        name: spec.name.clone(),
        payload: normalized_payload,
        spec: spec.clone(),
        source_filename: Some(file_name.clone()),
    };

    let conflicts = detect_conflicts_for_items(db, &[staged_item.clone()])
        .map_err(|e| e.to_string())?;

    let preview_item = TemplatePreviewItem {
        id: template_id,
        name: spec.name,
        slot_count: spec.slots.len(),
        canvas_kind: spec.canvas.kind,
        has_frame_assets: spec.slots.iter().any(|s| s.frame_asset_id.is_some() || s.frame_asset_local_path.is_some()),
        source_file: Some(file_name.clone()),
    };

    let token = uuid::Uuid::new_v4().to_string();

    let op = StagedTemplateOp {
        token: token.clone(),
        kind: StagedOpKind::Import,
        target_path: None,
        templates: vec![staged_item],
        conflicts: conflicts.clone(),
        asset_files: Vec::new(),
        temp_dir: None,
    };

    stage_template_op(op);

    Ok(StagedImportPreview {
        token,
        package_name: file_name,
        templates: vec![preview_item],
        conflicts,
        total_count: 1,
    })
}

/// Prepare import of an `.afsnp` bundle package (ZIP archive containing templates and decorative frame assets).
pub fn prepare_import_layout_template_package(
    file_path: &Path,
    db: &Database,
) -> Result<StagedImportPreview, String> {
    if !file_path.exists() {
        return Err(format!("Package file not found: {}", file_path.display()));
    }

    let meta = std::fs::metadata(file_path).map_err(|e| e.to_string())?;
    if meta.len() > MAX_PACKAGE_SIZE_BYTES {
        return Err(format!(
            "Template package exceeds maximum allowed size of {} MiB",
            MAX_PACKAGE_SIZE_BYTES / (1024 * 1024)
        ));
    }

    let file = File::open(file_path).map_err(|e| format!("Cannot open package file: {e}"))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Invalid template package ZIP archive: {e}"))?;

    let mut staged_items = Vec::new();
    let mut asset_files = Vec::new();
    let mut total_uncompressed_bytes: u64 = 0;

    // Scan manifest.json if present
    let mut manifest_templates: Option<Vec<String>> = None;
    for i in 0..archive.len() {
        let entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().to_string();
        if name == "manifest.json" {
            drop(entry);
            let mut manifest_entry = archive.by_name("manifest.json").map_err(|e| e.to_string())?;
            let mut content = String::new();
            manifest_entry.read_to_string(&mut content).map_err(|e| e.to_string())?;
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(list) = val.get("templates").and_then(|t| t.as_array()) {
                    manifest_templates = Some(
                        list.iter()
                            .filter_map(|item| item.as_str().map(|s| s.to_string()))
                            .collect(),
                    );
                }
            }
            break;
        }
    }

    // Process all entries safely
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let raw_name = entry.name().to_string();

        // Safe zip entry check
        if raw_name.starts_with('/') || raw_name.starts_with('\\') || raw_name.contains("..") {
            return Err("Malicious zip entry path traversal detected in template package.".to_string());
        }

        if entry.is_dir() {
            continue;
        }

        total_uncompressed_bytes += entry.size();
        if total_uncompressed_bytes > MAX_TOTAL_UNCOMPRESSED_BYTES {
            return Err("Package uncompressed content exceeds safety threshold (64 MiB).".to_string());
        }

        if raw_name.starts_with("assets/") && !raw_name.ends_with('/') {
            let mut buffer = Vec::new();
            entry.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
            asset_files.push((raw_name.clone(), buffer));
            continue;
        }

        let is_template_file = if let Some(ref list) = manifest_templates {
            list.contains(&raw_name)
        } else {
            (raw_name.starts_with("templates/") || !raw_name.contains('/'))
                && (raw_name.ends_with(".json") || raw_name.ends_with(".osat") || raw_name.ends_with(".afsnt"))
                && raw_name != "manifest.json"
        };

        if is_template_file {
            if staged_items.len() >= MAX_TEMPLATES_PER_PACKAGE {
                return Err(format!(
                    "Package exceeds maximum allowed templates limit ({MAX_TEMPLATES_PER_PACKAGE})."
                ));
            }

            let mut content = String::new();
            entry.read_to_string(&mut content).map_err(|e| e.to_string())?;

            let (normalized_payload, spec) = normalize_spec_json(&content)?;

            let template_id = serde_json::from_str::<serde_json::Value>(&content)
                .ok()
                .and_then(|v| v.get("id").and_then(|i| i.as_str()).map(|s| s.to_string()))
                .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

            staged_items.push(StagedTemplateItem {
                id: template_id,
                name: spec.name.clone(),
                payload: normalized_payload,
                spec,
                source_filename: Some(raw_name),
            });
        }
    }

    if staged_items.is_empty() {
        return Err("No valid template definitions found inside package.".to_string());
    }

    let conflicts = detect_conflicts_for_items(db, &staged_items)
        .map_err(|e| e.to_string())?;

    let preview_items: Vec<TemplatePreviewItem> = staged_items
        .iter()
        .map(|item| TemplatePreviewItem {
            id: item.id.clone(),
            name: item.spec.name.clone(),
            slot_count: item.spec.slots.len(),
            canvas_kind: item.spec.canvas.kind.clone(),
            has_frame_assets: item.spec.slots.iter().any(|s| s.frame_asset_id.is_some() || s.frame_asset_local_path.is_some()),
            source_file: item.source_filename.clone(),
        })
        .collect();

    let package_name = file_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "package.afsnp".to_string());

    let token = uuid::Uuid::new_v4().to_string();
    let total_count = staged_items.len();

    let op = StagedTemplateOp {
        token: token.clone(),
        kind: StagedOpKind::Import,
        target_path: None,
        templates: staged_items,
        conflicts: conflicts.clone(),
        asset_files,
        temp_dir: None,
    };

    stage_template_op(op);

    Ok(StagedImportPreview {
        token,
        package_name,
        templates: preview_items,
        conflicts,
        total_count,
    })
}

/// Execute a staged template import with user resolution ('overwrite' or 'keep_both').
pub fn execute_staged_template_import(
    token: &str,
    resolution: &str,
    frames_dir: Option<&Path>,
    db: &Database,
) -> Result<Vec<LayoutTemplateRow>, String> {
    let op = take_staged_template_op(token)
        .ok_or_else(|| "Staged operation expired or invalid token".to_string())?;

    if op.kind != StagedOpKind::Import {
        return Err("Staged operation is not an import operation".to_string());
    }

    let res_mode = resolution.trim().to_ascii_lowercase();
    if res_mode != "overwrite" && res_mode != "keep_both" {
        return Err(format!(
            "Invalid conflict resolution '{}'. Must be 'overwrite' or 'keep_both'.",
            resolution
        ));
    }

    // Extract any bundled custom frame asset files into local frames cache directory
    if let Some(target_frames_dir) = frames_dir {
        if !op.asset_files.is_empty() {
            std::fs::create_dir_all(target_frames_dir)
                .map_err(|e| format!("Failed to create local frames directory: {e}"))?;

            for (asset_rel_path, bytes) in &op.asset_files {
                let file_name = Path::new(asset_rel_path)
                    .file_name()
                    .ok_or_else(|| "Invalid asset file name in package".to_string())?;
                let dest = target_frames_dir.join(file_name);
                let _ = std::fs::write(&dest, bytes);
            }
        }
    }

    let existing_templates = db.list_layout_templates().map_err(|e| e.to_string())?;
    let mut existing_names: Vec<String> = existing_templates
        .iter()
        .filter_map(|t| extract_name_from_payload(&t.payload))
        .collect();

    let mut imported_rows = Vec::new();

    for item in op.templates {
        let conflict = op.conflicts.iter().find(|c| c.template_id == item.id || c.template_name.eq_ignore_ascii_case(&item.name));

        if res_mode == "keep_both" {
            if conflict.is_some() {
                // Generate a fresh unique ID and deduplicate name (e.g., "Wedding 4-up (Copy)")
                let new_id = uuid::Uuid::new_v4().to_string();
                let deduplicated_name = deduplicate_template_name(&item.spec.name, &existing_names);
                existing_names.push(deduplicated_name.clone());

                let mut val: serde_json::Value = serde_json::from_str(&item.payload)
                    .map_err(|e| e.to_string())?;
                val["name"] = serde_json::Value::String(deduplicated_name.clone());
                val["id"] = serde_json::Value::String(new_id.clone());
                let final_payload = serde_json::to_string(&val).map_err(|e| e.to_string())?;

                let saved = db.save_layout_template(&new_id, &final_payload, false, None)
                    .map_err(|e| format!("Failed to save template: {e}"))?;
                imported_rows.push(saved);
            } else {
                existing_names.push(item.spec.name.clone());
                let saved = db.save_layout_template(&item.id, &item.payload, false, None)
                    .map_err(|e| format!("Failed to save template: {e}"))?;
                imported_rows.push(saved);
            }
        } else {
            // Overwrite mode
            if let Some(c) = conflict {
                let target_id = c.existing_id.as_deref().unwrap_or(&item.id);
                if db.get_layout_template(target_id).map_err(|e| e.to_string())?.is_some() {
                    let updated = db.overwrite_layout_template(target_id, &item.payload)
                        .map_err(|e| format!("Failed to overwrite template: {e}"))?;
                    imported_rows.push(updated);
                } else {
                    let saved = db.save_layout_template(target_id, &item.payload, false, None)
                        .map_err(|e| format!("Failed to save template: {e}"))?;
                    imported_rows.push(saved);
                }
            } else {
                let saved = db.save_layout_template(&item.id, &item.payload, false, None)
                    .map_err(|e| format!("Failed to save template: {e}"))?;
                imported_rows.push(saved);
            }
        }
    }

    // Clean up any temp dir
    if let Some(temp_dir) = op.temp_dir {
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    Ok(imported_rows)
}

/// Prepare export of selected template IDs to a target file path (`.afsnt` or `.afsnp`).
pub fn prepare_export_layout_template(
    template_ids: &[String],
    target_path: &Path,
    db: &Database,
) -> Result<StagedExportPreview, String> {
    if template_ids.is_empty() {
        return Err("No templates selected for export".to_string());
    }

    let mut staged_items = Vec::new();
    let mut asset_files = Vec::new();

    for id in template_ids {
        let tpl = db.get_layout_template(id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Template '{id}' not found"))?;

        let (normalized, spec) = normalize_spec_json(&tpl.payload)?;

        // Collect custom frame assets referenced if they exist on disk
        for slot in &spec.slots {
            if let Some(ref local_path) = slot.frame_asset_local_path {
                let path = Path::new(local_path);
                if path.exists() && path.is_file() {
                    let file_name = path.file_name().unwrap().to_string_lossy().to_string();
                    if !asset_files.iter().any(|(name, _): &(String, Vec<u8>)| name == &file_name) {
                        if let Ok(bytes) = std::fs::read(path) {
                            asset_files.push((file_name, bytes));
                        }
                    }
                }
            }
        }

        staged_items.push(StagedTemplateItem {
            id: tpl.id,
            name: spec.name.clone(),
            payload: normalized,
            spec,
            source_filename: None,
        });
    }

    let file_exists = target_path.exists();
    let token = uuid::Uuid::new_v4().to_string();
    let template_count = staged_items.len();
    let asset_count = asset_files.len();

    let op = StagedTemplateOp {
        token: token.clone(),
        kind: StagedOpKind::Export,
        target_path: Some(target_path.to_path_buf()),
        templates: staged_items,
        conflicts: Vec::new(),
        asset_files,
        temp_dir: None,
    };

    stage_template_op(op);

    Ok(StagedExportPreview {
        token,
        target_path: target_path.to_string_lossy().to_string(),
        template_count,
        asset_count,
        file_exists,
    })
}

/// Execute a staged export, creating either a single `.afsnt` JSON or a bundled `.afsnp` ZIP.
pub fn execute_staged_template_export(token: &str) -> Result<String, String> {
    let op = take_staged_template_op(token)
        .ok_or_else(|| "Staged export operation expired or invalid token".to_string())?;

    if op.kind != StagedOpKind::Export {
        return Err("Staged operation is not an export operation".to_string());
    }

    let target_path = op.target_path.ok_or_else(|| "Target path missing from staged export".to_string())?;

    let ext = target_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    if ext == "osat" || ext == "afsnt" || (ext == "json" && op.templates.len() == 1) {
        // Single template JSON export
        let tpl = op.templates.first().ok_or_else(|| "No template to export".to_string())?;
        atomic_write_file(&target_path, tpl.payload.as_bytes())?;
        Ok(target_path.to_string_lossy().to_string())
    } else {
        // Bundled ZIP package (.osatp / .afsnp)
        let parent = target_path.parent().unwrap_or(Path::new("."));
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;

        let temp_zip_path = parent.join(format!(".tmp-pkg-{}.zip", uuid::Uuid::new_v4()));
        let file = File::create(&temp_zip_path).map_err(|e| e.to_string())?;
        let mut zip = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        let mut manifest_template_paths = Vec::new();

        for (idx, tpl) in op.templates.iter().enumerate() {
            let slug = slugify_filename(&tpl.name);
            let entry_name = format!("templates/{:03}-{slug}.json", idx + 1);
            zip.start_file(&entry_name, options).map_err(|e| e.to_string())?;
            zip.write_all(tpl.payload.as_bytes()).map_err(|e| e.to_string())?;
            manifest_template_paths.push(entry_name);
        }

        // Add manifest.json
        let manifest = serde_json::json!({
            "format": "opensmartalbum-template-package",
            "version": 1,
            "templates": manifest_template_paths
        });
        zip.start_file("manifest.json", options).map_err(|e| e.to_string())?;
        zip.write_all(serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?.as_bytes())
            .map_err(|e| e.to_string())?;

        // Add assets/
        for (asset_name, bytes) in &op.asset_files {
            let entry_name = format!("assets/{asset_name}");
            zip.start_file(&entry_name, options).map_err(|e| e.to_string())?;
            zip.write_all(bytes).map_err(|e| e.to_string())?;
        }

        zip.finish().map_err(|e| e.to_string())?;

        if target_path.exists() {
            let _ = std::fs::remove_file(&target_path);
        }
        std::fs::rename(&temp_zip_path, &target_path).map_err(|e| e.to_string())?;

        Ok(target_path.to_string_lossy().to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_spec_json(name: &str) -> String {
        serde_json::json!({
            "version": 1,
            "name": name,
            "canvas": {
                "kind": "spread",
                "width": 800.0,
                "height": 400.0,
                "pageWidth": 400.0,
                "gutterWidth": 0.0,
                "unit": "mm",
                "dpi": 300
            },
            "slots": [
                {
                    "x": 0.05,
                    "y": 0.05,
                    "width": 0.4,
                    "height": 0.9,
                    "rotation": 0.0,
                    "page": "left",
                    "frameAssetId": "frame_gold",
                    "frameAssetIsPro": true
                },
                {
                    "x": 0.55,
                    "y": 0.05,
                    "width": 0.4,
                    "height": 0.9,
                    "rotation": 0.0,
                    "page": "right"
                }
            ]
        }).to_string()
    }

    #[test]
    fn test_normalize_spec_pro_flag_removal() {
        let raw = sample_spec_json("Test Layout");
        let (normalized, spec) = normalize_spec_json(&raw).expect("Normalization should succeed");
        assert_eq!(spec.name, "Test Layout");
        assert_eq!(spec.slots.len(), 2);
        assert_eq!(spec.slots[0].frame_asset_is_pro, Some(false));
        assert!(normalized.contains(r#""frameAssetIsPro":false"#));
    }

    #[test]
    fn test_template_and_folder_crud() {
        let temp_dir = std::env::temp_dir().join(format!("osa_tpl_crud_{}", uuid::Uuid::new_v4()));
        let _ = std::fs::remove_dir_all(&temp_dir);
        let db = Database::init(temp_dir.join("test.db")).expect("Failed to init DB");

        // 1. Create Folder
        let folder = db.create_layout_template_folder("folder-1", "Wedding Layouts")
            .expect("Create folder should succeed");
        assert_eq!(folder.name, "Wedding Layouts");

        let folders = db.list_layout_template_folders().unwrap();
        assert_eq!(folders.len(), 1);
        assert_eq!(folders[0].id, "folder-1");

        // Rename folder
        db.rename_layout_template_folder("folder-1", "Wedding Spreads").unwrap();
        let folders = db.list_layout_template_folders().unwrap();
        assert_eq!(folders[0].name, "Wedding Spreads");

        // 2. Save Template
        let payload1 = sample_spec_json("Spread 2-up");
        let tpl1 = db.save_layout_template("tpl-1", &payload1, true, Some("folder-1"))
            .expect("Save template should succeed");
        assert_eq!(tpl1.id, "tpl-1");
        assert!(tpl1.is_favorite);
        assert_eq!(tpl1.folder_id, Some("folder-1".to_string()));

        // Save a second unfiled template
        let payload2 = sample_spec_json("Spread 4-up");
        let tpl2 = db.save_layout_template("tpl-2", &payload2, false, None)
            .expect("Save template 2 should succeed");
        assert_eq!(tpl2.folder_id, None);
        assert!(!tpl2.is_favorite);

        // 3. List Templates
        let templates = db.list_layout_templates().unwrap();
        assert_eq!(templates.len(), 2);
        // tpl1 is favorite, so should be first
        assert_eq!(templates[0].id, "tpl-1");

        // 4. Overwrite Template
        let updated_payload = sample_spec_json("Spread 2-up Modern");
        let updated_tpl = db.overwrite_layout_template("tpl-1", &updated_payload).unwrap();
        assert!(updated_tpl.payload.contains("Spread 2-up Modern"));

        // 5. Toggle Favorite
        db.toggle_layout_template_favorite("tpl-1", false).unwrap();
        let fetched = db.get_layout_template("tpl-1").unwrap().unwrap();
        assert!(!fetched.is_favorite);

        // 6. Move Templates to Folder
        db.move_templates_to_folder(&["tpl-2".to_string()], Some("folder-1")).unwrap();
        let fetched2 = db.get_layout_template("tpl-2").unwrap().unwrap();
        assert_eq!(fetched2.folder_id, Some("folder-1".to_string()));

        // 7. Delete Folder (Cascades folder_id to NULL on member templates)
        db.delete_layout_template_folder("folder-1").unwrap();
        let folders_after = db.list_layout_template_folders().unwrap();
        assert_eq!(folders_after.len(), 0);

        let tpl1_after = db.get_layout_template("tpl-1").unwrap().unwrap();
        assert_eq!(tpl1_after.folder_id, None);
        let tpl2_after = db.get_layout_template("tpl-2").unwrap().unwrap();
        assert_eq!(tpl2_after.folder_id, None);

        // 8. Delete Template
        db.delete_layout_template("tpl-1").unwrap();
        assert!(db.get_layout_template("tpl-1").unwrap().is_none());
        assert_eq!(db.list_layout_templates().unwrap().len(), 1);

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_stage_import_afsnt_conflict_detection_and_resolution() {
        let temp_dir = std::env::temp_dir().join(format!("osa_tpl_staged_{}", uuid::Uuid::new_v4()));
        let _ = std::fs::remove_dir_all(&temp_dir);
        let db = Database::init(temp_dir.join("test.db")).expect("Failed to init DB");

        // Seed existing template "Spread 2-up"
        let initial_payload = sample_spec_json("Spread 2-up");
        db.save_layout_template("existing-1", &initial_payload, false, None).unwrap();

        // Write an .afsnt file with the same name "Spread 2-up"
        let file_path = temp_dir.join("import_test.afsnt");
        std::fs::write(&file_path, sample_spec_json("Spread 2-up")).unwrap();

        // Stage import
        let preview = prepare_import_layout_template(&file_path, &db)
            .expect("Staging import should succeed");
        assert_eq!(preview.templates.len(), 1);
        assert_eq!(preview.conflicts.len(), 1);
        assert_eq!(preview.conflicts[0].conflict_type, "name_exists");
        assert_eq!(preview.conflicts[0].existing_id, Some("existing-1".to_string()));

        // Resolution 1: "keep_both"
        let imported = execute_staged_template_import(&preview.token, "keep_both", None, &db)
            .expect("Execute keep_both should succeed");
        assert_eq!(imported.len(), 1);
        assert_ne!(imported[0].id, "existing-1");
        assert!(imported[0].payload.contains("Spread 2-up (Copy)"));

        // Stage import again
        let preview2 = prepare_import_layout_template(&file_path, &db).unwrap();
        // Resolution 2: "overwrite"
        let overwritten = execute_staged_template_import(&preview2.token, "overwrite", None, &db)
            .expect("Execute overwrite should succeed");
        assert_eq!(overwritten.len(), 1);
        assert_eq!(overwritten[0].id, "existing-1");

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_stage_export_and_import_afsnp_package_with_assets() {
        let temp_dir = std::env::temp_dir().join(format!("osa_tpl_pkg_{}", uuid::Uuid::new_v4()));
        let _ = std::fs::remove_dir_all(&temp_dir);
        std::fs::create_dir_all(&temp_dir).unwrap();
        let db = Database::init(temp_dir.join("test.db")).expect("Failed to init DB");

        // Create dummy local frame asset file
        let dummy_frame_path = temp_dir.join("gold_frame.png");
        std::fs::write(&dummy_frame_path, b"FAKE_PNG_BYTES").unwrap();

        // Save two templates in SQLite
        let mut spec1 = serde_json::from_str::<LayoutTemplateSpec>(&sample_spec_json("Package Layout 1")).unwrap();
        spec1.slots[0].frame_asset_local_path = Some(dummy_frame_path.to_string_lossy().to_string());
        let payload1 = serde_json::to_string(&spec1).unwrap();
        let tpl1 = db.save_layout_template("tpl-pkg-1", &payload1, false, None).unwrap();

        let payload2 = sample_spec_json("Package Layout 2");
        let tpl2 = db.save_layout_template("tpl-pkg-2", &payload2, false, None).unwrap();

        // Prepare export of both templates as .afsnp bundle
        let export_path = temp_dir.join("bundle.afsnp");
        let export_preview = prepare_export_layout_template(
            &[tpl1.id, tpl2.id],
            &export_path,
            &db,
        ).expect("Prepare export should succeed");

        assert_eq!(export_preview.template_count, 2);
        assert_eq!(export_preview.asset_count, 1);
        assert!(!export_preview.file_exists);

        // Execute export
        let final_path = execute_staged_template_export(&export_preview.token)
            .expect("Execute export should succeed");
        assert!(Path::new(&final_path).exists());

        // Import the package into a fresh database
        let temp_dir2 = std::env::temp_dir().join(format!("osa_tpl_dest_{}", uuid::Uuid::new_v4()));
        let db2 = Database::init(temp_dir2.join("dest.db")).unwrap();
        let frames_cache_dir = temp_dir2.join("frames_cache");

        let import_preview = prepare_import_layout_template_package(Path::new(&final_path), &db2)
            .expect("Prepare import package should succeed");
        assert_eq!(import_preview.total_count, 2);
        assert_eq!(import_preview.conflicts.len(), 0);

        let imported = execute_staged_template_import(
            &import_preview.token,
            "keep_both",
            Some(&frames_cache_dir),
            &db2,
        ).expect("Execute import package should succeed");

        assert_eq!(imported.len(), 2);
        // Verify frame asset extracted to frames_cache_dir
        let extracted_asset = frames_cache_dir.join("gold_frame.png");
        assert!(extracted_asset.exists(), "Custom frame asset should be extracted cleanly");
        let extracted_content = std::fs::read(&extracted_asset).unwrap();
        assert_eq!(extracted_content, b"FAKE_PNG_BYTES");

        // Verify frameAssetIsPro is normalized to false in both imported templates
        for imp in imported {
            assert!(imp.payload.contains(r#""frameAssetIsPro":false"#));
        }

        let _ = std::fs::remove_dir_all(&temp_dir);
        let _ = std::fs::remove_dir_all(&temp_dir2);
    }

    #[test]
    fn test_cancel_staged_op_cleans_up() {
        let temp_dir = std::env::temp_dir().join(format!("osa_tpl_cancel_{}", uuid::Uuid::new_v4()));
        let _ = std::fs::remove_dir_all(&temp_dir);
        std::fs::create_dir_all(&temp_dir).unwrap();
        let db = Database::init(temp_dir.join("test.db")).expect("Failed to init DB");

        let file_path = temp_dir.join("test.afsnt");
        std::fs::write(&file_path, sample_spec_json("To Cancel")).unwrap();

        let preview = prepare_import_layout_template(&file_path, &db).unwrap();
        assert!(cancel_staged_template_op(&preview.token));
        // Second cancel should return false because token was removed
        assert!(!cancel_staged_template_op(&preview.token));

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
