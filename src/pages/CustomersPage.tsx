/**
 * Customers Module
 * IM MEDICOS Pharmacy Billing Software - Command 06
 *
 * Search customers and view customer purchase history.
 * Strictly read-only: derived from immutable saved bills.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  UserCheck,
  Receipt,
  Banknote,
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
  RotateCcw,
  Phone,
  User,
  Stethoscope,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileText,
  CalendarDays,
} from "lucide-react";
import {
  CustomerDetailResult,
  CustomerFilterInput,
  CustomerListItem,
  CustomersSummary,
} from "@/types/customer";
import { BillRecord } from "@/types/billing";
import { customerService } from "@/services/customerService";
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
      return { fromDate: "", toDate: "" };
  }
}

function formatBillTime(createdAt?: string, billDate?: string): string {
  const raw = createdAt || billDate;
  if (!raw) return "";
  try {
    const d = new Date(raw.replace(" ", "T"));
    if (!isNaN(d.getTime())) {
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      const hourStr = String(hours).padStart(2, "0");
      return `${hourStr}:${minutes} ${ampm}`;
    }
  } catch {}
  return "";
}

function formatFullDateTime(billDate: string, createdAt?: string): string {
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

export const CustomersPage: React.FC = () => {
  const todayStr = useMemo(() => toLocalDateStr(new Date()), []);

  // Filter states for Customer List (Default is ALL_TIME)
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>("ALL_TIME");
  const [customFromDate, setCustomFromDate] = useState<string>(todayStr);
  const [customToDate, setCustomToDate] = useState<string>(todayStr);
  const [customDateError, setCustomDateError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("last_visit");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // List data states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [summary, setSummary] = useState<CustomersSummary>({
    totalCustomers: 0,
    totalBills: 0,
    totalSales: 0,
    repeatCustomers: 0,
  });

  // Customer Detail View state
  const [selectedCustomerMobile, setSelectedCustomerMobile] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<CustomerDetailResult | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // Detail view independent filter states (inherited from list initially)
  const [detailPreset, setDetailPreset] = useState<DatePreset>("ALL_TIME");
  const [detailFromDate, setDetailFromDate] = useState<string>(todayStr);
  const [detailToDate, setDetailToDate] = useState<string>(todayStr);
  const [detailDateError, setDetailDateError] = useState<string | null>(null);
  const [detailBillSearch, setDetailBillSearch] = useState<string>("");

  // Nested Bill Modal state (for viewing a specific bill in customer detail)
  const [viewingBill, setViewingBill] = useState<BillRecord | null>(null);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Determine current active date range for the customer list
  const activeDateRange = useMemo(() => {
    if (selectedPreset === "CUSTOM") {
      return { fromDate: customFromDate, toDate: customToDate };
    }
    return getPresetDates(selectedPreset);
  }, [selectedPreset, customFromDate, customToDate]);

  // Determine active date range for detail view
  const detailActiveDateRange = useMemo(() => {
    if (detailPreset === "CUSTOM") {
      return { fromDate: detailFromDate, toDate: detailToDate };
    }
    return getPresetDates(detailPreset);
  }, [detailPreset, detailFromDate, detailToDate]);

  // Fetch customers list
  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const filterInput: CustomerFilterInput = {
        fromDate: activeDateRange.fromDate || null,
        toDate: activeDateRange.toDate || null,
        search: searchQuery.trim() || null,
        sortBy,
        sortOrder,
        page: currentPage,
        pageSize,
      };

      const result = await customerService.getCustomers(filterInput);
      setCustomers(result.customers);
      setTotalCount(result.totalCount);
      setSummary(result.summary);
    } catch (err) {
      console.error("Failed to fetch customers:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeDateRange, searchQuery, sortBy, sortOrder, currentPage, pageSize]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Fetch customer detail
  const fetchCustomerDetail = useCallback(async () => {
    if (!selectedCustomerMobile) {
      setCustomerDetail(null);
      return;
    }
    setDetailLoading(true);
    try {
      const res = await customerService.getCustomerDetail(
        selectedCustomerMobile,
        detailActiveDateRange.fromDate || null,
        detailActiveDateRange.toDate || null,
        detailBillSearch.trim() || null
      );
      setCustomerDetail(res);
    } catch (err) {
      console.error("Failed to fetch customer detail:", err);
    } finally {
      setDetailLoading(false);
    }
  }, [selectedCustomerMobile, detailActiveDateRange, detailBillSearch]);

  useEffect(() => {
    fetchCustomerDetail();
  }, [fetchCustomerDetail]);

  // When opening a customer, initialize their detail date filter with current list filter
  const handleOpenCustomer = (customer: CustomerListItem) => {
    setSelectedCustomerMobile(customer.mobile);
    setDetailPreset(selectedPreset);
    setDetailFromDate(customFromDate);
    setDetailToDate(customToDate);
    setDetailDateError(null);
    setDetailBillSearch("");
  };

  const handleCloseCustomer = () => {
    setSelectedCustomerMobile(null);
    setCustomerDetail(null);
    setViewingBill(null);
  };

  // Preset selection in Customer List
  const handlePresetSelect = (preset: DatePreset) => {
    setSelectedPreset(preset);
    setCurrentPage(1);
    if (preset !== "CUSTOM") {
      setCustomDateError(null);
    }
  };

  // Custom range validation in Customer List
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

  // Reset list filters
  const handleClearFilters = () => {
    setSelectedPreset("ALL_TIME");
    setCustomFromDate(todayStr);
    setCustomToDate(todayStr);
    setCustomDateError(null);
    setSearchQuery("");
    setSortBy("last_visit");
    setSortOrder("desc");
    setCurrentPage(1);
  };

  // Sort handler
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (viewingBill) {
          setViewingBill(null);
        } else if (selectedCustomerMobile) {
          handleCloseCustomer();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewingBill, selectedCustomerMobile]);

  // Actions for bills
  const handlePrint = async (bill: BillRecord) => {
    setIsPrinting(true);
    try {
      await printInvoice(bill);
    } catch (err) {
      console.error("Print error:", err);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownload = async (bill: BillRecord) => {
    try {
      await downloadInvoicePdf(bill);
    } catch (err) {
      console.error("Save PDF error:", err);
    }
  };

  // Group bills by day for customer detail
  const groupedBillsByDate = useMemo(() => {
    if (!customerDetail?.bills) return [];

    const map = new Map<string, BillRecord[]>();
    for (const b of customerDetail.bills) {
      const d = b.billDate.slice(0, 10);
      if (!map.has(d)) {
        map.set(d, []);
      }
      map.get(d)!.push(b);
    }

    // Sort days descending
    const sortedDays = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

    return sortedDays.map((dayStr) => {
      const dayBills = map.get(dayStr)!;
      // Sort bills within day newest first
      dayBills.sort((a, b) => b.id - a.id);
      const dayTotal = Number(
        dayBills.reduce((sum, b) => sum + (b.grandTotal || 0), 0).toFixed(2)
      );

      return {
        dateStr: dayStr,
        displayDate: formatDisplayDate(dayStr),
        billsCount: dayBills.length,
        dayTotal,
        bills: dayBills,
      };
    });
  }, [customerDetail?.bills]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const PRESET_BUTTONS: Array<{ id: DatePreset; label: string }> = [
    { id: "ALL_TIME", label: "All Time" },
    { id: "TODAY", label: "Today" },
    { id: "YESTERDAY", label: "Yesterday" },
    { id: "LAST_7_DAYS", label: "Last 7 Days" },
    { id: "THIS_MONTH", label: "This Month" },
    { id: "LAST_MONTH", label: "Last Month" },
    { id: "THIS_YEAR", label: "This Year" },
    { id: "CUSTOM", label: "Custom Range" },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 min-h-screen text-slate-800">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-medical-navy-950 flex items-center gap-2.5">
              <Users className="h-6 w-6 text-medical-navy-700" />
              Customers
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-0.5">
              Search customers and view their bills.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-medical-navy-50 text-medical-navy-800 border border-medical-navy-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-medical-green-600 mr-1.5" />
              Derived from Saved Bills
            </span>
          </div>
        </div>
      </header>

      {/* Main Customers View */}
      <main className="p-4 md:p-6 space-y-5 max-w-[1600px] w-full mx-auto">
        {/* Top 4 Summary KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Customers */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-all flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Total Customers
              </span>
              <div className="text-2xl font-bold text-medical-navy-950 font-mono tabular-nums">
                {summary.totalCustomers.toLocaleString("en-IN")}
              </div>
              <p className="text-[11px] text-slate-400">Distinct mobile identities</p>
            </div>
            <div className="h-11 w-11 rounded-lg bg-medical-navy-50 text-medical-navy-700 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </div>

          {/* Card 2: Total Bills */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-all flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Total Bills
              </span>
              <div className="text-2xl font-bold text-blue-700 font-mono tabular-nums">
                {summary.totalBills.toLocaleString("en-IN")}
              </div>
              <p className="text-[11px] text-slate-400">In current filtered range</p>
            </div>
            <div className="h-11 w-11 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Receipt className="h-5 w-5" />
            </div>
          </div>

          {/* Card 3: Total Sales */}
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
              <p className="text-[11px] text-slate-400">Sum of customer spend</p>
            </div>
            <div className="h-11 w-11 rounded-lg bg-medical-green-50 text-medical-green-700 flex items-center justify-center">
              <Banknote className="h-5 w-5" />
            </div>
          </div>

          {/* Card 4: Repeat Customers */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-all flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Repeat Customers
              </span>
              <div className="text-2xl font-bold text-purple-700 font-mono tabular-nums">
                {summary.repeatCustomers.toLocaleString("en-IN")}
              </div>
              <p className="text-[11px] text-slate-400">2 or more bills in range</p>
            </div>
            <div className="h-11 w-11 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <UserCheck className="h-5 w-5" />
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

        {/* Search & Action Bar */}
        <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by customer name, mobile, or alternative name..."
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

            {/* Clear Filters Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear Filters
              </button>
            </div>
          </div>

          {/* Showing Count & Active Range Badge */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 font-medium">
            <span>
              Showing <strong className="text-slate-800">{customers.length}</strong> of{" "}
              <strong className="text-slate-800">{totalCount}</strong> customers
            </span>
            {activeDateRange.fromDate ? (
              <span className="text-slate-400">
                Active Range:{" "}
                <span className="text-slate-700 font-mono">
                  {formatDisplayDate(activeDateRange.fromDate)}
                  {activeDateRange.toDate && activeDateRange.toDate !== activeDateRange.fromDate
                    ? ` – ${formatDisplayDate(activeDateRange.toDate)}`
                    : ""}
                </span>
              </span>
            ) : (
              <span className="text-slate-400 font-medium">Active Range: All Time</span>
            )}
          </div>
        </section>

        {/* Customers Table Container */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto relative min-h-[300px]">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 tracking-wider border-b border-slate-200 sticky top-0 z-10 select-none">
                <tr>
                  <th
                    scope="col"
                    className="py-3 px-4 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Customer Name</span>
                      {sortBy === "name" ? (
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

                  <th
                    scope="col"
                    className="py-3 px-4 text-center font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("bills")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Bills (in range)</span>
                      {sortBy === "bills" ? (
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
                    className="py-3 px-4 text-right font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("total_spent")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Total Spent (in range)</span>
                      {sortBy === "total_spent" ? (
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
                    onClick={() => handleSort("last_visit")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Last Visit</span>
                      {sortBy === "last_visit" ? (
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
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="h-6 w-6 border-2 border-medical-navy-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-medium">Loading customers from bills...</span>
                      </div>
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-14 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                          <Users className="h-6 w-6" />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-700">
                          No customers found for this search or date range.
                        </h4>
                        <p className="text-xs text-slate-500 text-center">
                          Try clearing your search query or choosing another preset date range.
                        </p>
                        <button
                          type="button"
                          onClick={handleClearFilters}
                          className="mt-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-medical-navy-50 text-medical-navy-800 hover:bg-medical-navy-100 transition-colors"
                        >
                          Reset Filters to All Time
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => {
                    const hasOtherNames = c.otherNames && c.otherNames.length > 0;
                    return (
                      <tr
                        key={c.mobile}
                        onClick={() => handleOpenCustomer(c)}
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      >
                        {/* Customer Name */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-900 flex items-center gap-2">
                            <span>{c.displayName}</span>
                            {c.billsCount >= 2 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                Repeat
                              </span>
                            )}
                          </div>
                          {hasOtherNames && (
                            <span className="block text-[11px] text-slate-400 font-normal truncate max-w-[220px]">
                              Also: {c.otherNames.join(", ")}
                            </span>
                          )}
                        </td>

                        {/* Mobile */}
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-600">
                          {c.mobile === "No mobile" ? (
                            <span className="text-slate-400 italic">No mobile</span>
                          ) : (
                            `+91 ${c.mobile}`
                          )}
                        </td>

                        {/* Bills in range */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-blue-50 text-blue-700 border border-blue-200">
                            {c.billsCount} {c.billsCount === 1 ? "bill" : "bills"}
                          </span>
                        </td>

                        {/* Total Spent in range */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap text-sm">
                          ₹{c.totalSpent.toFixed(2)}
                        </td>

                        {/* Last Visit */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-mono text-xs">
                          {c.lastVisit ? formatDisplayDate(c.lastVisit) : "—"}
                        </td>

                        {/* Sticky Actions */}
                        <td
                          className="py-3 px-4 text-center whitespace-nowrap sticky right-0 bg-white group-hover:bg-slate-50 transition-colors z-10 shadow-[-3px_0_4px_-2px_rgba(0,0,0,0.06)]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleOpenCustomer(c)}
                            title="View Customer Bills"
                            className="px-3 py-1.5 rounded-lg bg-medical-navy-50 hover:bg-medical-navy-100 text-medical-navy-800 font-semibold text-xs flex items-center gap-1.5 mx-auto transition-colors cursor-pointer shadow-xs"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </button>
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

      {/* Customer Detail View (Full Modal / Side Panel with Back Button) */}
      {selectedCustomerMobile && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-3 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={handleCloseCustomer}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-medical-navy-950 text-white flex items-center justify-between border-b border-medical-navy-900">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCloseCustomer}
                  className="p-1.5 rounded-lg text-medical-slate-300 hover:text-white hover:bg-medical-navy-900 transition-colors"
                  title="Back to Customers list"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h3 className="text-lg font-bold tracking-wide flex items-center gap-2">
                    <span>{customerDetail?.customer?.displayName || "Customer Details"}</span>
                    {customerDetail && customerDetail.customer.billsCount >= 2 && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Repeat Customer
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-medical-slate-300 font-mono flex items-center gap-2">
                    <Phone className="h-3 w-3 text-medical-green-400" />
                    {customerDetail?.customer?.mobile === "No mobile"
                      ? "No mobile"
                      : `+91 ${customerDetail?.customer?.mobile || ""}`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseCustomer}
                title="Close"
                className="p-1.5 rounded-lg text-medical-slate-400 hover:text-white hover:bg-medical-navy-900 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-slate-700">
              {detailLoading ? (
                <div className="py-16 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="h-7 w-7 border-2 border-medical-navy-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-medium">Loading customer bills...</span>
                  </div>
                </div>
              ) : customerDetail ? (
                <>
                  {/* Top Customer Summary Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Range Bills & All Time */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Total Bills
                        </span>
                        <div className="text-base font-bold text-slate-900 font-mono">
                          {customerDetail.customer.billsCount} bills{" "}
                          <span className="text-xs text-slate-400 font-normal">
                            (in range)
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {customerDetail.customer.allTimeBillsCount} bills all time
                        </div>
                      </div>

                      {/* Range Spent & All Time */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Total Spent
                        </span>
                        <div className="text-base font-bold text-medical-green-600 font-mono">
                          ₹{customerDetail.customer.totalSpent.toFixed(2)}{" "}
                          <span className="text-xs text-slate-400 font-normal">
                            (in range)
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          ₹{customerDetail.customer.allTimeTotalSpent.toFixed(2)} all time
                        </div>
                      </div>

                      {/* First Visit */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          First Visit
                        </span>
                        <div className="text-sm font-semibold text-slate-800 font-mono">
                          {customerDetail.customer.firstVisit
                            ? formatDisplayDate(customerDetail.customer.firstVisit)
                            : "—"}
                        </div>
                        <div className="text-[11px] text-slate-400">First bill recorded</div>
                      </div>

                      {/* Last Visit */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Last Visit
                        </span>
                        <div className="text-sm font-semibold text-slate-800 font-mono">
                          {customerDetail.customer.lastVisit
                            ? formatDisplayDate(customerDetail.customer.lastVisit)
                            : "—"}
                        </div>
                        <div className="text-[11px] text-slate-400">Most recent visit</div>
                      </div>
                    </div>

                    {/* Also Billed As Notification */}
                    {customerDetail.customer.otherNames.length > 0 && (
                      <div className="pt-2 border-t border-slate-200 text-xs text-slate-600 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-medical-navy-600" />
                        <span>
                          <strong className="text-slate-800">Also billed as:</strong>{" "}
                          <span className="italic">
                            {customerDetail.customer.otherNames.join(", ")}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Detail View Date Filter & Bill Number Search Bar */}
                  <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2.5">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
                      {/* Presets */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {PRESET_BUTTONS.map((btn) => {
                          const isActive = detailPreset === btn.id;
                          return (
                            <button
                              key={btn.id}
                              type="button"
                              onClick={() => setDetailPreset(btn.id)}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                                isActive
                                  ? "bg-medical-navy-900 text-white font-semibold shadow-xs"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                              }`}
                            >
                              {btn.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Search Bill Number */}
                      <div className="relative min-w-[200px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search Bill #..."
                          value={detailBillSearch}
                          onChange={(e) => setDetailBillSearch(e.target.value)}
                          className="w-full pl-8 pr-7 py-1 text-xs rounded-md border border-slate-300 bg-white shadow-xs focus:border-medical-navy-600 focus:outline-none font-mono"
                        />
                        {detailBillSearch && (
                          <button
                            type="button"
                            onClick={() => setDetailBillSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Collapsible custom date range in detail view */}
                    {detailPreset === "CUSTOM" && (
                      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-50 p-2.5 rounded-lg text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-600">From:</span>
                          <input
                            type="date"
                            max={todayStr}
                            value={detailFromDate}
                            onChange={(e) => {
                              const from = e.target.value;
                              setDetailFromDate(from);
                              if (from && detailToDate && from > detailToDate) {
                                setDetailDateError("'From' date cannot be after 'To' date");
                              } else {
                                setDetailDateError(null);
                              }
                            }}
                            className="px-2 py-1 text-xs rounded border border-slate-300 bg-white shadow-xs focus:outline-none"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-600">To:</span>
                          <input
                            type="date"
                            max={todayStr}
                            value={detailToDate}
                            onChange={(e) => {
                              const to = e.target.value;
                              setDetailToDate(to);
                              if (detailFromDate && to && detailFromDate > to) {
                                setDetailDateError("'From' date cannot be after 'To' date");
                              } else {
                                setDetailDateError(null);
                              }
                            }}
                            className="px-2 py-1 text-xs rounded border border-slate-300 bg-white shadow-xs focus:outline-none"
                          />
                        </div>

                        {detailDateError && (
                          <div className="text-xs text-rose-600 font-medium flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            <span>{detailDateError}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Grouped Bills by Date Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Purchase History by Date ({customerDetail.bills.length} bills)</span>
                      <span className="text-slate-400 font-normal">Newest dates first</span>
                    </div>

                    {groupedBillsByDate.length === 0 ? (
                      <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <Receipt className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                        <h4 className="text-sm font-semibold text-slate-700">
                          No bills found for this date range.
                        </h4>
                        <p className="text-xs text-slate-500">
                          Try changing the date filter or clearing the bill search box.
                        </p>
                      </div>
                    ) : (
                      groupedBillsByDate.map((dayGroup) => (
                        <div
                          key={dayGroup.dateStr}
                          className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white"
                        >
                          {/* Day Group Heading */}
                          <div className="px-4 py-2.5 bg-slate-100/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 font-semibold text-slate-800 text-xs">
                              <CalendarDays className="h-4 w-4 text-medical-navy-700" />
                              <span>{dayGroup.displayDate}</span>
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-600">
                                {dayGroup.billsCount}{" "}
                                {dayGroup.billsCount === 1 ? "bill" : "bills"}
                              </span>
                            </div>

                            <div className="font-mono font-bold text-medical-navy-950 text-xs">
                              Day Total:{" "}
                              <span className="text-medical-green-600">
                                ₹{dayGroup.dayTotal.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {/* Bills Table for this Day */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-600 border-collapse">
                              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                                <tr>
                                  <th className="py-2.5 px-3">Bill No.</th>
                                  <th className="py-2.5 px-3">Time</th>
                                  <th className="py-2.5 px-3 text-center">Items</th>
                                  <th className="py-2.5 px-3 text-center">Payment Mode</th>
                                  <th className="py-2.5 px-3 text-right">Discount</th>
                                  <th className="py-2.5 px-3 text-right">Grand Total</th>
                                  <th className="py-2.5 px-3 text-center">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-mono">
                                {dayGroup.bills.map((bill) => {
                                  const itemCount = bill.items ? bill.items.length : 0;
                                  return (
                                    <tr
                                      key={bill.id}
                                      onClick={() => setViewingBill(bill)}
                                      className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                                    >
                                      {/* Bill No */}
                                      <td className="py-2.5 px-3 font-bold text-medical-navy-900 whitespace-nowrap">
                                        {bill.billNumber}
                                      </td>

                                      {/* Time */}
                                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                                        {formatBillTime(bill.createdAt, bill.billDate)}
                                      </td>

                                      {/* Items */}
                                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-sans font-medium bg-slate-100 text-slate-700">
                                          {itemCount} {itemCount === 1 ? "item" : "items"}
                                        </span>
                                      </td>

                                      {/* Payment Mode */}
                                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                        <span
                                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-sans font-bold uppercase ${
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
                                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                        {bill.discount > 0 ? (
                                          <span className="text-amber-600 font-medium">
                                            -₹{bill.discount.toFixed(2)}
                                          </span>
                                        ) : (
                                          <span className="text-slate-300">—</span>
                                        )}
                                      </td>

                                      {/* Grand Total */}
                                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                                        ₹{bill.grandTotal.toFixed(2)}
                                      </td>

                                      {/* Actions */}
                                      <td
                                        className="py-2 px-3 text-center whitespace-nowrap"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="flex items-center justify-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => setViewingBill(bill)}
                                            title="View Bill Details"
                                            className="p-1 rounded text-slate-600 hover:text-medical-navy-800 hover:bg-slate-100 transition-colors cursor-pointer"
                                          >
                                            <Eye className="h-3.5 w-3.5" />
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handlePrint(bill)}
                                            title="Print Invoice"
                                            className="p-1 rounded text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                                          >
                                            <Printer className="h-3.5 w-3.5" />
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleDownload(bill)}
                                            title="Save PDF"
                                            className="p-1 rounded text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                                          >
                                            <Download className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Customer purchases derived strictly from immutable bills.
              </span>
              <button
                type="button"
                onClick={handleCloseCustomer}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nested Bill Detail View Modal (Reusing Bill History View, NO COST PRICE OR PROFIT) */}
      {viewingBill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/65 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setViewingBill(null)}
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
                    Invoice {viewingBill.billNumber}
                  </h3>
                  <p className="text-xs text-medical-slate-300 font-mono">
                    {formatFullDateTime(viewingBill.billDate, viewingBill.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {viewingBill.status || "COMPLETED"}
                </span>

                <button
                  type="button"
                  onClick={() => setViewingBill(null)}
                  title="Close"
                  className="p-1 rounded-lg text-medical-slate-400 hover:text-white hover:bg-medical-navy-900 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-slate-700">
              {/* Customer & Bill Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Details Box */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-medical-navy-700" />
                    Patient / Customer Details
                  </span>
                  <div className="space-y-1 font-medium">
                    <div className="text-sm font-bold text-slate-900">
                      {viewingBill.customerName}
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 font-mono">
                      <Phone className="h-3 w-3 text-slate-400" />
                      +91 {viewingBill.customerMobile}
                    </div>
                    {viewingBill.doctorName && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Stethoscope className="h-3 w-3 text-slate-400" />
                        Dr. {viewingBill.doctorName}
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
                        {viewingBill.paymentMode}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Discount Mode</span>
                      <span className="font-bold text-slate-800 uppercase">
                        {viewingBill.discountMode === "NON_DISCOUNT"
                          ? "Non-Discount"
                          : "Discounted"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Store</span>
                      <span className="font-semibold text-slate-700 truncate block">
                        {viewingBill.storeSnapshot?.storeName || "IM MEDICOS PHARMACY"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">GSTIN</span>
                      <span className="font-mono text-slate-700 block truncate">
                        {viewingBill.storeSnapshot?.gstin || "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Line Items Table (NO COST PRICE OR PROFIT) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="bg-slate-100 px-4 py-2 font-bold text-slate-700 text-xs border-b border-slate-200 flex items-center justify-between">
                  <span>Line Items ({viewingBill.items?.length || 0})</span>
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
                      {viewingBill.items?.map((item, idx) => (
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
                    {viewingBill.amountInWords ||
                      formatAmountInIndianWords(viewingBill.grandTotal)}
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Sub Total (MRP):</span>
                    <span>₹{viewingBill.subTotal.toFixed(2)}</span>
                  </div>

                  {viewingBill.discount > 0 && (
                    <div className="flex justify-between text-amber-600 font-medium">
                      <span>Total Discount:</span>
                      <span>-₹{viewingBill.discount.toFixed(2)}</span>
                    </div>
                  )}

                  {viewingBill.gstTotal > 0 && (
                    <>
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>CGST (9%):</span>
                        <span>₹{viewingBill.cgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>SGST (9%):</span>
                        <span>₹{viewingBill.sgst.toFixed(2)}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between text-sm font-bold text-medical-navy-950 pt-2 border-t border-slate-200">
                    <span className="font-sans">Grand Total:</span>
                    <span className="text-base text-medical-green-600">
                      ₹{viewingBill.grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setViewingBill(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleDownload(viewingBill)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="h-4 w-4" />
                  Save PDF
                </button>

                <button
                  type="button"
                  onClick={() => handlePrint(viewingBill)}
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

export default CustomersPage;
