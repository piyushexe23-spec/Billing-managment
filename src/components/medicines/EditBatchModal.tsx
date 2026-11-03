import React, { useState, useEffect } from "react";
import { MedicineBatch, UpdateBatchInput } from "@/types/medicine";
import { medicineService } from "@/services/medicineService";
import {
  X,
  Pencil,
  AlertCircle,
  Save,
  Loader2,
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

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (batch) {
      setBatchNumber(batch.batchNumber);
      setMfgDate(batch.mfgDate || "");
      setExpDate(batch.expDate);
      setCostPrice(batch.costPrice);
      setMrp(batch.mrp);
      setSellingPrice(batch.sellingPrice);
      setError(null);
    }
  }, [batch]);

  if (!isOpen || !batch) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchNumber.trim()) {
      setError("Batch number is required.");
      return;
    }
    if (!expDate.trim()) {
      setError("Expiry date is required.");
      return;
    }
    if (mfgDate.trim() && expDate.trim() < mfgDate.trim()) {
      setError("Expiry date cannot be earlier than manufacturing date.");
      return;
    }
    if (costPrice === "" || Number(costPrice) < 0) {
      setError("Valid cost price is required.");
      return;
    }
    if (mrp === "" || Number(mrp) < 0) {
      setError("Valid MRP is required.");
      return;
    }
    if (sellingPrice === "" || Number(sellingPrice) < 0) {
      setError("Valid selling price is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update batch details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-medical-navy-950/70 backdrop-blur-xs animate-in fade-in-50">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-medical-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-medical-slate-200 bg-medical-slate-50/70">
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Batch Number */}
          <div className="space-y-1.5">
            <label className="font-bold text-medical-slate-800">
              Batch Number <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={batchNumber}
              onChange={(e) => {
                setBatchNumber(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. DL-650-A1"
              className="text-xs h-9 uppercase font-sans font-semibold"
              autoFocus
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800 flex items-center justify-between">
                <span>Mfg Date</span>
                <span className="text-medical-slate-400 font-normal text-[10px]">Optional</span>
              </label>
              <Input
                type="date"
                value={mfgDate}
                onChange={(e) => setMfgDate(e.target.value)}
                className="text-xs h-9 tabular-nums font-sans"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800">
                Expiry Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                className="text-xs h-9 tabular-nums font-sans"
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-medical-slate-800">
                Cost Price (₹) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value === "" ? "" : parseFloat(e.target.value))}
                className="text-xs h-9 tabular-nums font-sans"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-medical-slate-800">
                MRP (₹) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={mrp}
                onChange={(e) => setMrp(e.target.value === "" ? "" : parseFloat(e.target.value))}
                className="text-xs h-9 tabular-nums font-sans font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-medical-slate-800">
                Selling Price (₹) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value === "" ? "" : parseFloat(e.target.value))}
                className="text-xs h-9 tabular-nums font-sans font-bold text-medical-green-700"
              />
            </div>
          </div>

          {/* Current Stock notice */}
          <div className="p-3 rounded-xl bg-medical-slate-50 border border-medical-slate-200 text-medical-slate-600 text-[11px]">
            Current batch stock is <strong>{batch.stockQty}</strong> units. To adjust quantities or write-off stock, please use the <strong>Adjust Stock</strong> action.
          </div>

          {/* Submit */}
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
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  Save Batch
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
