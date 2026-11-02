export interface StoreDetails {
  id: number;
  
  // Section A: Pharmacy Information
  storeName: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  drugLicense1: string;
  drugLicense2: string;

  // Section B: Owner / Pharmacist Information
  ownerName: string;
  pharmacistName: string;
  pharmacistRegNo: string;

  // Section C: Invoice Configuration
  billPrefix: string;
  startingBillNumber: number;
  showGstinOnInvoice: boolean;
  showAmountInWords: boolean;
  footerTerms: string;

  // Section D: Bank / UPI Details
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;

  // Section E: Inventory Settings
  lowStockThreshold: number;

  // Section F: Pharmacy Logo
  logoPath: string | null;
  logoDataUrl?: string | null; // Base64 preview/storage
  
  updatedAt?: string;
}

export type StoreDetailsFormErrors = Partial<Record<keyof StoreDetails, string>>;
