use std::collections::HashMap;
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
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
    async createSdocWorkspaceFolder(directoryPath, relativePath) {
      return await internals.invoke("create_sdoc_workspace_folder", {
        directoryPath,
        relativePath
      });
    },
    async createSdocWorkspaceFile(directoryPath, relativePath, bytes) {
      return await internals.invoke("create_sdoc_workspace_file", {
        directoryPath,
        relativePath,
        bytes: toByteArray(bytes)
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
    #[serde(skip_serializing_if = "Option::is_none")]
    children: Option<Vec<WorkspaceEntry>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    size_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    modified_at_ms: Option<u64>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceMutationResult {
    status: String,
    path: String,
    relative_path: String,
    kind: WorkspaceEntryKind,
    message: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "kebab-case")]
enum WorkspaceEntryKind {
    Folder,
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
fn list_sdoc_workspace_entries(
    directory_path: String,
    include_unpacked_folders: bool,
) -> Result<Vec<WorkspaceEntry>, String> {
    let directory = PathBuf::from(directory_path);
    if !directory.is_dir() {
        return Err("Workspace path must be an existing directory.".to_string());
    }

    read_workspace_directory(&directory, include_unpacked_folders, 0)
}

fn read_workspace_directory(
    directory: &PathBuf,
    include_unpacked_folders: bool,
    depth: usize,
) -> Result<Vec<WorkspaceEntry>, String> {
    if depth > 32 {
        return Err("Workspace folder nesting exceeds the supported depth of 32.".to_string());
    }

    let mut entries = Vec::new();

    for item in fs::read_dir(directory).map_err(|error| error.to_string())? {
        let item = item.map_err(|error| error.to_string())?;
        let path = item.path();
        let file_type = item.file_type().map_err(|error| error.to_string())?;
        if file_type.is_symlink() {
            continue;
        }
        let metadata = item.metadata().map_err(|error| error.to_string())?;
        let name = item.file_name().to_string_lossy().to_string();

        if metadata.is_file() && has_extension(&path, "sdoc") {
            entries.push(WorkspaceEntry {
                name,
                path: path.to_string_lossy().to_string(),
                kind: WorkspaceEntryKind::SdocFile,
                children: None,
                size_bytes: Some(metadata.len()),
                modified_at_ms: modified_at_ms(&metadata),
            });
        } else if metadata.is_dir() {
            if is_unpacked_sdoc_folder(&path) {
                if include_unpacked_folders {
                    entries.push(WorkspaceEntry {
                        name,
                        path: path.to_string_lossy().to_string(),
                        kind: WorkspaceEntryKind::UnpackedSdocFolder,
                        children: None,
                        size_bytes: None,
                        modified_at_ms: modified_at_ms(&metadata),
                    });
                }
                continue;
            }

            entries.push(WorkspaceEntry {
                name,
                path: path.to_string_lossy().to_string(),
                kind: WorkspaceEntryKind::Folder,
                children: Some(read_workspace_directory(
                    &path,
                    include_unpacked_folders,
                    depth + 1,
                )?),
                size_bytes: None,
                modified_at_ms: modified_at_ms(&metadata),
            });
        }
    }

    Ok(entries)
}

#[tauri::command]
fn create_sdoc_workspace_folder(
    directory_path: String,
    relative_path: String,
) -> Result<WorkspaceMutationResult, String> {
    let (target, normalized_relative_path) =
        resolve_workspace_creation_target(&directory_path, &relative_path)?;
    fs::create_dir(&target)
        .map_err(|error| format!("Could not create workspace folder: {error}"))?;

    Ok(WorkspaceMutationResult {
        status: "created".to_string(),
        path: target.to_string_lossy().to_string(),
        relative_path: normalized_relative_path.clone(),
        kind: WorkspaceEntryKind::Folder,
        message: format!("Created folder {normalized_relative_path}."),
    })
}

#[tauri::command]
fn create_sdoc_workspace_file(
    directory_path: String,
    relative_path: String,
    bytes: Vec<u8>,
) -> Result<WorkspaceMutationResult, String> {
    if bytes.len() < 4 || !bytes.starts_with(&[80, 75]) {
        return Err("New workspace documents must be non-empty .sdoc ZIP packages.".to_string());
    }

    let (target, normalized_relative_path) =
        resolve_workspace_creation_target(&directory_path, &relative_path)?;
    if !has_extension(&target, "sdoc") {
        return Err("New workspace documents must use the .sdoc extension.".to_string());
    }

    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&target)
        .map_err(|error| format!("Could not create workspace document: {error}"))?;
    file.write_all(&bytes)
        .map_err(|error| format!("Could not write workspace document: {error}"))?;

    Ok(WorkspaceMutationResult {
        status: "created".to_string(),
        path: target.to_string_lossy().to_string(),
        relative_path: normalized_relative_path.clone(),
        kind: WorkspaceEntryKind::SdocFile,
        message: format!("Created document {normalized_relative_path}."),
    })
}

fn resolve_workspace_creation_target(
    directory_path: &str,
    relative_path: &str,
) -> Result<(PathBuf, String), String> {
    let workspace = fs::canonicalize(PathBuf::from(directory_path))
        .map_err(|error| format!("Could not resolve workspace folder: {error}"))?;
    if !workspace.is_dir() {
        return Err("Workspace path must be an existing directory.".to_string());
    }

    let relative = validate_workspace_relative_path(relative_path)?;
    let parent = relative.parent().unwrap_or_else(|| Path::new(""));
    ensure_workspace_parent_is_safe(&workspace, parent)?;
    let target = workspace.join(&relative);
    if fs::symlink_metadata(&target).is_ok() {
        return Err("A workspace entry with this name already exists.".to_string());
    }

    let normalized = relative
        .components()
        .filter_map(|component| match component {
            Component::Normal(value) => Some(value.to_string_lossy().to_string()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/");
    Ok((target, normalized))
}

fn validate_workspace_relative_path(value: &str) -> Result<PathBuf, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.contains('\\') || trimmed.contains(':') {
        return Err("Workspace target must be a non-empty relative path.".to_string());
    }

    let mut relative = PathBuf::new();
    for component in Path::new(trimmed).components() {
        let Component::Normal(name) = component else {
            return Err("Workspace target cannot use absolute or parent traversal paths.".to_string());
        };
        validate_workspace_name_component(&name.to_string_lossy())?;
        relative.push(name);
    }
    if relative.as_os_str().is_empty() {
        return Err("Workspace target must be a non-empty relative path.".to_string());
    }
    Ok(relative)
}

fn validate_workspace_name_component(value: &str) -> Result<(), String> {
    if value.is_empty()
        || value.len() > 128
        || value.ends_with('.')
        || value.ends_with(' ')
        || value
            .chars()
            .any(|character| character.is_control() || "<>\"|?*".contains(character))
    {
        return Err("Workspace entry name contains unsupported characters.".to_string());
    }

    let stem = value.split('.').next().unwrap_or(value).to_ascii_lowercase();
    let is_reserved = matches!(stem.as_str(), "con" | "prn" | "aux" | "nul")
        || (stem.len() == 4
            && (stem.starts_with("com") || stem.starts_with("lpt"))
            && stem.as_bytes()[3].is_ascii_digit()
            && stem.as_bytes()[3] != b'0');
    if is_reserved {
        return Err("Workspace entry name is reserved by the operating system.".to_string());
    }
    Ok(())
}

fn ensure_workspace_parent_is_safe(
    workspace: &Path,
    relative_parent: &Path,
) -> Result<(), String> {
    let mut current = workspace.to_path_buf();
    for component in relative_parent.components() {
        let Component::Normal(name) = component else {
            return Err("Workspace target cannot use parent traversal paths.".to_string());
        };
        current.push(name);
        let metadata = fs::symlink_metadata(&current)
            .map_err(|_| "Workspace target parent folder does not exist.".to_string())?;
        if metadata.file_type().is_symlink() {
            return Err("Workspace target cannot traverse a symlinked folder.".to_string());
        }
        if !metadata.is_dir() {
            return Err("Workspace target parent must be a folder.".to_string());
        }
    }
    Ok(())
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
            create_sdoc_workspace_folder,
            create_sdoc_workspace_file,
            checkout_drawio_source_asset,
            open_drawio_external_editor,
            read_drawio_external_edit,
            close_drawio_external_edit
        ])
        .run(tauri::generate_context!())
        .expect("failed to run SDoc desktop app");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_nested_sdoc_folders_without_following_symlinks() {
        let root = std::env::temp_dir().join(format!(
            "sdoc-workspace-tree-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let guides = root.join("Guides");
        let unpacked = root.join("review-copy");
        fs::create_dir_all(&guides).unwrap();
        fs::create_dir_all(&unpacked).unwrap();
        fs::write(root.join("Top.sdoc"), [80, 75, 3, 4]).unwrap();
        fs::write(root.join("notes.txt"), b"not listed").unwrap();
        fs::write(guides.join("Nested.sdoc"), [80, 75, 3, 4]).unwrap();
        fs::write(unpacked.join("manifest.json"), b"{}").unwrap();
        fs::write(unpacked.join("document.json"), b"{}").unwrap();
        fs::write(unpacked.join("metadata.json"), b"{}").unwrap();

        #[cfg(unix)]
        std::os::unix::fs::symlink(&guides, root.join("linked-guides")).unwrap();

        let entries =
            list_sdoc_workspace_entries(root.to_string_lossy().to_string(), false).unwrap();
        assert_eq!(entries.len(), 2);
        assert!(entries
            .iter()
            .any(|entry| entry.name == "Top.sdoc"
                && matches!(entry.kind, WorkspaceEntryKind::SdocFile)));
        let guides_entry = entries.iter().find(|entry| entry.name == "Guides").unwrap();
        assert!(matches!(guides_entry.kind, WorkspaceEntryKind::Folder));
        let children = guides_entry.children.as_ref().unwrap();
        assert_eq!(children.len(), 1);
        assert_eq!(children[0].name, "Nested.sdoc");
        assert!(!entries
            .iter()
            .any(|entry| entry.name == "review-copy" || entry.name == "linked-guides"));
        let serialized = serde_json::to_value(&entries).unwrap();
        assert!(serialized[0].get("children").is_some() || serialized[1].get("children").is_some());
        assert!(!serialized.to_string().contains("\"children\":null"));
        assert!(!serialized.to_string().contains("\"sizeBytes\":null"));

        let workspace_path = root.to_string_lossy().to_string();
        let created_folder =
            create_sdoc_workspace_folder(workspace_path.clone(), "Guides/New".to_string())
                .unwrap();
        assert_eq!(created_folder.relative_path, "Guides/New");
        assert!(root.join("Guides/New").is_dir());
        let created_file = create_sdoc_workspace_file(
            workspace_path.clone(),
            "Guides/New/Created.sdoc".to_string(),
            vec![80, 75, 3, 4],
        )
        .unwrap();
        assert_eq!(created_file.relative_path, "Guides/New/Created.sdoc");
        assert_eq!(
            fs::read(root.join("Guides/New/Created.sdoc")).unwrap(),
            vec![80, 75, 3, 4]
        );
        assert!(
            create_sdoc_workspace_folder(workspace_path.clone(), "../escape".to_string())
                .is_err()
        );
        assert!(create_sdoc_workspace_file(
            workspace_path.clone(),
            "Guides/New/Created.sdoc".to_string(),
            vec![80, 75, 3, 4],
        )
        .is_err());

        #[cfg(unix)]
        assert!(create_sdoc_workspace_folder(
            workspace_path,
            "linked-guides/Escape".to_string()
        )
        .is_err());

        fs::remove_dir_all(&root).unwrap();
    }
}
