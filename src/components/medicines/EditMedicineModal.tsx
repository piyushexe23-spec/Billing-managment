import React, { useState, useEffect } from "react";
import { UpdateMedicineInput, MedicineUnit } from "@/types/medicine";
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

interface EditMedicineModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicineId: number | null;
  onSuccess: () => Promise<void>;
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

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!medicineId) return;
      try {
        setError(null);
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
    if (!name.trim()) {
      setError("Medicine name is required.");
      return;
    }
    if (lowStockThreshold === "" || Number(lowStockThreshold) < 0) {
      setError("Low stock alert threshold cannot be negative.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const input: UpdateMedicineInput = {
        id: medicineId,
        name: name.trim(),
        genericName: genericName.trim() || null,
        manufacturer: manufacturer.trim() || null,
        category: category.trim() || null,
        description: description.trim() || null,
        barcode: barcode.trim() || null,
        hsnCode: hsnCode.trim() || null,
        unit: unit.trim(),
        lowStockThreshold: Number(lowStockThreshold),
      };

      await medicineService.updateMedicine(input);
      await onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update medicine details.");
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
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-medical-navy-950">
                Edit Medicine Master
              </h3>
              <p className="text-xs text-medical-slate-500 truncate max-w-xs">
                Update pharmaceutical properties and metadata
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

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Row 1: Name & Generic */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800">
                Medicine Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Dolo 650 Tablet"
                className="text-xs h-9 font-semibold"
                autoFocus
              />
            </div>

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
                className="text-xs h-9"
              />
            </div>
          </div>

          {/* Row 2: Manufacturer & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800">
                Manufacturer / Brand
              </label>
              <Input
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="e.g. Micro Labs Ltd"
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800">
                Therapeutic Category
              </label>
              <Input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Analgesic & Antipyretic"
                className="text-xs h-9"
              />
            </div>
          </div>

          {/* Row 3: Unit & Low Stock Threshold */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800">
                Packaging Unit <span className="text-red-500">*</span>
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full h-9 rounded-lg border border-medical-slate-300 px-3 text-xs bg-white text-medical-slate-900 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-navy-100 focus-visible:border-medical-navy-600"
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800">
                Low Stock Alert Threshold <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min={0}
                value={lowStockThreshold}
                onChange={(e) => {
                  const val = e.target.value === "" ? "" : parseInt(e.target.value, 10);
                  setLowStockThreshold(val);
                }}
                placeholder="e.g. 10"
                className="text-xs h-9 tabular-nums font-semibold"
              />
            </div>
          </div>

          {/* Row 4: Barcode & HSN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800 flex items-center justify-between">
                <span>Barcode / GTIN</span>
                <span className="text-medical-slate-400 font-normal text-[10px]">Optional</span>
              </label>
              <Input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="e.g. 8901234567890"
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
