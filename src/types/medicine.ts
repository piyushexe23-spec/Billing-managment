/**
 * Medicine & Inventory Management Type Definitions
 * IM MEDICOS Pharmacy Billing Software
 */

export type MedicineUnit =
  | "Tablet"
  | "Capsule"
  | "Strip"
  | "Bottle"
  | "Injection"
  | "Tube"
  | "Piece"
  | "Other";

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export type ExpiryStatus = "SAFE" | "EXPIRING_SOON" | "EXPIRED" | "NO_BATCH";

export type StockMovementType =
  | "OPENING_STOCK"
  | "PURCHASE"
  | "ADJUSTMENT_ADD"
  | "ADJUSTMENT_REDUCE"
  | "SALE"
  | "DAMAGE"
  | "RETURN";

export interface Medicine {
  id: number;
  name: string;
  genericName?: string | null;
  manufacturer?: string | null;
  category?: string | null;
  description?: string | null;
  barcode?: string | null;
  hsnCode?: string | null;
  unit: MedicineUnit | string;
  lowStockThreshold: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MedicineBatch {
  id: number;
  medicineId: number;
  batchNumber: string;
  mfgDate?: string | null;
  expDate: string; // ISO date string: YYYY-MM-DD
  costPrice: number;
  mrp: number;
  sellingPrice: number;
  stockQty: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface StockMovement {
  id: number;
  medicineId: number;
  batchId?: number | null;
  batchNumber?: string | null;
  medicineName?: string | null;
  movementType: StockMovementType;
  quantity: number;
  previousQty: number;
  newQty: number;
  reason?: string | null;
  referenceId?: string | null;
  createdAt: string;
}

export interface MedicineWithBatches extends Medicine {
  batches: MedicineBatch[];
}

export interface MedicineListItem {
  id: number;
  name: string;
  genericName?: string | null;
  manufacturer?: string | null;
  category?: string | null;
  barcode?: string | null;
  unit: string;
  lowStockThreshold: number;
  totalStock: number;
  stockStatus: StockStatus;
  nearestExpiryDate: string | null;
  nearestBatchNumber: string | null;
  expiryStatus: ExpiryStatus;
  minCostPrice: number;
  maxCostPrice: number;
  minMrp: number;
  maxMrp: number;
  minSellingPrice: number;
  maxSellingPrice: number;
  activeBatchesCount: number;
  batches: MedicineBatch[];
}

export interface InventorySummaryMetrics {
  totalMedicines: number;
  totalStockUnits: number;
  medicinesWithSales: number;
  topSellingMedicines: Array<{
    medicineId: number;
    medicineName: string;
    totalQuantitySold: number;
    totalSalesAmount: number;
  }>;
  lowStockCount: number;
  outOfStockCount: number;
  expiringSoonCount: number; // Expiring within 10 calendar days
  expiredCount: number;
}

export interface MedicineFilterOptions {
  search: string;
  stockStatus: "ALL" | StockStatus;
  expiryStatus: "ALL" | ExpiryStatus;
  manufacturer: string;
  category: string;
  minStock?: number;
  maxStock?: number;
  expiryDateFrom?: string;
  expiryDateTo?: string;
}

export type MedicineSortField =
  | "name"
  | "manufacturer"
  | "totalStock"
  | "nearestExpiryDate"
  | "minMrp"
  | "minSellingPrice";

export type SortDirection = "asc" | "desc";

export interface CreateMedicineInput {
  name: string;
  genericName?: string;
  manufacturer?: string;
  category?: string;
  description?: string;
  barcode?: string;
  hsnCode?: string;
  unit: string;
  lowStockThreshold: number;
  initialBatch?: {
    batchNumber: string;
    mfgDate?: string;
    expDate: string;
    costPrice: number;
    mrp: number;
    sellingPrice: number;
    stockQty: number;
  };
}

export interface AddBatchInput {
  medicineId: number;
  batchNumber: string;
  mfgDate?: string;
  expDate: string;
  costPrice: number;
  mrp: number;
  sellingPrice: number;
  stockQty: number;
}

export interface StockAdjustmentInput {
  medicineId: number;
  batchId: number;
  adjustmentType: "ADD" | "REDUCE";
  quantity: number;
  reason: string;
}

export interface BulkImportRow {
  rowNumber: number;
  name: string;
  genericName?: string;
  manufacturer?: string;
  category?: string;
  barcode?: string;
  batchNumber: string;
  mfgDate?: string;
  expDate: string;
  costPrice: number;
  mrp: number;
  sellingPrice: number;
  quantity: number;
  unit: string;
  lowStockThreshold?: number;
  isValid: boolean;
  errors: string[];
  isDuplicateMedicine?: boolean;
  isDuplicateBatch?: boolean;
}

export interface BulkImportResult {
  totalRows: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  errors: Array<{ rowNumber: number; message: string }>;
}

