import React, { useState, useEffect } from "react";
import { CreateMedicineInput, MedicineUnit } from "@/types/medicine";
import { validateMedicineInput, MedicineValidationErrors, PriceWarnings } from "@/lib/medicineValidations";
import { storeService } from "@/services/storeService";
import {
  X,
  Plus,
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  IndianRupee,
  Package,
  Layers,
  Barcode,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AddMedicineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (input: CreateMedicineInput) => Promise<void>;
}

const COMMON_UNITS: MedicineUnit[] = [
  "Tablet",
  "Capsule",
  "Strip",
  "Bottle",
  "Injection",
  "Tube",
  "Piece",
  "Other",
];

const COMMON_CATEGORIES = [
  "Analgesic & Antipyretic",
  "Antibiotics",
  "Antihistamine",
  "Antacid & Anti-ulcer",
  "Antidiabetic",
  "Antihypertensive",
  "Vitamins & Supplements",
  "Topical & Ointments",
  "Cardiovascular",
  "Respiratory",
];

export const AddMedicineModal: React.FC<AddMedicineModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  // Form State
  const [name, setName] = useState("");
  const [genericName, setGenericName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [category, setCategory] = useState("Analgesic & Antipyretic");
  const [description, setDescription] = useState("");
  const [barcode, setBarcode] = useState("");
  const [hsnCode, setHsnCode] = useState("30049099");
  const [unit, setUnit] = useState<string>("Strip");
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(10);

  // Initial Batch
  const [includeInitialBatch, setIncludeInitialBatch] = useState(true);
  const [batchNumber, setBatchNumber] = useState("");
  const [mfgDate, setMfgDate] = useState("");
  const [expDate, setExpDate] = useState("");
  const [costPrice, setCostPrice] = useState<number | "">("");
  const [mrp, setMrp] = useState<number | "">("");
  const [sellingPrice, setSellingPrice] = useState<number | "">("");
  const [stockQty, setStockQty] = useState<number | "">("");

  // Validation & Warnings
  const [errors, setErrors] = useState<MedicineValidationErrors>({});
  const [priceWarnings, setPriceWarnings] = useState<PriceWarnings>({});
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load default low stock alert threshold from Store Details module
  useEffect(() => {
    async function loadStoreDefaults() {
      try {
        const store = await storeService.getStoreDetails();
        if (store?.lowStockThreshold !== undefined) {
          setLowStockThreshold(store.lowStockThreshold);
        }
      } catch (err) {
        console.warn("Could not load store details default low stock threshold:", err);
      }
    }
    if (isOpen) {
      loadStoreDefaults();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const resetForm = () => {
    setName("");
    setGenericName("");
    setManufacturer("");
    setCategory("Analgesic & Antipyretic");
    setDescription("");
    setBarcode("");
    setHsnCode("30049099");
    setUnit("Strip");
    setBatchNumber("");
    setMfgDate("");
    setExpDate("");
    setCostPrice("");
    setMrp("");
    setSellingPrice("");
    setStockQty("");
    setErrors({});
    setPriceWarnings({});
    setShowWarningModal(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const executeSave = async () => {
    try {
      setIsSubmitting(true);
      const payload: CreateMedicineInput = {
        name: name.trim(),
        genericName: genericName.trim() || undefined,
        manufacturer: manufacturer.trim() || undefined,
        category: category.trim() || undefined,
        description: description.trim() || undefined,
        barcode: barcode.trim() || undefined,
        hsnCode: hsnCode.trim() || undefined,
        unit,
        lowStockThreshold,
        initialBatch: includeInitialBatch
          ? {
              batchNumber: batchNumber.trim(),
              mfgDate: mfgDate.trim() || undefined,
              expDate: expDate.trim(),
              costPrice: Number(costPrice) || 0,
              mrp: Number(mrp) || 0,
              sellingPrice: Number(sellingPrice) || 0,
              stockQty: Number(stockQty) || 0,
            }
          : undefined,
      };

      await onSuccess(payload);
      handleClose();
    } catch (err) {
      console.error("Save medicine failed:", err);
      setErrors((prev) => ({
        ...prev,
        name: err instanceof Error ? err.message : "Failed to save medicine record",
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateMedicineInput({
      name,
      unit,
      lowStockThreshold,
      initialBatch: includeInitialBatch
        ? {
            batchNumber,
            mfgDate,
            expDate,
            costPrice: typeof costPrice === "number" ? costPrice : 0,
            mrp: typeof mrp === "number" ? mrp : 0,
            sellingPrice: typeof sellingPrice === "number" ? sellingPrice : 0,
            stockQty: typeof stockQty === "number" ? stockQty : 0,
          }
        : undefined,
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setPriceWarnings(validation.warnings);

    // If there are pricing warnings (Selling Price > MRP or < Cost Price), let user review
    if (validation.warnings.sellingPriceExceedsMrp || validation.warnings.sellingPriceBelowCost) {
      setShowWarningModal(true);
      return;
    }

    executeSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-medical-navy-950/70 backdrop-blur-xs animate-in fade-in-50">
      {/* Price Review Warning Dialog */}
      {showWarningModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-amber-300 p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-700">
              <div className="p-2.5 rounded-xl bg-amber-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-medical-navy-950">
                  Price Anomaly Warning
                </h3>
                <p className="text-xs text-medical-slate-500">
                  Please review the entered pricing before saving.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed space-y-1">
              <p className="font-semibold">{priceWarnings.message}</p>
              <p className="text-[11px] text-amber-700">
                Are you sure you want to proceed with this pricing configuration?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowWarningModal(false)}
                className="text-xs font-semibold cursor-pointer"
              >
                Go Back & Adjust
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setShowWarningModal(false);
                  executeSave();
                }}
                disabled={isSubmitting}
                className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : null}
                Confirm & Save Medicine
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Modal Card */}
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-medical-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-medical-slate-200/80 bg-medical-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-medical-navy-900 text-white">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-medical-navy-950">
                Add New Medicine
              </h2>
              <p className="text-xs text-medical-slate-500">
                Register a new pharmacy medicine and its initial batch inventory.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-medical-slate-400 hover:text-medical-navy-900 hover:bg-medical-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* SECTION 1: BASIC INFORMATION */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2 pb-1.5 border-b border-medical-slate-100 text-medical-navy-900 font-bold text-xs uppercase tracking-wider">
              <Building2 className="w-3.5 h-3.5 text-medical-navy-600" />
              1. Basic Information
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Medicine Name (Required) */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="font-bold text-medical-slate-800">
                  Medicine Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
                  }}
                  placeholder="e.g. Dolo 650 Tablet or Augmentin 625 Duo"
                  error={!!errors.name}
                  className="font-medium text-xs h-9"
                  autoFocus
                />
                {errors.name && (
                  <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Generic Name */}
              <div className="space-y-1.5">
                <label className="font-bold text-medical-slate-800">
                  Generic Name / Composition
                </label>
                <Input
                  value={genericName}
                  onChange={(e) => setGenericName(e.target.value)}
                  placeholder="e.g. Paracetamol 650mg"
                  className="text-xs h-9"
                />
              </div>

              {/* Manufacturer */}
              <div className="space-y-1.5">
                <label className="font-bold text-medical-slate-800">
                  Manufacturer / Company
                </label>
                <Input
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  placeholder="e.g. Micro Labs Ltd or Cipla"
                  className="text-xs h-9"
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="font-bold text-medical-slate-800">Category</label>
                <div className="relative">
                  <input
                    list="categories-list"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Select or type category"
                    className="w-full rounded-lg border border-medical-slate-300 px-3 py-2 text-xs text-medical-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-navy-100 focus-visible:border-medical-navy-600"
                  />
                  <datalist id="categories-list">
                    {COMMON_CATEGORIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Barcode & HSN Code */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="font-bold text-medical-slate-800 flex items-center gap-1">
                    <Barcode className="w-3 h-3 text-medical-slate-400" />
                    Barcode
                  </label>
                  <Input
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="e.g. 89012345"
                    className="font-mono text-xs h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-medical-slate-800">HSN Code</label>
                  <Input
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    placeholder="30049099"
                    className="font-mono text-xs h-9"
                  />
                </div>
              </div>

              {/* Unit & Low Stock Alert Quantity */}
              <div className="space-y-1.5">
                <label className="font-bold text-medical-slate-800">
                  Dispensing Unit <span className="text-red-500">*</span>
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full h-9 rounded-lg border border-medical-slate-300 px-3 text-xs bg-white text-medical-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-navy-100 focus-visible:border-medical-navy-600"
                >
                  {COMMON_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-medical-slate-800 flex items-center justify-between">
                  <span>Low Stock Alert Cutoff</span>
                  <span className="text-[10px] text-medical-slate-400">
                    Default from Store Settings
                  </span>
                </label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(parseInt(e.target.value, 10) || 0)}
                  error={!!errors.lowStockThreshold}
                  className="font-mono text-xs h-9"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: INITIAL BATCH & PRICING */}
          <div className="space-y-3.5 pt-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-medical-slate-100">
              <div className="flex items-center gap-2 text-medical-navy-900 font-bold text-xs uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5 text-medical-navy-600" />
                2. Initial Batch, Pricing & Stock
              </div>
              <label className="flex items-center gap-1.5 text-xs text-medical-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeInitialBatch}
                  onChange={(e) => setIncludeInitialBatch(e.target.checked)}
                  className="rounded text-medical-navy-800 cursor-pointer"
                />
                Include Opening Batch
              </label>
            </div>

            {includeInitialBatch ? (
              <div className="p-4 rounded-xl bg-medical-slate-50 border border-medical-slate-200/80 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {/* Batch Number */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-medical-slate-800">
                      Batch Number <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={batchNumber}
                      onChange={(e) => {
                        setBatchNumber(e.target.value.toUpperCase());
                        if (errors.batchNumber) setErrors((p) => ({ ...p, batchNumber: undefined }));
                      }}
                      placeholder="e.g. DL-650-A1"
                      error={!!errors.batchNumber}
                      className="font-mono text-xs uppercase h-9"
                    />
                    {errors.batchNumber && (
                      <p className="text-red-600 text-[11px] font-semibold">
                        {errors.batchNumber}
                      </p>
                    )}
                  </div>

                  {/* Manufacturing Date */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-medical-slate-800 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-medical-slate-400" />
                      Mfg Date (Optional)
                    </label>
                    <Input
                      type="date"
                      value={mfgDate}
                      onChange={(e) => setMfgDate(e.target.value)}
                      error={!!errors.mfgDate}
                      className="text-xs h-9"
                    />
                    {errors.mfgDate && (
                      <p className="text-red-600 text-[11px] font-semibold">
                        {errors.mfgDate}
                      </p>
                    )}
                  </div>

                  {/* Expiry Date */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-medical-slate-800 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-medical-slate-400" />
                      Expiry Date <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={expDate}
                      onChange={(e) => {
                        setExpDate(e.target.value);
                        if (errors.expDate) setErrors((p) => ({ ...p, expDate: undefined }));
                      }}
                      error={!!errors.expDate}
                      className="text-xs h-9"
                    />
                    {errors.expDate && (
                      <p className="text-red-600 text-[11px] font-semibold">
                        {errors.expDate}
                      </p>
                    )}
                  </div>
                </div>

                {/* Pricing Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 pt-2 border-t border-medical-slate-200">
                  {/* Cost Price */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-medical-slate-800 flex items-center gap-1">
                      <IndianRupee className="w-3 h-3 text-medical-slate-400" />
                      Cost Price <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={costPrice}
                      onChange={(e) => {
                        const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                        setCostPrice(val);
                        if (errors.costPrice) setErrors((p) => ({ ...p, costPrice: undefined }));
                      }}
                      placeholder="0.00"
                      error={!!errors.costPrice}
                      className="font-mono text-xs h-9"
                    />
                    {errors.costPrice && (
                      <p className="text-red-600 text-[11px] font-semibold">{errors.costPrice}</p>
                    )}
                  </div>

                  {/* MRP */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-medical-slate-800 flex items-center gap-1">
                      <IndianRupee className="w-3 h-3 text-medical-slate-400" />
                      MRP <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={mrp}
                      onChange={(e) => {
                        const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                        setMrp(val);
                        if (errors.mrp) setErrors((p) => ({ ...p, mrp: undefined }));
                      }}
                      placeholder="0.00"
                      error={!!errors.mrp}
                      className="font-mono text-xs h-9 font-bold"
                    />
                    {errors.mrp && (
                      <p className="text-red-600 text-[11px] font-semibold">{errors.mrp}</p>
                    )}
                  </div>

                  {/* Selling Price */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-medical-slate-800 flex items-center gap-1">
                      <IndianRupee className="w-3 h-3 text-medical-slate-400" />
                      Selling Price <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={sellingPrice}
                      onChange={(e) => {
                        const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                        setSellingPrice(val);
                        if (errors.sellingPrice) setErrors((p) => ({ ...p, sellingPrice: undefined }));
                      }}
                      placeholder="0.00"
                      error={!!errors.sellingPrice}
                      className="font-mono text-xs h-9 font-bold text-medical-green-800"
                    />
                    {errors.sellingPrice && (
                      <p className="text-red-600 text-[11px] font-semibold">{errors.sellingPrice}</p>
                    )}
                  </div>

                  {/* Initial Stock Quantity */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-medical-slate-800 flex items-center gap-1">
                      <Package className="w-3 h-3 text-medical-slate-400" />
                      Opening Units <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={stockQty}
                      onChange={(e) => {
                        const val = e.target.value === "" ? "" : parseInt(e.target.value, 10);
                        setStockQty(val);
                        if (errors.stockQty) setErrors((p) => ({ ...p, stockQty: undefined }));
                      }}
                      placeholder="0"
                      error={!!errors.stockQty}
                      className="font-mono text-xs h-9 font-bold"
                    />
                    {errors.stockQty && (
                      <p className="text-red-600 text-[11px] font-semibold">{errors.stockQty}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-medical-slate-500 italic p-3 rounded-xl bg-medical-slate-50 border border-medical-slate-200">
                You can add batch inventory later from the medicine detail view.
              </p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-medical-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-xs font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-xs font-bold bg-medical-navy-900 hover:bg-medical-navy-800 text-white shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : (
                "Save Medicine"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

