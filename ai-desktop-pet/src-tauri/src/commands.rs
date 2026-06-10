use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub extension: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileContent {
    pub content: String,
    pub is_binary: bool,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowPosition {
    pub x: i32,
    pub y: i32,
}

// Tauri command: 读取文件内容
#[tauri::command]
pub fn read_file(path: String) -> Result<FileContent, String> {
    let bytes = std::fs::read(&path).map_err(|e| format!("读取失败: {}", e))?;
    let size = bytes.len() as u64;

    match String::from_utf8(bytes.clone()) {
        Ok(text) => Ok(FileContent {
            content: text,
            is_binary: false,
            size,
        }),
        Err(_) => Ok(FileContent {
            content: base64::engine::general_purpose::STANDARD.encode(&bytes),
            is_binary: true,
            size,
        }),
    }
}

// Tauri command: 获取窗口信息
#[tauri::command]
pub fn get_window_info(window: tauri::WebviewWindow) -> Result<serde_json::Value, String> {
    let scale_factor = window.scale_factor().map_err(|e| e.to_string())?;
    let inner_size = window.inner_size().map_err(|e| e.to_string())?;
    let outer_position = window.outer_position().map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "scaleFactor": scale_factor,
        "innerSize": { "width": inner_size.width, "height": inner_size.height },
        "position": { "x": outer_position.x, "y": outer_position.y },
        "isAlwaysOnTop": true,
        "isTransparent": true,
        "isDecorated": false
    }))
}

// Tauri command: 切换鼠标穿透
#[tauri::command]
pub fn toggle_click_through(window: tauri::WebviewWindow, enabled: bool) -> Result<(), String> {
    window
        .set_ignore_cursor_events(enabled)
        .map_err(|e| e.to_string())
}

// Tauri command: 切换置顶
#[tauri::command]
pub fn toggle_always_on_top(window: tauri::WebviewWindow, enabled: bool) -> Result<(), String> {
    window.set_always_on_top(enabled).map_err(|e| e.to_string())
}

// Tauri command: 关闭窗口
#[tauri::command]
pub fn close_window(window: tauri::WebviewWindow) -> Result<(), String> {
    if let Ok(pos) = window.outer_position() {
        let _ = save_position_to_file(&window, pos.x, pos.y);
    }
    window.close().map_err(|e| e.to_string())
}

// Tauri command: 保存窗口位置
#[tauri::command]
pub fn save_window_position(
    window: tauri::WebviewWindow,
    x: i32,
    y: i32,
) -> Result<(), String> {
    save_position_to_file(&window, x, y)
}

// Tauri command: 加载窗口位置
#[tauri::command]
pub fn load_window_position(window: tauri::WebviewWindow) -> Result<Option<WindowPosition>, String> {
    let path = get_position_file_path(&window)?;
    if !path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let pos: WindowPosition = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(Some(pos))
}

// Tauri command: 读取应用 JSON 文件 (settings.json, core_memory.json)
#[tauri::command]
pub fn read_app_json(window: tauri::WebviewWindow, filename: String) -> Result<Option<String>, String> {
    let app_data = window
        .app_handle()
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let path = app_data.join(&filename);
    if !path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(Some(content))
}

// Tauri command: 写入应用 JSON 文件
#[tauri::command]
pub fn write_app_json(window: tauri::WebviewWindow, filename: String, content: String) -> Result<(), String> {
    let app_data = window
        .app_handle()
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&app_data).map_err(|e| e.to_string())?;
    let path = app_data.join(&filename);
    std::fs::write(path, content).map_err(|e| e.to_string())
}

// Helper: get position file path
fn get_position_file_path(window: &tauri::WebviewWindow) -> Result<std::path::PathBuf, String> {
    let app_data = window
        .app_handle()
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&app_data).map_err(|e| e.to_string())?;
    Ok(app_data.join("window_state.json"))
}

// Helper: save position to file
fn save_position_to_file(
    window: &tauri::WebviewWindow,
    x: i32,
    y: i32,
) -> Result<(), String> {
    let path = get_position_file_path(window)?;
    let pos = WindowPosition { x, y };
    let content = serde_json::to_string(&pos).map_err(|e| e.to_string())?;
    std::fs::write(path, content).map_err(|e| e.to_string())
}
