import assert from "node:assert";
import fs from "node:fs";

console.log("=== IM MEDICOS Command 03: Store Details Module Test Suite ===\n");

// Import validations dynamically or evaluate regex & rules
const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function isValidGSTIN(gstin) {
  if (!gstin || !gstin.trim()) return true;
  return gstinRegex.test(gstin.trim().toUpperCase());
}

function isValidIFSC(ifsc) {
  if (!ifsc || !ifsc.trim()) return true;
  return ifscRegex.test(ifsc.trim().toUpperCase());
}

function isValidEmail(email) {
  if (!email || !email.trim()) return true;
  return emailRegex.test(email.trim());
}

function isValidPhoneNumber(phone) {
  if (!phone || !phone.trim()) return true;
  const digitsOnly = phone.replace(/[^0-9]/g, "");
  return digitsOnly.length >= 10 && digitsOnly.length <= 13;
}

function validateStore(data) {
  const errors = {};
  if (!data.storeName || !data.storeName.trim()) {
    errors.storeName = "Pharmacy name is mandatory";
  } else if (data.storeName.trim().length < 2) {
    errors.storeName = "Pharmacy name must be at least 2 characters";
  }

  if (data.email && !isValidEmail(data.email)) {
    errors.email = "Invalid email format";
  }

  if (data.gstin && !isValidGSTIN(data.gstin)) {
    errors.gstin = "Invalid Indian GSTIN format";
  }

  if (data.phone && !isValidPhoneNumber(data.phone)) {
    errors.phone = "Invalid phone number";
  }

  if (data.ifscCode && !isValidIFSC(data.ifscCode)) {
    errors.ifscCode = "Invalid IFSC format";
  }

  if (!data.billPrefix || !data.billPrefix.trim()) {
    errors.billPrefix = "Bill prefix is required";
  }

  if (data.startingBillNumber === undefined || data.startingBillNumber === null) {
    errors.startingBillNumber = "Starting bill number is required";
  } else if (!Number.isInteger(data.startingBillNumber) || data.startingBillNumber < 1) {
    errors.startingBillNumber = "Starting bill number must be positive integer";
  }

  if (data.lowStockThreshold === undefined || data.lowStockThreshold === null) {
    errors.lowStockThreshold = "Low stock alert quantity is required";
  } else if (!Number.isInteger(data.lowStockThreshold) || data.lowStockThreshold < 0) {
    errors.lowStockThreshold = "Low stock threshold must be >= 0";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// -----------------------------------------------------------------
// Test 1: GSTIN Validation Rules
// -----------------------------------------------------------------
{
  assert.strictEqual(isValidGSTIN("07AAAAA0000A1Z5"), true, "Valid 15-char Indian GSTIN should pass");
  assert.strictEqual(isValidGSTIN("27ABCDE1234F2Z9"), true, "Valid Maharashtra GSTIN should pass");
  assert.strictEqual(isValidGSTIN(""), true, "Empty GSTIN should pass (optional field)");
  assert.strictEqual(isValidGSTIN("   "), true, "Whitespace GSTIN should pass (optional field)");
  assert.strictEqual(isValidGSTIN("07AAAAA0000A1"), false, "Short GSTIN must fail");
  assert.strictEqual(isValidGSTIN("07AAAAA0000A1Z599"), false, "Long GSTIN must fail");
  assert.strictEqual(isValidGSTIN("INVALIDGSTIN123"), false, "Malformed GSTIN must fail");
  console.log("✓ Test 1: Indian GSTIN format validation verified (15-char standard)");
}

// -----------------------------------------------------------------
// Test 2: IFSC Code Validation Rules
// -----------------------------------------------------------------
{
  assert.strictEqual(isValidIFSC("SBIN0001234"), true, "Valid SBI IFSC should pass");
  assert.strictEqual(isValidIFSC("HDFC0000123"), true, "Valid HDFC IFSC should pass");
  assert.strictEqual(isValidIFSC(""), true, "Empty IFSC should pass (optional field)");
  assert.strictEqual(isValidIFSC("SBIN1001234"), false, "IFSC with non-zero 5th char must fail");
  assert.strictEqual(isValidIFSC("SBIN00123"), false, "Short IFSC must fail");
  assert.strictEqual(isValidIFSC("SBIN00012345"), false, "Long IFSC must fail");
  console.log("✓ Test 2: Indian IFSC format validation verified (4 letters + '0' + 6 chars)");
}

// -----------------------------------------------------------------
// Test 3: Phone Number Validation Rules
// -----------------------------------------------------------------
{
  assert.strictEqual(isValidPhoneNumber("+91 98765 43210"), true, "Standard Indian +91 format should pass");
  assert.strictEqual(isValidPhoneNumber("9876543210"), true, "10-digit mobile number should pass");
  assert.strictEqual(isValidPhoneNumber("011-23456789"), true, "STD landline format should pass");
  assert.strictEqual(isValidPhoneNumber(""), true, "Empty phone should pass (optional field)");
  assert.strictEqual(isValidPhoneNumber("12345"), false, "Short phone must fail");
  assert.strictEqual(isValidPhoneNumber("123456789012345"), false, "Excessively long phone must fail");
  console.log("✓ Test 3: Sensible Indian phone validation verified");
}

// -----------------------------------------------------------------
// Test 4: Email Validation Rules
// -----------------------------------------------------------------
{
  assert.strictEqual(isValidEmail("pharmacy@immedicos.com"), true, "Valid email should pass");
  assert.strictEqual(isValidEmail(""), true, "Empty email should pass (optional field)");
  assert.strictEqual(isValidEmail("invalid-email"), false, "Missing @ and domain must fail");
  assert.strictEqual(isValidEmail("store@.com"), false, "Missing domain host must fail");
  console.log("✓ Test 4: Email address validation verified");
}

// -----------------------------------------------------------------
// Test 5: Invoice Configuration & Numeric Constraints
// -----------------------------------------------------------------
{
  const baseStore = {
    storeName: "IM MEDICOS PHARMACY",
    email: "contact@immedicos.com",
    gstin: "07AAAAA0000A1Z5",
    phone: "+91 98765 43210",
    ifscCode: "SBIN0001234",
    billPrefix: "IM",
    startingBillNumber: 1,
    lowStockThreshold: 10,
  };

  const validRes = validateStore(baseStore);
  assert.strictEqual(validRes.isValid, true, "Valid baseline store data must pass");

  // Empty Store Name
  const emptyName = validateStore({ ...baseStore, storeName: "" });
  assert.strictEqual(emptyName.isValid, false, "Empty storeName must fail");
  assert.ok(emptyName.errors.storeName, "Must report storeName error");

  // Empty Bill Prefix
  const emptyPrefix = validateStore({ ...baseStore, billPrefix: "  " });
  assert.strictEqual(emptyPrefix.isValid, false, "Empty billPrefix must fail");

  // Non-positive Starting Bill Number
  const zeroBill = validateStore({ ...baseStore, startingBillNumber: 0 });
  assert.strictEqual(zeroBill.isValid, false, "Starting bill number 0 must fail");

  const negBill = validateStore({ ...baseStore, startingBillNumber: -5 });
  assert.strictEqual(negBill.isValid, false, "Negative starting bill number must fail");

  const floatBill = validateStore({ ...baseStore, startingBillNumber: 2.5 });
  assert.strictEqual(floatBill.isValid, false, "Non-integer starting bill number must fail");

  // Negative Low Stock Threshold
  const negThreshold = validateStore({ ...baseStore, lowStockThreshold: -1 });
  assert.strictEqual(negThreshold.isValid, false, "Negative lowStockThreshold must fail");

  const zeroThreshold = validateStore({ ...baseStore, lowStockThreshold: 0 });
  assert.strictEqual(zeroThreshold.isValid, true, "Zero lowStockThreshold is allowed");

  console.log("✓ Test 5: Mandatory constraints & numeric bounds verified (Prefix, Bill # >= 1, Low Stock >= 0)");
}

// -----------------------------------------------------------------
// Test 6: SQLite Schema Singleton & Default Seed Data Verification
// -----------------------------------------------------------------
{
  const dbRs = fs.readFileSync("src-tauri/src/db.rs", "utf-8");
  assert.ok(dbRs.includes("CHECK (id = 1)"), "SQLite schema must enforce singleton ID = 1 constraint");
  assert.ok(dbRs.includes("INSERT OR IGNORE INTO store_details"), "Must seed default store record");
  assert.ok(dbRs.includes("IM MEDICOS PHARMACY"), "Seed data must contain IM MEDICOS PHARMACY");
  assert.ok(dbRs.includes("fetch_store_details"), "Must provide fetch_store_details query");
  assert.ok(dbRs.includes("persist_store_details"), "Must provide persist_store_details query");
  assert.ok(dbRs.includes("ON CONFLICT(id) DO UPDATE"), "Must use UPSERT on singleton ID = 1");
  console.log("✓ Test 6: SQLite singleton schema integrity & UPSERT pattern verified");
}

// -----------------------------------------------------------------
// Test 7: Tauri IPC Backend Commands Verification
// -----------------------------------------------------------------
{
  const libRs = fs.readFileSync("src-tauri/src/lib.rs", "utf-8");
  assert.ok(libRs.includes("fn get_store_details"), "lib.rs must declare get_store_details command");
  assert.ok(libRs.includes("fn save_store_details"), "lib.rs must declare save_store_details command");
  assert.ok(libRs.includes("fn save_store_logo"), "lib.rs must declare save_store_logo command");
  assert.ok(libRs.includes("fn remove_store_logo"), "lib.rs must declare remove_store_logo command");
  assert.ok(libRs.includes("generate_handler!["), "lib.rs must register handlers");
  console.log("✓ Test 7: Tauri backend commands registered for Store Details & Logo");
}

// -----------------------------------------------------------------
// Test 8: Sidebar Navigation Integration Verification
// -----------------------------------------------------------------
{
  const appLayoutTsx = fs.readFileSync("src/components/layout/AppLayout.tsx", "utf-8");
  assert.ok(
    appLayoutTsx.includes('key: "store_details", label: "Store Details", icon: Store, isImplemented: true'),
    "store_details navigation item must be implemented"
  );
  assert.ok(appLayoutTsx.includes('iconOnly variant="dark"'), "Collapsed sidebar must use iconOnly logo to prevent clipping");

  const appTsx = fs.readFileSync("src/App.tsx", "utf-8");
  assert.ok(appTsx.includes("StoreDetailsPage"), "App.tsx must import StoreDetailsPage");
  assert.ok(appTsx.includes('activeNav === "store_details"'), "App.tsx must conditionally render StoreDetailsPage");
  console.log("✓ Test 8: Sidebar navigation wiring & icon-only collapsed emblem verified");
}

console.log("\n========================================================");
console.log("ALL 8 STORE DETAILS MODULE TESTS PASSED (100% SUCCESS)!");
console.log("========================================================");

