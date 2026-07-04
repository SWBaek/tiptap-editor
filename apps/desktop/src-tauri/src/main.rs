use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const SDOC_NATIVE_SAVE_BRIDGE_SCRIPT: &str = r#"
(() => {
  const key = "__SDOC_NATIVE_SAVE_BRIDGE__";
  const internals = window.__TAURI_INTERNALS__;

  if (!internals || window[key]) {
    return;
  }

  const ensureSdocFilename = (filename) => {
    const value = typeof filename === "string" ? filename.trim() : "";
    const fallback = value.length > 0 ? value : "document.sdoc";
    return /\.sdoc$/i.test(fallback) ? fallback : `${fallback}.sdoc`;
  };

  const normalizePath = (path) => {
    return typeof path === "string" && path.trim().length > 0 ? path : null;
  };

  const toByteArray = (bytes) => {
    if (bytes instanceof Uint8Array) {
      return Array.from(bytes);
    }
    return Array.from(new Uint8Array(bytes));
  };

  const hashBytes = (bytes) => {
    let hash = 0xcbf29ce484222325n;
    const prime = 0x100000001b3n;
    const mask = 0xffffffffffffffffn;

    for (const byte of bytes) {
      hash ^= BigInt(byte);
      hash = (hash * prime) & mask;
    }

    return hash.toString(16).padStart(16, "0");
  };

  window[key] = {
    async saveSdoc(path, bytes) {
      await internals.invoke("write_sdoc_file", {
        path,
        bytes: toByteArray(bytes)
      });
    },
    async chooseSdocSavePath(suggestedFilename) {
      const path = await internals.invoke("plugin:dialog|save", {
        options: {
          title: "Save SDoc document",
          defaultPath: ensureSdocFilename(suggestedFilename),
          filters: [
            {
              name: "SDoc document",
              extensions: ["sdoc"]
            }
          ]
        }
      });
      return normalizePath(path);
    },
    async openSdoc() {
      const path = await internals.invoke("plugin:dialog|open", {
        options: {
          title: "Open SDoc document",
          multiple: false,
          directory: false,
          filters: [
            {
              name: "SDoc document",
              extensions: ["sdoc"]
            }
          ]
        }
      });

      const normalizedPath = normalizePath(path);
      if (!normalizedPath) {
        return null;
      }

      const bytes = await internals.invoke("read_sdoc_file", {
        path: normalizedPath
      });

      return {
        path: normalizedPath,
        bytes: new Uint8Array(bytes)
      };
    },
    async openSdocPath(path) {
      const normalizedPath = normalizePath(path);
      if (!normalizedPath) {
        throw new Error("Native workspace open requires a .sdoc path.");
      }

      const bytes = await internals.invoke("read_sdoc_file", {
        path: normalizedPath
      });

      return {
        path: normalizedPath,
        bytes: new Uint8Array(bytes)
      };
    },
    async chooseSdocWorkspaceDirectory() {
      const path = await internals.invoke("plugin:dialog|open", {
        options: {
          title: "Open SDoc workspace folder",
          multiple: false,
          directory: true
        }
      });
      return normalizePath(path);
    },
    async listSdocWorkspaceEntries(directoryPath, options = {}) {
      return await internals.invoke("list_sdoc_workspace_entries", {
        directoryPath,
        includeUnpackedFolders: options.includeUnpackedFolders === true
      });
    },
    async checkoutDrawioSource(sourceAssetId, sourceBytes) {
      return await internals.invoke("checkout_drawio_source_asset", {
        sourceAssetId,
        sourceBytes: toByteArray(sourceBytes)
      });
    },
    async openDrawioExternalEditor(sessionId, executablePath) {
      return await internals.invoke("open_drawio_external_editor", {
        sessionId,
        executablePath: typeof executablePath === "string" && executablePath.trim().length > 0 ? executablePath.trim() : null
      });
    },
    async readDrawioExternalEdit(sessionId, latestSourceBytes) {
      const latestBytes = toByteArray(latestSourceBytes);
      const result = await internals.invoke("read_drawio_external_edit", {
        sessionId,
        latestSourceHash: hashBytes(latestBytes)
      });

      return {
        ...result,
        sourceBytes: result.sourceBytes ? new Uint8Array(result.sourceBytes) : undefined
      };
    },
    async closeDrawioExternalEdit(sessionId) {
      return await internals.invoke("close_drawio_external_edit", {
        sessionId
      });
    }
  };
})();
"#;

struct AppState {
    drawio_sessions: Mutex<HashMap<String, DrawioSession>>,
}

struct DrawioSession {
    source_asset_id: String,
    temp_path: PathBuf,
    original_source_hash: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceEntry {
    name: String,
    path: String,
    kind: WorkspaceEntryKind,
    size_bytes: Option<u64>,
    modified_at_ms: Option<u64>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "kebab-case")]
