use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::asset_cache::{self, CacheCleanupReport, PhotoCacheStats};
use crate::db::Database;

/// Application information returned to the frontend.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: String,
    pub build_number: String,
    pub platform: String,
    pub db_schema_version: i32,
}

/// Database status information.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbStatus {
    pub connected: bool,
    pub schema_version: i32,
    pub expected_version: i32,
}

/// Get application info including version, platform, and database status.
#[tauri::command]
pub fn get_app_info(db: State<'_, Database>) -> Result<AppInfo, String> {
    let schema_version = db.get_schema_version().map_err(|e| e.to_string())?;

    Ok(AppInfo {
        version: format!("v{}", env!("CARGO_PKG_VERSION")),
        build_number: "1".to_string(),
        platform: std::env::consts::OS.to_string(),
        db_schema_version: schema_version,
    })
}

/// Get database connection status.
#[tauri::command]
pub fn get_db_status(db: State<'_, Database>) -> Result<DbStatus, String> {
    let schema_version = db.get_schema_version().map_err(|e| e.to_string())?;

    Ok(DbStatus {
        connected: true,
        schema_version,
        expected_version: Database::expected_version(),
    })
}

/// Return the total size and file count for generated thumbnail and preview assets.
#[tauri::command]
pub async fn get_photo_cache_stats(app: AppHandle) -> Result<PhotoCacheStats, String> {
    tauri::async_runtime::spawn_blocking(move || asset_cache::get_photo_cache_stats(&app))
        .await
        .map_err(|err| err.to_string())?
}

/// Remove only generated cache assets that are no longer referenced by any project.
#[tauri::command]
pub async fn clean_unused_photo_cache(app: AppHandle) -> Result<CacheCleanupReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = app.state::<Database>();
        asset_cache::cleanup_orphaned_photo_assets(&app, db.inner())
    })
    .await
    .map_err(|err| err.to_string())?
}

/// Gracefully restart the application (used after installing an update).
#[tauri::command]
pub fn restart_app(app: tauri::AppHandle) {
    app.restart();
}

/// Forcefully exit the application without saving.
#[tauri::command]
pub fn exit_app(app: tauri::AppHandle) {
    log::info!("exit_app invoked: terminating application runtime");
    app.exit(0);
    std::process::exit(0);
}

#[derive(Default)]
pub struct AppExitState {
    pub is_unsaved: std::sync::atomic::AtomicBool,
}

/// Synchronize project unsaved dirty state from frontend to native backend.
#[tauri::command]
pub fn set_unsaved_status(state: State<'_, AppExitState>, unsaved: bool) {
    state.is_unsaved.store(unsaved, std::sync::atomic::Ordering::Relaxed);
}

#[cfg(target_os = "windows")]
mod win32_color {
    #[link(name = "user32")]
    extern "system" {
        pub fn GetDC(hwnd: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
        pub fn ReleaseDC(hwnd: *mut std::ffi::c_void, hdc: *mut std::ffi::c_void) -> i32;
        pub fn GetCursorPos(point: *mut POINT) -> i32;
    }

    #[link(name = "gdi32")]
    extern "system" {
        pub fn GetPixel(hdc: *mut std::ffi::c_void, x: i32, y: i32) -> u32;
    }

    #[repr(C)]
    pub struct POINT {
        pub x: i32,
        pub y: i32,
    }
}

/// Sample exact pixel color from screen using native OS graphics API.
/// If x and y are provided, samples at that point; otherwise samples at current cursor position.
#[tauri::command]
pub fn sample_screen_color(x: Option<i32>, y: Option<i32>) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    unsafe {
        let (px, py) = match (x, y) {
            (Some(x), Some(y)) => (x, y),
            _ => {
                let mut pt = win32_color::POINT { x: 0, y: 0 };
                win32_color::GetCursorPos(&mut pt);
                (pt.x, pt.y)
            }
        };

        let hdc = win32_color::GetDC(std::ptr::null_mut());
        if hdc.is_null() {
            return Err("Failed to get screen DC".to_string());
        }

        let colorref = win32_color::GetPixel(hdc, px, py);
        win32_color::ReleaseDC(std::ptr::null_mut(), hdc);

        if colorref == 0xFFFFFFFF {
            return Err("Invalid pixel coordinate".to_string());
        }

        // COLORREF is 0x00BBGGRR
        let r = (colorref & 0xFF) as u8;
        let g = ((colorref >> 8) & 0xFF) as u8;
        let b = ((colorref >> 16) & 0xFF) as u8;

        Ok(format!("#{:02X}{:02X}{:02X}", r, g, b))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (x, y);
        Err("NATIVE_SAMPLING_UNAVAILABLE".to_string())
    }
}

