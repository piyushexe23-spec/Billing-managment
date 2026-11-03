import React, { useState, useEffect } from "react";
import { UpdateMedicineInput, MedicineUnit } from "@/types/medicine";
import { medicineService, parseFieldError } from "@/services/medicineService";
import {
  X,
  Pencil,
  AlertCircle,
  Save,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface EditMedicineModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicineId: number | null;
  onSuccess: () => Promise<void>;
  onManageBatches?: (medicineId: number) => void;
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

export const EditMedicineModal: React.FC<EditMedicineModalProps> = ({
  isOpen,
  onClose,
  medicineId,
  onSuccess,
  onManageBatches,
}) => {
  const [name, setName] = useState("");
  const [genericName, setGenericName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [barcode, setBarcode] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [unit, setUnit] = useState<string>("Tablet");
  const [lowStockThreshold, setLowStockThreshold] = useState<number | "">(10);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!medicineId) return;
      try {
        setErrors({});
        const med = await medicineService.getMedicineById(medicineId);
        if (isMounted && med) {
          setName(med.name);
          setGenericName(med.genericName || "");
          setManufacturer(med.manufacturer || "");
          setCategory(med.category || "");
          setDescription(med.description || "");
          setBarcode(med.barcode || "");
          setHsnCode(med.hsnCode || "");
          setUnit(med.unit || "Tablet");
          setLowStockThreshold(med.lowStockThreshold);
        }
      } catch (err) {
        console.error("Failed to load medicine for edit:", err);
      }
    }
    if (isOpen && medicineId) {
      loadData();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, medicineId]);

  if (!isOpen || !medicineId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Medicine name cannot be empty";
    }

    if (lowStockThreshold === "" || Number(lowStockThreshold) < 0) {
      newErrors.lowStockThreshold = "Threshold must be a non-negative integer (minimum 0)";
    }

    // Check duplicate medicine name + manufacturer (excluding current medicine)
    if (name.trim()) {
      try {
        const dupCheck = await medicineService.checkMedicineDuplicate(name, manufacturer, medicineId);
        if (dupCheck.exists) {
          newErrors.name = "This medicine already exists. Use Add New Batch on that medicine instead.";
        }
      } catch (err) {
        console.warn("Duplicate check error:", err);
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const el = document.getElementById("edit-med-name");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();
      }
      return;
    }

    try {
      setIsSubmitting(true);
      setErrors({});

      const input: UpdateMedicineInput = {
        id: medicineId,
        name: name.trim(),
        genericName: genericName.trim() || undefined,
        manufacturer: manufacturer.trim() || undefined,
        category: category.trim() || undefined,
        description: description.trim() || undefined,
        barcode: barcode.trim() || undefined,
        hsnCode: hsnCode.trim() || undefined,
        unit: unit.trim(),
        lowStockThreshold: Number(lowStockThreshold) || 10,
      };

      await medicineService.updateMedicine(input);
      await onSuccess();
      onClose();
    } catch (err: any) {
      const parsed = parseFieldError(err);
      if (parsed.field) {
        setErrors({ [parsed.field]: parsed.message });
      } else {
        setErrors({ general: parsed.message || "Failed to update medicine." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-medical-navy-950/70 backdrop-blur-xs animate-in fade-in-50">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-medical-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-medical-slate-200 bg-medical-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-medical-navy-900 text-white">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-medical-navy-950">
                Edit Medicine Master
              </h3>
              <p className="text-xs text-medical-slate-500">
                Update master medicine details, therapeutic classification and thresholds.
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto text-xs">
          {errors.general && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errors.general}</span>
            </div>
          )}

          {/* Medicine Name */}
          <div className="space-y-1.5">
            <label className="font-bold text-medical-slate-800" htmlFor="edit-med-name">
              Medicine Name <span className="text-red-500">*</span>
            </label>
            <Input
              id="edit-med-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((p) => ({ ...p, name: "" }));
              }}
              placeholder="e.g. Dolo 650 Tablet"
              error={!!errors.name}
              className="text-xs h-9 font-semibold"
              autoFocus
            />
            {errors.name && (
              <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.name}</span>
              </p>
            )}
          </div>

          {/* Generic Name & Manufacturer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800 flex items-center justify-between">
                <span>Generic Name / Salt</span>
                <span className="text-medical-slate-400 font-normal text-[10px]">Optional</span>
              </label>
              <Input
                type="text"
                value={genericName}
                onChange={(e) => setGenericName(e.target.value)}
                placeholder="e.g. Paracetamol 650mg"
                className="text-xs h-9 font-sans"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800 flex items-center justify-between">
                <span>Manufacturer</span>
                <span className="text-medical-slate-400 font-normal text-[10px]">Optional</span>
              </label>
              <Input
                type="text"
                value={manufacturer}
                onChange={(e) => {
                  setManufacturer(e.target.value);
                  if (errors.name) setErrors((p) => ({ ...p, name: "" }));
                }}
                placeholder="e.g. Micro Labs Ltd"
                className="text-xs h-9 font-sans"
              />
            </div>
          </div>

          {/* Therapeutic Category & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800">
                Therapeutic Category
              </label>
              <Input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Analgesic & Antipyretic"
                className="text-xs h-9 font-sans"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800">
                Dispensing Unit <span className="text-red-500">*</span>
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full h-9 rounded-lg border border-medical-slate-300 px-3 text-xs bg-white text-medical-slate-800 font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-navy-100 focus-visible:border-medical-navy-600"
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Threshold, Barcode, HSN */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800">
                Low Stock Threshold <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min={0}
                step={1}
                value={lowStockThreshold}
                onChange={(e) => {
                  const val = e.target.value === "" ? "" : parseInt(e.target.value, 10);
                  setLowStockThreshold(val);
                  if (errors.lowStockThreshold) setErrors((p) => ({ ...p, lowStockThreshold: "" }));
                }}
                error={!!errors.lowStockThreshold}
                className="text-xs h-9 tabular-nums font-sans"
              />
              {errors.lowStockThreshold && (
                <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{errors.lowStockThreshold}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800 flex items-center justify-between">
                <span>Barcode</span>
                <span className="text-medical-slate-400 font-normal text-[10px]">Optional</span>
              </label>
              <Input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="e.g. 89012345"
                className="text-xs h-9 font-sans"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800 flex items-center justify-between">
                <span>HSN Code</span>
                <span className="text-medical-slate-400 font-normal text-[10px]">Optional</span>
              </label>
              <Input
                type="text"
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value)}
                placeholder="e.g. 30049099"
                className="text-xs h-9 font-sans"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="font-bold text-medical-slate-800 flex items-center justify-between">
              <span>Description / Clinical Notes</span>
              <span className="text-medical-slate-400 font-normal text-[10px]">Optional</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Dosage details, precautions, or special storage notes..."
              rows={2}
              className="w-full rounded-lg border border-medical-slate-300 p-2.5 text-xs text-medical-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-navy-100 focus-visible:border-medical-navy-600"
            />
          </div>

          {/* Required Note & Link: Batch number, expiry and prices are edited per batch */}
          <div className="p-3.5 rounded-xl bg-medical-slate-50 border border-medical-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="text-medical-slate-600">
              Batch number, expiry and prices are edited per batch.
            </span>
            {onManageBatches && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onManageBatches(medicineId);
                }}
                className="text-medical-navy-900 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer whitespace-nowrap self-start sm:self-auto bg-white px-2.5 py-1 rounded-lg border border-medical-slate-200 hover:border-medical-navy-300 shadow-2xs"
              >
                <span>Manage batches</span>
                <ExternalLink className="w-3 h-3 text-medical-navy-700" />
              </button>
            )}
          </div>

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
                  Saving...
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
