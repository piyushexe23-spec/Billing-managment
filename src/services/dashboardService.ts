import {
  DashboardOverview,
  SalesDataPoint,
  DateRangeKey,
  TopMedicine,
  LowStockItem,
  RecentBillItem,
} from "@/types/dashboard";
import { formatCurrencyINR, formatNumberIndian } from "@/lib/formatters";

/**
 * IM MEDICOS Dashboard Service Layer
 * 
 * NOTE: Currently returns development-only sample pharmacy data for UI & interaction testing.
 * When Rust Tauri IPC commands are bound in subsequent phases, this service connects
 * directly to local SQLite through `invoke('get_dashboard_metrics')`.
 */

export const IS_SAMPLE_DATA = true;

export const dashboardService = {
  /**
   * Fetches the 6 core summary metrics
   */
  async getOverview(): Promise<DashboardOverview> {
    // Simulated network/IPC micro-latency
    await new Promise((resolve) => setTimeout(resolve, 150));

    return {
      isDevSampleData: IS_SAMPLE_DATA,
      storeName: "IM MEDICOS CENTRAL PHARMACY",
      lastUpdated: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      summary: {
        todaySales: {
          id: "today_sales",
          title: "Today's Sales",
          value: formatCurrencyINR(24850),
          rawNumericValue: 24850,
          iconName: "IndianRupee",
          trendLabel: "+14.2% vs yesterday",
          trendDirection: "up",
          accentColor: "navy",
        },
        todayProfit: {
          id: "today_profit",
          title: "Today's Profit",
          value: formatCurrencyINR(6420),
          rawNumericValue: 6420,
          iconName: "TrendingUp",
          trendLabel: "25.8% gross margin",
          trendDirection: "up",
          accentColor: "green",
        },
        todayBills: {
          id: "today_bills",
          title: "Today's Bills",
          value: "42",
          rawNumericValue: 42,
          iconName: "Receipt",
          trendLabel: "Avg ₹592 per invoice",
          trendDirection: "neutral",
          accentColor: "blue",
        },
        monthSales: {
          id: "month_sales",
          title: "This Month's Sales",
          value: formatCurrencyINR(584300),
          rawNumericValue: 584300,
          iconName: "BarChart3",
          trendLabel: "+8.6% vs last month",
          trendDirection: "up",
          accentColor: "navy",
        },
        totalMedicines: {
          id: "total_medicines",
          title: "Total Medicines",
          value: formatNumberIndian(1420),
          rawNumericValue: 1420,
          iconName: "Pill",
          trendLabel: "Across 24 categories",
          trendDirection: "neutral",
          accentColor: "navy",
        },
        lowStockMedicines: {
          id: "low_stock_medicines",
          title: "Low Stock Medicines",
          value: "6",
          rawNumericValue: 6,
          iconName: "AlertTriangle",
          trendLabel: "Requires supplier reorder",
          trendDirection: "warning",
          badgeText: "6 Critical",
          accentColor: "amber",
        },
      },
    };
  },

  /**
   * Fetches sales timeline data based on selected date range: '7d' | '30d' | '12m'
   */
  async getSalesChart(range: DateRangeKey): Promise<SalesDataPoint[]> {
    await new Promise((resolve) => setTimeout(resolve, 80));

    switch (range) {
      case "7d":
        return [
          { date: "2026-10-27", label: "27 Oct", sales: 18400, billCount: 31 },
          { date: "2026-10-28", label: "28 Oct", sales: 21250, billCount: 36 },
          { date: "2026-10-29", label: "29 Oct", sales: 19800, billCount: 33 },
          { date: "2026-10-30", label: "30 Oct", sales: 26400, billCount: 45 },
          { date: "2026-10-31", label: "31 Oct", sales: 31200, billCount: 52 },
          { date: "2026-11-01", label: "01 Nov", sales: 22100, billCount: 38 },
          { date: "2026-11-02", label: "Today", sales: 24850, billCount: 42 },
        ];

      case "30d":
        return [
          { date: "2026-10-04", label: "04 Oct", sales: 17200, billCount: 29 },
          { date: "2026-10-08", label: "08 Oct", sales: 19400, billCount: 33 },
          { date: "2026-10-12", label: "12 Oct", sales: 23100, billCount: 39 },
          { date: "2026-10-16", label: "16 Oct", sales: 21500, billCount: 36 },
          { date: "2026-10-20", label: "20 Oct", sales: 28400, billCount: 47 },
          { date: "2026-10-24", label: "24 Oct", sales: 25600, billCount: 42 },
          { date: "2026-10-28", label: "28 Oct", sales: 21250, billCount: 36 },
          { date: "2026-11-02", label: "Today", sales: 24850, billCount: 42 },
        ];

      case "12m":
        return [
          { date: "2025-12", label: "Dec '25", sales: 480000, billCount: 820 },
          { date: "2026-01", label: "Jan '26", sales: 510000, billCount: 890 },
          { date: "2026-02", label: "Feb '26", sales: 495000, billCount: 840 },
          { date: "2026-03", label: "Mar '26", sales: 530000, billCount: 910 },
          { date: "2026-04", label: "Apr '26", sales: 470000, billCount: 810 },
          { date: "2026-05", label: "May '26", sales: 525000, billCount: 900 },
          { date: "2026-06", label: "Jun '26", sales: 540000, billCount: 920 },
          { date: "2026-07", label: "Jul '26", sales: 560000, billCount: 960 },
          { date: "2026-08", label: "Aug '26", sales: 550000, billCount: 940 },
          { date: "2026-09", label: "Sep '26", sales: 575000, billCount: 980 },
          { date: "2026-10", label: "Oct '26", sales: 590000, billCount: 1010 },
          { date: "2026-11", label: "Nov '26", sales: 584300, billCount: 995 },
        ];
    }
  },

  /**
   * Fetches the top 5 selling medicines
   */
  async getTopSellingMedicines(): Promise<TopMedicine[]> {
    await new Promise((resolve) => setTimeout(resolve, 80));

    return [
      {
        id: "med-1",
        name: "Dolo 650 Tablet",
        genericName: "Paracetamol 650mg",
        category: "Antipyretic / Analgesic",
        quantitySold: 184,
        unit: "Strips",
        totalSalesAmount: 5520,
      },
      {
        id: "med-2",
        name: "Pan 40 Tablet",
        genericName: "Pantoprazole 40mg",
        category: "Gastrointestinal",
        quantitySold: 142,
        unit: "Strips",
        totalSalesAmount: 14910,
      },
      {
        id: "med-3",
        name: "Augmentin 625 Duo",
        genericName: "Amoxicillin & Clavulanate",
        category: "Antibiotics",
        quantitySold: 98,
        unit: "Strips",
        totalSalesAmount: 19600,
      },
      {
        id: "med-4",
        name: "Azithral 500 Tablet",
        genericName: "Azithromycin 500mg",
        category: "Antibiotics",
        quantitySold: 76,
        unit: "Strips",
        totalSalesAmount: 9120,
      },
      {
        id: "med-5",
        name: "Shelcal 500 Tablet",
        genericName: "Calcium + Vitamin D3",
        category: "Nutritional Supplements",
        quantitySold: 65,
        unit: "Bottles",
        totalSalesAmount: 7800,
      },
    ];
  },

  /**
   * Fetches low stock medicines at or below threshold
   */
  async getLowStockMedicines(includeMockEmpty = false): Promise<LowStockItem[]> {
    await new Promise((resolve) => setTimeout(resolve, 80));

    if (includeMockEmpty) {
      return [];
    }

    return [
      {
        id: "low-1",
        name: "Insulin Glargine 100IU",
        batchNo: "IG-2025-A",
        availableStock: 2,
        minThreshold: 10,
        unit: "Vials",
        urgency: "critical",
      },
      {
        id: "low-2",
        name: "Montek LC Tablet",
        batchNo: "MLC-881",
        availableStock: 4,
        minThreshold: 15,
        unit: "Strips",
        urgency: "critical",
      },
      {
        id: "low-3",
        name: "Telma 40mg Tablet",
        batchNo: "TL-049",
        availableStock: 5,
        minThreshold: 20,
        unit: "Strips",
        urgency: "warning",
      },
      {
        id: "low-4",
        name: "Ascoril LS Syrup 100ml",
        batchNo: "AS-332",
        availableStock: 3,
        minThreshold: 12,
        unit: "Bottles",
        urgency: "warning",
      },
      {
        id: "low-5",
        name: "Glycomet GP 1 Tablet",
        batchNo: "GM-710",
        availableStock: 6,
        minThreshold: 15,
        unit: "Strips",
        urgency: "warning",
      },
      {
        id: "low-6",
        name: "Betadine 10% Ointment 20g",
        batchNo: "BT-902",
        availableStock: 4,
        minThreshold: 10,
        unit: "Tubes",
        urgency: "warning",
      },
    ];
  },

  /**
   * Fetches the 5 most recent bills
   */
  async getRecentBills(): Promise<RecentBillItem[]> {
    await new Promise((resolve) => setTimeout(resolve, 80));

    return [
      {
        id: "bill-1042",
        billNumber: "INV-2026-1042",
        customerName: "Ramesh Chandra Sharma",
        patientPhone: "+91 98234-XXXXX",
        doctorName: "Dr. A. K. Verma",
        dateTime: "Today, 04:15 PM",
        totalAmount: 1480,
        paymentMode: "UPI",
        itemCount: 4,
      },
      {
        id: "bill-1041",
        billNumber: "INV-2026-1041",
        customerName: "Pooja Malhotra",
        patientPhone: "+91 97110-XXXXX",
        doctorName: "Dr. Neha Gupta",
        dateTime: "Today, 03:50 PM",
        totalAmount: 620,
        paymentMode: "CASH",
        itemCount: 2,
      },
      {
        id: "bill-1040",
        billNumber: "INV-2026-1040",
        customerName: "Mohd. Tariq Ansari",
        patientPhone: "+91 94501-XXXXX",
        doctorName: "Dr. S. K. Roy",
        dateTime: "Today, 03:22 PM",
        totalAmount: 3240,
        paymentMode: "CARD",
        itemCount: 7,
      },
      {
        id: "bill-1039",
        billNumber: "INV-2026-1039",
        customerName: "Sunita Devi",
        patientPhone: "+91 93120-XXXXX",
        doctorName: "Dr. M. K. Jain",
        dateTime: "Today, 02:40 PM",
        totalAmount: 350,
        paymentMode: "CASH",
        itemCount: 1,
      },
      {
        id: "bill-1038",
        billNumber: "INV-2026-1038",
        customerName: "Vikramjeet Singh",
        patientPhone: "+91 98104-XXXXX",
        doctorName: "Dr. Harpreet Singh",
        dateTime: "Today, 01:15 PM",
        totalAmount: 2150,
        paymentMode: "UPI",
        itemCount: 5,
      },
    ];
  },
};