/// System Font Information returned to frontend
#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SystemFontInfo {
    pub family: String,
    pub full_name: String,
    pub file_name: String,
}

#[cfg(target_os = "windows")]
mod win32_reg {
    #[link(name = "advapi32")]
    extern "system" {
        pub fn RegOpenKeyExW(
            hKey: isize,
            lpSubKey: *const u16,
            ulOptions: u32,
            samDesired: u32,
            phkResult: *mut isize,
        ) -> i32;

        pub fn RegEnumValueW(
            hKey: isize,
            dwIndex: u32,
            lpValueName: *mut u16,
            lpcchValueName: *mut u32,
            lpReserved: *mut u32,
            lpType: *mut u32,
            lpData: *mut u8,
            lpcbData: *mut u32,
        ) -> i32;

        pub fn RegCloseKey(hKey: isize) -> i32;
    }

    pub const HKEY_LOCAL_MACHINE: isize = -2147483646; // (LONG)0x80000002 as isize
    pub const HKEY_CURRENT_USER: isize = -2147483647;  // (LONG)0x80000001 as isize
    pub const KEY_READ: u32 = 0x20019;
}

/// Get all installed system fonts from Windows OS registry
#[tauri::command]
pub fn get_system_fonts() -> Result<Vec<SystemFontInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::collections::HashSet;

        let mut fonts: Vec<SystemFontInfo> = Vec::new();
        let mut seen_families = HashSet::new();

        let subkey: Vec<u16> = "SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts\0"
            .encode_utf16()
            .collect();

        // Scan both HKLM (system-wide) and HKCU (per-user installed fonts)
        for root_key in [win32_reg::HKEY_LOCAL_MACHINE, win32_reg::HKEY_CURRENT_USER] {
            let mut hkey: isize = 0;
            let status = unsafe {
                win32_reg::RegOpenKeyExW(
                    root_key,
                    subkey.as_ptr(),
                    0,
                    win32_reg::KEY_READ,
                    &mut hkey,
                )
            };

            if status == 0 && hkey != 0 {
                let mut index = 0;
                let mut name_buf = vec![0u16; 512];
                let mut data_buf = vec![0u8; 1024];

                loop {
                    let mut name_len = name_buf.len() as u32;
                    let mut data_len = data_buf.len() as u32;
                    let mut val_type = 0u32;

                    let enum_status = unsafe {
                        win32_reg::RegEnumValueW(
                            hkey,
                            index,
                            name_buf.as_mut_ptr(),
                            &mut name_len,
                            std::ptr::null_mut(),
                            &mut val_type,
                            data_buf.as_mut_ptr(),
                            &mut data_len,
                        )
                    };

                    if enum_status != 0 {
                        break;
                    }

                    let raw_name = String::from_utf16_lossy(&name_buf[..name_len as usize]);
                    let raw_name = raw_name.trim();

                    // Extract clean family name by stripping suffixes like " (TrueType)", " (OpenType)"
                    let clean_family = raw_name
                        .replace(" (TrueType)", "")
                        .replace(" (OpenType)", "")
                        .replace(" (All res)", "")
                        .trim()
                        .to_string();

                    // Extract file name from REG_SZ (type 1)
                    let file_name = if val_type == 1 && data_len >= 2 {
                        let u16_slice = unsafe {
                            std::slice::from_raw_parts(
                                data_buf.as_ptr() as *const u16,
                                (data_len / 2) as usize,
                            )
                        };
                        let s = String::from_utf16_lossy(u16_slice);
                        s.trim_matches('\0').trim().to_string()
                    } else {
                        String::new()
                    };

                    if !clean_family.is_empty() && !seen_families.contains(&clean_family.to_lowercase()) {
                        seen_families.insert(clean_family.to_lowercase());
                        fonts.push(SystemFontInfo {
                            family: clean_family,
                            full_name: raw_name.to_string(),
                            file_name,
                        });
                    }

                    index += 1;
                }

                unsafe { win32_reg::RegCloseKey(hkey) };
            }
        }

        // Sort alphabetically (A-Z)
        fonts.sort_by(|a, b| a.family.to_lowercase().cmp(&b.family.to_lowercase()));
        Ok(fonts)
    }

    #[cfg(target_os = "macos")]
    {
        use std::collections::HashSet;
        use std::path::Path;

        let mut fonts: Vec<SystemFontInfo> = Vec::new();
        let mut seen_families = HashSet::new();

        let mut font_dirs = vec![
            Path::new("/System/Library/Fonts").to_path_buf(),
            Path::new("/Library/Fonts").to_path_buf(),
        ];
        if let Ok(home) = std::env::var("HOME") {
            font_dirs.push(Path::new(&home).join("Library/Fonts"));
        }

        for dir in font_dirs {
            if let Ok(entries) = std::fs::read_dir(&dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                        let ext_lower = ext.to_lowercase();
                        if ext_lower == "ttf" || ext_lower == "otf" || ext_lower == "ttc" {
                            if let Ok(data) = std::fs::read(&path) {
                                if let Ok(face) = ttf_parser::Face::parse(&data, 0) {
                                    let mut family_name = None;
                                    let mut full_name = None;
                                    for name in face.names() {
                                        if name.name_id == ttf_parser::name_id::FAMILY {
                                            if let Some(s) = name.to_string() {
                                                family_name = Some(s);
                                            }
                                        } else if name.name_id == ttf_parser::name_id::FULL_NAME {
                                            if let Some(s) = name.to_string() {
                                                full_name = Some(s);
                                            }
                                        }
                                    }

                                    let clean_family = family_name.unwrap_or_else(|| {
                                        path.file_stem()
                                            .map(|s| s.to_string_lossy().to_string())
                                            .unwrap_or_default()
                                    });
                                    let clean_family = clean_family.trim().to_string();

                                    let full = full_name.unwrap_or_else(|| clean_family.clone());
                                    let file_name = path.file_name()
                                        .map(|s| s.to_string_lossy().to_string())
                                        .unwrap_or_default();

                                    if !clean_family.is_empty() && !seen_families.contains(&clean_family.to_lowercase()) {
                                        seen_families.insert(clean_family.to_lowercase());
                                        fonts.push(SystemFontInfo {
                                            family: clean_family,
                                            full_name: full,
                                            file_name,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        fonts.sort_by(|a, b| a.family.to_lowercase().cmp(&b.family.to_lowercase()));
        Ok(fonts)
    }

    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        Ok(Vec::new())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_system_fonts_smoke() {
        let fonts = get_system_fonts().expect("Failed to get system fonts");
        #[cfg(target_os = "windows")]
        {
            assert!(!fonts.is_empty(), "Should find fonts on Windows system");
            assert!(
                fonts.iter().any(|f| f.family.to_lowercase().contains("arial") || f.family.to_lowercase().contains("segoe")),
                "Should include Arial or Segoe UI"
            );
        }
        #[cfg(target_os = "macos")]
        {
            assert!(!fonts.is_empty(), "Should find fonts on macOS system");
            assert!(
                fonts.iter().any(|f| f.family.to_lowercase().contains("helvetica") || f.family.to_lowercase().contains("arial") || f.family.to_lowercase().contains("times")),
                "Should include standard system fonts like Helvetica or Arial"
            );
        }
    }
}
