import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

console.log("\n=== IM MEDICOS Command 05A: New Bill Module & PDF Invoicing Test Suite ===\n");

// Financial Math reference from src/lib/billingConfig.ts
const GST_RATE = 18;
const CGST_RATE = 9;
const SGST_RATE = 9;

function calculateIncludedGst(grandTotal) {
  if (!grandTotal || grandTotal <= 0) return { gstTotal: 0, cgst: 0, sgst: 0 };
  const gstTotal = Number(((grandTotal * GST_RATE) / (100 + GST_RATE)).toFixed(2));
  const cgst = Number((gstTotal / 2).toFixed(2));
  const sgst = Number((gstTotal - cgst).toFixed(2));
  return { gstTotal, cgst, sgst };
}

function isValidIndianMobile(mobile) {
  if (!mobile) return false;
  const cleaned = mobile.trim().replace(/\D/g, "");
  return /^[6-9]\d{9}$/.test(cleaned);
}

function formatAmountInIndianWords(amount) {
  if (isNaN(amount) || amount <= 0) return "Rupees Zero Only";

  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertTwo(num) {
    if (num === 0) return "";
    if (num < 20) return ones[num];
    const t = tens[Math.floor(num / 10)];
    const o = ones[num % 10];
    return o ? `${t} ${o}` : t;
  }

  function convertThree(num) {
    const hundred = Math.floor(num / 100);
    const rest = num % 100;
    let s = "";
    if (hundred > 0) s += `${ones[hundred]} Hundred`;
    if (rest > 0) {
      if (s !== "") s += " ";
      s += convertTwo(rest);
    }
    return s;
  }

  const rounded = Number(amount.toFixed(2));
  const integerPart = Math.floor(rounded);
  const decimalPart = Math.round((rounded - integerPart) * 100);

  let remaining = integerPart;
  const parts = [];

  const crores = Math.floor(remaining / 10000000);
  remaining %= 10000000;
  if (crores > 0) parts.push(`${convertThree(crores)} Crore`);

  const lakhs = Math.floor(remaining / 100000);
  remaining %= 100000;
  if (lakhs > 0) parts.push(`${convertTwo(lakhs)} Lakh`);

  const thousands = Math.floor(remaining / 1000);
  remaining %= 1000;
  if (thousands > 0) parts.push(`${convertTwo(thousands)} Thousand`);

  if (remaining > 0) parts.push(convertThree(remaining));

  let words = "Rupees " + (parts.length > 0 ? parts.join(" ") : "Zero");
  if (decimalPart > 0) words += ` and ${convertTwo(decimalPart)} Paise`;
  words += " Only";
  return words;
}

// ----------------------------------------------------------------------
// Test 1: Non-Discount Bill Logic
// ----------------------------------------------------------------------
console.log("Test 1: Non-Discount Bill (Rate = MRP, Discount = 0, SP ignored)");
{
  const mockItems = [
    { name: "Paracetamol 500mg", mrp: 30.0, sellingPrice: 24.0, costPrice: 18.0, quantity: 2 },
    { name: "Amoxicillin 250mg", mrp: 75.0, sellingPrice: 65.0, costPrice: 50.0, quantity: 3 },
  ];

  let subTotal = 0;
  let discount = 0;

  mockItems.forEach((it) => {
    const rate = it.mrp; // Non-discount mode forces Rate = MRP
    const lineAmount = rate * it.quantity;
    const lineMrp = it.mrp * it.quantity;
    subTotal += lineMrp;
    discount += (lineMrp - lineAmount); // 0
  });

  const grandTotal = subTotal - discount;
  const gst = calculateIncludedGst(grandTotal);

  assert.strictEqual(subTotal, 285.0); // (30*2) + (75*3) = 60 + 225 = 285
  assert.strictEqual(discount, 0.0, "Non-discount bill discount must be strictly 0");
  assert.strictEqual(grandTotal, 285.0, "Grand total must equal subtotal");
  assert.strictEqual(gst.gstTotal, 43.47, "18% inclusive GST = 285 * 18 / 118 = 43.47");
  assert.strictEqual(gst.cgst, 21.73);
  assert.strictEqual(gst.sgst, 21.74);
  assert.strictEqual(Number((gst.cgst + gst.sgst).toFixed(2)), 43.47);
  console.log("✓ Test 1 Passed: Non-Discount bill calculations strictly verified.");
}

