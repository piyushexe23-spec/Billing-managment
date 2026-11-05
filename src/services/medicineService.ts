/**
 * Medicine & Inventory Service Layer
 * IM MEDICOS Pharmacy Billing Desktop Application
 */

import {
  Medicine,
  MedicineBatch,
  StockMovement,
  MedicineWithBatches,
  MedicineListItem,
  InventorySummaryMetrics,
  CreateMedicineInput,
  AddBatchInput,
  AddNewBatchInput,
  UpdateMedicineInput,
  UpdateBatchInput,
  StockAdjustmentInput,
  BulkImportRow,
  BulkImportResult,
  StockStatus,
  ExpiryStatus,
} from "@/types/medicine";
import * as XLSX from "xlsx";

const MEDICINES_STORAGE_KEY = "im_medicos_medicines_v1";
const BATCHES_STORAGE_KEY = "im_medicos_batches_v1";
const MOVEMENTS_STORAGE_KEY = "im_medicos_stock_movements_v1";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Returns YYYY-MM-DD for today in local timezone
 */
export function getLocalTodayStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns YYYY-MM-DD for date + N days
 */
export function getOffsetDateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Determines expiry status based on strict 10 calendar days boundary
 */
export function calculateExpiryStatus(expDateStr: string | null | undefined): ExpiryStatus {
  if (!expDateStr) return "NO_BATCH";
  const today = getLocalTodayStr();
  const tenDaysLater = getOffsetDateStr(10);

  if (expDateStr < today) {
    return "EXPIRED";
  } else if (expDateStr <= tenDaysLater) {
    return "EXPIRING_SOON";
  } else {
    return "SAFE";
  }
}

/**
 * Determines stock status
 */
export function calculateStockStatus(
  availableStock: number,
  lowStockThreshold: number
): StockStatus {
  if (availableStock <= 0) return "OUT_OF_STOCK";
  if (availableStock <= lowStockThreshold) return "LOW_STOCK";
  return "IN_STOCK";
}

// ----------------------------------------------------------------------
// Helper functions for persistent local store mirror
// ----------------------------------------------------------------------
function getLocalMedicines(): Medicine[] {
  try {
    const raw = localStorage.getItem(MEDICINES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Strip out legacy hardcoded demo medicines if present
        const cleaned = parsed.filter(
          (m: Medicine) =>
            !["Dolo 650 Tablet", "Augmentin 625 Duo", "Azithral 500 Tablet", "Cetcip 10mg", "Pantocid 40mg Tablet"].includes(
              m.name
            )
        );
        if (cleaned.length !== parsed.length) {
          saveLocalMedicines(cleaned);
        }
        return cleaned;
      }
    }
  } catch {}
  return [];
}

function saveLocalMedicines(meds: Medicine[]): void {
  localStorage.setItem(MEDICINES_STORAGE_KEY, JSON.stringify(meds));
}

function getLocalBatches(): MedicineBatch[] {
  try {
    const raw = localStorage.getItem(BATCHES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(
          (b: MedicineBatch) =>
            ![
              "DL-650-A1",
              "DL-650-EXP",
              "AUG-24-99",
              "AZ-500-OOS",
              "CC-10-88",
              "PAN-EXP-01",
              "PAN-FRESH",
            ].includes(b.batchNumber)
        );
        if (cleaned.length !== parsed.length) {
          saveLocalBatches(cleaned);
        }
        return cleaned;
      }
    }
  } catch {}
  return [];
}

function saveLocalBatches(batches: MedicineBatch[]): void {
  localStorage.setItem(BATCHES_STORAGE_KEY, JSON.stringify(batches));
}

function getLocalMovements(): StockMovement[] {
  try {
    const raw = localStorage.getItem(MOVEMENTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(
          (m: StockMovement) =>
            !Boolean(
              m.medicineName &&
                ["Dolo 650 Tablet", "Augmentin 625 Duo", "Azithral 500 Tablet", "Cetcip 10mg", "Pantocid 40mg Tablet"].includes(
                  m.medicineName
                )
            )
        );
        if (cleaned.length !== parsed.length) {
          saveLocalMovements(cleaned);
        }
        return cleaned;
      }
    }
  } catch {}
  return [];
}

function saveLocalMovements(movs: StockMovement[]): void {
  localStorage.setItem(MOVEMENTS_STORAGE_KEY, JSON.stringify(movs));
}

// ----------------------------------------------------------------------
// Exported Helper to Parse Field-Specific Errors
// ----------------------------------------------------------------------
export function parseFieldError(err: any): { field?: string; message: string } {
  if (!err) return { message: "An unexpected error occurred." };
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const jsonMatch = raw.match(/\{[\s\S]*"field"[\s\S]*"message"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.field && parsed.message) {
        return { field: parsed.field, message: parsed.message };
      }
    }
  } catch {}
  return { message: raw };
}

