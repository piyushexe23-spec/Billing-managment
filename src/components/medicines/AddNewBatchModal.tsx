import React, { useState, useEffect } from "react";
import { MedicineWithBatches, AddNewBatchInput } from "@/types/medicine";
import { medicineService, parseFieldError } from "@/services/medicineService";
import {
  validateBatchFields,
  MedicineValidationErrors,
  PriceWarnings,
} from "@/lib/medicineValidations";
import {
  X,
  AlertTriangle,
  AlertCircle,
  PackagePlus,
  Loader2,
  Calendar,
  IndianRupee,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AddNewBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicineId: number | null;
  onSuccess: () => Promise<void>;
}

export const AddNewBatchModal: React.FC<AddNewBatchModalProps> = ({
  isOpen,
  onClose,
  medicineId,
  onSuccess,
}) => {
  const [medicine, setMedicine] = useState<MedicineWithBatches | null>(null);

  // Form Fields
  const [batchNumber, setBatchNumber] = useState("");
  const [mfgDate, setMfgDate] = useState("");
  const [expDate, setExpDate] = useState("");
  const [quantityReceived, setQuantityReceived] = useState<number | "">("");
  const [costPrice, setCostPrice] = useState<number | "">("");
  const [mrp, setMrp] = useState<number | "">("");
  const [sellingPrice, setSellingPrice] = useState<number | "">("");
  const [note, setNote] = useState("");

  // Validation & Warning States
  const [errors, setErrors] = useState<MedicineValidationErrors>({});
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [priceWarnings, setPriceWarnings] = useState<PriceWarnings>({});
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch medicine details and pre-fill prices from the latest batch
  useEffect(() => {
    let isMounted = true;
    async function loadMedicine() {
      if (!medicineId) return;
      try {
        setErrors({});
        setDuplicateWarning(null);
        setPriceWarnings({});
        setShowWarningModal(false);
        const med = await medicineService.getMedicineById(medicineId);
        if (isMounted && med) {
          setMedicine(med);
          // Find latest batch by id to prefill pricing
          if (med.batches && med.batches.length > 0) {
            const sorted = [...med.batches].sort((a, b) => b.id - a.id);
            const latest = sorted[0];
            setCostPrice(latest.costPrice);
            setMrp(latest.mrp);
            setSellingPrice(latest.sellingPrice);
          } else {
            setCostPrice("");
            setMrp("");
            setSellingPrice("");
          }
          setBatchNumber("");
          setMfgDate("");
          setExpDate("");
          setQuantityReceived("");
          setNote("");
        }
      } catch (err) {
        console.error("Failed to load medicine for adding batch:", err);
      }
    }

    if (isOpen && medicineId) {
      loadMedicine();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, medicineId]);

  if (!isOpen || !medicineId) return null;

  const focusFirstInvalidField = (errs: MedicineValidationErrors) => {
    const FIELD_ORDER = [
      "batchNumber",
      "mfgDate",
      "expDate",
      "quantityReceived",
      "costPrice",
      "mrp",
      "sellingPrice",
    ];
    const firstInvalid = FIELD_ORDER.find((f) => errs[f as keyof MedicineValidationErrors]);
    if (firstInvalid) {
      setTimeout(() => {
        const el = document.getElementById(`add-batch-${firstInvalid}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();
        }
      }, 50);
    }
  };

  const handleSave = async (addToExisting = false) => {
    // 1. Run validation
    const validation = validateBatchFields({
      batchNumber,
      mfgDate,
      expDate,
      quantityReceived,
      costPrice,
      mrp,
      sellingPrice,
    });

    // 2. Duplicate batch check for this medicine
    if (batchNumber.trim() && medicine && !addToExisting) {
      const normBatch = batchNumber.trim().toLowerCase();
      const duplicateExists = medicine.batches.some(
        (b) => b.isActive && b.batchNumber.trim().toLowerCase() === normBatch
      );
      if (duplicateExists) {
        validation.errors.batchNumber = "This batch number already exists for this medicine.";
        validation.isValid = false;
        setDuplicateWarning(
          `This batch already exists. Add stock to the existing batch instead?`
        );
      }
    }

    if (!validation.isValid) {
      setErrors(validation.errors);
      setPriceWarnings(validation.warnings);
      focusFirstInvalidField(validation.errors);
      return;
    }

    setErrors({});
    setPriceWarnings(validation.warnings);

    // If pricing warnings exist, let user review & confirm
    if (
      !showWarningModal &&
      (validation.warnings.sellingPriceExceedsMrp || validation.warnings.sellingPriceBelowCost)
    ) {
      setShowWarningModal(true);
      return;
    }

    try {
      setIsSubmitting(true);
      const input: AddNewBatchInput = {
        medicineId,
        batchNumber: batchNumber.trim().toUpperCase(),
        mfgDate: mfgDate.trim() || null,
        expDate: expDate.trim(),
        quantityReceived: Number(quantityReceived),
        costPrice: Number(costPrice),
        mrp: Number(mrp),
        sellingPrice: Number(sellingPrice),
        note: note.trim() || undefined,
        addToExisting,
      };

      await medicineService.addNewBatch(input);
      await onSuccess();
      onClose();
    } catch (err: any) {
      const parsed = parseFieldError(err);
      if (parsed.field) {
        const updatedErrors = { ...errors, [parsed.field]: parsed.message };
        setErrors(updatedErrors);
        focusFirstInvalidField(updatedErrors);
      } else {
        setErrors((prev) => ({
          ...prev,
          general: parsed.message || "Failed to add batch.",
        }));
      }
    } finally {
      setIsSubmitting(false);
    }
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
                  Please review the entered batch pricing before saving.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed space-y-1">
              <p className="font-semibold">{priceWarnings.sellingPriceWarning || "Please review the batch prices."}</p>
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
                  handleSave(false);
                }}
                disabled={isSubmitting}
                className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : null}
                Confirm & Save Batch
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-medical-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-medical-slate-200 bg-medical-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-medical-navy-900 text-white">
              <PackagePlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-medical-navy-950">
                Add New Batch
              </h3>
              <p className="text-xs text-medical-slate-500">
                Receive new stock delivery into inventory
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-medical-slate-400 hover:text-medical-navy-900 hover:bg-medical-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Read-Only Medicine Master Summary Card */}
        <div className="px-6 py-3 bg-medical-slate-100/70 border-b border-medical-slate-200 flex items-center justify-between text-xs shrink-0">
          <div>
            <span className="text-[10px] uppercase font-bold text-medical-slate-400 block tracking-wider">
              Medicine (Master)
            </span>
            <span className="font-bold text-medical-navy-950 text-sm">
              {medicine?.name || "Loading..."}
            </span>
            {medicine?.genericName && (
              <span className="text-medical-slate-500 ml-2">
                ({medicine.genericName})
              </span>
            )}
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-medical-slate-400 block tracking-wider">
              Unit
            </span>
            <span className="font-bold text-medical-navy-950 text-sm">
              {medicine?.unit || "Unit"}
            </span>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave(false);
          }}
          className="p-6 space-y-4 overflow-y-auto text-xs"
        >
          {errors.general && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errors.general}</span>
            </div>
          )}

          {/* Duplicate Batch Warning Banner with Option to Add Stock to Existing */}
          {duplicateWarning && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{duplicateWarning}</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSave(true)}
                  disabled={isSubmitting}
                  className="h-8 px-3 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  ) : null}
                  Add Stock to Existing Batch
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDuplicateWarning(null);
                    setBatchNumber("");
                    setErrors((p) => ({ ...p, batchNumber: undefined }));
                  }}
                  className="h-8 px-3 text-xs font-semibold border-amber-300 hover:bg-amber-100/60 text-amber-900 cursor-pointer"
                >
                  Change Batch Number
                </Button>
              </div>
            </div>
          )}

          {/* Row 1: Batch Number & Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800" htmlFor="add-batch-batchNumber">
                Batch Number <span className="text-red-500">*</span>
              </label>
              <Input
                id="add-batch-batchNumber"
                type="text"
                value={batchNumber}
                onChange={(e) => {
                  setBatchNumber(e.target.value.toUpperCase());
                  if (errors.batchNumber) {
                    setErrors((p) => ({ ...p, batchNumber: undefined }));
                    setDuplicateWarning(null);
                  }
                }}
                placeholder="e.g. DL-650-B1"
                error={!!errors.batchNumber}
                className="font-mono uppercase text-xs h-9 font-semibold"
                autoFocus
              />
              {errors.batchNumber && (
                <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{errors.batchNumber}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800" htmlFor="add-batch-quantityReceived">
                Quantity Received ({medicine?.unit || "Units"}) <span className="text-red-500">*</span>
              </label>
              <Input
                id="add-batch-quantityReceived"
                type="number"
                min={1}
                step={1}
                value={quantityReceived}
                onChange={(e) => {
                  const val = e.target.value === "" ? "" : parseInt(e.target.value, 10);
                  setQuantityReceived(val);
                  if (errors.quantityReceived) setErrors((p) => ({ ...p, quantityReceived: undefined }));
                }}
                placeholder="e.g. 50"
                error={!!errors.quantityReceived}
                className="font-mono text-xs h-9 font-bold"
              />
              {errors.quantityReceived && (
                <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{errors.quantityReceived}</span>
                </p>
              )}
            </div>
          </div>

          {/* Row 2: Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800 flex items-center gap-1" htmlFor="add-batch-mfgDate">
                <Calendar className="w-3.5 h-3.5 text-medical-slate-400" />
                Manufacturing Date (Optional)
              </label>
              <Input
                id="add-batch-mfgDate"
                type="date"
                value={mfgDate}
                onChange={(e) => {
                  setMfgDate(e.target.value);
                  if (errors.mfgDate) setErrors((p) => ({ ...p, mfgDate: undefined }));
                }}
                error={!!errors.mfgDate}
                className="text-xs h-9"
              />
              {errors.mfgDate && (
                <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{errors.mfgDate}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800 flex items-center gap-1" htmlFor="add-batch-expDate">
                <Calendar className="w-3.5 h-3.5 text-medical-slate-400" />
                Expiry Date <span className="text-red-500">*</span>
              </label>
              <Input
                id="add-batch-expDate"
                type="date"
                value={expDate}
                onChange={(e) => {
                  setExpDate(e.target.value);
                  if (errors.expDate) setErrors((p) => ({ ...p, expDate: undefined }));
                  if (errors.mfgDate && mfgDate && e.target.value >= mfgDate) {
                    setErrors((p) => ({ ...p, mfgDate: undefined }));
                  }
                }}
                error={!!errors.expDate}
                className="text-xs h-9"
              />
              {errors.expDate && (
                <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{errors.expDate}</span>
                </p>
              )}
            </div>
          </div>

          {/* Pricing Header */}
          <div className="pt-2 border-t border-medical-slate-100 flex items-center gap-2 text-medical-navy-900 font-bold text-xs uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-medical-navy-600" />
            Pricing Configuration (Pre-Filled From Latest Batch)
          </div>

          {/* Row 3: Prices */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800 flex items-center gap-1" htmlFor="add-batch-costPrice">
                <IndianRupee className="w-3.5 h-3.5 text-medical-slate-400" />
                Purchase / Cost (₹) <span className="text-red-500">*</span>
              </label>
              <Input
                id="add-batch-costPrice"
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
                <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{errors.costPrice}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800 flex items-center gap-1" htmlFor="add-batch-mrp">
                <IndianRupee className="w-3.5 h-3.5 text-medical-slate-400" />
                MRP (₹) <span className="text-red-500">*</span>
              </label>
              <Input
                id="add-batch-mrp"
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
                <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{errors.mrp}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800 flex items-center gap-1" htmlFor="add-batch-sellingPrice">
                <IndianRupee className="w-3.5 h-3.5 text-medical-slate-400" />
                Selling Price (₹) <span className="text-red-500">*</span>
              </label>
              <Input
                id="add-batch-sellingPrice"
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
                <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{errors.sellingPrice}</span>
                </p>
              )}
              {priceWarnings.sellingPriceExceedsMrp && (
                <p className="text-amber-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>Selling price is higher than MRP</span>
                </p>
              )}
              {priceWarnings.sellingPriceBelowCost && (
                <p className="text-amber-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>Selling price is below cost price</span>
                </p>
              )}
            </div>
          </div>

          {/* Supplier Note / Reference */}
          <div className="space-y-1.5">
            <label className="font-bold text-medical-slate-800">
              Note / Supplier Invoice Reference (Optional)
            </label>
            <Input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Inv #8942 / Apollo Wholesaler"
              className="text-xs h-9"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-medical-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-xs font-bold bg-medical-navy-900 hover:bg-medical-navy-800 text-white shadow-xs cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <PackagePlus className="w-3.5 h-3.5 mr-1.5" />
              )}
              Save Batch Delivery
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
