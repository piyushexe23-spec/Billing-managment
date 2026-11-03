import React, { useState, useEffect } from "react";
import { MedicineBatch, UpdateBatchInput } from "@/types/medicine";
import { medicineService, parseFieldError } from "@/services/medicineService";
import {
  validateBatchFields,
  MedicineValidationErrors,
  PriceWarnings,
} from "@/lib/medicineValidations";
import {
  X,
  Pencil,
  AlertCircle,
  AlertTriangle,
  Save,
  Loader2,
  Calendar,
  IndianRupee,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface EditBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: MedicineBatch | null;
  medicineName?: string;
  onSuccess: () => Promise<void>;
}

export const EditBatchModal: React.FC<EditBatchModalProps> = ({
  isOpen,
  onClose,
  batch,
  medicineName,
  onSuccess,
}) => {
  const [batchNumber, setBatchNumber] = useState("");
  const [mfgDate, setMfgDate] = useState("");
  const [expDate, setExpDate] = useState("");
  const [costPrice, setCostPrice] = useState<number | "">("");
  const [mrp, setMrp] = useState<number | "">("");
  const [sellingPrice, setSellingPrice] = useState<number | "">("");

  const [errors, setErrors] = useState<MedicineValidationErrors>({});
  const [priceWarnings, setPriceWarnings] = useState<PriceWarnings>({});
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (batch) {
      setBatchNumber(batch.batchNumber);
      setMfgDate(batch.mfgDate || "");
      setExpDate(batch.expDate);
      setCostPrice(batch.costPrice);
      setMrp(batch.mrp);
      setSellingPrice(batch.sellingPrice);
      setErrors({});
      setPriceWarnings({});
      setShowWarningModal(false);
    }
  }, [batch]);

  if (!isOpen || !batch) return null;

  const focusFirstInvalidField = (errs: MedicineValidationErrors) => {
    const FIELD_ORDER = [
      "batchNumber",
      "mfgDate",
      "expDate",
      "costPrice",
      "mrp",
      "sellingPrice",
    ];
    const firstInvalid = FIELD_ORDER.find((f) => errs[f as keyof MedicineValidationErrors]);
    if (firstInvalid) {
      setTimeout(() => {
        const el = document.getElementById(`edit-batch-${firstInvalid}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();
        }
      }, 50);
    }
  };

  const handleSave = async () => {
    // 1. Run validation
    const validation = validateBatchFields({
      batchNumber,
      mfgDate,
      expDate,
      costPrice,
      mrp,
      sellingPrice,
    });

    // 2. Duplicate batch check on this medicine excluding current batch
    if (batchNumber.trim()) {
      try {
        const dupCheck = await medicineService.checkBatchDuplicate(
          batch.medicineId,
          batchNumber,
          batch.id
        );
        if (dupCheck.exists) {
          validation.errors.batchNumber = "This batch number already exists for this medicine.";
          validation.isValid = false;
        }
      } catch (err) {
        console.warn("Batch duplicate check error:", err);
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

    // If pricing warnings exist and haven't been confirmed
    if (
      !showWarningModal &&
      (validation.warnings.sellingPriceExceedsMrp || validation.warnings.sellingPriceBelowCost)
    ) {
      setShowWarningModal(true);
      return;
    }

    try {
      setIsSubmitting(true);
      const input: UpdateBatchInput = {
        id: batch.id,
        medicineId: batch.medicineId,
        batchNumber: batchNumber.trim().toUpperCase(),
        mfgDate: mfgDate.trim() || null,
        expDate: expDate.trim(),
        costPrice: Number(costPrice),
        mrp: Number(mrp),
        sellingPrice: Number(sellingPrice),
      };

      await medicineService.updateBatch(input);
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
          general: parsed.message || "Failed to update batch details.",
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
                  handleSave();
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

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-medical-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-medical-slate-200 bg-medical-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-medical-navy-900 text-white">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-medical-navy-950">
                Edit Batch Details
              </h3>
              <p className="text-xs text-medical-slate-500 truncate max-w-xs">
                {medicineName || `Medicine #${batch.medicineId}`}
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

        {/* Form Body */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="p-6 space-y-4 overflow-y-auto text-xs"
        >
          {errors.general && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errors.general}</span>
            </div>
          )}

          {/* Current Quantity Display (Read-Only) */}
          <div className="space-y-1.5">
            <label className="font-bold text-medical-slate-700 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-medical-slate-500" />
              <span>Current Batch Stock (Read-Only)</span>
            </label>
            <div className="h-9 px-3.5 rounded-lg border border-medical-slate-200 bg-medical-slate-100/80 text-xs text-medical-slate-700 flex items-center justify-between font-medium">
              <span className="font-bold text-medical-navy-950 tabular-nums">
                {batch.stockQty.toLocaleString("en-IN")} units
              </span>
              <span className="text-[11px] text-medical-slate-500 font-normal">
                Stock changes go through Adjust Stock
              </span>
            </div>
          </div>

          {/* Batch Number */}
          <div className="space-y-1.5">
            <label className="font-bold text-medical-slate-800" htmlFor="edit-batch-batchNumber">
              Batch Number <span className="text-red-500">*</span>
            </label>
            <Input
              id="edit-batch-batchNumber"
              type="text"
              value={batchNumber}
              onChange={(e) => {
                setBatchNumber(e.target.value.toUpperCase());
                if (errors.batchNumber) setErrors((p) => ({ ...p, batchNumber: undefined }));
              }}
              placeholder="e.g. DL-650-A1"
              error={!!errors.batchNumber}
              className="text-xs h-9 uppercase font-sans font-semibold"
              autoFocus
            />
            {errors.batchNumber && (
              <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.batchNumber}</span>
              </p>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800 flex items-center justify-between" htmlFor="edit-batch-mfgDate">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-medical-slate-400" />
                  <span>Mfg Date</span>
                </span>
                <span className="text-medical-slate-400 font-normal text-[10px]">Optional</span>
              </label>
              <Input
                id="edit-batch-mfgDate"
                type="date"
                value={mfgDate}
                onChange={(e) => {
                  setMfgDate(e.target.value);
                  if (errors.mfgDate) setErrors((p) => ({ ...p, mfgDate: undefined }));
                }}
                error={!!errors.mfgDate}
                className="text-xs h-9 tabular-nums font-sans"
              />
              {errors.mfgDate && (
                <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{errors.mfgDate}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800 flex items-center gap-1" htmlFor="edit-batch-expDate">
                <Calendar className="w-3 h-3 text-medical-slate-400" />
                <span>Expiry Date <span className="text-red-500">*</span></span>
              </label>
              <Input
                id="edit-batch-expDate"
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
                className="text-xs h-9 tabular-nums font-sans"
              />
              {errors.expDate && (
                <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{errors.expDate}</span>
                </p>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-medical-slate-800 flex items-center gap-1" htmlFor="edit-batch-costPrice">
                <IndianRupee className="w-3 h-3 text-medical-slate-400" />
                <span>Cost Price <span className="text-red-500">*</span></span>
              </label>
              <Input
                id="edit-batch-costPrice"
                type="number"
                min={0}
                step={0.01}
                value={costPrice}
                onChange={(e) => {
                  const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                  setCostPrice(val);
                  if (errors.costPrice) setErrors((p) => ({ ...p, costPrice: undefined }));
                }}
                error={!!errors.costPrice}
                className="text-xs h-9 tabular-nums font-sans"
              />
              {errors.costPrice && (
                <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{errors.costPrice}</span>
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="font-bold text-medical-slate-800 flex items-center gap-1" htmlFor="edit-batch-mrp">
                <IndianRupee className="w-3 h-3 text-medical-slate-400" />
                <span>MRP <span className="text-red-500">*</span></span>
              </label>
              <Input
                id="edit-batch-mrp"
                type="number"
                min={0}
                step={0.01}
                value={mrp}
                onChange={(e) => {
                  const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                  setMrp(val);
                  if (errors.mrp) setErrors((p) => ({ ...p, mrp: undefined }));
                }}
                error={!!errors.mrp}
                className="text-xs h-9 tabular-nums font-sans font-bold"
              />
              {errors.mrp && (
                <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{errors.mrp}</span>
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="font-bold text-medical-slate-800 flex items-center gap-1" htmlFor="edit-batch-sellingPrice">
                <IndianRupee className="w-3 h-3 text-medical-slate-400" />
                <span>Selling Price <span className="text-red-500">*</span></span>
              </label>
              <Input
                id="edit-batch-sellingPrice"
                type="number"
                min={0}
                step={0.01}
                value={sellingPrice}
                onChange={(e) => {
                  const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                  setSellingPrice(val);
                  if (errors.sellingPrice) setErrors((p) => ({ ...p, sellingPrice: undefined }));
                }}
                error={!!errors.sellingPrice}
                className="text-xs h-9 tabular-nums font-sans font-bold text-medical-green-700"
              />
              {errors.sellingPrice && (
                <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{errors.sellingPrice}</span>
                </p>
              )}
            </div>
          </div>

          {priceWarnings.sellingPriceExceedsMrp && (
            <p className="text-amber-600 text-[11px] font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Selling price is higher than MRP</span>
            </p>
          )}
          {priceWarnings.sellingPriceBelowCost && (
            <p className="text-amber-600 text-[11px] font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Selling price is below cost price</span>
            </p>
          )}

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-medical-slate-200">
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
              className="text-xs font-bold bg-medical-navy-900 hover:bg-medical-navy-800 text-white cursor-pointer px-4"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
