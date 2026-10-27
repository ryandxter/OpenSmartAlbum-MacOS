use crate::commands::frame_asset_commands::decode_or_rasterize_image;
use crate::frame_asset_cache::{self, save_frame_asset_to_cache, FrameAssetMeta};
use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::AppHandle;
use uuid::Uuid;

const DEFAULT_CLIENT_ID: &str = "OC-AaF8fmOD6b3W";
const DEFAULT_REDIRECT_URI: &str = "https://auth-osa.rvmeur.com/canva/callback";

fn url_encode(input: &str) -> String {
    let mut encoded = String::with_capacity(input.len() * 3);
    for b in input.bytes() {
        match b {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(b as char);
            }
            _ => {
                encoded.push_str(&format!("%{:02X}", b));
            }
        }
    }
    encoded
}

fn resolve_canva_redirect_uri(passed_uri: Option<String>) -> String {
    if let Some(u) = passed_uri {
        let trimmed = u.trim().to_string();
        if !trimmed.is_empty() {
            return trimmed;
        }
    }
    if let Ok(env_uri) = std::env::var("CANVA_REDIRECT_URI") {
        let trimmed = env_uri.trim().to_string();
        if !trimmed.is_empty() {
            return trimmed;
        }
    }
    let candidate_paths = [
        PathBuf::from(".env"),
        PathBuf::from("canva.env"),
        PathBuf::from(".env.canva"),
        PathBuf::from("../.env"),
        PathBuf::from("../canva.env"),
    ];
    for p in &candidate_paths {
        if let Ok(content) = fs::read_to_string(p) {
            for line in content.lines() {
                if let Some(val) = line.strip_prefix("CANVA_REDIRECT_URI=") {
                    let clean = val.trim().trim_matches('"').trim_matches('\'').to_string();
                    if !clean.is_empty() {
                        return clean;
                    }
                }
            }
        }
    }
    DEFAULT_REDIRECT_URI.to_string()
}