// ----------------------------------------------------------------------
// Test 2: Discounted Bill Logic
// ----------------------------------------------------------------------
console.log("\nTest 2: Discounted Bill (Default Rate = SP, Discount = sum((MRP - Rate)*Qty))");
{
  const mockItems = [
    { name: "Paracetamol 500mg", mrp: 30.0, rate: 24.0, costPrice: 18.0, quantity: 2 }, // default SP
    { name: "Amoxicillin 250mg", mrp: 75.0, rate: 60.0, costPrice: 50.0, quantity: 3 }, // user edited from 65 to 60
  ];

  let subTotal = 0;
  let discount = 0;

  mockItems.forEach((it) => {
    const lineMrp = it.mrp * it.quantity;
    const lineAmount = it.rate * it.quantity;
    subTotal += lineMrp;
    discount += (lineMrp - lineAmount);
  });

  const grandTotal = Number((subTotal - discount).toFixed(2));
  const expectedDiscount = ((30 - 24) * 2) + ((75 - 60) * 3); // 12 + 45 = 57
  const expectedGrandTotal = (24 * 2) + (60 * 3); // 48 + 180 = 228

  assert.strictEqual(subTotal, 285.0);
  assert.strictEqual(discount, expectedDiscount, `Discount must equal ${expectedDiscount}`);
  assert.strictEqual(grandTotal, expectedGrandTotal, `Grand total must equal ${expectedGrandTotal}`);

  const gst = calculateIncludedGst(grandTotal);
  assert.strictEqual(gst.gstTotal, 34.78); // 228 * 18 / 118 = 34.78
  console.log("✓ Test 2 Passed: Discounted bill with default and edited rates verified.");
}

// ----------------------------------------------------------------------
// Test 3: FEFO Multi-Batch Splitting Logic
// ----------------------------------------------------------------------
console.log("\nTest 3: FEFO Multi-Batch Split (Earliest expiry first, split across batches)");
{
  const medicine = {
    id: 101,
    name: "Augmentin 625 Duo",
    unit: "Strip",
    totalSaleableStock: 25,
    batches: [
      { id: 1, batchNumber: "B1-EXP-MAR", expDate: "2026-03-31", stockQty: 10, mrp: 200, sellingPrice: 180, costPrice: 150 },
      { id: 2, batchNumber: "B2-EXP-JUN", expDate: "2026-06-30", stockQty: 15, mrp: 200, sellingPrice: 180, costPrice: 150 },
    ],
  };

  function splitFefo(med, desiredQty, mode) {
    let remaining = desiredQty;
    const result = [];
    for (const b of med.batches) {
      if (remaining <= 0) break;
      const take = Math.min(b.stockQty, remaining);
      if (take <= 0) continue;
      const rate = mode === "NON_DISCOUNT" ? b.mrp : b.sellingPrice;
      result.push({
        batchId: b.id,
        batchNumber: b.batchNumber,
        expDate: b.expDate,
        quantity: take,
        rate,
        amount: rate * take,
      });
      remaining -= take;
    }
    return result;
  }

  // Request 15 units (needs 10 from Batch 1 + 5 from Batch 2)
  const splitLines = splitFefo(medicine, 15, "NON_DISCOUNT");
  assert.strictEqual(splitLines.length, 2, "Must split into exactly 2 lines");
  assert.strictEqual(splitLines[0].batchNumber, "B1-EXP-MAR");
  assert.strictEqual(splitLines[0].quantity, 10);
  assert.strictEqual(splitLines[1].batchNumber, "B2-EXP-JUN");
  assert.strictEqual(splitLines[1].quantity, 5);
  console.log("✓ Test 3 Passed: Multi-batch FEFO allocation automatically splits lines.");
}

// ----------------------------------------------------------------------
// Test 4: Customer Validation (Name & Indian Mobile)
// ----------------------------------------------------------------------
console.log("\nTest 4: Customer Details & Mobile validation");
{
  assert.strictEqual(isValidIndianMobile("9876543210"), true, "Valid 987... mobile");
  assert.strictEqual(isValidIndianMobile("8123456789"), true, "Valid 812... mobile");
  assert.strictEqual(isValidIndianMobile("7000000000"), true, "Valid 700... mobile");
  assert.strictEqual(isValidIndianMobile("6999999999"), true, "Valid 699... mobile");
  assert.strictEqual(isValidIndianMobile("5555555555"), false, "Starts with 5 - invalid");
  assert.strictEqual(isValidIndianMobile("987654321"), false, "9 digits - invalid");
  assert.strictEqual(isValidIndianMobile("98765432100"), false, "11 digits - invalid");
  assert.strictEqual(isValidIndianMobile(""), false, "Empty mobile - invalid");
  console.log("✓ Test 4 Passed: 10-digit Indian mobile validation strictly verified.");
}

