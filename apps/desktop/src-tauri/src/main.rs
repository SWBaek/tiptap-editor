use std::fs;
use std::path::PathBuf;

#[tauri::command]
fn read_sdoc_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(resolve_sdoc_path(path)?).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_sdoc_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    fs::write(resolve_sdoc_path(path)?, bytes).map_err(|error| error.to_string())
}

fn resolve_sdoc_path(path: String) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);

    if path.extension().and_then(|extension| extension.to_str()) != Some("sdoc") {
        return Err("Only .sdoc files are supported by this adapter.".to_string());
    }

    Ok(path)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![read_sdoc_file, write_sdoc_file])
        .run(tauri::generate_context!())
        .expect("failed to run SDoc desktop app");
}
