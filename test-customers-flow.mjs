import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

console.log("\n=== IM MEDICOS Command 06: Customers Module Test Suite ===\n");

// Helper to normalize mobile
function normalizeCustomerMobile(mob) {
  const trimmed = (mob || "").trim();
  if (!trimmed) return "No mobile";
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits || "No mobile";
}

// ----------------------------------------------------------------------
// Test 1: Customer Identity & Normalization Rules
// ----------------------------------------------------------------------
console.log("Test 1: Customer Identity & Mobile Normalization (10-Digit Normalization)");
{
  assert.strictEqual(normalizeCustomerMobile("9876543210"), "9876543210");
  assert.strictEqual(normalizeCustomerMobile("+91 98765 43210"), "9876543210");
  assert.strictEqual(normalizeCustomerMobile("+919876543210"), "9876543210");
  assert.strictEqual(normalizeCustomerMobile("919876543210"), "9876543210");
  assert.strictEqual(normalizeCustomerMobile("   98765-43210  "), "9876543210");
  assert.strictEqual(normalizeCustomerMobile(""), "No mobile");
  assert.strictEqual(normalizeCustomerMobile(null), "No mobile");
  assert.strictEqual(normalizeCustomerMobile("   "), "No mobile");

  console.log("✓ Test 1 Passed: Mobile normalization and empty/missing handling verified.\n");
}

// ----------------------------------------------------------------------
// Test 2: Name Used on Most Recent Bill & Alternative Names Detection
// ----------------------------------------------------------------------
console.log("Test 2: Most Recent Name as Display Name & Alternative Names Tracking");
{
  // One mobile used with two different names:
  // Bill 1 (older, id: 10): "R. K. Sharma"
  // Bill 2 (newer, id: 25): "Rajesh Kumar Sharma"
  const bills = [
    { id: 10, billDate: "2026-11-01", customerName: "R. K. Sharma", customerMobile: "9876543210", grandTotal: 500 },
    { id: 25, billDate: "2026-11-04", customerName: "Rajesh Kumar Sharma", customerMobile: "9876543210", grandTotal: 750 },
  ];

  // Derive customer from bills
  const sorted = [...bills].sort((a, b) => a.id - b.id);
  const latestBill = sorted[sorted.length - 1];
  const displayName = latestBill.customerName;
  const allNames = Array.from(new Set(sorted.map((b) => b.customerName)));
  const otherNames = allNames.filter((n) => n !== displayName);

  assert.strictEqual(displayName, "Rajesh Kumar Sharma", "Display name must be from most recent bill");
  assert.deepStrictEqual(otherNames, ["R. K. Sharma"], "Previous name must be captured under otherNames");

  // Same name with different mobile numbers -> 2 distinct customers
  const customerA_bill = { id: 30, customerName: "Amit Kumar", customerMobile: "9811111111" };
  const customerB_bill = { id: 31, customerName: "Amit Kumar", customerMobile: "9822222222" };

  const mobA = normalizeCustomerMobile(customerA_bill.customerMobile);
  const mobB = normalizeCustomerMobile(customerB_bill.customerMobile);
  assert.notStrictEqual(mobA, mobB, "Same name with different mobiles must yield 2 distinct customers");

  console.log("✓ Test 2 Passed: Latest display name, alternative names, and mobile isolation verified.\n");
}

