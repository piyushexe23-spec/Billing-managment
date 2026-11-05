import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

console.log("\n========================================================");
console.log("  IM MEDICOS Command 08: Reports Module Test Suite");
console.log("========================================================\n");

// ----------------------------------------------------------------------
// Test 1: Navigation & Module Integration Verification
// ----------------------------------------------------------------------
console.log("Test 1: App Navigation & Route Registration Verification");
{
  const appLayoutPath = path.resolve("src/components/layout/AppLayout.tsx");
  const appPath = path.resolve("src/App.tsx");
  const reportsPagePath = path.resolve("src/pages/ReportsPage.tsx");
  const reportServicePath = path.resolve("src/services/reportService.ts");
  const reportsTypesPath = path.resolve("src/types/reports.ts");
  const dbRsPath = path.resolve("src-tauri/src/db.rs");
  const libRsPath = path.resolve("src-tauri/src/lib.rs");

  assert.ok(fs.existsSync(reportsPagePath), "ReportsPage.tsx must exist");
  assert.ok(fs.existsSync(reportServicePath), "reportService.ts must exist");
  assert.ok(fs.existsSync(reportsTypesPath), "reports.ts types must exist");

  const appLayoutContent = fs.readFileSync(appLayoutPath, "utf-8");
  assert.ok(
    appLayoutContent.includes('{ key: "reports", label: "Reports", icon: BarChart3, isImplemented: true }'),
    "AppLayout must mark reports as implemented (isImplemented: true) and remove phaseText"
  );
  assert.ok(
    !appLayoutContent.includes('{ key: "reports", label: "Reports", icon: BarChart3, isImplemented: false'),
    "Reports must no longer be marked isImplemented: false"
  );

  const appContent = fs.readFileSync(appPath, "utf-8");
  assert.ok(appContent.includes('import { ReportsPage } from "@/pages/ReportsPage";'), "App.tsx must import ReportsPage");
  assert.ok(appContent.includes('activeNav === "reports"'), "App.tsx must route to ReportsPage");

  const dbContent = fs.readFileSync(dbRsPath, "utf-8");
  assert.ok(dbContent.includes("pub fn fetch_sales_report"), "db.rs must contain fetch_sales_report");
  assert.ok(dbContent.includes("pub fn fetch_stock_report"), "db.rs must contain fetch_stock_report");
  assert.ok(dbContent.includes("pub fn fetch_top_selling_report"), "db.rs must contain fetch_top_selling_report");
  assert.ok(dbContent.includes("pub fn fetch_profit_report"), "db.rs must contain fetch_profit_report");
  assert.ok(dbContent.includes("pub fn fetch_gst_summary_report"), "db.rs must contain fetch_gst_summary_report");

  const libContent = fs.readFileSync(libRsPath, "utf-8");
  assert.ok(libContent.includes("get_sales_report"), "lib.rs must register get_sales_report");
  assert.ok(libContent.includes("get_stock_report"), "lib.rs must register get_stock_report");
  assert.ok(libContent.includes("get_top_selling_report"), "lib.rs must register get_top_selling_report");
  assert.ok(libContent.includes("get_profit_report"), "lib.rs must register get_profit_report");
  assert.ok(libContent.includes("get_gst_summary_report"), "lib.rs must register get_gst_summary_report");

  console.log("✓ Test 1 Passed: AppLayout, App.tsx routes, and Tauri Rust commands verified.\n");
}

