use tauri::{Emitter, Manager, WindowEvent};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    name: String,
    path: String,
    size: u64,
    extension: String,
}

// Tauri command: 获取窗口信息
#[tauri::command]
fn get_window_info(window: tauri::WebviewWindow) -> Result<serde_json::Value, String> {
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
fn toggle_click_through(window: tauri::WebviewWindow, enabled: bool) -> Result<(), String> {
    window
        .set_ignore_cursor_events(enabled)
        .map_err(|e| e.to_string())
}

// Tauri command: 切换置顶
#[tauri::command]
fn toggle_always_on_top(window: tauri::WebviewWindow, enabled: bool) -> Result<(), String> {
    window.set_always_on_top(enabled).map_err(|e| e.to_string())
}

// Tauri command: 关闭窗口
#[tauri::command]
fn close_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            println!("[Tauri] Window initialized: decorations={}, alwaysOnTop={}",
                !window.is_decorated().unwrap_or(true),
                true
            );

            // 文件拖拽事件处理 (Tauri 2: on_window_event + DragDropEvent)
            let w = window.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::DragDrop(drag_event) = event {
                    match drag_event {
                        tauri::DragDropEvent::Drop { paths, position: _ } => {
                            let files: Vec<FileInfo> = paths
                                .iter()
                                .filter_map(|path| {
                                    let metadata = std::fs::metadata(path).ok()?;
                                    Some(FileInfo {
                                        name: path
                                            .file_name()
                                            .map(|n| n.to_string_lossy().to_string())
                                            .unwrap_or_default(),
                                        path: path.to_string_lossy().to_string(),
                                        size: metadata.len(),
                                        extension: path
                                            .extension()
                                            .map(|e| e.to_string_lossy().to_string())
                                            .unwrap_or_default(),
                                    })
                                })
                                .collect();

                            let _ = w.emit("file-dropped", &files);
                            println!("[Tauri] Dropped {} files", files.len());
                        }
                        tauri::DragDropEvent::Enter { paths, position: _ } => {
                            println!("[Tauri] Drag enter with {} files", paths.len());
                        }
                        tauri::DragDropEvent::Over { position: _ } => {}
                        tauri::DragDropEvent::Leave => {
                            println!("[Tauri] Drag cancelled");
                        }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_window_info,
            toggle_click_through,
            toggle_always_on_top,
            close_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
