mod commands;
mod window;

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            // Remove window shadow/border for clean transparent look
            let _ = window.set_shadow(false);

            // Set up system tray
            let show = MenuItem::with_id(app, "show", "显示", true, None::<&str>)?;
            let settings = MenuItem::with_id(app, "settings", "设置", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &settings, &quit])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "settings" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.emit("open-settings", ());
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            // Set up window event handlers (drag-drop, position save)
            window::setup_window_events(&window);

            // Restore window position
            window::restore_window_position(&window);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_window_info,
            commands::toggle_click_through,
            commands::toggle_always_on_top,
            commands::close_window,
            commands::read_file,
            commands::save_window_position,
            commands::load_window_position,
            commands::read_app_json,
            commands::write_app_json,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
