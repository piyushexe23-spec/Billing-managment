/**
 * Billing Configuration and Financial Math Utilities
 * IM MEDICOS Pharmacy Billing Software
 */

// Rates are configured in ONE shared constant
export const GST_RATE = 18; // 18% inclusive
export const CGST_RATE = 9;  // 9%
export const SGST_RATE = 9;  // 9%

/**
 * Calculates GST included in the final price:
 * Total GST = Grand Total * 18 / 118
 * CGST (9%) = Total GST / 2
 * SGST (9%) = Total GST - CGST
 */
export function calculateIncludedGst(grandTotal: number): {
  gstTotal: number;
  cgst: number;
  sgst: number;
} {
  if (!grandTotal || grandTotal <= 0) {
    return { gstTotal: 0, cgst: 0, sgst: 0 };
  }
  const gstTotal = Number(((grandTotal * GST_RATE) / (100 + GST_RATE)).toFixed(2));
  const cgst = Number((gstTotal / 2).toFixed(2));
  const sgst = Number((gstTotal - cgst).toFixed(2));
  return { gstTotal, cgst, sgst };
}

/**
 * Formats ISO date (YYYY-MM-DD) to Indian DD/MM/YYYY display format
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const clean = dateStr.split("T")[0].trim();
  const parts = clean.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }
  return dateStr;
}

/**
 * Validates 10-digit Indian mobile number
 * Starts with 6, 7, 8, or 9
 */
export function isValidIndianMobile(mobile: string): boolean {
  if (!mobile) return false;
  const cleaned = mobile.trim().replace(/\D/g, "");
  return /^[6-9]\d{9}$/.test(cleaned);
}

/**
 * Formats a number to 2-decimal Indian currency format (e.g., ₹ 1,245.50)
 */
export function formatIndianCurrency(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return "₹ 0.00";
  const fixed = amount.toFixed(2);
  const [integerPart, decimalPart] = fixed.split(".");

  // Format integer with Indian numbering system (Lakhs, Crores)
  const lastThree = integerPart.slice(-3);
  const otherNumbers = integerPart.slice(0, -3);
  const formattedInteger =
    otherNumbers !== ""
      ? otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree
      : lastThree;

  return `₹ ${formattedInteger}.${decimalPart}`;
}

/**
 * Converts a numeric amount to Indian Currency Words format
 * e.g., 1250.50 -> "Rupees One Thousand Two Hundred Fifty and Fifty Paise Only"
 */
export function formatAmountInIndianWords(amount: number): string {
  if (isNaN(amount) || amount <= 0) return "Rupees Zero Only";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convertTwoDigits(num: number): string {
    if (num === 0) return "";
    if (num < 20) return ones[num];
    const t = tens[Math.floor(num / 10)];
    const o = ones[num % 10];
    return o ? `${t} ${o}` : t;
  }

  function convertThreeDigits(num: number): string {
    const hundred = Math.floor(num / 100);
    const rest = num % 100;
    let str = "";
    if (hundred > 0) {
      str += `${ones[hundred]} Hundred`;
    }
    if (rest > 0) {
      if (str !== "") str += " ";
      str += convertTwoDigits(rest);
    }
    return str;
  }

  const rounded = Number(amount.toFixed(2));
  const integerPart = Math.floor(rounded);
  const decimalPart = Math.round((rounded - integerPart) * 100);

  let remaining = integerPart;
  const parts: string[] = [];

  // Crores (1,00,00,000)
  const crores = Math.floor(remaining / 10000000);
  remaining %= 10000000;
  if (crores > 0) {
    parts.push(`${convertThreeDigits(crores)} Crore`);
  }

  // Lakhs (1,00,000)
  const lakhs = Math.floor(remaining / 100000);
  remaining %= 100000;
  if (lakhs > 0) {
    parts.push(`${convertTwoDigits(lakhs)} Lakh`);
  }

  // Thousands (1,000)
  const thousands = Math.floor(remaining / 1000);
  remaining %= 1000;
  if (thousands > 0) {
    parts.push(`${convertTwoDigits(thousands)} Thousand`);
  }

  // Hundreds and units
  if (remaining > 0) {
    parts.push(convertThreeDigits(remaining));
  }

  let words = "Rupees " + (parts.length > 0 ? parts.join(" ") : "Zero");

  if (decimalPart > 0) {
    words += ` and ${convertTwoDigits(decimalPart)} Paise`;
  }

  words += " Only";
  return words;
}

