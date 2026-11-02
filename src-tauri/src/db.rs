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
    seed_default_admin(&conn)?;
    seed_default_store(&conn)?;

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
            hsn_code TEXT,
            batch_no TEXT,
            mfg_date DATE,
            exp_date DATE,
            mrp REAL NOT NULL,
            rate REAL NOT NULL,
            stock_qty INTEGER NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

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
