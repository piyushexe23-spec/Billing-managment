import React, { useState, useEffect } from "react";
import { MedicineWithBatches, AddNewBatchInput } from "@/types/medicine";
import { medicineService, getLocalTodayStr } from "@/services/medicineService";
import {
  X,
  AlertTriangle,
  AlertCircle,
  PackagePlus,
  Loader2,
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
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [activeWarnings, setActiveWarnings] = useState<string[]>([]);
  const [warningConfirmed, setWarningConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch medicine details and pre-fill prices from the latest batch
  useEffect(() => {
    let isMounted = true;
    async function loadMedicine() {
      if (!medicineId) return;
      try {
        setError(null);
        setDuplicateWarning(null);
        setActiveWarnings([]);
        setWarningConfirmed(false);
        const med = await medicineService.getMedicineById(medicineId);
        if (isMounted && med) {
          setMedicine(med);
          // Find latest batch by id/created_at to prefill pricing
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
        if (isMounted) setError("Failed to load medicine details.");
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

  // Real-time duplicate check when user changes batchNumber
  const handleBatchNumberChange = (val: string) => {
    setBatchNumber(val);
    setDuplicateWarning(null);
    setError(null);
    if (medicine && val.trim()) {
      const exists = medicine.batches.some(
        (b) => b.batchNumber.toLowerCase() === val.trim().toLowerCase()
      );
      if (exists) {
        setDuplicateWarning(
          `Batch "${val.trim().toUpperCase()}" already exists for this medicine.`
        );
      }
    }
  };

  const validateAndCollectWarnings = (): { valid: boolean; warnings: string[] } => {
    if (!batchNumber.trim()) {
      setError("Batch number is required.");
      return { valid: false, warnings: [] };
    }
    if (!expDate.trim()) {
      setError("Expiry date is required.");
      return { valid: false, warnings: [] };
    }
    if (mfgDate.trim() && expDate.trim() < mfgDate.trim()) {
      setError("Expiry date cannot be earlier than manufacturing date.");
      return { valid: false, warnings: [] };
    }
    if (quantityReceived === "" || Number(quantityReceived) <= 0) {
      setError("Quantity received must be a positive integer greater than zero.");
      return { valid: false, warnings: [] };
    }
    if (costPrice === "" || Number(costPrice) < 0) {
      setError("Valid purchase / cost price is required.");
      return { valid: false, warnings: [] };
    }
    if (mrp === "" || Number(mrp) < 0) {
      setError("Valid MRP is required.");
      return { valid: false, warnings: [] };
    }
    if (sellingPrice === "" || Number(sellingPrice) < 0) {
      setError("Valid selling price is required.");
      return { valid: false, warnings: [] };
    }

    // Collect reviewable financial & expiry warnings
    const warnings: string[] = [];
    const today = getLocalTodayStr();
    if (expDate.trim() < today) {
      warnings.push("The entered expiry date is already in the past (expired stock).");
    }
    if (Number(sellingPrice) > Number(mrp)) {
      warnings.push(
        `Selling price (₹${sellingPrice}) is greater than Maximum Retail Price (MRP ₹${mrp}). Drug Price Control regulations typically require selling price <= MRP.`
      );
    }
    if (Number(sellingPrice) < Number(costPrice)) {
      warnings.push(
        `Selling price (₹${sellingPrice}) is lower than purchase cost price (₹${costPrice}) resulting in negative unit profit margin.`
      );
    }

    return { valid: true, warnings };
  };

  const handleSave = async (addToExisting = false) => {
    setError(null);
    const { valid, warnings } = validateAndCollectWarnings();
    if (!valid) return;

    // Check duplicate batch if not explicitly adding to existing
    if (!addToExisting && medicine) {
      const exists = medicine.batches.some(
        (b) => b.batchNumber.toLowerCase() === batchNumber.trim().toLowerCase()
      );
      if (exists) {
        setDuplicateWarning(
          `Batch "${batchNumber.trim().toUpperCase()}" already exists for this medicine.`
        );
        return;
      }
    }

    // If warnings exist and user has not confirmed them yet, pause and prompt
    if (warnings.length > 0 && !warningConfirmed) {
      setActiveWarnings(warnings);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

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
      if (err?.message?.includes("BATCH_ALREADY_EXISTS")) {
        setDuplicateWarning(
          `Batch "${batchNumber.trim().toUpperCase()}" already exists for this medicine.`
        );
      } else {
        setError(err instanceof Error ? err.message : "Failed to record new batch.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-medical-navy-950/70 backdrop-blur-xs animate-in fade-in-50">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-medical-slate-200 flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-medical-slate-200 bg-medical-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-medical-navy-900 text-white">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-medical-navy-950">
                Add New Batch
              </h3>
              <p className="text-xs text-medical-slate-500 truncate max-w-sm">
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
        <div className="px-6 py-3 bg-medical-slate-100/70 border-b border-medical-slate-200 flex items-center justify-between text-xs">
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
            <span className="inline-block px-2 py-0.5 rounded-full bg-white border border-medical-slate-200 font-bold text-medical-navy-900 text-[11px]">
              {medicine?.unit || "Tablet"}
            </span>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Duplicate Batch Warning Flow */}
          {duplicateWarning && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">{duplicateWarning}</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    This batch number already exists for this medicine. Do you want to add this quantity to the existing batch instead?
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 pl-6">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSave(true)}
                  disabled={isSubmitting}
                  className="h-7 text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white cursor-pointer"
                >
                  Add Stock to Existing Batch
                </Button>
                <button
                  type="button"
                  onClick={() => setDuplicateWarning(null)}
                  className="text-xs text-amber-900 hover:underline font-semibold cursor-pointer"
                >
                  Change Batch Number
                </button>
              </div>
            </div>
          )}

          {/* Reviewable Warnings Alert (DPCO MRP, Below Cost, Past Expiry) */}
          {activeWarnings.length > 0 && !warningConfirmed && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-950">
                    Please Review Financial &amp; Expiry Warnings:
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-900">
                    {activeWarnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 pl-6">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setWarningConfirmed(true);
                    setActiveWarnings([]);
                  }}
                  className="h-7 text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white cursor-pointer"
                >
                  Confirm &amp; Proceed
                </Button>
                <button
                  type="button"
                  onClick={() => setActiveWarnings([])}
                  className="text-xs text-amber-900 hover:underline font-semibold cursor-pointer"
                >
                  Review Form Values
                </button>
              </div>
            </div>
          )}

          {/* Batch Number & Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800">
                Batch Number <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={batchNumber}
                onChange={(e) => handleBatchNumberChange(e.target.value)}
                placeholder="e.g. DL-010"
                className="font-sans uppercase text-xs h-9"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800">
                Quantity Received <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={quantityReceived}
                  onChange={(e) => {
                    const val = e.target.value === "" ? "" : parseInt(e.target.value, 10);
                    setQuantityReceived(val);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. 100"
                  className="font-sans tabular-nums text-xs h-9 pr-14"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-medical-slate-400 font-medium text-[11px] pointer-events-none">
                  {medicine?.unit || "Unit"}s
                </span>
              </div>
            </div>
          </div>

          {/* Dates: Manufacturing & Expiry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800 flex items-center justify-between">
                <span>Mfg Date</span>
                <span className="text-medical-slate-400 font-normal text-[10px]">Optional</span>
              </label>
              <Input
                type="date"
                value={mfgDate}
                onChange={(e) => setMfgDate(e.target.value)}
                className="font-sans tabular-nums text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800">
                Expiry Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={expDate}
                onChange={(e) => {
                  setExpDate(e.target.value);
                  if (error) setError(null);
                }}
                className="font-sans tabular-nums text-xs h-9"
              />
            </div>
          </div>

          {/* Pricing Row: Purchase Cost, MRP, Selling Price (Pre-filled from latest batch) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-medical-slate-800">
                Batch Pricing &amp; Margin
              </label>
              <span className="text-[10px] text-medical-slate-500">
                Pre-filled from latest batch (editable)
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {/* Cost Price */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-medical-slate-500 block">
                  Purchase Cost (₹) <span className="text-red-500">*</span>
                </span>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={costPrice}
                  onChange={(e) => {
                    const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                    setCostPrice(val);
                    if (error) setError(null);
                  }}
                  placeholder="0.00"
                  className="font-sans tabular-nums text-xs h-9"
                />
              </div>

              {/* MRP */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-medical-slate-500 block">
                  MRP (₹) <span className="text-red-500">*</span>
                </span>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={mrp}
                  onChange={(e) => {
                    const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                    setMrp(val);
                    if (error) setError(null);
                  }}
                  placeholder="0.00"
                  className="font-sans tabular-nums text-xs h-9 font-semibold"
                />
              </div>

              {/* Selling Price */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-medical-slate-500 block">
                  Selling Price (₹) <span className="text-red-500">*</span>
                </span>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={sellingPrice}
                  onChange={(e) => {
                    const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                    setSellingPrice(val);
                    if (error) setError(null);
                  }}
                  placeholder="0.00"
                  className="font-sans tabular-nums text-xs h-9 font-bold text-medical-green-700"
                />
              </div>
            </div>
          </div>

          {/* Supplier Invoice Reference / Note */}
          <div className="space-y-1.5">
            <label className="font-bold text-medical-slate-800 flex items-center justify-between">
              <span>Supplier Invoice / Audit Note</span>
              <span className="text-medical-slate-400 font-normal text-[10px]">Optional</span>
            </label>
            <Input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Inv #GSK-88912 or Apollo Wholesalers"
              className="font-sans text-xs h-9"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-medical-slate-200 bg-medical-slate-50/70 text-xs">
          <span className="text-[11px] text-medical-slate-500">
            Recorded transactionally into stock audit trail
          </span>
          <div className="flex items-center gap-2.5">
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
              type="button"
              size="sm"
              onClick={() => handleSave(false)}
              disabled={isSubmitting}
              className="text-xs font-bold bg-medical-navy-900 hover:bg-medical-navy-800 text-white cursor-pointer px-4"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Saving Batch...
                </>
              ) : (
                <>
                  <PackagePlus className="w-3.5 h-3.5 mr-1.5" />
                  Add Batch
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
