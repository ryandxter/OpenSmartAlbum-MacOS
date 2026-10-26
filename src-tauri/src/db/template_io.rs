use super::*;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

fn template_error(message: impl std::fmt::Display) -> rusqlite::Error {
    rusqlite::Error::InvalidPath(message.to_string().into())
}

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
        let temp_dir = std::env::temp_dir().join(format!("afsn_tpl_crud_{}", uuid::Uuid::new_v4()));
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
}