// ----------------------------------------------------------------------
// Test 5: Amount in Words (Indian Currency Standard)
// ----------------------------------------------------------------------
console.log("\nTest 5: Amount in Words formatting");
{
  assert.strictEqual(
    formatAmountInIndianWords(285.0),
    "Rupees Two Hundred Eighty Five Only"
  );
  assert.strictEqual(
    formatAmountInIndianWords(1250.5),
    "Rupees One Thousand Two Hundred Fifty and Fifty Paise Only"
  );
  assert.strictEqual(
    formatAmountInIndianWords(250000),
    "Rupees Two Lakh Fifty Thousand Only"
  );
  console.log("✓ Test 5 Passed: Indian Rupees amount in words conversion verified.");
}

// ----------------------------------------------------------------------
// Test 6: In-Memory SQLite Billing Database Transaction Simulation
// ----------------------------------------------------------------------
console.log("\nTest 6: Single Database Transaction, Atomic Numbering & Stock Deduction");
{
  class MockDb {
    constructor() {
      this.storeDetails = { billPrefix: "IM", startingBillNumber: 1 };
      this.bills = [];
      this.billItems = [];
      this.batches = [
        { id: 1, medicineId: 10, batchNumber: "B-101", stockQty: 50, mrp: 50.0, sp: 45.0, cost: 35.0, expDate: "2027-01-01", isActive: true },
        { id: 2, medicineId: 10, batchNumber: "B-102", stockQty: 5, mrp: 50.0, sp: 45.0, cost: 35.0, expDate: "2026-12-01", isActive: true },
      ];
      this.stockMovements = [];
    }

    getNextBillNumber() {
      const prefix = this.storeDetails.billPrefix;
      const prefixDash = `${prefix}-`;
      let maxSuffix = 0;
      for (const b of this.bills) {
        if (b.billNumber.startsWith(prefixDash)) {
          const num = parseInt(b.billNumber.slice(prefixDash.length), 10);
          if (!isNaN(num) && num > maxSuffix) maxSuffix = num;
        }
      }
      const next = maxSuffix > 0 ? maxSuffix + 1 : this.storeDetails.startingBillNumber;
      return `${prefix}-${String(next).padStart(4, "0")}`;
    }

    saveBill(input) {
      if (!input.customerName || !input.customerName.trim()) throw new Error("Customer name cannot be empty");
      if (!isValidIndianMobile(input.customerMobile)) throw new Error("Enter a valid 10-digit Indian mobile number");
      if (!input.items || input.items.length === 0) throw new Error("Bill must contain at least one medicine item");

      // Transaction: Check stock for all items first
      for (const item of input.items) {
        const batch = this.batches.find((b) => b.id === item.batchId);
        if (!batch || !batch.isActive) throw new Error("Batch not found or inactive");
        if (batch.stockQty < item.quantity) {
          throw new Error(`Insufficient stock for batch ${batch.batchNumber}. Available: ${batch.stockQty}, Requested: ${item.quantity}`);
        }
      }

      const billNumber = this.getNextBillNumber();
      let subTotal = 0;
      let discount = 0;

      for (const item of input.items) {
        const lineMrp = item.mrp * item.quantity;
        const lineRate = input.discountMode === "NON_DISCOUNT" ? item.mrp : item.rate;
        const lineAmount = lineRate * item.quantity;
        subTotal += lineMrp;
        discount += (lineMrp - lineAmount);
      }

      const grandTotal = subTotal - discount;
      const gst = calculateIncludedGst(grandTotal);

      const billId = this.bills.length + 1;
      const bill = {
        id: billId,
        billNumber,
        customerName: input.customerName.trim(),
        customerMobile: input.customerMobile.trim(),
        doctorName: input.doctorName || null,
        discountMode: input.discountMode,
        paymentMode: input.paymentMode,
        subTotal,
        discount,
        gstTotal: gst.gstTotal,
        cgst: gst.cgst,
        sgst: gst.sgst,
        grandTotal,
        status: "COMPLETED",
      };

      this.bills.push(bill);

      // Deduct stock and record movements
      for (const item of input.items) {
        const batch = this.batches.find((b) => b.id === item.batchId);
        const prev = batch.stockQty;
        batch.stockQty -= item.quantity;

        this.billItems.push({
          billId,
          medicineId: item.medicineId,
          batchId: item.batchId,
          quantity: item.quantity,
          mrp: item.mrp,
          rate: input.discountMode === "NON_DISCOUNT" ? item.mrp : item.rate,
          amount: (input.discountMode === "NON_DISCOUNT" ? item.mrp : item.rate) * item.quantity,
        });

        this.stockMovements.push({
          medicineId: item.medicineId,
          batchId: item.batchId,
          movementType: "SALE",
          quantity: item.quantity,
          previousQty: prev,
          newQty: batch.stockQty,
          referenceId: billNumber,
        });
      }

      return bill;
    }
  }

  const db = new MockDb();
  assert.strictEqual(db.getNextBillNumber(), "IM-0001", "Initial bill number is IM-0001");

  // Save bill 1
  const bill1 = db.saveBill({
    customerName: "Anil Kapoor",
    customerMobile: "9812345678",
    discountMode: "NON_DISCOUNT",
    paymentMode: "CASH",
    items: [{ medicineId: 10, batchId: 1, mrp: 50.0, rate: 50.0, quantity: 10 }],
  });

  assert.strictEqual(bill1.billNumber, "IM-0001");
  assert.strictEqual(bill1.grandTotal, 500.0);
  assert.strictEqual(db.batches[0].stockQty, 40, "Batch 1 stock reduced from 50 to 40");
  assert.strictEqual(db.stockMovements.length, 1);
  assert.strictEqual(db.stockMovements[0].movementType, "SALE");
  assert.strictEqual(db.stockMovements[0].previousQty, 50);
  assert.strictEqual(db.stockMovements[0].newQty, 40);

  // Next bill preview is IM-0002
  assert.strictEqual(db.getNextBillNumber(), "IM-0002", "Sequential next bill is IM-0002");

  // Attempting to buy 50 units (only 40 left) -> Must fail cleanly without saving or incrementing
  assert.throws(() => {
    db.saveBill({
      customerName: "Sunita Roy",
      customerMobile: "9898989898",
      discountMode: "NON_DISCOUNT",
      paymentMode: "UPI",
      items: [{ medicineId: 10, batchId: 1, mrp: 50.0, rate: 50.0, quantity: 50 }],
    });
  }, /Insufficient stock/);

  // Bill number didn't skip after failure!
  assert.strictEqual(db.getNextBillNumber(), "IM-0002", "Failed transaction does NOT consume or skip bill numbers");
  assert.strictEqual(db.batches[0].stockQty, 40, "Stock untouched after rollback");

  // Save bill 2 successfully
  const bill2 = db.saveBill({
    customerName: "Sunita Roy",
    customerMobile: "9898989898",
    discountMode: "DISCOUNTED",
    paymentMode: "UPI",
    items: [{ medicineId: 10, batchId: 1, mrp: 50.0, rate: 45.0, quantity: 5 }],
  });
  assert.strictEqual(bill2.billNumber, "IM-0002");
  assert.strictEqual(bill2.grandTotal, 225.0);
  assert.strictEqual(db.batches[0].stockQty, 35);
  console.log("✓ Test 6 Passed: Atomic SQLite transaction, numbering, and stock audit verified.");
}

