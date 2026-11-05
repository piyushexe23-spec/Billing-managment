import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart3,
  Boxes,
  TrendingUp,
  CircleDollarSign,
  Receipt,
  Calendar,
  FileSpreadsheet,
  FileText,
  Search,
  ArrowUpDown,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import {
  GstSummaryReportData,
  ProfitReportData,
  ReportTab,
  SalesReportData,
  StockReportData,
  StockSubView,
  TopSellingReportItem,
} from "@/types/reports";
import { reportService } from "@/services/reportService";
import {
  formatIndianCurrency,
  formatDisplayDate,
} from "@/lib/billingConfig";

export type DatePreset =
  | "TODAY"
  | "YESTERDAY"
  | "LAST_7_DAYS"
  | "THIS_MONTH"
  | "LAST_MONTH"
  | "THIS_YEAR"
  | "ALL_TIME"
  | "CUSTOM";

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getPresetDates(preset: DatePreset): { fromDate: string; toDate: string } {
  const now = new Date();
  const todayStr = toLocalDateStr(now);

  switch (preset) {
    case "TODAY":
      return { fromDate: todayStr, toDate: todayStr };
    case "YESTERDAY": {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const s = toLocalDateStr(yest);
      return { fromDate: s, toDate: s };
    }
    case "LAST_7_DAYS": {
      const past7 = new Date(now);
      past7.setDate(past7.getDate() - 6);
      return { fromDate: toLocalDateStr(past7), toDate: todayStr };
    }
    case "THIS_MONTH": {
      const y = now.getFullYear();
      const m = now.getMonth();
      const firstDay = toLocalDateStr(new Date(y, m, 1));
      const lastDay = toLocalDateStr(new Date(y, m + 1, 0));
      return { fromDate: firstDay, toDate: lastDay };
    }
    case "LAST_MONTH": {
      const y = now.getFullYear();
      const m = now.getMonth() - 1;
      const firstDay = toLocalDateStr(new Date(y, m, 1));
      const lastDay = toLocalDateStr(new Date(y, m + 1, 0));
      return { fromDate: firstDay, toDate: lastDay };
    }
    case "THIS_YEAR": {
      const y = now.getFullYear();
      return { fromDate: `${y}-01-01`, toDate: `${y}-12-31` };
    }
    case "ALL_TIME":
    case "CUSTOM":
    default:
      return { fromDate: "", toDate: "" };
  }
}

