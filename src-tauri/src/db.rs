use rusqlite::{Connection, Result, params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StoreDetails {
    pub id: i64,
    pub store_name: String,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub gstin: Option<String>,
    pub drug_license_1: Option<String>,
    pub drug_license_2: Option<String>,
    pub owner_name: Option<String>,
    pub pharmacist_name: Option<String>,
    pub pharmacist_reg_no: Option<String>,
    pub bill_prefix: String,
    pub starting_bill_number: i64,
    pub show_gstin_on_invoice: bool,
    pub show_amount_in_words: bool,
    pub footer_terms: Option<String>,
    pub bank_name: Option<String>,
    pub account_holder_name: Option<String>,
    pub account_number: Option<String>,
    pub ifsc_code: Option<String>,
    pub upi_id: Option<String>,
    pub low_stock_threshold: i64,
    pub logo_path: Option<String>,
    pub updated_at: Option<String>,
}

/// Initializes SQLite database and executes baseline migrations
pub fn init_database<P: AsRef<Path>>(path: P) -> Result<Connection> {
    let conn = Connection::open(path)?;

    // Enable foreign keys and WAL mode for high concurrency
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;"
    )?;

    create_tables(&conn)?;
    migrate_medicine_tables(&conn)?;
    migrate_billing_tables(&conn)?;
    migrate_backup_tables(&conn)?;
    seed_default_admin(&conn)?;
    seed_default_store(&conn)?;
    seed_default_backup_settings(&conn)?;
    cleanup_demo_medicines(&conn)?;

    Ok(conn)
}

/// Opens connection to existing database
pub fn get_connection<P: AsRef<Path>>(path: P) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;
    migrate_billing_tables(&conn).ok();
    migrate_backup_tables(&conn).ok();
    Ok(conn)
}

/// Baseline database schema definition
fn create_tables(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        -- System Configuration
        CREATE TABLE IF NOT EXISTS system_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Users and Roles
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin', 'pharmacist', 'biller')),
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Pharmacy Store Details (Singleton table enforced by CHECK constraint)
        CREATE TABLE IF NOT EXISTS store_details (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            store_name TEXT NOT NULL,
            address TEXT,
            phone TEXT,
            email TEXT,
            gstin TEXT,
            drug_license_1 TEXT,
            drug_license_2 TEXT,
            owner_name TEXT,
            pharmacist_name TEXT,
            pharmacist_reg_no TEXT,
            bill_prefix TEXT NOT NULL DEFAULT 'IM',
            starting_bill_number INTEGER NOT NULL DEFAULT 1,
            show_gstin_on_invoice INTEGER NOT NULL DEFAULT 1,
            show_amount_in_words INTEGER NOT NULL DEFAULT 1,
            footer_terms TEXT,
            bank_name TEXT,
            account_holder_name TEXT,
            account_number TEXT,
            ifsc_code TEXT,
            upi_id TEXT,
            low_stock_threshold INTEGER NOT NULL DEFAULT 10,
            logo_path TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Medicine Master Foundation (to be expanded in subsequent features)
        CREATE TABLE IF NOT EXISTS medicines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            generic_name TEXT,
            manufacturer TEXT,
            category TEXT,
            description TEXT,
            barcode TEXT,
            hsn_code TEXT,
            unit TEXT NOT NULL DEFAULT 'Tablet',
            low_stock_threshold INTEGER NOT NULL DEFAULT 10,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Medicine Batches (Relational batch-specific inventory and pricing)
        CREATE TABLE IF NOT EXISTS medicine_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
            batch_number TEXT NOT NULL,
            mfg_date DATE,
            exp_date DATE NOT NULL,
            cost_price REAL NOT NULL DEFAULT 0.0,
            mrp REAL NOT NULL DEFAULT 0.0,
            selling_price REAL NOT NULL DEFAULT 0.0,
            stock_qty INTEGER NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Stock Movements (Complete audit trail)
        CREATE TABLE IF NOT EXISTS stock_movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            medicine_id INTEGER NOT NULL REFERENCES medicines(id),
            batch_id INTEGER REFERENCES medicine_batches(id),
            movement_type TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            previous_qty INTEGER NOT NULL,
            new_qty INTEGER NOT NULL,
            reason TEXT,
            reference_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Indexes for high-performance pharmacy lookups
        CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
        CREATE INDEX IF NOT EXISTS idx_medicines_barcode ON medicines(barcode);
        CREATE INDEX IF NOT EXISTS idx_medicines_generic ON medicines(generic_name);
        CREATE INDEX IF NOT EXISTS idx_medicines_manufacturer ON medicines(manufacturer);
        CREATE INDEX IF NOT EXISTS idx_medicines_category ON medicines(category);
        CREATE INDEX IF NOT EXISTS idx_batches_med ON medicine_batches(medicine_id);
        CREATE INDEX IF NOT EXISTS idx_batches_exp ON medicine_batches(exp_date);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_medicine_batch ON medicine_batches(medicine_id, batch_number);
        CREATE INDEX IF NOT EXISTS idx_stock_movements_med ON stock_movements(medicine_id);

        -- Invoices / Bills Foundation (to be expanded in subsequent features)
        CREATE TABLE IF NOT EXISTS bills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bill_number TEXT NOT NULL UNIQUE,
            patient_name TEXT NOT NULL,
            doctor_name TEXT,
            total_amount REAL NOT NULL,
            discount_amount REAL DEFAULT 0,
            tax_amount REAL DEFAULT 0,
            net_amount REAL NOT NULL,
            payment_mode TEXT NOT NULL DEFAULT 'CASH',
            created_by INTEGER REFERENCES users(id),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        "#
    )?;

    Ok(())
}

/// Seeds default test administrator user if empty
fn seed_default_admin(conn: &Connection) -> Result<()> {
    let mut stmt = conn.prepare("SELECT COUNT(*) FROM users")?;
    let count: i64 = stmt.query_row([], |row| row.get(0))?;

    if count == 0 {
        conn.execute(
            "INSERT INTO users (username, password_hash, full_name, role)
             VALUES (?1, ?2, ?3, ?4)",
            params!["admin", "admin123", "System Administrator", "admin"],
        )?;
    }

    Ok(())
}

/// Seeds default store details configuration if empty
fn seed_default_store(conn: &Connection) -> Result<()> {
    let mut stmt = conn.prepare("SELECT COUNT(*) FROM store_details WHERE id = 1")?;
    let count: i64 = stmt.query_row([], |row| row.get(0))?;

    if count == 0 {
        conn.execute(
            r#"INSERT OR IGNORE INTO store_details (
                id, store_name, address, phone, email, gstin,
                drug_license_1, drug_license_2, owner_name, pharmacist_name, pharmacist_reg_no,
                bill_prefix, starting_bill_number, show_gstin_on_invoice, show_amount_in_words,
                footer_terms, bank_name, account_holder_name, account_number, ifsc_code, upi_id,
                low_stock_threshold, logo_path
            ) VALUES (
                1, 'IM MEDICOS PHARMACY', 'Shop No. 4, Medical Market, Main Hospital Road',
                '+91 98765 43210', 'contact@immedicos.com', '07AAAAA0000A1Z5',
                'DL-20B/12345/2024', 'DL-21B/12346/2024', 'Dr. Ramesh Kumar',
                'Suresh Sharma, B.Pharm', 'REG-DL-987654',
                'IM', 1, 1, 1,
                '1. Goods once sold will not be taken back without original cash memo.\n2. Prescribed medicines sold only on registered medical prescription.\n3. Keep medicines in a cool, dry place away from sunlight.',
                'State Bank of India', 'IM MEDICOS PHARMACY', '30987654321', 'SBIN0001234', 'immedicos@sbi',
                10, NULL
            )"#,
            [],
        )?;
    }

    Ok(())
}

/// Retrieves the active Store Details record (ID = 1)
pub fn fetch_store_details(conn: &Connection) -> Result<Option<StoreDetails>> {
    let mut stmt = conn.prepare(
        r#"SELECT 
            id, store_name, address, phone, email, gstin,
            drug_license_1, drug_license_2, owner_name, pharmacist_name, pharmacist_reg_no,
            bill_prefix, starting_bill_number, show_gstin_on_invoice, show_amount_in_words,
            footer_terms, bank_name, account_holder_name, account_number, ifsc_code, upi_id,
            low_stock_threshold, logo_path, updated_at
        FROM store_details WHERE id = 1"#
    )?;

    let mut rows = stmt.query([])?;
    if let Some(row) = rows.next()? {
        Ok(Some(StoreDetails {
            id: row.get(0)?,
            store_name: row.get(1)?,
            address: row.get(2)?,
            phone: row.get(3)?,
            email: row.get(4)?,
            gstin: row.get(5)?,
            drug_license_1: row.get(6)?,
            drug_license_2: row.get(7)?,
            owner_name: row.get(8)?,
            pharmacist_name: row.get(9)?,
            pharmacist_reg_no: row.get(10)?,
            bill_prefix: row.get(11)?,
            starting_bill_number: row.get(12)?,
            show_gstin_on_invoice: row.get::<_, i64>(13)? != 0,
            show_amount_in_words: row.get::<_, i64>(14)? != 0,
            footer_terms: row.get(15)?,
            bank_name: row.get(16)?,
            account_holder_name: row.get(17)?,
            account_number: row.get(18)?,
            ifsc_code: row.get(19)?,
            upi_id: row.get(20)?,
            low_stock_threshold: row.get(21)?,
            logo_path: row.get(22)?,
            updated_at: row.get(23)?,
        }))
    } else {
        Ok(None)
    }
}

/// Updates or inserts the singleton Store Details record (ID = 1)
pub fn persist_store_details(conn: &Connection, d: &StoreDetails) -> Result<()> {
    conn.execute(
        r#"INSERT INTO store_details (
            id, store_name, address, phone, email, gstin,
            drug_license_1, drug_license_2, owner_name, pharmacist_name, pharmacist_reg_no,
            bill_prefix, starting_bill_number, show_gstin_on_invoice, show_amount_in_words,
            footer_terms, bank_name, account_holder_name, account_number, ifsc_code, upi_id,
            low_stock_threshold, logo_path, updated_at
        ) VALUES (
            1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
            ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20,
            ?21, ?22, CURRENT_TIMESTAMP
        )
        ON CONFLICT(id) DO UPDATE SET
            store_name = excluded.store_name,
            address = excluded.address,
            phone = excluded.phone,
            email = excluded.email,
            gstin = excluded.gstin,
            drug_license_1 = excluded.drug_license_1,
            drug_license_2 = excluded.drug_license_2,
            owner_name = excluded.owner_name,
            pharmacist_name = excluded.pharmacist_name,
            pharmacist_reg_no = excluded.pharmacist_reg_no,
            bill_prefix = excluded.bill_prefix,
            starting_bill_number = excluded.starting_bill_number,
            show_gstin_on_invoice = excluded.show_gstin_on_invoice,
            show_amount_in_words = excluded.show_amount_in_words,
            footer_terms = excluded.footer_terms,
            bank_name = excluded.bank_name,
            account_holder_name = excluded.account_holder_name,
            account_number = excluded.account_number,
            ifsc_code = excluded.ifsc_code,
            upi_id = excluded.upi_id,
            low_stock_threshold = excluded.low_stock_threshold,
            logo_path = excluded.logo_path,
            updated_at = CURRENT_TIMESTAMP
        "#,
        params![
            d.store_name,
            d.address,
            d.phone,
            d.email,
            d.gstin,
            d.drug_license_1,
            d.drug_license_2,
            d.owner_name,
            d.pharmacist_name,
            d.pharmacist_reg_no,
            d.bill_prefix,
            d.starting_bill_number,
            if d.show_gstin_on_invoice { 1 } else { 0 },
            if d.show_amount_in_words { 1 } else { 0 },
            d.footer_terms,
            d.bank_name,
            d.account_holder_name,
            d.account_number,
            d.ifsc_code,
            d.upi_id,
            d.low_stock_threshold,
            d.logo_path,
        ],
    )?;

    Ok(())
}