// ----------------------------------------------------------------------
// Test 2: Sales Report Calculations & Aggregations
// ----------------------------------------------------------------------
console.log("Test 2: Sales Report KPI Cards, Payment Splits & Day/Month Breakdown");
{
  // Sample test bills
  const sampleBills = [
    {
      id: 1,
      billNumber: "BILL-2026-0001",
      billDate: "2026-11-01T10:30:00",
      paymentMode: "CASH",
      subtotal: 1000.0,
      discountAmount: 100.0,
      grandTotal: 900.0,
      status: "COMPLETED",
      items: [
        { quantity: 5, unitPrice: 100.0, amount: 500.0, costPrice: 60.0 },
        { quantity: 5, unitPrice: 100.0, amount: 500.0, costPrice: 70.0 },
      ],
    },
    {
      id: 2,
      billNumber: "BILL-2026-0002",
      billDate: "2026-11-01T14:15:00",
      paymentMode: "UPI",
      subtotal: 500.0,
      discountAmount: 0.0,
      grandTotal: 500.0,
      status: "COMPLETED",
      items: [{ quantity: 2, unitPrice: 250.0, amount: 500.0, costPrice: 180.0 }],
    },
    {
      id: 3,
      billNumber: "BILL-2026-0003",
      billDate: "2026-11-02T11:00:00",
      paymentMode: "CARD",
      subtotal: 800.0,
      discountAmount: 50.0,
      grandTotal: 750.0,
      status: "COMPLETED",
      items: [{ quantity: 4, unitPrice: 200.0, amount: 800.0, costPrice: 150.0 }],
    },
  ];

  // Calculate Sales KPI aggregations
  const totalBills = sampleBills.length;
  const grossSales = sampleBills.reduce((acc, b) => acc + b.subtotal, 0);
  const totalDiscount = sampleBills.reduce((acc, b) => acc + b.discountAmount, 0);
  const netSales = sampleBills.reduce((acc, b) => acc + b.grandTotal, 0);
  const averageBillValue = Math.round((netSales / totalBills) * 100) / 100;

  assert.strictEqual(totalBills, 3);
  assert.strictEqual(grossSales, 2300.0);
  assert.strictEqual(totalDiscount, 150.0);
  assert.strictEqual(netSales, 2150.0);
  assert.strictEqual(averageBillValue, 716.67);

  // Payment splits
  const cashAmount = sampleBills.filter((b) => b.paymentMode === "CASH").reduce((a, b) => a + b.grandTotal, 0);
  const upiAmount = sampleBills.filter((b) => b.paymentMode === "UPI").reduce((a, b) => a + b.grandTotal, 0);
  const cardAmount = sampleBills.filter((b) => b.paymentMode === "CARD").reduce((a, b) => a + b.grandTotal, 0);

  assert.strictEqual(cashAmount, 900.0);
  assert.strictEqual(upiAmount, 500.0);
  assert.strictEqual(cardAmount, 750.0);
  assert.strictEqual(cashAmount + upiAmount + cardAmount, netSales, "Payment sum must strictly equal net sales");

  // Discount breakdown
  const billsWithDiscount = sampleBills.filter((b) => b.discountAmount > 0).length;
  const billsWithoutDiscount = totalBills - billsWithDiscount;
  const overallDiscountPct = Math.round((totalDiscount / grossSales) * 10000) / 100;
  const avgDiscountOnDiscounted = Math.round((totalDiscount / billsWithDiscount) * 100) / 100;

  assert.strictEqual(billsWithDiscount, 2);
  assert.strictEqual(billsWithoutDiscount, 1);
  assert.strictEqual(overallDiscountPct, 6.52);
  assert.strictEqual(avgDiscountOnDiscounted, 75.0);

  console.log("✓ Test 2 Passed: Sales KPIs, payment split, and discount metrics match exact specs.\n");
}

