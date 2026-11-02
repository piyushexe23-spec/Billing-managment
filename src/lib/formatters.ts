/**
 * IM MEDICOS - Indian Rupee (INR) and Date formatting utilities
 */

export function formatCurrencyINR(amount: number, includeDecimals = false): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return "₹0";
  }
  
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: includeDecimals ? 2 : 0,
    minimumFractionDigits: includeDecimals ? 2 : 0,
  }).format(amount);
}

export function formatNumberIndian(count: number): string {
  if (isNaN(count)) return "0";
  return new Intl.NumberFormat("en-IN").format(count);
}
