use std::fs;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;

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

#[tauri::command]
fn read_sdoc_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(resolve_sdoc_path(path)?).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_sdoc_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_sdoc_file,
            write_sdoc_file,
            list_sdoc_workspace_entries
        ])
        .run(tauri::generate_context!())
        .expect("failed to run SDoc desktop app");
}
