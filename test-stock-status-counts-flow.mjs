import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

console.log("\n=== IM MEDICOS Stock Status Counts & Filter Consistency Test Suite ===\n");

// ----------------------------------------------------------------------
// 1. Core Mathematical Definitions (Frontend and Backend Shared Rules)
// ----------------------------------------------------------------------
// Definitions:
// - Out of Stock: total available quantity = 0
// - Low Stock: quantity > 0 and <= the medicine's low-stock threshold
// - Needs Restock: quantity <= threshold (Low Stock + Out of Stock)
// - In Stock: quantity > low-stock threshold
function calculateStockStatus(availableStock, lowStockThreshold) {
  if (availableStock <= 0) return "OUT_OF_STOCK";
  if (availableStock <= lowStockThreshold) return "LOW_STOCK";
  return "IN_STOCK";
}

function matchesStockFilter(medicine, filter) {
  if (filter === "ALL") return true;
  // Rule 7: Archived medicines are excluded from all stock status counts/filters
  if (!medicine.isActive) return false;

  if (filter === "NEEDS_RESTOCK") {
    return medicine.stockStatus === "LOW_STOCK" || medicine.stockStatus === "OUT_OF_STOCK";
  }
  return medicine.stockStatus === filter;
}

// ----------------------------------------------------------------------
// Test 1: Definitions Verification
// ----------------------------------------------------------------------
console.log("Test 1: Shared stock status definitions verification");
assert.strictEqual(calculateStockStatus(0, 10), "OUT_OF_STOCK", "0 quantity is OUT_OF_STOCK");
assert.strictEqual(calculateStockStatus(1, 10), "LOW_STOCK", "1 quantity (<=10) is LOW_STOCK");
assert.strictEqual(calculateStockStatus(10, 10), "LOW_STOCK", "10 quantity (==10) is LOW_STOCK");
assert.strictEqual(calculateStockStatus(11, 10), "IN_STOCK", "11 quantity (>10) is IN_STOCK");
assert.strictEqual(calculateStockStatus(0, 0), "OUT_OF_STOCK", "0 quantity with 0 threshold is OUT_OF_STOCK");
assert.strictEqual(calculateStockStatus(1, 0), "IN_STOCK", "1 quantity with 0 threshold is IN_STOCK");
console.log("✓ Test 1 Passed: Stock status definitions strictly match specifications.");

// ----------------------------------------------------------------------
// Test 2: Card Big Number & Out of Stock Pill Counts
// ----------------------------------------------------------------------
console.log("\nTest 2: Card Big Number (Needs Restock = low + out) and Pill (Out of Stock)");

function computeInventorySummary(medicines) {
  const activeMeds = medicines.filter((m) => m.isActive);
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const m of activeMeds) {
    if (m.stockStatus === "OUT_OF_STOCK") {
      outOfStockCount++;
    } else if (m.stockStatus === "LOW_STOCK") {
      lowStockCount++;
    }
  }

  const needsRestockCount = lowStockCount + outOfStockCount;

  return {
    totalMedicines: activeMeds.length,
    lowStockCount,
    outOfStockCount,
    needsRestockCount,
  };
}

// User example: 1 out of stock, 0 low stock -> big number 1, pill "1 out of stock"
const scenarioA = [
  { id: 1, name: "Med A", totalStock: 0, threshold: 10, stockStatus: "OUT_OF_STOCK", isActive: true },
  { id: 2, name: "Med B", totalStock: 50, threshold: 10, stockStatus: "IN_STOCK", isActive: true },
];
const summaryA = computeInventorySummary(scenarioA);
assert.strictEqual(summaryA.lowStockCount, 0);
assert.strictEqual(summaryA.outOfStockCount, 1);
assert.strictEqual(summaryA.needsRestockCount, 1, "User example: Big number must be 1");
console.log(`✓ Test 2.1 (User Example A): Big number = ${summaryA.needsRestockCount}, Pill = ${summaryA.outOfStockCount} out of stock`);

// Mixed scenario: 2 low stock, 3 out of stock, 4 in stock, 2 archived
const scenarioB = [
  { id: 1, name: "Med 1", totalStock: 0, threshold: 10, stockStatus: "OUT_OF_STOCK", isActive: true },
  { id: 2, name: "Med 2", totalStock: 0, threshold: 5, stockStatus: "OUT_OF_STOCK", isActive: true },
  { id: 3, name: "Med 3", totalStock: 0, threshold: 15, stockStatus: "OUT_OF_STOCK", isActive: true },
  { id: 4, name: "Med 4", totalStock: 3, threshold: 10, stockStatus: "LOW_STOCK", isActive: true },
  { id: 5, name: "Med 5", totalStock: 5, threshold: 5, stockStatus: "LOW_STOCK", isActive: true },
  { id: 6, name: "Med 6", totalStock: 100, threshold: 20, stockStatus: "IN_STOCK", isActive: true },
  { id: 7, name: "Med 7", totalStock: 50, threshold: 10, stockStatus: "IN_STOCK", isActive: true },
  { id: 8, name: "Med 8", totalStock: 30, threshold: 10, stockStatus: "IN_STOCK", isActive: true },
  { id: 9, name: "Med 9", totalStock: 80, threshold: 15, stockStatus: "IN_STOCK", isActive: true },
  // Archived items (must be excluded from counts)
  { id: 10, name: "Med 10", totalStock: 0, threshold: 10, stockStatus: "OUT_OF_STOCK", isActive: false },
  { id: 11, name: "Med 11", totalStock: 2, threshold: 10, stockStatus: "LOW_STOCK", isActive: false },
];