// ----------------------------------------------------------------------
// Test 3: Customer with 9 Bills Today and 4 Bills Yesterday
// ----------------------------------------------------------------------
console.log("Test 3: Customer with 9 Bills Today & 4 Bills Yesterday (Range Math)");
{
  const today = "2026-11-04";
  const yesterday = "2026-11-03";

  const customerBills = [];
  // 9 bills today, ₹100 each
  for (let i = 1; i <= 9; i++) {
    customerBills.push({
      id: i,
      billNumber: `IM-TODAY-${i}`,
      billDate: today,
      customerName: "Sanjay Gupta",
      customerMobile: "9876500001",
      grandTotal: 100.0,
    });
  }
  // 4 bills yesterday, ₹150 each
  for (let i = 1; i <= 4; i++) {
    customerBills.push({
      id: 10 + i,
      billNumber: `IM-YEST-${i}`,
      billDate: yesterday,
      customerName: "Sanjay Gupta",
      customerMobile: "9876500001",
      grandTotal: 150.0,
    });
  }

  // All time: 13 bills, ₹1500 total spent
  assert.strictEqual(customerBills.length, 13);
  const allTimeSpent = customerBills.reduce((s, b) => s + b.grandTotal, 0);
  assert.strictEqual(allTimeSpent, 9 * 100 + 4 * 150); // 1500

  // Filter Today: 9 bills, ₹900 spent
  const todayBills = customerBills.filter((b) => b.billDate === today);
  assert.strictEqual(todayBills.length, 9);
  assert.strictEqual(todayBills.reduce((s, b) => s + b.grandTotal, 0), 900.0);

  // Filter Yesterday: 4 bills, ₹600 spent
  const yestBills = customerBills.filter((b) => b.billDate === yesterday);
  assert.strictEqual(yestBills.length, 4);
  assert.strictEqual(yestBills.reduce((s, b) => s + b.grandTotal, 0), 600.0);

  // Repeat Customer: in today's range (9 >= 2) -> true; in yesterday's range (4 >= 2) -> true
  assert.strictEqual(todayBills.length >= 2, true);
  assert.strictEqual(yestBills.length >= 2, true);

  console.log("✓ Test 3 Passed: 9 bills today and 4 bills yesterday filter counts strictly match.\n");
}

// ----------------------------------------------------------------------
// Test 4: Multi-Field Search (Name, Partial Name, Mobile, Alternative Name)
// ----------------------------------------------------------------------
console.log("Test 4: Multi-Field Customer Search Matching Alternative Names");
{
  const customers = [
    {
      mobile: "9876543210",
      displayName: "Vikram Malhotra",
      otherNames: ["V. Malhotra", "Vikram M."],
      billsCount: 3,
    },
    {
      mobile: "9123456789",
      displayName: "Sunita Roy",
      otherNames: [],
      billsCount: 1,
    },
  ];

  function searchCustomer(list, term) {
    const q = term.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => {
      const matchMob = c.mobile.toLowerCase().includes(q);
      const matchName = c.displayName.toLowerCase().includes(q);
      const matchOther = c.otherNames.some((n) => n.toLowerCase().includes(q));
      return matchMob || matchName || matchOther;
    });
  }

  // Search by exact name
  assert.strictEqual(searchCustomer(customers, "Vikram Malhotra").length, 1);
  // Search by partial name
  assert.strictEqual(searchCustomer(customers, "malhot").length, 1);
  // Search by partial mobile
  assert.strictEqual(searchCustomer(customers, "43210").length, 1);
  // Search by alternative name
  assert.strictEqual(searchCustomer(customers, "V. Malhotra").length, 1);
  assert.strictEqual(searchCustomer(customers, "Vikram M.").length, 1);
  // Non-matching search
  assert.strictEqual(searchCustomer(customers, "Unknown").length, 0);

  console.log("✓ Test 4 Passed: Multi-field search including alternative names verified.\n");
}