// =====================================================================
// Medicine & Inventory Module Models & Database Layer (Command 04)
// =====================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MedicineBatch {
    pub id: i64,
    pub medicine_id: i64,
    pub batch_number: String,
    pub mfg_date: Option<String>,
    pub exp_date: String,
    pub cost_price: f64,
    pub mrp: f64,
    pub selling_price: f64,
    pub stock_qty: i64,
    pub is_active: bool,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MedicineMasterInput {
    pub id: i64,
    pub name: String,
    pub generic_name: Option<String>,
    pub manufacturer: Option<String>,
    pub category: Option<String>,
    pub description: Option<String>,
    pub barcode: Option<String>,
    pub hsn_code: Option<String>,
    pub unit: String,
    pub low_stock_threshold: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MedicineWithBatches {
    pub id: i64,
    pub name: String,
    pub generic_name: Option<String>,
    pub manufacturer: Option<String>,
    pub category: Option<String>,
    pub description: Option<String>,
    pub barcode: Option<String>,
    pub hsn_code: Option<String>,
    pub unit: String,
    pub low_stock_threshold: i64,
    pub is_active: bool,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub batches: Vec<MedicineBatch>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StockMovement {
    pub id: i64,
    pub medicine_id: i64,
    pub batch_id: Option<i64>,
    pub batch_number: Option<String>,
    pub medicine_name: Option<String>,
    pub movement_type: String,
    pub quantity: i64,
    pub previous_qty: i64,
    pub new_qty: i64,
    pub reason: Option<String>,
    pub reference_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TopSellingMedicineItem {
    pub medicine_id: i64,
    pub medicine_name: String,
    pub total_quantity_sold: i64,
    pub total_sales_amount: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InventorySummaryMetrics {
    pub total_medicines: i64,
    pub total_stock_units: i64,
    pub medicines_with_sales: i64,
    pub top_selling_medicines: Vec<TopSellingMedicineItem>,
    pub low_stock_count: i64,
    pub out_of_stock_count: i64,
    pub needs_restock_count: i64,
    pub expiring_soon_count: i64,
    pub expired_count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaleableBatch {
    pub id: i64,
    pub medicine_id: i64,
    pub batch_number: String,
    pub mfg_date: Option<String>,
    pub exp_date: String,
    pub cost_price: f64,
    pub mrp: f64,
    pub selling_price: f64,
    pub stock_qty: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaleableMedicine {
    pub id: i64,
    pub name: String,
    pub generic_name: Option<String>,
    pub manufacturer: Option<String>,
    pub category: Option<String>,
    pub barcode: Option<String>,
    pub unit: String,
    pub low_stock_threshold: i64,
    pub is_active: bool,
    pub total_saleable_stock: i64,
    pub nearest_expiry_date: Option<String>,
    pub batches: Vec<SaleableBatch>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaveBillItemInput {
    pub medicine_id: i64,
    pub batch_id: i64,
    pub medicine_name: String,
    pub batch_number: String,
    pub exp_date: String,
    pub unit: String,
    pub quantity: i64,
    pub cost_price: f64,
    pub mrp: f64,
    pub selling_price: f64,
    pub rate: f64,
    pub amount: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaveBillInput {
    pub customer_name: String,
    pub customer_mobile: String,
    pub doctor_name: Option<String>,
    pub discount_mode: String,
    pub payment_mode: String,
    pub items: Vec<SaveBillItemInput>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BillStoreSnapshot {
    pub store_name: String,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub gstin: Option<String>,
    pub drug_license_1: Option<String>,
    pub drug_license_2: Option<String>,
    pub footer_terms: Option<String>,
    pub show_gstin: bool,
    pub show_amount_in_words: bool,
    pub logo_path: Option<String>,
    pub tagline: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BillItemRecord {
    pub id: i64,
    pub bill_id: i64,
    pub medicine_id: i64,
    pub batch_id: i64,
    pub medicine_name: String,
    pub batch_number: String,
    pub exp_date: String,
    pub unit: String,
    pub quantity: i64,
    pub cost_price: f64,
    pub mrp: f64,
    pub selling_price: f64,
    pub rate: f64,
    pub amount: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BillRecord {
    pub id: i64,
    pub bill_number: String,
    pub customer_name: String,
    pub customer_mobile: String,
    pub doctor_name: Option<String>,
    pub bill_date: String,
    pub discount_mode: String,
    pub payment_mode: String,
    pub sub_total: f64,
    pub discount: f64,
    pub gst_total: f64,
    pub cgst: f64,
    pub sgst: f64,
    pub grand_total: f64,
    pub amount_in_words: String,
    pub store_snapshot: BillStoreSnapshot,
    pub items: Vec<BillItemRecord>,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BillFilterInput {
    pub from_date: Option<String>,
    pub to_date: Option<String>,
    pub search: Option<String>,
    pub payment_mode: Option<String>,
    pub discount_mode: Option<String>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BillHistorySummary {
    pub total_bills: i64,
    pub total_sales: f64,
    pub total_discount: f64,
    pub cash_sales: f64,
    pub upi_sales: f64,
    pub card_sales: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedBillsResult {
    pub bills: Vec<BillRecord>,
    pub total_count: i64,
    pub page: i64,
    pub page_size: i64,
    pub summary: BillHistorySummary,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CustomerFilterInput {
    pub from_date: Option<String>,
    pub to_date: Option<String>,
    pub search: Option<String>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CustomerListItem {
    pub mobile: String,
    pub display_name: String,
    pub other_names: Vec<String>,
    pub bills_count: i64,
    pub total_spent: f64,
    pub last_visit: String,
    pub first_visit: String,
    pub all_time_bills_count: i64,
    pub all_time_total_spent: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CustomersSummary {
    pub total_customers: i64,
    pub total_bills: i64,
    pub total_sales: f64,
    pub repeat_customers: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedCustomersResult {
    pub customers: Vec<CustomerListItem>,
    pub total_count: i64,
    pub page: i64,
    pub page_size: i64,
    pub summary: CustomersSummary,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CustomerDetailResult {
    pub customer: CustomerListItem,
    pub bills: Vec<BillRecord>,
}

/// Safely migrates existing medicine tables to add relational columns if missing
pub fn migrate_medicine_tables(conn: &Connection) -> Result<()> {
    let mut stmt = conn.prepare("PRAGMA table_info(medicines)")?;
    let cols: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .collect();

    if !cols.iter().any(|c| c == "manufacturer") {
        conn.execute("ALTER TABLE medicines ADD COLUMN manufacturer TEXT", [])?;
    }
    if !cols.iter().any(|c| c == "category") {
        conn.execute("ALTER TABLE medicines ADD COLUMN category TEXT", [])?;
    }
    if !cols.iter().any(|c| c == "description") {
        conn.execute("ALTER TABLE medicines ADD COLUMN description TEXT", [])?;
    }
    if !cols.iter().any(|c| c == "barcode") {
        conn.execute("ALTER TABLE medicines ADD COLUMN barcode TEXT", [])?;
    }
    if !cols.iter().any(|c| c == "unit") {
        conn.execute("ALTER TABLE medicines ADD COLUMN unit TEXT NOT NULL DEFAULT 'Tablet'", [])?;
    }
    if !cols.iter().any(|c| c == "low_stock_threshold") {
        conn.execute("ALTER TABLE medicines ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 10", [])?;
    }
    if !cols.iter().any(|c| c == "updated_at") {
        conn.execute("ALTER TABLE medicines ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP", [])?;
    }

    conn.execute_batch(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_medicine_batch ON medicine_batches(medicine_id, batch_number);"
    ).ok();

    Ok(())
}

/// Safely migrates billing and invoice tables (bills, bill_items)
pub fn migrate_billing_tables(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS bills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bill_number TEXT NOT NULL UNIQUE,
            customer_name TEXT NOT NULL,
            customer_mobile TEXT NOT NULL,
            doctor_name TEXT,
            bill_date TEXT NOT NULL,
            discount_mode TEXT NOT NULL DEFAULT 'NON_DISCOUNT',
            payment_mode TEXT NOT NULL DEFAULT 'CASH',
            sub_total REAL NOT NULL DEFAULT 0.0,
            discount REAL NOT NULL DEFAULT 0.0,
            gst_total REAL NOT NULL DEFAULT 0.0,
            cgst REAL NOT NULL DEFAULT 0.0,
            sgst REAL NOT NULL DEFAULT 0.0,
            grand_total REAL NOT NULL DEFAULT 0.0,
            amount_in_words TEXT,
            store_name TEXT,
            store_address TEXT,
            store_phone TEXT,
            store_email TEXT,
            store_gstin TEXT,
            store_dl_1 TEXT,
            store_dl_2 TEXT,
            store_footer_terms TEXT,
            store_logo_path TEXT,
            show_gstin INTEGER NOT NULL DEFAULT 1,
            show_amount_in_words INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'COMPLETED',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS bill_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE RESTRICT,
            medicine_id INTEGER NOT NULL REFERENCES medicines(id),
            batch_id INTEGER NOT NULL REFERENCES medicine_batches(id),
            medicine_name TEXT NOT NULL,
            batch_number TEXT NOT NULL,
            exp_date TEXT NOT NULL,
            unit TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            cost_price REAL NOT NULL,
            mrp REAL NOT NULL,
            selling_price REAL NOT NULL,
            rate REAL NOT NULL,
            amount REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);
        CREATE INDEX IF NOT EXISTS idx_bill_items_med ON bill_items(medicine_id);
        CREATE INDEX IF NOT EXISTS idx_bill_items_batch ON bill_items(batch_id);
        CREATE INDEX IF NOT EXISTS idx_bills_bill_date ON bills(bill_date);
        CREATE INDEX IF NOT EXISTS idx_bills_date_sub ON bills(substr(bill_date, 1, 10));
        CREATE INDEX IF NOT EXISTS idx_bills_payment_mode ON bills(payment_mode);
        CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at);
        CREATE INDEX IF NOT EXISTS idx_bills_customer_mobile ON bills(customer_mobile);
        "#
    )?;

    // Safe column additions in case bills was created earlier with draft columns
    let mut stmt = conn.prepare("PRAGMA table_info(bills)")?;
    let cols: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .collect();

    if !cols.iter().any(|c| c == "customer_name") {
        conn.execute("ALTER TABLE bills ADD COLUMN customer_name TEXT NOT NULL DEFAULT ''", []).ok();
    }
    if !cols.iter().any(|c| c == "customer_mobile") {
        conn.execute("ALTER TABLE bills ADD COLUMN customer_mobile TEXT NOT NULL DEFAULT ''", []).ok();
    }
    if !cols.iter().any(|c| c == "bill_date") {
        conn.execute("ALTER TABLE bills ADD COLUMN bill_date TEXT NOT NULL DEFAULT (date('now', 'localtime'))", []).ok();
    }
    if !cols.iter().any(|c| c == "discount_mode") {
        conn.execute("ALTER TABLE bills ADD COLUMN discount_mode TEXT NOT NULL DEFAULT 'NON_DISCOUNT'", []).ok();
    }
    if !cols.iter().any(|c| c == "sub_total") {
        conn.execute("ALTER TABLE bills ADD COLUMN sub_total REAL NOT NULL DEFAULT 0.0", []).ok();
    }
    if !cols.iter().any(|c| c == "discount") {
        conn.execute("ALTER TABLE bills ADD COLUMN discount REAL NOT NULL DEFAULT 0.0", []).ok();
    }
    if !cols.iter().any(|c| c == "gst_total") {
        conn.execute("ALTER TABLE bills ADD COLUMN gst_total REAL NOT NULL DEFAULT 0.0", []).ok();
    }
    if !cols.iter().any(|c| c == "cgst") {
        conn.execute("ALTER TABLE bills ADD COLUMN cgst REAL NOT NULL DEFAULT 0.0", []).ok();
    }
    if !cols.iter().any(|c| c == "sgst") {
        conn.execute("ALTER TABLE bills ADD COLUMN sgst REAL NOT NULL DEFAULT 0.0", []).ok();
    }
    if !cols.iter().any(|c| c == "grand_total") {
        conn.execute("ALTER TABLE bills ADD COLUMN grand_total REAL NOT NULL DEFAULT 0.0", []).ok();
    }
    if !cols.iter().any(|c| c == "amount_in_words") {
        conn.execute("ALTER TABLE bills ADD COLUMN amount_in_words TEXT", []).ok();
    }
    if !cols.iter().any(|c| c == "store_name") {
        conn.execute("ALTER TABLE bills ADD COLUMN store_name TEXT", []).ok();
    }
    if !cols.iter().any(|c| c == "store_address") {
        conn.execute("ALTER TABLE bills ADD COLUMN store_address TEXT", []).ok();
    }
    if !cols.iter().any(|c| c == "store_phone") {
        conn.execute("ALTER TABLE bills ADD COLUMN store_phone TEXT", []).ok();
    }
    if !cols.iter().any(|c| c == "store_email") {
        conn.execute("ALTER TABLE bills ADD COLUMN store_email TEXT", []).ok();
    }
    if !cols.iter().any(|c| c == "store_gstin") {
        conn.execute("ALTER TABLE bills ADD COLUMN store_gstin TEXT", []).ok();
    }
    if !cols.iter().any(|c| c == "store_dl_1") {
        conn.execute("ALTER TABLE bills ADD COLUMN store_dl_1 TEXT", []).ok();
    }
    if !cols.iter().any(|c| c == "store_dl_2") {
        conn.execute("ALTER TABLE bills ADD COLUMN store_dl_2 TEXT", []).ok();
    }
    if !cols.iter().any(|c| c == "store_footer_terms") {
        conn.execute("ALTER TABLE bills ADD COLUMN store_footer_terms TEXT", []).ok();
    }
    if !cols.iter().any(|c| c == "store_logo_path") {
        conn.execute("ALTER TABLE bills ADD COLUMN store_logo_path TEXT", []).ok();
    }
    if !cols.iter().any(|c| c == "show_gstin") {
        conn.execute("ALTER TABLE bills ADD COLUMN show_gstin INTEGER NOT NULL DEFAULT 1", []).ok();
    }
    if !cols.iter().any(|c| c == "show_amount_in_words") {
        conn.execute("ALTER TABLE bills ADD COLUMN show_amount_in_words INTEGER NOT NULL DEFAULT 1", []).ok();
    }
    if !cols.iter().any(|c| c == "status") {
        conn.execute("ALTER TABLE bills ADD COLUMN status TEXT NOT NULL DEFAULT 'COMPLETED'", []).ok();
    }

    Ok(())
}

/// Helper to construct JSON-serialized field-specific validation errors
pub fn make_field_error(field: &str, message: &str) -> rusqlite::Error {
    let json = serde_json::json!({
        "field": field,
        "message": message,
    });
    rusqlite::Error::UserFunctionError(json.to_string())
}

/// Cleans up any legacy hardcoded demo medicines so user starts with a clean inventory
pub fn cleanup_demo_medicines(conn: &Connection) -> Result<()> {
    conn.execute(
        "DELETE FROM stock_movements WHERE medicine_id IN (SELECT id FROM medicines WHERE name IN ('Dolo 650 Tablet', 'Augmentin 625 Duo', 'Azithral 500 Tablet', 'Cetcip 10mg'))",
        [],
    )?;
    conn.execute(
        "DELETE FROM medicine_batches WHERE medicine_id IN (SELECT id FROM medicines WHERE name IN ('Dolo 650 Tablet', 'Augmentin 625 Duo', 'Azithral 500 Tablet', 'Cetcip 10mg'))",
        [],
    )?;
    conn.execute(
        "DELETE FROM medicines WHERE name IN ('Dolo 650 Tablet', 'Augmentin 625 Duo', 'Azithral 500 Tablet', 'Cetcip 10mg')",
        [],
    )?;
    Ok(())
}

/// Fetches medicines along with their active batches (optionally including archived)
pub fn fetch_medicines_with_batches(conn: &Connection, include_archived: bool) -> Result<Vec<MedicineWithBatches>> {
    let sql = if include_archived {
        r#"SELECT id, name, generic_name, manufacturer, category, description, barcode, hsn_code, unit, low_stock_threshold, is_active, created_at, updated_at
           FROM medicines
           ORDER BY name ASC"#
    } else {
        r#"SELECT id, name, generic_name, manufacturer, category, description, barcode, hsn_code, unit, low_stock_threshold, is_active, created_at, updated_at
           FROM medicines
           WHERE is_active = 1
           ORDER BY name ASC"#
    };
    let mut stmt = conn.prepare(sql)?;

    let mut batch_stmt = conn.prepare(
        r#"SELECT id, medicine_id, batch_number, mfg_date, exp_date, cost_price, mrp, selling_price, stock_qty, is_active, created_at, updated_at
           FROM medicine_batches
           WHERE medicine_id = ?1 AND is_active = 1
           ORDER BY exp_date ASC"#,
    )?;

    let medicine_rows = stmt.query_map([], |row| {
        Ok(MedicineWithBatches {
            id: row.get(0)?,
            name: row.get(1)?,
            generic_name: row.get(2)?,
            manufacturer: row.get(3)?,
            category: row.get(4)?,
            description: row.get(5)?,
            barcode: row.get(6)?,
            hsn_code: row.get(7)?,
            unit: row.get(8)?,
            low_stock_threshold: row.get(9)?,
            is_active: row.get::<_, i64>(10)? != 0,
            created_at: row.get(11)?,
            updated_at: row.get(12)?,
            batches: Vec::new(),
        })
    })?;

    let mut result = Vec::new();
    for med in medicine_rows {
        let mut med = med?;
        let batches = batch_stmt.query_map(params![med.id], |row| {
            Ok(MedicineBatch {
                id: row.get(0)?,
                medicine_id: row.get(1)?,
                batch_number: row.get(2)?,
                mfg_date: row.get(3)?,
                exp_date: row.get(4)?,
                cost_price: row.get(5)?,
                mrp: row.get(6)?,
                selling_price: row.get(7)?,
                stock_qty: row.get(8)?,
                is_active: row.get::<_, i64>(9)? != 0,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;

        for b in batches {
            med.batches.push(b?);
        }
        result.push(med);
    }

    Ok(result)
}

/// Fetches a single medicine by ID with all batches
pub fn fetch_medicine_by_id(conn: &Connection, medicine_id: i64) -> Result<Option<MedicineWithBatches>> {
    let mut stmt = conn.prepare(
        r#"SELECT id, name, generic_name, manufacturer, category, description, barcode, hsn_code, unit, low_stock_threshold, is_active, created_at, updated_at
           FROM medicines
           WHERE id = ?1"#,
    )?;

    let mut batch_stmt = conn.prepare(
        r#"SELECT id, medicine_id, batch_number, mfg_date, exp_date, cost_price, mrp, selling_price, stock_qty, is_active, created_at, updated_at
           FROM medicine_batches
           WHERE medicine_id = ?1 AND is_active = 1
           ORDER BY exp_date ASC"#,
    )?;

    let mut rows = stmt.query(params![medicine_id])?;
    if let Some(row) = rows.next()? {
        let mut med = MedicineWithBatches {
            id: row.get(0)?,
            name: row.get(1)?,
            generic_name: row.get(2)?,
            manufacturer: row.get(3)?,
            category: row.get(4)?,
            description: row.get(5)?,
            barcode: row.get(6)?,
            hsn_code: row.get(7)?,
            unit: row.get(8)?,
            low_stock_threshold: row.get(9)?,
            is_active: row.get::<_, i64>(10)? != 0,
            created_at: row.get(11)?,
            updated_at: row.get(12)?,
            batches: Vec::new(),
        };

        let batches = batch_stmt.query_map(params![medicine_id], |b_row| {
            Ok(MedicineBatch {
                id: b_row.get(0)?,
                medicine_id: b_row.get(1)?,
                batch_number: b_row.get(2)?,
                mfg_date: b_row.get(3)?,
                exp_date: b_row.get(4)?,
                cost_price: b_row.get(5)?,
                mrp: b_row.get(6)?,
                selling_price: b_row.get(7)?,
                stock_qty: b_row.get(8)?,
                is_active: b_row.get::<_, i64>(9)? != 0,
                created_at: b_row.get(10)?,
                updated_at: b_row.get(11)?,
            })
        })?;

        for b in batches {
            med.batches.push(b?);
        }

        Ok(Some(med))
    } else {
        Ok(None)
    }
}

/// Creates a new medicine and optional initial batch in a single database transaction
pub fn insert_medicine_with_batch(
    conn: &mut Connection,
    name: &str,
    generic_name: Option<&str>,
    manufacturer: Option<&str>,
    category: Option<&str>,
    description: Option<&str>,
    barcode: Option<&str>,
    hsn_code: Option<&str>,
    unit: &str,
    low_stock_threshold: i64,
    batch: Option<&MedicineBatch>,
) -> Result<i64> {
    if name.trim().is_empty() {
        return Err(make_field_error("name", "Medicine name cannot be empty"));
    }

    // Check duplicate medicine (same name + manufacturer, case-insensitive, trimmed)
    let duplicate_med_id: Option<i64> = conn.query_row(
        "SELECT id FROM medicines WHERE LOWER(TRIM(name)) = LOWER(TRIM(?1)) AND LOWER(TRIM(COALESCE(manufacturer, ''))) = LOWER(TRIM(COALESCE(?2, ''))) AND is_active = 1",
        params![name.trim(), manufacturer.map(|s| s.trim()).unwrap_or("")],
        |row| row.get(0),
    ).optional()?;

    if duplicate_med_id.is_some() {
        return Err(make_field_error("name", "This medicine already exists. Use Add New Batch on that medicine instead."));
    }

    if let Some(b) = batch {
        if b.batch_number.trim().is_empty() {
            return Err(make_field_error("batchNumber", "Batch number cannot be empty"));
        }
        if b.exp_date.trim().is_empty() {
            return Err(make_field_error("expDate", "Expiry date is required"));
        }
        if b.exp_date.trim().len() != 10 {
            return Err(make_field_error("expDate", "Enter a valid date"));
        }
        if let Some(mfg) = &b.mfg_date {
            if !mfg.trim().is_empty() && b.exp_date.trim() < mfg.trim() {
                return Err(make_field_error("mfgDate", "Manufacturing date cannot be after expiry date"));
            }
        }
        if b.stock_qty < 1 {
            return Err(make_field_error("stockQty", "Quantity must be at least 1"));
        }
        if b.cost_price < 0.0 {
            return Err(make_field_error("costPrice", "Cost price cannot be negative"));
        }
        if b.mrp <= 0.0 {
            return Err(make_field_error("mrp", "MRP must be greater than 0"));
        }
        if b.selling_price < 0.0 {
            return Err(make_field_error("sellingPrice", "Selling price cannot be negative"));
        }
    }

    let tx = conn.transaction()?;

    tx.execute(
        r#"INSERT INTO medicines (name, generic_name, manufacturer, category, description, barcode, hsn_code, unit, low_stock_threshold, is_active, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"#,
        params![name.trim(), generic_name.map(|s| s.trim()), manufacturer.map(|s| s.trim()), category.map(|s| s.trim()), description.map(|s| s.trim()), barcode.map(|s| s.trim()), hsn_code.map(|s| s.trim()), unit.trim(), low_stock_threshold],
    )?;

    let medicine_id = tx.last_insert_rowid();

    if let Some(b) = batch {
        tx.execute(
            r#"INSERT INTO medicine_batches (medicine_id, batch_number, mfg_date, exp_date, cost_price, mrp, selling_price, stock_qty, is_active, created_at, updated_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"#,
            params![medicine_id, b.batch_number.trim().to_uppercase(), b.mfg_date.as_deref().map(|s| s.trim()), b.exp_date.trim(), b.cost_price, b.mrp, b.selling_price, b.stock_qty],
        )?;

        let batch_id = tx.last_insert_rowid();

        tx.execute(
            r#"INSERT INTO stock_movements (medicine_id, batch_id, movement_type, quantity, previous_qty, new_qty, reason)
               VALUES (?1, ?2, 'OPENING_STOCK', ?3, 0, ?3, 'Initial batch opening stock')"#,
            params![medicine_id, batch_id, b.stock_qty],
        )?;
    }

    tx.commit()?;
    Ok(medicine_id)
}

/// Adds a new batch to an existing medicine
pub fn insert_batch(conn: &mut Connection, medicine_id: i64, batch: &MedicineBatch) -> Result<i64> {
    let tx = conn.transaction()?;

    tx.execute(
        r#"INSERT INTO medicine_batches (medicine_id, batch_number, mfg_date, exp_date, cost_price, mrp, selling_price, stock_qty, is_active, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"#,
        params![medicine_id, batch.batch_number, batch.mfg_date, batch.exp_date, batch.cost_price, batch.mrp, batch.selling_price, batch.stock_qty],
    )?;

    let batch_id = tx.last_insert_rowid();

    tx.execute(
        r#"INSERT INTO stock_movements (medicine_id, batch_id, movement_type, quantity, previous_qty, new_qty, reason)
           VALUES (?1, ?2, 'PURCHASE', ?3, 0, ?3, 'New batch received')"#,
        params![medicine_id, batch_id, batch.stock_qty],
    )?;

    tx.commit()?;
    Ok(batch_id)
}

/// Adjusts stock for a specific batch and records audit history
pub fn adjust_batch_stock(
    conn: &mut Connection,
    medicine_id: i64,
    batch_id: i64,
    adj_type: &str,
    qty: i64,
    reason: &str,
) -> Result<()> {
    if qty <= 0 {
        return Err(rusqlite::Error::UserFunctionError("Adjustment quantity must be greater than zero".into()));
    }

    let tx = conn.transaction()?;

    let current_qty: i64 = tx.query_row(
        "SELECT stock_qty FROM medicine_batches WHERE id = ?1 AND medicine_id = ?2",
        params![batch_id, medicine_id],
        |row| row.get(0),
    )?;

    let (new_qty, movement_type) = if adj_type == "ADD" {
        (current_qty + qty, "ADJUSTMENT_ADD")
    } else if adj_type == "REDUCE" {
        if current_qty < qty {
            return Err(rusqlite::Error::UserFunctionError("Cannot reduce stock below zero".into()));
        }
        (current_qty - qty, "ADJUSTMENT_REDUCE")
    } else {
        return Err(rusqlite::Error::UserFunctionError("Invalid adjustment type".into()));
    };

    tx.execute(
        "UPDATE medicine_batches SET stock_qty = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        params![new_qty, batch_id],
    )?;

    tx.execute(
        r#"INSERT INTO stock_movements (medicine_id, batch_id, movement_type, quantity, previous_qty, new_qty, reason)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"#,
        params![medicine_id, batch_id, movement_type, qty, current_qty, new_qty, reason],
    )?;

    tx.commit()?;
    Ok(())
}

/// Updates an existing medicine master info
pub fn update_medicine(conn: &Connection, input: &MedicineMasterInput) -> Result<()> {
    if input.name.trim().is_empty() {
        return Err(make_field_error("name", "Medicine name cannot be empty"));
    }
    if input.low_stock_threshold < 0 {
        return Err(make_field_error("lowStockThreshold", "Low stock threshold cannot be negative"));
    }

    // Duplicate medicine check excluding current medicine
    let duplicate_id: Option<i64> = conn.query_row(
        "SELECT id FROM medicines WHERE id != ?1 AND LOWER(TRIM(name)) = LOWER(TRIM(?2)) AND LOWER(TRIM(COALESCE(manufacturer, ''))) = LOWER(TRIM(COALESCE(?3, ''))) AND is_active = 1",
        params![input.id, input.name.trim(), input.manufacturer.as_deref().unwrap_or("")],
        |row| row.get(0),
    ).optional()?;

    if duplicate_id.is_some() {
        return Err(make_field_error("name", "This medicine already exists. Use Add New Batch on that medicine instead."));
    }

    conn.execute(
        r#"UPDATE medicines SET
            name = ?1,
            generic_name = ?2,
            manufacturer = ?3,
            category = ?4,
            description = ?5,
            barcode = ?6,
            hsn_code = ?7,
            unit = ?8,
            low_stock_threshold = ?9,
            updated_at = CURRENT_TIMESTAMP
           WHERE id = ?10"#,
        params![
            input.name.trim(),
            input.generic_name.as_deref().map(|s| s.trim()),
            input.manufacturer.as_deref().map(|s| s.trim()),
            input.category.as_deref().map(|s| s.trim()),
            input.description.as_deref().map(|s| s.trim()),
            input.barcode.as_deref().map(|s| s.trim()),
            input.hsn_code.as_deref().map(|s| s.trim()),
            input.unit.trim(),
            input.low_stock_threshold,
            input.id
        ],
    )?;
    Ok(())
}

/// Adds a new batch to an existing medicine or increments existing batch stock in a transaction
pub fn add_or_increment_batch(
    conn: &mut Connection,
    medicine_id: i64,
    batch_number: &str,
    mfg_date: Option<&str>,
    exp_date: &str,
    cost_price: f64,
    mrp: f64,
    selling_price: f64,
    quantity_received: i64,
    note: Option<&str>,
    add_to_existing: bool,
) -> Result<i64> {
    if batch_number.trim().is_empty() {
        return Err(make_field_error("batchNumber", "Batch number cannot be empty"));
    }
    if exp_date.trim().is_empty() {
        return Err(make_field_error("expDate", "Expiry date is required"));
    }
    if exp_date.trim().len() != 10 {
        return Err(make_field_error("expDate", "Enter a valid date"));
    }
    if let Some(mfg) = mfg_date {
        if !mfg.trim().is_empty() && exp_date.trim() < mfg.trim() {
            return Err(make_field_error("mfgDate", "Manufacturing date cannot be after expiry date"));
        }
    }
    if quantity_received < 1 {
        return Err(make_field_error("quantityReceived", "Quantity must be at least 1"));
    }
    if cost_price < 0.0 {
        return Err(make_field_error("costPrice", "Cost price cannot be negative"));
    }
    if mrp <= 0.0 {
        return Err(make_field_error("mrp", "MRP must be greater than 0"));
    }
    if selling_price < 0.0 {
        return Err(make_field_error("sellingPrice", "Selling price cannot be negative"));
    }

    let tx = conn.transaction()?;

    // Check if batch number already exists for this medicine (case-insensitive)
    let existing_batch: Option<(i64, i64)> = tx.query_row(
        "SELECT id, stock_qty FROM medicine_batches WHERE medicine_id = ?1 AND LOWER(TRIM(batch_number)) = LOWER(TRIM(?2))",
        params![medicine_id, batch_number.trim()],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).optional()?;

    let (batch_id, prev_qty, new_qty) = match existing_batch {
        Some((id, current_stock)) => {
            if !add_to_existing {
                return Err(make_field_error("batchNumber", "This batch number already exists for this medicine."));
            }
            let new_stock = current_stock + quantity_received;
            tx.execute(
                r#"UPDATE medicine_batches SET
                    stock_qty = ?1,
                    cost_price = ?2,
                    mrp = ?3,
                    selling_price = ?4,
                    exp_date = ?5,
                    mfg_date = COALESCE(?6, mfg_date),
                    updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?7"#,
                params![new_stock, cost_price, mrp, selling_price, exp_date.trim(), mfg_date.map(|s| s.trim()), id],
            )?;
            (id, current_stock, new_stock)
        }
        None => {
            tx.execute(
                r#"INSERT INTO medicine_batches (medicine_id, batch_number, mfg_date, exp_date, cost_price, mrp, selling_price, stock_qty, is_active, created_at, updated_at)
                   VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"#,
                params![
                    medicine_id,
                    batch_number.trim().to_uppercase(),
                    mfg_date.map(|s| s.trim()),
                    exp_date.trim(),
                    cost_price,
                    mrp,
                    selling_price,
                    quantity_received
                ],
            )?;
            let id = tx.last_insert_rowid();
            (id, 0, quantity_received)
        }
    };

    let reason_str = match note {
        Some(n) if !n.trim().is_empty() => n.trim().to_string(),
        _ => "Purchase / New Batch".to_string(),
    };

    tx.execute(
        r#"INSERT INTO stock_movements (medicine_id, batch_id, movement_type, quantity, previous_qty, new_qty, reason, created_at)
           VALUES (?1, ?2, 'PURCHASE', ?3, ?4, ?5, ?6, CURRENT_TIMESTAMP)"#,
        params![medicine_id, batch_id, quantity_received, prev_qty, new_qty, reason_str],
    )?;

    tx.commit()?;
    Ok(batch_id)
}

/// Updates details of a specific batch (number, dates, prices)
pub fn update_batch_details(
    conn: &Connection,
    batch_id: i64,
    batch_number: &str,
    mfg_date: Option<&str>,
    exp_date: &str,
    cost_price: f64,
    mrp: f64,
    selling_price: f64,
) -> Result<()> {
    if batch_number.trim().is_empty() {
        return Err(make_field_error("batchNumber", "Batch number cannot be empty"));
    }
    if exp_date.trim().is_empty() {
        return Err(make_field_error("expDate", "Expiry date is required"));
    }
    if exp_date.trim().len() != 10 {
        return Err(make_field_error("expDate", "Enter a valid date"));
    }
    if let Some(mfg) = mfg_date {
        if !mfg.trim().is_empty() && exp_date.trim() < mfg.trim() {
            return Err(make_field_error("mfgDate", "Manufacturing date cannot be after expiry date"));
        }
    }
    if cost_price < 0.0 {
        return Err(make_field_error("costPrice", "Cost price cannot be negative"));
    }
    if mrp <= 0.0 {
        return Err(make_field_error("mrp", "MRP must be greater than 0"));
    }
    if selling_price < 0.0 {
        return Err(make_field_error("sellingPrice", "Selling price cannot be negative"));
    }

    // Duplicate batch check excluding the current batch
    let duplicate_id: Option<i64> = conn.query_row(
        "SELECT id FROM medicine_batches WHERE medicine_id = (SELECT medicine_id FROM medicine_batches WHERE id = ?1) AND id != ?1 AND LOWER(TRIM(batch_number)) = LOWER(TRIM(?2)) AND is_active = 1",
        params![batch_id, batch_number.trim()],
        |row| row.get(0),
    ).optional()?;

    if duplicate_id.is_some() {
        return Err(make_field_error("batchNumber", "This batch number already exists for this medicine."));
    }

    conn.execute(
        r#"UPDATE medicine_batches SET
            batch_number = ?1,
            mfg_date = ?2,
            exp_date = ?3,
            cost_price = ?4,
            mrp = ?5,
            selling_price = ?6,
            updated_at = CURRENT_TIMESTAMP
           WHERE id = ?7"#,
        params![
            batch_number.trim().to_uppercase(),
            mfg_date.map(|s| s.trim()),
            exp_date.trim(),
            cost_price,
            mrp,
            selling_price,
            batch_id
        ],
    )?;
    Ok(())
}

/// Soft deletes / archives a medicine so it cannot be selected in future billing
pub fn archive_medicine(conn: &Connection, medicine_id: i64) -> Result<()> {
    conn.execute(
        "UPDATE medicines SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        params![medicine_id],
    )?;
    Ok(())
}

/// Restores an archived medicine record
pub fn restore_medicine(conn: &Connection, medicine_id: i64) -> Result<()> {
    conn.execute(
        "UPDATE medicines SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        params![medicine_id],
    )?;
    Ok(())
}

/// Checks if a medicine can be permanently deleted
pub fn check_can_delete_medicine(conn: &Connection, medicine_id: i64) -> Result<(bool, String)> {
    let movement_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM stock_movements WHERE medicine_id = ?1",
        params![medicine_id],
        |row| row.get(0),
    )?;

    let total_stock: i64 = conn.query_row(
        "SELECT COALESCE(SUM(stock_qty), 0) FROM medicine_batches WHERE medicine_id = ?1",
        params![medicine_id],
        |row| row.get(0),
    )?;

    if movement_count > 0 || total_stock > 0 {
        let reason = format!(
            "This medicine has recorded history ({} stock units across batches, {} audit movement records). To preserve regulatory and accounting history, it cannot be permanently deleted. Please use Archive instead.",
            total_stock, movement_count
        );
        Ok((false, reason))
    } else {
        Ok((true, "Medicine has no stock or audit history and can be safely deleted.".into()))
    }
}

/// Permanently deletes an empty medicine that has zero movements and zero stock
pub fn delete_medicine_permanently(conn: &mut Connection, medicine_id: i64) -> Result<()> {
    let (can_delete, reason) = check_can_delete_medicine(conn, medicine_id)?;
    if !can_delete {
        return Err(rusqlite::Error::UserFunctionError(reason));
    }
    let tx = conn.transaction()?;
    tx.execute("DELETE FROM medicine_batches WHERE medicine_id = ?1", params![medicine_id])?;
    tx.execute("DELETE FROM medicines WHERE id = ?1", params![medicine_id])?;
    tx.commit()?;
    Ok(())
}

/// Retrieves stock movements for a specific medicine
pub fn fetch_stock_movements(conn: &Connection, medicine_id: i64) -> Result<Vec<StockMovement>> {
    let mut stmt = conn.prepare(
        r#"SELECT sm.id, sm.medicine_id, sm.batch_id, b.batch_number, m.name, sm.movement_type, sm.quantity, sm.previous_qty, sm.new_qty, sm.reason, sm.reference_id, sm.created_at
           FROM stock_movements sm
           JOIN medicines m ON sm.medicine_id = m.id
           LEFT JOIN medicine_batches b ON sm.batch_id = b.id
           WHERE sm.medicine_id = ?1
           ORDER BY sm.created_at DESC, sm.id DESC"#,
    )?;

    let rows = stmt.query_map(params![medicine_id], |row| {
        Ok(StockMovement {
            id: row.get(0)?,
            medicine_id: row.get(1)?,
            batch_id: row.get(2)?,
            batch_number: row.get(3)?,
            medicine_name: row.get(4)?,
            movement_type: row.get(5)?,
            quantity: row.get(6)?,
            previous_qty: row.get(7)?,
            new_qty: row.get(8)?,
            reason: row.get(9)?,
            reference_id: row.get(10)?,
            created_at: row.get(11)?,
        })
    })?;

    let mut result = Vec::new();
    for r in rows {
        result.push(r?);
    }
    Ok(result)
}

/// Computes the 4 core live summary metrics directly from active SQLite records
pub fn fetch_inventory_summary(conn: &Connection) -> Result<InventorySummaryMetrics> {
    // 1. Total Medicines count
    let total_medicines: i64 = conn.query_row(
        "SELECT COUNT(*) FROM medicines WHERE is_active = 1",
        [],
        |row| row.get(0),
    )?;

    // 2. Total Stock Units
    let total_stock_units: i64 = conn.query_row(
        r#"SELECT COALESCE(SUM(b.stock_qty), 0)
           FROM medicine_batches b
           JOIN medicines m ON b.medicine_id = m.id
           WHERE m.is_active = 1 AND b.is_active = 1"#,
        [],
        |row| row.get(0),
    )?;

    // 3. Low stock and out of stock counts
    let mut stmt = conn.prepare(
        r#"SELECT m.id, m.low_stock_threshold, COALESCE(SUM(b.stock_qty), 0) as total_qty
           FROM medicines m
           LEFT JOIN medicine_batches b ON m.id = b.medicine_id AND b.is_active = 1
           WHERE m.is_active = 1
           GROUP BY m.id"#,
    )?;

    let mut low_stock_count = 0;
    let mut out_of_stock_count = 0;

    let rows = stmt.query_map([], |row| {
        let threshold: i64 = row.get(1)?;
        let total_qty: i64 = row.get(2)?;
        Ok((threshold, total_qty))
    })?;

    for r in rows {
        let (thresh, qty) = r?;
        if qty == 0 {
            out_of_stock_count += 1;
        } else if qty <= thresh {
            low_stock_count += 1;
        }
    }

    let needs_restock_count = low_stock_count + out_of_stock_count;

    // 4. Expiry metrics (within 10 calendar days and already expired)
    let expired_count: i64 = conn.query_row(
        r#"SELECT COUNT(*)
           FROM medicine_batches b
           JOIN medicines m ON b.medicine_id = m.id
           WHERE m.is_active = 1 AND b.is_active = 1 AND b.exp_date < date('now', 'localtime')"#,
        [],
        |row| row.get(0),
    )?;

    let expiring_soon_count: i64 = conn.query_row(
        r#"SELECT COUNT(*)
           FROM medicine_batches b
           JOIN medicines m ON b.medicine_id = m.id
           WHERE m.is_active = 1 AND b.is_active = 1 
             AND b.exp_date >= date('now', 'localtime') 
             AND b.exp_date <= date('now', '+10 days', 'localtime')"#,
        [],
        |row| row.get(0),
    )?;

    // 5. Real completed sales data from completed bills
    let medicines_with_sales: i64 = conn.query_row(
        r#"SELECT COUNT(DISTINCT bi.medicine_id)
           FROM bill_items bi
           JOIN bills b ON bi.bill_id = b.id
           WHERE b.status = 'COMPLETED'"#,
        [],
        |row| row.get(0),
    ).unwrap_or(0);

    let mut top_selling_stmt = conn.prepare(
        r#"SELECT 
            bi.medicine_id,
            bi.medicine_name,
            COALESCE(SUM(bi.quantity), 0) as total_qty,
            COALESCE(SUM(bi.amount), 0.0) as total_amount
           FROM bill_items bi
           JOIN bills b ON bi.bill_id = b.id
           WHERE b.status = 'COMPLETED'
           GROUP BY bi.medicine_id, bi.medicine_name
           ORDER BY total_qty DESC, total_amount DESC
           LIMIT 5"#,
    );

    let mut top_selling_medicines = Vec::new();
    if let Ok(mut stmt) = top_selling_stmt {
        if let Ok(rows) = stmt.query_map([], |row| {
            Ok(TopSellingMedicineItem {
                medicine_id: row.get(0)?,
                medicine_name: row.get(1)?,
                total_quantity_sold: row.get(2)?,
                total_sales_amount: row.get(3)?,
            })
        }) {
            for item in rows.flatten() {
                top_selling_medicines.push(item);
            }
        }
    }

    Ok(InventorySummaryMetrics {
        total_medicines,
        total_stock_units,
        medicines_with_sales,
        top_selling_medicines,
        low_stock_count,
        out_of_stock_count,
        needs_restock_count,
        expiring_soon_count,
        expired_count,
    })
}

/// Generates preview of the next bill number without committing
pub fn fetch_next_bill_number_preview(conn: &Connection) -> Result<String> {
    let store_opt = fetch_store_details(conn)?;
    let store = match store_opt {
        Some(s) => s,
        None => return Ok("IM-0001".to_string()),
    };

    let prefix = store.bill_prefix.trim().to_uppercase();
    let prefix_like = format!("{}-%", prefix);

    let mut stmt = conn.prepare("SELECT bill_number FROM bills WHERE bill_number LIKE ?1")?;
    let rows = stmt.query_map(params![prefix_like], |row| row.get::<_, String>(0))?;

    let mut max_suffix = 0i64;
    for b in rows.flatten() {
        if let Some(suffix_str) = b.strip_prefix(&format!("{}-", prefix)) {
            if let Ok(num) = suffix_str.parse::<i64>() {
                if num > max_suffix {
                    max_suffix = num;
                }
            }
        }
    }

    let next_num = if max_suffix > 0 {
        max_suffix + 1
    } else {
        std::cmp::max(1, store.starting_bill_number)
    };

    Ok(format!("{}-{:04}", prefix, next_num))
}

/// Fetches active medicines and their active, unexpired batches sorted by FEFO (earliest expiry first)
pub fn fetch_saleable_medicines(conn: &Connection) -> Result<Vec<SaleableMedicine>> {
    let mut stmt = conn.prepare(
        r#"SELECT id, name, generic_name, manufacturer, category, barcode, unit, low_stock_threshold, is_active
           FROM medicines
           WHERE is_active = 1
           ORDER BY name ASC"#
    )?;

    let mut batch_stmt = conn.prepare(
        r#"SELECT id, medicine_id, batch_number, mfg_date, exp_date, cost_price, mrp, selling_price, stock_qty
           FROM medicine_batches
           WHERE medicine_id = ?1 AND is_active = 1 AND stock_qty > 0 AND exp_date >= date('now', 'localtime')
           ORDER BY exp_date ASC"#
    )?;

    let med_rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<String>>(2)?,
            row.get::<_, Option<String>>(3)?,
            row.get::<_, Option<String>>(4)?,
            row.get::<_, Option<String>>(5)?,
            row.get::<_, String>(6)?,
            row.get::<_, i64>(7)?,
            row.get::<_, bool>(8)?,
        ))
    })?;

    let mut result = Vec::new();

    for r in med_rows {
        let (id, name, generic_name, manufacturer, category, barcode, unit, low_stock_threshold, is_active) = r?;
        let batches_rows = batch_stmt.query_map(params![id], |row| {
            Ok(SaleableBatch {
                id: row.get(0)?,
                medicine_id: row.get(1)?,
                batch_number: row.get(2)?,
                mfg_date: row.get(3)?,
                exp_date: row.get(4)?,
                cost_price: row.get(5)?,
                mrp: row.get(6)?,
                selling_price: row.get(7)?,
                stock_qty: row.get(8)?,
            })
        })?;

        let mut batches = Vec::new();
        let mut total_saleable = 0i64;
        let mut nearest_exp: Option<String> = None;

        for b in batches_rows.flatten() {
            total_saleable += b.stock_qty;
            if nearest_exp.is_none() {
                nearest_exp = Some(b.exp_date.clone());
            }
            batches.push(b);
        }

        result.push(SaleableMedicine {
            id,
            name,
            generic_name,
            manufacturer,
            category,
            barcode,
            unit,
            low_stock_threshold,
            is_active,
            total_saleable_stock: total_saleable,
            nearest_expiry_date: nearest_exp,
            batches,
        });
    }

    Ok(result)
}

/// Executes atomic transaction to save bill, deduct batch stock, and record audit movement
pub fn save_bill_transaction(conn: &mut Connection, input: &SaveBillInput) -> Result<BillRecord> {
    // 1. Validate customer name
    if input.customer_name.trim().is_empty() {
        return Err(make_field_error("customerName", "Customer name cannot be empty"));
    }

    // 2. Validate customer mobile (10 digits Indian starting with 6,7,8,9)
    let clean_mobile: String = input.customer_mobile.chars().filter(|c| c.is_ascii_digit()).collect();
    if clean_mobile.len() != 10 || !['6', '7', '8', '9'].contains(&clean_mobile.chars().next().unwrap_or('0')) {
        return Err(make_field_error("customerMobile", "Enter a valid 10-digit Indian mobile number"));
    }

    // 3. Validate items
    if input.items.is_empty() {
        return Err(make_field_error("items", "Bill must contain at least one medicine item"));
    }

    // 4. Fetch store details for snapshotting and numbering
    let store_opt = fetch_store_details(conn)?;
    let store = store_opt.ok_or_else(|| rusqlite::Error::UserFunctionError("Store Details configuration not found".into()))?;

    let tx = conn.transaction()?;

    // 5. Generate atomic bill number: prefix and next sequential number
    let prefix = store.bill_prefix.trim().to_uppercase();
    let prefix_like = format!("{}-%", prefix);
    
    let mut stmt_bills = tx.prepare("SELECT bill_number FROM bills WHERE bill_number LIKE ?1")?;
    let existing_numbers = stmt_bills.query_map(params![prefix_like], |row| row.get::<_, String>(0))?;

    let mut max_suffix = 0i64;
    for b in existing_numbers.flatten() {
        if let Some(suffix_str) = b.strip_prefix(&format!("{}-", prefix)) {
            if let Ok(num) = suffix_str.parse::<i64>() {
                if num > max_suffix {
                    max_suffix = num;
                }
            }
        }
    }

    let next_num = if max_suffix > 0 {
        max_suffix + 1
    } else {
        std::cmp::max(1, store.starting_bill_number)
    };

    let bill_number = format!("{}-{:04}", prefix, next_num);

    // 6. Server-side totals recalculation & strict stock validation
    let mut sub_total = 0.0f64;
    let mut discount = 0.0f64;

    for item in &input.items {
        if item.quantity < 1 {
            return Err(make_field_error("quantity", &format!("Quantity for '{}' must be at least 1", item.medicine_name)));
        }

        // Live check from DB
        let batch_info: Option<(i64, String, String, f64, f64, f64, i64, i64)> = tx.query_row(
            r#"SELECT b.medicine_id, b.batch_number, b.exp_date, b.cost_price, b.mrp, b.selling_price, b.stock_qty, m.is_active
               FROM medicine_batches b
               JOIN medicines m ON b.medicine_id = m.id
               WHERE b.id = ?1 AND b.is_active = 1"#,
            params![item.batch_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?)),
        ).optional()?;

        let (_, b_num, exp_date, _, db_mrp, _, current_stock, med_active) = match batch_info {
            Some(info) => info,
            None => {
                return Err(make_field_error("batchId", &format!("Batch '{}' for medicine '{}' was not found or is inactive", item.batch_number, item.medicine_name)));
            }
        };

        if med_active == 0 {
            return Err(make_field_error("medicineId", &format!("Medicine '{}' is archived and cannot be billed", item.medicine_name)));
        }

        // Expiry check
        let is_expired: bool = tx.query_row(
            "SELECT date(?1) < date('now', 'localtime')",
            params![exp_date],
            |row| row.get(0),
        ).unwrap_or(false);

        if is_expired {
            return Err(make_field_error("expDate", &format!("Batch '{}' for '{}' has expired ({}) and cannot be billed", b_num, item.medicine_name, exp_date)));
        }

        // Stock availability check
        if current_stock < item.quantity {
            return Err(make_field_error("quantity", &format!("Insufficient stock for '{}' (Batch {}). Available: {}, Requested: {}", item.medicine_name, b_num, current_stock, item.quantity)));
        }

        // Rate validation
        let line_rate = if input.discount_mode == "NON_DISCOUNT" {
            db_mrp
        } else {
            if item.rate < 0.0 {
                return Err(make_field_error("rate", &format!("Rate cannot be negative for '{}'", item.medicine_name)));
            }
            if item.rate > db_mrp + 0.001 {
                return Err(make_field_error("rate", &format!("Rate cannot exceed MRP for '{}'", item.medicine_name)));
            }
            item.rate
        };

        let line_amount = (line_rate * item.quantity as f64 * 100.0).round() / 100.0;
        let line_mrp_total = (db_mrp * item.quantity as f64 * 100.0).round() / 100.0;

        sub_total += line_mrp_total;
        if input.discount_mode == "DISCOUNTED" {
            discount += (line_mrp_total - line_amount);
        }
    }

    sub_total = (sub_total * 100.0).round() / 100.0;
    discount = (discount * 100.0).round() / 100.0;
    let grand_total = ((sub_total - discount) * 100.0).round() / 100.0;

    // GST Inclusive 18% calculation
    let gst_total = ((grand_total * 18.0 / 118.0) * 100.0).round() / 100.0;
    let cgst = ((gst_total / 2.0) * 100.0).round() / 100.0;
    let sgst = ((gst_total - cgst) * 100.0).round() / 100.0;

    let (bill_date, created_at): (String, String) = tx.query_row(
        "SELECT date('now', 'localtime'), datetime('now', 'localtime')",
        [],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;

    // Snapshot store logo if present
    let mut bill_logo_path: Option<String> = None;
    if let Some(ref l_path) = store.logo_path {
        if !l_path.trim().is_empty() {
            if let Some(db_dir) = conn.path().and_then(|p| p.parent()) {
                let src_file = db_dir.join(l_path);
                if src_file.exists() {
                    let bill_logos_dir = db_dir.join("logos").join("bills");
                    let _ = std::fs::create_dir_all(&bill_logos_dir);
                    let ext = src_file.extension().and_then(|s| s.to_str()).unwrap_or("png");
                    let timestamp = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs();
                    let snapshot_filename = format!("{}_{}.{}", bill_number.replace('-', "_"), timestamp, ext);
                    let dest_file = bill_logos_dir.join(&snapshot_filename);
                    if std::fs::copy(&src_file, &dest_file).is_ok() {
                        bill_logo_path = Some(format!("logos/bills/{}", snapshot_filename));
                    }
                }
            }
            if bill_logo_path.is_none() {
                bill_logo_path = Some(l_path.clone());
            }
        }
    }

    // Insert bill record
    tx.execute(
        r#"INSERT INTO bills (
            bill_number, customer_name, customer_mobile, doctor_name, bill_date,
            discount_mode, payment_mode, sub_total, discount, gst_total, cgst, sgst, grand_total,
            amount_in_words, store_name, store_address, store_phone, store_email, store_gstin,
            store_dl_1, store_dl_2, store_footer_terms, store_logo_path, show_gstin, show_amount_in_words,
            status, created_at
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5,
            ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13,
            ?14, ?15, ?16, ?17, ?18, ?19,
            ?20, ?21, ?22, ?23, ?24, ?25,
            'COMPLETED', ?26
        )"#,
        params![
            bill_number,
            input.customer_name.trim(),
            clean_mobile,
            input.doctor_name.as_deref().map(|s| s.trim()),
            bill_date,
            input.discount_mode,
            input.payment_mode,
            sub_total,
            discount,
            gst_total,
            cgst,
            sgst,
            grand_total,
            "",
            store.store_name,
            store.address,
            store.phone,
            store.email,
            store.gstin,
            store.drug_license_1,
            store.drug_license_2,
            store.footer_terms,
            bill_logo_path,
            if store.show_gstin_on_invoice { 1 } else { 0 },
            if store.show_amount_in_words { 1 } else { 0 },
            created_at,
        ],
    )?;

    let bill_id = tx.last_insert_rowid();

    // Insert bill_items, deduct batch stock, and record stock movement
    let mut recorded_items = Vec::new();

    for item in &input.items {
        let (current_qty, cost_p, db_mrp, db_sp): (i64, f64, f64, f64) = tx.query_row(
            "SELECT stock_qty, cost_price, mrp, selling_price FROM medicine_batches WHERE id = ?1",
            params![item.batch_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )?;

        let line_rate = if input.discount_mode == "NON_DISCOUNT" { db_mrp } else { item.rate };
        let line_amount = (line_rate * item.quantity as f64 * 100.0).round() / 100.0;

        tx.execute(
            r#"INSERT INTO bill_items (
                bill_id, medicine_id, batch_id, medicine_name, batch_number, exp_date,
                unit, quantity, cost_price, mrp, selling_price, rate, amount
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)"#,
            params![
                bill_id,
                item.medicine_id,
                item.batch_id,
                item.medicine_name.trim(),
                item.batch_number.trim(),
                item.exp_date.trim(),
                item.unit.trim(),
                item.quantity,
                cost_p,
                db_mrp,
                db_sp,
                line_rate,
                line_amount,
            ],
        )?;

        let item_id = tx.last_insert_rowid();

        // Deduct batch stock
        let new_qty = current_qty - item.quantity;
        tx.execute(
            "UPDATE medicine_batches SET stock_qty = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![new_qty, item.batch_id],
        )?;

        // Record stock movement (type SALE)
        tx.execute(
            r#"INSERT INTO stock_movements (
                medicine_id, batch_id, movement_type, quantity, previous_qty, new_qty, reason, reference_id, created_at
            ) VALUES (?1, ?2, 'SALE', ?3, ?4, ?5, 'Counter Sale', ?6, CURRENT_TIMESTAMP)"#,
            params![
                item.medicine_id,
                item.batch_id,
                item.quantity,
                current_qty,
                new_qty,
                bill_number,
            ],
        )?;

        recorded_items.push(BillItemRecord {
            id: item_id,
            bill_id,
            medicine_id: item.medicine_id,
            batch_id: item.batch_id,
            medicine_name: item.medicine_name.clone(),
            batch_number: item.batch_number.clone(),
            exp_date: item.exp_date.clone(),
            unit: item.unit.clone(),
            quantity: item.quantity,
            cost_price: cost_p,
            mrp: db_mrp,
            selling_price: db_sp,
            rate: line_rate,
            amount: line_amount,
        });
    }

    tx.commit()?;

    let store_snapshot = BillStoreSnapshot {
        store_name: store.store_name,
        address: store.address,
        phone: store.phone,
        email: store.email,
        gstin: store.gstin,
        drug_license_1: store.drug_license_1,
        drug_license_2: store.drug_license_2,
        footer_terms: store.footer_terms,
        show_gstin: store.show_gstin_on_invoice,
        show_amount_in_words: store.show_amount_in_words,
        logo_path: bill_logo_path,
        tagline: None,
    };

    Ok(BillRecord {
        id: bill_id,
        bill_number,
        customer_name: input.customer_name.trim().to_string(),
        customer_mobile: clean_mobile,
        doctor_name: input.doctor_name.as_deref().map(|s| s.trim().to_string()),
        bill_date,
        discount_mode: input.discount_mode.clone(),
        payment_mode: input.payment_mode.clone(),
        sub_total,
        discount,
        gst_total,
        cgst,
        sgst,
        grand_total,
        amount_in_words: "".to_string(),
        store_snapshot,
        items: recorded_items,
        status: "COMPLETED".to_string(),
        created_at,
    })
}

/// Helper to map a rusqlite row to a BillRecord (without items)
fn row_to_bill_record(row: &rusqlite::Row) -> rusqlite::Result<BillRecord> {
    Ok(BillRecord {
        id: row.get(0)?,
        bill_number: row.get(1)?,
        customer_name: row.get(2)?,
        customer_mobile: row.get(3)?,
        doctor_name: row.get(4)?,
        bill_date: row.get(5)?,
        discount_mode: row.get(6)?,
        payment_mode: row.get(7)?,
        sub_total: row.get(8)?,
        discount: row.get(9)?,
        gst_total: row.get(10)?,
        cgst: row.get(11)?,
        sgst: row.get(12)?,
        grand_total: row.get(13)?,
        amount_in_words: row.get::<_, Option<String>>(14)?.unwrap_or_default(),
        store_snapshot: BillStoreSnapshot {
            store_name: row.get::<_, Option<String>>(15)?.unwrap_or_default(),
            address: row.get(16)?,
            phone: row.get(17)?,
            email: row.get(18)?,
            gstin: row.get(19)?,
            drug_license_1: row.get(20)?,
            drug_license_2: row.get(21)?,
            footer_terms: row.get(22)?,
            logo_path: row.get(23)?,
            show_gstin: row.get::<_, i64>(24).unwrap_or(1) != 0,
            show_amount_in_words: row.get::<_, i64>(25).unwrap_or(1) != 0,
            tagline: None,
        },
        items: Vec::new(),
        status: row.get::<_, Option<String>>(26)?.unwrap_or_else(|| "COMPLETED".to_string()),
        created_at: row.get::<_, Option<String>>(27)?.unwrap_or_default(),
    })
}

/// Helper to fetch items for a set of bills
fn fetch_items_for_bills(conn: &Connection, bill_ids: &[i64]) -> Result<std::collections::HashMap<i64, Vec<BillItemRecord>>> {
    let mut map = std::collections::HashMap::new();
    if bill_ids.is_empty() {
        return Ok(map);
    }

    let placeholders: Vec<String> = (1..=bill_ids.len()).map(|i| format!("?{}", i)).collect();
    let query = format!(
        r#"SELECT id, bill_id, medicine_id, batch_id, medicine_name, batch_number,
                  exp_date, unit, quantity, cost_price, mrp, selling_price, rate, amount
           FROM bill_items
           WHERE bill_id IN ({})
           ORDER BY id ASC"#,
        placeholders.join(",")
    );

    let mut stmt = conn.prepare(&query)?;
    let params: Vec<&dyn rusqlite::ToSql> = bill_ids.iter().map(|id| id as &dyn rusqlite::ToSql).collect();

    let rows = stmt.query_map(&params[..], |row| {
        Ok(BillItemRecord {
            id: row.get(0)?,
            bill_id: row.get(1)?,
            medicine_id: row.get(2)?,
            batch_id: row.get(3)?,
            medicine_name: row.get(4)?,
            batch_number: row.get(5)?,
            exp_date: row.get(6)?,
            unit: row.get(7)?,
            quantity: row.get(8)?,
            cost_price: row.get(9)?,
            mrp: row.get(10)?,
            selling_price: row.get(11)?,
            rate: row.get(12)?,
            amount: row.get(13)?,
        })
    })?;

    for item in rows {
        let it = item?;
        map.entry(it.bill_id).or_insert_with(Vec::new).push(it);
    }

    Ok(map)
}

/// Fetches paginated bills matching filters, along with accurate summary KPIs
pub fn fetch_bills_paginated(conn: &Connection, filter: &BillFilterInput) -> Result<PaginatedBillsResult> {
    let mut where_clauses: Vec<String> = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(from) = &filter.from_date {
        let trimmed = from.trim();
        if !trimmed.is_empty() {
            params_vec.push(Box::new(trimmed.to_string()));
            where_clauses.push(format!("substr(b.bill_date, 1, 10) >= ?{}", params_vec.len()));
        }
    }

    if let Some(to) = &filter.to_date {
        let trimmed = to.trim();
        if !trimmed.is_empty() {
            params_vec.push(Box::new(trimmed.to_string()));
            where_clauses.push(format!("substr(b.bill_date, 1, 10) <= ?{}", params_vec.len()));
        }
    }

    if let Some(search) = &filter.search {
        let trimmed = search.trim();
        if !trimmed.is_empty() {
            let pat = format!("%{}%", trimmed);
            params_vec.push(Box::new(pat.clone()));
            let p1 = params_vec.len();
            params_vec.push(Box::new(pat.clone()));
            let p2 = params_vec.len();
            params_vec.push(Box::new(pat.clone()));
            let p3 = params_vec.len();
            params_vec.push(Box::new(pat));
            let p4 = params_vec.len();
            where_clauses.push(format!(
                "(b.bill_number LIKE ?{} OR b.customer_name LIKE ?{} OR b.customer_mobile LIKE ?{} OR (b.doctor_name IS NOT NULL AND b.doctor_name LIKE ?{}))",
                p1, p2, p3, p4
            ));
        }
    }

    if let Some(pm) = &filter.payment_mode {
        let trimmed = pm.trim().to_uppercase();
        if !trimmed.is_empty() && trimmed != "ALL" {
            params_vec.push(Box::new(trimmed));
            where_clauses.push(format!("UPPER(b.payment_mode) = ?{}", params_vec.len()));
        }
    }

    if let Some(dm) = &filter.discount_mode {
        let trimmed = dm.trim().to_uppercase();
        if !trimmed.is_empty() && trimmed != "ALL" {
            if trimmed == "DISCOUNTED" {
                where_clauses.push("(UPPER(b.discount_mode) = 'DISCOUNTED' OR b.discount > 0.0)".to_string());
            } else if trimmed == "NON_DISCOUNT" {
                where_clauses.push("(UPPER(b.discount_mode) = 'NON_DISCOUNT' AND (b.discount IS NULL OR b.discount <= 0.0))".to_string());
            }
        }
    }

    let where_str = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    // Calculate Summary aggregation on SQLite directly
    let summary_sql = format!(
        r#"SELECT 
            COUNT(*),
            COALESCE(SUM(b.grand_total), 0.0),
            COALESCE(SUM(b.discount), 0.0),
            COALESCE(SUM(CASE WHEN UPPER(b.payment_mode) = 'CASH' THEN b.grand_total ELSE 0.0 END), 0.0),
            COALESCE(SUM(CASE WHEN UPPER(b.payment_mode) = 'UPI' THEN b.grand_total ELSE 0.0 END), 0.0),
            COALESCE(SUM(CASE WHEN UPPER(b.payment_mode) = 'CARD' THEN b.grand_total ELSE 0.0 END), 0.0)
           FROM bills b
           {}"#,
        where_str
    );

    let summary_params: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
    let summary: BillHistorySummary = conn.query_row(&summary_sql, &summary_params[..], |row| {
        Ok(BillHistorySummary {
            total_bills: row.get(0)?,
            total_sales: (row.get::<_, f64>(1)? * 100.0).round() / 100.0,
            total_discount: (row.get::<_, f64>(2)? * 100.0).round() / 100.0,
            cash_sales: (row.get::<_, f64>(3)? * 100.0).round() / 100.0,
            upi_sales: (row.get::<_, f64>(4)? * 100.0).round() / 100.0,
            card_sales: (row.get::<_, f64>(5)? * 100.0).round() / 100.0,
        })
    })?;

    let total_count = summary.total_bills;

    // Sorting
    let sort_col = match filter.sort_by.as_deref().unwrap_or("date") {
        "bill_number" => "b.id",
        "grand_total" => "b.grand_total",
        "customer_name" => "b.customer_name",
        _ => "b.bill_date",
    };

    let sort_dir = match filter.sort_order.as_deref().unwrap_or("desc").to_lowercase().as_str() {
        "asc" => "ASC",
        _ => "DESC",
    };

    let order_by = if sort_col == "b.id" {
        format!("ORDER BY b.id {}", sort_dir)
    } else {
        format!("ORDER BY {} {}, b.id {}", sort_col, sort_dir, sort_dir)
    };

    // Pagination
    let page = filter.page.unwrap_or(1).max(1);
    let page_size = filter.page_size.unwrap_or(10).max(1);
    let offset = (page - 1) * page_size;

    let bills_sql = format!(
        r#"SELECT 
            b.id, b.bill_number, b.customer_name, b.customer_mobile, b.doctor_name, b.bill_date,
            b.discount_mode, b.payment_mode, b.sub_total, b.discount, b.gst_total, b.cgst, b.sgst, b.grand_total,
            b.amount_in_words, b.store_name, b.store_address, b.store_phone, b.store_email, b.store_gstin,
            b.store_dl_1, b.store_dl_2, b.store_footer_terms, b.store_logo_path, b.show_gstin, b.show_amount_in_words,
            b.status, b.created_at
           FROM bills b
           {}
           {}
           LIMIT ?{} OFFSET ?{}"#,
        where_str,
        order_by,
        params_vec.len() + 1,
        params_vec.len() + 2
    );

    let mut query_params = summary_params;
    query_params.push(&page_size);
    query_params.push(&offset);

    let mut stmt = conn.prepare(&bills_sql)?;
    let bill_rows = stmt.query_map(&query_params[..], |row| row_to_bill_record(row))?;

    let mut bills = Vec::new();
    let mut bill_ids = Vec::new();
    for br in bill_rows {
        let b = br?;
        bill_ids.push(b.id);
        bills.push(b);
    }

    // Attach items
    let mut items_map = fetch_items_for_bills(conn, &bill_ids)?;
    for bill in &mut bills {
        if let Some(items) = items_map.remove(&bill.id) {
            bill.items = items;
        }
    }

    Ok(PaginatedBillsResult {
        bills,
        total_count,
        page,
        page_size,
        summary,
    })
}

/// Fetches a single bill by ID with its items
pub fn fetch_bill_by_id(conn: &Connection, bill_id: i64) -> Result<Option<BillRecord>> {
    let mut stmt = conn.prepare(
        r#"SELECT 
            b.id, b.bill_number, b.customer_name, b.customer_mobile, b.doctor_name, b.bill_date,
            b.discount_mode, b.payment_mode, b.sub_total, b.discount, b.gst_total, b.cgst, b.sgst, b.grand_total,
            b.amount_in_words, b.store_name, b.store_address, b.store_phone, b.store_email, b.store_gstin,
            b.store_dl_1, b.store_dl_2, b.store_footer_terms, b.store_logo_path, b.show_gstin, b.show_amount_in_words,
            b.status, b.created_at
           FROM bills b
           WHERE b.id = ?1"#
    )?;

    let mut rows = stmt.query(params![bill_id])?;
    if let Some(row) = rows.next()? {
        let mut bill = row_to_bill_record(row)?;
        let mut items_map = fetch_items_for_bills(conn, &[bill.id])?;
        if let Some(items) = items_map.remove(&bill.id) {
            bill.items = items;
        }
        Ok(Some(bill))
    } else {
        Ok(None)
    }
}

/// Fetches paginated customers derived from saved bills, along with accurate summary KPIs
pub fn fetch_customers_paginated(conn: &Connection, filter: &CustomerFilterInput) -> Result<PaginatedCustomersResult> {
    let mut range_conditions = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(from) = &filter.from_date {
        let trimmed = from.trim();
        if !trimmed.is_empty() {
            params_vec.push(Box::new(trimmed.to_string()));
            range_conditions.push(format!("substr(nb.bill_date, 1, 10) >= ?{}", params_vec.len()));
        }
    }

    if let Some(to) = &filter.to_date {
        let trimmed = to.trim();
        if !trimmed.is_empty() {
            params_vec.push(Box::new(trimmed.to_string()));
            range_conditions.push(format!("substr(nb.bill_date, 1, 10) <= ?{}", params_vec.len()));
        }
    }

    let range_expr = if range_conditions.is_empty() {
        "1 = 1".to_string()
    } else {
        range_conditions.join(" AND ")
    };

    let mut search_where = String::new();
    if let Some(search) = &filter.search {
        let trimmed = search.trim();
        if !trimmed.is_empty() {
            let pat = format!("%{}%", trimmed);
            params_vec.push(Box::new(pat.clone()));
            let p1 = params_vec.len();
            params_vec.push(Box::new(pat));
            let p2 = params_vec.len();
            search_where = format!(
                "WHERE nb.norm_mobile IN (SELECT DISTINCT nb_s.norm_mobile FROM norm_bills nb_s WHERE nb_s.customer_name LIKE ?{} OR nb_s.norm_mobile LIKE ?{})",
                p1, p2
            );
        }
    }

    let cte_sql = format!(
        r#"WITH norm_bills AS (
            SELECT 
                b.id,
                b.bill_number,
                b.customer_name,
                CASE 
                    WHEN TRIM(b.customer_mobile) = '' THEN 'No mobile' 
                    WHEN LENGTH(TRIM(b.customer_mobile)) >= 10 THEN SUBSTR(REPLACE(REPLACE(TRIM(b.customer_mobile), '+91', ''), ' ', ''), -10) 
                    ELSE TRIM(b.customer_mobile) 
                END AS norm_mobile,
                b.bill_date,
                b.grand_total
            FROM bills b
        ),
        customer_grouped AS (
            SELECT 
                nb.norm_mobile,
                COUNT(CASE WHEN {} THEN 1 END) AS range_bills_count,
                COALESCE(SUM(CASE WHEN {} THEN nb.grand_total ELSE 0.0 END), 0.0) AS range_total_spent,
                MAX(CASE WHEN {} THEN nb.bill_date END) AS range_last_visit,
                MIN(nb.bill_date) AS first_visit,
                MAX(nb.bill_date) AS all_time_last_visit,
                COUNT(*) AS all_time_bills_count,
                COALESCE(SUM(nb.grand_total), 0.0) AS all_time_total_spent,
                (
                    SELECT nb_latest.customer_name 
                    FROM norm_bills nb_latest 
                    WHERE nb_latest.norm_mobile = nb.norm_mobile
                    ORDER BY nb_latest.id DESC LIMIT 1
                ) AS latest_name,
                GROUP_CONCAT(DISTINCT nb.customer_name) AS all_names_str
            FROM norm_bills nb
            {}
            GROUP BY nb.norm_mobile
            HAVING range_bills_count > 0
        )"#,
        range_expr, range_expr, range_expr, search_where
    );

    // Summary calculation
    let summary_sql = format!(
        r#"{}
        SELECT 
            COUNT(*),
            COALESCE(SUM(range_bills_count), 0),
            COALESCE(SUM(range_total_spent), 0.0),
            COALESCE(SUM(CASE WHEN range_bills_count >= 2 THEN 1 ELSE 0 END), 0)
        FROM customer_grouped"#,
        cte_sql
    );

    let summary_params: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
    let summary: CustomersSummary = conn.query_row(&summary_sql, &summary_params[..], |row| {
        Ok(CustomersSummary {
            total_customers: row.get(0)?,
            total_bills: row.get(1)?,
            total_sales: (row.get::<_, f64>(2)? * 100.0).round() / 100.0,
            repeat_customers: row.get(3)?,
        })
    })?;

    let total_count = summary.total_customers;

    // Sorting
    let sort_col = match filter.sort_by.as_deref().unwrap_or("last_visit") {
        "name" => "latest_name",
        "bills" => "range_bills_count",
        "total_spent" => "range_total_spent",
        _ => "range_last_visit",
    };

    let sort_dir = match filter.sort_order.as_deref().unwrap_or("desc").to_lowercase().as_str() {
        "asc" => "ASC",
        _ => "DESC",
    };

    let order_by = format!("ORDER BY {} {}, norm_mobile ASC", sort_col, sort_dir);

    // Pagination
    let page = filter.page.unwrap_or(1).max(1);
    let page_size = filter.page_size.unwrap_or(10).max(1);
    let offset = (page - 1) * page_size;

    let p_limit = params_vec.len() + 1;
    let p_offset = params_vec.len() + 2;

    let list_sql = format!(
        r#"{}
        SELECT 
            norm_mobile,
            range_bills_count,
            range_total_spent,
            range_last_visit,
            first_visit,
            all_time_last_visit,
            all_time_bills_count,
            all_time_total_spent,
            latest_name,
            all_names_str
        FROM customer_grouped
        {}
        LIMIT ?{} OFFSET ?{}"#,
        cte_sql, order_by, p_limit, p_offset
    );

    let mut query_params = summary_params;
    query_params.push(&page_size);
    query_params.push(&offset);

    let mut stmt = conn.prepare(&list_sql)?;
    let rows = stmt.query_map(&query_params[..], |row| {
        let mobile: String = row.get(0)?;
        let bills_count: i64 = row.get(1)?;
        let total_spent: f64 = row.get(2)?;
        let range_last_visit: Option<String> = row.get(3)?;
        let first_visit: Option<String> = row.get(4)?;
        let all_time_last_visit: Option<String> = row.get(5)?;
        let all_time_bills_count: i64 = row.get(6)?;
        let all_time_total_spent: f64 = row.get(7)?;
        let latest_name: Option<String> = row.get(8)?;
        let all_names_str: Option<String> = row.get(9)?;

        let display_name = latest_name.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| {
            if mobile == "No mobile" {
                "Walk-in Customer".to_string()
            } else {
                "Customer".to_string()
            }
        });

        let mut other_names = Vec::new();
        if let Some(names_concat) = all_names_str {
            for n in names_concat.split(',') {
                let trimmed = n.trim();
                if !trimmed.is_empty() && trimmed != display_name && !other_names.contains(&trimmed.to_string()) {
                    other_names.push(trimmed.to_string());
                }
            }
        }

        let last_visit = range_last_visit
            .or(all_time_last_visit)
            .unwrap_or_default();

        Ok(CustomerListItem {
            mobile,
            display_name,
            other_names,
            bills_count,
            total_spent: (total_spent * 100.0).round() / 100.0,
            last_visit,
            first_visit: first_visit.unwrap_or_default(),
            all_time_bills_count,
            all_time_total_spent: (all_time_total_spent * 100.0).round() / 100.0,
        })
    })?;

    let mut customers = Vec::new();
    for c in rows {
        customers.push(c?);
    }

    Ok(PaginatedCustomersResult {
        customers,
        total_count,
        page,
        page_size,
        summary,
    })
}

/// Retrieves customer aggregate detail and all bills belonging to that customer
pub fn fetch_customer_detail(
    conn: &Connection,
    mobile: &str,
    from_date: Option<&str>,
    to_date: Option<&str>,
    search_bill: Option<&str>,
) -> Result<Option<CustomerDetailResult>> {
    let clean_target = mobile.trim();
    if clean_target.is_empty() {
        return Ok(None);
    }

    let mut range_conditions = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    let mobile_expr = if clean_target == "No mobile" {
        "TRIM(b.customer_mobile) = ''".to_string()
    } else {
        params_vec.push(Box::new(clean_target.to_string()));
        let p = params_vec.len();
        format!(
            "(CASE WHEN LENGTH(TRIM(b.customer_mobile)) >= 10 THEN SUBSTR(REPLACE(REPLACE(TRIM(b.customer_mobile), '+91', ''), ' ', ''), -10) ELSE TRIM(b.customer_mobile) END) = ?{}",
            p
        )
    };

    if let Some(from) = from_date {
        let trimmed = from.trim();
        if !trimmed.is_empty() {
            params_vec.push(Box::new(trimmed.to_string()));
            range_conditions.push(format!("substr(b.bill_date, 1, 10) >= ?{}", params_vec.len()));
        }
    }

    if let Some(to) = to_date {
        let trimmed = to.trim();
        if !trimmed.is_empty() {
            params_vec.push(Box::new(trimmed.to_string()));
            range_conditions.push(format!("substr(b.bill_date, 1, 10) <= ?{}", params_vec.len()));
        }
    }

    let range_expr = if range_conditions.is_empty() {
        "1 = 1".to_string()
    } else {
        range_conditions.join(" AND ")
    };

    let summary_sql = format!(
        r#"SELECT 
            MIN(b.bill_date) AS first_visit,
            MAX(b.bill_date) AS last_visit,
            COUNT(*) AS all_time_bills_count,
            COALESCE(SUM(b.grand_total), 0.0) AS all_time_total_spent,
            COUNT(CASE WHEN {} THEN 1 END) AS range_bills_count,
            COALESCE(SUM(CASE WHEN {} THEN b.grand_total ELSE 0.0 END), 0.0) AS range_total_spent,
            (
                SELECT b_latest.customer_name 
                FROM bills b_latest 
                WHERE {}
                ORDER BY b_latest.id DESC LIMIT 1
            ) AS latest_name,
            GROUP_CONCAT(DISTINCT b.customer_name) AS all_names_str
        FROM bills b
        WHERE {}"#,
        range_expr, range_expr, mobile_expr, mobile_expr
    );

    let summary_params: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
    let mut stmt = conn.prepare(&summary_sql)?;
    let mut rows = stmt.query(&summary_params[..])?;

    let row = match rows.next()? {
        Some(r) => r,
        None => return Ok(None),
    };

    let all_time_bills: i64 = row.get(2)?;
    if all_time_bills == 0 {
        return Ok(None);
    }

    let first_visit: Option<String> = row.get(0)?;
    let last_visit: Option<String> = row.get(1)?;
    let all_time_total_spent: f64 = row.get(3)?;
    let range_bills_count: i64 = row.get(4)?;
    let range_total_spent: f64 = row.get(5)?;
    let latest_name: Option<String> = row.get(6)?;
    let all_names_str: Option<String> = row.get(7)?;

    let display_name = latest_name.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| {
        if clean_target == "No mobile" {
            "Walk-in Customer".to_string()
        } else {
            "Customer".to_string()
        }
    });

    let mut other_names = Vec::new();
    if let Some(names_concat) = all_names_str {
        for n in names_concat.split(',') {
            let trimmed = n.trim();
            if !trimmed.is_empty() && trimmed != display_name && !other_names.contains(&trimmed.to_string()) {
                other_names.push(trimmed.to_string());
            }
        }
    }

    let customer = CustomerListItem {
        mobile: clean_target.to_string(),
        display_name,
        other_names,
        bills_count: range_bills_count,
        total_spent: (range_total_spent * 100.0).round() / 100.0,
        last_visit: last_visit.unwrap_or_default(),
        first_visit: first_visit.unwrap_or_default(),
        all_time_bills_count: all_time_bills,
        all_time_total_spent: (all_time_total_spent * 100.0).round() / 100.0,
    };

    // 2. Fetch bills in date range with optional bill number filter
    let mut bill_conditions = Vec::new();
    let mut bill_params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    let b_mob_expr = if clean_target == "No mobile" {
        "TRIM(b.customer_mobile) = ''".to_string()
    } else {
        bill_params.push(Box::new(clean_target.to_string()));
        let p = bill_params.len();
        format!(
            "(CASE WHEN LENGTH(TRIM(b.customer_mobile)) >= 10 THEN SUBSTR(REPLACE(REPLACE(TRIM(b.customer_mobile), '+91', ''), ' ', ''), -10) ELSE TRIM(b.customer_mobile) END) = ?{}",
            p
        )
    };
    bill_conditions.push(b_mob_expr);

    if let Some(from) = from_date {
        let trimmed = from.trim();
        if !trimmed.is_empty() {
            bill_params.push(Box::new(trimmed.to_string()));
            bill_conditions.push(format!("substr(b.bill_date, 1, 10) >= ?{}", bill_params.len()));
        }
    }

    if let Some(to) = to_date {
        let trimmed = to.trim();
        if !trimmed.is_empty() {
            bill_params.push(Box::new(trimmed.to_string()));
            bill_conditions.push(format!("substr(b.bill_date, 1, 10) <= ?{}", bill_params.len()));
        }
    }

    if let Some(sb) = search_bill {
        let trimmed = sb.trim();
        if !trimmed.is_empty() {
            bill_params.push(Box::new(format!("%{}%", trimmed)));
            bill_conditions.push(format!("b.bill_number LIKE ?{}", bill_params.len()));
        }
    }

    let bills_where = format!("WHERE {}", bill_conditions.join(" AND "));
    let bills_sql = format!(
        r#"SELECT 
            b.id, b.bill_number, b.customer_name, b.customer_mobile, b.doctor_name, b.bill_date,
            b.discount_mode, b.payment_mode, b.sub_total, b.discount, b.gst_total, b.cgst, b.sgst, b.grand_total,
            b.amount_in_words, b.store_name, b.store_address, b.store_phone, b.store_email, b.store_gstin,
            b.store_dl_1, b.store_dl_2, b.store_footer_terms, b.store_logo_path, b.show_gstin, b.show_amount_in_words,
            b.status, b.created_at
        FROM bills b
        {}
        ORDER BY b.bill_date DESC, b.id DESC"#,
        bills_where
    );

    let query_bill_params: Vec<&dyn rusqlite::ToSql> = bill_params.iter().map(|b| b.as_ref()).collect();
    let mut stmt = conn.prepare(&bills_sql)?;
    let bill_rows = stmt.query_map(&query_bill_params[..], |row| row_to_bill_record(row))?;

    let mut bills = Vec::new();
    let mut bill_ids = Vec::new();
    for br in bill_rows {
        let b = br?;
        bill_ids.push(b.id);
        bills.push(b);
    }

    let mut items_map = fetch_items_for_bills(conn, &bill_ids)?;
    for b in &mut bills {
        if let Some(items) = items_map.remove(&b.id) {
            b.items = items;
        }
    }

    Ok(Some(CustomerDetailResult {
        customer,
        bills,
    }))
}

// ---------------------------------------------------------------------------
// COMMAND 07: BACKUP & RESTORE MODULE
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BackupSettings {
    pub auto_backup_enabled: bool,
    pub backup_folder: String,
    pub retention_count: i64,
    pub last_backup_time: Option<String>,
    pub last_backup_size: Option<i64>,
    pub last_backup_status: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BackupCounts {
    pub bills: i64,
    pub medicines: i64,
    pub batches: i64,
    pub customers: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BackupManifest {
    pub app_name: String,
    pub app_version: String,
    pub schema_version: i64,
    pub created_at: String,
    pub backup_type: String,
    pub counts: BackupCounts,
    pub checksums: std::collections::HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BackupRecord {
    pub file_name: String,
    pub file_path: String,
    pub size_bytes: i64,
    pub created_at: String,
    pub backup_type: String,
    pub manifest: Option<BackupManifest>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BackupValidationResult {
    pub is_valid: bool,
    pub error: Option<String>,
    pub manifest: Option<BackupManifest>,
    pub current_counts: Option<BackupCounts>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RestoreResult {
    pub success: bool,
    pub message: String,
    pub pre_restore_file: Option<String>,
    pub restored_counts: Option<BackupCounts>,
}

/// Creates backup settings table if not already present
pub fn migrate_backup_tables(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS backup_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            auto_backup_enabled INTEGER NOT NULL DEFAULT 1,
            backup_folder TEXT NOT NULL,
            retention_count INTEGER NOT NULL DEFAULT 7,
            last_backup_time TEXT,
            last_backup_size INTEGER,
            last_backup_status TEXT NOT NULL DEFAULT 'NONE',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        "#,
    )?;
    Ok(())
}

/// Seeds initial backup settings row with default Downloads/IM_MEDICOS_Backups folder
pub fn seed_default_backup_settings(conn: &Connection) -> Result<()> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM backup_settings WHERE id = 1",
        [],
        |row| row.get(0),
    ).unwrap_or(0);

    if count == 0 {
        let default_folder = match std::env::var("USERPROFILE") {
            Ok(user_profile) => format!("{}\\Downloads\\IM_MEDICOS_Backups", user_profile),
            Err(_) => "IM_MEDICOS_Backups".to_string(),
        };

        conn.execute(
            r#"INSERT INTO backup_settings (
                id, auto_backup_enabled, backup_folder, retention_count, last_backup_status
            ) VALUES (1, 1, ?1, 7, 'NONE')"#,
            params![default_folder],
        )?;
    }

    Ok(())
}

/// Retrieves the active backup settings
pub fn fetch_backup_settings(conn: &Connection) -> Result<BackupSettings> {
    seed_default_backup_settings(conn).ok();
    let mut stmt = conn.prepare(
        r#"SELECT 
            auto_backup_enabled, backup_folder, retention_count, 
            last_backup_time, last_backup_size, last_backup_status, updated_at
        FROM backup_settings WHERE id = 1"#,
    )?;

    stmt.query_row([], |row| {
        let auto_enabled: i64 = row.get(0)?;
        Ok(BackupSettings {
            auto_backup_enabled: auto_enabled != 0,
            backup_folder: row.get(1)?,
            retention_count: row.get(2)?,
            last_backup_time: row.get(3)?,
            last_backup_size: row.get(4)?,
            last_backup_status: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })
}

/// Persists updated backup settings
pub fn persist_backup_settings(conn: &Connection, settings: &BackupSettings) -> Result<()> {
    conn.execute(
        r#"INSERT INTO backup_settings (
            id, auto_backup_enabled, backup_folder, retention_count, updated_at
        ) VALUES (1, ?1, ?2, ?3, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            auto_backup_enabled = excluded.auto_backup_enabled,
            backup_folder = excluded.backup_folder,
            retention_count = excluded.retention_count,
            updated_at = CURRENT_TIMESTAMP"#,
        params![
            if settings.auto_backup_enabled { 1 } else { 0 },
            settings.backup_folder,
            settings.retention_count.clamp(1, 30),
        ],
    )?;
    Ok(())
}

/// Computes counts of live records (bills, medicines, batches, customers)
pub fn fetch_data_counts(conn: &Connection) -> Result<BackupCounts> {
    let bills: i64 = conn.query_row("SELECT COUNT(*) FROM bills", [], |r| r.get(0)).unwrap_or(0);
    let medicines: i64 = conn.query_row("SELECT COUNT(*) FROM medicines", [], |r| r.get(0)).unwrap_or(0);
    let batches: i64 = conn.query_row("SELECT COUNT(*) FROM medicine_batches", [], |r| r.get(0)).unwrap_or(0);
    let customers: i64 = conn.query_row(
        r#"SELECT COUNT(DISTINCT 
            CASE 
                WHEN LENGTH(TRIM(customer_mobile)) >= 10 THEN SUBSTR(REPLACE(REPLACE(TRIM(customer_mobile), '+91', ''), ' ', ''), -10)
                ELSE TRIM(customer_mobile)
            END
        ) FROM bills WHERE TRIM(customer_mobile) != ''"#,
        [],
        |r| r.get(0)
    ).unwrap_or(0);

    Ok(BackupCounts {
        bills,
        medicines,
        batches,
        customers,
    })
}

/// Pure Rust implementation of SHA-256 (NIST FIPS 180-4 standard)
pub fn sha256_digest(data: &[u8]) -> [u8; 32] {
    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];

    let k: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];

    let bit_len = (data.len() as u64) * 8;
    let mut msg = data.to_vec();
    msg.push(0x80);
    while (msg.len() % 64) != 56 {
        msg.push(0);
    }
    msg.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in msg.chunks_exact(64) {
        let mut w = [0u32; 64];
        for (i, part) in chunk.chunks_exact(4).enumerate() {
            w[i] = u32::from_be_bytes([part[0], part[1], part[2], part[3]]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16].wrapping_add(s0).wrapping_add(w[i - 7]).wrapping_add(s1);
        }

        let mut a = h[0];
        let mut b = h[1];
        let mut c = h[2];
        let mut d = h[3];
        let mut e = h[4];
        let mut f = h[5];
        let mut g = h[6];
        let mut h_val = h[7];

        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = h_val.wrapping_add(s1).wrapping_add(ch).wrapping_add(k[i]).wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);

            h_val = g;
            g = f;
            f = e;
            e = d.wrapping_add(temp1);
            d = c;
            c = b;
            b = a;
            a = temp1.wrapping_add(temp2);
        }

        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
        h[5] = h[5].wrapping_add(f);
        h[6] = h[6].wrapping_add(g);
        h[7] = h[7].wrapping_add(h_val);
    }

    let mut result = [0u8; 32];
    for (i, val) in h.iter().enumerate() {
        result[i * 4..(i + 1) * 4].copy_from_slice(&val.to_be_bytes());
    }
    result
}

pub fn compute_sha256_hex(data: &[u8]) -> String {
    let bytes = sha256_digest(data);
    let mut s = String::with_capacity(64);
    for b in bytes {
        s.push_str(&format!("{:02x}", b));
    }
    s
}

pub fn compute_file_sha256<P: AsRef<Path>>(path: P) -> std::io::Result<String> {
    let bytes = std::fs::read(path)?;
    Ok(compute_sha256_hex(&bytes))
}

/// Creates a full, verified backup archive into target folder
pub fn create_database_backup(
    conn: &Connection,
    app_data_dir: &Path,
    backup_folder: &Path,
    backup_type: &str,
) -> Result<BackupRecord> {
    std::fs::create_dir_all(backup_folder).map_err(|e| {
        rusqlite::Error::UserFunctionError(Box::new(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to create backup directory: {}", e),
        )))
    })?;

    // Timestamp from SQLite localtime
    let timestamp_file: String = conn.query_row(
        "SELECT strftime('%Y-%m-%d_%H-%M-%S', 'now', 'localtime')",
        [],
        |row| row.get(0),
    )?;

    let timestamp_display: String = conn.query_row(
        "SELECT strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')",
        [],
        |row| row.get(0),
    )?;

    let file_name = if backup_type == "Pre-restore" {
        format!("IM_MEDICOS_Backup_{}_PreRestore.zip", timestamp_file)
    } else {
        format!("IM_MEDICOS_Backup_{}.zip", timestamp_file)
    };

    let final_zip_path = backup_folder.join(&file_name);

    // Staging temp directory for atomic snapshot preparation
    let staging_dir = std::env::temp_dir().join(format!("im_medicos_staging_{}", timestamp_file));
    std::fs::create_dir_all(&staging_dir).map_err(|e| {
        rusqlite::Error::UserFunctionError(Box::new(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to create staging directory: {}", e),
        )))
    })?;

    let staging_db = staging_dir.join("im_medicos.db");
    let staging_db_str = staging_db.to_string_lossy().to_string();

    // 1. Online SQLite backup snapshot via VACUUM INTO
    conn.execute("VACUUM INTO ?1", params![staging_db_str])?;

    // 2. Verify PRAGMA integrity_check on the snapshot
    {
        let verify_conn = Connection::open(&staging_db)?;
        let integrity: String = verify_conn.query_row("PRAGMA integrity_check;", [], |r| r.get(0))?;
        if integrity != "ok" {
            std::fs::remove_dir_all(&staging_dir).ok();
            return Err(rusqlite::Error::UserFunctionError(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("Database snapshot integrity check failed: {}", integrity),
            ))));
        }
    }

    // 3. Compute checksums
    let mut checksums = std::collections::HashMap::new();
    let db_checksum = compute_file_sha256(&staging_db).map_err(|e| {
        rusqlite::Error::UserFunctionError(Box::new(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to compute database SHA-256: {}", e),
        )))
    })?;
    checksums.insert("im_medicos.db".to_string(), db_checksum);

    // 4. Copy logos folder if present
    let live_logos = app_data_dir.join("logos");
    let mut has_logos = false;
    if live_logos.exists() {
        let staging_logos = staging_dir.join("logos");
        std::fs::create_dir_all(&staging_logos).ok();
        if let Ok(entries) = std::fs::read_dir(&live_logos) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() {
                    let fname = entry.file_name().to_string_lossy().to_string();
                    let target_logo = staging_logos.join(&fname);
                    if std::fs::copy(&p, &target_logo).is_ok() {
                        has_logos = true;
                        if let Ok(logo_hash) = compute_file_sha256(&target_logo) {
                            checksums.insert(format!("logos/{}", fname), logo_hash);
                        }
                    }
                }
            }
        }
    }

    // 5. Gather data counts
    let counts = fetch_data_counts(conn)?;

    // 6. Generate manifest.json
    let manifest = BackupManifest {
        app_name: "IM MEDICOS".to_string(),
        app_version: "0.1.0".to_string(),
        schema_version: 1,
        created_at: timestamp_display.clone(),
        backup_type: backup_type.to_string(),
        counts,
        checksums,
    };

    let manifest_bytes = serde_json::to_vec_pretty(&manifest).map_err(|e| {
        rusqlite::Error::UserFunctionError(Box::new(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to serialize manifest: {}", e),
        )))
    })?;
    std::fs::write(staging_dir.join("manifest.json"), manifest_bytes).map_err(|e| {
        rusqlite::Error::UserFunctionError(Box::new(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to write manifest.json: {}", e),
        )))
    })?;

    // 7. Archive using native Windows tar.exe
    let temp_zip_path = staging_dir.join("archive_temp.zip");
    let mut tar_cmd = std::process::Command::new("tar.exe");
    tar_cmd.arg("-a").arg("-cf").arg(&temp_zip_path).arg("-C").arg(&staging_dir);
    tar_cmd.arg("manifest.json").arg("im_medicos.db");
    if has_logos {
        tar_cmd.arg("logos");
    }

    let status = tar_cmd.status().map_err(|e| {
        rusqlite::Error::UserFunctionError(Box::new(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to execute zip compression: {}", e),
        )))
    })?;

    if !status.success() || !temp_zip_path.exists() {
        std::fs::remove_dir_all(&staging_dir).ok();
        return Err(rusqlite::Error::UserFunctionError(Box::new(std::io::Error::new(
            std::io::ErrorKind::Other,
            "Zip archiving returned non-zero status code".to_string(),
        ))));
    }

    let size_bytes = match std::fs::metadata(&temp_zip_path) {
        Ok(m) => m.len() as i64,
        Err(_) => 0,
    };

    // 8. Atomically move archive to destination
    if let Err(e) = std::fs::copy(&temp_zip_path, &final_zip_path) {
        std::fs::remove_dir_all(&staging_dir).ok();
        return Err(rusqlite::Error::UserFunctionError(Box::new(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to save backup zip: {}", e),
        ))));
    }

    // Cleanup staging
    std::fs::remove_dir_all(&staging_dir).ok();

    // 9. Update backup settings table with last backup metadata
    conn.execute(
        r#"UPDATE backup_settings SET 
            last_backup_time = ?1,
            last_backup_size = ?2,
            last_backup_status = 'SUCCESS',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1"#,
        params![timestamp_display, size_bytes],
    ).ok();

    // 10. If automatic backup, execute retention cleanup
    if backup_type == "Auto" {
        cleanup_auto_backup_retention(conn, backup_folder).ok();
    }

    Ok(BackupRecord {
        file_name,
        file_path: final_zip_path.to_string_lossy().to_string(),
        size_bytes,
        created_at: timestamp_display,
        backup_type: backup_type.to_string(),
        manifest: Some(manifest),
    })
}