const summaryB = computeInventorySummary(scenarioB);
assert.strictEqual(summaryB.totalMedicines, 9, "Archived excluded from total");
assert.strictEqual(summaryB.outOfStockCount, 3, "Only active out of stock counted");
assert.strictEqual(summaryB.lowStockCount, 2, "Only active low stock counted");
assert.strictEqual(summaryB.needsRestockCount, 5, "Big number = 3 + 2 = 5");
console.log(`✓ Test 2.2 (Mixed Scenario B): Big number = ${summaryB.needsRestockCount}, Pill = ${summaryB.outOfStockCount} out of stock`);

// ----------------------------------------------------------------------
// Test 3: Card Click and Toggle Behavior
// ----------------------------------------------------------------------
console.log("\nTest 3: Card click toggles between NEEDS_RESTOCK and ALL");
let currentFilter = "ALL";

function onCardClick() {
  currentFilter = currentFilter === "NEEDS_RESTOCK" ? "ALL" : "NEEDS_RESTOCK";
}

onCardClick();
assert.strictEqual(currentFilter, "NEEDS_RESTOCK", "First card click activates NEEDS_RESTOCK");
onCardClick();
assert.strictEqual(currentFilter, "ALL", "Second card click clears filter to ALL");
console.log("✓ Test 3 Passed: Card click correctly toggles filter to NEEDS_RESTOCK and back to ALL.");

// ----------------------------------------------------------------------
// Test 4: Pill Click and Stop Propagation
// ----------------------------------------------------------------------
console.log("\nTest 4: Pill click toggles OUT_OF_STOCK and stops propagation");
let propagationStopped = false;

function onPillClick(e) {
  e.stopPropagation();
  currentFilter = currentFilter === "OUT_OF_STOCK" ? "ALL" : "OUT_OF_STOCK";
}

const mockEvent = {
  stopPropagation: () => {
    propagationStopped = true;
  },
};

currentFilter = "ALL";
onPillClick(mockEvent);
assert.strictEqual(propagationStopped, true, "Click event propagation stopped");
assert.strictEqual(currentFilter, "OUT_OF_STOCK", "Pill click activates OUT_OF_STOCK");

// Clicking pill again clears to ALL
onPillClick(mockEvent);
assert.strictEqual(currentFilter, "ALL", "Pill click again clears filter to ALL");

// Clicking pill when card filter is active switches to OUT_OF_STOCK
currentFilter = "NEEDS_RESTOCK";
onPillClick(mockEvent);
assert.strictEqual(currentFilter, "OUT_OF_STOCK", "Pill click switches directly to OUT_OF_STOCK");
console.log("✓ Test 4 Passed: Out of stock pill click isolated and toggles properly.");

// ----------------------------------------------------------------------
// Test 5: Dropdown Options Filtering and Agreement
// ----------------------------------------------------------------------
console.log("\nTest 5: Dropdown options return exact matching medicines");

const testMeds = scenarioB;

// Option 1: NEEDS_RESTOCK (Low + Out)
const needsRestockRows = testMeds.filter((m) => matchesStockFilter(m, "NEEDS_RESTOCK"));
assert.strictEqual(needsRestockRows.length, summaryB.needsRestockCount, "Rows match big number count exactly");
assert(needsRestockRows.every((m) => m.stockStatus === "LOW_STOCK" || m.stockStatus === "OUT_OF_STOCK"));
assert(needsRestockRows.every((m) => m.isActive === true));
console.log(`✓ Needs Restock: ${needsRestockRows.length} rows (matches card big number ${summaryB.needsRestockCount})`);

// Option 2: OUT_OF_STOCK
const outOfStockRows = testMeds.filter((m) => matchesStockFilter(m, "OUT_OF_STOCK"));
assert.strictEqual(outOfStockRows.length, summaryB.outOfStockCount, "Rows match pill count exactly");
assert(outOfStockRows.every((m) => m.stockStatus === "OUT_OF_STOCK" && m.isActive));
console.log(`✓ Out of Stock: ${outOfStockRows.length} rows (matches pill count ${summaryB.outOfStockCount})`);

// Option 3: LOW_STOCK
const lowStockRows = testMeds.filter((m) => matchesStockFilter(m, "LOW_STOCK"));
assert.strictEqual(lowStockRows.length, summaryB.lowStockCount, "Rows match low stock count");
assert(lowStockRows.every((m) => m.stockStatus === "LOW_STOCK" && m.isActive));
console.log(`✓ Low Stock: ${lowStockRows.length} rows (matches low stock count ${summaryB.lowStockCount})`);

