/**
 * Reports Module Types
 * IM MEDICOS Pharmacy Billing Software - Command 08
 */

export type ReportTab = "SALES" | "STOCK" | "TOP_SELLING" | "PROFIT" | "GST_SUMMARY";

export type StockSubView =
  | "ALL"
  | "LOW_STOCK"
  | "OUT_OF_STOCK"
  | "EXPIRING_SOON"
  | "EXPIRED"
  | "BATCH_WISE";

export interface ReportDateRange {
  fromDate: string;
  toDate: string;
}

// -------------------------------------------------------------
// 1. Sales Report
// -------------------------------------------------------------
export interface SalesReportSummary {
  totalBills: number;
  grossSales: number;
  totalDiscount: number;
  netSales: number;
  averageBillValue: number;
  cashSales: number;
  upiSales: number;
  cardSales: number;
  cashBillsCount: number;
  upiBillsCount: number;
  cardBillsCount: number;
  discountedBillsCount: number;
  discountedBillsAmount: number;
  nonDiscountBillsCount: number;
  nonDiscountBillsAmount: number;
}

export interface SalesReportRow {
  period: string; // YYYY-MM-DD or YYYY-MM
  billsCount: number;
  grossSales: number;
  discount: number;
  netSales: number;
}

export interface SalesReportData {
  summary: SalesReportSummary;
  rows: SalesReportRow[];
}

// -------------------------------------------------------------
// 2. Stock Report
// -------------------------------------------------------------
export interface StockReportSummary {
  totalActiveMedicines: number;
  totalStockUnits: number;
  stockValueCost: number;
  stockValueMrp: number;
  lowStockCount: number;
  outOfStockCount: number;
  expiringSoonCount: number;
  expiredCount: number;
}

export interface StockReportItem {
  id: number;
  medicineName: string;
  manufacturer: string;
  batchNumber: string;
  expDate: string;
  quantity: number;
  unit: string;
  costPrice: number;
  mrp: number;
  sellingPrice: number;
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  expiryStatus: "SAFE" | "EXPIRING_SOON" | "EXPIRED";
  isArchived: boolean;
}

export interface StockReportData {
  summary: StockReportSummary;
  items: StockReportItem[];
}

// -------------------------------------------------------------
// 3. Top Selling Report
// -------------------------------------------------------------
export interface TopSellingReportItem {
  rank: number;
  medicineName: string;
  manufacturer: string;
  quantitySold: number;
  billsCount: number;
  revenue: number;
}

// -------------------------------------------------------------
// 4. Profit Report
// -------------------------------------------------------------
export interface ProfitReportSummary {
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPercent: number;
  discountGiven: number;
}

export interface ProfitReportByDateRow {
  period: string; // YYYY-MM-DD or YYYY-MM
  quantitySold: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPercent: number;
}

export interface ProfitReportByMedicineRow {
  medicineName: string;
  manufacturer: string;
  quantitySold: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPercent: number;
}

export interface ProfitReportData {
  summary: ProfitReportSummary;
  byDate: ProfitReportByDateRow[];
  byMedicine: ProfitReportByMedicineRow[];
}

// -------------------------------------------------------------
// 5. GST Summary Report
// -------------------------------------------------------------
export interface GstSummaryRow {
  date: string;
  billsCount: number;
  billedAmount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  totalGst: number;
}

export interface GstSummaryReportData {
  summary: {
    totalBilledAmount: number;
    totalTaxableValue: number;
    totalCgst: number;
    totalSgst: number;
    totalGst: number;
    billsCount: number;
  };
  rows: GstSummaryRow[];
}