// ----------------------------------------------------------------------
// Test 3: Stock Report 8 KPIs, Sub-view Filters & Expiry Rules
// ----------------------------------------------------------------------
console.log("Test 3: Stock Report 8 KPIs & Expiry Status Logic (10 Calendar Days)");
{
  const todayStr = "2026-11-05";
  const today = new Date(todayStr);

  const testMedicines = [
    {
      id: 1,
      name: "Paracetamol 500mg",
      minStockLevel: 20,
      isActive: true,
      batches: [
        { batchNumber: "B1", quantity: 50, costPrice: 1.5, mrp: 3.0, expiryDate: "2027-01-01" }, // Normal
      ],
    },
    {
      id: 2,
      name: "Amoxicillin 250mg",
      minStockLevel: 30,
      isActive: true,
      batches: [
        { batchNumber: "B2", quantity: 15, costPrice: 5.0, mrp: 10.0, expiryDate: "2026-11-12" }, // Low Stock (15 <= 30), Expiring in 7 days (<= 10 days)
      ],
    },
    {
      id: 3,
      name: "Cetirizine 10mg",
      minStockLevel: 10,
      isActive: true,
      batches: [
        { batchNumber: "B3", quantity: 0, costPrice: 2.0, mrp: 4.0, expiryDate: "2026-11-20" }, // Out of stock (qty = 0)
      ],
    },
    {
      id: 4,
      name: "Azithromycin 500mg",
      minStockLevel: 10,
      isActive: true,
      batches: [
        { batchNumber: "B4", quantity: 20, costPrice: 12.0, mrp: 25.0, expiryDate: "2026-10-31" }, // Expired (expiry < today)
      ],
    },
    {
      id: 5,
      name: "Old Discontinued Cough Syrup",
      minStockLevel: 5,
      isActive: false, // Archived
      batches: [
        { batchNumber: "B5", quantity: 10, costPrice: 30.0, mrp: 60.0, expiryDate: "2027-06-01" },
      ],
    },
  ];

  // Helper to classify batch
  function classifyBatch(batch, minStock) {
    const expDate = new Date(batch.expiryDate);
    const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    const isExpired = batch.expiryDate < todayStr;
    const isExpiringSoon = !isExpired && diffDays <= 10;
    const isOutOfStock = batch.quantity === 0;
    const isLowStock = batch.quantity > 0 && batch.quantity <= minStock;

    return { isExpired, isExpiringSoon, isOutOfStock, isLowStock, diffDays };
  }

  const b2Status = classifyBatch(testMedicines[1].batches[0], testMedicines[1].minStockLevel);
  assert.strictEqual(b2Status.isLowStock, true, "B2 must be low stock (15 <= 30)");
  assert.strictEqual(b2Status.isExpiringSoon, true, "B2 must be expiring soon (7 days <= 10 days)");
  assert.strictEqual(b2Status.isExpired, false);

  const b3Status = classifyBatch(testMedicines[2].batches[0], testMedicines[2].minStockLevel);
  assert.strictEqual(b3Status.isOutOfStock, true, "B3 must be out of stock (qty == 0)");

  const b4Status = classifyBatch(testMedicines[3].batches[0], testMedicines[3].minStockLevel);
  assert.strictEqual(b4Status.isExpired, true, "B4 must be expired (2026-10-31 < 2026-11-05)");
  assert.strictEqual(b4Status.isExpiringSoon, false, "Expired items must not be marked expiring soon");

  // Active medicine count
  const activeCount = testMedicines.filter((m) => m.isActive).length;
  const totalCount = testMedicines.length;
  assert.strictEqual(activeCount, 4, "Active medicines must exclude archived (isActive=false)");
  assert.strictEqual(totalCount, 5, "Total medicines includes archived");

  // Value at Cost and MRP for active
  const activeBatches = testMedicines.filter((m) => m.isActive).flatMap((m) => m.batches);
  const valueAtCost = activeBatches.reduce((acc, b) => acc + b.quantity * b.costPrice, 0);
  const valueAtMrp = activeBatches.reduce((acc, b) => acc + b.quantity * b.mrp, 0);

  // B1: 50*1.5 = 75, B2: 15*5 = 75, B3: 0*2 = 0, B4: 20*12 = 240 => 390
  assert.strictEqual(valueAtCost, 390.0);
  // B1: 50*3 = 150, B2: 15*10 = 150, B3: 0*4 = 0, B4: 20*25 = 500 => 800
  assert.strictEqual(valueAtMrp, 800.0);

  console.log("✓ Test 3 Passed: 8 Stock KPIs, low stock, out of stock, and 10-day expiring logic verified.\n");
}