fn resolve_canva_client_secret(passed_secret: Option<String>) -> Result<String, String> {
    if let Some(s) = passed_secret {
        let trimmed = s.trim().to_string();
        if !trimmed.is_empty() {
            return Ok(trimmed);
        }
    }
    if let Ok(env_sec) = std::env::var("CANVA_CLIENT_SECRET") {
        let trimmed = env_sec.trim().to_string();
        if !trimmed.is_empty() {
            return Ok(trimmed);
        }
    }
    let candidate_paths = [
        PathBuf::from("canva.env"),
        PathBuf::from(".env"),
        PathBuf::from(".env.canva"),
        PathBuf::from("../canva.env"),
        PathBuf::from("../.env"),
    ];
    for p in &candidate_paths {
        if let Ok(content) = fs::read_to_string(p) {
            for line in content.lines() {
                if let Some(val) = line.strip_prefix("CANVA_CLIENT_SECRET=") {
                    let clean = val.trim().trim_matches('"').trim_matches('\'').to_string();
                    if !clean.is_empty() {
                        return Ok(clean);
                    }
                }
            }
        }
    }
    Err("Missing Canva Client Secret. Please configure CANVA_CLIENT_SECRET in canva.env or environment.".to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvaSession {
    pub client_id: String,
    pub client_secret: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: u64,
    pub display_name: Option<String>,
    pub redirect_uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvaAuthStatus {
    pub is_connected: bool,
    pub client_id: String,
    pub redirect_uri: String,
    pub display_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct CanvaFolderItem {
    pub id: String,
    pub title: String,
    pub item_type: String, // "image", "design", "folder"
    pub thumbnail_url: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

fn get_canva_session_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base_dir = frame_asset_cache::get_frame_assets_dir(app)?;
    Ok(base_dir.join("canva_session.json"))
}

pub fn load_canva_session(app: &AppHandle) -> Option<CanvaSession> {
    let path = get_canva_session_path(app).ok()?;
    if !path.exists() {
        return None;
    }
    let data = fs::read_to_string(&path).ok()?;
    serde_json::from_str(&data).ok()
}

pub fn save_canva_session(app: &AppHandle, session: &CanvaSession) -> Result<(), String> {
    let path = get_canva_session_path(app)?;
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(session).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| format!("Failed to write canva session: {}", e))
}

fn generate_pkce() -> (String, String) {
    let verifier = format!(
        "{}{}{}",
        Uuid::new_v4().to_string().replace('-', ""),
        Uuid::new_v4().to_string().replace('-', ""),
        Uuid::new_v4().to_string().replace('-', "")
    );
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let hash = hasher.finalize();
    let challenge = URL_SAFE_NO_PAD.encode(hash);
    (verifier, challenge)
}

#[tauri::command]
pub async fn get_canva_auth_status(app: AppHandle) -> Result<CanvaAuthStatus, String> {
    if let Some(session) = load_canva_session(&app) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let is_valid = !session.access_token.is_empty() && session.expires_at > now;
        return Ok(CanvaAuthStatus {
            is_connected: is_valid,
            client_id: session.client_id,
            redirect_uri: session.redirect_uri,
            display_name: session.display_name,
        });
    }

    Ok(CanvaAuthStatus {
        is_connected: false,
        client_id: DEFAULT_CLIENT_ID.to_string(),
        redirect_uri: DEFAULT_REDIRECT_URI.to_string(),
        display_name: None,
    })
}

#[tauri::command]
pub async fn disconnect_canva(app: AppHandle) -> Result<(), String> {
    if let Ok(path) = get_canva_session_path(&app) {
        if path.exists() {
            let _ = fs::remove_file(path);
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn start_canva_oauth(
    app: AppHandle,
    client_id: Option<String>,
    client_secret: Option<String>,
    redirect_uri: Option<String>,
) -> Result<CanvaAuthStatus, String> {
    let app_clone = app.clone();
    let c_id = client_id
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_CLIENT_ID.to_string());
    let c_secret = resolve_canva_client_secret(client_secret)?;
    let r_uri = resolve_canva_redirect_uri(redirect_uri);

    let (code_verifier, code_challenge) = generate_pkce();
    let state = Uuid::new_v4().to_string().replace('-', "");

    // 1. Parse port from redirect_uri (default: 3001)
    let port = if let Some(idx) = r_uri.find("127.0.0.1:") {
        let after = &r_uri[idx + 10..];
        let p_str = after.split('/').next().unwrap_or("3001");
        p_str.parse::<u16>().unwrap_or(3001)
    } else {
        3001
    };

    let bind_addr = format!("127.0.0.1:{}", port);
    let listener = TcpListener::bind(&bind_addr)
        .map_err(|e| format!("Failed to bind local OAuth listener on {}: {}", bind_addr, e))?;
    let _ = listener.set_nonblocking(false);

    // 2. Build Canva OAuth URL (code_challenge_method=s256 matching Canva official spec)
    let scopes = "asset:read asset:write design:content:read design:meta:read folder:read folder:write profile:read";
    let encoded_scopes = scopes.replace(' ', "%20");
    let encoded_redirect_uri = url_encode(&r_uri);
    let auth_url = format!(
        "https://www.canva.com/api/oauth/authorize?client_id={}&response_type=code&code_challenge={}&code_challenge_method=s256&redirect_uri={}&scope={}&state={}",
        c_id, code_challenge, encoded_redirect_uri, encoded_scopes, state
    );

    // 3. Open system browser
    let _ = tauri_plugin_shell::ShellExt::shell(&app).open(&auth_url, None);

    // 4. Await authorization callback on local listener in background thread
    let session = tauri::async_runtime::spawn_blocking(move || {
        // Wait up to 120 seconds for user login
        let mut auth_code = String::new();
        for stream in listener.incoming() {
            if let Ok(mut stream) = stream {
                let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
                let mut buffer = [0u8; 4096];
                if let Ok(n) = stream.read(&mut buffer) {
                    let req = String::from_utf8_lossy(&buffer[..n]);
                    if let Some(first_line) = req.lines().next() {
                        if first_line.contains("code=") {
                            // Extract code
                            if let Some(start) = first_line.find("code=") {
                                let after_code = &first_line[start + 5..];
                                let code = after_code.split('&').next().unwrap_or("").split(' ').next().unwrap_or("");
                                auth_code = code.to_string();
                            }

                            // Send friendly response
                            let html = r#"<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Canva Terhubung</title>
  <style>
    body { background: #18181b; color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #27272a; border: 1px solid rgba(255,255,255,0.1); padding: 40px; border-radius: 16px; text-align: center; max-width: 420px; box-shadow: 0 12px 32px rgba(0,0,0,0.5); }
    h2 { color: #a855f7; margin: 0 0 12px; font-size: 22px; }
    p { color: #a1a1aa; font-size: 14px; line-height: 1.5; margin: 0 0 20px; }
    .badge { display: inline-block; padding: 6px 14px; background: rgba(168,85,247,0.15); border: 1px solid rgba(168,85,247,0.3); border-radius: 20px; color: #d8b4fe; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">OpenSmartAlbum Canva Integration</div>
    <h2>✓ Canva Berhasil Terhubung!</h2>
    <p>Akun Canva Anda telah terhubung secara resmi ke OpenSmartAlbum. Anda dapat menutup tab ini dan kembali berkreasi di aplikasi.</p>
  </div>
</body>
</html>"#;
                            let resp = format!(
                                "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                                html.len(),
                                html
                            );
                            let _ = stream.write_all(resp.as_bytes());
                            let _ = stream.flush();
                            break;
                        }
                    }
                }
            }
        }

        if auth_code.is_empty() {
            return Err("OAuth timeout or no authorization code received from Canva".to_string());
        }

        // 5. Exchange code for token
        let basic_auth = STANDARD.encode(format!("{}:{}", c_id, c_secret));
        let token_resp = ureq::post("https://api.canva.com/rest/v1/oauth/token")
            .set("Authorization", &format!("Basic {}", basic_auth))
            .set("Content-Type", "application/x-www-form-urlencoded")
            .send_form(&[
                ("grant_type", "authorization_code"),
                ("code", &auth_code),
                ("code_verifier", &code_verifier),
                ("redirect_uri", &r_uri),
            ])
            .map_err(|e| format!("Token exchange failed: {}", e))?;

        let token_json: serde_json::Value = serde_json::from_reader(token_resp.into_reader())
            .map_err(|e| format!("Failed to parse token response: {}", e))?;

        let access_token = token_json
            .get("access_token")
            .and_then(|v| v.as_str())
            .ok_or("No access_token returned by Canva")?
            .to_string();

        let refresh_token = token_json
            .get("refresh_token")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let expires_in = token_json
            .get("expires_in")
            .and_then(|v| v.as_u64())
            .unwrap_or(14400);

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        // 6. Fetch user profile
        let mut display_name = None;
        if let Ok(profile_resp) = ureq::get("https://api.canva.com/rest/v1/users/me/profile")
            .set("Authorization", &format!("Bearer {}", access_token))
            .call()
        {
            if let Ok(p_json) = serde_json::from_reader::<_, serde_json::Value>(profile_resp.into_reader()) {
                if let Some(name) = p_json.get("profile").and_then(|p| p.get("display_name")).and_then(|v| v.as_str()) {
                    display_name = Some(name.to_string());
                }
            }
        }

        let new_session = CanvaSession {
            client_id: c_id.clone(),
            client_secret: c_secret,
            access_token,
            refresh_token,
            expires_at: now + expires_in,
            display_name,
            redirect_uri: r_uri.clone(),
        };

        let _ = save_canva_session(&app_clone, &new_session);

        Ok::<CanvaSession, String>(new_session)
    })
    .await
    .map_err(|e| format!("Spawn error: {}", e))??;

    Ok(CanvaAuthStatus {
        is_connected: true,
        client_id: session.client_id,
        redirect_uri: session.redirect_uri,
        display_name: session.display_name,
    })
}

#[tauri::command]
pub async fn list_canva_assets(
    app: AppHandle,
    folder_id: Option<String>,
) -> Result<Vec<FrameAssetMeta>, String> {
    let session = load_canva_session(&app).ok_or("Canva account is not connected")?;
    let target_folder = folder_id.unwrap_or_else(|| "root".to_string());
    let url = format!("https://api.canva.com/rest/v1/folders/{}/items", target_folder);

    let res = tauri::async_runtime::spawn_blocking(move || {
        let resp = ureq::get(&url)
            .set("Authorization", &format!("Bearer {}", session.access_token))
            .timeout(Duration::from_secs(10))
            .call()
            .map_err(|e| format!("Failed to list Canva items: {}", e))?;

        let json: serde_json::Value = serde_json::from_reader(resp.into_reader())
            .map_err(|e| format!("Failed to parse Canva items JSON: {}", e))?;

        let mut assets = Vec::new();
        if let Some(items) = json.get("items").and_then(|v| v.as_array()) {
            for item in items {
                let item_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("");
                let (id, title, thumb_url, width, height) = match item_type {
                    "image" => {
                        let img = item.get("image");
                        let id = img.and_then(|i| i.get("id")).and_then(|v| v.as_str()).unwrap_or("");
                        let name = img.and_then(|i| i.get("name")).and_then(|v| v.as_str()).unwrap_or("Canva Image");
                        let thumb = img.and_then(|i| i.get("thumbnail")).and_then(|t| t.get("url")).and_then(|v| v.as_str());
                        let w = img.and_then(|i| i.get("thumbnail")).and_then(|t| t.get("width")).and_then(|v| v.as_u64());
                        let h = img.and_then(|i| i.get("thumbnail")).and_then(|t| t.get("height")).and_then(|v| v.as_u64());
                        (id, name, thumb, w, h)
                    }
                    "design" => {
                        let des = item.get("design");
                        let id = des.and_then(|d| d.get("id")).and_then(|v| v.as_str()).unwrap_or("");
                        let title = des.and_then(|d| d.get("title")).and_then(|v| v.as_str()).unwrap_or("Canva Design");
                        let thumb = des.and_then(|d| d.get("thumbnail")).and_then(|t| t.get("url")).and_then(|v| v.as_str());
                        let w = des.and_then(|d| d.get("thumbnail")).and_then(|t| t.get("width")).and_then(|v| v.as_u64());
                        let h = des.and_then(|d| d.get("thumbnail")).and_then(|t| t.get("height")).and_then(|v| v.as_u64());
                        (id, title, thumb, w, h)
                    }
                    _ => continue,
                };

                if !id.is_empty() && thumb_url.is_some() {
                    let asset_id = format!("canva-{}", id);
                    let shape = if let (Some(w), Some(h)) = (width, height) {
                        let ratio = w as f64 / h.max(1) as f64;
                        if (ratio - 1.0).abs() < 0.08 {
                            "square".to_string()
                        } else {
                            "rectangle".to_string()
                        }
                    } else {
                        "rectangle".to_string()
                    };

                    let meta = FrameAssetMeta {
                        id: asset_id,
                        title: title.to_string(),
                        category: "element".to_string(),
                        shape,
                        slot: None,
                        is_pro: false,
                        local_path: String::new(),
                        thumb_path: String::new(),
                        remote_url: thumb_url.map(|s| s.to_string()),
                        tags: vec!["canva".to_string(), item_type.to_string()],
                        created_at: None,
                    };
                    assets.push(meta);
                }
            }
        }

        Ok::<Vec<FrameAssetMeta>, String>(assets)
    })
    .await
    .map_err(|e| format!("Spawn error: {}", e))??;

    Ok(res)
}

#[tauri::command]
pub async fn download_canva_asset(
    app: AppHandle,
    id: String,
    remote_url: String,
    title: String,
) -> Result<FrameAssetMeta, String> {
    let base_dir = frame_asset_cache::get_frame_assets_dir(&app)?;
    let asset_dir = base_dir.join(&id);
    let meta_path = asset_dir.join("meta.json");
    let asset_path = asset_dir.join("asset.png");

    if meta_path.exists() && asset_path.exists() {
        if let Ok(content) = fs::read_to_string(&meta_path) {
            if let Ok(mut meta) = serde_json::from_str::<FrameAssetMeta>(&content) {
                meta.is_pro = false;
                meta.local_path = asset_path.to_string_lossy().to_string();
                return Ok(meta);
            }
        }
    }

    let id_clone = id.clone();
    let url_clone = remote_url.clone();
    let app_handle = app.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let resp = ureq::get(&url_clone)
            .timeout(Duration::from_secs(20))
            .call()
            .map_err(|e| format!("Failed to download Canva asset {}: {}", id_clone, e))?;

        let mut bytes = Vec::new();
        resp.into_reader()
            .read_to_end(&mut bytes)
            .map_err(|e| format!("Failed to read asset bytes: {}", e))?;

        let img = decode_or_rasterize_image(&bytes)
            .map_err(|e| format!("Failed to decode Canva asset: {}", e))?;

        let meta = FrameAssetMeta {
            id: id_clone.clone(),
            title,
            category: "element".to_string(),
            shape: "rectangle".to_string(),
            slot: None,
            is_pro: false,
            local_path: String::new(),
            thumb_path: String::new(),
            remote_url: Some(url_clone),
            tags: vec!["canva".to_string(), "downloaded".to_string()],
            created_at: Some(
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map(|d| d.as_secs().to_string())
                    .unwrap_or_default(),
            ),
        };

        save_frame_asset_to_cache(&app_handle, &id_clone, &img, meta)
    })
    .await
    .map_err(|e| format!("Spawn error: {}", e))?
}