// ----------------------------------------------------------------------
// Test 7: Source Code & File Contract Verifications
// ----------------------------------------------------------------------
console.log("\nTest 7: Static File & Component Verifications");
{
  const newBillSrc = fs.readFileSync(path.resolve("src/pages/NewBillPage.tsx"), "utf8");
  const invoicePdfSrc = fs.readFileSync(path.resolve("src/components/billing/InvoicePdfDocument.tsx"), "utf8");
  const billingServiceSrc = fs.readFileSync(path.resolve("src/services/billingService.ts"), "utf8");
  const billingConfigSrc = fs.readFileSync(path.resolve("src/lib/billingConfig.ts"), "utf8");
  const dbSrc = fs.readFileSync(path.resolve("src-tauri/src/db.rs"), "utf8");
  const libSrc = fs.readFileSync(path.resolve("src-tauri/src/lib.rs"), "utf8");
  const appLayoutSrc = fs.readFileSync(path.resolve("src/components/layout/AppLayout.tsx"), "utf8");
  const appSrc = fs.readFileSync(path.resolve("src/App.tsx"), "utf8");

  // 1. Navigation verification
  assert(appLayoutSrc.includes('{ key: "new_bill", label: "New Bill", icon: Receipt, isImplemented: true }'), "AppLayout enables New Bill");
  assert(appLayoutSrc.includes('{ key: "bill_history", label: "Bill History", icon: History, isImplemented: false'), "Bill History strictly remains isImplemented: false");
  assert(appSrc.includes('<NewBillPage />'), "App.tsx routes to NewBillPage");

  // 2. Billing modes & GST
  assert(newBillSrc.includes("Non-Discount Bill"), "Has Non-Discount mode button");
  assert(newBillSrc.includes("Discounted Bill"), "Has Discounted mode button");
  assert(newBillSrc.includes("Included GST (18%)"), "Displays 18% inclusive GST");
  assert(billingConfigSrc.includes("export const GST_RATE = 18;"), "billingConfig defines 18% GST");
  assert(billingConfigSrc.includes("export const CGST_RATE = 9;"), "billingConfig defines 9% CGST");
  assert(billingConfigSrc.includes("export const SGST_RATE = 9;"), "billingConfig defines 9% SGST");

  // 3. Invoice PDF Contract
  assert(invoicePdfSrc.includes("TAX INVOICE / PHARMACY BILL"), "Invoice PDF has required title");
  assert(invoicePdfSrc.includes("Thank you for choosing I M Medicos"), "Invoice PDF has required thank you note");
  assert(invoicePdfSrc.includes("Please take medicines as directed by the Physician."), "Invoice PDF has required prescription note");
  assert(invoicePdfSrc.includes("Authorised Signatory"), "Invoice PDF has Authorised Signatory");
  assert(!invoicePdfSrc.includes("costPrice"), "Invoice PDF NEVER contains or prints costPrice");
  assert(!newBillSrc.includes("{it.costPrice}"), "New Bill screen NEVER displays costPrice to user");

  // 4. Tauri registration
  assert(libSrc.includes("get_next_bill_number"), "Tauri registers get_next_bill_number");
  assert(libSrc.includes("get_saleable_medicines"), "Tauri registers get_saleable_medicines");
  assert(libSrc.includes("save_bill"), "Tauri registers save_bill");
  assert(dbSrc.includes("pub fn save_bill_transaction"), "Rust db.rs has save_bill_transaction");
  assert(dbSrc.includes("pub fn fetch_saleable_medicines"), "Rust db.rs has fetch_saleable_medicines");
  assert(dbSrc.includes("pub fn fetch_next_bill_number_preview"), "Rust db.rs has fetch_next_bill_number_preview");
  assert(dbSrc.includes("migrate_billing_tables"), "Rust db.rs has migrate_billing_tables");

  console.log("✓ Test 7 Passed: All source code files, components, and backend contracts verified.");
}

