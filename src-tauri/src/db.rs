use rusqlite::{Connection, Result};
use std::path::Path;

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

        -- Clinic/Pharmacy Profile
        CREATE TABLE IF NOT EXISTS pharmacy_profile (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            license_number TEXT,
            gstin TEXT,
            address TEXT,
            phone TEXT,
            email TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
        // Seed development user admin / admin123 (hashed in future auth phase)
        conn.execute(
            "INSERT INTO users (username, password_hash, full_name, role)
             VALUES (?1, ?2, ?3, ?4)",
            ("admin", "admin123", "System Administrator", "admin"),
        )?;
    }

    Ok(())
}
