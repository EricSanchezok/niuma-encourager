use tauri::{
    AppHandle, Manager, WebviewWindow, WindowEvent,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

const WINDOW_STATE: StateFlags = StateFlags::SIZE.union(StateFlags::POSITION);

fn save_window_state(app: &AppHandle) {
    if let Err(error) = app.save_window_state(WINDOW_STATE) {
        log::warn!("Could not save window position and size: {error}");
    }
}

fn ensure_window_visible(window: &WebviewWindow) -> tauri::Result<()> {
    let position = window.outer_position()?;
    let size = window.outer_size()?;
    let has_visible_header = window.available_monitors()?.iter().any(|monitor| {
        let monitor_position = monitor.position();
        let monitor_size = monitor.size();
        let left = i64::from(position.x).max(i64::from(monitor_position.x));
        let right = (i64::from(position.x) + i64::from(size.width))
            .min(i64::from(monitor_position.x) + i64::from(monitor_size.width));
        let top = i64::from(position.y).max(i64::from(monitor_position.y));
        let bottom = (i64::from(position.y) + 48)
            .min(i64::from(monitor_position.y) + i64::from(monitor_size.height));
        right - left >= 80 && bottom - top >= 32
    });

    if !has_visible_header {
        window.center()?;
    }
    Ok(())
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let result = (|| -> tauri::Result<()> {
            ensure_window_visible(&window)?;
            window.unminimize()?;
            window.show()?;
            window.set_focus()
        })();
        if let Err(error) = result {
            log::warn!("Could not show the main window: {error}");
        }
    }
}

fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
    let recover = MenuItem::with_id(app, "recover", "移回屏幕中央", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &recover, &quit])?;

    let mut tray = TrayIconBuilder::with_id("main-tray")
        .tooltip("牛马鼓励器")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main_window(app),
            "recover" => {
                if let Some(window) = app.get_webview_window("main") {
                    if let Err(error) = window.center() {
                        log::warn!("Could not center the main window: {error}");
                    }
                }
                show_main_window(app);
            }
            "quit" => {
                save_window_state(app);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            show_main_window(app);
        }))
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(WINDOW_STATE)
                .build(),
        )
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            create_tray(app.handle())?;
            show_main_window(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                save_window_state(window.app_handle());
                if let Err(error) = window.hide() {
                    log::warn!("Could not hide the main window: {error}");
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("could not build the desktop application");

    app.run(|app, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen { .. } = event {
            show_main_window(app);
        }
        if let tauri::RunEvent::ExitRequested { .. } = event {
            save_window_state(app);
        }
    });
}
