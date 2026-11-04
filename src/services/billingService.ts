/**
 * Billing & Invoicing Service
 * IM MEDICOS Pharmacy Billing Software
 */

import {
  BillFilterInput,
  BillHistorySummary,
  BillItem,
  BillRecord,
  DiscountMode,
  PaginatedBillsResult,
  SaleableMedicine,
  SaveBillInput,
} from "@/types/billing";
import { storeService } from "@/services/storeService";
import { medicineService } from "@/services/medicineService";
import {
  calculateIncludedGst,
  formatAmountInIndianWords,
  isValidIndianMobile,
} from "@/lib/billingConfig";

const BILLS_STORAGE_KEY = "im_medicos_bills";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function getLocalBills(): BillRecord[] {
  try {
    const raw = localStorage.getItem(BILLS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveLocalBills(bills: BillRecord[]): void {
  try {
    localStorage.setItem(BILLS_STORAGE_KEY, JSON.stringify(bills));
  } catch (err) {
    console.error("Failed to persist local bills:", err);
  }
}

class BillingService {
  /**
   * Retrieves saleable medicines (active medicines with active, unexpired batches sorted FEFO)
   */
  async getSaleableMedicines(): Promise<SaleableMedicine[]> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const list = await invoke<SaleableMedicine[]>("get_saleable_medicines");
        if (list && Array.isArray(list)) return list;
      } catch (err) {
        console.warn("Tauri get_saleable_medicines fallback:", err);
      }
    }

    // LocalStorage fallback
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const medicines = await medicineService.getMedicines(false);
    return medicines
      .filter((m) => m.isActive)
      .map((m) => {
        const activeUnexpiredBatches = (m.batches || [])
          .filter((b) => b.isActive && b.stockQty > 0 && b.expDate >= todayStr)
          .sort((a, b) => a.expDate.localeCompare(b.expDate))
          .map((b) => ({
            id: b.id,
            medicineId: b.medicineId,
            batchNumber: b.batchNumber,
            mfgDate: b.mfgDate,
            expDate: b.expDate,
            costPrice: b.costPrice,
            mrp: b.mrp,
            sellingPrice: b.sellingPrice,
            stockQty: b.stockQty,
          }));

        const totalSaleableStock = activeUnexpiredBatches.reduce(
          (sum, b) => sum + (b.stockQty || 0),
          0
        );

        return {
          id: m.id,
          name: m.name,
          genericName: m.genericName,
          manufacturer: m.manufacturer,
          category: m.category,
          barcode: m.barcode,
          unit: m.unit,
          lowStockThreshold: m.lowStockThreshold,
          isActive: m.isActive,
          totalSaleableStock,
          nearestExpiryDate:
            activeUnexpiredBatches.length > 0
              ? activeUnexpiredBatches[0].expDate
              : null,
          batches: activeUnexpiredBatches,
        };
      });
  }

  /**
   * Generates a preview string for the next sequential bill number (e.g., IM-0001)
   */
  async getNextBillNumberPreview(): Promise<string> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const preview = await invoke<string>("get_next_bill_number");
        if (preview) return preview;
      } catch (err) {
        console.warn("Tauri get_next_bill_number fallback:", err);
      }
    }

    const store = await storeService.getStoreDetails();
    const prefix = (store?.billPrefix || "IM").trim().toUpperCase();
    const startingNum = store?.startingBillNumber || 1;

    const bills = getLocalBills();
    let maxSuffix = 0;
    const prefixDash = `${prefix}-`;

    for (const b of bills) {
      if (b.billNumber.startsWith(prefixDash)) {
        const suffix = parseInt(b.billNumber.slice(prefixDash.length), 10);
        if (!isNaN(suffix) && suffix > maxSuffix) {
          maxSuffix = suffix;
        }
      }
    }

    const nextNum = maxSuffix > 0 ? maxSuffix + 1 : Math.max(1, startingNum);
    return `${prefix}-${String(nextNum).padStart(4, "0")}`;
  }

  /**
   * Automatically splits quantity across available batches according to FEFO (earliest expiry first)
   */
  splitMedicineQuantityFefo(
    med: SaleableMedicine,
    desiredQty: number,
    discountMode: DiscountMode
  ): BillItem[] {
    if (desiredQty < 1 || med.batches.length === 0) return [];

    let remainingNeeded = desiredQty;
    const items: BillItem[] = [];

    for (const b of med.batches) {
      if (remainingNeeded <= 0) break;
      const takeQty = Math.min(b.stockQty, remainingNeeded);
      if (takeQty <= 0) continue;

      const rate = discountMode === "NON_DISCOUNT" ? b.mrp : b.sellingPrice;
      const amount = Number((rate * takeQty).toFixed(2));

      items.push({
        id: `line-${med.id}-${b.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        medicineId: med.id,
        medicineName: med.name,
        genericName: med.genericName,
        manufacturer: med.manufacturer,
        unit: med.unit,
        batchId: b.id,
        batchNumber: b.batchNumber,
        expDate: b.expDate,
        availableStock: b.stockQty,
        costPrice: b.costPrice,
        mrp: b.mrp,
        sellingPrice: b.sellingPrice,
        rate,
        quantity: takeQty,
        amount,
      });

      remainingNeeded -= takeQty;
    }

    return items;
  }

  /**
   * Recalculates bill totals live
   */
  calculateTotals(items: BillItem[], discountMode: DiscountMode) {
    let subTotal = 0;
    let discount = 0;

    for (const item of items) {
      const lineMrpTotal = Number((item.mrp * item.quantity).toFixed(2));
      const lineRate = discountMode === "NON_DISCOUNT" ? item.mrp : item.rate;
      const lineAmount = Number((lineRate * item.quantity).toFixed(2));

      subTotal += lineMrpTotal;
      if (discountMode === "DISCOUNTED") {
        discount += lineMrpTotal - lineAmount;
      }
    }

    subTotal = Number(subTotal.toFixed(2));
    discount = Number(discount.toFixed(2));
    const grandTotal = Number((subTotal - discount).toFixed(2));
    const gstInfo = calculateIncludedGst(grandTotal);
    const amountInWords = formatAmountInIndianWords(grandTotal);

    return {
      subTotal,
      discount,
      grandTotal,
      gstTotal: gstInfo.gstTotal,
      cgst: gstInfo.cgst,
      sgst: gstInfo.sgst,
      amountInWords,
    };
  }

  /**
   * Saves bill atomically: creates bill record, deducts batch stock, and writes stock movements
   */
  async saveBill(input: SaveBillInput): Promise<BillRecord> {
    // 1. Client-side field validations
    if (!input.customerName || !input.customerName.trim()) {
      throw new Error("Customer name cannot be empty");
    }

    if (!input.customerMobile || !input.customerMobile.trim()) {
      throw new Error("Mobile number is required");
    }

    if (!isValidIndianMobile(input.customerMobile)) {
      throw new Error("Enter a valid 10-digit Indian mobile number");
    }

    if (!input.items || input.items.length === 0) {
      throw new Error("Bill must contain at least one medicine item");
    }

    for (const item of input.items) {
      if (item.quantity < 1 || !Number.isInteger(item.quantity)) {
        throw new Error(`Quantity for '${item.medicineName}' must be a whole number of at least 1`);
      }
      if (input.discountMode === "DISCOUNTED") {
        if (item.rate < 0) {
          throw new Error(`Rate cannot be negative for '${item.medicineName}'`);
        }
        if (item.rate > item.mrp) {
          throw new Error(`Rate cannot exceed MRP for '${item.medicineName}'`);
        }
      }
    }

    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const saved = await invoke<BillRecord>("save_bill", { bill: input });
        if (saved) return saved;
      } catch (err: any) {
        // Propagate Tauri backend error message directly
        let msg = typeof err === "string" ? err : err?.message || JSON.stringify(err);
        try {
          const parsed = JSON.parse(msg);
          if (parsed.message) msg = parsed.message;
        } catch {}
        throw new Error(msg);
      }
    }

    // Local fallback implementation
    const store = await storeService.getStoreDetails();
    const billNumber = await this.getNextBillNumberPreview();
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const totals = this.calculateTotals(
      input.items.map((i, idx) => ({ ...i, id: String(idx), availableStock: 999 })),
      input.discountMode
    );

    const billRecord: BillRecord = {
      id: Date.now(),
      billNumber,
      customerName: input.customerName.trim(),
      customerMobile: input.customerMobile.trim().replace(/\D/g, ""),
      doctorName: input.doctorName?.trim() || null,
      billDate: todayStr,
      discountMode: input.discountMode,
      paymentMode: input.paymentMode,
      subTotal: totals.subTotal,
      discount: totals.discount,
      gstTotal: totals.gstTotal,
      cgst: totals.cgst,
      sgst: totals.sgst,
      grandTotal: totals.grandTotal,
      amountInWords: totals.amountInWords,
      storeSnapshot: {
        storeName: store?.storeName || "",
        address: store?.address || null,
        phone: store?.phone || null,
        email: store?.email || null,
        gstin: store?.gstin || null,
        drugLicense1: store?.drugLicense1 || null,
        drugLicense2: store?.drugLicense2 || null,
        footerTerms: store?.footerTerms || null,
        showGstin: store?.showGstinOnInvoice ?? true,
        showAmountInWords: store?.showAmountInWords ?? true,
        logoPath: store?.logoPath || null,
        logoDataUrl: store?.logoDataUrl || null,
        tagline: (store as any)?.tagline || null,
      },
      items: input.items.map((it, idx) => ({
        id: Date.now() + idx,
        medicineId: it.medicineId,
        batchId: it.batchId,
        medicineName: it.medicineName,
        batchNumber: it.batchNumber,
        expDate: it.expDate,
        unit: it.unit,
        quantity: it.quantity,
        costPrice: it.costPrice,
        mrp: it.mrp,
        sellingPrice: it.sellingPrice,
        rate: input.discountMode === "NON_DISCOUNT" ? it.mrp : it.rate,
        amount: Number(((input.discountMode === "NON_DISCOUNT" ? it.mrp : it.rate) * it.quantity).toFixed(2)),
      })),
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
    };

    // Deduct stock in local medicine store
    for (const item of input.items) {
      await medicineService.adjustStock({
        medicineId: item.medicineId,
        batchId: item.batchId,
        adjustmentType: "REDUCE",
        quantity: item.quantity,
        reason: `Counter Sale (${billNumber})`,
      });
    }

    const allBills = getLocalBills();
    allBills.push(billRecord);
    saveLocalBills(allBills);

    return billRecord;
  }

  /**
   * Retrieves paginated bills matching filter options with summary KPIs
   */
  async getBills(filter: BillFilterInput = {}): Promise<PaginatedBillsResult> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res = await invoke<PaginatedBillsResult>("get_bills", { filter });
        if (res && Array.isArray(res.bills)) return res;
      } catch (err) {
        console.warn("Tauri get_bills fallback:", err);
      }
    }

    // LocalStorage fallback for web preview and testing
    const allBills = getLocalBills();
    let filtered = [...allBills];

    // Filter by date range (inclusive: fromDate <= billDate <= toDate)
    if (filter.fromDate) {
      const from = filter.fromDate.trim();
      if (from) {
        filtered = filtered.filter((b) => b.billDate.slice(0, 10) >= from);
      }
    }
    if (filter.toDate) {
      const to = filter.toDate.trim();
      if (to) {
        filtered = filtered.filter((b) => b.billDate.slice(0, 10) <= to);
      }
    }

    // Filter by search (billNumber, customerName, customerMobile, doctorName)
    if (filter.search) {
      const term = filter.search.trim().toLowerCase();
      if (term) {
        filtered = filtered.filter((b) => {
          const matchBill = b.billNumber.toLowerCase().includes(term);
          const matchCust = b.customerName.toLowerCase().includes(term);
          const matchMob = b.customerMobile.includes(term);
          const matchDoc = b.doctorName ? b.doctorName.toLowerCase().includes(term) : false;
          return matchBill || matchCust || matchMob || matchDoc;
        });
      }
    }

    // Filter by payment mode
    if (filter.paymentMode && filter.paymentMode.toUpperCase() !== "ALL") {
      const mode = filter.paymentMode.toUpperCase();
      filtered = filtered.filter((b) => b.paymentMode.toUpperCase() === mode);
    }

    // Filter by discount mode
    if (filter.discountMode && filter.discountMode.toUpperCase() !== "ALL") {
      const dm = filter.discountMode.toUpperCase();
      if (dm === "DISCOUNTED") {
        filtered = filtered.filter((b) => b.discountMode === "DISCOUNTED" || b.discount > 0);
      } else if (dm === "NON_DISCOUNT") {
        filtered = filtered.filter((b) => b.discountMode === "NON_DISCOUNT" && (!b.discount || b.discount <= 0));
      }
    }

    // Compute Summary KPIs on filtered set
    const totalBills = filtered.length;
    let totalSales = 0;
    let totalDiscount = 0;
    let cashSales = 0;
    let upiSales = 0;
    let cardSales = 0;

    for (const b of filtered) {
      totalSales += b.grandTotal || 0;
      totalDiscount += b.discount || 0;
      const pm = (b.paymentMode || "").toUpperCase();
      if (pm === "CASH") cashSales += b.grandTotal || 0;
      else if (pm === "UPI") upiSales += b.grandTotal || 0;
      else if (pm === "CARD") cardSales += b.grandTotal || 0;
    }

    const summary: BillHistorySummary = {
      totalBills,
      totalSales: Number(totalSales.toFixed(2)),
      totalDiscount: Number(totalDiscount.toFixed(2)),
      cashSales: Number(cashSales.toFixed(2)),
      upiSales: Number(upiSales.toFixed(2)),
      cardSales: Number(cardSales.toFixed(2)),
    };

    // Sort
    const sortBy = filter.sortBy || "date";
    const sortOrder = filter.sortOrder || "desc";
    const mult = sortOrder === "asc" ? 1 : -1;

    filtered.sort((a, b) => {
      if (sortBy === "bill_number") {
        return mult * a.billNumber.localeCompare(b.billNumber);
      }
      if (sortBy === "grand_total") {
        return mult * (a.grandTotal - b.grandTotal);
      }
      if (sortBy === "customer_name") {
        return mult * a.customerName.localeCompare(b.customerName);
      }
      // default: date desc
      const dateDiff = a.billDate.localeCompare(b.billDate);
      if (dateDiff !== 0) return mult * dateDiff;
      return mult * (a.id - b.id);
    });

    // Pagination
    const page = Math.max(1, filter.page || 1);
    const pageSize = Math.max(1, filter.pageSize || 10);
    const offset = (page - 1) * pageSize;
    const paginated = filtered.slice(offset, offset + pageSize);

    return {
      bills: paginated,
      totalCount: totalBills,
      page,
      pageSize,
      summary,
    };
  }

  /**
   * Retrieves a single bill record by ID
   */
  async getBillById(id: number): Promise<BillRecord | null> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const bill = await invoke<BillRecord | null>("get_bill_by_id", { id });
        if (bill) return bill;
      } catch (err) {
        console.warn("Tauri get_bill_by_id fallback:", err);
      }
    }

    const allBills = getLocalBills();
    return allBills.find((b) => b.id === id) || null;
  }
}

export const billingService = new BillingService();