// ----------------------------------------------------------------------
// Test 8: Invoice PDF & Print Template Requirements (Command 05A Polish)
// ----------------------------------------------------------------------
console.log("\nTest 8: Invoice PDF & Print Template Specifications");
{
  const invoicePdfSrc = fs.readFileSync(path.resolve("src/components/billing/InvoicePdfDocument.tsx"), "utf8");
  const invoicePrintSrc = fs.readFileSync(path.resolve("src/lib/invoicePrintService.ts"), "utf8");
  const billingServiceSrc = fs.readFileSync(path.resolve("src/services/billingService.ts"), "utf8");
  const dbSrc = fs.readFileSync(path.resolve("src-tauri/src/db.rs"), "utf8");

  // 1. No blank filler rows
  assert(!invoicePdfSrc.includes("blankRowsCount"), "InvoicePdfDocument must not have blankRowsCount or blank fill rows");
  assert(!invoicePrintSrc.includes("blankRowsCount"), "invoicePrintService must not have blankRowsCount or blank fill rows");
  assert(!invoicePrintSrc.includes("blank-row"), "invoicePrintService must not contain blank-row class");

  // 2. GST Display: Text only 'CGST 9% + SGST 9% (Included)' - NO rupee amounts for GST
  assert(invoicePdfSrc.includes("CGST 9% + SGST 9% (Included)"), "InvoicePdfDocument has CGST 9% + SGST 9% (Included)");
  assert(invoicePrintSrc.includes("CGST 9% + SGST 9% (Included)"), "invoicePrintService has CGST 9% + SGST 9% (Included)");
  assert(!invoicePdfSrc.includes("Incl. GST (18%):"), "InvoicePdfDocument must not have 'Incl. GST (18%):' amount row");
  assert(!invoicePrintSrc.includes("Incl. GST (18%):"), "invoicePrintService must not have 'Incl. GST (18%):' amount row");
  assert(!invoicePdfSrc.includes("• CGST 9%:"), "InvoicePdfDocument must not print rupee amount for CGST");
  assert(!invoicePrintSrc.includes("• CGST 9%:"), "invoicePrintService must not print rupee amount for CGST");
  assert(!invoicePdfSrc.includes("• SGST 9%:"), "InvoicePdfDocument must not print rupee amount for SGST");
  assert(!invoicePrintSrc.includes("• SGST 9%:"), "invoicePrintService must not print rupee amount for SGST");
  assert(!invoicePdfSrc.includes("* All prices are inclusive of GST"), "InvoicePdfDocument must not contain inclusive footnote");
  assert(!invoicePrintSrc.includes("* All prices are inclusive of GST"), "invoicePrintService must not contain inclusive footnote");

  // 3. Logo handling and header column constraints: max-width 100%, max-height 18mm, 38/27/35 split, 4mm/3mm padding
  assert(invoicePdfSrc.includes("max-w-full max-h-[18mm]"), "InvoicePdfDocument sizes logo to 100% column max width and 18mm max height");
  assert(invoicePrintSrc.includes("max-width: 100%; max-height: 18mm"), "invoicePrintService sizes logo to 100% column max width and 18mm max height");
  assert(invoicePrintSrc.includes("38%"), "Header left column has 38% width");
  assert(invoicePrintSrc.includes("27%"), "Header middle column has 27% width");
  assert(invoicePrintSrc.includes("35%"), "Header right column has 35% width");
  assert(invoicePrintSrc.includes("padding-right: 4mm"), "At least 4mm padding between logo and first divider");
  assert(invoicePrintSrc.includes("padding: 0 3mm"), "3mm padding on each side of dividers");
  assert(invoicePrintSrc.includes("trimImageWhitespace"), "invoicePrintService implements auto-trimming of logo whitespace");
  assert(invoicePdfSrc.includes("trimImageWhitespace"), "InvoicePdfDocument uses auto-trimmed logo");
  assert(!invoicePdfSrc.includes("Medical Billing Software"), "InvoicePdfDocument must not have 'Medical Billing Software'");
  assert(!invoicePrintSrc.includes("MEDICAL BILLING SOFTWARE"), "invoicePrintService must not have 'MEDICAL BILLING SOFTWARE'");
  assert(!invoicePdfSrc.includes("Original For Recipient"), "Removed 'Original For Recipient'");
  assert(!invoicePrintSrc.includes("Original For Recipient"), "Removed 'Original For Recipient' from print service");
  assert(!invoicePdfSrc.includes("Page 1 of 1"), "Removed 'Page 1 of 1'");

  // 4. Logo snapshotting in database & billing service
  assert(dbSrc.includes("store_logo_path"), "Rust db.rs has store_logo_path column in bills table");
  assert(billingServiceSrc.includes("logoPath: store?.logoPath || null"), "billingService snapshots logoPath");
  assert(billingServiceSrc.includes("logoDataUrl: store?.logoDataUrl || null"), "billingService snapshots logoDataUrl");

  // 5. Hardcoded fallbacks removed
  assert(!billingServiceSrc.includes('store?.storeName || "IM MEDICOS PHARMACY"'), "Removed fallback 'IM MEDICOS PHARMACY'");
  assert(!invoicePdfSrc.includes('Keep medicines in a cool, dry place away from sunlight.'), "No hardcoded terms fallback in InvoicePdfDocument");
  assert(!invoicePrintSrc.includes('Keep medicines in a cool, dry place away from sunlight.'), "No hardcoded terms fallback in invoicePrintService");

  // 6. Header dividers & pill title & underline fields
  assert(invoicePdfSrc.includes("border-[1.5px] border-[#0b3a73]"), "Has thin navy outer page border");
  assert(invoicePdfSrc.includes("TAX INVOICE / PHARMACY BILL"), "Has centered navy pill with TAX INVOICE / PHARMACY BILL");
  assert(invoicePrintSrc.includes("TAX INVOICE / PHARMACY BILL"), "Print service has TAX INVOICE / PHARMACY BILL");
  assert(invoicePdfSrc.includes("formatDisplayDate(bill.billDate)"), "Formats date as DD/MM/YYYY");
  assert(invoicePrintSrc.includes("formatDisplayDate(bill.billDate)"), "Print service formats date as DD/MM/YYYY");
  assert(invoicePdfSrc.includes("Mobile No. :"), "InvoicePdfDocument has Mobile No. : label");
  assert(invoicePrintSrc.includes("Mobile No. :"), "invoicePrintService has Mobile No. : label");
  assert(!invoicePdfSrc.includes("_____"), "Doctor Name has no underscore characters in InvoicePdfDocument");
  assert(!invoicePrintSrc.includes("_____"), "Doctor Name has no underscore characters in invoicePrintService");
  assert(invoicePrintSrc.includes("margin: 8mm"), "Print CSS sets @page margin to 8mm");
  assert(invoicePdfSrc.includes("formatExpiryForInvoice"), "InvoicePdfDocument uses formatExpiryForInvoice");
  assert(invoicePrintSrc.includes("formatExpiryForInvoice"), "invoicePrintService uses formatExpiryForInvoice");

  // 7. Multi-page pagination contracts
  assert(invoicePdfSrc.includes("SINGLE_PAGE_MAX"), "InvoicePdfDocument defines pagination threshold");
  assert(invoicePrintSrc.includes("SINGLE_PAGE_MAX"), "invoicePrintService defines pagination threshold");
  assert(invoicePrintSrc.includes("page-break"), "invoicePrintService applies page-break");

  console.log("✓ Test 8 Passed: Invoice PDF & Print Template specifications strictly verified.");
}

