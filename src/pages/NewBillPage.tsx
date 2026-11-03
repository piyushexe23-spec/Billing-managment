import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  BillItem,
  BillRecord,
  DiscountMode,
  PaymentMode,
  SaleableMedicine,
} from "@/types/billing";
import { billingService } from "@/services/billingService";
import { storeService } from "@/services/storeService";
import { StoreDetails } from "@/types/store";
import {
  formatIndianCurrency,
  isValidIndianMobile,
} from "@/lib/billingConfig";
import { downloadInvoicePdf, printInvoice } from "@/lib/invoicePrintService";
import { InvoicePdfDocument } from "@/components/billing/InvoicePdfDocument";
import {
  Receipt,
  Search,
  Plus,
  Trash2,
  Printer,
  FileDown,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Eye,
  X,
  CreditCard,
  Banknote,
  QrCode,
  Tag,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const NewBillPage: React.FC = () => {
  // Store Details & Next Bill Preview
  const [store, setStore] = useState<StoreDetails | null>(null);
  const [nextBillPreview, setNextBillPreview] = useState<string>("IM-0001");
  const [saleableMedicines, setSaleableMedicines] = useState<SaleableMedicine[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Billing State
  const [discountMode, setDiscountMode] = useState<DiscountMode>("NON_DISCOUNT");
  const [items, setItems] = useState<BillItem[]>([]);
  const [customerName, setCustomerName] = useState<string>("");
  const [customerMobile, setCustomerMobile] = useState<string>("");
  const [doctorName, setDoctorName] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("CASH");

  // Inline Validation Errors
  const [errors, setErrors] = useState<{
    customerName?: string;
    customerMobile?: string;
    items?: string;
    [key: string]: string | undefined;
  }>({});

  // Rate modification tracking for mode switch confirmation
  const [hasCustomRates, setHasCustomRates] = useState<boolean>(false);
  const [pendingModeSwitch, setPendingModeSwitch] = useState<DiscountMode | null>(null);

  // Search and autocomplete
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);

  // Modals
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState<boolean>(false);
  const [savedBill, setSavedBill] = useState<BillRecord | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [rateWarningDialog, setRateWarningDialog] = useState<{
    lineId: string;
    medicineName: string;
    rate: number;
    costPrice: number;
  } | null>(null);

  // Load initial store data, saleable medicines, and next bill preview
  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const [storeData, preview, meds] = await Promise.all([
        storeService.getStoreDetails(),
        billingService.getNextBillNumberPreview(),
        billingService.getSaleableMedicines(),
      ]);
      setStore(storeData);
      setNextBillPreview(preview);
      setSaleableMedicines(meds);
    } catch (err) {
      console.error("Failed to load billing initialization data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Warn user before leaving page if items are in the cart
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (items.length > 0) {
        e.preventDefault();
        e.returnValue = "You have unsaved bill items. Are you sure you want to leave?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [items.length]);

  // Filtered search medicines
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();

    return saleableMedicines.filter((m) => {
      const matchName = m.name.toLowerCase().includes(q);
      const matchGen = m.genericName?.toLowerCase().includes(q) || false;
      const matchMfr = m.manufacturer?.toLowerCase().includes(q) || false;
      const matchBarcode = m.barcode?.toLowerCase().includes(q) || false;
      const matchBatch = m.batches.some((b) => b.batchNumber.toLowerCase().includes(q));
      return matchName || matchGen || matchMfr || matchBarcode || matchBatch;
    });
  }, [searchQuery, saleableMedicines]);

  // Handle Barcode auto-scan
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        searchResults.length > 0 ? (prev + 1) % searchResults.length : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        searchResults.length > 0
          ? (prev - 1 + searchResults.length) % searchResults.length
          : 0
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Check if exact barcode match
      const exactBarcode = saleableMedicines.find(
        (m) => m.barcode && m.barcode.trim().toLowerCase() === searchQuery.trim().toLowerCase()
      );
      if (exactBarcode) {
        handleAddMedicine(exactBarcode);
        return;
      }
      if (searchResults.length > 0 && highlightedIndex < searchResults.length) {
        handleAddMedicine(searchResults[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsSearchOpen(false);
    }
  };

  // Add medicine to bill using FEFO allocation
  const handleAddMedicine = (med: SaleableMedicine) => {
    if (!med.isActive) {
      alert("This medicine is archived and cannot be added to a bill.");
      return;
    }
    if (med.totalSaleableStock <= 0 || med.batches.length === 0) {
      alert("This medicine has no available unexpired stock.");
      return;
    }

    // Default to 1 unit FEFO allocation
    const splitLines = billingService.splitMedicineQuantityFefo(med, 1, discountMode);
    if (splitLines.length === 0) return;

    setItems((prev) => {
      // Check if medicine batch already exists on bill
      const existingIdx = prev.findIndex(
        (it) => it.medicineId === med.id && it.batchId === splitLines[0].batchId
      );
      if (existingIdx >= 0) {
        // Increment quantity if available
        const currentLine = prev[existingIdx];
        if (currentLine.quantity + 1 <= currentLine.availableStock) {
          const updated = [...prev];
          const newQty = currentLine.quantity + 1;
          const rate = discountMode === "NON_DISCOUNT" ? currentLine.mrp : currentLine.rate;
          updated[existingIdx] = {
            ...currentLine,
            quantity: newQty,
            rate,
            amount: Number((rate * newQty).toFixed(2)),
          };
          return updated;
        } else {
          alert(
            `Cannot add more. Batch ${currentLine.batchNumber} has only ${currentLine.availableStock} units available.`
          );
          return prev;
        }
      }
      return [...prev, ...splitLines];
    });

    setSearchQuery("");
    setIsSearchOpen(false);
    setErrors((prev) => ({ ...prev, items: undefined }));
    searchInputRef.current?.focus();
  };

  // Quantity change handler with boundary validation
  const handleQuantityChange = (lineId: string, val: string) => {
    const qty = parseInt(val, 10);
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== lineId) return it;
        if (isNaN(qty) || qty < 1) {
          return { ...it, quantity: 1, amount: Number((it.rate * 1).toFixed(2)) };
        }
        if (qty > it.availableStock) {
          alert(`Quantity cannot exceed available stock (${it.availableStock} units).`);
          return {
            ...it,
            quantity: it.availableStock,
            amount: Number((it.rate * it.availableStock).toFixed(2)),
          };
        }
        return {
          ...it,
          quantity: qty,
          amount: Number((it.rate * qty).toFixed(2)),
        };
      })
    );
  };

  // Rate change handler (only active in Discounted mode)
  const handleRateChange = (lineId: string, val: string) => {
    const newRate = parseFloat(val);
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== lineId) return it;
        if (isNaN(newRate)) {
          return { ...it, rate: 0, amount: 0 };
        }
        if (newRate < 0) {
          alert("Rate cannot be negative.");
          return it;
        }
        if (newRate > it.mrp) {
          alert(`Rate cannot exceed MRP (${formatIndianCurrency(it.mrp)}).`);
          return it;
        }

        // Warn if below cost price
        if (newRate < it.costPrice) {
          setRateWarningDialog({
            lineId,
            medicineName: it.medicineName,
            rate: newRate,
            costPrice: it.costPrice,
          });
        }

        setHasCustomRates(true);
        return {
          ...it,
          rate: newRate,
          amount: Number((newRate * it.quantity).toFixed(2)),
        };
      })
    );
  };

  // Switch batch for an existing line
  const handleSwitchBatch = (lineId: string, newBatchId: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== lineId) return it;
        const med = saleableMedicines.find((m) => m.id === it.medicineId);
        if (!med) return it;
        const batch = med.batches.find((b) => b.id === newBatchId);
        if (!batch) return it;

        const rate = discountMode === "NON_DISCOUNT" ? batch.mrp : batch.sellingPrice;
        const qty = Math.min(it.quantity, batch.stockQty);

        return {
          ...it,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          expDate: batch.expDate,
          availableStock: batch.stockQty,
          costPrice: batch.costPrice,
          mrp: batch.mrp,
          sellingPrice: batch.sellingPrice,
          rate,
          quantity: qty,
          amount: Number((rate * qty).toFixed(2)),
        };
      })
    );
  };

  // Remove line item
  const handleRemoveItem = (lineId: string) => {
    setItems((prev) => prev.filter((it) => it.id !== lineId));
  };

  // Mode Switch Request Handler
  const handleModeSwitchRequest = (newMode: DiscountMode) => {
    if (newMode === discountMode) return;
    if (hasCustomRates && items.length > 0) {
      setPendingModeSwitch(newMode);
    } else {
      executeModeSwitch(newMode);
    }
  };

  // Recalculates all line rates and amounts when mode changes
  const executeModeSwitch = (newMode: DiscountMode) => {
    setDiscountMode(newMode);
    setItems((prev) =>
      prev.map((it) => {
        const rate = newMode === "NON_DISCOUNT" ? it.mrp : it.sellingPrice;
        return {
          ...it,
          rate,
          amount: Number((rate * it.quantity).toFixed(2)),
        };
      })
    );
    setHasCustomRates(false);
    setPendingModeSwitch(null);
  };

  // Live bill calculations
  const totals = useMemo(() => {
    return billingService.calculateTotals(items, discountMode);
  }, [items, discountMode]);

  // Clear Bill handler
  const handleClearBill = () => {
    setItems([]);
    setCustomerName("");
    setCustomerMobile("");
    setDoctorName("");
    setPaymentMode("CASH");
    setErrors({});
    setHasCustomRates(false);
    setIsClearConfirmOpen(false);
    searchInputRef.current?.focus();
  };

  // Form submission and bill save handler
  const handleSaveBill = async (andPrint: boolean = false) => {
    // 1. Validate fields
    const newErrors: typeof errors = {};
    if (!customerName.trim()) {
      newErrors.customerName = "Customer name cannot be empty";
    }
    if (!customerMobile.trim()) {
      newErrors.customerMobile = "Mobile number is required";
    } else if (!isValidIndianMobile(customerMobile)) {
      newErrors.customerMobile = "Enter a valid 10-digit Indian mobile number";
    }
    if (items.length === 0) {
      newErrors.items = "Please add at least one medicine to the bill.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Focus first error
      if (newErrors.customerName) {
        document.getElementById("input-customer-name")?.focus();
      } else if (newErrors.customerMobile) {
        document.getElementById("input-customer-mobile")?.focus();
      }
      return;
    }

    try {
      setIsSaving(true);
      const billRecord = await billingService.saveBill({
        customerName: customerName.trim(),
        customerMobile: customerMobile.trim(),
        doctorName: doctorName.trim() || null,
        discountMode,
        paymentMode,
        items: items.map((it) => ({
          medicineId: it.medicineId,
          batchId: it.batchId,
          medicineName: it.medicineName,
          batchNumber: it.batchNumber,
          expDate: it.expDate,
          unit: it.unit,
          quantity: it.quantity,
          costPrice: it.costPrice,
          mrp: it.mrp,
          sellingPrice: it.sellingPrice,
          rate: it.rate,
          amount: it.amount,
        })),
      });

      // Reload fresh inventory batches and next bill preview
      loadInitialData();

      setSavedBill(billRecord);

      if (andPrint) {
        printInvoice(billRecord);
      }
    } catch (err: any) {
      alert(`Error saving bill: ${err?.message || "Internal transaction failure"}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center space-y-3 select-none">
        <div className="w-8 h-8 border-2 border-medical-navy-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-medical-slate-500 font-medium">Loading billing workstation data...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1700px] w-full min-w-0 mx-auto select-none">
      {/* 1. Header Toolbar */}
      <div className="bg-white rounded-2xl border border-medical-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-medical-navy-950">New Counter Bill</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-medical-navy-100 text-medical-navy-800 font-mono">
              Next bill: {nextBillPreview}
            </span>
          </div>
          <p className="text-xs text-medical-slate-500">
            Generate sale bill with automatic FEFO batch allocation and live stock deduction.
          </p>
        </div>

        {/* Discount Mode Toggle (Non-Discount default vs Discounted) */}
        <div className="flex items-center bg-medical-slate-100 p-1 rounded-xl border border-medical-slate-200">
          <button
            type="button"
            onClick={() => handleModeSwitchRequest("NON_DISCOUNT")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              discountMode === "NON_DISCOUNT"
                ? "bg-white text-medical-navy-950 shadow-xs"
                : "text-medical-slate-600 hover:text-medical-navy-950"
            }`}
          >
            Non-Discount Bill
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitchRequest("DISCOUNTED")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              discountMode === "DISCOUNTED"
                ? "bg-medical-green-600 text-white shadow-xs"
                : "text-medical-slate-600 hover:text-medical-navy-950"
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Discounted Bill
          </button>
        </div>
      </div>

      {/* 2. Main Billing Layout: Left = Search & Items, Right = Customer & Totals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ======================================================== */}
        {/* LEFT COLUMN (8 Cols): Medicine Search + Line Items Table */}
        {/* ======================================================== */}
        <div className="lg:col-span-8 space-y-4">
          {/* Medicine Search Box with Autocomplete */}
          <div className="relative">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-medical-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                  setHighlightedIndex(0);
                }}
                onFocus={() => setIsSearchOpen(true)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search medicine by name, generic, manufacturer, batch, or barcode... (Press Enter to add)"
                className="w-full h-11 pl-10 pr-10 rounded-xl border border-medical-slate-300 text-sm bg-white text-medical-navy-950 placeholder:text-medical-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-navy-200 focus-visible:border-medical-navy-600 shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-medical-slate-400 hover:text-medical-navy-950"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Autocomplete Dropdown */}
            {isSearchOpen && searchResults.length > 0 && (
              <div
                ref={searchResultsRef}
                className="absolute z-50 left-0 right-0 mt-1 max-h-80 overflow-y-auto bg-white rounded-xl border border-medical-slate-200 shadow-xl divide-y divide-medical-slate-100"
              >
                {searchResults.map((med, idx) => {
                  const isHighlighted = idx === highlightedIndex;
                  const isAddable = med.isActive && med.totalSaleableStock > 0;

                  return (
                    <div
                      key={med.id}
                      onClick={() => {
                        if (isAddable) handleAddMedicine(med);
                      }}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                        isHighlighted ? "bg-medical-slate-50" : "bg-white"
                      } ${!isAddable ? "opacity-60 cursor-not-allowed bg-slate-50/50" : ""}`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-medical-navy-950">
                            {med.name}
                          </span>
                          <span className="text-[11px] font-semibold text-medical-slate-500 bg-medical-slate-100 px-1.5 py-0.2 rounded">
                            {med.unit}
                          </span>
                          {!isAddable && (
                            <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.2 rounded">
                              {!med.isActive ? "Archived" : "Out of Stock / Expired"}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-medical-slate-500 flex items-center gap-2">
                          {med.genericName && <span>{med.genericName}</span>}
                          {med.manufacturer && <span>• {med.manufacturer}</span>}
                          {med.nearestExpiryDate && (
                            <span className="text-amber-700 font-medium">
                              • Exp: {med.nearestExpiryDate}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-medical-navy-950 font-mono">
                          MRP: {formatIndianCurrency(med.batches[0]?.mrp || 0)}
                        </div>
                        <div className="text-xs text-medical-green-700 font-semibold">
                          Stock: {med.totalSaleableStock} units
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bill Items Table Container */}
          <div className="bg-white rounded-2xl border border-medical-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-medical-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-medical-navy-700" />
                <h3 className="text-sm font-bold text-medical-navy-950">Bill Items</h3>
                <span className="text-xs font-semibold text-medical-slate-500">
                  ({items.length} {items.length === 1 ? "item" : "items"})
                </span>
              </div>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsClearConfirmOpen(true)}
                  className="text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear all
                </button>
              )}
            </div>

            {errors.items && (
              <div className="p-3 bg-red-50 border-b border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {errors.items}
              </div>
            )}

            {items.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-medical-slate-100 flex items-center justify-center mx-auto text-medical-slate-400">
                  <Receipt className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-medical-navy-950">No items on this bill yet</h4>
                <p className="text-xs text-medical-slate-500 max-w-sm mx-auto">
                  Search medicines above or scan a barcode to add medicines to this sale bill.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-medical-slate-50 text-medical-slate-600 font-bold border-b border-medical-slate-200">
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3 min-w-[160px]">Medicine</th>
                      <th className="py-2.5 px-3 min-w-[110px]">Batch</th>
                      <th className="py-2.5 px-3 w-20 text-center">Expiry</th>
                      <th className="py-2.5 px-3 w-20 text-center">Qty</th>
                      <th className="py-2.5 px-3 w-24 text-right">MRP (₹)</th>
                      <th className="py-2.5 px-3 w-24 text-right">
                        Rate (₹)
                        {discountMode === "DISCOUNTED" && (
                          <span className="text-[10px] text-medical-green-600 block font-normal">
                            (Editable)
                          </span>
                        )}
                      </th>
                      <th className="py-2.5 px-3 w-24 text-right">Amount (₹)</th>
                      <th className="py-2.5 px-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-medical-slate-100">
                    {items.map((it, idx) => {
                      const med = saleableMedicines.find((m) => m.id === it.medicineId);
                      const availableBatches = med?.batches || [];

                      return (
                        <tr key={it.id} className="hover:bg-medical-slate-50/50">
                          <td className="py-2.5 px-3 text-center text-medical-slate-400 font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-medical-navy-950">{it.medicineName}</div>
                            <div className="text-[10px] text-medical-slate-400">
                              Unit: {it.unit}
                            </div>
                          </td>
                          {/* Batch selection dropdown */}
                          <td className="py-2.5 px-3">
                            {availableBatches.length > 1 ? (
                              <select
                                value={it.batchId}
                                onChange={(e) =>
                                  handleSwitchBatch(it.id, parseInt(e.target.value, 10))
                                }
                                className="h-7 px-1.5 rounded border border-medical-slate-300 text-xs bg-white font-mono"
                              >
                                {availableBatches.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.batchNumber} ({b.stockQty})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="font-mono text-medical-slate-700 bg-medical-slate-100 px-1.5 py-0.5 rounded">
                                {it.batchNumber}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-[11px] text-medical-slate-600">
                            {it.expDate}
                          </td>
                          {/* Quantity input */}
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              min={1}
                              max={it.availableStock}
                              value={it.quantity}
                              onChange={(e) => handleQuantityChange(it.id, e.target.value)}
                              className="w-14 h-7 text-center rounded border border-medical-slate-300 font-bold text-medical-navy-950 focus:border-medical-navy-600"
                            />
                          </td>
                          {/* MRP */}
                          <td className="py-2.5 px-3 text-right font-mono text-medical-slate-600">
                            {it.mrp.toFixed(2)}
                          </td>
                          {/* Rate */}
                          <td className="py-2.5 px-3 text-right">
                            {discountMode === "DISCOUNTED" ? (
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                max={it.mrp}
                                value={it.rate}
                                onChange={(e) => handleRateChange(it.id, e.target.value)}
                                className="w-18 h-7 text-right px-1.5 rounded border border-medical-green-300 font-mono font-bold text-medical-green-800 bg-medical-green-50/30"
                              />
                            ) : (
                              <span className="font-mono text-medical-slate-800">
                                {it.rate.toFixed(2)}
                              </span>
                            )}
                          </td>
                          {/* Amount */}
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-medical-navy-950">
                            {it.amount.toFixed(2)}
                          </td>
                          {/* Remove button */}
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(it.id)}
                              className="p-1 text-medical-slate-400 hover:text-red-600 transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN (4 Cols): Customer Info, Tax & Totals Card */}
        {/* ======================================================== */}
        <div className="lg:col-span-4 space-y-4">
          {/* Customer / Patient Details Box */}
          <div className="bg-white rounded-2xl border border-medical-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3.5">
            <h3 className="text-sm font-bold text-medical-navy-950 flex items-center gap-1.5 border-b border-medical-slate-100 pb-2">
              <User className="w-4 h-4 text-medical-navy-700" />
              Patient / Customer Details
            </h3>

            {/* Customer Name */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-medical-slate-600 block">
                Customer Name <span className="text-red-500">*</span>
              </label>
              <input
                id="input-customer-name"
                type="text"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  if (errors.customerName) setErrors((prev) => ({ ...prev, customerName: undefined }));
                }}
                placeholder="e.g., Rajesh Sharma"
                className={`w-full h-9 px-3 rounded-xl border text-xs bg-white text-medical-slate-900 transition-colors ${
                  errors.customerName
                    ? "border-red-500 ring-1 ring-red-300 focus:border-red-600"
                    : "border-medical-slate-300 focus:border-medical-navy-600"
                }`}
              />
              {errors.customerName && (
                <p className="text-[11px] font-medium text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.customerName}
                </p>
              )}
            </div>

            {/* Customer Mobile */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-medical-slate-600 block">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-medical-slate-400">
                  +91
                </span>
                <input
                  id="input-customer-mobile"
                  type="text"
                  maxLength={10}
                  value={customerMobile}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, "");
                    setCustomerMobile(clean);
                    if (errors.customerMobile) setErrors((prev) => ({ ...prev, customerMobile: undefined }));
                  }}
                  placeholder="9876543210"
                  className={`w-full h-9 pl-11 pr-3 rounded-xl border text-xs bg-white text-medical-slate-900 font-mono transition-colors ${
                    errors.customerMobile
                      ? "border-red-500 ring-1 ring-red-300 focus:border-red-600"
                      : "border-medical-slate-300 focus:border-medical-navy-600"
                  }`}
                />
              </div>
              {errors.customerMobile && (
                <p className="text-[11px] font-medium text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.customerMobile}
                </p>
              )}
            </div>

            {/* Doctor Name (Optional) */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-medical-slate-600 block">
                Doctor Name <span className="text-medical-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="e.g., Dr. A. K. Verma"
                className="w-full h-9 px-3 rounded-xl border border-medical-slate-300 text-xs bg-white text-medical-slate-900 focus:border-medical-navy-600"
              />
            </div>

            {/* Payment Mode */}
            <div className="space-y-1 pt-1">
              <label className="text-[11px] font-bold text-medical-slate-600 block">
                Payment Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMode("CASH")}
                  className={`h-8 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border transition-all ${
                    paymentMode === "CASH"
                      ? "bg-medical-navy-900 text-white border-medical-navy-900 shadow-xs"
                      : "bg-white text-medical-slate-700 border-medical-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode("UPI")}
                  className={`h-8 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border transition-all ${
                    paymentMode === "UPI"
                      ? "bg-medical-navy-900 text-white border-medical-navy-900 shadow-xs"
                      : "bg-white text-medical-slate-700 border-medical-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  UPI
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode("CARD")}
                  className={`h-8 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border transition-all ${
                    paymentMode === "CARD"
                      ? "bg-medical-navy-900 text-white border-medical-navy-900 shadow-xs"
                      : "bg-white text-medical-slate-700 border-medical-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Card
                </button>
              </div>
            </div>
          </div>

          {/* Totals & Calculations Card */}
          <div className="bg-white rounded-2xl border border-medical-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-medical-navy-950 border-b border-medical-slate-100 pb-2">
              Payment Summary
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-medical-slate-600">
                <span>Sub Total (MRP sum)</span>
                <span className="font-mono font-medium">
                  {formatIndianCurrency(totals.subTotal)}
                </span>
              </div>

              <div className="flex justify-between text-medical-green-700 font-semibold">
                <span>Total Discount</span>
                <span className="font-mono">
                  {totals.discount > 0 ? `- ${formatIndianCurrency(totals.discount)}` : "₹ 0.00"}
                </span>
              </div>

              {/* GST Inclusive Breakdown Box */}
              <div className="p-2.5 rounded-xl bg-medical-slate-50 border border-medical-slate-200/80 space-y-1 text-[11px]">
                <div className="flex justify-between text-medical-slate-600 font-medium">
                  <span>Included GST (18%)</span>
                  <span className="font-mono">{formatIndianCurrency(totals.gstTotal)}</span>
                </div>
                <div className="flex justify-between text-medical-slate-500 text-[10px] pl-2">
                  <span>• CGST (9%):</span>
                  <span className="font-mono">{formatIndianCurrency(totals.cgst)}</span>
                </div>
                <div className="flex justify-between text-medical-slate-500 text-[10px] pl-2">
                  <span>• SGST (9%):</span>
                  <span className="font-mono">{formatIndianCurrency(totals.sgst)}</span>
                </div>
              </div>

              {/* Grand Total */}
              <div className="flex justify-between items-center pt-2 border-t border-medical-slate-200">
                <span className="text-sm font-extrabold text-medical-navy-950">Grand Total</span>
                <span className="text-xl font-black text-medical-navy-950 font-mono">
                  {formatIndianCurrency(totals.grandTotal)}
                </span>
              </div>

              {store?.showAmountInWords && totals.amountInWords && (
                <p className="text-[10px] text-medical-slate-500 italic pt-1 leading-tight">
                  {totals.amountInWords}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-3 space-y-2">
              <Button
                type="button"
                onClick={() => handleSaveBill(true)}
                disabled={isSaving || items.length === 0}
                className="w-full h-11 text-xs font-bold bg-medical-green-600 hover:bg-medical-green-700 text-white shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                Save &amp; Print Bill
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSaveBill(false)}
                  disabled={isSaving || items.length === 0}
                  className="h-10 text-xs font-bold border-medical-slate-300 text-medical-navy-950 hover:bg-medical-slate-50 cursor-pointer disabled:opacity-50"
                >
                  Save Bill Only
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsClearConfirmOpen(true)}
                  disabled={items.length === 0}
                  className="h-10 text-xs font-bold border-red-200 text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-50"
                >
                  Clear Bill
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SUCCESS MODAL: Bill Saved                                */}
      {/* ======================================================== */}
      {savedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-medical-navy-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-medical-slate-200 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-medical-green-100 text-medical-green-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-medical-navy-950">Bill Saved Successfully!</h3>
              <p className="text-xs text-medical-slate-500 font-mono">
                Invoice Number: <strong className="text-medical-navy-950">{savedBill.billNumber}</strong>
              </p>
              <p className="text-sm font-black text-medical-navy-950 pt-1 font-mono">
                {formatIndianCurrency(savedBill.grandTotal)}
              </p>
            </div>

            <div className="bg-medical-slate-50 rounded-xl p-3 text-xs space-y-1 border border-medical-slate-200 text-medical-slate-700">
              <div className="flex justify-between">
                <span>Patient:</span>
                <b>{savedBill.customerName}</b>
              </div>
              <div className="flex justify-between">
                <span>Items:</span>
                <span>{savedBill.items.length} items</span>
              </div>
              <div className="flex justify-between">
                <span>Payment:</span>
                <span>{savedBill.paymentMode}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                type="button"
                onClick={() => printInvoice(savedBill)}
                className="h-10 text-xs font-bold bg-medical-navy-900 text-white hover:bg-medical-navy-800 flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Invoice
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => downloadInvoicePdf(savedBill)}
                className="h-10 text-xs font-bold border-medical-slate-300 text-medical-navy-950 hover:bg-slate-50 flex items-center justify-center gap-1.5"
              >
                <FileDown className="w-3.5 h-3.5" />
                Save PDF
              </Button>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPreviewOpen(true)}
              className="w-full h-10 text-xs font-bold border-medical-slate-300 text-medical-navy-950 hover:bg-slate-50 flex items-center justify-center gap-1.5"
            >
              <Eye className="w-4 h-4" />
              Preview Invoice
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSavedBill(null);
                handleClearBill();
              }}
              className="w-full h-10 text-xs font-bold bg-medical-green-50 text-medical-green-800 border-medical-green-200 hover:bg-medical-green-100 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              New Bill
            </Button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* INVOICE PREVIEW MODAL                                    */}
      {/* ======================================================== */}
      {isPreviewOpen && savedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-medical-navy-950/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-medical-navy-950 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-medical-green-600" />
                Invoice Preview — {savedBill.billNumber}
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => printInvoice(savedBill)}
                  className="h-8 text-xs bg-medical-navy-900 text-white"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" />
                  Print
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadInvoicePdf(savedBill)}
                  className="h-8 text-xs"
                >
                  <FileDown className="w-3.5 h-3.5 mr-1" />
                  Save PDF
                </Button>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="p-1 rounded text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto bg-slate-100 p-4 rounded-xl flex justify-center">
              <div className="scale-90 origin-top shadow-xl">
                <InvoicePdfDocument bill={savedBill} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE SWITCH CONFIRMATION MODAL                           */}
      {/* ======================================================== */}
      {pendingModeSwitch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-medical-navy-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-medical-slate-200 p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-medical-navy-950">Switch Billing Mode?</h3>
                <p className="text-xs text-medical-slate-500">
                  Switching to {pendingModeSwitch === "NON_DISCOUNT" ? "Non-Discount" : "Discounted"} mode will reset custom line rates to default.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPendingModeSwitch(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => executeModeSwitch(pendingModeSwitch)}
                className="bg-amber-600 text-white hover:bg-amber-700"
              >
                Confirm &amp; Reset Rates
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CLEAR BILL CONFIRMATION MODAL                            */}
      {/* ======================================================== */}
      {isClearConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-medical-navy-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-medical-slate-200 p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-100 text-red-700 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-medical-navy-950">Clear Current Bill?</h3>
                <p className="text-xs text-medical-slate-500">
                  All {items.length} items and entered customer details will be cleared.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsClearConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleClearBill}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Yes, Clear
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* RATE BELOW COST PRICE WARNING DIALOG                     */}
      {/* ======================================================== */}
      {rateWarningDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-medical-navy-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-medical-slate-200 p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-medical-navy-950">Selling Below Cost Price</h3>
                <p className="text-xs text-medical-slate-600">
                  Selling rate for <strong className="text-medical-navy-950">{rateWarningDialog.medicineName}</strong> is below internal purchase cost.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                size="sm"
                onClick={() => setRateWarningDialog(null)}
                className="bg-amber-600 text-white hover:bg-amber-700"
              >
                I Understand &amp; Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