enum WorkspaceEntryKind {
    SdocFile,
    UnpackedSdocFolder,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DrawioCheckoutResponse {
    session_id: String,
    source_asset_id: String,
    temp_path: String,
    original_source_hash: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DrawioStatusEvent {
    status: String,
    session_id: Option<String>,
    source_asset_id: Option<String>,
    temp_path: Option<String>,
    source_hash: Option<String>,
    message: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DrawioReadBackResponse {
    status: String,
    session_id: String,
    source_asset_id: String,
    temp_path: String,
    source_hash: Option<String>,
    source_bytes: Option<Vec<u8>>,
    message: Option<String>,
}

#[tauri::command]
fn read_sdoc_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(resolve_sdoc_path(path)?).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_sdoc_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    if bytes.is_empty() {
        return Err("Cannot write an empty .sdoc payload.".to_string());
    }

    fs::write(resolve_sdoc_path(path)?, bytes).map_err(|error| error.to_string())
}

#[tauri::command]
fn list_sdoc_workspace_entries(directory_path: String, include_unpacked_folders: bool) -> Result<Vec<WorkspaceEntry>, String> {
    let directory = PathBuf::from(directory_path);
    let mut entries = Vec::new();

    for item in fs::read_dir(&directory).map_err(|error| error.to_string())? {
        let item = item.map_err(|error| error.to_string())?;
        let path = item.path();
        let metadata = item.metadata().map_err(|error| error.to_string())?;
        let name = item.file_name().to_string_lossy().to_string();

        if metadata.is_file() && has_extension(&path, "sdoc") {
            entries.push(WorkspaceEntry {
                name,
                path: path.to_string_lossy().to_string(),
                kind: WorkspaceEntryKind::SdocFile,
                size_bytes: Some(metadata.len()),
                modified_at_ms: modified_at_ms(&metadata),
            });
        } else if include_unpacked_folders && metadata.is_dir() && is_unpacked_sdoc_folder(&path) {
            entries.push(WorkspaceEntry {
                name,
                path: path.to_string_lossy().to_string(),
                kind: WorkspaceEntryKind::UnpackedSdocFolder,
                size_bytes: None,
                modified_at_ms: modified_at_ms(&metadata),
            });
        }
    }

    Ok(entries)
}

#[tauri::command]
fn checkout_drawio_source_asset(
    state: tauri::State<'_, AppState>,
    source_asset_id: String,
    source_bytes: Vec<u8>,
) -> Result<DrawioCheckoutResponse, String> {
    if !is_usable_drawio_source(&source_bytes) {
        return Err("Invalid Draw.io source XML.".to_string());
    }

    let session_id = create_session_id();
    let temp_path = std::env::temp_dir()
        .join("sdoc-drawio")
        .join(&session_id)
        .join(safe_drawio_filename(&source_asset_id));
    let parent = temp_path
        .parent()
        .ok_or_else(|| "Cannot create Draw.io temp directory.".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    fs::write(&temp_path, &source_bytes).map_err(|error| error.to_string())?;

    let original_source_hash = hash_bytes(&source_bytes);
    let session = DrawioSession {
        source_asset_id: source_asset_id.clone(),
        temp_path: temp_path.clone(),
        original_source_hash: original_source_hash.clone(),
    };

    state
        .drawio_sessions
        .lock()
        .map_err(|_| "Draw.io session state is unavailable.".to_string())?
        .insert(session_id.clone(), session);

    Ok(DrawioCheckoutResponse {
        session_id,
        source_asset_id,
        temp_path: temp_path.to_string_lossy().to_string(),
        original_source_hash,
    })
}

#[tauri::command]
fn open_drawio_external_editor(
    state: tauri::State<'_, AppState>,
    session_id: String,
    executable_path: Option<String>,
) -> Result<DrawioStatusEvent, String> {
    let (source_asset_id, temp_path) = {
        let sessions = state
            .drawio_sessions
            .lock()
            .map_err(|_| "Draw.io session state is unavailable.".to_string())?;
        let session = sessions
            .get(&session_id)
            .ok_or_else(|| "Unknown Draw.io bridge session.".to_string())?;
        (session.source_asset_id.clone(), session.temp_path.clone())
    };

    let launch_result = if let Some(executable_path) = executable_path.filter(|value| !value.trim().is_empty()) {
        Command::new(executable_path).arg(&temp_path).spawn()
    } else {
        open_with_platform_default(&temp_path)
    };

    match launch_result {
        Ok(_) => Ok(drawio_status_event("opened", &session_id, &source_asset_id, &temp_path, None)),
        Err(error) => Ok(drawio_status_event(
            "launch-failed",
            &session_id,
            &source_asset_id,
            &temp_path,
            Some(error.to_string()),
        )),
    }
}

#[tauri::command]
fn read_drawio_external_edit(
    state: tauri::State<'_, AppState>,
    session_id: String,
    latest_source_hash: String,
) -> Result<DrawioReadBackResponse, String> {
    let (source_asset_id, temp_path, original_source_hash) = {
        let sessions = state
            .drawio_sessions
            .lock()
            .map_err(|_| "Draw.io session state is unavailable.".to_string())?;
        let session = sessions
            .get(&session_id)
            .ok_or_else(|| "Unknown Draw.io bridge session.".to_string())?;
        (
            session.source_asset_id.clone(),
            session.temp_path.clone(),
            session.original_source_hash.clone(),
        )
    };

    let source_bytes = fs::read(&temp_path).map_err(|error| error.to_string())?;
    let source_hash = hash_bytes(&source_bytes);

    if !is_usable_drawio_source(&source_bytes) {
        return Ok(drawio_read_back_response(
            "invalid-source",
            session_id,
            source_asset_id,
            temp_path,
            Some(source_hash),
            None,
            Some("External editor saved invalid Draw.io XML.".to_string()),
        ));
    }

    let status = if latest_source_hash == original_source_hash {
        "saved"
    } else {
        "conflict"
    };

    Ok(drawio_read_back_response(
        status,
        session_id,
        source_asset_id,
        temp_path,
        Some(source_hash),
        Some(source_bytes),
        None,
    ))
}

#[tauri::command]
fn close_drawio_external_edit(state: tauri::State<'_, AppState>, session_id: String) -> Result<DrawioStatusEvent, String> {
    let session = state
        .drawio_sessions
        .lock()
        .map_err(|_| "Draw.io session state is unavailable.".to_string())?
        .remove(&session_id)
        .ok_or_else(|| "Unknown Draw.io bridge session.".to_string())?;

    let cleanup_message = session
        .temp_path
        .parent()
        .and_then(|directory| fs::remove_dir_all(directory).err())
        .map(|error| format!("Temporary file cleanup failed: {error}"));

    Ok(drawio_status_event(
        "closed",
        &session_id,
        &session.source_asset_id,
        &session.temp_path,
        cleanup_message,
    ))
}

fn resolve_sdoc_path(path: String) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);

    if !has_extension(&path, "sdoc") {
        return Err("Only .sdoc files are supported by this adapter.".to_string());
    }

    Ok(path)
}

fn has_extension(path: &PathBuf, expected: &str) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case(expected))
        .unwrap_or(false)
}

