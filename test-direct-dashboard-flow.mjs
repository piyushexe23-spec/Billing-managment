import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

console.log("\n========================================================");
console.log("  IM MEDICOS Direct Dashboard Startup & Auth Purge Tests");
console.log("========================================================\n");

// ----------------------------------------------------------------------
// Test 1: Direct Startup Without Login Gate in App.tsx
// ----------------------------------------------------------------------
console.log("Test 1: App.tsx Direct Dashboard Startup (No Login Gate or Splash)");
{
  const appPath = path.resolve("src/App.tsx");
  const appContent = fs.readFileSync(appPath, "utf-8");

  assert.ok(!appContent.includes("LoginPage"), "App.tsx must not import or render LoginPage");
  assert.ok(!appContent.includes("authService"), "App.tsx must not import or use authService");
  assert.ok(!appContent.includes("isAuthenticated"), "App.tsx must not track isAuthenticated state");
  assert.ok(!appContent.includes("isInitializing"), "App.tsx must not block startup with isInitializing splash gate");
  assert.ok(!appContent.includes("Verifying workstation security session"), "App.tsx must not show session verification screen");
  assert.ok(appContent.includes('const [activeNav, setActiveNav] = useState<NavItemKey>("dashboard")'), "App.tsx must initialize directly to dashboard");
  assert.ok(appContent.includes("<DashboardPage />"), "App.tsx must render DashboardPage by default");

  console.log("✓ Test 1 Passed: App opens directly to Dashboard with zero splash gate.\n");
}

// ----------------------------------------------------------------------
// Test 2: AppLayout Top Header & Sidebar Bottom Card Clean-up
// ----------------------------------------------------------------------
console.log("Test 2: AppLayout Header User Chip Removed & Sidebar Store Name Card");
{
  const appLayoutPath = path.resolve("src/components/layout/AppLayout.tsx");
  const appLayoutContent = fs.readFileSync(appLayoutPath, "utf-8");

  // User avatar chip in top header
  assert.ok(!appLayoutContent.includes("currentUser"), "AppLayout must not reference currentUser");
  assert.ok(!appLayoutContent.includes("Administrator"), "AppLayout header must not display Administrator subtitle");
  assert.ok(!appLayoutContent.includes("LogOut"), "AppLayout must not import or render LogOut button");
  assert.ok(!appLayoutContent.includes("Log Out"), "AppLayout must not contain Log Out text");

  // Store name bottom card
  assert.ok(appLayoutContent.includes("storeName"), "AppLayout must maintain storeName for bottom badge");
  assert.ok(appLayoutContent.includes('storeName || "IM MEDICOS"'), "AppLayout bottom card must fallback to 'IM MEDICOS'");
  assert.ok(appLayoutContent.includes("Station #01 • Local"), "Station #01 • Local layout structure preserved");

  // Footer session text
  assert.ok(!appLayoutContent.includes("Session: Active"), "Footer must not contain 'Session: Active'");
  assert.ok(appLayoutContent.includes("Windows Desktop Edition"), "Footer retains Windows Desktop Edition");

  console.log("✓ Test 2 Passed: User chip & logout removed; store name bottom card rendered.\n");
}