/// Enforces automatic backup retention count by deleting oldest Auto backups
pub fn cleanup_auto_backup_retention(conn: &Connection, backup_folder: &Path) -> Result<()> {
    let settings = fetch_backup_settings(conn)?;
    let retention_limit = settings.retention_count.max(1) as usize;

    let records = list_backups_in_folder(backup_folder)?;
    let auto_records: Vec<_> = records
        .into_iter()
        .filter(|r| r.backup_type == "Auto")
        .collect();

    if auto_records.len() > retention_limit {
        // Records are already sorted newest first
        for old_record in &auto_records[retention_limit..] {
            std::fs::remove_file(&old_record.file_path).ok();
        }
    }

    Ok(())
}

/// Lists all backup archives found in the specified backup folder
pub fn list_backups_in_folder(backup_folder: &Path) -> Result<Vec<BackupRecord>> {
    if !backup_folder.exists() {
        return Ok(Vec::new());
    }

    let mut records = Vec::new();
    let entries = match std::fs::read_dir(backup_folder) {
        Ok(e) => e,
        Err(_) => return Ok(Vec::new()),
    };

    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_file() {
            let fname = entry.file_name().to_string_lossy().to_string();
            if fname.starts_with("IM_MEDICOS_Backup_") && fname.ends_with(".zip") {
                let metadata = match p.metadata() {
                    Ok(m) => m,
                    Err(_) => continue,
                };
                let size_bytes = metadata.len() as i64;

                let backup_type = if fname.contains("_PreRestore") {
                    "Pre-restore".to_string()
                } else if fname.contains("_Auto") {
                    "Auto".to_string()
                } else {
                    // Check manifest inside zip or default to Manual
                    "Manual".to_string()
                };

                // Date from modified time or filename
                let created_at = extract_date_from_filename(&fname).unwrap_or_else(|| {
                    if let Ok(mod_time) = metadata.modified() {
                        let dur = mod_time.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                        format!("Timestamp {}", dur.as_secs())
                    } else {
                        "Unknown".to_string()
                    }
                });

                records.push(BackupRecord {
                    file_name: fname,
                    file_path: p.to_string_lossy().to_string(),
                    size_bytes,
                    created_at,
                    backup_type,
                    manifest: None,
                });
            }
        }
    }

    // Sort newest first
    records.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(records)
}