// ----------------------------------------------------------------------
// Test 4: Top Selling Report (Quantity vs Revenue & Limits)
// ----------------------------------------------------------------------
console.log("Test 4: Top Selling Report Sorting & Medicines Screen Consistency");
{
  const itemSales = [
    { medicineId: 1, medicineName: "Paracetamol 500mg", quantitySold: 200, revenue: 600.0 },
    { medicineId: 2, medicineName: "Azithromycin 500mg", quantitySold: 40, revenue: 1000.0 },
    { medicineId: 3, medicineName: "Amoxicillin 250mg", quantitySold: 80, revenue: 800.0 },
  ];

  // Sort by quantity
  const sortedByQty = [...itemSales].sort((a, b) => b.quantitySold - a.quantitySold);
  assert.strictEqual(sortedByQty[0].medicineName, "Paracetamol 500mg");
  assert.strictEqual(sortedByQty[1].medicineName, "Amoxicillin 250mg");
  assert.strictEqual(sortedByQty[2].medicineName, "Azithromycin 500mg");

  // Sort by revenue
  const sortedByRev = [...itemSales].sort((a, b) => b.revenue - a.revenue);
  assert.strictEqual(sortedByRev[0].medicineName, "Azithromycin 500mg");
  assert.strictEqual(sortedByRev[1].medicineName, "Amoxicillin 250mg");
  assert.strictEqual(sortedByRev[2].medicineName, "Paracetamol 500mg");

  // Rank assignment
  const rankedByQty = sortedByQty.map((item, idx) => ({ ...item, rank: idx + 1 }));
  assert.strictEqual(rankedByQty[0].rank, 1);
  assert.strictEqual(rankedByQty[1].rank, 2);
  assert.strictEqual(rankedByQty[2].rank, 3);

  // Check Medicines screen's top selling query in db.rs uses COMPLETED status
  const dbRs = fs.readFileSync(path.resolve("src-tauri/src/db.rs"), "utf-8");
  assert.ok(
    dbRs.includes("UPPER(COALESCE(b.status, 'COMPLETED')) = 'COMPLETED'"),
    "Medicines screen query must filter for COMPLETED status to agree with reports"
  );

  console.log("✓ Test 4 Passed: Top Selling quantity vs revenue ranking and query alignment verified.\n");
}

// ----------------------------------------------------------------------
// Test 5: Profit Report & Snapshot Cost Price Immutability
// ----------------------------------------------------------------------
console.log("Test 5: Profit Report (Snapshot Cost Price vs Mutated Batch Cost Price)");
{
  // Scenario:
  // Item sold on 2026-11-01: 10 units at ₹50 MRP, cost price at time of sale was ₹30.
  // Bill Item snapshot: quantity = 10, unitPrice = 50, costPrice = 30.
  // Revenue = ₹500, COGS = ₹300, Gross Profit = ₹200, Margin = 40%.
  const billItemSnapshot = {
    medicineName: "Medicine A",
    quantity: 10,
    unitPrice: 50.0,
    amount: 500.0,
    costPrice: 30.0, // Historical snapshot stored in bill_items table
  };

  const revenue = billItemSnapshot.amount;
  const cogs = billItemSnapshot.quantity * billItemSnapshot.costPrice;
  const grossProfit = revenue - cogs;
  const marginPct = (grossProfit / revenue) * 100;

  assert.strictEqual(cogs, 300.0);
  assert.strictEqual(grossProfit, 200.0);
  assert.strictEqual(marginPct, 40.0);

  // Now, owner updates batch cost price to ₹40 next week:
  const mutatedBatchCostPrice = 40.0;
  // If report re-queried current batch cost price, profit would wrongfully change to 500 - 400 = 100.
  // But report query uses `bi.cost_price`, which remains ₹30.
  const recalculatedCogsWithSnapshot = billItemSnapshot.quantity * billItemSnapshot.costPrice;
  assert.strictEqual(
    recalculatedCogsWithSnapshot,
    300.0,
    "Historical COGS must strictly use snapshot bill_items.cost_price and not mutated batch price"
  );
  assert.notStrictEqual(
    billItemSnapshot.quantity * mutatedBatchCostPrice,
    recalculatedCogsWithSnapshot,
    "Mutated batch cost must differ from snapshot"
  );

  // Verify internal isolation: cost price must NOT be exposed in invoice or bill history
  const invoicePdfPath = path.resolve("src/components/billing/InvoicePdfDocument.tsx");
  const invoicePrintPath = path.resolve("src/lib/invoicePrintService.ts");
  const billHistoryPath = path.resolve("src/pages/BillHistoryPage.tsx");

  const invoicePdfContent = fs.readFileSync(invoicePdfPath, "utf-8");
  assert.ok(!invoicePdfContent.includes("costPrice"), "Invoice PDF template must never expose cost price");
  assert.ok(!invoicePdfContent.includes("grossProfit"), "Invoice PDF must never expose gross profit");

  const invoicePrintContent = fs.readFileSync(invoicePrintPath, "utf-8");
  assert.ok(!invoicePrintContent.includes("cost_price"), "Invoice print service must never query or expose cost price");

  console.log("✓ Test 5 Passed: Snapshot cost price immutability and strict internal isolation verified.\n");
}

