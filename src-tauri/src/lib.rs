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

/// Retrieves all active medicines with their active batches
#[tauri::command]
fn get_medicines(app: tauri::AppHandle) -> Result<Vec<db::MedicineWithBatches>, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;
    db::fetch_medicines_with_batches(&conn).map_err(|e| e.to_string())
}

/// Retrieves a specific medicine by ID with batches
#[tauri::command]
fn get_medicine_by_id(app: tauri::AppHandle, id: i64) -> Result<Option<db::MedicineWithBatches>, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;
    db::fetch_medicine_by_id(&conn, id).map_err(|e| e.to_string())
}

/// Creates a new medicine record and optional initial batch
#[tauri::command]
fn create_medicine(
    app: tauri::AppHandle,
    name: String,
    generic_name: Option<String>,
    manufacturer: Option<String>,
    category: Option<String>,
    description: Option<String>,
    barcode: Option<String>,
    hsn_code: Option<String>,
    unit: String,
    low_stock_threshold: i64,
    initial_batch: Option<db::MedicineBatch>,
) -> Result<i64, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let mut conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;

    db::insert_medicine_with_batch(
        &mut conn,
        &name,
        generic_name.as_deref(),
        manufacturer.as_deref(),
        category.as_deref(),
        description.as_deref(),
        barcode.as_deref(),
        hsn_code.as_deref(),
        &unit,
        low_stock_threshold,
        initial_batch.as_ref(),
    )
    .map_err(|e| e.to_string())
}

/// Adds a new batch to an existing medicine
#[tauri::command]
fn add_medicine_batch(
    app: tauri::AppHandle,
    medicine_id: i64,
    batch: db::MedicineBatch,
) -> Result<i64, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let mut conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;
    db::insert_batch(&mut conn, medicine_id, &batch).map_err(|e| e.to_string())
}

/// Adjusts stock for a specific batch and records movement history
#[tauri::command]
fn adjust_stock(
    app: tauri::AppHandle,
    medicine_id: i64,
    batch_id: i64,
    adjustment_type: String,
    quantity: i64,
    reason: String,
) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let mut conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;
    db::adjust_batch_stock(&mut conn, medicine_id, batch_id, &adjustment_type, quantity, &reason)
        .map_err(|e| e.to_string())
}

/// Archives a medicine record (soft delete)
#[tauri::command]
fn archive_medicine(app: tauri::AppHandle, medicine_id: i64) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;
    db::archive_medicine(&conn, medicine_id).map_err(|e| e.to_string())
}

/// Fetches stock movement audit history for a medicine
#[tauri::command]
fn get_stock_movements(app: tauri::AppHandle, medicine_id: i64) -> Result<Vec<db::StockMovement>, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;
    db::fetch_stock_movements(&conn, medicine_id).map_err(|e| e.to_string())
}

/// Fetches live inventory summary metrics
#[tauri::command]
fn get_inventory_summary(app: tauri::AppHandle) -> Result<db::InventorySummaryMetrics, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;
    db::fetch_inventory_summary(&conn).map_err(|e| e.to_string())
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
            remove_store_logo,
            get_medicines,
            get_medicine_by_id,
            create_medicine,
            add_medicine_batch,
            adjust_stock,
            archive_medicine,
            get_stock_movements,
            get_inventory_summary
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