fn extract_date_from_filename(fname: &str) -> Option<String> {
    // IM_MEDICOS_Backup_YYYY-MM-DD_HH-MM-SS.zip
    let stem = fname.strip_prefix("IM_MEDICOS_Backup_")?;
    let raw_date = stem.split('.').next()?;
    let clean = raw_date.replace("_PreRestore", "").replace("_Auto", "");
    if clean.len() >= 19 {
        let parts: Vec<&str> = clean.split('_').collect();
        if parts.len() >= 2 {
            let d = parts[0];
            let t = parts[1].replace('-', ":");
            return Some(format!("{} {}", d, t));
        }
    }
    None
}

/// Deletes a backup archive safely
pub fn delete_backup_file(file_path: &Path) -> Result<()> {
    if !file_path.exists() {
        return Ok(());
    }

    let fname = file_path.file_name().and_then(|f| f.to_str()).unwrap_or_default();
    if !fname.starts_with("IM_MEDICOS_Backup_") || !fname.ends_with(".zip") {
        return Err(rusqlite::Error::UserFunctionError(Box::new(std::io::Error::new(
            std::io::ErrorKind::PermissionDenied,
            "Only IM MEDICOS backup archives (.zip) can be deleted",
        ))));
    }

    std::fs::remove_file(file_path).map_err(|e| {
        rusqlite::Error::UserFunctionError(Box::new(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to delete backup file: {}", e),
        )))
    })?;

    Ok(())
}