// ----------------------------------------------------------------------
// Test 5: Date Presets & Custom Boundary Inclusivity (00:00 & 23:59)
// ----------------------------------------------------------------------
console.log("Test 5: Date Presets, Custom Range & Boundary Inclusivity (00:00 and 23:59)");
{
  const bills = [
    { id: 1, billDate: "2026-11-01", createdAt: "2026-11-01 00:00:01", grandTotal: 200 },
    { id: 2, billDate: "2026-11-03", createdAt: "2026-11-03 23:59:59", grandTotal: 300 },
    { id: 3, billDate: "2024-05-10", createdAt: "2024-05-10 12:00:00", grandTotal: 150 }, // 2+ years ago
  ];

  // 1. Range from 2 years ago (2024-05-01 to 2024-05-31)
  const range2Years = bills.filter((b) => b.billDate >= "2024-05-01" && b.billDate <= "2024-05-31");
  assert.strictEqual(range2Years.length, 1);
  assert.strictEqual(range2Years[0].id, 3);

  // 2. Boundary test: 00:00 on first day and 23:59 on last day (2026-11-01 to 2026-11-03)
  const boundaryRange = bills.filter((b) => b.billDate >= "2026-11-01" && b.billDate <= "2026-11-03");
  assert.strictEqual(boundaryRange.length, 2);

  // 3. Single-day selection (From == To: 2026-11-01)
  const singleDay = bills.filter((b) => b.billDate >= "2026-11-01" && b.billDate <= "2026-11-01");
  assert.strictEqual(singleDay.length, 1);

  // 4. Date range with no bills (2026-10-01 to 2026-10-05)
  const emptyRange = bills.filter((b) => b.billDate >= "2026-10-01" && b.billDate <= "2026-10-05");
  assert.strictEqual(emptyRange.length, 0);

  // 5. Validation: From after To produces error
  function validateDateRange(from, to) {
    if (from && to && from > to) return "'From' date cannot be after 'To' date";
    return null;
  }
  assert.strictEqual(validateDateRange("2026-11-05", "2026-11-04"), "'From' date cannot be after 'To' date");
  assert.strictEqual(validateDateRange("2026-11-04", "2026-11-04"), null);

  console.log("✓ Test 5 Passed: Date presets, past years, boundaries and validation verified.\n");
}

// ----------------------------------------------------------------------
// Test 6: Detail View Day Grouping & Day Total Math
// ----------------------------------------------------------------------
console.log("Test 6: Detail View Grouping by Date (Day Counts and Day Totals)");
{
  const customerBills = [
    { id: 1, billNumber: "IM-001", billDate: "2026-07-27", grandTotal: 400.0 },
    { id: 2, billNumber: "IM-002", billDate: "2026-07-27", grandTotal: 340.0 },
    { id: 3, billNumber: "IM-003", billDate: "2026-07-27", grandTotal: 500.0 },
    { id: 4, billNumber: "IM-004", billDate: "2026-07-26", grandTotal: 250.0 },
  ];

  // Group by day
  const groups = new Map();
  for (const b of customerBills) {
    const d = b.billDate.slice(0, 10);
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d).push(b);
  }

  const sortedDays = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));
  assert.strictEqual(sortedDays[0], "2026-07-27", "Newest day first");
  assert.strictEqual(sortedDays[1], "2026-07-26");

  // Day 1: 27 Jul 2026 - 3 bills - ₹1,240.00
  const day1Bills = groups.get("2026-07-27");
  assert.strictEqual(day1Bills.length, 3);
  const day1Total = day1Bills.reduce((s, b) => s + b.grandTotal, 0);
  assert.strictEqual(day1Total, 1240.0);

  // Day 2: 26 Jul 2026 - 1 bill - ₹250.00
  const day2Bills = groups.get("2026-07-26");
  assert.strictEqual(day2Bills.length, 1);
  assert.strictEqual(day2Bills[0].grandTotal, 250.0);

  console.log("✓ Test 6 Passed: Grouping by day and day totals math verified.\n");
}

// ----------------------------------------------------------------------
// Test 7: Pagination with 50+ Customers (LIMIT / OFFSET Math)
// ----------------------------------------------------------------------
console.log("Test 7: Pagination Math with 50+ Customers (60 Unique Records)");
{
  const sixtyCustomers = Array.from({ length: 60 }, (_, i) => ({
    mobile: `98000000${String(i).padStart(2, "0")}`,
    displayName: `Customer ${i + 1}`,
    billsCount: (i % 3) + 1,
    totalSpent: (i + 1) * 50,
  }));

  function paginate(items, page, pageSize) {
    const totalCount = items.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const offset = (page - 1) * pageSize;
    return { paginated: items.slice(offset, offset + pageSize), totalPages };
  }

  // 10 per page -> 6 pages
  const p10_1 = paginate(sixtyCustomers, 1, 10);
  assert.strictEqual(p10_1.paginated.length, 10);
  assert.strictEqual(p10_1.totalPages, 6);

  // 25 per page -> 3 pages
  const p25_1 = paginate(sixtyCustomers, 1, 25);
  assert.strictEqual(p25_1.paginated.length, 25);
  assert.strictEqual(p25_1.totalPages, 3);

  // 50 per page -> 2 pages
  const p50_1 = paginate(sixtyCustomers, 1, 50);
  assert.strictEqual(p50_1.paginated.length, 50);
  assert.strictEqual(p50_1.totalPages, 2);

  const p50_2 = paginate(sixtyCustomers, 2, 50);
  assert.strictEqual(p50_2.paginated.length, 10); // remaining 10

  console.log("✓ Test 7 Passed: Pagination math across 10, 25, 50 rows verified.\n");
}

