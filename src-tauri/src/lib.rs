pub mod db;

use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to IM MEDICOS Backend.", name)
}

/// Retrieves the active store details configuration from SQLite
#[tauri::command]
fn get_store_details(app: tauri::AppHandle) -> Result<Option<db::StoreDetails>, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;
    db::fetch_store_details(&conn).map_err(|e| e.to_string())
}

/// Saves the store details singleton to SQLite
#[tauri::command]
fn save_store_details(app: tauri::AppHandle, details: db::StoreDetails) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;
    db::persist_store_details(&conn, &details).map_err(|e| e.to_string())
}

/// Saves a pharmacy logo file into the local application data directory
#[tauri::command]
fn save_store_logo(app: tauri::AppHandle, bytes: Vec<u8>, extension: String) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let logos_dir = app_data_dir.join("logos");
    std::fs::create_dir_all(&logos_dir).map_err(|e| e.to_string())?;

    let ext = extension.trim_start_matches('.').to_lowercase();
    if ext != "png" && ext != "jpg" && ext != "jpeg" {
        return Err("Only PNG, JPG, and JPEG files are supported".into());
    }

    let filename = format!("pharmacy_logo.{}", ext);
    let target_path = logos_dir.join(&filename);
    std::fs::write(&target_path, bytes).map_err(|e| e.to_string())?;

    let relative_path = format!("logos/{}", filename);
    Ok(relative_path)
}

/// Removes existing pharmacy logo from local application data directory
#[tauri::command]
fn remove_store_logo(app: tauri::AppHandle) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let logos_dir = app_data_dir.join("logos");
    if logos_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(logos_dir) {
            for entry in entries.flatten() {
                if entry.file_name().to_string_lossy().starts_with("pharmacy_logo") {
                    std::fs::remove_file(entry.path()).ok();
                }
            }
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).ok();
            let db_path = app_data_dir.join("im_medicos.db");
            
            // Initialize SQLite database
            if let Err(e) = db::init_database(&db_path) {
                eprintln!("Failed to initialize database: {}", e);
            } else {
                println!("Database successfully connected at {:?}", db_path);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_store_details,
            save_store_details,
            save_store_logo,
            remove_store_logo
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