/// Validates a backup archive before restore (format, manifest, app name, schema, checksums, integrity)
pub fn validate_backup_file(
    app_data_dir: &Path,
    zip_path: &Path,
) -> Result<BackupValidationResult> {
    let live_db_path = app_data_dir.join("im_medicos.db");
    let current_counts = if live_db_path.exists() {
        if let Ok(conn) = Connection::open(&live_db_path) {
            fetch_data_counts(&conn).ok()
        } else {
            None
        }
    } else {
        None
    };

    if !zip_path.exists() {
        return Ok(BackupValidationResult {
            is_valid: false,
            error: Some("Backup file does not exist or cannot be accessed".to_string()),
            manifest: None,
            current_counts,
        });
    }

    let temp_extract_dir = std::env::temp_dir().join(format!(
        "im_medicos_val_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    ));

    std::fs::create_dir_all(&temp_extract_dir).ok();

    // 1. Extract zip with tar.exe
    let mut tar_cmd = std::process::Command::new("tar.exe");
    tar_cmd.arg("-xf").arg(zip_path).arg("-C").arg(&temp_extract_dir);
    let status = match tar_cmd.status() {
        Ok(s) => s,
        Err(e) => {
            std::fs::remove_dir_all(&temp_extract_dir).ok();
            return Ok(BackupValidationResult {
                is_valid: false,
                error: Some(format!("Failed to open backup zip: {}", e)),
                manifest: None,
                current_counts,
            });
        }
    };

    if !status.success() {
        std::fs::remove_dir_all(&temp_extract_dir).ok();
        return Ok(BackupValidationResult {
            is_valid: false,
            error: Some("Corrupt or invalid backup zip file".to_string()),
            manifest: None,
            current_counts,
        });
    }

    // 2. Validate manifest.json exists
    let manifest_path = temp_extract_dir.join("manifest.json");
    if !manifest_path.exists() {
        std::fs::remove_dir_all(&temp_extract_dir).ok();
        return Ok(BackupValidationResult {
            is_valid: false,
            error: Some("Invalid backup archive: manifest.json missing".to_string()),
            manifest: None,
            current_counts,
        });
    }

    let manifest_bytes = match std::fs::read(&manifest_path) {
        Ok(b) => b,
        Err(_) => {
            std::fs::remove_dir_all(&temp_extract_dir).ok();
            return Ok(BackupValidationResult {
                is_valid: false,
                error: Some("Failed to read manifest.json".to_string()),
                manifest: None,
                current_counts,
            });
        }
    };

    let manifest: BackupManifest = match serde_json::from_slice(&manifest_bytes) {
        Ok(m) => m,
        Err(e) => {
            std::fs::remove_dir_all(&temp_extract_dir).ok();
            return Ok(BackupValidationResult {
                is_valid: false,
                error: Some(format!("Invalid manifest structure: {}", e)),
                manifest: None,
                current_counts,
            });
        }
    };

    // 3. Verify app name
    if manifest.app_name != "IM MEDICOS" {
        std::fs::remove_dir_all(&temp_extract_dir).ok();
        return Ok(BackupValidationResult {
            is_valid: false,
            error: Some(format!(
                "Backup archive was created for '{}', not 'IM MEDICOS'",
                manifest.app_name
            )),
            manifest: None,
            current_counts,
        });
    }

    // 4. Verify schema version (cannot restore newer schema than app supports)
    if manifest.schema_version > 1 {
        std::fs::remove_dir_all(&temp_extract_dir).ok();
        return Ok(BackupValidationResult {
            is_valid: false,
            error: Some(format!(
                "Backup was created with a newer software version (schema v{}). Please update IM MEDICOS before restoring.",
                manifest.schema_version
            )),
            manifest: None,
            current_counts,
        });
    }

    // 5. Verify SHA-256 checksums
    for (rel_path, expected_hash) in &manifest.checksums {
        // Zip-slip protection: forbid .. or absolute paths
        if rel_path.contains("..") || rel_path.starts_with('/') || rel_path.starts_with('\\') {
            std::fs::remove_dir_all(&temp_extract_dir).ok();
            return Ok(BackupValidationResult {
                is_valid: false,
                error: Some("Suspicious path detected in backup archive (path traversal rejected)".to_string()),
                manifest: None,
                current_counts,
            });
        }

        let target_file = temp_extract_dir.join(rel_path);
        if !target_file.exists() {
            std::fs::remove_dir_all(&temp_extract_dir).ok();
            return Ok(BackupValidationResult {
                is_valid: false,
                error: Some(format!("Missing file from archive: {}", rel_path)),
                manifest: None,
                current_counts,
            });
        }

        let actual_hash = match compute_file_sha256(&target_file) {
            Ok(h) => h,
            Err(e) => {
                std::fs::remove_dir_all(&temp_extract_dir).ok();
                return Ok(BackupValidationResult {
                    is_valid: false,
                    error: Some(format!("Could not read {} for checksum verification: {}", rel_path, e)),
                    manifest: None,
                    current_counts,
                });
            }
        };

        if &actual_hash != expected_hash {
            std::fs::remove_dir_all(&temp_extract_dir).ok();
            return Ok(BackupValidationResult {
                is_valid: false,
                error: Some(format!(
                    "SHA-256 checksum mismatch for '{}'. Archive may be corrupted or modified.",
                    rel_path
                )),
                manifest: None,
                current_counts,
            });
        }
    }

    // 6. Verify SQLite database integrity
    let extracted_db = temp_extract_dir.join("im_medicos.db");
    if !extracted_db.exists() {
        std::fs::remove_dir_all(&temp_extract_dir).ok();
        return Ok(BackupValidationResult {
            is_valid: false,
            error: Some("Archive does not contain im_medicos.db".to_string()),
            manifest: None,
            current_counts,
        });
    }

    let integrity_result = match Connection::open(&extracted_db) {
        Ok(test_conn) => {
            let res: std::result::Result<String, _> = test_conn.query_row("PRAGMA integrity_check;", [], |r| r.get(0));
            res.unwrap_or_else(|e| format!("integrity error: {}", e))
        }
        Err(e) => format!("Failed to open extracted SQLite database: {}", e),
    };

    if integrity_result != "ok" {
        std::fs::remove_dir_all(&temp_extract_dir).ok();
        return Ok(BackupValidationResult {
            is_valid: false,
            error: Some(format!("Database integrity check failed: {}", integrity_result)),
            manifest: None,
            current_counts,
        });
    }

    std::fs::remove_dir_all(&temp_extract_dir).ok();

    Ok(BackupValidationResult {
        is_valid: true,
        error: None,
        manifest: Some(manifest),
        current_counts,
    })
}

/// Performs safe restore with pre-restore safety snapshot and automatic rollback on failure
pub fn perform_restore(app_data_dir: &Path, zip_path: &Path) -> Result<RestoreResult> {
    // Step 1: Pre-validation
    let validation = validate_backup_file(app_data_dir, zip_path)?;
    if !validation.is_valid {
        return Ok(RestoreResult {
            success: false,
            message: validation.error.unwrap_or_else(|| "Backup validation failed".to_string()),
            pre_restore_file: None,
            restored_counts: None,
        });
    }

    let manifest = validation.manifest.ok_or_else(|| {
        rusqlite::Error::UserFunctionError(Box::new(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Manifest not found in validation",
        )))
    })?;

    let live_db_path = app_data_dir.join("im_medicos.db");

    // Step 2: Automatic Pre-restore safety snapshot
    let mut pre_restore_file_name = None;
    if live_db_path.exists() {
        let conn = Connection::open(&live_db_path)?;
        let settings = fetch_backup_settings(&conn)?;
        let backup_folder = Path::new(&settings.backup_folder);

        let pre_backup = create_database_backup(&conn, app_data_dir, backup_folder, "Pre-restore");
        match pre_backup {
            Ok(rec) => pre_restore_file_name = Some(rec.file_name),
            Err(e) => {
                return Ok(RestoreResult {
                    success: false,
                    message: format!("Restore aborted: Failed to create safety Pre-restore backup ({})", e),
                    pre_restore_file: None,
                    restored_counts: None,
                });
            }
        }
    }

    // Step 3: Extract archive into staging restore directory
    let temp_restore_dir = std::env::temp_dir().join(format!(
        "im_medicos_payload_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    ));

    std::fs::create_dir_all(&temp_restore_dir).ok();

    let mut tar_cmd = std::process::Command::new("tar.exe");
    tar_cmd.arg("-xf").arg(zip_path).arg("-C").arg(&temp_restore_dir);
    if let Err(e) = tar_cmd.status() {
        std::fs::remove_dir_all(&temp_restore_dir).ok();
        return Ok(RestoreResult {
            success: false,
            message: format!("Failed to extract backup payload: {}", e),
            pre_restore_file: pre_restore_file_name,
            restored_counts: None,
        });
    }

    // Step 4: Atomic file swap with rollback safety
    let swap_db_path = app_data_dir.join("im_medicos.db.bak_swap");
    let swap_logos_path = app_data_dir.join("logos.bak_swap");
    let live_logos_path = app_data_dir.join("logos");
    let live_wal_path = app_data_dir.join("im_medicos.db-wal");
    let live_shm_path = app_data_dir.join("im_medicos.db-shm");

    // Clean up any stale swap files
    std::fs::remove_file(&swap_db_path).ok();
    std::fs::remove_dir_all(&swap_logos_path).ok();

    // Move current live to swap
    let mut swapped_db = false;
    let mut swapped_logos = false;

    if live_db_path.exists() {
        if let Err(e) = std::fs::rename(&live_db_path, &swap_db_path) {
            std::fs::remove_dir_all(&temp_restore_dir).ok();
            return Ok(RestoreResult {
                success: false,
                message: format!("Failed to stage live database for swap: {}", e),
                pre_restore_file: pre_restore_file_name,
                restored_counts: None,
            });
        }
        swapped_db = true;
        // Clean WAL/SHM from previous live connection
        std::fs::remove_file(&live_wal_path).ok();
        std::fs::remove_file(&live_shm_path).ok();
    }

    if live_logos_path.exists() {
        if std::fs::rename(&live_logos_path, &swap_logos_path).is_ok() {
            swapped_logos = true;
        }
    }

    // Copy restored database into live position
    let extracted_db = temp_restore_dir.join("im_medicos.db");
    if let Err(e) = std::fs::copy(&extracted_db, &live_db_path) {
        // Rollback
        if swapped_db {
            std::fs::rename(&swap_db_path, &live_db_path).ok();
        }
        if swapped_logos {
            std::fs::rename(&swap_logos_path, &live_logos_path).ok();
        }
        std::fs::remove_dir_all(&temp_restore_dir).ok();
        return Ok(RestoreResult {
            success: false,
            message: format!("Restore failed copying database file: {}. Previous state rolled back.", e),
            pre_restore_file: pre_restore_file_name,
            restored_counts: None,
        });
    }

    // Copy restored logos if present in payload
    let extracted_logos = temp_restore_dir.join("logos");
    if extracted_logos.exists() {
        std::fs::create_dir_all(&live_logos_path).ok();
        if let Ok(entries) = std::fs::read_dir(&extracted_logos) {
            for entry in entries.flatten() {
                let target = live_logos_path.join(entry.file_name());
                std::fs::copy(entry.path(), target).ok();
            }
        }
    }

    // Step 5: Verify restored database opens and passes quick_check
    let verify_swap = match Connection::open(&live_db_path) {
        Ok(c) => {
            let res: std::result::Result<String, _> = c.query_row("PRAGMA quick_check;", [], |r| r.get(0));
            res.unwrap_or_else(|e| format!("quick_check error: {}", e))
        }
        Err(e) => format!("Could not open restored database: {}", e),
    };

    if verify_swap != "ok" {
        // ROLLBACK
        std::fs::remove_file(&live_db_path).ok();
        if swapped_db {
            std::fs::rename(&swap_db_path, &live_db_path).ok();
        }
        if swapped_logos {
            std::fs::remove_dir_all(&live_logos_path).ok();
            std::fs::rename(&swap_logos_path, &live_logos_path).ok();
        }
        std::fs::remove_dir_all(&temp_restore_dir).ok();
        return Ok(RestoreResult {
            success: false,
            message: format!("Restored database failed integrity verification ({}). Active data rolled back.", verify_swap),
            pre_restore_file: pre_restore_file_name,
            restored_counts: None,
        });
    }

    // Successful restore: clean up swap files and temp files
    std::fs::remove_file(&swap_db_path).ok();
    std::fs::remove_dir_all(&swap_logos_path).ok();
    std::fs::remove_dir_all(&temp_restore_dir).ok();

    // Run baseline migrations on restored database to ensure backup_settings table exists
    if let Ok(conn) = Connection::open(&live_db_path) {
        migrate_backup_tables(&conn).ok();
        seed_default_backup_settings(&conn).ok();
    }

    Ok(RestoreResult {
        success: true,
        message: "Data restored successfully from backup. Please log in with your credentials.".to_string(),
        pre_restore_file: pre_restore_file_name,
        restored_counts: Some(manifest.counts),
    })
}

/// Checks if automatic backup is enabled and runs daily backup if not already completed today
pub fn check_and_run_auto_backup(
    conn: &Connection,
    app_data_dir: &Path,
) -> Result<Option<BackupRecord>> {
    let settings = fetch_backup_settings(conn)?;
    if !settings.auto_backup_enabled {
        return Ok(None);
    }

    let today: String = conn.query_row("SELECT date('now', 'localtime')", [], |r| r.get(0))?;

    if let Some(ref last_time) = settings.last_backup_time {
        if last_time.starts_with(&today) {
            // Already backed up today
            return Ok(None);
        }
    }

    let backup_folder = Path::new(&settings.backup_folder);
    let record = create_database_backup(conn, app_data_dir, backup_folder, "Auto")?;
    Ok(Some(record))
}



