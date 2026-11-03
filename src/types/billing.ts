/**
 * Billing & Invoicing Type Definitions
 * IM MEDICOS Pharmacy Billing Software
 */

export type PaymentMode = "CASH" | "UPI" | "CARD";

export type DiscountMode = "NON_DISCOUNT" | "DISCOUNTED";

export interface SaleableBatch {
  id: number;
  medicineId: number;
  batchNumber: string;
  mfgDate?: string | null;
  expDate: string; // ISO date string: YYYY-MM-DD
  costPrice: number;
  mrp: number;
  sellingPrice: number;
  stockQty: number;
}

export interface SaleableMedicine {
  id: number;
  name: string;
  genericName?: string | null;
  manufacturer?: string | null;
  category?: string | null;
  barcode?: string | null;
  unit: string;
  lowStockThreshold: number;
  isActive: boolean;
  totalSaleableStock: number;
  nearestExpiryDate: string | null;
  batches: SaleableBatch[];
}

export interface BillItem {
  id: string; // unique client line id for React key
  medicineId: number;
  medicineName: string;
  genericName?: string | null;
  manufacturer?: string | null;
  unit: string;
  batchId: number;
  batchNumber: string;
  expDate: string;
  availableStock: number;
  costPrice: number; // Internal only - NEVER shown to customer or on PDF
  mrp: number;
  sellingPrice: number;
  rate: number;
  quantity: number;
  amount: number;
  rateWarning?: string;
}

export interface BillCustomerDetails {
  customerName: string;
  customerMobile: string;
  doctorName?: string;
  paymentMode: PaymentMode;
  discountMode: DiscountMode;
}

export interface StoreSnapshot {
  storeName: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  drugLicense1?: string | null;
  drugLicense2?: string | null;
  footerTerms?: string | null;
  showGstin: boolean;
  showAmountInWords: boolean;
}

export interface BillItemRecord {
  id?: number;
  billId?: number;
  medicineId: number;
  batchId: number;
  medicineName: string;
  batchNumber: string;
  expDate: string;
  unit: string;
  quantity: number;
  costPrice: number;
  mrp: number;
  sellingPrice: number;
  rate: number;
  amount: number;
}

export interface BillRecord {
  id: number;
  billNumber: string;
  customerName: string;
  customerMobile: string;
  doctorName?: string | null;
  billDate: string;
  discountMode: DiscountMode;
  paymentMode: PaymentMode;
  subTotal: number;
  discount: number;
  gstTotal: number;
  cgst: number;
  sgst: number;
  grandTotal: number;
  amountInWords: string;
  storeSnapshot: StoreSnapshot;
  items: BillItemRecord[];
  status: string;
  createdAt: string;
}

export interface SaveBillInput {
  customerName: string;
  customerMobile: string;
  doctorName?: string | null;
  discountMode: DiscountMode;
  paymentMode: PaymentMode;
  items: Array<{
    medicineId: number;
    batchId: number;
    medicineName: string;
    batchNumber: string;
    expDate: string;
    unit: string;
    quantity: number;
    costPrice: number;
    mrp: number;
    sellingPrice: number;
    rate: number;
    amount: number;
  }>;
}
