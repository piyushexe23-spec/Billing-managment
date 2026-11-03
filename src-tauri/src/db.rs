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
    seed_default_admin(&conn)?;
    seed_default_store(&conn)?;
    cleanup_demo_medicines(&conn)?;

    Ok(conn)
}

/// Opens connection to existing database
pub fn get_connection<P: AsRef<Path>>(path: P) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;
    migrate_billing_tables(&conn).ok();
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

    // Insert bill record
    tx.execute(
        r#"INSERT INTO bills (
            bill_number, customer_name, customer_mobile, doctor_name, bill_date,
            discount_mode, payment_mode, sub_total, discount, gst_total, cgst, sgst, grand_total,
            amount_in_words, store_name, store_address, store_phone, store_email, store_gstin,
            store_dl_1, store_dl_2, store_footer_terms, show_gstin, show_amount_in_words,
            status, created_at
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5,
            ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13,
            ?14, ?15, ?16, ?17, ?18, ?19,
            ?20, ?21, ?22, ?23, ?24,
            'COMPLETED', ?25
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

