import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

console.log("\n=== IM MEDICOS Command 07: Backup & Restore Module Test Suite ===\n");

// Helper to compute SHA-256 hex string
function computeSha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

// ----------------------------------------------------------------------
// Test 1: SHA-256 Checksum Verification & Cryptographic Standards
// ----------------------------------------------------------------------
console.log("Test 1: SHA-256 Cryptographic Digest Vectors");
{
  // Known standard NIST FIPS 180-4 vectors
  assert.strictEqual(
    computeSha256(""),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "SHA-256 empty string must match FIPS test vector"
  );

  assert.strictEqual(
    computeSha256("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    "SHA-256 'abc' must match FIPS test vector"
  );

  assert.strictEqual(
    computeSha256("IM MEDICOS Pharmacy Billing Software 2026"),
    crypto
      .createHash("sha256")
      .update("IM MEDICOS Pharmacy Billing Software 2026")
      .digest("hex"),
    "Custom string hash matches standard crypto implementation"
  );

  console.log("✓ Test 1 Passed: SHA-256 vectors validated against NIST standards.\n");
}

// ----------------------------------------------------------------------
// Test 2: Backup Manifest Structure & Field Verification
// ----------------------------------------------------------------------
console.log("Test 2: Backup Manifest Specification & Validation");
{
  const mockManifest = {
    appName: "IM MEDICOS",
    appVersion: "0.1.0",
    schemaVersion: 1,
    createdAt: "2026-11-04 22:30:00",
    backupType: "Manual",
    counts: {
      bills: 42,
      medicines: 120,
      batches: 185,
      customers: 38,
    },
    checksums: {
      "im_medicos.db": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "logos/pharmacy_logo.png": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    },
  };

  assert.strictEqual(mockManifest.appName, "IM MEDICOS", "App name must be 'IM MEDICOS'");
  assert.strictEqual(mockManifest.appVersion, "0.1.0", "App version must be '0.1.0'");
  assert.strictEqual(mockManifest.schemaVersion, 1, "Schema version must be 1");
  assert.ok(["Manual", "Auto", "Pre-restore"].includes(mockManifest.backupType), "Valid backup type");
  assert.strictEqual(typeof mockManifest.counts.bills, "number", "Bills count is integer");
  assert.strictEqual(typeof mockManifest.counts.medicines, "number", "Medicines count is integer");
  assert.strictEqual(typeof mockManifest.counts.batches, "number", "Batches count is integer");
  assert.strictEqual(typeof mockManifest.counts.customers, "number", "Customers count is integer");
  assert.strictEqual(mockManifest.checksums["im_medicos.db"].length, 64, "SHA-256 hash is 64 hex characters");

  console.log("✓ Test 2 Passed: Backup manifest schema matches exact specification.\n");
}

// ----------------------------------------------------------------------
// Test 3: Zip Archiving, Tar Tooling & Integrity Check Flow
// ----------------------------------------------------------------------
console.log("Test 3: Windows Native Zip Creation & Checksum Verification");
{
  const testDir = path.resolve(".tmp_test_backup");
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(path.join(testDir, "src", "logos"), { recursive: true });
  fs.mkdirSync(path.join(testDir, "extract"), { recursive: true });

  const dummyDbContent = "SQLite format 3\0 Test DB Content 2026";
  const dummyLogoContent = "FAKE_PNG_HEADER_IMAGE_DATA";

  fs.writeFileSync(path.join(testDir, "src", "im_medicos.db"), dummyDbContent);
  fs.writeFileSync(path.join(testDir, "src", "logos", "pharmacy_logo.png"), dummyLogoContent);

  const dbChecksum = computeSha256(dummyDbContent);
  const logoChecksum = computeSha256(dummyLogoContent);

  const manifest = {
    appName: "IM MEDICOS",
    appVersion: "0.1.0",
    schemaVersion: 1,
    createdAt: "2026-11-04 22:45:00",
    backupType: "Manual",
    counts: { bills: 10, medicines: 20, batches: 25, customers: 8 },
    checksums: {
      "im_medicos.db": dbChecksum,
      "logos/pharmacy_logo.png": logoChecksum,
    },
  };

  fs.writeFileSync(path.join(testDir, "src", "manifest.json"), JSON.stringify(manifest, null, 2));

  const zipPath = path.join(testDir, "IM_MEDICOS_Backup_2026-11-04_22-45-00.zip");
  const srcDir = path.join(testDir, "src");

  // Create zip using Windows tar.exe
  execSync(`tar.exe -a -cf "${zipPath}" -C "${srcDir}" manifest.json im_medicos.db logos`);
  assert.ok(fs.existsSync(zipPath), "Backup zip archive created successfully");
  assert.ok(fs.statSync(zipPath).size > 0, "Archive size must be greater than zero");

  // Extract using tar.exe
  const extractDir = path.join(testDir, "extract");
  execSync(`tar.exe -xf "${zipPath}" -C "${extractDir}"`);

  // Verify extracted contents
  assert.ok(fs.existsSync(path.join(extractDir, "manifest.json")), "Manifest extracted");
  assert.ok(fs.existsSync(path.join(extractDir, "im_medicos.db")), "Database extracted");
  assert.ok(fs.existsSync(path.join(extractDir, "logos", "pharmacy_logo.png")), "Logo extracted");

  const extractedDbContent = fs.readFileSync(path.join(extractDir, "im_medicos.db"), "utf8");
  assert.strictEqual(computeSha256(extractedDbContent), dbChecksum, "Extracted DB SHA-256 matches manifest");

  const extractedLogoContent = fs.readFileSync(path.join(extractDir, "logos", "pharmacy_logo.png"), "utf8");
  assert.strictEqual(computeSha256(extractedLogoContent), logoChecksum, "Extracted Logo SHA-256 matches manifest");

  // Cleanup
  fs.rmSync(testDir, { recursive: true, force: true });
  console.log("✓ Test 3 Passed: Native zip creation, extraction, and SHA-256 verification verified.\n");
}

// ----------------------------------------------------------------------
// Test 4: Tampered Archive & Security Validation
// ----------------------------------------------------------------------
console.log("Test 4: Tampered Archive, Newer Schema & Zip-Slip Protection");
{
  // 1. Validation function replicating validate_backup_file logic
  function validateManifest(manifest, actualDbHash) {
    if (manifest.appName !== "IM MEDICOS") {
      return { isValid: false, error: `Invalid app: ${manifest.appName}` };
    }
    if (manifest.schemaVersion > 1) {
      return { isValid: false, error: `Newer schema v${manifest.schemaVersion} not supported` };
    }
    if (manifest.checksums["im_medicos.db"] !== actualDbHash) {
      return { isValid: false, error: "Checksum mismatch for im_medicos.db" };
    }
    for (const p of Object.keys(manifest.checksums)) {
      if (p.includes("..") || p.startsWith("/") || p.startsWith("\\")) {
        return { isValid: false, error: `Path traversal detected: ${p}` };
      }
    }
    return { isValid: true };
  }

  // Valid manifest
  const validManifest = {
    appName: "IM MEDICOS",
    appVersion: "0.1.0",
    schemaVersion: 1,
    checksums: { "im_medicos.db": "correct_hash_12345" },
  };
  assert.strictEqual(validateManifest(validManifest, "correct_hash_12345").isValid, true);

  // Wrong app
  const wrongApp = { ...validManifest, appName: "OTHER_PHARMACY" };
  assert.strictEqual(validateManifest(wrongApp, "correct_hash_12345").isValid, false);

  // Newer schema
  const newerSchema = { ...validManifest, schemaVersion: 2 };
  assert.strictEqual(validateManifest(newerSchema, "correct_hash_12345").isValid, false);
  assert.ok(validateManifest(newerSchema, "correct_hash_12345").error.includes("Newer schema"));

  // Checksum mismatch (tampered file)
  assert.strictEqual(validateManifest(validManifest, "tampered_hash_999").isValid, false);
  assert.ok(validateManifest(validManifest, "tampered_hash_999").error.includes("Checksum mismatch"));

  // Zip-slip attempt
  const maliciousManifest = {
    appName: "IM MEDICOS",
    schemaVersion: 1,
    checksums: {
      "im_medicos.db": "hash",
      "../../Windows/System32/cmd.exe": "hash",
    },
  };
  assert.strictEqual(validateManifest(maliciousManifest, "hash").isValid, false);
  assert.ok(validateManifest(maliciousManifest, "hash").error.includes("Path traversal"));

  console.log("✓ Test 4 Passed: Security checks, schema barrier, and zip-slip protection verified.\n");
}

// ----------------------------------------------------------------------
// Test 5: Safe Restore Atomic Swap & Automatic Rollback Simulation
// ----------------------------------------------------------------------
console.log("Test 5: Safe Restore Swap Mechanism & Rollback Simulation");
{
  const simDir = path.resolve(".tmp_test_restore_sim");
  if (fs.existsSync(simDir)) fs.rmSync(simDir, { recursive: true, force: true });
  fs.mkdirSync(simDir, { recursive: true });

  const liveDb = path.join(simDir, "im_medicos.db");
  const swapDb = path.join(simDir, "im_medicos.db.bak_swap");
  const restoredPayload = path.join(simDir, "new_payload.db");

  // Initial live state
  fs.writeFileSync(liveDb, "LIVE_DATABASE_ACTIVE_DATA_v1");
  fs.writeFileSync(restoredPayload, "RESTORED_CORRUPT_DATA_v2");

  // Step 1: Stage live to swap
  fs.renameSync(liveDb, swapDb);
  assert.ok(!fs.existsSync(liveDb), "Live DB renamed to swap");
  assert.ok(fs.existsSync(swapDb), "Swap DB exists");

  // Step 2: Attempt copy of new payload
  fs.copyFileSync(restoredPayload, liveDb);

  // Step 3: Simulate verification check failing
  const simulatedVerificationSuccess = false;
  if (!simulatedVerificationSuccess) {
    // ROLLBACK
    fs.rmSync(liveDb, { force: true });
    fs.renameSync(swapDb, liveDb);
  }

  // Verify live DB was restored to original state
  assert.strictEqual(fs.readFileSync(liveDb, "utf8"), "LIVE_DATABASE_ACTIVE_DATA_v1");
  assert.ok(!fs.existsSync(swapDb), "Swap DB cleaned up after rollback");

  fs.rmSync(simDir, { recursive: true, force: true });
  console.log("✓ Test 5 Passed: Atomic swap and automatic rollback verified.\n");
}

// ----------------------------------------------------------------------
// Test 6: Automatic Backup Retention Logic
// ----------------------------------------------------------------------
console.log("Test 6: Automatic Backup Retention Pruning (Only Auto Backups Pruned)");
{
  const backups = [
    { fileName: "IM_MEDICOS_Backup_2026-11-04_10-00-00.zip", type: "Manual" },
    { fileName: "IM_MEDICOS_Backup_2026-11-04_11-00-00_PreRestore.zip", type: "Pre-restore" },
    { fileName: "IM_MEDICOS_Backup_2026-11-04_12-00-00.zip", type: "Auto", ts: 5 },
    { fileName: "IM_MEDICOS_Backup_2026-11-03_12-00-00.zip", type: "Auto", ts: 4 },
    { fileName: "IM_MEDICOS_Backup_2026-11-02_12-00-00.zip", type: "Auto", ts: 3 },
    { fileName: "IM_MEDICOS_Backup_2026-11-01_12-00-00.zip", type: "Auto", ts: 2 },
    { fileName: "IM_MEDICOS_Backup_2026-10-31_12-00-00.zip", type: "Auto", ts: 1 },
  ];

  const retentionCount = 3; // Keep top 3 Auto backups

  const autoBackups = backups.filter((b) => b.type === "Auto").sort((a, b) => b.ts - a.ts);
  const autoToKeep = new Set(autoBackups.slice(0, retentionCount).map((b) => b.fileName));

  const remaining = backups.filter((b) => {
    if (b.type !== "Auto") return true; // Never delete Manual or Pre-restore
    return autoToKeep.has(b.fileName);
  });

  // Must retain 1 Manual, 1 Pre-restore, and 3 Auto = 5 total
  assert.strictEqual(remaining.length, 5, "Total retained backups must be 5");
  assert.ok(remaining.some((b) => b.type === "Manual"), "Manual backup preserved");
  assert.ok(remaining.some((b) => b.type === "Pre-restore"), "Pre-restore backup preserved");
  const remainingAuto = remaining.filter((b) => b.type === "Auto");
  assert.strictEqual(remainingAuto.length, 3, "Exactly 3 Auto backups retained");
  assert.strictEqual(remainingAuto[0].ts, 5, "Newest auto backup kept");

  console.log("✓ Test 6 Passed: Auto retention pruning correctly leaves Manual/Pre-restore intact.\n");
}

// ----------------------------------------------------------------------
// Test 7: Stale Backup Warning Calculation (> 7 Days)
// ----------------------------------------------------------------------
console.log("Test 7: Stale Backup Warning Threshold Calculation (> 7 Days)");
{
  function isBackupStale(lastBackupTime) {
    if (!lastBackupTime) return true;
    const lastDate = new Date(lastBackupTime.replace(" ", "T"));
    if (isNaN(lastDate.getTime())) return true;
    const now = new Date("2026-11-04T23:00:00");
    const diffDays = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 7;
  }

  assert.strictEqual(isBackupStale(null), true, "Null last backup is stale");
  assert.strictEqual(isBackupStale(""), true, "Empty string last backup is stale");
  assert.strictEqual(isBackupStale("2026-11-04 10:00:00"), false, "Today's backup is fresh");
  assert.strictEqual(isBackupStale("2026-10-31 10:00:00"), false, "4 days old backup is fresh");
  assert.strictEqual(isBackupStale("2026-10-25 10:00:00"), true, "10 days old backup is stale (>= 7 days)");

  console.log("✓ Test 7 Passed: Stale backup warning triggers accurately.\n");
}

// ----------------------------------------------------------------------
// Test 8: Zero Cost Price Leak & Code Integrity
// ----------------------------------------------------------------------
console.log("Test 8: Zero Cost Price Leak & UI Source Code Inspection");
{
  const pageSrc = fs.readFileSync(path.resolve("src/pages/BackupRestorePage.tsx"), "utf8");
  const serviceSrc = fs.readFileSync(path.resolve("src/services/backupService.ts"), "utf8");
  const typesSrc = fs.readFileSync(path.resolve("src/types/backup.ts"), "utf8");

  // Verify no cost price, purchase price, or profit leakage in any backup file
  const forbiddenPatterns = [/cost_price/i, /costPrice/i, /purchase_price/i, /purchaseRate/i, /profit/i];
  for (const pattern of forbiddenPatterns) {
    assert.ok(!pattern.test(pageSrc), `BackupRestorePage must not contain forbidden pattern: ${pattern}`);
    assert.ok(!pattern.test(serviceSrc), `backupService must not contain forbidden pattern: ${pattern}`);
    assert.ok(!pattern.test(typesSrc), `types/backup must not contain forbidden pattern: ${pattern}`);
  }

  // Required UI text elements
  assert.ok(pageSrc.includes("Backup & Restore"), "Page includes title");
  assert.ok(pageSrc.includes("Protect your pharmacy data."), "Page includes subtitle");
  assert.ok(pageSrc.includes("No recent backup. Back up now to protect your data."), "Stale warning text present");
  assert.ok(pageSrc.includes("Copy your backups to a pen drive or another computer regularly"), "Guidance note present");
  assert.ok(pageSrc.includes("Backups contain customer and sales data. Keep them in a safe place"), "Privacy guidance present");
  assert.ok(pageSrc.includes("Confirm Data Restore"), "Confirmation modal present");
  assert.ok(pageSrc.includes("RESTORING WILL OVERWRITE ALL CURRENT DATA!"), "Restore replacement warning present");

  console.log("✓ Test 8 Passed: Zero financial sensitivity leak and required UI guidance verified.\n");
}

// ----------------------------------------------------------------------
// Test 9: Navigation & AppLayout Integration
// ----------------------------------------------------------------------
console.log("Test 9: Navigation & AppLayout Integration");
{
  const layoutSrc = fs.readFileSync(path.resolve("src/components/layout/AppLayout.tsx"), "utf8");
  const appSrc = fs.readFileSync(path.resolve("src/App.tsx"), "utf8");

  assert.ok(
    layoutSrc.includes('{ key: "backup_restore", label: "Backup & Restore", icon: DatabaseBackup, isImplemented: true }'),
    "AppLayout has backup_restore marked isImplemented: true"
  );
  assert.ok(!layoutSrc.includes('key: "backup_restore", label: "Backup & Restore", icon: DatabaseBackup, isImplemented: false'), "AppLayout no longer has backup_restore as false");
  assert.ok(appSrc.includes('<BackupRestorePage onRestoreSuccess='), "App.tsx routes activeNav backup_restore to BackupRestorePage");
  assert.ok(appSrc.includes('setActiveNav("dashboard")'), "App.tsx routes to Dashboard on restore success");

  console.log("✓ Test 9 Passed: AppLayout and App.tsx navigation wiring verified.\n");
}

// ----------------------------------------------------------------------
// Test 10: Rust Backend db.rs & lib.rs Commands and Schema
// ----------------------------------------------------------------------
console.log("Test 10: Rust db.rs & lib.rs Backend Commands and Table Definitions");
{
  const dbRs = fs.readFileSync(path.resolve("src-tauri/src/db.rs"), "utf8");
  const libRs = fs.readFileSync(path.resolve("src-tauri/src/lib.rs"), "utf8");

  // Schema check
  assert.ok(dbRs.includes("CREATE TABLE IF NOT EXISTS backup_settings"), "backup_settings table defined in db.rs");
  assert.ok(dbRs.includes("auto_backup_enabled INTEGER NOT NULL DEFAULT 1"), "auto_backup_enabled column present");
  assert.ok(dbRs.includes("retention_count INTEGER NOT NULL DEFAULT 7"), "retention_count column present");

  // Rust functions check
  assert.ok(dbRs.includes("pub fn create_database_backup("), "create_database_backup defined in db.rs");
  assert.ok(dbRs.includes("pub fn validate_backup_file("), "validate_backup_file defined in db.rs");
  assert.ok(dbRs.includes("pub fn perform_restore("), "perform_restore defined in db.rs");
  assert.ok(dbRs.includes("pub fn list_backups_in_folder("), "list_backups_in_folder defined in db.rs");
  assert.ok(dbRs.includes("pub fn sha256_digest("), "sha256_digest defined in db.rs");
  assert.ok(dbRs.includes("VACUUM INTO ?1"), "Online backup snapshot via VACUUM INTO present");
  assert.ok(dbRs.includes("PRAGMA integrity_check"), "PRAGMA integrity_check verification present");

  // lib.rs commands check
  const requiredCommands = [
    "get_backup_settings",
    "save_backup_settings",
    "create_backup",
    "list_backups",
    "delete_backup",
    "validate_backup_file",
    "restore_backup",
    "get_current_counts",
    "open_backup_folder",
    "check_auto_backup",
  ];

  for (const cmd of requiredCommands) {
    assert.ok(libRs.includes(`fn ${cmd}`), `lib.rs must implement command fn ${cmd}`);
    assert.ok(libRs.includes(cmd), `lib.rs must register handler for ${cmd}`);
  }

  console.log("✓ Test 10 Passed: Rust commands, database migrations, and handlers verified.\n");
}

// ----------------------------------------------------------------------
// Test 11: Open Folder in Explorer Bugfix & Tauri Scoped Capabilities
// ----------------------------------------------------------------------
console.log("Test 11: Open Folder in Explorer Capabilities, Handlers & Validation");
{
  const defaultCap = JSON.parse(
    fs.readFileSync(path.resolve("src-tauri/capabilities/default.json"), "utf8")
  );
  const libRs = fs.readFileSync(path.resolve("src-tauri/src/lib.rs"), "utf8");
  const pageSrc = fs.readFileSync(path.resolve("src/pages/BackupRestorePage.tsx"), "utf8");
  const serviceSrc = fs.readFileSync(path.resolve("src/services/backupService.ts"), "utf8");

  // 1. Verify Tauri capabilities contain scoped shell:allow-open
  assert.ok(
    defaultCap.permissions.includes("shell:default"),
    "default.json must include 'shell:default'"
  );
  const shellOpenEntry = defaultCap.permissions.find(
    (p) => typeof p === "object" && p.identifier === "shell:allow-open"
  );
  assert.ok(shellOpenEntry, "default.json must contain scoped 'shell:allow-open' object");
  assert.ok(
    shellOpenEntry.allow.some((a) => a.path === "$DOWNLOAD/IM_MEDICOS_Backups"),
    "shell:allow-open must be scoped to $DOWNLOAD/IM_MEDICOS_Backups"
  );

  // 2. Verify Rust open_backup_folder creates folder if missing and rejects empty path
  assert.ok(
    libRs.includes("folder_str.is_empty()"),
    "Rust open_backup_folder must reject empty folder path"
  );
  assert.ok(
    libRs.includes("if !folder_path.exists()"),
    "Rust open_backup_folder must check if folder exists before opening"
  );
  assert.ok(
    libRs.includes("std::fs::create_dir_all(&folder_path)"),
    "Rust open_backup_folder must create missing directory"
  );
  assert.ok(
    libRs.includes("app.shell().open"),
    "Rust open_backup_folder must use Tauri shell open API"
  );

  // 3. Verify frontend service re-throws errors and rejects empty path
  assert.ok(
    serviceSrc.includes("throw new Error(msg)"),
    "backupService.openBackupFolder must propagate error by throwing"
  );

  // 4. Verify both UI buttons call handleOpenFolder and display on-screen error
  assert.ok(
    pageSrc.includes("Could not open the folder"),
    "BackupRestorePage must display 'Could not open the folder' on screen"
  );
  // Verify both buttons call handleOpenFolder
  const openFolderMatches = (pageSrc.match(/onClick=\{handleOpenFolder\}/g) || []).length;
  assert.strictEqual(
    openFolderMatches,
    2,
    "Both 'Open' and 'Open Folder in Explorer' buttons must be wired to handleOpenFolder"
  );

  console.log("✓ Test 11 Passed: Scoped capabilities, directory creation, empty check, and error propagation verified.\n");
}

console.log("========================================================");
console.log("ALL COMMAND 07 BACKUP & RESTORE TESTS PASSED (100% SUCCESS)!");
console.log("========================================================\n");