// ----------------------------------------------------------------------
// Exported Medicine Service
// ----------------------------------------------------------------------
export const medicineService = {
  /**
   * Retrieves all medicines with their active batches and computed metrics
   * @param includeArchived If true, includes archived/soft-deleted medicines
   */
  async getMedicines(includeArchived: boolean = false): Promise<MedicineListItem[]> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const tauriMeds = await invoke<MedicineWithBatches[]>("get_medicines", { includeArchived });
        if (tauriMeds && Array.isArray(tauriMeds)) {
          return tauriMeds.map((m) => this.transformToListItem(m));
        }
      } catch (err) {
        console.warn("Tauri get_medicines invocation fallback:", err);
      }
    }

    const medicines = getLocalMedicines().filter((m) => (includeArchived ? true : m.isActive));
    const batches = getLocalBatches().filter((b) => b.isActive);

    return medicines.map((m) => {
      const medBatches = batches.filter((b) => b.medicineId === m.id);
      return this.transformToListItem({ ...m, batches: medBatches });
    });
  },

  /**
   * Transforms raw medicine and batches into aggregated list item with live computed statuses
   */
  transformToListItem(m: MedicineWithBatches): MedicineListItem {
    const activeBatches = (m.batches || []).filter((b) => b.isActive);
    const totalStock = activeBatches.reduce((acc, b) => acc + (b.stockQty || 0), 0);

    // Sort batches by expiry date ascending
    const sortedBatches = [...activeBatches].sort((a, b) =>
      a.expDate.localeCompare(b.expDate)
    );

    const nearestBatch = sortedBatches[0] || null;
    const nearestExpiryDate = nearestBatch ? nearestBatch.expDate : null;
    const nearestBatchNumber = nearestBatch ? nearestBatch.batchNumber : null;

    // Check worst-case expiry status across all active batches for this medicine
    let overallExpiryStatus: ExpiryStatus = "SAFE";
    if (activeBatches.length === 0) {
      overallExpiryStatus = "NO_BATCH";
    } else {
      const hasExpired = activeBatches.some((b) => calculateExpiryStatus(b.expDate) === "EXPIRED");
      const hasExpiringSoon = activeBatches.some(
        (b) => calculateExpiryStatus(b.expDate) === "EXPIRING_SOON"
      );
      if (hasExpired) overallExpiryStatus = "EXPIRED";
      else if (hasExpiringSoon) overallExpiryStatus = "EXPIRING_SOON";
    }

    const stockStatus = calculateStockStatus(totalStock, m.lowStockThreshold);

    const pricesCost = activeBatches.map((b) => b.costPrice).filter((p) => p !== undefined);
    const pricesMrp = activeBatches.map((b) => b.mrp).filter((p) => p !== undefined);
    const pricesSelling = activeBatches.map((b) => b.sellingPrice).filter((p) => p !== undefined);

    return {
      id: m.id,
      name: m.name,
      genericName: m.genericName,
      manufacturer: m.manufacturer,
      category: m.category,
      barcode: m.barcode,
      unit: m.unit || "Tablet",
      lowStockThreshold: m.lowStockThreshold || 10,
      totalStock,
      stockStatus,
      nearestExpiryDate,
      nearestBatchNumber,
      expiryStatus: overallExpiryStatus,
      minCostPrice: pricesCost.length > 0 ? Math.min(...pricesCost) : 0,
      maxCostPrice: pricesCost.length > 0 ? Math.max(...pricesCost) : 0,
      minMrp: pricesMrp.length > 0 ? Math.min(...pricesMrp) : 0,
      maxMrp: pricesMrp.length > 0 ? Math.max(...pricesMrp) : 0,
      minSellingPrice: pricesSelling.length > 0 ? Math.min(...pricesSelling) : 0,
      maxSellingPrice: pricesSelling.length > 0 ? Math.max(...pricesSelling) : 0,
      activeBatchesCount: activeBatches.length,
      isActive: m.isActive,
      batches: sortedBatches,
    };
  },

  /**
   * Retrieves full details for a single medicine with all batches
   */
  async getMedicineById(medicineId: number): Promise<MedicineWithBatches | null> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const med = await invoke<MedicineWithBatches | null>("get_medicine_by_id", {
          id: medicineId,
        });
        if (med) return med;
      } catch (err) {
        console.warn("Tauri get_medicine_by_id fallback:", err);
      }
    }

    const medicines = getLocalMedicines();
    const med = medicines.find((m) => m.id === medicineId);
    if (!med) return null;

    const batches = getLocalBatches().filter(
      (b) => b.medicineId === medicineId && b.isActive
    );
    return { ...med, batches };
  },

  /**
   * Checks whether a medicine with the same name and manufacturer already exists
   */
  async checkMedicineDuplicate(
    name: string,
    manufacturer?: string,
    excludeId?: number
  ): Promise<{ exists: boolean; existingId?: number; existingName?: string }> {
    const normName = name.trim().toLowerCase();
    const normMfr = (manufacturer || "").trim().toLowerCase();
    if (!normName) return { exists: false };

    const meds = await this.getMedicines(false);
    const found = meds.find((m) => {
      if (excludeId && m.id === excludeId) return false;
      const mName = m.name.trim().toLowerCase();
      const mMfr = (m.manufacturer || "").trim().toLowerCase();
      return mName === normName && mMfr === normMfr;
    });

    if (found) {
      return { exists: true, existingId: found.id, existingName: found.name };
    }
    return { exists: false };
  },

  /**
   * Checks whether a batch number already exists for a medicine
   */
  async checkBatchDuplicate(
    medicineId: number,
    batchNumber: string,
    excludeBatchId?: number
  ): Promise<{ exists: boolean }> {
    const normBatch = batchNumber.trim().toLowerCase();
    if (!normBatch) return { exists: false };

    const med = await this.getMedicineById(medicineId);
    if (!med) return { exists: false };

    const exists = med.batches.some(
      (b) => (!excludeBatchId || b.id !== excludeBatchId) && b.batchNumber.trim().toLowerCase() === normBatch
    );

    return { exists };
  },

  /**
   * Creates a new medicine and optional initial batch
   */
  async createMedicine(input: CreateMedicineInput): Promise<MedicineWithBatches> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      const newId = await invoke<number>("create_medicine", {
        name: input.name,
        genericName: input.genericName || null,
        manufacturer: input.manufacturer || null,
        category: input.category || null,
        description: input.description || null,
        barcode: input.barcode || null,
        hsnCode: input.hsnCode || null,
        unit: input.unit,
        lowStockThreshold: input.lowStockThreshold,
        initialBatch: input.initialBatch
          ? {
              id: 0,
              medicineId: 0,
              batchNumber: input.initialBatch.batchNumber,
              mfgDate: input.initialBatch.mfgDate || null,
              expDate: input.initialBatch.expDate,
              costPrice: input.initialBatch.costPrice,
              mrp: input.initialBatch.mrp,
              sellingPrice: input.initialBatch.sellingPrice,
              stockQty: input.initialBatch.stockQty,
              isActive: true,
            }
          : null,
      });
      const created = await this.getMedicineById(newId);
      if (created) return created;
    }

    // Local mirror implementation
    const medicines = getLocalMedicines();

    if (!input.name.trim()) {
      throw new Error(JSON.stringify({ field: "name", message: "Medicine name cannot be empty" }));
    }

    const normName = input.name.trim().toLowerCase();
    const normMfr = (input.manufacturer || "").trim().toLowerCase();
    const dup = medicines.find(
      (m) => m.isActive && m.name.trim().toLowerCase() === normName && (m.manufacturer || "").trim().toLowerCase() === normMfr
    );
    if (dup) {
      throw new Error(JSON.stringify({ field: "name", message: "This medicine already exists. Use Add New Batch on that medicine instead." }));
    }

    if (input.initialBatch) {
      const b = input.initialBatch;
      if (!b.batchNumber.trim()) {
        throw new Error(JSON.stringify({ field: "batchNumber", message: "Batch number cannot be empty" }));
      }
      if (!b.expDate.trim()) {
        throw new Error(JSON.stringify({ field: "expDate", message: "Expiry date is required" }));
      }
      if (b.mfgDate && b.expDate < b.mfgDate) {
        throw new Error(JSON.stringify({ field: "mfgDate", message: "Manufacturing date cannot be after expiry date" }));
      }
      if (b.stockQty < 1) {
        throw new Error(JSON.stringify({ field: "stockQty", message: "Quantity must be at least 1" }));
      }
      if (b.costPrice < 0) {
        throw new Error(JSON.stringify({ field: "costPrice", message: "Cost price cannot be negative" }));
      }
      if (b.mrp <= 0) {
        throw new Error(JSON.stringify({ field: "mrp", message: "MRP must be greater than 0" }));
      }
      if (b.sellingPrice < 0) {
        throw new Error(JSON.stringify({ field: "sellingPrice", message: "Selling price cannot be negative" }));
      }
    }

    const newId = medicines.length > 0 ? Math.max(...medicines.map((m) => m.id)) + 1 : 1;

    const newMedicine: Medicine = {
      id: newId,
      name: input.name.trim(),
      genericName: input.genericName?.trim() || null,
      manufacturer: input.manufacturer?.trim() || null,
      category: input.category?.trim() || null,
      description: input.description?.trim() || null,
      barcode: input.barcode?.trim() || null,
      hsnCode: input.hsnCode?.trim() || null,
      unit: input.unit || "Tablet",
      lowStockThreshold: input.lowStockThreshold ?? 10,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    medicines.push(newMedicine);
    saveLocalMedicines(medicines);

    const createdBatches: MedicineBatch[] = [];

    if (input.initialBatch) {
      const batches = getLocalBatches();
      const newBatchId = batches.length > 0 ? Math.max(...batches.map((b) => b.id)) + 1 : 1;
      const initialBatch: MedicineBatch = {
        id: newBatchId,
        medicineId: newId,
        batchNumber: input.initialBatch.batchNumber.trim(),
        mfgDate: input.initialBatch.mfgDate || null,
        expDate: input.initialBatch.expDate,
        costPrice: input.initialBatch.costPrice,
        mrp: input.initialBatch.mrp,
        sellingPrice: input.initialBatch.sellingPrice,
        stockQty: input.initialBatch.stockQty,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      batches.push(initialBatch);
      saveLocalBatches(batches);
      createdBatches.push(initialBatch);

      // Record opening stock movement
      const movements = getLocalMovements();
      const movementId = movements.length > 0 ? Math.max(...movements.map((m) => m.id)) + 1 : 1;
      movements.unshift({
        id: movementId,
        medicineId: newId,
        batchId: newBatchId,
        batchNumber: initialBatch.batchNumber,
        medicineName: newMedicine.name,
        movementType: "OPENING_STOCK",
        quantity: initialBatch.stockQty,
        previousQty: 0,
        newQty: initialBatch.stockQty,
        reason: "Initial batch opening stock",
        createdAt: new Date().toISOString(),
      });
      saveLocalMovements(movements);
    }

    return { ...newMedicine, batches: createdBatches };
  },

  /**
   * Updates an existing medicine master record
   */
  async updateMedicine(input: UpdateMedicineInput): Promise<Medicine> {
    if (!input.name.trim()) {
      throw new Error(JSON.stringify({ field: "name", message: "Medicine name cannot be empty" }));
    }
    if (input.lowStockThreshold < 0) {
      throw new Error(JSON.stringify({ field: "lowStockThreshold", message: "Low stock threshold cannot be negative" }));
    }

    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("update_medicine", {
        medicine: {
          id: input.id,
          name: input.name.trim(),
          genericName: input.genericName?.trim() || null,
          manufacturer: input.manufacturer?.trim() || null,
          category: input.category?.trim() || null,
          description: input.description?.trim() || null,
          barcode: input.barcode?.trim() || null,
          hsnCode: input.hsnCode?.trim() || null,
          unit: input.unit.trim(),
          lowStockThreshold: input.lowStockThreshold,
        },
      });
      const med = await this.getMedicineById(input.id);
      if (med) return med;
    }

    const medicines = getLocalMedicines();
    const normName = input.name.trim().toLowerCase();
    const normMfr = (input.manufacturer || "").trim().toLowerCase();
    const dup = medicines.find(
      (m) => m.id !== input.id && m.isActive && m.name.trim().toLowerCase() === normName && (m.manufacturer || "").trim().toLowerCase() === normMfr
    );
    if (dup) {
      throw new Error(JSON.stringify({ field: "name", message: "This medicine already exists. Use Add New Batch on that medicine instead." }));
    }

    const idx = medicines.findIndex((m) => m.id === input.id);
    if (idx === -1) {
      throw new Error("Medicine record not found.");
    }

    medicines[idx] = {
      ...medicines[idx],
      name: input.name.trim(),
      genericName: input.genericName?.trim() || null,
      manufacturer: input.manufacturer?.trim() || null,
      category: input.category?.trim() || null,
      description: input.description?.trim() || null,
      barcode: input.barcode?.trim() || null,
      hsnCode: input.hsnCode?.trim() || null,
      unit: input.unit.trim(),
      lowStockThreshold: input.lowStockThreshold,
      updatedAt: new Date().toISOString(),
    };
    saveLocalMedicines(medicines);
    return medicines[idx];
  },

  /**
   * Adds a new batch to an existing medicine or increments quantity of an existing batch
   * Supports duplicate batch detection and transactional stock movement recording
   */
  async addNewBatch(input: AddNewBatchInput): Promise<MedicineBatch> {
    if (!input.batchNumber.trim()) {
      throw new Error(JSON.stringify({ field: "batchNumber", message: "Batch number cannot be empty" }));
    }
    if (!input.expDate.trim()) {
      throw new Error(JSON.stringify({ field: "expDate", message: "Expiry date is required" }));
    }
    if (input.quantityReceived <= 0) {
      throw new Error(JSON.stringify({ field: "quantityReceived", message: "Quantity must be at least 1" }));
    }
    if (input.costPrice < 0) {
      throw new Error(JSON.stringify({ field: "costPrice", message: "Cost price cannot be negative" }));
    }
    if (input.mrp <= 0) {
      throw new Error(JSON.stringify({ field: "mrp", message: "MRP must be greater than 0" }));
    }
    if (input.sellingPrice < 0) {
      throw new Error(JSON.stringify({ field: "sellingPrice", message: "Selling price cannot be negative" }));
    }
    if (input.mfgDate && input.expDate < input.mfgDate) {
      throw new Error(JSON.stringify({ field: "mfgDate", message: "Manufacturing date cannot be after expiry date" }));
    }

    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      const batchId = await invoke<number>("add_medicine_batch", {
        medicineId: input.medicineId,
        batchNumber: input.batchNumber.trim().toUpperCase(),
        mfgDate: input.mfgDate || null,
        expDate: input.expDate,
        costPrice: input.costPrice,
        mrp: input.mrp,
        sellingPrice: input.sellingPrice,
        quantityReceived: input.quantityReceived,
        note: input.note || null,
        addToExisting: input.addToExisting || false,
      });
      const med = await this.getMedicineById(input.medicineId);
      const batch = med?.batches.find((b) => b.id === batchId);
      if (batch) return batch;
    }

    const batches = getLocalBatches();
    const existing = batches.find(
      (b) =>
        b.medicineId === input.medicineId &&
        b.isActive &&
        b.batchNumber.toLowerCase() === input.batchNumber.trim().toLowerCase()
    );

    if (existing && !input.addToExisting) {
      throw new Error(JSON.stringify({ field: "batchNumber", message: "This batch number already exists for this medicine." }));
    }

    const medicines = getLocalMedicines();
    const med = medicines.find((m) => m.id === input.medicineId);
    const movements = getLocalMovements();
    const movementId = movements.length > 0 ? Math.max(...movements.map((m) => m.id)) + 1 : 1;

    if (existing && input.addToExisting) {
      const prevQty = existing.stockQty;
      const newQty = prevQty + input.quantityReceived;
      existing.stockQty = newQty;
      existing.costPrice = input.costPrice;
      existing.mrp = input.mrp;
      existing.sellingPrice = input.sellingPrice;
      existing.expDate = input.expDate;
      if (input.mfgDate) existing.mfgDate = input.mfgDate;
      existing.updatedAt = new Date().toISOString();
      saveLocalBatches(batches);

      movements.unshift({
        id: movementId,
        medicineId: input.medicineId,
        batchId: existing.id,
        batchNumber: existing.batchNumber,
        medicineName: med?.name || "Unknown Medicine",
        movementType: "PURCHASE",
        quantity: input.quantityReceived,
        previousQty: prevQty,
        newQty,
        reason: input.note?.trim() || "Purchase / New Batch received",
        createdAt: new Date().toISOString(),
      });
      saveLocalMovements(movements);
      return existing;
    } else {
      const newBatchId = batches.length > 0 ? Math.max(...batches.map((b) => b.id)) + 1 : 1;
      const newBatch: MedicineBatch = {
        id: newBatchId,
        medicineId: input.medicineId,
        batchNumber: input.batchNumber.trim().toUpperCase(),
        mfgDate: input.mfgDate || null,
        expDate: input.expDate,
        costPrice: input.costPrice,
        mrp: input.mrp,
        sellingPrice: input.sellingPrice,
        stockQty: input.quantityReceived,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      batches.push(newBatch);
      saveLocalBatches(batches);

      movements.unshift({
        id: movementId,
        medicineId: input.medicineId,
        batchId: newBatchId,
        batchNumber: newBatch.batchNumber,
        medicineName: med?.name || "Unknown Medicine",
        movementType: "PURCHASE",
        quantity: input.quantityReceived,
        previousQty: 0,
        newQty: input.quantityReceived,
        reason: input.note?.trim() || "Purchase / New Batch received",
        createdAt: new Date().toISOString(),
      });
      saveLocalMovements(movements);
      return newBatch;
    }
  },

  /**
   * Updates batch details (batch number, dates, prices)
   */
  async updateBatch(input: UpdateBatchInput): Promise<void> {
    if (!input.batchNumber.trim()) {
      throw new Error(JSON.stringify({ field: "batchNumber", message: "Batch number cannot be empty" }));
    }
    if (!input.expDate.trim()) {
      throw new Error(JSON.stringify({ field: "expDate", message: "Expiry date is required" }));
    }
    if (input.costPrice < 0) {
      throw new Error(JSON.stringify({ field: "costPrice", message: "Cost price cannot be negative" }));
    }
    if (input.mrp <= 0) {
      throw new Error(JSON.stringify({ field: "mrp", message: "MRP must be greater than 0" }));
    }
    if (input.sellingPrice < 0) {
      throw new Error(JSON.stringify({ field: "sellingPrice", message: "Selling price cannot be negative" }));
    }
    if (input.mfgDate && input.expDate < input.mfgDate) {
      throw new Error(JSON.stringify({ field: "mfgDate", message: "Manufacturing date cannot be after expiry date" }));
    }

    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("update_batch", {
        batchId: input.id,
        batchNumber: input.batchNumber.trim().toUpperCase(),
        mfgDate: input.mfgDate || null,
        expDate: input.expDate,
        costPrice: input.costPrice,
        mrp: input.mrp,
        sellingPrice: input.sellingPrice,
      });
      return;
    }

    const batches = getLocalBatches();
    const current = batches.find((b) => b.id === input.id);
    if (current) {
      const normBatch = input.batchNumber.trim().toLowerCase();
      const dup = batches.find(
        (b) => b.medicineId === current.medicineId && b.id !== input.id && b.isActive && b.batchNumber.trim().toLowerCase() === normBatch
      );
      if (dup) {
        throw new Error(JSON.stringify({ field: "batchNumber", message: "This batch number already exists for this medicine." }));
      }
    }

    const idx = batches.findIndex((b) => b.id === input.id);
    if (idx !== -1) {
      batches[idx] = {
        ...batches[idx],
        batchNumber: input.batchNumber.trim().toUpperCase(),
        mfgDate: input.mfgDate || null,
        expDate: input.expDate,
        costPrice: input.costPrice,
        mrp: input.mrp,
        sellingPrice: input.sellingPrice,
        updatedAt: new Date().toISOString(),
      };
      saveLocalBatches(batches);
    }
  },

  /**
   * Adds a new batch to an existing medicine
   */
  async addBatch(input: AddBatchInput): Promise<MedicineBatch> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const batchId = await invoke<number>("add_medicine_batch", {
          medicineId: input.medicineId,
          batch: {
            id: 0,
            medicineId: input.medicineId,
            batchNumber: input.batchNumber,
            mfgDate: input.mfgDate || null,
            expDate: input.expDate,
            costPrice: input.costPrice,
            mrp: input.mrp,
            sellingPrice: input.sellingPrice,
            stockQty: input.stockQty,
            isActive: true,
          },
        });
        const med = await this.getMedicineById(input.medicineId);
        const batch = med?.batches.find((b) => b.id === batchId);
        if (batch) return batch;
      } catch (err) {
        console.warn("Tauri add_medicine_batch fallback:", err);
      }
    }

    const batches = getLocalBatches();
    const newBatchId = batches.length > 0 ? Math.max(...batches.map((b) => b.id)) + 1 : 1;

    const newBatch: MedicineBatch = {
      id: newBatchId,
      medicineId: input.medicineId,
      batchNumber: input.batchNumber.trim(),
      mfgDate: input.mfgDate || null,
      expDate: input.expDate,
      costPrice: input.costPrice,
      mrp: input.mrp,
      sellingPrice: input.sellingPrice,
      stockQty: input.stockQty,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    batches.push(newBatch);
    saveLocalBatches(batches);

    // Record stock movement
    const movements = getLocalMovements();
    const medicines = getLocalMedicines();
    const med = medicines.find((m) => m.id === input.medicineId);
    const movementId = movements.length > 0 ? Math.max(...movements.map((m) => m.id)) + 1 : 1;

    movements.unshift({
      id: movementId,
      medicineId: input.medicineId,
      batchId: newBatchId,
      batchNumber: newBatch.batchNumber,
      medicineName: med?.name || "Unknown Medicine",
      movementType: "PURCHASE",
      quantity: newBatch.stockQty,
      previousQty: 0,
      newQty: newBatch.stockQty,
      reason: "New batch received into inventory",
      createdAt: new Date().toISOString(),
    });
    saveLocalMovements(movements);

    return newBatch;
  },

  /**
   * Adjusts stock quantity for a specific batch and records audit history
   */
  async adjustStock(input: StockAdjustmentInput): Promise<void> {
    if (input.quantity <= 0) {
      throw new Error("Adjustment quantity must be greater than zero.");
    }

    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("adjust_stock", {
          medicineId: input.medicineId,
          batchId: input.batchId,
          adjustmentType: input.adjustmentType,
          quantity: input.quantity,
          reason: input.reason,
        });
        return;
      } catch (err) {
        console.warn("Tauri adjust_stock fallback:", err);
      }
    }

    const batches = getLocalBatches();
    const batchIndex = batches.findIndex(
      (b) => b.id === input.batchId && b.medicineId === input.medicineId
    );
    if (batchIndex === -1) {
      throw new Error("Specified medicine batch not found.");
    }

    const batch = batches[batchIndex];
    const prevQty = batch.stockQty;

    let newQty = prevQty;
    if (input.adjustmentType === "ADD") {
      newQty = prevQty + input.quantity;
    } else {
      if (prevQty < input.quantity) {
        throw new Error(
          `Cannot reduce stock by ${input.quantity}. Current available stock is ${prevQty}.`
        );
      }
      newQty = prevQty - input.quantity;
    }

    batch.stockQty = newQty;
    batch.updatedAt = new Date().toISOString();
    saveLocalBatches(batches);

    // Record movement in audit trail
    const medicines = getLocalMedicines();
    const med = medicines.find((m) => m.id === input.medicineId);
    const movements = getLocalMovements();
    const movementId = movements.length > 0 ? Math.max(...movements.map((m) => m.id)) + 1 : 1;

    movements.unshift({
      id: movementId,
      medicineId: input.medicineId,
      batchId: input.batchId,
      batchNumber: batch.batchNumber,
      medicineName: med?.name || "Unknown Medicine",
      movementType: input.adjustmentType === "ADD" ? "ADJUSTMENT_ADD" : "ADJUSTMENT_REDUCE",
      quantity: input.quantity,
      previousQty: prevQty,
      newQty,
      reason: input.reason.trim() || "Manual physical stock adjustment",
      createdAt: new Date().toISOString(),
    });
    saveLocalMovements(movements);
  },

  /**
   * Soft-deletes / archives a medicine so it cannot be selected in future billing
   */
  async archiveMedicine(medicineId: number): Promise<void> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("archive_medicine", { medicineId });
        return;
      } catch (err) {
        console.warn("Tauri archive_medicine fallback:", err);
      }
    }

    const medicines = getLocalMedicines();
    const med = medicines.find((m) => m.id === medicineId);
    if (med) {
      med.isActive = false;
      med.updatedAt = new Date().toISOString();
      saveLocalMedicines(medicines);
    }
  },

  /**
   * Restores an archived medicine record to active status
   */
  async restoreMedicine(medicineId: number): Promise<void> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("restore_medicine", { medicineId });
        return;
      } catch (err) {
        console.warn("Tauri restore_medicine fallback:", err);
      }
    }

    const medicines = getLocalMedicines();
    const med = medicines.find((m) => m.id === medicineId);
    if (med) {
      med.isActive = true;
      med.updatedAt = new Date().toISOString();
      saveLocalMedicines(medicines);
    }
  },

  /**
   * Evaluates if a medicine can be permanently deleted
   * Rule: Permanent Delete is allowed only if the medicine has no stock movements, batches with stock, or transactions.
   */
  async canDeleteMedicine(
    medicineId: number
  ): Promise<{ canDelete: boolean; reason: string }> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const [canDelete, reason] = await invoke<[boolean, string]>("can_delete_medicine", {
          medicineId,
        });
        return { canDelete, reason };
      } catch (err) {
        console.warn("Tauri can_delete_medicine fallback:", err);
      }
    }

    const movements = getLocalMovements().filter((m) => m.medicineId === medicineId);
    const batches = getLocalBatches().filter((b) => b.medicineId === medicineId);
    const totalStock = batches.reduce((acc, b) => acc + (b.stockQty || 0), 0);

    if (movements.length > 0 || totalStock > 0) {
      return {
        canDelete: false,
        reason: `This medicine has recorded history (${totalStock} stock units across batches, ${movements.length} audit movement records). To preserve regulatory and audit history, it cannot be permanently deleted. Please use Archive instead.`,
      };
    }

    return {
      canDelete: true,
      reason: "Medicine has no stock or audit history and can be safely deleted.",
    };
  },

  /**
   * Permanently deletes a medicine with no historical movements or stock
   */
  async deleteMedicine(medicineId: number): Promise<void> {
    const check = await this.canDeleteMedicine(medicineId);
    if (!check.canDelete) {
      throw new Error(check.reason);
    }

    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("delete_medicine", { medicineId });
        return;
      } catch (err) {
        console.warn("Tauri delete_medicine fallback:", err);
      }
    }

    const medicines = getLocalMedicines().filter((m) => m.id !== medicineId);
    saveLocalMedicines(medicines);
    const batches = getLocalBatches().filter((b) => b.medicineId !== medicineId);
    saveLocalBatches(batches);
  },

  /**
   * Retrieves stock movement audit trail for a medicine
   */
  async getStockMovements(medicineId: number): Promise<StockMovement[]> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const movs = await invoke<StockMovement[]>("get_stock_movements", { medicineId });
        if (movs && Array.isArray(movs)) return movs;
      } catch (err) {
        console.warn("Tauri get_stock_movements fallback:", err);
      }
    }

    return getLocalMovements().filter((m) => m.medicineId === medicineId);
  },

  /**
   * Computes the 4 live inventory summary cards directly from active records
   */
  async getInventorySummary(): Promise<InventorySummaryMetrics> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const summary = await invoke<InventorySummaryMetrics>("get_inventory_summary");
        if (summary) return summary;
      } catch (err) {
        console.warn("Tauri get_inventory_summary fallback:", err);
      }
    }

    const medicines = getLocalMedicines().filter((m) => m.isActive);
    const batches = getLocalBatches().filter((b) => b.isActive);

    const totalMedicines = medicines.length;
    let totalStockUnits = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;

    for (const m of medicines) {
      const medBatches = batches.filter((b) => b.medicineId === m.id);
      const stock = medBatches.reduce((acc, b) => acc + (b.stockQty || 0), 0);
      totalStockUnits += stock;

      if (stock === 0) {
        outOfStockCount++;
      } else if (stock <= m.lowStockThreshold) {
        lowStockCount++;
      }
    }

    // Check all active batches for expiry within 10 days or already expired
    for (const b of batches) {
      // Find parent medicine
      const parentMed = medicines.find((m) => m.id === b.medicineId);
      if (!parentMed) continue;

      const status = calculateExpiryStatus(b.expDate);
      if (status === "EXPIRED") {
        expiredCount++;
      } else if (status === "EXPIRING_SOON") {
        expiringSoonCount++;
      }
    }

    const needsRestockCount = lowStockCount + outOfStockCount;

    // Real top selling medicines derived from saved bills in storage fallback
    let medicinesWithSales = 0;
    const topSellingMedicines: InventorySummaryMetrics["topSellingMedicines"] = [];

    try {
      const rawBills = localStorage.getItem("im_medicos_bills");
      if (rawBills) {
        const bills = JSON.parse(rawBills);
        if (Array.isArray(bills)) {
          const medSalesMap = new Map<number, { id: number; name: string; qty: number; amount: number }>();
          for (const bill of bills) {
            if (Array.isArray(bill.items)) {
              for (const item of bill.items) {
                const medId = item.medicineId || 0;
                const existing = medSalesMap.get(medId) || {
                  id: medId,
                  name: item.medicineName,
                  qty: 0,
                  amount: 0,
                };
                existing.qty += Number(item.quantity) || 0;
                existing.amount += Number(item.amount) || 0;
                medSalesMap.set(medId, existing);
              }
            }
          }
          medicinesWithSales = medSalesMap.size;
          const sorted = Array.from(medSalesMap.values()).sort(
            (a, b) => b.qty - a.qty || b.amount - a.amount
          );
          for (const item of sorted.slice(0, 5)) {
            topSellingMedicines.push({
              medicineId: item.id,
              medicineName: item.name,
              totalQuantitySold: item.qty,
              totalSalesAmount: Math.round(item.amount * 100) / 100,
            });
          }
        }
      }
    } catch {
      // Ignore
    }

    return {
      totalMedicines,
      totalStockUnits,
      medicinesWithSales,
      topSellingMedicines,
      lowStockCount,
      outOfStockCount,
      needsRestockCount,
      expiringSoonCount,
      expiredCount,
    };
  },

  /**
   * Future billing compatibility: Retrieves saleable batches sorted by FEFO (First Expiry, First Out)
   * Expired batches are excluded automatically from saleable stock!
   */
  async getSaleableBatches(medicineId: number): Promise<MedicineBatch[]> {
    const med = await this.getMedicineById(medicineId);
    if (!med || !med.isActive) return [];

    const today = getLocalTodayStr();
    return (med.batches || [])
      .filter((b) => b.isActive && b.stockQty > 0 && b.expDate >= today)
      .sort((a, b) => a.expDate.localeCompare(b.expDate));
  },

  // --------------------------------------------------------------------
  // Bulk Import & Export Capabilities
  // --------------------------------------------------------------------

  /**
   * Generates and downloads a sample template (CSV or Excel)
   */
  downloadSampleTemplate(format: "csv" | "xlsx"): void {
    const sampleData = [
      {
        "Medicine Name": "Amoxicillin 500mg",
        "Manufacturer": "Cipla Ltd",
        "Generic Name": "Amoxicillin",
        "Category": "Antibiotics",
        "Barcode": "8901234567801",
        "Batch Number": "AMX-500-1",
        "Manufacturing Date": "2025-01-01",
        "Expiry Date": getOffsetDateStr(365),
        "Purchase Price": 45.0,
        "MRP": 72.0,
        "Selling Price": 65.0,
        "Quantity": 100,
        "Unit": "Strip",
        "Low Stock Threshold": 15,
      },
      {
        "Medicine Name": "Cetirizine 10mg",
        "Manufacturer": "Sun Pharma",
        "Generic Name": "Cetirizine",
        "Category": "Antihistamine",
        "Barcode": "8901234567802",
        "Batch Number": "CTZ-10-A",
        "Manufacturing Date": "2025-02-01",
        "Expiry Date": getOffsetDateStr(450),
        "Purchase Price": 12.0,
        "MRP": 22.0,
        "Selling Price": 20.0,
        "Quantity": 80,
        "Unit": "Strip",
        "Low Stock Threshold": 20,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Medicines");

    const filename = `IM_MEDICOS_Medicine_Import_Template.${format}`;
    XLSX.writeFile(workbook, filename, {
      bookType: format === "xlsx" ? "xlsx" : "csv",
    });
  },

  /**
   * Parses an uploaded CSV or XLSX file and validates every row
   */
  async parseImportFile(file: File): Promise<BulkImportRow[]> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    const existingMedicines = getLocalMedicines();
    const existingBatches = getLocalBatches();

    const parsedRows: BulkImportRow[] = [];

    rawRows.forEach((row, idx) => {
      const rowNumber = idx + 2; // Accounting for 1-based index + header
      const errors: string[] = [];

      // Flexible column key matching
      const getName = (k: string) =>
        String(
          row[k] ||
            row[k.toLowerCase()] ||
            row[k.replace(/\s+/g, "")] ||
            ""
        ).trim();

      const name = getName("Medicine Name") || getName("Name");
      const manufacturer = getName("Manufacturer") || getName("Company");
      const genericName = getName("Generic Name") || getName("Generic");
      const category = getName("Category");
      const barcode = getName("Barcode");
      const batchNumber = getName("Batch Number") || getName("Batch");
      const mfgDate = getName("Manufacturing Date") || getName("Mfg Date");
      const expDate = getName("Expiry Date") || getName("Exp Date");
      const unit = getName("Unit") || "Tablet";

      const costPrice = parseFloat(String(row["Purchase Price"] || row["Cost Price"] || 0));
      const mrp = parseFloat(String(row["MRP"] || 0));
      const sellingPrice = parseFloat(String(row["Selling Price"] || mrp || 0));
      const quantity = parseInt(String(row["Quantity"] || row["Stock"] || 0), 10);
      const lowStockThreshold = parseInt(String(row["Low Stock Threshold"] || 10), 10);

      // Validation
      if (!name) errors.push("Medicine Name is required");
      if (!batchNumber) errors.push("Batch Number is required");
      if (!expDate) errors.push("Expiry Date is required");
      if (isNaN(costPrice) || costPrice < 0) errors.push("Valid Purchase Price is required");
      if (isNaN(mrp) || mrp < 0) errors.push("Valid MRP is required");
      if (isNaN(sellingPrice) || sellingPrice < 0) errors.push("Valid Selling Price is required");
      if (isNaN(quantity) || quantity < 0) errors.push("Valid non-negative Quantity is required");

      // Check duplicates against existing database
      const existingMed = existingMedicines.find(
        (m) =>
          m.isActive &&
          (m.name.toLowerCase() === name.toLowerCase() || (barcode && m.barcode === barcode))
      );
      const isDuplicateMedicine = !!existingMed;

      let isDuplicateBatch = false;
      if (existingMed) {
        isDuplicateBatch = existingBatches.some(
          (b) =>
            b.isActive &&
            b.medicineId === existingMed.id &&
            b.batchNumber.toLowerCase() === batchNumber.toLowerCase()
        );
      }

      parsedRows.push({
        rowNumber,
        name,
        genericName: genericName || undefined,
        manufacturer: manufacturer || undefined,
        category: category || undefined,
        barcode: barcode || undefined,
        batchNumber,
        mfgDate: mfgDate || undefined,
        expDate,
        costPrice: isNaN(costPrice) ? 0 : costPrice,
        mrp: isNaN(mrp) ? 0 : mrp,
        sellingPrice: isNaN(sellingPrice) ? 0 : sellingPrice,
        quantity: isNaN(quantity) ? 0 : quantity,
        unit,
        lowStockThreshold: isNaN(lowStockThreshold) ? 10 : lowStockThreshold,
        isValid: errors.length === 0,
        errors,
        isDuplicateMedicine,
        isDuplicateBatch,
      });
    });

    return parsedRows;
  },

  /**
   * Executes transactional bulk import of parsed rows
   */
  async executeBulkImport(
    rows: BulkImportRow[],
    duplicateStrategy: "SKIP" | "UPDATE"
  ): Promise<BulkImportResult> {
    const validRows = rows.filter((r) => r.isValid);
    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const errors: Array<{ rowNumber: number; message: string }> = [];

    // Group valid rows by Medicine Name so multiple batches import under 1 medicine
    const medicineGroups = new Map<string, BulkImportRow[]>();
    for (const r of validRows) {
      const key = r.name.toLowerCase();
      const existing = medicineGroups.get(key) || [];
      existing.push(r);
      medicineGroups.set(key, existing);
    }

    const medicines = getLocalMedicines();
    const batches = getLocalBatches();
    const movements = getLocalMovements();

    for (const [, groupRows] of medicineGroups) {
      try {
        const first = groupRows[0];
        let targetMed = medicines.find(
          (m) =>
            m.isActive &&
            (m.name.toLowerCase() === first.name.toLowerCase() ||
              (first.barcode && m.barcode === first.barcode))
        );

        if (!targetMed) {
          const newMedId = medicines.length > 0 ? Math.max(...medicines.map((m) => m.id)) + 1 : 1;
          targetMed = {
            id: newMedId,
            name: first.name,
            genericName: first.genericName || null,
            manufacturer: first.manufacturer || null,
            category: first.category || null,
            barcode: first.barcode || null,
            unit: first.unit || "Tablet",
            lowStockThreshold: first.lowStockThreshold || 10,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          medicines.push(targetMed);
        }

        // Process each batch in the group
        for (const row of groupRows) {
          const existingBatch = batches.find(
            (b) =>
              b.isActive &&
              b.medicineId === targetMed!.id &&
              b.batchNumber.toLowerCase() === row.batchNumber.toLowerCase()
          );

          if (existingBatch) {
            if (duplicateStrategy === "SKIP") {
              skippedCount++;
              continue;
            } else {
              // UPDATE: Add to existing batch quantity
              const prev = existingBatch.stockQty;
              existingBatch.stockQty += row.quantity;
              existingBatch.mrp = row.mrp;
              existingBatch.sellingPrice = row.sellingPrice;
              existingBatch.costPrice = row.costPrice;
              existingBatch.updatedAt = new Date().toISOString();

              const movementId = movements.length > 0 ? Math.max(...movements.map((m) => m.id)) + 1 : 1;
              movements.unshift({
                id: movementId,
                medicineId: targetMed!.id,
                batchId: existingBatch.id,
                batchNumber: existingBatch.batchNumber,
                medicineName: targetMed!.name,
                movementType: "PURCHASE",
                quantity: row.quantity,
                previousQty: prev,
                newQty: existingBatch.stockQty,
                reason: "Bulk import stock update",
                createdAt: new Date().toISOString(),
              });
              successCount++;
            }
          } else {
            // INSERT NEW BATCH
            const newBatchId = batches.length > 0 ? Math.max(...batches.map((b) => b.id)) + 1 : 1;
            const newBatch: MedicineBatch = {
              id: newBatchId,
              medicineId: targetMed!.id,
              batchNumber: row.batchNumber,
              mfgDate: row.mfgDate || null,
              expDate: row.expDate,
              costPrice: row.costPrice,
              mrp: row.mrp,
              sellingPrice: row.sellingPrice,
              stockQty: row.quantity,
              isActive: true,
              createdAt: new Date().toISOString(),
            };
            batches.push(newBatch);

            const movementId = movements.length > 0 ? Math.max(...movements.map((m) => m.id)) + 1 : 1;
            movements.unshift({
              id: movementId,
              medicineId: targetMed!.id,
              batchId: newBatchId,
              batchNumber: newBatch.batchNumber,
              medicineName: targetMed!.name,
              movementType: "OPENING_STOCK",
              quantity: row.quantity,
              previousQty: 0,
              newQty: row.quantity,
              reason: "Bulk import batch registration",
              createdAt: new Date().toISOString(),
            });
            successCount++;
          }
        }
      } catch (err) {
        failedCount += groupRows.length;
        errors.push({
          rowNumber: groupRows[0].rowNumber,
          message: err instanceof Error ? err.message : "Import failed",
        });
      }
    }

    saveLocalMedicines(medicines);
    saveLocalBatches(batches);
    saveLocalMovements(movements);

    return {
      totalRows: rows.length,
      successCount,
      skippedCount,
      failedCount,
      errors,
    };
  },

  /**
   * Exports medicine inventory to CSV or Excel (.xlsx)
   */
  exportMedicines(
    items: MedicineListItem[],
    format: "csv" | "xlsx",
    filenamePrefix = "IM_MEDICOS_Medicine_Inventory"
  ): void {
    const exportRows: Array<Record<string, unknown>> = [];

    items.forEach((item) => {
      if (item.batches.length === 0) {
        exportRows.push({
          "Medicine Name": item.name,
          "Manufacturer": item.manufacturer || "-",
          "Generic Name": item.genericName || "-",
          "Category": item.category || "-",
          "Barcode": item.barcode || "-",
          "Unit": item.unit,
          "Batch Number": "-",
          "Expiry Date": "-",
          "Cost Price": 0.0,
          "MRP": 0.0,
          "Selling Price": 0.0,
          "Stock Quantity": 0,
          "Stock Status": item.stockStatus,
          "Expiry Status": item.expiryStatus,
        });
      } else {
        item.batches.forEach((b) => {
          exportRows.push({
            "Medicine Name": item.name,
            "Manufacturer": item.manufacturer || "-",
            "Generic Name": item.genericName || "-",
            "Category": item.category || "-",
            "Barcode": item.barcode || "-",
            "Unit": item.unit,
            "Batch Number": b.batchNumber,
            "Expiry Date": b.expDate,
            "Cost Price": b.costPrice,
            "MRP": b.mrp,
            "Selling Price": b.sellingPrice,
            "Stock Quantity": b.stockQty,
            "Stock Status": calculateStockStatus(b.stockQty, item.lowStockThreshold),
            "Expiry Status": calculateExpiryStatus(b.expDate),
          });
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");

    const today = getLocalTodayStr();
    const filename = `${filenamePrefix}_${today}.${format}`;
    XLSX.writeFile(workbook, filename, {
      bookType: format === "xlsx" ? "xlsx" : "csv",
    });
  },
};

