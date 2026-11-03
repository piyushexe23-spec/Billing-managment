use rusqlite::{Connection, Result, params};
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
    seed_default_admin(&conn)?;
    seed_default_store(&conn)?;
    seed_default_medicines(&conn)?;

    Ok(conn)
}

/// Opens connection to existing database
pub fn get_connection<P: AsRef<Path>>(path: P) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;
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
    pub expiring_soon_count: i64,
    pub expired_count: i64,
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

    Ok(())
}

/// Seeds default test medicines and batches if database has zero medicines
pub fn seed_default_medicines(conn: &Connection) -> Result<()> {
    let mut stmt = conn.prepare("SELECT COUNT(*) FROM medicines")?;
    let count: i64 = stmt.query_row([], |row| row.get(0))?;

    if count == 0 {
        // Medicine 1: Paracetamol 650mg
        conn.execute(
            r#"INSERT INTO medicines (id, name, generic_name, manufacturer, category, description, barcode, unit, low_stock_threshold)
               VALUES (1, 'Dolo 650 Tablet', 'Paracetamol 650mg', 'Micro Labs Ltd', 'Analgesic & Antipyretic', 'Fever and mild to moderate pain relief', '8901234567890', 'Strip', 20)"#,
            [],
        )?;
        // Batch 1: Safe
        conn.execute(
            r#"INSERT INTO medicine_batches (medicine_id, batch_number, mfg_date, exp_date, cost_price, mrp, selling_price, stock_qty)
               VALUES (1, 'DL-650-A1', '2025-01-10', '2027-12-31', 22.50, 34.00, 31.00, 150)"#,
            [],
        )?;
        // Batch 2: Expiring soon (for testing alerts)
        conn.execute(
            r#"INSERT INTO medicine_batches (medicine_id, batch_number, mfg_date, exp_date, cost_price, mrp, selling_price, stock_qty)
               VALUES (1, 'DL-650-EXP', '2024-05-01', date('now', '+5 days'), 20.00, 32.00, 28.00, 8)"#,
            [],
        )?;

        // Medicine 2: Amoxicillin 500mg (Low Stock)
        conn.execute(
            r#"INSERT INTO medicines (id, name, generic_name, manufacturer, category, description, barcode, unit, low_stock_threshold)
               VALUES (2, 'Augmentin 625 Duo', 'Amoxicillin & Potassium Clavulanate', 'GlaxoSmithKline', 'Antibiotics', 'Bacterial infections', '8901234567891', 'Strip', 15)"#,
            [],
        )?;
        conn.execute(
            r#"INSERT INTO medicine_batches (medicine_id, batch_number, mfg_date, exp_date, cost_price, mrp, selling_price, stock_qty)
               VALUES (2, 'AUG-24-99', '2025-02-15', '2027-06-30', 145.00, 204.00, 190.00, 6)"#,
            [],
        )?;

        // Medicine 3: Azithromycin 500mg (Out of Stock)
        conn.execute(
            r#"INSERT INTO medicines (id, name, generic_name, manufacturer, category, description, barcode, unit, low_stock_threshold)
               VALUES (3, 'Azithral 500 Tablet', 'Azithromycin 500mg', 'Alembic Pharma', 'Antibiotics', 'Respiratory and soft tissue infections', '8901234567892', 'Strip', 10)"#,
            [],
        )?;
        conn.execute(
            r#"INSERT INTO medicine_batches (medicine_id, batch_number, mfg_date, exp_date, cost_price, mrp, selling_price, stock_qty)
               VALUES (3, 'AZ-500-OOS', '2024-11-01', '2026-10-31', 95.00, 132.00, 120.00, 0)"#,
            [],
        )?;

        // Medicine 4: Cetirizine 10mg
        conn.execute(
            r#"INSERT INTO medicines (id, name, generic_name, manufacturer, category, description, barcode, unit, low_stock_threshold)
               VALUES (4, 'Cetcip 10mg', 'Cetirizine Hydrochloride', 'Cipla Ltd', 'Antihistamine', 'Allergy, rhinitis, and urticaria', '8901234567893', 'Strip', 25)"#,
            [],
        )?;
        conn.execute(
            r#"INSERT INTO medicine_batches (medicine_id, batch_number, mfg_date, exp_date, cost_price, mrp, selling_price, stock_qty)
               VALUES (4, 'CC-10-88', '2025-01-01', '2028-03-31', 12.00, 21.00, 19.50, 80)"#,
            [],
        )?;

        // Record Initial Stock Movements
        conn.execute(
            r#"INSERT INTO stock_movements (medicine_id, batch_id, movement_type, quantity, previous_qty, new_qty, reason)
               VALUES (1, 1, 'OPENING_STOCK', 150, 0, 150, 'Initial inventory setup'),
                      (1, 2, 'OPENING_STOCK', 8, 0, 8, 'Initial inventory setup'),
                      (2, 3, 'OPENING_STOCK', 6, 0, 6, 'Initial inventory setup'),
                      (4, 5, 'OPENING_STOCK', 80, 0, 80, 'Initial inventory setup')"#,
            [],
        )?;
    }

    Ok(())
}

/// Fetches all active medicines along with their active batches
pub fn fetch_medicines_with_batches(conn: &Connection) -> Result<Vec<MedicineWithBatches>> {
    let mut stmt = conn.prepare(
        r#"SELECT id, name, generic_name, manufacturer, category, description, barcode, hsn_code, unit, low_stock_threshold, is_active, created_at, updated_at
           FROM medicines
           WHERE is_active = 1
           ORDER BY name ASC"#,
    )?;

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
    let tx = conn.transaction()?;

    tx.execute(
        r#"INSERT INTO medicines (name, generic_name, manufacturer, category, description, barcode, hsn_code, unit, low_stock_threshold, is_active, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"#,
        params![name, generic_name, manufacturer, category, description, barcode, hsn_code, unit, low_stock_threshold],
    )?;

    let medicine_id = tx.last_insert_rowid();

    if let Some(b) = batch {
        tx.execute(
            r#"INSERT INTO medicine_batches (medicine_id, batch_number, mfg_date, exp_date, cost_price, mrp, selling_price, stock_qty, is_active, created_at, updated_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"#,
            params![medicine_id, b.batch_number, b.mfg_date, b.exp_date, b.cost_price, b.mrp, b.selling_price, b.stock_qty],
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

/// Soft deletes / archives a medicine so it cannot be selected in future billing
pub fn archive_medicine(conn: &Connection, medicine_id: i64) -> Result<()> {
    conn.execute(
        "UPDATE medicines SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        params![medicine_id],
    )?;
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

    // 5. Completed sales data (honest empty state if billing not yet active)
    let medicines_with_sales = 0;
    let top_selling_medicines = Vec::new();

    Ok(InventorySummaryMetrics {
        total_medicines,
        total_stock_units,
        medicines_with_sales,
        top_selling_medicines,
        low_stock_count,
        out_of_stock_count,
        expiring_soon_count,
        expired_count,
    })
}