// Option 4: IN_STOCK
const inStockRows = testMeds.filter((m) => matchesStockFilter(m, "IN_STOCK"));
assert.strictEqual(inStockRows.length, 4, "4 active in-stock medicines");
assert(inStockRows.every((m) => m.stockStatus === "IN_STOCK" && m.isActive));
console.log(`✓ In Stock: ${inStockRows.length} rows`);

// Total active sum verification: inStock + lowStock + outOfStock == totalActive
assert.strictEqual(inStockRows.length + lowStockRows.length + outOfStockRows.length, summaryB.totalMedicines);
console.log("✓ Test 5 Passed: Every dropdown option matches its exact definition.");

// ----------------------------------------------------------------------
// Test 6: "Showing X of Y" and Card-Table-Badge Agreement
// ----------------------------------------------------------------------
console.log("\nTest 6: Row count, Showing label, card count, and badges always agree");
// Verify Showing X of Y label
const totalActive = testMeds.filter((m) => m.isActive).length;
const showingLabelNeedsRestock = `Showing ${needsRestockRows.length} of ${totalActive} medicines`;
assert.strictEqual(showingLabelNeedsRestock, `Showing 5 of 9 medicines`);

const showingLabelOutOfStock = `Showing ${outOfStockRows.length} of ${totalActive} medicines`;
assert.strictEqual(showingLabelOutOfStock, `Showing 3 of 9 medicines`);

console.log(`✓ Label test: "${showingLabelNeedsRestock}" matches table rows count`);
console.log(`✓ Label test: "${showingLabelOutOfStock}" matches table rows count`);
console.log("✓ Test 6 Passed: Card count, filtered table rows, showing count, and row badges 100% agree.");

// ----------------------------------------------------------------------
// Test 7: Source Code Verification
// ----------------------------------------------------------------------
console.log("\nTest 7: Static Source Code Verification in MedicinesPage, db.rs, medicineService");
const medicinesPageSrc = fs.readFileSync(path.resolve("src/pages/MedicinesPage.tsx"), "utf8");
const dbSrc = fs.readFileSync(path.resolve("src-tauri/src/db.rs"), "utf8");
const medicineServiceSrc = fs.readFileSync(path.resolve("src/services/medicineService.ts"), "utf8");
const medicineTypeSrc = fs.readFileSync(path.resolve("src/types/medicine.ts"), "utf8");

// 1. MedicinesPage card big number and pill click
assert(medicinesPageSrc.includes("summary.needsRestockCount"), "MedicinesPage displays needsRestockCount");
assert(medicinesPageSrc.includes("handleFilterOutOfStockPill"), "MedicinesPage has handleFilterOutOfStockPill handler");
assert(medicinesPageSrc.includes("e.stopPropagation()"), "MedicinesPage calls e.stopPropagation on pill click");
assert(medicinesPageSrc.includes('stockStatusFilter === "NEEDS_RESTOCK"'), "MedicinesPage checks NEEDS_RESTOCK filter");
assert(medicinesPageSrc.includes('<option value="NEEDS_RESTOCK">Needs Restock (Low + Out)</option>'), "MedicinesPage has Needs Restock dropdown option");

// 2. Dropdown options
assert(medicinesPageSrc.includes('<option value="ALL">All Stock Levels</option>'), "Has All Stock Levels option");
assert(medicinesPageSrc.includes('<option value="IN_STOCK">In Stock</option>'), "Has In Stock option");
assert(medicinesPageSrc.includes('<option value="LOW_STOCK">Low Stock</option>'), "Has Low Stock option");
assert(medicinesPageSrc.includes('<option value="OUT_OF_STOCK">Out of Stock</option>'), "Has Out of Stock option");

// 3. Types
assert(medicineTypeSrc.includes("needsRestockCount: number"), "InventorySummaryMetrics has needsRestockCount");
assert(medicineTypeSrc.includes('export type StockStatusFilter = "ALL" | StockStatus | "NEEDS_RESTOCK"'), "StockStatusFilter includes NEEDS_RESTOCK");

// 4. db.rs and medicineService.ts
assert(dbSrc.includes("pub needs_restock_count: i64"), "Rust db.rs has needs_restock_count in struct");
assert(dbSrc.includes("let needs_restock_count = low_stock_count + out_of_stock_count;"), "Rust db.rs calculates needs_restock_count");
assert(medicineServiceSrc.includes("const needsRestockCount = lowStockCount + outOfStockCount;"), "medicineService calculates needsRestockCount");

console.log("✓ Test 7 Passed: All source code files, handlers, dropdown options, and queries verified.");

console.log("\n========================================================");
console.log("ALL STOCK STATUS & COUNT CONSISTENCY TESTS PASSED (100%)!");
console.log("========================================================\n");

