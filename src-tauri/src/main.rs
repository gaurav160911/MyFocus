#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::{
    CustomMenuItem, GlobalShortcutManager, LogicalSize, Manager, Size, SystemTray, SystemTrayEvent,
    SystemTrayMenu, SystemTrayMenuItem, Window, WindowEvent,
};

/// Geometry constants.
const LOGO_SIZE: f64 = 48.0;
const WIDGET_WIDTH: f64 = 300.0;
const WIDGET_MIN_HEIGHT: f64 = 150.0;
const APP_WIDTH: f64 = 900.0;
const APP_HEIGHT: f64 = 640.0;

fn toggle_visibility(window: &Window) {
    match window.is_visible() {
        Ok(true) => {
            let _ = window.hide();
        }
        _ => {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

/// Set the window to the tiny logo size (collapsed state).
#[tauri::command]
fn enter_logo_mode(window: Window, always_on_top: bool) -> Result<(), String> {
    window.set_decorations(false).map_err(|e| e.to_string())?;
    window.set_resizable(false).map_err(|e| e.to_string())?;
    window
        .set_always_on_top(always_on_top)
        .map_err(|e| e.to_string())?;
    window
        .set_size(Size::Logical(LogicalSize {
            width: LOGO_SIZE,
            height: LOGO_SIZE,
        }))
        .map_err(|e| e.to_string())?;
    window
        .set_skip_taskbar(true)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Resize the widget to exactly fit its content. Called from the frontend
/// whenever the rendered height changes, so the widget never shows empty space.
#[tauri::command]
fn resize_widget(window: Window, height: f64) -> Result<(), String> {
    let clamped = height.max(WIDGET_MIN_HEIGHT).min(520.0);
    window
        .set_size(Size::Logical(LogicalSize {
            width: WIDGET_WIDTH,
            height: clamped,
        }))
        .map_err(|e| e.to_string())
}

/// Switch to the frameless always-on-top widget.
#[tauri::command]
fn enter_widget_mode(window: Window, always_on_top: bool) -> Result<(), String> {
    window.set_decorations(false).map_err(|e| e.to_string())?;
    window.set_resizable(false).map_err(|e| e.to_string())?;
    window
        .set_always_on_top(always_on_top)
        .map_err(|e| e.to_string())?;
    window
        .set_size(Size::Logical(LogicalSize {
            width: WIDGET_WIDTH,
            height: WIDGET_MIN_HEIGHT,
        }))
        .map_err(|e| e.to_string())?;
    window
        .set_skip_taskbar(true)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Switch to the full management window: decorated, resizable, not pinned.
#[tauri::command]
fn enter_app_mode(window: Window) -> Result<(), String> {
    window.set_decorations(true).map_err(|e| e.to_string())?;
    window.set_resizable(true).map_err(|e| e.to_string())?;
    window.set_always_on_top(false).map_err(|e| e.to_string())?;
    window
        .set_skip_taskbar(false)
        .map_err(|e| e.to_string())?;
    window
        .set_size(Size::Logical(LogicalSize {
            width: APP_WIDTH,
            height: APP_HEIGHT,
        }))
        .map_err(|e| e.to_string())?;
    let _ = window.center();
    let _ = window.set_focus();
    Ok(())
}

#[tauri::command]
fn set_always_on_top(window: Window, value: bool) -> Result<(), String> {
    window.set_always_on_top(value).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_opacity(_window: Window, _value: f64) -> Result<(), String> {
    // Per-window opacity is not exposed by Tauri v1 on Windows.
    // The frontend applies opacity to the widget surface instead.
    Ok(())
}

#[tauri::command]
fn set_autostart(enable: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let exe = std::env::current_exe()
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .to_string();
        let key = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
        let output = if enable {
            Command::new("reg")
                .args([
                    "add", key, "/v", "MyFocus", "/t", "REG_SZ", "/d", &exe, "/f",
                ])
                .output()
        } else {
            Command::new("reg")
                .args(["delete", key, "/v", "MyFocus", "/f"])
                .output()
        };
        match output {
            Ok(_) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = enable;
        Ok(())
    }
}

fn main() {
    let tray_menu = SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("open_widget", "Open Widget"))
        .add_item(CustomMenuItem::new("open_full_app", "Open Full App"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("toggle_startup", "Start with Windows"))
        .add_item(CustomMenuItem::new("toggle_aot", "Always on Top"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("quit", "Quit My Focus"));

    tauri::Builder::default()
        .system_tray(SystemTray::new().with_menu(tray_menu))
        .invoke_handler(tauri::generate_handler![
            resize_widget,
            enter_logo_mode,
            enter_widget_mode,
            enter_app_mode,
            set_always_on_top,
            set_opacity,
            set_autostart
        ])
        .on_system_tray_event(|app, event| {
            let window = match app.get_window("main") {
                Some(w) => w,
                None => return,
            };
            match event {
                SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                    "quit" => std::process::exit(0),
                    "open_widget" => {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.emit("tray://open-widget", ());
                    }
                    "open_full_app" => {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.emit("tray://open-full-app", ());
                    }
                    "toggle_startup" => {
                        let _ = window.emit("tray://toggle-startup", ());
                    }
                    "toggle_aot" => {
                        let _ = window.emit("tray://toggle-aot", ());
                    }
                    _ => {}
                },
                SystemTrayEvent::LeftClick { .. } => {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("tray://open-widget", ());
                }
                _ => {}
            }
        })
        .setup(|app| {
            let window = app.get_window("main").expect("main window missing");

            let toggle_target = window.clone();
            if let Err(err) = app
                .global_shortcut_manager()
                .register("Ctrl+Space", move || toggle_visibility(&toggle_target))
            {
                eprintln!("Failed to register Ctrl+Space: {}", err);
            }

            let add_target = window.clone();
            if let Err(err) = app.global_shortcut_manager().register("Ctrl+N", move || {
                let _ = add_target.show();
                let _ = add_target.set_focus();
                let _ = add_target.emit("tray://add-task", ());
            }) {
                eprintln!("Failed to register Ctrl+N: {}", err);
            }

            let _ = window.set_always_on_top(true);
            let _ = window.set_skip_taskbar(true);
            Ok(())
        })
        .on_window_event(|event| {
            if let WindowEvent::CloseRequested { api, .. } = event.event() {
                // Closing hides to tray; the app keeps running.
                let _ = event.window().hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