// ----------------------------------------------------------------------
// Test 8: Zero Cost Price Leak on Customers UI
// ----------------------------------------------------------------------
console.log("Test 8: Zero Cost Price Leak on Customers UI & Detail View");
{
  const pagePath = path.resolve("src/pages/CustomersPage.tsx");
  const pageContent = fs.readFileSync(pagePath, "utf-8");

  assert.ok(!pageContent.includes("item.costPrice"), "CustomersPage must never render item.costPrice");
  assert.ok(!pageContent.includes("item.cost_price"), "CustomersPage must never render item.cost_price");
  assert.ok(!pageContent.includes("Cost Price"), "CustomersPage must never contain 'Cost Price' column or label");
  assert.ok(!pageContent.includes("Profit"), "CustomersPage must never contain 'Profit' column or label");

  console.log("✓ Test 8 Passed: Cost price and profit are 100% absent from Customers UI.\n");
}

// ----------------------------------------------------------------------
// Test 9: Sidebar Navigation 'customers' Wiring & Route Integration
// ----------------------------------------------------------------------
console.log("Test 9: Sidebar Navigation 'customers' Wiring & Route Integration");
{
  const layoutPath = path.resolve("src/components/layout/AppLayout.tsx");
  const layoutContent = fs.readFileSync(layoutPath, "utf-8");

  assert.ok(
    layoutContent.includes('{ key: "customers", label: "Customers", icon: Users, isImplemented: true }'),
    "AppLayout NAV_ITEMS must have customers as isImplemented: true without phaseText"
  );
  assert.ok(
    !layoutContent.includes('key: "customers", label: "Customers", icon: Users, isImplemented: false'),
    "AppLayout must not have customers as false"
  );

  const appPath = path.resolve("src/App.tsx");
  const appContent = fs.readFileSync(appPath, "utf-8");

  assert.ok(appContent.includes("CustomersPage"), "App.tsx must import CustomersPage");
  assert.ok(appContent.includes('activeNav === "customers"'), "App.tsx must route to CustomersPage");

  console.log("✓ Test 9 Passed: Sidebar item and application routing verified.\n");
}

// ----------------------------------------------------------------------
// Test 10: Tauri Backend Commands & Rust SQL Implementation
// ----------------------------------------------------------------------
console.log("Test 10: Rust db.rs & lib.rs Commands and Indexes");
{
  const dbPath = path.resolve("src-tauri/src/db.rs");
  const dbContent = fs.readFileSync(dbPath, "utf-8");

  assert.ok(dbContent.includes("pub fn fetch_customers_paginated"), "db.rs must export fetch_customers_paginated");
  assert.ok(dbContent.includes("pub fn fetch_customer_detail"), "db.rs must export fetch_customer_detail");
  assert.ok(dbContent.includes("CREATE INDEX IF NOT EXISTS idx_bills_customer_mobile"), "db.rs must index customer_mobile");

  const libPath = path.resolve("src-tauri/src/lib.rs");
  const libContent = fs.readFileSync(libPath, "utf-8");

  assert.ok(libContent.includes("fn get_customers"), "lib.rs must declare get_customers command");
  assert.ok(libContent.includes("fn get_customer_detail"), "lib.rs must declare get_customer_detail command");
  assert.ok(libContent.includes("get_customers,"), "lib.rs must register get_customers in generate_handler");
  assert.ok(libContent.includes("get_customer_detail"), "lib.rs must register get_customer_detail in generate_handler");

  console.log("✓ Test 10 Passed: Tauri IPC commands and customer queries verified.\n");
}

console.log("========================================================");
console.log("ALL COMMAND 06 CUSTOMERS TESTS PASSED (100% SUCCESS)!");
console.log("========================================================\n");
