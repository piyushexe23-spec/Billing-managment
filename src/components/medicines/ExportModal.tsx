import React, { useState } from "react";
import { MedicineListItem } from "@/types/medicine";
import { medicineService } from "@/services/medicineService";
import {
  X,
  Download,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  allItems: MedicineListItem[];
  filteredItems: MedicineListItem[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  allItems,
  filteredItems,
}) => {
  const [scope, setScope] = useState<
    "ALL" | "FILTERED" | "LOW_STOCK" | "OUT_OF_STOCK" | "EXPIRING_SOON" | "EXPIRED"
  >("ALL");
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const lowStockItems = allItems.filter(
    (m) => m.stockStatus === "LOW_STOCK" || m.stockStatus === "OUT_OF_STOCK"
  );
  const outOfStockItems = allItems.filter((m) => m.stockStatus === "OUT_OF_STOCK");
  const expiringSoonItems = allItems.filter((m) => m.expiryStatus === "EXPIRING_SOON");
  const expiredItems = allItems.filter((m) => m.expiryStatus === "EXPIRED");

  const getTargetItems = (): MedicineListItem[] => {
    switch (scope) {
      case "FILTERED":
        return filteredItems;
      case "LOW_STOCK":
        return lowStockItems;
      case "OUT_OF_STOCK":
        return outOfStockItems;
      case "EXPIRING_SOON":
        return expiringSoonItems;
      case "EXPIRED":
        return expiredItems;
      case "ALL":
      default:
        return allItems;
    }
  };

  const handleExport = () => {
    const items = getTargetItems();
    if (items.length === 0) {
      alert("No records match the selected export scope.");
      return;
    }

    try {
      setIsExporting(true);
      const prefix = `IM_MEDICOS_${scope.toLowerCase()}_inventory`;
      medicineService.exportMedicines(items, format, prefix);
      onClose();
    } catch (err) {
      alert("Export failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-medical-navy-950/70 backdrop-blur-xs animate-in fade-in-50">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-medical-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-medical-slate-200 bg-medical-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-medical-navy-900 text-white">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-medical-navy-950">
                Export Inventory
              </h3>
              <p className="text-xs text-medical-slate-500">
                Download batch-wise medicine records for offline reporting.
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

        {/* Content */}
        <div className="p-6 space-y-5 text-xs">
          {/* Export Scope */}
          <div className="space-y-2">
            <label className="font-bold text-medical-slate-800 block">
              Select Export Scope
            </label>
            <div className="space-y-1.5">
              {[
                { id: "ALL", label: `All Medicines (${allItems.length} records)` },
                {
                  id: "FILTERED",
                  label: `Current Filtered Table View (${filteredItems.length} records)`,
                },
                {
                  id: "LOW_STOCK",
                  label: `Low Stock & Out of Stock (${lowStockItems.length} records)`,
                },
                {
                  id: "OUT_OF_STOCK",
                  label: `Out of Stock Only (${outOfStockItems.length} records)`,
                },
                {
                  id: "EXPIRING_SOON",
                  label: `Batches Expiring Soon (≤10 days) (${expiringSoonItems.length} records)`,
                },
                { id: "EXPIRED", label: `Expired Batches (${expiredItems.length} records)` },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-colors ${
                    scope === opt.id
                      ? "bg-medical-navy-50/80 border-medical-navy-600 text-medical-navy-950 font-bold"
                      : "border-medical-slate-200 hover:bg-medical-slate-50 text-medical-slate-700"
                  }`}
                >
                  <span>{opt.label}</span>
                  <input
                    type="radio"
                    name="exportScope"
                    value={opt.id}
                    checked={scope === opt.id}
                    onChange={() => setScope(opt.id as typeof scope)}
                    className="accent-medical-navy-900"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Export Format */}
          <div className="space-y-2">
            <label className="font-bold text-medical-slate-800 block">
              File Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat("xlsx")}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  format === "xlsx"
                    ? "bg-medical-green-50 border-medical-green-600 text-medical-green-800 ring-2 ring-medical-green-200"
                    : "border-medical-slate-200 bg-white text-medical-slate-600 hover:bg-medical-slate-50"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-medical-green-700" />
                Excel (.xlsx)
              </button>

              <button
                type="button"
                onClick={() => setFormat("csv")}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  format === "csv"
                    ? "bg-medical-navy-50 border-medical-navy-600 text-medical-navy-900 ring-2 ring-medical-navy-200"
                    : "border-medical-slate-200 bg-white text-medical-slate-600 hover:bg-medical-slate-50"
                }`}
              >
                <FileText className="w-4 h-4 text-medical-navy-700" />
                CSV (.csv)
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-medical-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isExporting}
              className="text-xs font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleExport}
              disabled={isExporting || getTargetItems().length === 0}
              className="text-xs font-bold bg-medical-navy-900 hover:bg-medical-navy-800 text-white shadow-xs cursor-pointer disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download {format.toUpperCase()}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
