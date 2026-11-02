import { StoreDetails, StoreDetailsFormErrors } from "@/types/store";

/**
 * Validates Indian GSTIN (Goods and Services Tax Identification Number)
 * Format: 15 alphanumeric characters:
 * - 2 digits (State code: 01-37)
 * - 10 characters PAN (5 letters, 4 digits, 1 letter)
 * - 1 character (Entity code: 1-9 or A-Z)
 * - 1 character 'Z' (Default)
 * - 1 check digit
 */
export function isValidGSTIN(gstin: string): boolean {
  if (!gstin || !gstin.trim()) return true; // Optional field
  const clean = gstin.trim().toUpperCase();
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(clean);
}

/**
 * Validates Indian IFSC (Indian Financial System Code)
 * Format: 11 characters:
 * - 4 letters (Bank code)
 * - 5th character '0' (Reserved)
 * - 6 alphanumeric characters (Branch code)
 */
export function isValidIFSC(ifsc: string): boolean {
  if (!ifsc || !ifsc.trim()) return true; // Optional field
  const clean = ifsc.trim().toUpperCase();
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return ifscRegex.test(clean);
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || !email.trim()) return true; // Optional field
  const clean = email.trim();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(clean);
}

/**
 * Sensibly validates Indian phone number without rejecting valid numbers
 * Accepts 10-digit mobile, +91 country code, leading 0, spaces, and dashes
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone || !phone.trim()) return true; // Optional field
  const digitsOnly = phone.replace(/[^0-9]/g, "");
  // Must be between 10 and 12 digits (10 digits for local mobile/landline with STD, 11 for leading 0, 12 for 91 prefix)
  return digitsOnly.length >= 10 && digitsOnly.length <= 13;
}

/**
 * Validates complete Store Details form
 */
export function validateStoreDetails(data: StoreDetails): {
  isValid: boolean;
  errors: StoreDetailsFormErrors;
} {
  const errors: StoreDetailsFormErrors = {};

  // 1. Pharmacy / Store Name (Mandatory)
  if (!data.storeName || !data.storeName.trim()) {
    errors.storeName = "Pharmacy name is mandatory";
  } else if (data.storeName.trim().length < 2) {
    errors.storeName = "Pharmacy name must be at least 2 characters";
  } else if (data.storeName.trim().length > 120) {
    errors.storeName = "Pharmacy name cannot exceed 120 characters";
  }

  // 2. Email (Optional, validated if provided)
  if (data.email && !isValidEmail(data.email)) {
    errors.email = "Please enter a valid email address (e.g., store@example.com)";
  }

  // 3. GSTIN (Optional, validated if provided)
  if (data.gstin && !isValidGSTIN(data.gstin)) {
    errors.gstin = "Invalid Indian GSTIN format (e.g., 07AAAAA0000A1Z5)";
  }

  // 4. Phone Number (Optional, validated if provided)
  if (data.phone && !isValidPhoneNumber(data.phone)) {
    errors.phone = "Please enter a valid 10-digit phone number";
  }

  // 5. IFSC Code (Optional, validated if provided)
  if (data.ifscCode && !isValidIFSC(data.ifscCode)) {
    errors.ifscCode = "Invalid IFSC format. 4 letters, '0', and 6 alphanumeric characters (e.g., SBIN0001234)";
  }

  // 6. Bill Prefix (Mandatory, non-empty)
  if (!data.billPrefix || !data.billPrefix.trim()) {
    errors.billPrefix = "Bill prefix is required (e.g., IM)";
  } else if (data.billPrefix.trim().length > 10) {
    errors.billPrefix = "Bill prefix cannot exceed 10 characters";
  }

  // 7. Starting Bill Number (Mandatory, positive integer >= 1)
  if (data.startingBillNumber === undefined || data.startingBillNumber === null) {
    errors.startingBillNumber = "Starting bill number is required";
  } else if (!Number.isInteger(data.startingBillNumber) || data.startingBillNumber < 1) {
    errors.startingBillNumber = "Starting bill number must be a positive integer (minimum 1)";
  }

  // 8. Low Stock Alert Quantity (Mandatory, non-negative integer >= 0)
  if (data.lowStockThreshold === undefined || data.lowStockThreshold === null) {
    errors.lowStockThreshold = "Low stock alert quantity is required";
  } else if (!Number.isInteger(data.lowStockThreshold) || data.lowStockThreshold < 0) {
    errors.lowStockThreshold = "Low stock threshold must be a non-negative integer (minimum 0)";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