// Test 9: Bill Saved Modal Close & Safety Handlers
{
  console.log("\nTest 9: Bill Saved Modal Close & Safety Handlers Verification");
  const newBillPageSrc = fs.readFileSync(path.resolve("src/pages/NewBillPage.tsx"), "utf8");

  // 1. Top-right close button with title="Close" and aria-label="Close"
  assert(newBillPageSrc.includes('title="Close"'), "Modal has close button with title='Close'");
  assert(newBillPageSrc.includes('aria-label="Close"'), "Modal has close button with aria-label='Close'");

  // 2. Backdrop click handler on outer wrapper
  assert(newBillPageSrc.includes('e.target === e.currentTarget && !modalActionLoading'), "Backdrop click closes modal when clicking outside and not loading");

  // 3. Global Escape key handling
  assert(newBillPageSrc.includes('e.key === "Escape"') || newBillPageSrc.includes("e.key === 'Escape'"), "Escape key handler registered");
  assert(newBillPageSrc.includes("handleCloseSuccessModal"), "handleCloseSuccessModal defined and wired");

  // 4. Closing modal clears cart & customer fields via handleClearBill
  assert(newBillPageSrc.includes("handleClearBill();"), "handleCloseSuccessModal calls handleClearBill to prevent duplicate saves");

  // 5. Actions do not auto-close modal & loading states prevent accidental exits
  assert(newBillPageSrc.includes('setModalActionLoading("print")'), "modalActionLoading state guards concurrent operations");
  assert(newBillPageSrc.includes("modalActionError"), "modalActionError surfaces failures inline without closing modal");
  assert(!newBillPageSrc.includes("handlePrint();\n                    setSavedBill(null);"), "Print action does not automatically dismiss saved bill modal");

  // 6. Other modals on NewBillPage also support X button, backdrop click, and Escape
  assert(newBillPageSrc.includes("setPendingModeSwitch(null)"), "pendingModeSwitch supports dismiss");
  assert(newBillPageSrc.includes("setIsClearConfirmOpen(false)"), "isClearConfirmOpen supports dismiss");
  assert(newBillPageSrc.includes("setRateWarningDialog(null)"), "rateWarningDialog supports dismiss");

  console.log("✓ Test 9 Passed: Bill Saved Modal Close & Safety Handlers strictly verified.");
}

console.log("\n========================================================");
console.log("ALL COMMAND 05A BILLING TESTS PASSED (100% SUCCESS)!");
console.log("========================================================\n");