export const ReportsPage: React.FC = () => {
  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<ReportTab>("SALES");

  // Shared Date Filter State (Default: THIS_MONTH)
  const [datePreset, setDatePreset] = useState<DatePreset>("THIS_MONTH");
  const initialThisMonth = getPresetDates("THIS_MONTH");
  const [customFrom, setCustomFrom] = useState<string>(initialThisMonth.fromDate);
  const [customTo, setCustomTo] = useState<string>(initialThisMonth.toDate);
  const [dateError, setDateError] = useState<string | null>(null);

  // Tab Data States
  const [salesData, setSalesData] = useState<SalesReportData | null>(null);
  const [stockData, setStockData] = useState<StockReportData | null>(null);
  const [topSellingData, setTopSellingData] = useState<TopSellingReportItem[]>([]);
  const [profitData, setProfitData] = useState<ProfitReportData | null>(null);
  const [gstData, setGstData] = useState<GstSummaryReportData | null>(null);

  // Tab Sub-Options
  const [salesGroupByMonth, setSalesGroupByMonth] = useState<boolean>(false);

  // Stock Sub-Options
  const [stockSubView, setStockSubView] = useState<StockSubView>("ALL");
  const [stockIncludeArchived, setStockIncludeArchived] = useState<boolean>(false);
  const [stockSearch, setStockSearch] = useState<string>("");
  const [stockSortField, setStockSortField] = useState<string>("name");
  const [stockSortDir, setStockSortDir] = useState<"asc" | "desc">("asc");
  const [stockPage, setStockPage] = useState<number>(1);
  const [stockPageSize, setStockPageSize] = useState<number>(10);

  // Top Selling Sub-Options
  const [topSortBy, setTopSortBy] = useState<"QUANTITY" | "REVENUE">("QUANTITY");
  const [topLimit, setTopLimit] = useState<number>(10);

  // Profit Sub-Options
  const [profitViewMode, setProfitViewMode] = useState<"BY_DATE" | "BY_MEDICINE">("BY_DATE");
  const [profitGroupByMonth, setProfitGroupByMonth] = useState<boolean>(false);

  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Active Date Range Resolver
  const activeDateRange = useMemo(() => {
    if (datePreset === "CUSTOM") {
      return { fromDate: customFrom, toDate: customTo };
    }
    return getPresetDates(datePreset);
  }, [datePreset, customFrom, customTo]);

  // Load Data for Active Tab
  const loadActiveTabData = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const from = activeDateRange.fromDate || null;
      const to = activeDateRange.toDate || null;

      if (activeTab === "SALES") {
        const res = await reportService.getSalesReport(from, to, salesGroupByMonth);
        setSalesData(res);
      } else if (activeTab === "STOCK") {
        const res = await reportService.getStockReport(
          stockSubView,
          stockIncludeArchived,
          stockSearch
        );
        setStockData(res);
      } else if (activeTab === "TOP_SELLING") {
        const res = await reportService.getTopSellingReport(
          from,
          to,
          topSortBy,
          topLimit === 0 ? undefined : topLimit
        );
        setTopSellingData(res);
      } else if (activeTab === "PROFIT") {
        const res = await reportService.getProfitReport(from, to, profitGroupByMonth);
        setProfitData(res);
      } else if (activeTab === "GST_SUMMARY") {
        const res = await reportService.getGstSummaryReport(from, to);
        setGstData(res);
      }
    } catch (err: unknown) {
      console.error("Failed to load report data:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: "error", text: `Failed to load report: ${msg}` });
    } finally {
      setIsLoading(false);
    }
  }, [
    activeTab,
    activeDateRange,
    salesGroupByMonth,
    stockSubView,
    stockIncludeArchived,
    stockSearch,
    topSortBy,
    topLimit,
    profitGroupByMonth,
  ]);

  useEffect(() => {
    loadActiveTabData();
  }, [loadActiveTabData]);

  // Date Preset Change Handler
  const handlePresetSelect = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== "CUSTOM") {
      setDateError(null);
      const dates = getPresetDates(preset);
      setCustomFrom(dates.fromDate);
      setCustomTo(dates.toDate);
    }
  };

  // Custom Date Validation
  const handleCustomDateChange = (from: string, to: string) => {
    setCustomFrom(from);
    setCustomTo(to);
    if (from && to && from > to) {
      setDateError("'From Date' cannot be after 'To Date'");
    } else {
      setDateError(null);
    }
  };

  // Helper: Display Date Range Text
  const dateRangeDisplay = useMemo(() => {
    if (activeTab === "STOCK") {
      return `Current Live Stock as of ${toLocalDateStr(new Date())}`;
    }
    if (datePreset === "ALL_TIME" || (!activeDateRange.fromDate && !activeDateRange.toDate)) {
      return "All Time (All records)";
    }
    if (activeDateRange.fromDate && activeDateRange.toDate) {
      if (activeDateRange.fromDate === activeDateRange.toDate) {
        return formatDisplayDate(activeDateRange.fromDate);
      }
      return `${formatDisplayDate(activeDateRange.fromDate)} – ${formatDisplayDate(
        activeDateRange.toDate
      )}`;
    }
    return activeDateRange.fromDate
      ? `From ${formatDisplayDate(activeDateRange.fromDate)}`
      : `Up to ${formatDisplayDate(activeDateRange.toDate)}`;
  }, [activeTab, datePreset, activeDateRange]);

  // Store Name resolution helper
  const getStoreName = (): string => {
    try {
      const stored = localStorage.getItem("im_medicos_store_details_singleton_v1");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.storeName) return parsed.storeName;
      }
    } catch {}
    return "IM MEDICOS";
  };

  // Export Handlers
  const handleExportExcel = async () => {
    const store = getStoreName();
    const dateSlug = `${activeDateRange.fromDate || "all"}_to_${activeDateRange.toDate || "all"}`;
    setStatusMessage(null);

    try {
      if (activeTab === "SALES" && salesData) {
        const headers = ["Period", "Bills Count", "Gross Sales", "Discount", "Net Sales"];
        const rows = salesData.rows.map((r) => [
          r.period,
          r.billsCount,
          r.grossSales,
          r.discount,
          r.netSales,
        ]);
        const totalsRow = [
          "TOTAL",
          salesData.summary.totalBills,
          salesData.summary.grossSales,
          salesData.summary.totalDiscount,
          salesData.summary.netSales,
        ];
        await reportService.exportToExcel(
          "Sales Report",
          store,
          dateRangeDisplay,
          headers,
          rows,
          totalsRow,
          `Sales_Report_${dateSlug}.xlsx`
        );
      } else if (activeTab === "STOCK" && stockData) {
        const headers = [
          "Medicine Name",
          "Manufacturer",
          "Batch No",
          "Expiry Date",
          "Quantity",
          "Unit",
          "Cost Price",
          "MRP",
          "Selling Price",
          "Status",
        ];
        const rows = stockData.items.map((i) => [
          i.medicineName,
          i.manufacturer,
          i.batchNumber,
          i.expDate,
          i.quantity,
          i.unit,
          i.costPrice,
          i.mrp,
          i.sellingPrice,
          i.stockStatus,
        ]);
        const totalsRow = [
          "TOTAL UNITS",
          "",
          "",
          "",
          stockData.summary.totalStockUnits,
          "",
          stockData.summary.stockValueCost,
          stockData.summary.stockValueMrp,
          "",
          "",
        ];
        await reportService.exportToExcel(
          "Stock Report",
          store,
          dateRangeDisplay,
          headers,
          rows,
          totalsRow,
          `Stock_Report_${toLocalDateStr(new Date())}.xlsx`
        );
      } else if (activeTab === "TOP_SELLING") {
        const headers = [
          "Rank",
          "Medicine Name",
          "Manufacturer",
          "Quantity Sold",
          "Bills Count",
          "Revenue",
        ];
        const rows = topSellingData.map((t) => [
          t.rank,
          t.medicineName,
          t.manufacturer,
          t.quantitySold,
          t.billsCount,
          t.revenue,
        ]);
        const totalRevenue = topSellingData.reduce((acc, i) => acc + i.revenue, 0);
        const totalQty = topSellingData.reduce((acc, i) => acc + i.quantitySold, 0);
        const totalsRow = [
          "TOTAL",
          "",
          "",
          totalQty,
          "",
          Math.round(totalRevenue * 100) / 100,
        ];
        await reportService.exportToExcel(
          "Top Selling Medicines Report",
          store,
          dateRangeDisplay,
          headers,
          rows,
          totalsRow,
          `Top_Selling_Report_${dateSlug}.xlsx`
        );
      } else if (activeTab === "PROFIT" && profitData) {
        if (profitViewMode === "BY_DATE") {
          const headers = [
            "Period",
            "Quantity Sold",
            "Revenue",
            "Cost of Goods (COGS)",
            "Gross Profit",
            "Margin %",
          ];
          const rows = profitData.byDate.map((d) => [
            d.period,
            d.quantitySold,
            d.revenue,
            d.cogs,
            d.grossProfit,
            `${d.marginPercent.toFixed(2)}%`,
          ]);
          const totalsRow = [
            "TOTAL",
            profitData.byDate.reduce((acc, i) => acc + i.quantitySold, 0),
            profitData.summary.revenue,
            profitData.summary.cogs,
            profitData.summary.grossProfit,
            `${profitData.summary.marginPercent.toFixed(2)}%`,
          ];
          await reportService.exportToExcel(
            "Profit Report (By Date) [INTERNAL]",
            store,
            dateRangeDisplay,
            headers,
            rows,
            totalsRow,
            `Profit_Report_ByDate_${dateSlug}.xlsx`
          );
        } else {
          const headers = [
            "Medicine Name",
            "Manufacturer",
            "Quantity Sold",
            "Revenue",
            "Cost of Goods (COGS)",
            "Gross Profit",
            "Margin %",
          ];
          const rows = profitData.byMedicine.map((m) => [
            m.medicineName,
            m.manufacturer,
            m.quantitySold,
            m.revenue,
            m.cogs,
            m.grossProfit,
            `${m.marginPercent.toFixed(2)}%`,
          ]);
          const totalsRow = [
            "TOTAL",
            "",
            profitData.byMedicine.reduce((acc, i) => acc + i.quantitySold, 0),
            profitData.summary.revenue,
            profitData.summary.cogs,
            profitData.summary.grossProfit,
            `${profitData.summary.marginPercent.toFixed(2)}%`,
          ];
          await reportService.exportToExcel(
            "Profit Report (By Medicine) [INTERNAL]",
            store,
            dateRangeDisplay,
            headers,
            rows,
            totalsRow,
            `Profit_Report_ByMedicine_${dateSlug}.xlsx`
          );
        }
      } else if (activeTab === "GST_SUMMARY" && gstData) {
        const headers = [
          "Date",
          "Bills Count",
          "Billed Amount",
          "Taxable Value",
          "CGST (9%)",
          "SGST (9%)",
          "Total GST (18%)",
        ];
        const rows = gstData.rows.map((r) => [
          r.date,
          r.billsCount,
          r.billedAmount,
          r.taxableValue,
          r.cgst,
          r.sgst,
          r.totalGst,
        ]);
        const totalsRow = [
          "TOTAL",
          gstData.summary.billsCount,
          gstData.summary.totalBilledAmount,
          gstData.summary.totalTaxableValue,
          gstData.summary.totalCgst,
          gstData.summary.totalSgst,
          gstData.summary.totalGst,
        ];
        await reportService.exportToExcel(
          "GST Summary Report",
          store,
          dateRangeDisplay,
          headers,
          rows,
          totalsRow,
          `GST_Summary_Report_${dateSlug}.xlsx`
        );
      }
      setStatusMessage({ type: "success", text: "Excel file exported successfully." });
    } catch (err: unknown) {
      console.error("Export Excel error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: "error", text: `Excel export failed: ${msg}` });
    }
  };

  const handleExportPdf = async () => {
    const store = getStoreName();
    const dateSlug = `${activeDateRange.fromDate || "all"}_to_${activeDateRange.toDate || "all"}`;
    setStatusMessage(null);

    try {
      if (activeTab === "SALES" && salesData) {
        const headers = ["Period", "Bills Count", "Gross Sales", "Discount", "Net Sales"];
        const rows = salesData.rows.map((r) => [
          r.period,
          r.billsCount,
          r.grossSales,
          r.discount,
          r.netSales,
        ]);
        const totalsRow = [
          "TOTAL",
          salesData.summary.totalBills,
          salesData.summary.grossSales,
          salesData.summary.totalDiscount,
          salesData.summary.netSales,
        ];
        await reportService.exportToPdf(
          "Sales Report",
          store,
          dateRangeDisplay,
          headers,
          rows,
          totalsRow,
          `Sales_Report_${dateSlug}.pdf`,
          false
        );
      } else if (activeTab === "STOCK" && stockData) {
        const headers = [
          "Medicine Name",
          "Manufacturer",
          "Batch No",
          "Expiry Date",
          "Quantity",
          "Unit",
          "Cost Price",
          "MRP",
          "Selling Price",
          "Status",
        ];
        const rows = stockData.items.map((i) => [
          i.medicineName,
          i.manufacturer,
          i.batchNumber,
          i.expDate,
          i.quantity,
          i.unit,
          i.costPrice,
          i.mrp,
          i.sellingPrice,
          i.stockStatus,
        ]);
        const totalsRow = [
          "TOTAL UNITS",
          "",
          "",
          "",
          stockData.summary.totalStockUnits,
          "",
          stockData.summary.stockValueCost,
          stockData.summary.stockValueMrp,
          "",
          "",
        ];
        await reportService.exportToPdf(
          "Stock Report",
          store,
          dateRangeDisplay,
          headers,
          rows,
          totalsRow,
          `Stock_Report_${toLocalDateStr(new Date())}.pdf`,
          false
        );
      } else if (activeTab === "TOP_SELLING") {
        const headers = [
          "Rank",
          "Medicine Name",
          "Manufacturer",
          "Quantity Sold",
          "Bills Count",
          "Revenue",
        ];
        const rows = topSellingData.map((t) => [
          t.rank,
          t.medicineName,
          t.manufacturer,
          t.quantitySold,
          t.billsCount,
          t.revenue,
        ]);
        const totalRevenue = topSellingData.reduce((acc, i) => acc + i.revenue, 0);
        const totalQty = topSellingData.reduce((acc, i) => acc + i.quantitySold, 0);
        const totalsRow = [
          "TOTAL",
          "",
          "",
          totalQty,
          "",
          Math.round(totalRevenue * 100) / 100,
        ];
        await reportService.exportToPdf(
          "Top Selling Medicines Report",
          store,
          dateRangeDisplay,
          headers,
          rows,
          totalsRow,
          `Top_Selling_Report_${dateSlug}.pdf`,
          false
        );
      } else if (activeTab === "PROFIT" && profitData) {
        if (profitViewMode === "BY_DATE") {
          const headers = [
            "Period",
            "Quantity Sold",
            "Revenue",
            "Cost of Goods (COGS)",
            "Gross Profit",
            "Margin %",
          ];
          const rows = profitData.byDate.map((d) => [
            d.period,
            d.quantitySold,
            d.revenue,
            d.cogs,
            d.grossProfit,
            `${d.marginPercent.toFixed(2)}%`,
          ]);
          const totalsRow = [
            "TOTAL",
            profitData.byDate.reduce((acc, i) => acc + i.quantitySold, 0),
            profitData.summary.revenue,
            profitData.summary.cogs,
            profitData.summary.grossProfit,
            `${profitData.summary.marginPercent.toFixed(2)}%`,
          ];
          await reportService.exportToPdf(
            "Profit Report (By Date)",
            store,
            dateRangeDisplay,
            headers,
            rows,
            totalsRow,
            `Profit_Report_ByDate_${dateSlug}.pdf`,
            true
          );
        } else {
          const headers = [
            "Medicine Name",
            "Manufacturer",
            "Quantity Sold",
            "Revenue",
            "Cost of Goods (COGS)",
            "Gross Profit",
            "Margin %",
          ];
          const rows = profitData.byMedicine.map((m) => [
            m.medicineName,
            m.manufacturer,
            m.quantitySold,
            m.revenue,
            m.cogs,
            m.grossProfit,
            `${m.marginPercent.toFixed(2)}%`,
          ]);
          const totalsRow = [
            "TOTAL",
            "",
            profitData.byMedicine.reduce((acc, i) => acc + i.quantitySold, 0),
            profitData.summary.revenue,
            profitData.summary.cogs,
            profitData.summary.grossProfit,
            `${profitData.summary.marginPercent.toFixed(2)}%`,
          ];
          await reportService.exportToPdf(
            "Profit Report (By Medicine)",
            store,
            dateRangeDisplay,
            headers,
            rows,
            totalsRow,
            `Profit_Report_ByMedicine_${dateSlug}.pdf`,
            true
          );
        }
      } else if (activeTab === "GST_SUMMARY" && gstData) {
        const headers = [
          "Date",
          "Bills Count",
          "Billed Amount",
          "Taxable Value",
          "CGST (9%)",
          "SGST (9%)",
          "Total GST (18%)",
        ];
        const rows = gstData.rows.map((r) => [
          r.date,
          r.billsCount,
          r.billedAmount,
          r.taxableValue,
          r.cgst,
          r.sgst,
          r.totalGst,
        ]);
        const totalsRow = [
          "TOTAL",
          gstData.summary.billsCount,
          gstData.summary.totalBilledAmount,
          gstData.summary.totalTaxableValue,
          gstData.summary.totalCgst,
          gstData.summary.totalSgst,
          gstData.summary.totalGst,
        ];
        await reportService.exportToPdf(
          "GST Summary Report",
          store,
          dateRangeDisplay,
          headers,
          rows,
          totalsRow,
          `GST_Summary_Report_${dateSlug}.pdf`,
          false
        );
      }
      setStatusMessage({ type: "success", text: "PDF export ready." });
    } catch (err: unknown) {
      console.error("Export PDF error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({ type: "error", text: `PDF export failed: ${msg}` });
    }
  };

  // Stock table sorting & pagination
  const sortedStockItems = useMemo(() => {
    if (!stockData) return [];
    const items = [...stockData.items];
    items.sort((a, b) => {
      let cmp = 0;
      if (stockSortField === "name") {
        cmp = a.medicineName.localeCompare(b.medicineName);
      } else if (stockSortField === "batch") {
        cmp = a.batchNumber.localeCompare(b.batchNumber);
      } else if (stockSortField === "expiry") {
        cmp = a.expDate.localeCompare(b.expDate);
      } else if (stockSortField === "qty") {
        cmp = a.quantity - b.quantity;
      } else if (stockSortField === "cost") {
        cmp = a.costPrice - b.costPrice;
      } else if (stockSortField === "mrp") {
        cmp = a.mrp - b.mrp;
      }
      return stockSortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [stockData, stockSortField, stockSortDir]);

  const paginatedStockItems = useMemo(() => {
    const start = (stockPage - 1) * stockPageSize;
    return sortedStockItems.slice(start, start + stockPageSize);
  }, [sortedStockItems, stockPage, stockPageSize]);

  const totalStockPages = Math.ceil(sortedStockItems.length / stockPageSize) || 1;

  const handleStockSort = (field: string) => {
    if (stockSortField === field) {
      setStockSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setStockSortField(field);
      setStockSortDir("asc");
    }
  };

  return (
    <div className="flex-1 bg-medical-slate-50 min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-medical-slate-200">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-medical-navy-900 text-white shadow-md">
                <BarChart3 className="h-6 w-6 text-medical-green-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-medical-navy-900 tracking-tight">
                  Reports
                </h1>
                <p className="text-sm text-medical-slate-500 font-medium">
                  Sales, stock and profit reports.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-xl hover:bg-emerald-100 active:bg-emerald-200 transition shadow-sm"
              title="Export filtered report to Microsoft Excel (.xlsx)"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Export Excel
            </button>
            <button
              onClick={handleExportPdf}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-medical-navy-900 bg-white border border-medical-slate-300 rounded-xl hover:bg-medical-slate-50 active:bg-medical-slate-100 transition shadow-sm"
              title="Export filtered report to A4 Landscape PDF / Print"
            >
              <FileText className="h-4 w-4 text-medical-navy-700" />
              Export PDF
            </button>
            <button
              onClick={loadActiveTabData}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-medical-slate-600 bg-white border border-medical-slate-300 rounded-xl hover:bg-medical-slate-50 transition shadow-sm ml-1"
              title="Refresh report data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold shadow-sm ${
              statusMessage.type === "success"
                ? "bg-medical-green-50 border-medical-green-300 text-medical-green-900"
                : statusMessage.type === "error"
                ? "bg-red-50 border-red-300 text-red-900"
                : "bg-blue-50 border-blue-300 text-blue-900"
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-medical-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-600 font-bold px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-medical-slate-200/80 rounded-2xl w-fit overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab("SALES")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "SALES"
                ? "bg-white text-medical-navy-900 shadow-sm"
                : "text-medical-slate-600 hover:text-medical-navy-900"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Sales
          </button>
          <button
            onClick={() => setActiveTab("STOCK")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "STOCK"
                ? "bg-white text-medical-navy-900 shadow-sm"
                : "text-medical-slate-600 hover:text-medical-navy-900"
            }`}
          >
            <Boxes className="h-3.5 w-3.5" />
            Stock
          </button>
          <button
            onClick={() => setActiveTab("TOP_SELLING")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "TOP_SELLING"
                ? "bg-white text-medical-navy-900 shadow-sm"
                : "text-medical-slate-600 hover:text-medical-navy-900"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Top Selling
          </button>
          <button
            onClick={() => setActiveTab("PROFIT")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "PROFIT"
                ? "bg-white text-medical-navy-900 shadow-sm"
                : "text-medical-slate-600 hover:text-medical-navy-900"
            }`}
          >
            <CircleDollarSign className="h-3.5 w-3.5 text-medical-green-600" />
            Profit
            <span className="px-1.5 py-0.2 rounded text-[9px] bg-red-100 text-red-700 font-extrabold uppercase">
              Internal
            </span>
          </button>
          <button
            onClick={() => setActiveTab("GST_SUMMARY")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "GST_SUMMARY"
                ? "bg-white text-medical-navy-900 shadow-sm"
                : "text-medical-slate-600 hover:text-medical-navy-900"
            }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            GST Summary
          </button>
        </div>

        {/* SHARED DATE FILTER BAR (Shown for date-based tabs: Sales, Top Selling, Profit, GST Summary) */}
        {activeTab !== "STOCK" && (
          <div className="bg-white rounded-2xl border border-medical-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Presets Row */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    { id: "TODAY", label: "Today" },
                    { id: "YESTERDAY", label: "Yesterday" },
                    { id: "LAST_7_DAYS", label: "Last 7 Days" },
                    { id: "THIS_MONTH", label: "This Month" },
                    { id: "LAST_MONTH", label: "Last Month" },
                    { id: "THIS_YEAR", label: "This Year" },
                    { id: "ALL_TIME", label: "All Time" },
                    { id: "CUSTOM", label: "Custom Range" },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePresetSelect(p.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      datePreset === p.id
                        ? "bg-medical-navy-900 text-white shadow-sm"
                        : "bg-medical-slate-100 text-medical-slate-600 hover:bg-medical-slate-200"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Active Range Badge */}
              <div className="flex items-center gap-2 text-xs text-medical-slate-500 font-medium">
                <Calendar className="h-4 w-4 text-medical-navy-700 shrink-0" />
                <span>
                  Active Range:{" "}
                  <strong className="text-medical-navy-900 font-mono">
                    {dateRangeDisplay}
                  </strong>
                </span>
              </div>
            </div>

            {/* Custom Range Date Pickers (if Custom selected) */}
            {datePreset === "CUSTOM" && (
              <div className="pt-2 border-t border-medical-slate-100 flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <label className="font-semibold text-medical-slate-700">From:</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => handleCustomDateChange(e.target.value, customTo)}
                    className="px-2.5 py-1.5 rounded-lg border border-medical-slate-300 focus:outline-none focus:ring-1 focus:ring-medical-navy-800 text-xs font-mono"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="font-semibold text-medical-slate-700">To:</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => handleCustomDateChange(customFrom, e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-medical-slate-300 focus:outline-none focus:ring-1 focus:ring-medical-navy-800 text-xs font-mono"
                  />
                </div>
                {dateError && (
                  <span className="text-xs text-red-600 font-semibold flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {dateError}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: SALES REPORT */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "SALES" && salesData && (
          <div className="space-y-6">
            {/* Sales Summary KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white rounded-2xl border border-medical-slate-200 p-4 shadow-sm">
                <span className="block text-[11px] font-bold text-medical-slate-500 uppercase tracking-wider">
                  Total Bills
                </span>
                <span className="text-xl font-bold text-medical-navy-900 tabular-nums">
                  {salesData.summary.totalBills}
                </span>
                <span className="block text-[10px] text-medical-slate-400 mt-0.5">
                  In selected range
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-medical-slate-200 p-4 shadow-sm">
                <span className="block text-[11px] font-bold text-medical-slate-500 uppercase tracking-wider">
                  Gross Sales
                </span>
                <span className="text-xl font-bold text-medical-navy-900 tabular-nums">
                  {formatIndianCurrency(salesData.summary.grossSales)}
                </span>
                <span className="block text-[10px] text-medical-slate-400 mt-0.5">
                  Sum of sub-totals
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-medical-slate-200 p-4 shadow-sm">
                <span className="block text-[11px] font-bold text-medical-slate-500 uppercase tracking-wider">
                  Total Discount
                </span>
                <span className="text-xl font-bold text-amber-600 tabular-nums">
                  {formatIndianCurrency(salesData.summary.totalDiscount)}
                </span>
                <span className="block text-[10px] text-medical-slate-400 mt-0.5">
                  Concessions given
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-medical-slate-200 p-4 shadow-sm">
                <span className="block text-[11px] font-bold text-medical-slate-500 uppercase tracking-wider">
                  Net Sales
                </span>
                <span className="text-xl font-bold text-medical-green-600 tabular-nums">
                  {formatIndianCurrency(salesData.summary.netSales)}
                </span>
                <span className="block text-[10px] text-medical-slate-400 mt-0.5">
                  Total billed revenue
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-medical-slate-200 p-4 shadow-sm">
                <span className="block text-[11px] font-bold text-medical-slate-500 uppercase tracking-wider">
                  Avg Bill Value
                </span>
                <span className="text-xl font-bold text-medical-navy-900 tabular-nums">
                  {formatIndianCurrency(salesData.summary.averageBillValue)}
                </span>
                <span className="block text-[10px] text-medical-slate-400 mt-0.5">
                  Per customer transaction
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-medical-slate-200 p-4 shadow-sm space-y-1">
                <span className="block text-[11px] font-bold text-medical-slate-500 uppercase tracking-wider">
                  Payment Split
                </span>
                <div className="text-[11px] font-mono space-y-0.5 text-medical-slate-700">
                  <div className="flex justify-between">
                    <span>Cash:</span>
                    <strong className="text-medical-navy-900">
                      {formatIndianCurrency(salesData.summary.cashSales)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>UPI:</span>
                    <strong className="text-medical-navy-900">
                      {formatIndianCurrency(salesData.summary.upiSales)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Card:</span>
                    <strong className="text-medical-navy-900">
                      {formatIndianCurrency(salesData.summary.cardSales)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Sales Table with Grouping Toggle */}
            <div className="bg-white rounded-2xl border border-medical-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-medical-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-medical-navy-900">
                    Daily Sales Summary
                  </h3>
                  <p className="text-xs text-medical-slate-500">
                    Billed totals grouped chronologically (newest first).
                  </p>
                </div>

                <div className="flex items-center gap-1.5 p-1 bg-medical-slate-100 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setSalesGroupByMonth(false)}
                    className={`px-3 py-1 rounded-lg transition ${
                      !salesGroupByMonth
                        ? "bg-white text-medical-navy-900 shadow-sm"
                        : "text-medical-slate-600 hover:text-medical-navy-900"
                    }`}
                  >
                    Group by Day
                  </button>
                  <button
                    onClick={() => setSalesGroupByMonth(true)}
                    className={`px-3 py-1 rounded-lg transition ${
                      salesGroupByMonth
                        ? "bg-white text-medical-navy-900 shadow-sm"
                        : "text-medical-slate-600 hover:text-medical-navy-900"
                    }`}
                  >
                    Group by Month
                  </button>
                </div>
              </div>

              {salesData.rows.length === 0 ? (
                <div className="p-12 text-center text-medical-slate-400">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold">No sales recorded for this date range.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-medical-slate-100/75 border-b border-medical-slate-200 text-medical-slate-600 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Period</th>
                        <th className="py-3 px-4 text-right">Bills Count</th>
                        <th className="py-3 px-4 text-right">Gross Sales</th>
                        <th className="py-3 px-4 text-right">Discount</th>
                        <th className="py-3 px-4 text-right">Net Sales</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-medical-slate-100">
                      {salesData.rows.map((r) => (
                        <tr key={r.period} className="hover:bg-medical-slate-50 transition">
                          <td className="py-2.5 px-4 font-mono font-semibold text-medical-navy-900">
                            {salesGroupByMonth ? r.period : formatDisplayDate(r.period)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums font-semibold">
                            {r.billsCount}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-medical-slate-700">
                            {formatIndianCurrency(r.grossSales)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-amber-600">
                            {formatIndianCurrency(r.discount)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums font-bold text-medical-navy-900">
                            {formatIndianCurrency(r.netSales)}
                          </td>
                        </tr>
                      ))}
                      {/* Sticky Totals Row */}
                      <tr className="bg-medical-slate-100 font-bold border-t-2 border-medical-slate-300 text-medical-navy-900">
                        <td className="py-3 px-4">TOTAL</td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {salesData.summary.totalBills}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {formatIndianCurrency(salesData.summary.grossSales)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-amber-600">
                          {formatIndianCurrency(salesData.summary.totalDiscount)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-medical-green-700 font-extrabold">
                          {formatIndianCurrency(salesData.summary.netSales)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Supplementary Breakdowns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Payment Mode Breakdown */}
              <div className="bg-white rounded-2xl border border-medical-slate-200 p-4 shadow-sm space-y-3">
                <h4 className="text-xs font-bold text-medical-navy-900 uppercase tracking-wider">
                  Sales by Payment Mode
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-medical-slate-50 border border-medical-slate-100">
                    <div>
                      <span className="font-bold text-medical-navy-900 block">Cash</span>
                      <span className="text-[10px] text-medical-slate-500">
                        {salesData.summary.cashBillsCount} bills
                      </span>
                    </div>
                    <span className="font-bold font-mono text-medical-navy-900">
                      {formatIndianCurrency(salesData.summary.cashSales)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-medical-slate-50 border border-medical-slate-100">
                    <div>
                      <span className="font-bold text-medical-navy-900 block">UPI / QR</span>
                      <span className="text-[10px] text-medical-slate-500">
                        {salesData.summary.upiBillsCount} bills
                      </span>
                    </div>
                    <span className="font-bold font-mono text-medical-navy-900">
                      {formatIndianCurrency(salesData.summary.upiSales)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-medical-slate-50 border border-medical-slate-100">
                    <div>
                      <span className="font-bold text-medical-navy-900 block">Card</span>
                      <span className="text-[10px] text-medical-slate-500">
                        {salesData.summary.cardBillsCount} bills
                      </span>
                    </div>
                    <span className="font-bold font-mono text-medical-navy-900">
                      {formatIndianCurrency(salesData.summary.cardSales)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Discount vs Non-Discount Breakdown */}
              <div className="bg-white rounded-2xl border border-medical-slate-200 p-4 shadow-sm space-y-3">
                <h4 className="text-xs font-bold text-medical-navy-900 uppercase tracking-wider">
                  Discounted vs. Non-Discount Sales
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-medical-slate-50 border border-medical-slate-100">
                    <div>
                      <span className="font-bold text-medical-navy-900 block">
                        Discounted Bills
                      </span>
                      <span className="text-[10px] text-medical-slate-500">
                        {salesData.summary.discountedBillsCount} bills
                      </span>
                    </div>
                    <span className="font-bold font-mono text-amber-600">
                      {formatIndianCurrency(salesData.summary.discountedBillsAmount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-medical-slate-50 border border-medical-slate-100">
                    <div>
                      <span className="font-bold text-medical-navy-900 block">
                        Standard (Non-Discount) Bills
                      </span>
                      <span className="text-[10px] text-medical-slate-500">
                        {salesData.summary.nonDiscountBillsCount} bills
                      </span>
                    </div>
                    <span className="font-bold font-mono text-medical-navy-900">
                      {formatIndianCurrency(salesData.summary.nonDiscountBillsAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: STOCK REPORT */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "STOCK" && stockData && (
          <div className="space-y-6">
            {/* 8 Stock KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <div className="bg-white rounded-xl border border-medical-slate-200 p-3 shadow-sm">
                <span className="block text-[10px] font-bold text-medical-slate-500 uppercase">
                  Active Medicines
                </span>
                <span className="text-lg font-bold text-medical-navy-900 tabular-nums">
                  {stockData.summary.totalActiveMedicines}
                </span>
              </div>

              <div className="bg-white rounded-xl border border-medical-slate-200 p-3 shadow-sm">
                <span className="block text-[10px] font-bold text-medical-slate-500 uppercase">
                  Total Units
                </span>
                <span className="text-lg font-bold text-medical-navy-900 tabular-nums">
                  {stockData.summary.totalStockUnits}
                </span>
              </div>

              <div className="bg-white rounded-xl border border-medical-slate-200 p-3 shadow-sm">
                <span className="block text-[10px] font-bold text-medical-slate-500 uppercase">
                  Value at Cost
                </span>
                <span className="text-sm font-bold text-medical-navy-900 tabular-nums">
                  {formatIndianCurrency(stockData.summary.stockValueCost)}
                </span>
              </div>

              <div className="bg-white rounded-xl border border-medical-slate-200 p-3 shadow-sm">
                <span className="block text-[10px] font-bold text-medical-slate-500 uppercase">
                  Value at MRP
                </span>
                <span className="text-sm font-bold text-medical-navy-900 tabular-nums">
                  {formatIndianCurrency(stockData.summary.stockValueMrp)}
                </span>
              </div>

              <div className="bg-white rounded-xl border border-medical-slate-200 p-3 shadow-sm">
                <span className="block text-[10px] font-bold text-amber-700 uppercase">
                  Low Stock
                </span>
                <span className="text-lg font-bold text-amber-600 tabular-nums">
                  {stockData.summary.lowStockCount}
                </span>
              </div>

              <div className="bg-white rounded-xl border border-medical-slate-200 p-3 shadow-sm">
                <span className="block text-[10px] font-bold text-red-700 uppercase">
                  Out of Stock
                </span>
                <span className="text-lg font-bold text-red-600 tabular-nums">
                  {stockData.summary.outOfStockCount}
                </span>
              </div>

              <div className="bg-white rounded-xl border border-medical-slate-200 p-3 shadow-sm">
                <span className="block text-[10px] font-bold text-amber-700 uppercase">
                  Expiring Soon
                </span>
                <span className="text-lg font-bold text-amber-600 tabular-nums">
                  {stockData.summary.expiringSoonCount}
                </span>
              </div>

              <div className="bg-white rounded-xl border border-medical-slate-200 p-3 shadow-sm">
                <span className="block text-[10px] font-bold text-red-700 uppercase">
                  Expired
                </span>
                <span className="text-lg font-bold text-red-600 tabular-nums">
                  {stockData.summary.expiredCount}
                </span>
              </div>
            </div>

            {/* Filter Chips & Search Bar */}
            <div className="bg-white rounded-2xl border border-medical-slate-200 shadow-sm p-4 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Sub-view Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(
                    [
                      { id: "ALL", label: "All Stock" },
                      { id: "LOW_STOCK", label: "Low Stock" },
                      { id: "OUT_OF_STOCK", label: "Out of Stock" },
                      { id: "EXPIRING_SOON", label: "Expiring Soon" },
                      { id: "EXPIRED", label: "Expired" },
                      { id: "BATCH_WISE", label: "Batch-wise" },
                    ] as const
                  ).map((chip) => (
                    <button
                      key={chip.id}
                      onClick={() => {
                        setStockSubView(chip.id);
                        setStockPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        stockSubView === chip.id
                          ? "bg-medical-navy-900 text-white shadow-sm"
                          : "bg-medical-slate-100 text-medical-slate-600 hover:bg-medical-slate-200"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* Include Archived toggle */}
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-medical-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={stockIncludeArchived}
                    onChange={(e) => {
                      setStockIncludeArchived(e.target.checked);
                      setStockPage(1);
                    }}
                    className="rounded border-medical-slate-300 text-medical-navy-900 focus:ring-medical-navy-900"
                  />
                  <span>Include archived medicines</span>
                </label>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-medical-slate-400" />
                <input
                  type="text"
                  value={stockSearch}
                  onChange={(e) => {
                    setStockSearch(e.target.value);
                    setStockPage(1);
                  }}
                  placeholder="Search by medicine name, manufacturer, or batch number..."
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-medical-slate-200 focus:outline-none focus:ring-1 focus:ring-medical-navy-800"
                />
              </div>
            </div>

            {/* Stock Table */}
            <div className="bg-white rounded-2xl border border-medical-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-medical-slate-100/75 border-b border-medical-slate-200 text-medical-slate-600 font-bold uppercase tracking-wider text-[11px]">
                      <th
                        onClick={() => handleStockSort("name")}
                        className="py-3 px-4 cursor-pointer hover:text-medical-navy-900"
                      >
                        <div className="flex items-center gap-1">
                          Medicine Name
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th className="py-3 px-4">Manufacturer</th>
                      <th
                        onClick={() => handleStockSort("batch")}
                        className="py-3 px-4 cursor-pointer hover:text-medical-navy-900"
                      >
                        <div className="flex items-center gap-1">
                          Batch No
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleStockSort("expiry")}
                        className="py-3 px-4 cursor-pointer hover:text-medical-navy-900"
                      >
                        <div className="flex items-center gap-1">
                          Expiry Date
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleStockSort("qty")}
                        className="py-3 px-4 text-right cursor-pointer hover:text-medical-navy-900"
                      >
                        <div className="flex items-center justify-end gap-1">
                          Qty
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th className="py-3 px-4">Unit</th>
                      <th
                        onClick={() => handleStockSort("cost")}
                        className="py-3 px-4 text-right cursor-pointer hover:text-medical-navy-900"
                      >
                        <div className="flex items-center justify-end gap-1">
                          Cost Price
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleStockSort("mrp")}
                        className="py-3 px-4 text-right cursor-pointer hover:text-medical-navy-900"
                      >
                        <div className="flex items-center justify-end gap-1">
                          MRP
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th className="py-3 px-4 text-right">Selling Price</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-medical-slate-100">
                    {paginatedStockItems.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-10 text-center text-medical-slate-400">
                          No stock records found matching filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedStockItems.map((item) => (
                        <tr key={item.id} className="hover:bg-medical-slate-50 transition">
                          <td className="py-2.5 px-4 font-semibold text-medical-navy-900">
                            {item.medicineName}
                            {item.isArchived && (
                              <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] bg-medical-slate-200 text-medical-slate-600 font-bold">
                                Archived
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-medical-slate-600">
                            {item.manufacturer || "—"}
                          </td>
                          <td className="py-2.5 px-4 font-mono">{item.batchNumber}</td>
                          <td className="py-2.5 px-4 font-mono">{item.expDate}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums font-bold text-medical-navy-900">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-4 text-medical-slate-500">{item.unit}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-medical-slate-700">
                            {formatIndianCurrency(item.costPrice)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-medical-slate-700">
                            {formatIndianCurrency(item.mrp)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-medical-navy-900">
                            {formatIndianCurrency(item.sellingPrice)}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                                item.stockStatus === "OUT_OF_STOCK"
                                  ? "bg-red-50 text-red-700 border border-red-200"
                                  : item.stockStatus === "LOW_STOCK"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              {item.stockStatus.replace("_", " ")}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination bar */}
              <div className="p-3 border-t border-medical-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-medical-slate-600">
                <div className="flex items-center gap-2">
                  <span>Show</span>
                  <select
                    value={stockPageSize}
                    onChange={(e) => {
                      setStockPageSize(Number(e.target.value));
                      setStockPage(1);
                    }}
                    className="px-2 py-1 rounded-lg border border-medical-slate-200 bg-white"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                  <span>rows per page</span>
                  <span className="text-medical-slate-400">|</span>
                  <span>
                    Showing {sortedStockItems.length > 0 ? (stockPage - 1) * stockPageSize + 1 : 0} to{" "}
                    {Math.min(stockPage * stockPageSize, sortedStockItems.length)} of{" "}
                    {sortedStockItems.length} records
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setStockPage((p) => Math.max(1, p - 1))}
                    disabled={stockPage <= 1}
                    className="p-1 rounded-lg border border-medical-slate-200 disabled:opacity-40 hover:bg-medical-slate-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-2 font-semibold">
                    Page {stockPage} of {totalStockPages}
                  </span>
                  <button
                    onClick={() => setStockPage((p) => Math.min(totalStockPages, p + 1))}
                    disabled={stockPage >= totalStockPages}
                    className="p-1 rounded-lg border border-medical-slate-200 disabled:opacity-40 hover:bg-medical-slate-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: TOP SELLING REPORT */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "TOP_SELLING" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-medical-slate-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-medical-navy-900">
                  Top Selling Medicines
                </h3>
                <p className="text-xs text-medical-slate-500">
                  Ranked by volume or revenue within selected date range based on bill item snapshots.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Sort Toggle */}
                <div className="flex items-center gap-1.5 p-1 bg-medical-slate-100 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setTopSortBy("QUANTITY")}
                    className={`px-3 py-1 rounded-lg transition ${
                      topSortBy === "QUANTITY"
                        ? "bg-white text-medical-navy-900 shadow-sm"
                        : "text-medical-slate-600 hover:text-medical-navy-900"
                    }`}
                  >
                    By Quantity
                  </button>
                  <button
                    onClick={() => setTopSortBy("REVENUE")}
                    className={`px-3 py-1 rounded-lg transition ${
                      topSortBy === "REVENUE"
                        ? "bg-white text-medical-navy-900 shadow-sm"
                        : "text-medical-slate-600 hover:text-medical-navy-900"
                    }`}
                  >
                    By Revenue
                  </button>
                </div>

                {/* Limit Selector */}
                <div className="flex items-center gap-1.5 p-1 bg-medical-slate-100 rounded-xl text-xs font-semibold">
                  {[10, 25, 50, 0].map((lim) => (
                    <button
                      key={lim}
                      onClick={() => setTopLimit(lim)}
                      className={`px-2.5 py-1 rounded-lg transition ${
                        topLimit === lim
                          ? "bg-white text-medical-navy-900 shadow-sm"
                          : "text-medical-slate-600 hover:text-medical-navy-900"
                      }`}
                    >
                      {lim === 0 ? "All" : `Top ${lim}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-medical-slate-200 shadow-sm overflow-hidden">
              {topSellingData.length === 0 ? (
                <div className="p-12 text-center text-medical-slate-400">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold">
                    No medicine sales found for this date range.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-medical-slate-100/75 border-b border-medical-slate-200 text-medical-slate-600 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4 w-16 text-center">Rank</th>
                        <th className="py-3 px-4">Medicine Name</th>
                        <th className="py-3 px-4">Manufacturer</th>
                        <th className="py-3 px-4 text-right">Quantity Sold</th>
                        <th className="py-3 px-4 text-right">Number of Bills</th>
                        <th className="py-3 px-4 text-right">Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-medical-slate-100">
                      {topSellingData.map((item) => (
                        <tr key={item.rank} className="hover:bg-medical-slate-50 transition">
                          <td className="py-2.5 px-4 text-center font-bold text-medical-navy-900">
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                                item.rank === 1
                                  ? "bg-amber-100 text-amber-800 font-extrabold"
                                  : item.rank === 2
                                  ? "bg-slate-200 text-slate-700 font-bold"
                                  : item.rank === 3
                                  ? "bg-amber-50 text-amber-900 font-semibold"
                                  : "text-medical-slate-500"
                              }`}
                            >
                              #{item.rank}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-medical-navy-900">
                            {item.medicineName}
                          </td>
                          <td className="py-2.5 px-4 text-medical-slate-600">
                            {item.manufacturer || "—"}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums font-bold text-medical-navy-900">
                            {item.quantitySold}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-medical-slate-700">
                            {item.billsCount}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums font-bold text-medical-green-700">
                            {formatIndianCurrency(item.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: PROFIT REPORT (INTERNAL OWNER ONLY) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "PROFIT" && profitData && (
          <div className="space-y-6">
            {/* Internal Safety Banner & Definition Note */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-amber-800">
                <Lock className="h-3.5 w-3.5 text-amber-600" />
                <span>Internal Owner View — Do Not Share</span>
              </div>
              <p className="text-xs text-amber-900">
                <strong>Gross profit definition:</strong> Gross profit = revenue minus cost price of
                items sold. Prices are GST-inclusive; GST is not separated in this figure.
              </p>
            </div>

            {/* Profit KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white rounded-2xl border border-medical-slate-200 p-4 shadow-sm">
                <span className="block text-[11px] font-bold text-medical-slate-500 uppercase tracking-wider">
                  Revenue
                </span>
                <span className="text-xl font-bold text-medical-navy-900 tabular-nums">
                  {formatIndianCurrency(profitData.summary.revenue)}
                </span>
                <span className="block text-[10px] text-medical-slate-400 mt-0.5">
                  Sum of billed line items
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-medical-slate-200 p-4 shadow-sm">
                <span className="block text-[11px] font-bold text-medical-slate-500 uppercase tracking-wider">
                  Cost of Goods (COGS)
                </span>
                <span className="text-xl font-bold text-medical-slate-700 tabular-nums">
                  {formatIndianCurrency(profitData.summary.cogs)}
                </span>
                <span className="block text-[10px] text-medical-slate-400 mt-0.5">
                  Snapshot cost at sale
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-medical-slate-200 p-4 shadow-sm">
                <span className="block text-[11px] font-bold text-medical-slate-500 uppercase tracking-wider">
                  Gross Profit
                </span>
                <span className="text-xl font-bold text-medical-green-600 tabular-nums">
                  {formatIndianCurrency(profitData.summary.grossProfit)}
                </span>
                <span className="block text-[10px] text-medical-slate-400 mt-0.5">
                  Revenue − COGS
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-medical-slate-200 p-4 shadow-sm">
                <span className="block text-[11px] font-bold text-medical-slate-500 uppercase tracking-wider">
                  Profit Margin
                </span>
                <span className="text-xl font-bold text-medical-navy-900 tabular-nums">
                  {profitData.summary.marginPercent.toFixed(2)}%
                </span>
                <span className="block text-[10px] text-medical-slate-400 mt-0.5">
                  (Profit / Revenue) × 100
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-medical-slate-200 p-4 shadow-sm">
                <span className="block text-[11px] font-bold text-medical-slate-500 uppercase tracking-wider">
                  Discount Given
                </span>
                <span className="text-xl font-bold text-amber-600 tabular-nums">
                  {formatIndianCurrency(profitData.summary.discountGiven)}
                </span>
                <span className="block text-[10px] text-medical-slate-400 mt-0.5">
                  Concessions absorbed
                </span>
              </div>
            </div>

            {/* Profit Tables with View Mode Toggle */}
            <div className="bg-white rounded-2xl border border-medical-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-medical-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-medical-navy-900">
                    {profitViewMode === "BY_DATE" ? "Profit by Date" : "Profit by Medicine"}
                  </h3>
                  <p className="text-xs text-medical-slate-500">
                    {profitViewMode === "BY_DATE"
                      ? "Chronological revenue, COGS, and profit margins."
                      : "Item-level gross profit and margins based on sale-time cost snapshot."}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {profitViewMode === "BY_DATE" && (
                    <div className="flex items-center gap-1.5 p-1 bg-medical-slate-100 rounded-xl text-xs font-semibold">
                      <button
                        onClick={() => setProfitGroupByMonth(false)}
                        className={`px-3 py-1 rounded-lg transition ${
                          !profitGroupByMonth
                            ? "bg-white text-medical-navy-900 shadow-sm"
                            : "text-medical-slate-600 hover:text-medical-navy-900"
                        }`}
                      >
                        By Day
                      </button>
                      <button
                        onClick={() => setProfitGroupByMonth(true)}
                        className={`px-3 py-1 rounded-lg transition ${
                          profitGroupByMonth
                            ? "bg-white text-medical-navy-900 shadow-sm"
                            : "text-medical-slate-600 hover:text-medical-navy-900"
                        }`}
                      >
                        By Month
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 p-1 bg-medical-slate-100 rounded-xl text-xs font-semibold">
                    <button
                      onClick={() => setProfitViewMode("BY_DATE")}
                      className={`px-3 py-1 rounded-lg transition ${
                        profitViewMode === "BY_DATE"
                          ? "bg-white text-medical-navy-900 shadow-sm"
                          : "text-medical-slate-600 hover:text-medical-navy-900"
                      }`}
                    >
                      By Date
                    </button>
                    <button
                      onClick={() => setProfitViewMode("BY_MEDICINE")}
                      className={`px-3 py-1 rounded-lg transition ${
                        profitViewMode === "BY_MEDICINE"
                          ? "bg-white text-medical-navy-900 shadow-sm"
                          : "text-medical-slate-600 hover:text-medical-navy-900"
                      }`}
                    >
                      By Medicine
                    </button>
                  </div>
                </div>
              </div>

              {profitViewMode === "BY_DATE" ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-medical-slate-100/75 border-b border-medical-slate-200 text-medical-slate-600 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Period</th>
                        <th className="py-3 px-4 text-right">Qty Sold</th>
                        <th className="py-3 px-4 text-right">Revenue</th>
                        <th className="py-3 px-4 text-right">COGS</th>
                        <th className="py-3 px-4 text-right">Gross Profit</th>
                        <th className="py-3 px-4 text-right">Margin %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-medical-slate-100">
                      {profitData.byDate.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-medical-slate-400">
                            No profit data found for this date range.
                          </td>
                        </tr>
                      ) : (
                        profitData.byDate.map((r) => (
                          <tr key={r.period} className="hover:bg-medical-slate-50 transition">
                            <td className="py-2.5 px-4 font-mono font-semibold text-medical-navy-900">
                              {profitGroupByMonth ? r.period : formatDisplayDate(r.period)}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums">{r.quantitySold}</td>
                            <td className="py-2.5 px-4 text-right tabular-nums text-medical-slate-700">
                              {formatIndianCurrency(r.revenue)}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums text-medical-slate-700">
                              {formatIndianCurrency(r.cogs)}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums font-bold text-medical-green-700">
                              {formatIndianCurrency(r.grossProfit)}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-medical-navy-900">
                              {r.marginPercent.toFixed(2)}%
                            </td>
                          </tr>
                        ))
                      )}
                      {profitData.byDate.length > 0 && (
                        <tr className="bg-medical-slate-100 font-bold border-t-2 border-medical-slate-300 text-medical-navy-900">
                          <td className="py-3 px-4">TOTAL</td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            {profitData.byDate.reduce((acc, i) => acc + i.quantitySold, 0)}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            {formatIndianCurrency(profitData.summary.revenue)}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            {formatIndianCurrency(profitData.summary.cogs)}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums text-medical-green-700 font-extrabold">
                            {formatIndianCurrency(profitData.summary.grossProfit)}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-extrabold">
                            {profitData.summary.marginPercent.toFixed(2)}%
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-medical-slate-100/75 border-b border-medical-slate-200 text-medical-slate-600 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Medicine Name</th>
                        <th className="py-3 px-4">Manufacturer</th>
                        <th className="py-3 px-4 text-right">Qty Sold</th>
                        <th className="py-3 px-4 text-right">Revenue</th>
                        <th className="py-3 px-4 text-right">COGS</th>
                        <th className="py-3 px-4 text-right">Gross Profit</th>
                        <th className="py-3 px-4 text-right">Margin %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-medical-slate-100">
                      {profitData.byMedicine.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-medical-slate-400">
                            No profit data found for this date range.
                          </td>
                        </tr>
                      ) : (
                        profitData.byMedicine.map((m) => (
                          <tr key={m.medicineName} className="hover:bg-medical-slate-50 transition">
                            <td className="py-2.5 px-4 font-semibold text-medical-navy-900">
                              {m.medicineName}
                            </td>
                            <td className="py-2.5 px-4 text-medical-slate-600">
                              {m.manufacturer || "—"}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums">{m.quantitySold}</td>
                            <td className="py-2.5 px-4 text-right tabular-nums text-medical-slate-700">
                              {formatIndianCurrency(m.revenue)}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums text-medical-slate-700">
                              {formatIndianCurrency(m.cogs)}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums font-bold text-medical-green-700">
                              {formatIndianCurrency(m.grossProfit)}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-medical-navy-900">
                              {m.marginPercent.toFixed(2)}%
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5: GST SUMMARY REPORT */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "GST_SUMMARY" && gstData && (
          <div className="space-y-6">
            {/* Note stating calculation basis */}
            <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-600 shrink-0" />
              <span>
                <strong>Note:</strong> Prices are GST-inclusive. These figures are calculated from
                billed totals using the standard 18% rate (split equally as 9% CGST and 9% SGST).
              </span>
            </div>

            {/* GST Summary KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white rounded-2xl border border-medical-slate-200 p-4 shadow-sm">
                <span className="block text-[11px] font-bold text-medical-slate-500 uppercase tracking-wider">
                  Total Bills
                </span>
                <span className="text-xl font-bold text-medical-navy-900 tabular-nums">
                  {gstData.summary.billsCount}
                </span>
                <span className="block text-[10px] text-medical-slate-400 mt-0.5">Transactions</span>
              </div>

              <div className="bg-white rounded-2xl border border-medical-slate-200 p-4 shadow-sm">
                <span className="block text-[11px] font-bold text-medical-slate-500 uppercase tracking-wider">
                  Billed Amount
                </span>
                <span className="text-xl font-bold text-medical-navy-900 tabular-nums">
                  {formatIndianCurrency(gstData.summary.totalBilledAmount)}
                </span>
                <span className="block text-[10px] text-medical-slate-400 mt-0.5">
                  Grand totals sum
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-medical-slate-200 p-4 shadow-sm">
                <span className="block text-[11px] font-bold text-medical-slate-500 uppercase tracking-wider">
                  Taxable Value
                </span>
                <span className="text-xl font-bold text-medical-navy-900 tabular-nums">
                  {formatIndianCurrency(gstData.summary.totalTaxableValue)}
                </span>
                <span className="block text-[10px] text-medical-slate-400 mt-0.5">
                  Pre-tax base value
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-medical-slate-200 p-4 shadow-sm">
                <span className="block text-[11px] font-bold text-medical-slate-500 uppercase tracking-wider">
                  CGST (9%)
                </span>
                <span className="text-xl font-bold text-indigo-600 tabular-nums">
                  {formatIndianCurrency(gstData.summary.totalCgst)}
                </span>
                <span className="block text-[10px] text-medical-slate-400 mt-0.5">Central share</span>
              </div>

              <div className="bg-white rounded-2xl border border-medical-slate-200 p-4 shadow-sm">
                <span className="block text-[11px] font-bold text-medical-slate-500 uppercase tracking-wider">
                  SGST (9%)
                </span>
                <span className="text-xl font-bold text-indigo-600 tabular-nums">
                  {formatIndianCurrency(gstData.summary.totalSgst)}
                </span>
                <span className="block text-[10px] text-medical-slate-400 mt-0.5">State share</span>
              </div>

              <div className="bg-white rounded-2xl border border-medical-slate-200 p-4 shadow-sm">
                <span className="block text-[11px] font-bold text-medical-slate-500 uppercase tracking-wider">
                  Total GST (18%)
                </span>
                <span className="text-xl font-bold text-medical-green-600 tabular-nums">
                  {formatIndianCurrency(gstData.summary.totalGst)}
                </span>
                <span className="block text-[10px] text-medical-slate-400 mt-0.5">CGST + SGST</span>
              </div>
            </div>

            {/* GST Day-Wise Table */}
            <div className="bg-white rounded-2xl border border-medical-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-medical-slate-200">
                <h3 className="text-base font-bold text-medical-navy-900">
                  Day-Wise GST Breakdown
                </h3>
                <p className="text-xs text-medical-slate-500">
                  Daily taxable base and 9% CGST / 9% SGST split based on billed receipts.
                </p>
              </div>

              {gstData.rows.length === 0 ? (
                <div className="p-12 text-center text-medical-slate-400">
                  <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold">No bills found for this date range.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-medical-slate-100/75 border-b border-medical-slate-200 text-medical-slate-600 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4 text-right">Bills Count</th>
                        <th className="py-3 px-4 text-right">Billed Amount</th>
                        <th className="py-3 px-4 text-right">Taxable Value</th>
                        <th className="py-3 px-4 text-right">CGST (9%)</th>
                        <th className="py-3 px-4 text-right">SGST (9%)</th>
                        <th className="py-3 px-4 text-right">Total GST (18%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-medical-slate-100">
                      {gstData.rows.map((r) => (
                        <tr key={r.date} className="hover:bg-medical-slate-50 transition">
                          <td className="py-2.5 px-4 font-mono font-semibold text-medical-navy-900">
                            {formatDisplayDate(r.date)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums">{r.billsCount}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-medical-navy-900">
                            {formatIndianCurrency(r.billedAmount)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-medical-slate-700">
                            {formatIndianCurrency(r.taxableValue)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-indigo-600 font-semibold">
                            {formatIndianCurrency(r.cgst)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-indigo-600 font-semibold">
                            {formatIndianCurrency(r.sgst)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums font-bold text-medical-green-700">
                            {formatIndianCurrency(r.totalGst)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-medical-slate-100 font-bold border-t-2 border-medical-slate-300 text-medical-navy-900">
                        <td className="py-3 px-4">TOTAL</td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {gstData.summary.billsCount}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {formatIndianCurrency(gstData.summary.totalBilledAmount)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {formatIndianCurrency(gstData.summary.totalTaxableValue)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-indigo-700 font-bold">
                          {formatIndianCurrency(gstData.summary.totalCgst)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-indigo-700 font-bold">
                          {formatIndianCurrency(gstData.summary.totalSgst)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-medical-green-700 font-extrabold">
                          {formatIndianCurrency(gstData.summary.totalGst)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
