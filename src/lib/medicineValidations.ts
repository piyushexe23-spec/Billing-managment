/**
 * Medicine & Inventory Validation Functions
 * IM MEDICOS Pharmacy Billing Software
 */

export interface MedicineValidationErrors {
  name?: string;
  unit?: string;
  lowStockThreshold?: string;
  batchNumber?: string;
  expDate?: string;
  mfgDate?: string;
  costPrice?: string;
  mrp?: string;
  sellingPrice?: string;
  stockQty?: string;
}

export interface PriceWarnings {
  sellingPriceExceedsMrp?: boolean;
  sellingPriceBelowCost?: boolean;
  message?: string;
}

/**
 * Validates ISO date format YYYY-MM-DD
 */
export function isValidDateString(dateStr: string): boolean {
  if (!dateStr || !dateStr.trim()) return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const parsed = new Date(dateStr);
  return !isNaN(parsed.getTime());
}

/**
 * Validates single medicine creation form
 */
export function validateMedicineInput(data: {
  name: string;
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
}): {
  isValid: boolean;
  errors: MedicineValidationErrors;
  warnings: PriceWarnings;
} {
  const errors: MedicineValidationErrors = {};
  const warnings: PriceWarnings = {};

  // 1. Medicine Name
  if (!data.name || !data.name.trim()) {
    errors.name = "Medicine name is mandatory";
  } else if (data.name.trim().length < 2) {
    errors.name = "Medicine name must be at least 2 characters";
  } else if (data.name.trim().length > 150) {
    errors.name = "Medicine name cannot exceed 150 characters";
  }

  // 2. Unit
  if (!data.unit || !data.unit.trim()) {
    errors.unit = "Unit is required (e.g., Tablet, Strip, Bottle)";
  }

  // 3. Low Stock Threshold
  if (data.lowStockThreshold === undefined || data.lowStockThreshold === null) {
    errors.lowStockThreshold = "Low stock alert quantity is required";
  } else if (!Number.isInteger(data.lowStockThreshold) || data.lowStockThreshold < 0) {
    errors.lowStockThreshold = "Threshold must be a non-negative integer (minimum 0)";
  }

  // 4. Batch Validation (if initial batch is included)
  if (data.initialBatch) {
    const b = data.initialBatch;

    if (!b.batchNumber || !b.batchNumber.trim()) {
      errors.batchNumber = "Batch number is required";
    }

    if (!b.expDate || !b.expDate.trim()) {
      errors.expDate = "Expiry date is mandatory";
    } else if (!isValidDateString(b.expDate)) {
      errors.expDate = "Invalid expiry date format (expected YYYY-MM-DD)";
    }

    if (b.mfgDate && b.mfgDate.trim()) {
      if (!isValidDateString(b.mfgDate)) {
        errors.mfgDate = "Invalid manufacturing date format (expected YYYY-MM-DD)";
      } else if (b.expDate && b.mfgDate > b.expDate) {
        errors.mfgDate = "Manufacturing date cannot be later than expiry date";
      }
    }

    if (b.costPrice === undefined || b.costPrice === null || isNaN(b.costPrice)) {
      errors.costPrice = "Cost price is required";
    } else if (b.costPrice < 0) {
      errors.costPrice = "Cost price cannot be negative";
    }

    if (b.mrp === undefined || b.mrp === null || isNaN(b.mrp)) {
      errors.mrp = "MRP is required";
    } else if (b.mrp < 0) {
      errors.mrp = "MRP cannot be negative";
    }

    if (b.sellingPrice === undefined || b.sellingPrice === null || isNaN(b.sellingPrice)) {
      errors.sellingPrice = "Selling price is required";
    } else if (b.sellingPrice < 0) {
      errors.sellingPrice = "Selling price cannot be negative";
    }

    if (b.stockQty === undefined || b.stockQty === null || isNaN(b.stockQty)) {
      errors.stockQty = "Initial stock quantity is required";
    } else if (!Number.isInteger(b.stockQty) || b.stockQty < 0) {
      errors.stockQty = "Stock quantity must be a non-negative integer";
    }

    // Price Warnings
    if (b.sellingPrice !== undefined && b.mrp !== undefined && b.sellingPrice > b.mrp) {
      warnings.sellingPriceExceedsMrp = true;
      warnings.message = `Selling price (₹${b.sellingPrice}) exceeds Maximum Retail Price (₹${b.mrp}).`;
    }

    if (b.sellingPrice !== undefined && b.costPrice !== undefined && b.sellingPrice < b.costPrice) {
      warnings.sellingPriceBelowCost = true;
      const extra = warnings.message ? ` Also, selling price (₹${b.sellingPrice}) is below cost price (₹${b.costPrice}).` : `Selling price (₹${b.sellingPrice}) is below purchase cost (₹${b.costPrice}).`;
      warnings.message = (warnings.message || "") + extra;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates batch addition input
 */
export function validateBatchInput(b: {
  batchNumber: string;
  mfgDate?: string;
  expDate: string;
  costPrice: number;
  mrp: number;
  sellingPrice: number;
  stockQty: number;
}): {
  isValid: boolean;
  errors: MedicineValidationErrors;
  warnings: PriceWarnings;
} {
  return validateMedicineInput({
    name: "ValidNamePlaceholder",
    unit: "Tablet",
    lowStockThreshold: 10,
    initialBatch: b,
  });
}

