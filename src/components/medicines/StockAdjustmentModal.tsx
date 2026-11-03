import React, { useState, useEffect } from "react";
import { StockAdjustmentInput, MedicineWithBatches } from "@/types/medicine";
import { medicineService } from "@/services/medicineService";
import {
  X,
  Sliders,
  PlusCircle,
  MinusCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: StockAdjustmentInput | null;
  onSuccess: () => Promise<void>;
}

const COMMON_REASONS_ADD = [
  "Physical inventory recount correction (Found surplus)",
  "Unrecorded stock receipt",
  "Vendor replacement stock",
  "Customer medicine return",
];

const COMMON_REASONS_REDUCE = [
  "Physical inventory recount shortage",
  "Damaged / broken container write-off",
  "Expired stock write-off",
  "Returned to supplier / vendor",
  "Internal pharmacy sample usage",
];

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSuccess,
}) => {
  const [medicine, setMedicine] = useState<MedicineWithBatches | null>(null);
  const [batchId, setBatchId] = useState<number>(0);
  const [adjustmentType, setAdjustmentType] = useState<"ADD" | "REDUCE">("ADD");
  const [quantity, setQuantity] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!initialData?.medicineId) return;
      try {
        const med = await medicineService.getMedicineById(initialData.medicineId);
        if (isMounted && med) {
          setMedicine(med);
          setBatchId(initialData.batchId || (med.batches[0]?.id ?? 0));
          setAdjustmentType(initialData.adjustmentType || "ADD");
          setQuantity(initialData.quantity || "");
          setReason(initialData.reason || "");
        }
      } catch (err) {
        console.error("Failed to load medicine for stock adjustment:", err);
      }
    }

    if (isOpen && initialData) {
      loadData();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, initialData]);

  if (!isOpen || !initialData) return null;

  const currentBatch = (medicine?.batches || []).find((b) => b.id === batchId);
  const currentQty = currentBatch?.stockQty || 0;
  const numQty = typeof quantity === "number" ? quantity : 0;
  const calculatedNewQty =
    adjustmentType === "ADD" ? currentQty + numQty : currentQty - numQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchId) {
      setError("Please select a valid medicine batch.");
      return;
    }
    if (!quantity || numQty <= 0) {
      setError("Adjustment quantity must be greater than zero.");
      return;
    }
    if (adjustmentType === "REDUCE" && numQty > currentQty) {
      setError(`Cannot reduce stock by ${numQty}. Only ${currentQty} units available.`);
      return;
    }
    if (!reason.trim()) {
      setError("Please specify a reason or audit note for this adjustment.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await medicineService.adjustStock({
        medicineId: initialData.medicineId,
        batchId,
        adjustmentType,
        quantity: numQty,
        reason: reason.trim(),
      });

      await onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record stock adjustment.");
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
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-medical-navy-950">
                Adjust Inventory Stock
              </h3>
              <p className="text-xs text-medical-slate-500 truncate max-w-xs">
                {medicine?.name || "Loading..."}
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

          {/* Batch Selector */}
          <div className="space-y-1.5">
            <label className="font-bold text-medical-slate-800">
              Select Batch <span className="text-red-500">*</span>
            </label>
            <select
              value={batchId}
              onChange={(e) => setBatchId(parseInt(e.target.value, 10))}
              className="w-full h-9 rounded-lg border border-medical-slate-300 px-3 text-xs bg-white text-medical-slate-900 font-mono font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-navy-100 focus-visible:border-medical-navy-600"
            >
              {(medicine?.batches || []).map((b) => (
                <option key={b.id} value={b.id}>
                  Batch {b.batchNumber} (Exp: {b.expDate} • Available: {b.stockQty} {medicine?.unit}s)
                </option>
              ))}
            </select>
          </div>

          {/* Operation Type Switcher */}
          <div className="space-y-1.5">
            <label className="font-bold text-medical-slate-800">
              Adjustment Operation <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAdjustmentType("ADD")}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  adjustmentType === "ADD"
                    ? "bg-medical-green-50 border-medical-green-500 text-medical-green-800 ring-2 ring-medical-green-200"
                    : "border-medical-slate-200 bg-white text-medical-slate-600 hover:bg-medical-slate-50"
                }`}
              >
                <PlusCircle className="w-4 h-4 text-medical-green-600" />
                Add Stock (+)
              </button>

              <button
                type="button"
                onClick={() => setAdjustmentType("REDUCE")}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  adjustmentType === "REDUCE"
                    ? "bg-red-50 border-red-500 text-red-800 ring-2 ring-red-200"
                    : "border-medical-slate-200 bg-white text-medical-slate-600 hover:bg-medical-slate-50"
                }`}
              >
                <MinusCircle className="w-4 h-4 text-red-600" />
                Reduce Stock (-)
              </button>
            </div>
          </div>

          {/* Adjustment Quantity Input */}
          <div className="space-y-1.5">
            <label className="font-bold text-medical-slate-800">
              Quantity to {adjustmentType === "ADD" ? "Add" : "Reduce"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => {
                const val = e.target.value === "" ? "" : parseInt(e.target.value, 10);
                setQuantity(val);
                if (error) setError(null);
              }}
              placeholder="e.g. 10"
              className="font-mono text-sm font-bold h-10"
              autoFocus
            />
          </div>

          {/* Reason Selection or Input */}
          <div className="space-y-1.5">
            <label className="font-bold text-medical-slate-800">
              Audit Reason / Note <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              <select
                onChange={(e) => setReason(e.target.value)}
                className="w-full h-8 rounded-lg border border-medical-slate-300 px-2.5 text-xs bg-white text-medical-slate-700"
              >
                <option value="">-- Quick select a standard reason --</option>
                {(adjustmentType === "ADD" ? COMMON_REASONS_ADD : COMMON_REASONS_REDUCE).map(
                  (r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  )
                )}
              </select>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Or enter custom reason for audit records..."
                rows={2}
                className="w-full rounded-lg border border-medical-slate-300 p-2.5 text-xs text-medical-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-navy-100 focus-visible:border-medical-navy-600"
              />
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="p-3.5 rounded-xl bg-medical-slate-100/80 border border-medical-slate-200 flex items-center justify-between text-xs font-mono">
            <div>
              <span className="text-[10px] text-medical-slate-500 block uppercase font-sans font-bold">
                Current Stock
              </span>
              <span className="font-bold text-medical-slate-700">
                {currentQty} {medicine?.unit}s
              </span>
            </div>

            <span className="text-base text-medical-slate-400 font-bold">
              {adjustmentType === "ADD" ? "+" : "-"}
            </span>

            <div>
              <span className="text-[10px] text-medical-slate-500 block uppercase font-sans font-bold">
                Adjustment
              </span>
              <span
                className={`font-bold ${
                  adjustmentType === "ADD" ? "text-medical-green-700" : "text-red-600"
                }`}
              >
                {numQty} {medicine?.unit}s
              </span>
            </div>

            <span className="text-base text-medical-slate-400 font-bold">=</span>

            <div>
              <span className="text-[10px] text-medical-slate-500 block uppercase font-sans font-bold">
                New Stock
              </span>
              <span
                className={`text-sm font-extrabold ${
                  calculatedNewQty < 0 ? "text-red-600" : "text-medical-navy-950"
                }`}
              >
                {calculatedNewQty} {medicine?.unit}s
              </span>
            </div>
          </div>

          {/* Submit Actions */}
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
              disabled={isSubmitting || calculatedNewQty < 0}
              className="text-xs font-bold bg-medical-navy-900 hover:bg-medical-navy-800 text-white shadow-xs cursor-pointer disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Applying...
                </>
              ) : (
                "Record Stock Adjustment"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