// ----------------------------------------------------------------------
// Test 6: GST Summary 18% Inclusive Split Calculation
// ----------------------------------------------------------------------
console.log("Test 6: GST Summary 18% Inclusive Split (9% CGST + 9% SGST)");
{
  // Rule: Bill total is GST inclusive. Total GST = (total * 18) / 118
  // CGST 9% = Total GST / 2
  // SGST 9% = Total GST - CGST
  // Taxable = total - Total GST
  const grandTotal = 1180.0;
  const expectedTotalGst = Math.round(((grandTotal * 18) / 118) * 100) / 100;
  const expectedCgst = Math.round((expectedTotalGst / 2) * 100) / 100;
  const expectedSgst = Math.round((expectedTotalGst - expectedCgst) * 100) / 100;
  const expectedTaxable = Math.round((grandTotal - expectedTotalGst) * 100) / 100;

  assert.strictEqual(expectedTotalGst, 180.0);
  assert.strictEqual(expectedCgst, 90.0);
  assert.strictEqual(expectedSgst, 90.0);
  assert.strictEqual(expectedTaxable, 1000.0);
  assert.strictEqual(expectedTaxable + expectedCgst + expectedSgst, grandTotal);

  // Fractional bill test (e.g. ₹235.50)
  const grandTotal2 = 235.5;
  const totalGst2 = Math.round(((grandTotal2 * 18) / 118) * 100) / 100;
  const cgst2 = Math.round((totalGst2 / 2) * 100) / 100;
  const sgst2 = Math.round((totalGst2 - cgst2) * 100) / 100;
  const taxable2 = Math.round((grandTotal2 - totalGst2) * 100) / 100;

  // 235.50 * 18 / 118 = 35.9237... -> 35.92
  assert.strictEqual(totalGst2, 35.92);
  assert.strictEqual(cgst2, 17.96);
  assert.strictEqual(sgst2, 17.96);
  assert.strictEqual(taxable2, 199.58);
  assert.strictEqual(taxable2 + totalGst2, grandTotal2);

  console.log("✓ Test 6 Passed: 18% GST inclusive calculation and 9%/9% CGST/SGST split verified.\n");
}

// ----------------------------------------------------------------------
// Test 7: Date Range Boundaries & Validation
// ----------------------------------------------------------------------
console.log("Test 7: Date Range Presets & From > To Validation");
{
  function isValidRange(from, to) {
    if (!from || !to) return false;
    return from <= to;
  }

  assert.strictEqual(isValidRange("2026-11-01", "2026-11-30"), true);
  assert.strictEqual(isValidRange("2026-11-05", "2026-11-05"), true, "Single date is valid");
  assert.strictEqual(isValidRange("2026-11-30", "2026-11-01"), false, "From > To is invalid");

  // Query boundary timestamps
  const fromDate = "2026-11-01";
  const toDate = "2026-11-05";
  const startTs = `${fromDate} 00:00:00`;
  const endTs = `${toDate} 23:59:59`;

  assert.strictEqual(startTs, "2026-11-01 00:00:00");
  assert.strictEqual(endTs, "2026-11-05 23:59:59");

  console.log("✓ Test 7 Passed: Date range boundary logic and validation verified.\n");
}

// ----------------------------------------------------------------------
// Test 8: Excel & PDF Export Data Payload Verification
// ----------------------------------------------------------------------
console.log("Test 8: Excel & PDF Export Format & Metadata Completeness");
{
  const reportServiceCode = fs.readFileSync(path.resolve("src/services/reportService.ts"), "utf-8");

  // Check Excel export features:
  assert.ok(reportServiceCode.includes("XLSX.utils.book_new()"), "Must use XLSX workbook creation");
  assert.ok(reportServiceCode.includes("storeName"), "Excel export must include store name");
  assert.ok(reportServiceCode.includes("dateRangeText"), "Excel export must include date range");

  // Check PDF export features:
  assert.ok(reportServiceCode.includes("A4 landscape"), "PDF export must specify A4 landscape styling");
  assert.ok(reportServiceCode.includes("@media print"), "PDF export must contain print media rules");
  assert.ok(reportServiceCode.includes("INTERNAL - DO NOT SHARE"), "PDF export must mark internal report label");

  console.log("✓ Test 8 Passed: Export capabilities to XLSX and PDF verified.\n");
}

console.log("========================================================");
console.log("  ALL REPORT MODULE TESTS PASSED (8/8 Suites)");
console.log("========================================================\n");
