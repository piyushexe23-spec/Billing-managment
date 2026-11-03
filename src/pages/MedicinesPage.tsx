import React, { useState, useEffect, useMemo } from "react";
import {
  MedicineListItem,
  InventorySummaryMetrics,
  MedicineFilterOptions,
  MedicineSortField,
  SortDirection,
  CreateMedicineInput,
  StockAdjustmentInput,
} from "@/types/medicine";
import { medicineService } from "@/services/medicineService";
import { formatCurrencyINR } from "@/lib/formatters";
import { AddMedicineModal } from "@/components/medicines/AddMedicineModal";
import { MedicineDetailModal } from "@/components/medicines/MedicineDetailModal";
import { StockAdjustmentModal } from "@/components/medicines/StockAdjustmentModal";
import { BulkImportModal } from "@/components/medicines/BulkImportModal";
import { ExportModal } from "@/components/medicines/ExportModal";
import {
  Pill,
  Search,
  Plus,
  Upload,
  Download,
  Sliders,
  AlertTriangle,
  Clock,
  TrendingUp,
  Eye,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  RotateCcw,
  Loader2,
  X,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const MedicinesPage: React.FC = () => {
  // Inventory Data & Metrics
  const [medicines, setMedicines] = useState<MedicineListItem[]>([]);
  const [summary, setSummary] = useState<InventorySummaryMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters State
  const [search, setSearch] = useState<string>("");
  const [stockStatusFilter, setStockStatusFilter] = useState<MedicineFilterOptions["stockStatus"]>("ALL");
  const [expiryStatusFilter, setExpiryStatusFilter] = useState<MedicineFilterOptions["expiryStatus"]>("ALL");
  const [manufacturerFilter, setManufacturerFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // Sorting & Pagination State
  const [sortField, setSortField] = useState<MedicineSortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [viewMedicineId, setViewMedicineId] = useState<number | null>(null);
  const [stockAdjustData, setStockAdjustData] = useState<StockAdjustmentInput | null>(null);

  // Load Inventory Data
  const loadData = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const [medsList, summaryMetrics] = await Promise.all([
        medicineService.getMedicines(),
        medicineService.getInventorySummary(),
      ]);
      setMedicines(medsList);
      setSummary(summaryMetrics);
    } catch (err) {
      console.error("Failed to load inventory:", err);
      setErrorMessage("Failed to load medicine inventory from local database.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Dynamic filter options based on active medicines
  const manufacturers = useMemo(() => {
    const set = new Set<string>();
    medicines.forEach((m) => {
      if (m.manufacturer) set.add(m.manufacturer);
    });
    return Array.from(set).sort();
  }, [medicines]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    medicines.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set).sort();
  }, [medicines]);

  // Fast Filter & Search Logic
  const filteredMedicines = useMemo(() => {
    return medicines.filter((m) => {
      // 1. Search Query
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const nameMatch = m.name.toLowerCase().includes(query);
        const genericMatch = m.genericName?.toLowerCase().includes(query) || false;
        const manufacturerMatch = m.manufacturer?.toLowerCase().includes(query) || false;
        const categoryMatch = m.category?.toLowerCase().includes(query) || false;
        const barcodeMatch = m.barcode?.toLowerCase().includes(query) || false;
        const batchMatch = m.batches.some((b) => b.batchNumber.toLowerCase().includes(query));

        if (!nameMatch && !genericMatch && !manufacturerMatch && !categoryMatch && !barcodeMatch && !batchMatch) {
          return false;
        }
      }

      // 2. Stock Status Filter
      if (stockStatusFilter !== "ALL" && m.stockStatus !== stockStatusFilter) {
        return false;
      }

      // 3. Expiry Status Filter
      if (expiryStatusFilter !== "ALL" && m.expiryStatus !== expiryStatusFilter) {
        return false;
      }

      // 4. Manufacturer Filter
      if (manufacturerFilter !== "ALL" && m.manufacturer !== manufacturerFilter) {
        return false;
      }

      // 5. Category Filter
      if (categoryFilter !== "ALL" && m.category !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [medicines, search, stockStatusFilter, expiryStatusFilter, manufacturerFilter, categoryFilter]);

  // Sorting Logic
  const sortedMedicines = useMemo(() => {
    const items = [...filteredMedicines];
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "manufacturer":
          cmp = (a.manufacturer || "").localeCompare(b.manufacturer || "");
          break;
        case "totalStock":
          cmp = a.totalStock - b.totalStock;
          break;
        case "nearestExpiryDate":
          cmp = (a.nearestExpiryDate || "9999-99-99").localeCompare(
            b.nearestExpiryDate || "9999-99-99"
          );
          break;
        case "minMrp":
          cmp = a.minMrp - b.minMrp;
          break;
        case "minSellingPrice":
          cmp = a.minSellingPrice - b.minSellingPrice;
          break;
        default:
          cmp = 0;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return items;
  }, [filteredMedicines, sortField, sortDirection]);

  // Pagination Logic
  const totalPages = Math.ceil(sortedMedicines.length / rowsPerPage) || 1;
  const paginatedMedicines = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedMedicines.slice(start, start + rowsPerPage);
  }, [sortedMedicines, currentPage, rowsPerPage]);

  const handleSort = (field: MedicineSortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleClearFilters = () => {
    setSearch("");
    setStockStatusFilter("ALL");
    setExpiryStatusFilter("ALL");
    setManufacturerFilter("ALL");
    setCategoryFilter("ALL");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    stockStatusFilter !== "ALL" ||
    expiryStatusFilter !== "ALL" ||
    manufacturerFilter !== "ALL" ||
    categoryFilter !== "ALL";

  // Quick Card Click Filter Handlers
  const handleFilterLowStockCard = () => {
    if (stockStatusFilter === "LOW_STOCK") {
      setStockStatusFilter("ALL");
    } else {
      setStockStatusFilter("LOW_STOCK");
      setCurrentPage(1);
    }
  };

  const handleFilterExpiringCard = () => {
    if (expiryStatusFilter === "EXPIRING_SOON") {
      setExpiryStatusFilter("ALL");
    } else {
      setExpiryStatusFilter("EXPIRING_SOON");
      setCurrentPage(1);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] w-full min-w-0 mx-auto select-none">
      {/* 1. Header Toolbar */}
      <div className="bg-white rounded-2xl border border-medical-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-medical-navy-950">
            Medicine Inventory
          </h1>
          <p className="text-xs text-medical-slate-500">
            Manage medicines, stock levels and expiry.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsExportModalOpen(true)}
            className="text-xs font-semibold h-9 px-3.5 border-medical-slate-300 hover:bg-medical-slate-50 text-medical-navy-900 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-medical-slate-500" />
            Export
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            className="text-xs font-semibold h-9 px-3.5 border-medical-slate-300 hover:bg-medical-slate-50 text-medical-navy-900 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5 text-medical-slate-500" />
            Bulk Import
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="text-xs font-bold h-9 px-4 bg-medical-navy-900 hover:bg-medical-navy-800 text-white shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Medicine
          </Button>
        </div>
      </div>

      {/* Error Message Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-700 hover:text-red-900 font-bold ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Four Important Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5 minmax(0, 1fr)">
        {/* Card 1: Total Medicines */}
        <div className="bg-white rounded-2xl border border-medical-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-medical-slate-500 uppercase tracking-wider">
              Total Medicines
            </span>
            <div className="p-2 rounded-xl bg-medical-navy-50 text-medical-navy-900 shrink-0">
              <Pill className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 space-y-0.5">
            <div className="text-2xl sm:text-3xl font-bold text-medical-navy-950 font-sans tabular-nums">
              {summary ? summary.totalMedicines : 0}
            </div>
            <p className="text-xs text-medical-slate-500 truncate">
              {summary && summary.totalStockUnits > 0
                ? `${summary.totalStockUnits.toLocaleString("en-IN")} total units in stock`
                : "No stock units registered"}
            </p>
          </div>
        </div>

        {/* Card 2: Top Selling Medicines */}
        <div className="bg-white rounded-2xl border border-medical-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-medical-slate-500 uppercase tracking-wider">
              Top Selling Medicines
            </span>
            <div className="p-2 rounded-xl bg-medical-green-50 text-medical-green-800 shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 space-y-0.5">
            <div className="text-2xl sm:text-3xl font-bold text-medical-navy-950 font-sans tabular-nums">
              {summary ? summary.medicinesWithSales : 0}
            </div>
            <p className="text-xs text-medical-slate-500 truncate">
              {summary && summary.medicinesWithSales > 0
                ? "Based on completed sales"
                : "Sales data will appear after billing is enabled."}
            </p>
          </div>
        </div>

        {/* Card 3: Low Stock / Running Out (Clickable filter) */}
        <div
          onClick={handleFilterLowStockCard}
          className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs flex flex-col justify-between min-w-0 cursor-pointer transition-all hover:border-amber-400 group ${
            stockStatusFilter === "LOW_STOCK"
              ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20"
              : "border-medical-slate-200/80 hover:shadow-sm"
          }`}
          title="Click to filter low stock medicines"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider group-hover:text-amber-800">
              Low Stock / Running Out
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl sm:text-3xl font-bold text-amber-600 font-sans tabular-nums">
                {summary ? summary.lowStockCount : 0}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700 whitespace-nowrap">
                {summary ? summary.outOfStockCount : 0} out of stock
              </span>
            </div>
            <p className="text-xs text-medical-slate-500 truncate">
              {stockStatusFilter === "LOW_STOCK"
                ? "Active filter • Click to clear"
                : "Medicines at or below threshold"}
            </p>
          </div>
        </div>

        {/* Card 4: Expiring Soon (Clickable filter) */}
        <div
          onClick={handleFilterExpiringCard}
          className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs flex flex-col justify-between min-w-0 cursor-pointer transition-all hover:border-red-400 group ${
            expiryStatusFilter === "EXPIRING_SOON"
              ? "border-red-500 ring-2 ring-red-500/20 bg-red-50/20"
              : "border-medical-slate-200/80 hover:shadow-sm"
          }`}
          title="Click to filter medicines expiring within 10 days"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-red-900 uppercase tracking-wider group-hover:text-red-800">
              Expiring Soon (≤10 Days)
            </span>
            <div className="p-2 rounded-xl bg-red-50 text-red-700 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl sm:text-3xl font-bold text-red-600 font-sans tabular-nums">
                {summary ? summary.expiringSoonCount : 0}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700 whitespace-nowrap">
                {summary ? summary.expiredCount : 0} expired
              </span>
            </div>
            <p className="text-xs text-medical-slate-500 truncate">
              {expiryStatusFilter === "EXPIRING_SOON"
                ? "Active filter • Click to clear"
                : "Batches expiring within 10 days"}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Search and Multi-Filter Bar */}
      <div className="bg-white rounded-2xl border border-medical-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3">
        {/* Row 1: Search full-width with result count on right */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-medical-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by medicine name, generic name, manufacturer, batch number, or barcode..."
              className="w-full h-9 pl-9 pr-8 rounded-xl border border-medical-slate-300 text-xs bg-medical-slate-50/50 text-medical-slate-900 placeholder:text-medical-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-navy-100 focus-visible:border-medical-navy-600 transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-medical-slate-400 hover:text-medical-navy-950 p-1"
                aria-label="Clear search text"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Result Count and Clear Filters */}
          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
            <span className="text-xs text-medical-slate-500 font-medium tabular-nums whitespace-nowrap">
              Showing <strong className="text-medical-navy-950">{filteredMedicines.length}</strong> of {medicines.length} medicines
            </span>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="text-xs h-9 px-3 text-red-700 bg-red-50/50 hover:bg-red-50 border-red-200 cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1 text-red-600" />
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* Row 2: Equal grid of 4 filter selects with consistent height (h-9) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-medical-slate-100 text-xs">
          {/* Stock Status */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-medical-slate-500 block tracking-wider">
              Stock Status
            </label>
            <select
              value={stockStatusFilter}
              onChange={(e) => {
                setStockStatusFilter(e.target.value as typeof stockStatusFilter);
                setCurrentPage(1);
              }}
              className="w-full h-9 rounded-xl border border-medical-slate-300 px-3 text-xs bg-white text-medical-slate-800 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-navy-100 focus-visible:border-medical-navy-600"
            >
              <option value="ALL">All Stock Levels</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock (≤ Threshold)</option>
              <option value="OUT_OF_STOCK">Out of Stock (0 units)</option>
            </select>
          </div>

          {/* Expiry Status */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-medical-slate-500 block tracking-wider">
              Expiry Window
            </label>
            <select
              value={expiryStatusFilter}
              onChange={(e) => {
                setExpiryStatusFilter(e.target.value as typeof expiryStatusFilter);
                setCurrentPage(1);
              }}
              className="w-full h-9 rounded-xl border border-medical-slate-300 px-3 text-xs bg-white text-medical-slate-800 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-navy-100 focus-visible:border-medical-navy-600"
            >
              <option value="ALL">All Expiry Dates</option>
              <option value="EXPIRING_SOON">Expiring Soon (≤10 Days)</option>
              <option value="EXPIRED">Already Expired</option>
              <option value="SAFE">Safe (&gt;10 Days)</option>
            </select>
          </div>

          {/* Manufacturer Filter */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-medical-slate-500 block tracking-wider">
              Manufacturer
            </label>
            <select
              value={manufacturerFilter}
              onChange={(e) => {
                setManufacturerFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 rounded-xl border border-medical-slate-300 px-3 text-xs bg-white text-medical-slate-800 font-medium truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-navy-100 focus-visible:border-medical-navy-600"
            >
              <option value="ALL">All Manufacturers</option>
              {manufacturers.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-medical-slate-500 block tracking-wider">
              Therapeutic Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 rounded-xl border border-medical-slate-300 px-3 text-xs bg-white text-medical-slate-800 font-medium truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-navy-100 focus-visible:border-medical-navy-600"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. Complete Medicine Inventory Table */}
      <div className="bg-white rounded-2xl border border-medical-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-medical-slate-50 z-10 shadow-[0_1px_0_0_#e2e8f0]">
              <tr className="border-b border-medical-slate-200 text-medical-slate-600 font-bold text-[11px] uppercase tracking-wider">
                {/* Column: Name */}
                <th
                  onClick={() => handleSort("name")}
                  className="py-3 px-4 cursor-pointer hover:bg-medical-slate-100 transition-colors select-none min-w-[220px]"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Medicine Name</span>
                    {sortField === "name" ? (
                      sortDirection === "asc" ? (
                        <ChevronUp className="w-3.5 h-3.5 text-medical-navy-900" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-medical-navy-900" />
                      )
                    ) : (
                      <ChevronsUpDown className="w-3.5 h-3.5 text-medical-slate-400" />
                    )}
                  </div>
                </th>

                {/* Column: Manufacturer */}
                <th
                  onClick={() => handleSort("manufacturer")}
                  className="py-3 px-3 cursor-pointer hover:bg-medical-slate-100 transition-colors select-none min-w-[140px]"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Manufacturer</span>
                    {sortField === "manufacturer" ? (
                      sortDirection === "asc" ? (
                        <ChevronUp className="w-3.5 h-3.5 text-medical-navy-900" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-medical-navy-900" />
                      )
                    ) : (
                      <ChevronsUpDown className="w-3.5 h-3.5 text-medical-slate-400" />
                    )}
                  </div>
                </th>

                <th className="py-3 px-3 whitespace-nowrap">Active Batches</th>

                {/* Column: Expiry Date */}
                <th
                  onClick={() => handleSort("nearestExpiryDate")}
                  className="py-3 px-3 cursor-pointer hover:bg-medical-slate-100 transition-colors select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Nearest Expiry</span>
                    {sortField === "nearestExpiryDate" ? (
                      sortDirection === "asc" ? (
                        <ChevronUp className="w-3.5 h-3.5 text-medical-navy-900" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-medical-navy-900" />
                      )
                    ) : (
                      <ChevronsUpDown className="w-3.5 h-3.5 text-medical-slate-400" />
                    )}
                  </div>
                </th>

                <th className="py-3 px-3 text-right whitespace-nowrap">Cost Price</th>

                {/* Column: MRP */}
                <th
                  onClick={() => handleSort("minMrp")}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-medical-slate-100 transition-colors select-none whitespace-nowrap"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>MRP</span>
                    {sortField === "minMrp" ? (
                      sortDirection === "asc" ? (
                        <ChevronUp className="w-3.5 h-3.5 text-medical-navy-900" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-medical-navy-900" />
                      )
                    ) : (
                      <ChevronsUpDown className="w-3.5 h-3.5 text-medical-slate-400" />
                    )}
                  </div>
                </th>

                {/* Column: Selling Price */}
                <th
                  onClick={() => handleSort("minSellingPrice")}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-medical-slate-100 transition-colors select-none whitespace-nowrap"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Selling Price</span>
                    {sortField === "minSellingPrice" ? (
                      sortDirection === "asc" ? (
                        <ChevronUp className="w-3.5 h-3.5 text-medical-navy-900" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-medical-navy-900" />
                      )
                    ) : (
                      <ChevronsUpDown className="w-3.5 h-3.5 text-medical-slate-400" />
                    )}
                  </div>
                </th>

                {/* Column: Stock */}
                <th
                  onClick={() => handleSort("totalStock")}
                  className="py-3 px-3 text-right cursor-pointer hover:bg-medical-slate-100 transition-colors select-none whitespace-nowrap"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Available Stock</span>
                    {sortField === "totalStock" ? (
                      sortDirection === "asc" ? (
                        <ChevronUp className="w-3.5 h-3.5 text-medical-navy-900" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-medical-navy-900" />
                      )
                    ) : (
                      <ChevronsUpDown className="w-3.5 h-3.5 text-medical-slate-400" />
                    )}
                  </div>
                </th>

                <th className="py-3 px-3 whitespace-nowrap">Stock Status</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-medical-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-medical-slate-500">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto text-medical-navy-600 mb-2" />
                    Loading medicine inventory records...
                  </td>
                </tr>
              ) : medicines.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-medical-navy-50 text-medical-navy-800 flex items-center justify-center mx-auto border border-medical-navy-100">
                        <Package className="w-6 h-6 text-medical-navy-700" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-base font-bold text-medical-navy-950">
                          No medicines in inventory yet
                        </p>
                        <p className="text-xs text-medical-slate-500">
                          Your inventory is empty. Add your first medicine or use Bulk Import to get started.
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-3 pt-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setIsAddModalOpen(true)}
                          className="h-9 px-4 text-xs font-bold bg-medical-navy-900 hover:bg-medical-navy-800 text-white cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1.5" />
                          Add Medicine
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsImportModalOpen(true)}
                          className="h-9 px-4 text-xs font-semibold border-medical-slate-300 hover:bg-medical-slate-50 text-medical-navy-900 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5 mr-1.5" />
                          Bulk Import
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : paginatedMedicines.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-medical-slate-500 space-y-2">
                    <Package className="w-7 h-7 mx-auto text-medical-slate-300" />
                    <p className="font-semibold text-medical-slate-700 text-xs">
                      No medicines matched your search or filter criteria.
                    </p>
                    {hasActiveFilters && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleClearFilters}
                        className="text-xs h-8 px-3 text-red-700 border-red-200 hover:bg-red-50 mt-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3 mr-1 text-red-600" />
                        Reset All Filters
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedMedicines.map((m) => (
                  <tr key={m.id} className="hover:bg-medical-slate-50/80 transition-colors group">
                    {/* Name & Generic */}
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <span className="font-bold text-medical-navy-950 block text-xs group-hover:text-medical-navy-800">
                          {m.name}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-medical-slate-500">
                          {m.genericName && <span className="truncate max-w-[200px]">{m.genericName}</span>}
                          {m.category && (
                            <span className="bg-medical-slate-100 px-1.5 py-0.5 rounded text-medical-slate-600 font-sans">
                              {m.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Manufacturer */}
                    <td className="py-3 px-3 text-medical-slate-600 font-medium">
                      {m.manufacturer || "Generic"}
                    </td>

                    {/* Active Batches */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className="text-xs font-medium text-medical-slate-700 tabular-nums font-sans"
                        title={m.nearestBatchNumber ? `Nearest batch: ${m.nearestBatchNumber}` : undefined}
                      >
                        {m.activeBatchesCount} {m.activeBatchesCount === 1 ? "batch" : "batches"}
                      </span>
                    </td>

                    {/* Nearest Expiry */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {m.nearestExpiryDate ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-sans tabular-nums text-xs font-semibold text-medical-slate-800">
                            {m.nearestExpiryDate}
                          </span>
                          {m.expiryStatus === "EXPIRED" && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                              Expired
                            </span>
                          )}
                          {m.expiryStatus === "EXPIRING_SOON" && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                              Expiring &le;10d
                            </span>
                          )}
                          {m.expiryStatus === "SAFE" && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                              Safe
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-medical-slate-400 text-xs">No batches</span>
                      )}
                    </td>

                    {/* Cost Price */}
                    <td className="py-3 px-3 text-right font-sans tabular-nums text-medical-slate-600 whitespace-nowrap">
                      {m.activeBatchesCount > 0 ? formatCurrencyINR(m.minCostPrice) : "—"}
                    </td>

                    {/* MRP */}
                    <td className="py-3 px-3 text-right font-sans tabular-nums font-semibold text-medical-slate-900 whitespace-nowrap">
                      {m.activeBatchesCount > 0 ? formatCurrencyINR(m.minMrp) : "—"}
                    </td>

                    {/* Selling Price */}
                    <td className="py-3 px-3 text-right font-sans tabular-nums font-bold text-medical-green-700 whitespace-nowrap">
                      {m.activeBatchesCount > 0 ? formatCurrencyINR(m.minSellingPrice) : "—"}
                    </td>

                    {/* Available Stock */}
                    <td className="py-3 px-3 text-right font-sans tabular-nums whitespace-nowrap">
                      <span className="font-bold text-medical-navy-950 text-sm">
                        {m.totalStock.toLocaleString("en-IN")}
                      </span>
                      <span className="text-[11px] font-normal text-medical-slate-500 ml-1">
                        {m.unit}s
                      </span>
                    </td>

                    {/* Stock Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {m.stockStatus === "OUT_OF_STOCK" && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700 border border-red-200">
                          Out of Stock
                        </span>
                      )}
                      {m.stockStatus === "LOW_STOCK" && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          Low Stock
                        </span>
                      )}
                      {m.stockStatus === "IN_STOCK" && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-medical-green-100 text-medical-green-800 border border-medical-green-200">
                          In Stock
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewMedicineId(m.id)}
                          className="h-8 w-8 rounded-lg border border-medical-slate-300 text-medical-slate-700 hover:text-medical-navy-900 hover:bg-medical-slate-100 inline-flex items-center justify-center cursor-pointer transition-colors"
                          title="View Details & Batches"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (m.batches.length === 0) {
                              setViewMedicineId(m.id);
                            } else {
                              setStockAdjustData({
                                medicineId: m.id,
                                batchId: m.batches[0].id,
                                adjustmentType: "ADD",
                                quantity: 1,
                                reason: "Physical count recount",
                              });
                            }
                          }}
                          className="h-8 w-8 rounded-lg border border-medical-slate-300 text-medical-slate-700 hover:text-medical-navy-900 hover:bg-medical-slate-100 inline-flex items-center justify-center cursor-pointer transition-colors"
                          title="Adjust Stock Quantity"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Pagination Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 border-t border-medical-slate-200 bg-medical-slate-50/60 text-xs text-medical-slate-600 gap-3">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setCurrentPage(1);
              }}
              className="h-8 rounded-lg border border-medical-slate-300 px-2 bg-white text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-medical-navy-600"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto tabular-nums">
            <span>
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1 ml-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 px-2.5 text-xs cursor-pointer disabled:opacity-40"
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 px-2.5 text-xs cursor-pointer disabled:opacity-40"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddMedicineModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={async (input: CreateMedicineInput) => {
          await medicineService.createMedicine(input);
          await loadData();
        }}
      />

      <MedicineDetailModal
        medicineId={viewMedicineId}
        isOpen={viewMedicineId !== null}
        onClose={() => setViewMedicineId(null)}
        onOpenStockAdjustment={(adjData) => setStockAdjustData(adjData)}
        onRefresh={loadData}
      />

      <StockAdjustmentModal
        isOpen={stockAdjustData !== null}
        onClose={() => setStockAdjustData(null)}
        initialData={stockAdjustData}
        onSuccess={loadData}
      />

      <BulkImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={loadData}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        allItems={medicines}
        filteredItems={filteredMedicines}
      />
    </div>
  );
};