fn is_unpacked_sdoc_folder(path: &PathBuf) -> bool {
    path.join("manifest.json").is_file() && path.join("document.json").is_file()
}

fn modified_at_ms(metadata: &fs::Metadata) -> Option<u64> {
    metadata
        .modified()
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .and_then(|duration| u64::try_from(duration.as_millis()).ok())
}

fn safe_drawio_filename(source_asset_id: &str) -> String {
    let clean = source_asset_id
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_') {
                character
            } else {
                '_'
            }
        })
        .collect::<String>();

    let lower = clean.to_ascii_lowercase();

    if lower.ends_with(".drawio") || lower.ends_with(".drawio.xml") {
        clean
    } else {
        format!("{clean}.drawio")
    }
}

fn create_session_id() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    format!("drawio-{millis}-{}", std::process::id())
}

fn hash_bytes(bytes: &[u8]) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;

    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }

    format!("{hash:016x}")
}

fn is_usable_drawio_source(bytes: &[u8]) -> bool {
    let text = String::from_utf8_lossy(bytes);
    let trimmed = text.trim_start_matches('\u{feff}').trim_start();
    trimmed.starts_with("<mxfile") || trimmed.starts_with("<diagram") || trimmed.contains("<mxfile ")
}

fn open_with_platform_default(path: &PathBuf) -> std::io::Result<std::process::Child> {
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .arg("/C")
            .arg("start")
            .arg("")
            .arg(path)
            .spawn()
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg(path).spawn()
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open").arg(path).spawn()
    }
}

fn drawio_status_event(
    status: &str,
    session_id: &str,
    source_asset_id: &str,
    temp_path: &PathBuf,
    message: Option<String>,
) -> DrawioStatusEvent {
    DrawioStatusEvent {
        status: status.to_string(),
        session_id: Some(session_id.to_string()),
        source_asset_id: Some(source_asset_id.to_string()),
        temp_path: Some(temp_path.to_string_lossy().to_string()),
        source_hash: None,
        message,
    }
}

fn drawio_read_back_response(
    status: &str,
    session_id: String,
    source_asset_id: String,
    temp_path: PathBuf,
    source_hash: Option<String>,
    source_bytes: Option<Vec<u8>>,
    message: Option<String>,
) -> DrawioReadBackResponse {
    DrawioReadBackResponse {
        status: status.to_string(),
        session_id,
        source_asset_id,
        temp_path: temp_path.to_string_lossy().to_string(),
        source_hash,
        source_bytes,
        message,
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let window_config = app
                .config()
                .app
                .windows
                .first()
                .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "Missing main window configuration."))?;

            tauri::WebviewWindowBuilder::from_config(app, window_config)?
                .initialization_script(SDOC_NATIVE_SAVE_BRIDGE_SCRIPT)
                .build()?;

            Ok(())
        })
        .manage(AppState {
            drawio_sessions: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            read_sdoc_file,
            write_sdoc_file,
            list_sdoc_workspace_entries,
            checkout_drawio_source_asset,
            open_drawio_external_editor,
            read_drawio_external_edit,
            close_drawio_external_edit
        ])
        .run(tauri::generate_context!())
        .expect("failed to run SDoc desktop app");
}
