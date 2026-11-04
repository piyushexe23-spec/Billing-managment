pub mod db;

use tauri::Manager;

fn format_error(e: impl std::fmt::Display) -> String {
    let s = e.to_string();
    if let Some(pos) = s.find("{\"field\":") {
        return s[pos..].to_string();
    }
    s
}

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

/// Retrieves all active medicines with their active batches (or all including archived)
#[tauri::command]
fn get_medicines(app: tauri::AppHandle, include_archived: Option<bool>) -> Result<Vec<db::MedicineWithBatches>, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;
    db::fetch_medicines_with_batches(&conn, include_archived.unwrap_or(false)).map_err(|e| e.to_string())
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
    .map_err(format_error)
}

/// Updates medicine master details
#[tauri::command]
fn update_medicine(app: tauri::AppHandle, medicine: db::MedicineMasterInput) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;
    db::update_medicine(&conn, &medicine).map_err(format_error)
}

/// Adds a new batch to an existing medicine or increments existing batch quantity
#[tauri::command]
fn add_medicine_batch(
    app: tauri::AppHandle,
    medicine_id: i64,
    batch_number: String,
    mfg_date: Option<String>,
    exp_date: String,
    cost_price: f64,
    mrp: f64,
    selling_price: f64,
    quantity_received: i64,
    note: Option<String>,
    add_to_existing: Option<bool>,
) -> Result<i64, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let mut conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;
    db::add_or_increment_batch(
        &mut conn,
        medicine_id,
        &batch_number,
        mfg_date.as_deref(),
        &exp_date,
        cost_price,
        mrp,
        selling_price,
        quantity_received,
        note.as_deref(),
        add_to_existing.unwrap_or(false),
    )
    .map_err(format_error)
}

/// Updates batch details (number, dates, prices)
#[tauri::command]
fn update_batch(
    app: tauri::AppHandle,
    batch_id: i64,
    batch_number: String,
    mfg_date: Option<String>,
    exp_date: String,
    cost_price: f64,
    mrp: f64,
    selling_price: f64,
) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;
    db::update_batch_details(
        &conn,
        batch_id,
        &batch_number,
        mfg_date.as_deref(),
        &exp_date,
        cost_price,
        mrp,
        selling_price,
    )
    .map_err(format_error)
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

/// Restores an archived medicine record
#[tauri::command]
fn restore_medicine(app: tauri::AppHandle, medicine_id: i64) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;
    db::restore_medicine(&conn, medicine_id).map_err(|e| e.to_string())
}

/// Checks if a medicine can be permanently deleted
#[tauri::command]
fn can_delete_medicine(app: tauri::AppHandle, medicine_id: i64) -> Result<(bool, String), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;
    db::check_can_delete_medicine(&conn, medicine_id).map_err(|e| e.to_string())
}

/// Permanently deletes an empty medicine that has zero movements and zero stock
#[tauri::command]
fn delete_medicine(app: tauri::AppHandle, medicine_id: i64) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let mut conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;
    db::delete_medicine_permanently(&mut conn, medicine_id).map_err(|e| e.to_string())
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

/// Generates next sequential bill number preview
#[tauri::command]
fn get_next_bill_number(app: tauri::AppHandle) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;
    db::fetch_next_bill_number_preview(&conn).map_err(|e| e.to_string())
}

/// Fetches saleable medicines with FEFO-sorted unexpired batches
#[tauri::command]
fn get_saleable_medicines(app: tauri::AppHandle) -> Result<Vec<db::SaleableMedicine>, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;
    db::fetch_saleable_medicines(&conn).map_err(|e| e.to_string())
}

/// Atomically saves bill, deducts stock, records stock movement, snapshots store & items
#[tauri::command]
fn save_bill(app: tauri::AppHandle, bill: db::SaveBillInput) -> Result<db::BillRecord, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let mut conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;
    db::save_bill_transaction(&mut conn, &bill).map_err(format_error)
}

/// Retrieves paginated bills matching filter criteria with calculated summary KPIs
#[tauri::command]
fn get_bills(app: tauri::AppHandle, filter: db::BillFilterInput) -> Result<db::PaginatedBillsResult, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;
    db::fetch_bills_paginated(&conn, &filter).map_err(|e| e.to_string())
}

/// Retrieves a single bill record by ID with snapshot and line items
#[tauri::command]
fn get_bill_by_id(app: tauri::AppHandle, id: i64) -> Result<Option<db::BillRecord>, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;
    db::fetch_bill_by_id(&conn, id).map_err(|e| e.to_string())
}

/// Retrieves paginated customers derived from saved bills
#[tauri::command]
fn get_customers(app: tauri::AppHandle, filter: db::CustomerFilterInput) -> Result<db::PaginatedCustomersResult, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;
    db::fetch_customers_paginated(&conn, &filter).map_err(|e| e.to_string())
}

/// Retrieves customer aggregate detail and bills
#[tauri::command]
fn get_customer_detail(
    app: tauri::AppHandle,
    mobile: String,
    from_date: Option<String>,
    to_date: Option<String>,
    search_bill: Option<String>,
) -> Result<Option<db::CustomerDetailResult>, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("im_medicos.db");
    let conn = db::get_connection(&db_path).map_err(|e| e.to_string())?;
    db::fetch_customer_detail(
        &conn,
        &mobile,
        from_date.as_deref(),
        to_date.as_deref(),
        search_bill.as_deref(),
    )
    .map_err(|e| e.to_string())
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
            update_medicine,
            add_medicine_batch,
            update_batch,
            adjust_stock,
            archive_medicine,
            restore_medicine,
            can_delete_medicine,
            delete_medicine,
            get_stock_movements,
            get_inventory_summary,
            get_next_bill_number,
            get_saleable_medicines,
            save_bill,
            get_bills,
            get_bill_by_id,
            get_customers,
            get_customer_detail
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