// ----------------------------------------------------------------------
// Test 3: Top Header Title Dynamic Mapping for All Screens
// ----------------------------------------------------------------------
console.log("Test 3: Top Header Dynamic Page Meta for All Navigation Items");
{
  const appLayoutPath = path.resolve("src/components/layout/AppLayout.tsx");
  const appLayoutContent = fs.readFileSync(appLayoutPath, "utf-8");

  assert.ok(appLayoutContent.includes("PAGE_META"), "AppLayout must define PAGE_META mapping");
  assert.ok(appLayoutContent.includes("Dashboard Overview"), "PAGE_META must define Dashboard Overview");
  assert.ok(appLayoutContent.includes("New Bill"), "PAGE_META must define New Bill");
  assert.ok(appLayoutContent.includes("Bill History"), "PAGE_META must define Bill History");
  assert.ok(appLayoutContent.includes("Medicine Inventory"), "PAGE_META must define Medicine Inventory");
  assert.ok(appLayoutContent.includes("Customers"), "PAGE_META must define Customers");
  assert.ok(appLayoutContent.includes("Reports"), "PAGE_META must define Reports");
  assert.ok(appLayoutContent.includes("Store Details & Settings"), "PAGE_META must define Store Details & Settings");
  assert.ok(appLayoutContent.includes("Backup & Restore"), "PAGE_META must define Backup & Restore");

  console.log("✓ Test 3 Passed: Header title dynamically reflects active screen.\n");
}

// ----------------------------------------------------------------------
// Test 4: Backup & Restore Returns to Dashboard
// ----------------------------------------------------------------------
console.log("Test 4: Backup & Restore Screen Post-Restore Flow");
{
  const backupPagePath = path.resolve("src/pages/BackupRestorePage.tsx");
  const backupContent = fs.readFileSync(backupPagePath, "utf-8");

  assert.ok(!backupContent.includes("Continue to Login Screen"), "BackupRestorePage must not mention 'Continue to Login Screen'");
  assert.ok(backupContent.includes("Return to Dashboard"), "BackupRestorePage must offer 'Return to Dashboard'");
  assert.ok(!backupContent.includes("im_medicos_auth_token"), "BackupRestorePage must not clear auth tokens or force login");

  const appPath = path.resolve("src/App.tsx");
  const appContent = fs.readFileSync(appPath, "utf-8");
  assert.ok(
    appContent.includes('onRestoreSuccess={() => setActiveNav("dashboard")}'),
    "App.tsx must navigate to Dashboard on restore success"
  );

  console.log("✓ Test 4 Passed: Post-restore returns directly to Dashboard.\n");
}

// ----------------------------------------------------------------------
// Test 5: Users Table & SQLite Backend Integrity
// ----------------------------------------------------------------------
console.log("Test 5: SQLite Users Table Preserved (Zero Data Loss/Drops)");
{
  const dbRsPath = path.resolve("src-tauri/src/db.rs");
  const dbContent = fs.readFileSync(dbRsPath, "utf-8");

  assert.ok(dbContent.includes("CREATE TABLE IF NOT EXISTS users"), "db.rs must keep the users table schema");
  assert.ok(dbContent.includes("seed_default_admin"), "db.rs must keep seed_default_admin");
  assert.ok(dbContent.includes("created_by INTEGER REFERENCES users(id)"), "db.rs must keep created_by foreign keys intact");

  console.log("✓ Test 5 Passed: Users table and relational foreign keys strictly preserved.\n");
}

// ----------------------------------------------------------------------
// Test 6: Purge of Dead Auth Files
// ----------------------------------------------------------------------
console.log("Test 6: Dead Auth Components and Services Cleaned Up");
{
  const loginPagePath = path.resolve("src/pages/LoginPage.tsx");
  const loginFormPath = path.resolve("src/components/auth/LoginForm.tsx");
  const authServicePath = path.resolve("src/services/authService.ts");
  const authTypesPath = path.resolve("src/types/auth.ts");

  assert.strictEqual(fs.existsSync(loginPagePath), false, "LoginPage.tsx must be deleted");
  assert.strictEqual(fs.existsSync(loginFormPath), false, "LoginForm.tsx must be deleted");
  assert.strictEqual(fs.existsSync(authServicePath), false, "authService.ts must be deleted");
  assert.strictEqual(fs.existsSync(authTypesPath), false, "types/auth.ts must be deleted");

  console.log("✓ Test 6 Passed: All dead auth files removed.\n");
}

console.log("========================================================");
console.log("  ALL DIRECT DASHBOARD TESTS PASSED (6/6 Suites)");
console.log("========================================================\n");
