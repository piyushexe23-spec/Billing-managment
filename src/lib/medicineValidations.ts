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
  quantityReceived?: string;
  general?: string;
}

export interface PriceWarnings {
  sellingPriceExceedsMrp?: boolean;
  sellingPriceBelowCost?: boolean;
  sellingPriceWarning?: string;
  message?: string;
}

/**
 * Validates ISO date format YYYY-MM-DD
 */
export function isValidDateString(dateStr: string): boolean {
  if (!dateStr || !dateStr.trim()) return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr.trim())) return false;
  const parsed = new Date(dateStr.trim());
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
    costPrice: number | "";
    mrp: number | "";
    sellingPrice: number | "";
    stockQty: number | "";
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
    errors.name = "Medicine name cannot be empty";
  }

  // 2. Unit
  if (!data.unit || !data.unit.trim()) {
    errors.unit = "Unit is required";
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

    // Batch Number
    if (!b.batchNumber || !b.batchNumber.trim()) {
      errors.batchNumber = "Batch number cannot be empty";
    }

    // Expiry Date
    if (!b.expDate || !b.expDate.trim()) {
      errors.expDate = "Expiry date is required";
    } else if (!isValidDateString(b.expDate)) {
      errors.expDate = "Enter a valid date";
    }

    // Manufacturing Date
    if (b.mfgDate && b.mfgDate.trim()) {
      if (!isValidDateString(b.mfgDate)) {
        errors.mfgDate = "Enter a valid date";
      } else if (b.expDate && b.expDate.trim() && b.mfgDate.trim() > b.expDate.trim()) {
        errors.mfgDate = "Manufacturing date cannot be after expiry date";
      }
    }

    // Quantity / Opening Stock
    if (b.stockQty === "" || b.stockQty === undefined || b.stockQty === null) {
      errors.stockQty = "Quantity is required";
    } else {
      const numQty = Number(b.stockQty);
      if (isNaN(numQty) || !Number.isInteger(numQty) || numQty < 1) {
        errors.stockQty = "Quantity must be at least 1";
      }
    }

    // Purchase / Cost Price
    if (b.costPrice === "" || b.costPrice === undefined || b.costPrice === null) {
      errors.costPrice = "Cost price is required";
    } else {
      const numCost = Number(b.costPrice);
      if (isNaN(numCost) || numCost < 0) {
        errors.costPrice = "Cost price cannot be negative";
      }
    }

    // MRP
    if (b.mrp === "" || b.mrp === undefined || b.mrp === null) {
      errors.mrp = "MRP is required";
    } else {
      const numMrp = Number(b.mrp);
      if (isNaN(numMrp) || numMrp <= 0) {
        errors.mrp = "MRP must be greater than 0";
      }
    }

    // Selling Price
    if (b.sellingPrice === "" || b.sellingPrice === undefined || b.sellingPrice === null) {
      errors.sellingPrice = "Selling price is required";
    } else {
      const numSelling = Number(b.sellingPrice);
      if (isNaN(numSelling) || numSelling < 0) {
        errors.sellingPrice = "Selling price cannot be negative";
      }
    }

    // Price Warnings (warnings let the user continue after confirming, but errors block saving)
    const cost = typeof b.costPrice === "number" ? b.costPrice : Number(b.costPrice);
    const mrp = typeof b.mrp === "number" ? b.mrp : Number(b.mrp);
    const selling = typeof b.sellingPrice === "number" ? b.sellingPrice : Number(b.sellingPrice);

    if (!isNaN(selling) && !isNaN(mrp) && selling > mrp) {
      warnings.sellingPriceExceedsMrp = true;
    }

    if (!isNaN(selling) && !isNaN(cost) && selling < cost) {
      warnings.sellingPriceBelowCost = true;
    }

    if (warnings.sellingPriceExceedsMrp && warnings.sellingPriceBelowCost) {
      warnings.sellingPriceWarning = "Selling price is higher than MRP and below cost price.";
    } else if (warnings.sellingPriceExceedsMrp) {
      warnings.sellingPriceWarning = "Selling price is higher than MRP";
    } else if (warnings.sellingPriceBelowCost) {
      warnings.sellingPriceWarning = "Selling price is below cost price";
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates batch addition / batch editing input
 */
export function validateBatchFields(b: {
  batchNumber: string;
  mfgDate?: string;
  expDate: string;
  costPrice: number | "";
  mrp: number | "";
  sellingPrice: number | "";
  quantityReceived?: number | "";
}): {
  isValid: boolean;
  errors: MedicineValidationErrors;
  warnings: PriceWarnings;
} {
  const errors: MedicineValidationErrors = {};
  const warnings: PriceWarnings = {};

  if (!b.batchNumber || !b.batchNumber.trim()) {
    errors.batchNumber = "Batch number cannot be empty";
  }

  if (!b.expDate || !b.expDate.trim()) {
    errors.expDate = "Expiry date is required";
  } else if (!isValidDateString(b.expDate)) {
    errors.expDate = "Enter a valid date";
  }

  if (b.mfgDate && b.mfgDate.trim()) {
    if (!isValidDateString(b.mfgDate)) {
      errors.mfgDate = "Enter a valid date";
    } else if (b.expDate && b.expDate.trim() && b.mfgDate.trim() > b.expDate.trim()) {
      errors.mfgDate = "Manufacturing date cannot be after expiry date";
    }
  }

  if (b.quantityReceived !== undefined) {
    if (b.quantityReceived === "" || b.quantityReceived === null) {
      errors.quantityReceived = "Quantity is required";
    } else {
      const numQty = Number(b.quantityReceived);
      if (isNaN(numQty) || !Number.isInteger(numQty) || numQty < 1) {
        errors.quantityReceived = "Quantity must be at least 1";
      }
    }
  }

  if (b.costPrice === "" || b.costPrice === undefined || b.costPrice === null) {
    errors.costPrice = "Cost price is required";
  } else {
    const numCost = Number(b.costPrice);
    if (isNaN(numCost) || numCost < 0) {
      errors.costPrice = "Cost price cannot be negative";
    }
  }

  if (b.mrp === "" || b.mrp === undefined || b.mrp === null) {
    errors.mrp = "MRP is required";
  } else {
    const numMrp = Number(b.mrp);
    if (isNaN(numMrp) || numMrp <= 0) {
      errors.mrp = "MRP must be greater than 0";
    }
  }

  if (b.sellingPrice === "" || b.sellingPrice === undefined || b.sellingPrice === null) {
    errors.sellingPrice = "Selling price is required";
  } else {
    const numSelling = Number(b.sellingPrice);
    if (isNaN(numSelling) || numSelling < 0) {
      errors.sellingPrice = "Selling price cannot be negative";
    }
  }

  const cost = typeof b.costPrice === "number" ? b.costPrice : Number(b.costPrice);
  const mrp = typeof b.mrp === "number" ? b.mrp : Number(b.mrp);
  const selling = typeof b.sellingPrice === "number" ? b.sellingPrice : Number(b.sellingPrice);

  if (!isNaN(selling) && !isNaN(mrp) && selling > mrp) {
    warnings.sellingPriceExceedsMrp = true;
  }
  if (!isNaN(selling) && !isNaN(cost) && selling < cost) {
    warnings.sellingPriceBelowCost = true;
  }
  if (warnings.sellingPriceExceedsMrp && warnings.sellingPriceBelowCost) {
    warnings.sellingPriceWarning = "Selling price is higher than MRP and below cost price.";
  } else if (warnings.sellingPriceExceedsMrp) {
    warnings.sellingPriceWarning = "Selling price is higher than MRP";
  } else if (warnings.sellingPriceBelowCost) {
    warnings.sellingPriceWarning = "Selling price is below cost price";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}
