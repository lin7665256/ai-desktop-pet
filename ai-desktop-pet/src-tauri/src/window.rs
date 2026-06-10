use tauri::{Emitter, Manager, PhysicalPosition, Position, WebviewWindow, WindowEvent};

use crate::commands::{self, FileInfo};

/// Set up window event handlers: drag-drop, position save on move
pub fn setup_window_events(window: &WebviewWindow) {
    let w = window.clone();
    window.on_window_event(move |event| {
        match event {
            // File drag-drop handling
            WindowEvent::DragDrop(drag_event) => {
                if let tauri::DragDropEvent::Drop { paths, position: _ } = drag_event {
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
                } else if let tauri::DragDropEvent::Enter { paths, position: _ } = drag_event {
                    println!("[Tauri] Drag enter with {} files", paths.len());
                } else if let tauri::DragDropEvent::Leave = drag_event {
                    println!("[Tauri] Drag cancelled");
                }
            }

            // Save window position on move
            WindowEvent::Moved(position) => {
                if position.x > -10000 && position.y > -10000 {
                    let _ = save_position_to_file(&w, position.x, position.y);
                }
            }

            _ => {}
        }
    });
}

/// Restore window position from saved state
pub fn restore_window_position(window: &WebviewWindow) {
    if let Ok(Some(pos)) = commands::load_window_position(window.clone()) {
        let _ = window.set_position(Position::Physical(PhysicalPosition::new(pos.x, pos.y)));
        println!("[Tauri] Restored window position to ({}, {})", pos.x, pos.y);
    } else {
        // Default: position at bottom-right of primary monitor
        if let Ok(Some(monitor)) = window.current_monitor() {
            let screen_size = monitor.size();
            let scale = monitor.scale_factor();
            let x = (screen_size.width as f64 / scale - 380.0) as i32;
            let y = (screen_size.height as f64 / scale - 500.0) as i32;
            let phys_x = (x as f64 * scale) as i32;
            let phys_y = (y as f64 * scale) as i32;
            let _ = window.set_position(Position::Physical(PhysicalPosition::new(phys_x, phys_y)));
            println!("[Tauri] Set default position to bottom-right");
        }
    }
}

/// Helper: save position to file
fn save_position_to_file(window: &WebviewWindow, x: i32, y: i32) -> Result<(), String> {
    let app_data = window
        .app_handle()
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&app_data).map_err(|e| e.to_string())?;
    let path = app_data.join("window_state.json");

    let pos = serde_json::json!({ "x": x, "y": y });
    let content = serde_json::to_string(&pos).map_err(|e| e.to_string())?;
    std::fs::write(path, content).map_err(|e| e.to_string())
}
