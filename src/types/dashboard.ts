export type DateRangeKey = "7d" | "30d" | "12m";

export interface SummaryCardData {
  id: string;
  title: string;
  value: string;
  rawNumericValue: number;
  iconName: string;
  trendLabel?: string;
  trendDirection?: "up" | "down" | "neutral" | "warning";
  badgeText?: string;
  accentColor?: "navy" | "green" | "amber" | "red" | "blue";
}

export interface SalesDataPoint {
  date: string;
  label: string;
  sales: number;
  billCount: number;
}

export interface TopMedicine {
  id: string;
  name: string;
  genericName?: string;
  category: string;
  quantitySold: number;
  unit: string;
  totalSalesAmount: number;
}

export interface LowStockItem {
  id: string;
  name: string;
  batchNo: string;
  availableStock: number;
  minThreshold: number;
  unit: string;
  urgency: "critical" | "warning";
}

export interface RecentBillItem {
  id: string;
  billNumber: string;
  customerName: string;
  patientPhone?: string;
  doctorName?: string;
  dateTime: string;
  totalAmount: number;
  paymentMode: "CASH" | "UPI" | "CARD";
  itemCount: number;
}

export interface DashboardOverview {
  isDevSampleData: boolean;
  storeName: string;
  lastUpdated: string;
  summary: {
    todaySales: SummaryCardData;
    todayProfit: SummaryCardData;
    todayBills: SummaryCardData;
    monthSales: SummaryCardData;
    totalMedicines: SummaryCardData;
    lowStockMedicines: SummaryCardData;
  };
}
