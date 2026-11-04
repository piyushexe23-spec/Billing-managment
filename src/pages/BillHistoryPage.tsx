/**
 * Bill History Module
 * IM MEDICOS Pharmacy Billing Software - Command 05B
 *
 * View, search, filter, and reprint past bills with full snapshot fidelity.
 * Strictly read-only: does not modify or delete bills or inventory.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Calendar,
  X,
  Eye,
  Printer,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Receipt,
  RotateCcw,
  Banknote,
  CreditCard,
  FileText,
  AlertCircle,
  CheckCircle2,
  Phone,
  User,
  Stethoscope,
} from "lucide-react";
import {
  BillFilterInput,
  BillHistorySummary,
  BillRecord,
} from "@/types/billing";
import { billingService } from "@/services/billingService";
import {
  printInvoice,
  downloadInvoicePdf,
} from "@/lib/invoicePrintService";
import {
  formatDisplayDate,
  formatAmountInIndianWords,
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
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPresetDates(preset: DatePreset): { fromDate: string; toDate: string } {
  const now = new Date();
  const todayStr = toLocalDateStr(now);

  switch (preset) {
    case "TODAY":
      return { fromDate: todayStr, toDate: todayStr };
    case "YESTERDAY": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = toLocalDateStr(y);
      return { fromDate: yStr, toDate: yStr };
    }
    case "LAST_7_DAYS": {
      const d7 = new Date(now);
      d7.setDate(d7.getDate() - 6);
      return { fromDate: toLocalDateStr(d7), toDate: todayStr };
    }
    case "THIS_MONTH": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { fromDate: toLocalDateStr(start), toDate: todayStr };
    }
    case "LAST_MONTH": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { fromDate: toLocalDateStr(start), toDate: toLocalDateStr(end) };
    }
    case "THIS_YEAR": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { fromDate: toLocalDateStr(start), toDate: todayStr };
    }
    case "ALL_TIME": {
      return { fromDate: "", toDate: "" };
    }
    default:
      return { fromDate: todayStr, toDate: todayStr };
  }
}

function formatBillDateTime(billDate: string, createdAt?: string): string {
  const raw = createdAt || billDate;
  if (!raw) return "";
  try {
    const d = new Date(raw.replace(" ", "T"));
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, "0");
      const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      const hourStr = String(hours).padStart(2, "0");
      return `${day} ${month} ${year}, ${hourStr}:${minutes} ${ampm}`;
    }
  } catch {}
  return billDate;
}

export const BillHistoryPage: React.FC = () => {
  const todayStr = useMemo(() => toLocalDateStr(new Date()), []);

  // Filter states
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>("TODAY");
  const [customFromDate, setCustomFromDate] = useState<string>(todayStr);
  const [customToDate, setCustomToDate] = useState<string>(todayStr);
  const [customDateError, setCustomDateError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [paymentModeFilter, setPaymentModeFilter] = useState<string>("ALL");
  const [discountModeFilter, setDiscountModeFilter] = useState<string>("ALL");

  // Sorting & Pagination
  const [sortBy, setSortBy] = useState<string>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Data states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [bills, setBills] = useState<BillRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [summary, setSummary] = useState<BillHistorySummary>({
    totalBills: 0,
    totalSales: 0,
    totalDiscount: 0,
    cashSales: 0,
    upiSales: 0,
    cardSales: 0,
  });

  // Modal / Detail view
  const [selectedBill, setSelectedBill] = useState<BillRecord | null>(null);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Determine current active date range
  const activeDateRange = useMemo(() => {
    if (selectedPreset === "CUSTOM") {
      return { fromDate: customFromDate, toDate: customToDate };
    }
    return getPresetDates(selectedPreset);
  }, [selectedPreset, customFromDate, customToDate]);

  // Fetch bills whenever filters, sort or page change
  const fetchBills = useCallback(async () => {
    setIsLoading(true);
    try {
      const filterInput: BillFilterInput = {
        fromDate: activeDateRange.fromDate || null,
        toDate: activeDateRange.toDate || null,
        search: searchQuery.trim() || null,
        paymentMode: paymentModeFilter !== "ALL" ? paymentModeFilter : null,
        discountMode: discountModeFilter !== "ALL" ? discountModeFilter : null,
        sortBy,
        sortOrder,
        page: currentPage,
        pageSize,
      };

      const result = await billingService.getBills(filterInput);
      setBills(result.bills);
      setTotalCount(result.totalCount);
      setSummary(result.summary);
    } catch (err) {
      console.error("Failed to fetch bill history:", err);
    } finally {
      setIsLoading(false);
    }
  }, [
    activeDateRange,
    searchQuery,
    paymentModeFilter,
    discountModeFilter,
    sortBy,
    sortOrder,
    currentPage,
    pageSize,
  ]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  // Handle preset clicks
  const handlePresetSelect = (preset: DatePreset) => {
    setSelectedPreset(preset);
    setCurrentPage(1);
    if (preset !== "CUSTOM") {
      setCustomDateError(null);
    }
  };

  // Custom date validation
  const handleCustomDateChange = (from: string, to: string) => {
    setCustomFromDate(from);
    setCustomToDate(to);
    if (from && to && from > to) {
      setCustomDateError("'From' date cannot be after 'To' date");
    } else {
      setCustomDateError(null);
      setCurrentPage(1);
    }
  };

  // Reset all filters
  const handleClearFilters = () => {
    setSelectedPreset("TODAY");
    setCustomFromDate(todayStr);
    setCustomToDate(todayStr);
    setCustomDateError(null);
    setSearchQuery("");
    setPaymentModeFilter("ALL");
    setDiscountModeFilter("ALL");
    setSortBy("date");
    setSortOrder("desc");
    setCurrentPage(1);
  };

  // Sorting toggler
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  // Detail Modal Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedBill) {
        setSelectedBill(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedBill]);

  // Actions
  const handlePrint = async (bill: BillRecord) => {
    setIsPrinting(true);
    try {
      await printInvoice(bill);
    } catch (err) {
      console.error("Print failed:", err);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownload = async (bill: BillRecord) => {
    try {
      await downloadInvoicePdf(bill);
    } catch (err) {
      console.error("PDF download failed:", err);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // Preset Buttons Config
  const PRESET_BUTTONS: Array<{ id: DatePreset; label: string }> = [
    { id: "TODAY", label: "Today" },
    { id: "YESTERDAY", label: "Yesterday" },
    { id: "LAST_7_DAYS", label: "Last 7 Days" },
    { id: "THIS_MONTH", label: "This Month" },
    { id: "LAST_MONTH", label: "Last Month" },
    { id: "THIS_YEAR", label: "This Year" },
    { id: "ALL_TIME", label: "All Time" },
    { id: "CUSTOM", label: "Custom Range" },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 min-h-screen text-slate-800">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-medical-navy-950 flex items-center gap-2.5">
              <Receipt className="h-6 w-6 text-medical-navy-700" />
              Bill History
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-0.5">
              View, search and reprint past bills.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-medical-navy-50 text-medical-navy-800 border border-medical-navy-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-medical-green-600 mr-1.5" />
              Immutable Invoices
            </span>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6 space-y-5 max-w-[1600px] w-full mx-auto">
        {/* Top 4 Summary KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Bills */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-all flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Total Bills
              </span>
              <div className="text-2xl font-bold text-medical-navy-950 font-mono tabular-nums">
                {summary.totalBills.toLocaleString("en-IN")}
              </div>
              <p className="text-[11px] text-slate-400">In current filtered view</p>
            </div>
            <div className="h-11 w-11 rounded-lg bg-medical-navy-50 text-medical-navy-700 flex items-center justify-center">
              <Receipt className="h-5 w-5" />
            </div>
          </div>

          {/* Card 2: Total Sales */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-all flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Total Sales
              </span>
              <div className="text-2xl font-bold text-medical-green-600 font-mono tabular-nums">
                ₹{summary.totalSales.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-[11px] text-slate-400">Sum of grand totals</p>
            </div>
            <div className="h-11 w-11 rounded-lg bg-medical-green-50 text-medical-green-700 flex items-center justify-center">
              <Banknote className="h-5 w-5" />
            </div>
          </div>

          {/* Card 3: Total Discount */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-all flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Total Discount
              </span>
              <div className="text-2xl font-bold text-amber-600 font-mono tabular-nums">
                ₹{summary.totalDiscount.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-[11px] text-slate-400">Discount granted</p>
            </div>
            <div className="h-11 w-11 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <RotateCcw className="h-5 w-5" />
            </div>
          </div>

          {/* Card 4: Payment Split */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Payment Split
              </span>
              <CreditCard className="h-4 w-4 text-slate-400" />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2 pt-1 border-t border-slate-100 font-mono text-xs">
              <div className="text-left">
                <span className="text-[10px] uppercase block text-slate-400">Cash</span>
                <span className="font-semibold text-emerald-700 tabular-nums">
                  ₹{Math.round(summary.cashSales).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="text-center">
                <span className="text-[10px] uppercase block text-slate-400">UPI</span>
                <span className="font-semibold text-blue-700 tabular-nums">
                  ₹{Math.round(summary.upiSales).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase block text-slate-400">Card</span>
                <span className="font-semibold text-purple-700 tabular-nums">
                  ₹{Math.round(summary.cardSales).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Date Filter & Preset Bar */}
        <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <Calendar className="h-4 w-4 text-medical-navy-700" />
              <span>Date Filter:</span>
            </div>

            {/* Presets Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESET_BUTTONS.map((btn) => {
                const isActive = selectedPreset === btn.id;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => handlePresetSelect(btn.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? "bg-medical-navy-900 text-white shadow-sm ring-1 ring-medical-navy-950 font-semibold"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                    }`}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Date Range Collapsible Picker */}
          {selectedPreset === "CUSTOM" && (
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-4 bg-slate-50 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">From:</label>
                <input
                  type="date"
                  max={todayStr}
                  value={customFromDate}
                  onChange={(e) => handleCustomDateChange(e.target.value, customToDate)}
                  className="px-3 py-1.5 text-xs rounded-md border border-slate-300 bg-white shadow-sm focus:border-medical-navy-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">To:</label>
                <input
                  type="date"
                  max={todayStr}
                  value={customToDate}
                  onChange={(e) => handleCustomDateChange(customFromDate, e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-md border border-slate-300 bg-white shadow-sm focus:border-medical-navy-600 focus:outline-none"
                />
              </div>

              {customDateError && (
                <div className="text-xs text-rose-600 font-medium flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{customDateError}</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Search & Filters Bar */}
        <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Search Input (5 cols) */}
            <div className="md:col-span-5 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by bill #, customer name, mobile, doctor..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-8 py-2 text-xs md:text-sm rounded-lg border border-slate-300 bg-white shadow-sm focus:border-medical-navy-600 focus:ring-1 focus:ring-medical-navy-600 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Payment Mode (3 cols) */}
            <div className="md:col-span-3">
              <select
                value={paymentModeFilter}
                onChange={(e) => {
                  setPaymentModeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-xs md:text-sm rounded-lg border border-slate-300 bg-white shadow-sm focus:border-medical-navy-600 focus:ring-1 focus:ring-medical-navy-600 focus:outline-none"
              >
                <option value="ALL">All Payment Modes</option>
                <option value="CASH">Cash Only</option>
                <option value="UPI">UPI Only</option>
                <option value="CARD">Card Only</option>
              </select>
            </div>

            {/* Discount Mode (2 cols) */}
            <div className="md:col-span-2">
              <select
                value={discountModeFilter}
                onChange={(e) => {
                  setDiscountModeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-xs md:text-sm rounded-lg border border-slate-300 bg-white shadow-sm focus:border-medical-navy-600 focus:ring-1 focus:ring-medical-navy-600 focus:outline-none"
              >
                <option value="ALL">All Bills</option>
                <option value="DISCOUNTED">Discounted Bills</option>
                <option value="NON_DISCOUNT">Non-Discount Bills</option>
              </select>
            </div>

            {/* Clear Filters Button (2 cols) */}
            <div className="md:col-span-2 flex items-center justify-end">
              <button
                type="button"
                onClick={handleClearFilters}
                className="w-full sm:w-auto px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear Filters
              </button>
            </div>
          </div>

          {/* Showing count indicator */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 font-medium">
            <span>
              Showing <strong className="text-slate-800">{bills.length}</strong> of{" "}
              <strong className="text-slate-800">{totalCount}</strong> bills
            </span>
            {activeDateRange.fromDate && (
              <span className="text-slate-400">
                Range:{" "}
                <span className="text-slate-600 font-mono">
                  {formatDisplayDate(activeDateRange.fromDate)}
                  {activeDateRange.toDate && activeDateRange.toDate !== activeDateRange.fromDate
                    ? ` – ${formatDisplayDate(activeDateRange.toDate)}`
                    : ""}
                </span>
              </span>
            )}
          </div>
        </section>

        {/* Bills Table Container */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto relative min-h-[300px]">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 tracking-wider border-b border-slate-200 sticky top-0 z-10 select-none">
                <tr>
                  <th
                    scope="col"
                    className="py-3 px-4 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("bill_number")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Bill No.</span>
                      {sortBy === "bill_number" ? (
                        sortOrder === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 text-medical-navy-700" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-medical-navy-700" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      )}
                    </div>
                  </th>

                  <th
                    scope="col"
                    className="py-3 px-4 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("date")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Date & Time</span>
                      {sortBy === "date" ? (
                        sortOrder === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 text-medical-navy-700" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-medical-navy-700" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      )}
                    </div>
                  </th>

                  <th
                    scope="col"
                    className="py-3 px-4 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("customer_name")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Customer</span>
                      {sortBy === "customer_name" ? (
                        sortOrder === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 text-medical-navy-700" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-medical-navy-700" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      )}
                    </div>
                  </th>

                  <th scope="col" className="py-3 px-4">
                    Mobile
                  </th>

                  <th scope="col" className="py-3 px-4 text-center">
                    Items
                  </th>

                  <th scope="col" className="py-3 px-4 text-center">
                    Payment Mode
                  </th>

                  <th scope="col" className="py-3 px-4 text-right">
                    Discount
                  </th>

                  <th
                    scope="col"
                    className="py-3 px-4 text-right font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("grand_total")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Grand Total</span>
                      {sortBy === "grand_total" ? (
                        sortOrder === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 text-medical-navy-700" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-medical-navy-700" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      )}
                    </div>
                  </th>

                  {/* Sticky Actions column */}
                  <th
                    scope="col"
                    className="py-3 px-4 text-center sticky right-0 bg-slate-50 z-10 shadow-[-3px_0_4px_-2px_rgba(0,0,0,0.06)]"
                  >
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="h-6 w-6 border-2 border-medical-navy-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-medium">Loading bills from database...</span>
                      </div>
                    </td>
                  </tr>
                ) : bills.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-14 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                          <Receipt className="h-6 w-6" />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-700">
                          No bills found for this date range.
                        </h4>
                        <p className="text-xs text-slate-500 text-center">
                          Try clearing your search query or choosing another preset date range.
                        </p>
                        <button
                          type="button"
                          onClick={handleClearFilters}
                          className="mt-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-medical-navy-50 text-medical-navy-800 hover:bg-medical-navy-100 transition-colors"
                        >
                          Reset Filters to Today
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  bills.map((bill) => {
                    const itemCount = bill.items ? bill.items.length : 0;
                    return (
                      <tr
                        key={bill.id}
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                        onClick={() => setSelectedBill(bill)}
                      >
                        {/* Bill No. */}
                        <td className="py-3 px-4 font-mono font-bold text-medical-navy-900 whitespace-nowrap">
                          {bill.billNumber}
                        </td>

                        {/* Date & Time */}
                        <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                          {formatBillDateTime(bill.billDate, bill.createdAt)}
                        </td>

                        {/* Customer Name */}
                        <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap max-w-[180px] truncate">
                          {bill.customerName}
                          {bill.doctorName && (
                            <span className="block text-[10px] text-slate-400 font-normal truncate">
                              Dr. {bill.doctorName}
                            </span>
                          )}
                        </td>

                        {/* Mobile */}
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-600">
                          +91 {bill.customerMobile}
                        </td>

                        {/* Items count */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                            {itemCount} {itemCount === 1 ? "item" : "items"}
                          </span>
                        </td>

                        {/* Payment Mode */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase ${
                              bill.paymentMode === "CASH"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : bill.paymentMode === "UPI"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "bg-purple-50 text-purple-700 border border-purple-200"
                            }`}
                          >
                            {bill.paymentMode}
                          </span>
                        </td>

                        {/* Discount */}
                        <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                          {bill.discount > 0 ? (
                            <span className="text-amber-600 font-medium">
                              -₹{bill.discount.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Grand Total */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap text-sm">
                          ₹{bill.grandTotal.toFixed(2)}
                        </td>

                        {/* Sticky Actions Column */}
                        <td
                          className="py-2 px-4 text-center whitespace-nowrap sticky right-0 bg-white group-hover:bg-slate-50 transition-colors z-10 shadow-[-3px_0_4px_-2px_rgba(0,0,0,0.06)]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View Detail */}
                            <button
                              type="button"
                              onClick={() => setSelectedBill(bill)}
                              title="View Bill Details"
                              className="p-1.5 rounded-md text-slate-600 hover:text-medical-navy-800 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              <Eye className="h-4 w-4" />
                            </button>

                            {/* Print */}
                            <button
                              type="button"
                              onClick={() => handlePrint(bill)}
                              title="Print Invoice"
                              className="p-1.5 rounded-md text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                            >
                              <Printer className="h-4 w-4" />
                            </button>

                            {/* Download PDF */}
                            <button
                              type="button"
                              onClick={() => handleDownload(bill)}
                              title="Save PDF"
                              className="p-1.5 rounded-md text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Footer */}
          <div className="p-3 md:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 rounded border border-slate-300 bg-white shadow-sm focus:outline-none focus:border-medical-navy-600"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3">
              <span className="text-slate-500 font-medium">
                Page <strong className="text-slate-800">{currentPage}</strong> of{" "}
                <strong className="text-slate-800">{totalPages}</strong>
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1 || isLoading}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages || isLoading}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Bill Detail View Modal */}
      {selectedBill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setSelectedBill(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-medical-navy-950 text-white flex items-center justify-between border-b border-medical-navy-900">
              <div className="flex items-center gap-3">
                <Receipt className="h-5 w-5 text-medical-green-400" />
                <div>
                  <h3 className="text-base font-bold tracking-wide">
                    Invoice {selectedBill.billNumber}
                  </h3>
                  <p className="text-xs text-medical-slate-300 font-mono">
                    {formatBillDateTime(selectedBill.billDate, selectedBill.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {selectedBill.status || "COMPLETED"}
                </span>

                <button
                  type="button"
                  onClick={() => setSelectedBill(null)}
                  title="Close"
                  className="p-1 rounded-lg text-medical-slate-400 hover:text-white hover:bg-medical-navy-900 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-slate-700">
              {/* Customer & Store Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Details Box */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-medical-navy-700" />
                    Patient / Customer Details
                  </span>
                  <div className="space-y-1 font-medium">
                    <div className="text-sm font-bold text-slate-900">
                      {selectedBill.customerName}
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 font-mono">
                      <Phone className="h-3 w-3 text-slate-400" />
                      +91 {selectedBill.customerMobile}
                    </div>
                    {selectedBill.doctorName && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Stethoscope className="h-3 w-3 text-slate-400" />
                        Dr. {selectedBill.doctorName}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bill Metadata Box */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-medical-navy-700" />
                    Billing Metadata
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Payment Mode</span>
                      <span className="font-bold text-slate-800 uppercase">
                        {selectedBill.paymentMode}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Discount Mode</span>
                      <span className="font-bold text-slate-800 uppercase">
                        {selectedBill.discountMode === "NON_DISCOUNT"
                          ? "Non-Discount"
                          : "Discounted"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Store</span>
                      <span className="font-semibold text-slate-700 truncate block">
                        {selectedBill.storeSnapshot?.storeName || "IM MEDICOS PHARMACY"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">GSTIN</span>
                      <span className="font-mono text-slate-700 block truncate">
                        {selectedBill.storeSnapshot?.gstin || "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Line Items Table (NO COST PRICE OR PROFIT) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="bg-slate-100 px-4 py-2 font-bold text-slate-700 text-xs border-b border-slate-200 flex items-center justify-between">
                  <span>Line Items ({selectedBill.items?.length || 0})</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Strictly Immutable Snapshot
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 text-center">#</th>
                        <th className="py-2.5 px-3">Medicine Name</th>
                        <th className="py-2.5 px-3">Batch</th>
                        <th className="py-2.5 px-3">Expiry</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">MRP</th>
                        <th className="py-2.5 px-3 text-right">Rate</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {selectedBill.items?.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/60">
                          <td className="py-2 px-3 text-center text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3 font-sans font-medium text-slate-800">
                            {item.medicineName}
                          </td>
                          <td className="py-2 px-3 text-slate-600">{item.batchNumber}</td>
                          <td className="py-2 px-3 text-slate-600">
                            {formatDisplayDate(item.expDate)}
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-slate-900">
                            {item.quantity} {item.unit || ""}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-500 tabular-nums">
                            ₹{item.mrp.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-slate-800 tabular-nums">
                            ₹{item.rate.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900 tabular-nums">
                            ₹{item.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals & Amount in words */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Amount in Words
                  </span>
                  <p className="text-xs font-semibold text-slate-800 italic">
                    {selectedBill.amountInWords ||
                      formatAmountInIndianWords(selectedBill.grandTotal)}
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Sub Total (MRP):</span>
                    <span>₹{selectedBill.subTotal.toFixed(2)}</span>
                  </div>

                  {selectedBill.discount > 0 && (
                    <div className="flex justify-between text-amber-600 font-medium">
                      <span>Total Discount:</span>
                      <span>-₹{selectedBill.discount.toFixed(2)}</span>
                    </div>
                  )}

                  {selectedBill.gstTotal > 0 && (
                    <>
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>CGST (9%):</span>
                        <span>₹{selectedBill.cgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>SGST (9%):</span>
                        <span>₹{selectedBill.sgst.toFixed(2)}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between text-sm font-bold text-medical-navy-950 pt-2 border-t border-slate-200">
                    <span className="font-sans">Grand Total:</span>
                    <span className="text-base text-medical-green-600">
                      ₹{selectedBill.grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedBill(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleDownload(selectedBill)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="h-4 w-4" />
                  Save PDF
                </button>

                <button
                  type="button"
                  onClick={() => handlePrint(selectedBill)}
                  disabled={isPrinting}
                  className="px-5 py-2 rounded-lg bg-medical-navy-900 hover:bg-medical-navy-950 text-white font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow-md"
                >
                  <Printer className="h-4 w-4 text-medical-green-400" />
                  {isPrinting ? "Printing..." : "Print Invoice"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillHistoryPage;
