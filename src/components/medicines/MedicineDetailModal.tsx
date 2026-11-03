import React, { useState, useEffect } from "react";
import {
  MedicineWithBatches,
  StockMovement,
  AddBatchInput,
  StockAdjustmentInput,
} from "@/types/medicine";
import {
  medicineService,
  calculateExpiryStatus,
  calculateStockStatus,
} from "@/services/medicineService";
import { formatCurrencyINR } from "@/lib/formatters";
import {
  X,
  Plus,
  Sliders,
  Archive,
  Layers,
  History,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MedicineDetailModalProps {
  medicineId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenStockAdjustment: (input: StockAdjustmentInput) => void;
  onRefresh: () => Promise<void>;
}

export const MedicineDetailModal: React.FC<MedicineDetailModalProps> = ({
  medicineId,
  isOpen,
  onClose,
  onOpenStockAdjustment,
  onRefresh,
}) => {
  const [medicine, setMedicine] = useState<MedicineWithBatches | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [activeTab, setActiveTab] = useState<"batches" | "movements">("batches");
  const [isLoading, setIsLoading] = useState(true);

  // Add Batch Form State
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [newBatchNo, setNewBatchNo] = useState("");
  const [newMfgDate, setNewMfgDate] = useState("");
  const [newExpDate, setNewExpDate] = useState("");
  const [newCostPrice, setNewCostPrice] = useState<number | "">("");
  const [newMrp, setNewMrp] = useState<number | "">("");
  const [newSellingPrice, setNewSellingPrice] = useState<number | "">("");
  const [newStockQty, setNewStockQty] = useState<number | "">("");
  const [batchError, setBatchError] = useState<string | null>(null);
  const [isAddingBatch, setIsAddingBatch] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!medicineId) return;
      try {
        setIsLoading(true);
        const [med, movs] = await Promise.all([
          medicineService.getMedicineById(medicineId),
          medicineService.getStockMovements(medicineId),
        ]);
        if (isMounted) {
          setMedicine(med);
          setMovements(movs);
        }
      } catch (err) {
        console.error("Failed to load medicine details:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (isOpen && medicineId) {
      loadData();
    }
    return () => {
      isMounted = false;
    };
  }, [medicineId, isOpen]);

  if (!isOpen || !medicineId) return null;

  const totalStock = (medicine?.batches || [])
    .filter((b) => b.isActive)
    .reduce((acc, b) => acc + (b.stockQty || 0), 0);

  const stockStatus = medicine
    ? calculateStockStatus(totalStock, medicine.lowStockThreshold)
    : "OUT_OF_STOCK";

  const handleAddBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchNo.trim()) {
      setBatchError("Batch number is required.");
      return;
    }
    if (!newExpDate.trim()) {
      setBatchError("Expiry date is required.");
      return;
    }
    if (newCostPrice === "" || Number(newCostPrice) < 0) {
      setBatchError("Valid cost price is required.");
      return;
    }
    if (newMrp === "" || Number(newMrp) < 0) {
      setBatchError("Valid MRP is required.");
      return;
    }
    if (newSellingPrice === "" || Number(newSellingPrice) < 0) {
      setBatchError("Valid selling price is required.");
      return;
    }
    if (newStockQty === "" || Number(newStockQty) < 0) {
      setBatchError("Initial stock quantity is required.");
      return;
    }

    try {
      setIsAddingBatch(true);
      setBatchError(null);

      const input: AddBatchInput = {
        medicineId,
        batchNumber: newBatchNo.trim().toUpperCase(),
        mfgDate: newMfgDate.trim() || undefined,
        expDate: newExpDate.trim(),
        costPrice: Number(newCostPrice),
        mrp: Number(newMrp),
        sellingPrice: Number(newSellingPrice),
        stockQty: Number(newStockQty),
      };

      await medicineService.addBatch(input);
      // Reload medicine & movements
      const [updatedMed, updatedMovs] = await Promise.all([
        medicineService.getMedicineById(medicineId),
        medicineService.getStockMovements(medicineId),
      ]);
      setMedicine(updatedMed);
      setMovements(updatedMovs);
      setShowAddBatch(false);
      setNewBatchNo("");
      setNewMfgDate("");
      setNewExpDate("");
      setNewCostPrice("");
      setNewMrp("");
      setNewSellingPrice("");
      setNewStockQty("");
      await onRefresh();
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : "Failed to add batch.");
    } finally {
      setIsAddingBatch(false);
    }
  };

  const handleArchive = async () => {
    if (!medicine) return;
    const confirm = window.confirm(
      `Are you sure you want to archive "${medicine.name}"? Archived medicines will not appear in future billing.`
    );
    if (!confirm) return;

    try {
      await medicineService.archiveMedicine(medicine.id);
      await onRefresh();
      onClose();
    } catch (err) {
      alert("Failed to archive medicine: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-medical-navy-950/70 backdrop-blur-xs animate-in fade-in-50">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-medical-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-medical-slate-200/80 bg-medical-slate-50/70 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-medical-navy-950">
                {medicine?.name || "Loading Medicine..."}
              </h2>
              {stockStatus === "OUT_OF_STOCK" && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
                  Out of Stock
                </span>
              )}
              {stockStatus === "LOW_STOCK" && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Low Stock
                </span>
              )}
              {stockStatus === "IN_STOCK" && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-medical-green-100 text-medical-green-800 border border-medical-green-200">
                  In Stock
                </span>
              )}
            </div>
            <p className="text-xs text-medical-slate-500">
              {medicine?.genericName ? `${medicine.genericName} • ` : ""}
              {medicine?.manufacturer || "Generic"} • Category: {medicine?.category || "General"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleArchive}
              className="text-xs text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 h-8 px-2.5 cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5 mr-1" />
              Archive
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-medical-slate-400 hover:text-medical-navy-900 hover:bg-medical-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-medical-slate-100/60 border-b border-medical-slate-200 text-xs shrink-0">
          <div className="p-2.5 rounded-xl bg-white border border-medical-slate-200/80">
            <span className="text-[10px] text-medical-slate-500 block uppercase font-bold tracking-wider">
              Total Stock
            </span>
            <span className="text-base font-extrabold text-medical-navy-950 font-mono">
              {totalStock} {medicine?.unit}s
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-medical-slate-200/80">
            <span className="text-[10px] text-medical-slate-500 block uppercase font-bold tracking-wider">
              Low Stock Cutoff
            </span>
            <span className="text-base font-extrabold text-medical-slate-700 font-mono">
              {medicine?.lowStockThreshold} {medicine?.unit}s
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-medical-slate-200/80">
            <span className="text-[10px] text-medical-slate-500 block uppercase font-bold tracking-wider">
              Active Batches
            </span>
            <span className="text-base font-extrabold text-medical-navy-900 font-mono">
              {(medicine?.batches || []).filter((b) => b.isActive).length} Batches
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-medical-slate-200/80">
            <span className="text-[10px] text-medical-slate-500 block uppercase font-bold tracking-wider">
              Barcode / HSN
            </span>
            <span className="text-xs font-bold text-medical-slate-700 font-mono truncate block mt-0.5">
              {medicine?.barcode || "No Barcode"} • {medicine?.hsnCode || "-"}
            </span>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center px-6 border-b border-medical-slate-200 bg-white text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("batches")}
            className={`flex items-center gap-1.5 py-3 px-4 border-b-2 transition-colors cursor-pointer ${
              activeTab === "batches"
                ? "border-medical-navy-900 text-medical-navy-950 font-bold"
                : "border-transparent text-medical-slate-500 hover:text-medical-navy-800"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Batch Inventory ({(medicine?.batches || []).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("movements")}
            className={`flex items-center gap-1.5 py-3 px-4 border-b-2 transition-colors cursor-pointer ${
              activeTab === "movements"
                ? "border-medical-navy-900 text-medical-navy-950 font-bold"
                : "border-transparent text-medical-slate-500 hover:text-medical-navy-800"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Stock Movements History ({movements.length})
          </button>
        </div>

        {/* Scrollable Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-medical-navy-600" />
              <p className="text-xs text-medical-slate-500 font-semibold">
                Loading medicine details...
              </p>
            </div>
          ) : activeTab === "batches" ? (
            <div className="space-y-4">
              {/* Batch Action Toolbar */}
              <div className="flex items-center justify-between">
                <span className="font-bold text-medical-navy-950 text-xs">
                  Active Batches (FEFO Sorting)
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowAddBatch(!showAddBatch)}
                  className="text-xs h-8 px-3 bg-medical-navy-900 hover:bg-medical-navy-800 text-white cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {showAddBatch ? "Cancel Add Batch" : "Add New Batch"}
                </Button>
              </div>

              {/* Inline Add Batch Form */}
              {showAddBatch && (
                <form
                  onSubmit={handleAddBatchSubmit}
                  className="p-4 rounded-xl bg-medical-slate-50 border border-medical-slate-200/80 space-y-3 animate-in fade-in-50"
                >
                  <h4 className="font-bold text-medical-navy-900 text-xs flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-medical-green-600" />
                    Register New Batch
                  </h4>

                  {batchError && (
                    <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {batchError}
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-medical-slate-800">
                        Batch Number <span className="text-red-500">*</span>
                      </label>
                      <Input
                        value={newBatchNo}
                        onChange={(e) => setNewBatchNo(e.target.value.toUpperCase())}
                        placeholder="e.g. DL-650-B2"
                        className="font-mono text-xs uppercase h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-medical-slate-800">Mfg Date</label>
                      <Input
                        type="date"
                        value={newMfgDate}
                        onChange={(e) => setNewMfgDate(e.target.value)}
                        className="text-xs h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-medical-slate-800">
                        Expiry Date <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="date"
                        value={newExpDate}
                        onChange={(e) => setNewExpDate(e.target.value)}
                        className="text-xs h-8"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                    <div className="space-y-1">
                      <label className="font-bold text-medical-slate-800">Cost Price (₹)</label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={newCostPrice}
                        onChange={(e) =>
                          setNewCostPrice(e.target.value === "" ? "" : parseFloat(e.target.value))
                        }
                        placeholder="0.00"
                        className="font-mono text-xs h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-medical-slate-800">MRP (₹)</label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={newMrp}
                        onChange={(e) =>
                          setNewMrp(e.target.value === "" ? "" : parseFloat(e.target.value))
                        }
                        placeholder="0.00"
                        className="font-mono text-xs h-8 font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-medical-slate-800">Selling Price (₹)</label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={newSellingPrice}
                        onChange={(e) =>
                          setNewSellingPrice(
                            e.target.value === "" ? "" : parseFloat(e.target.value)
                          )
                        }
                        placeholder="0.00"
                        className="font-mono text-xs h-8 font-bold text-medical-green-800"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-medical-slate-800">Opening Stock</label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={newStockQty}
                        onChange={(e) =>
                          setNewStockQty(e.target.value === "" ? "" : parseInt(e.target.value, 10))
                        }
                        placeholder="0"
                        className="font-mono text-xs h-8 font-bold"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isAddingBatch}
                      className="text-xs h-8 bg-medical-navy-900 hover:bg-medical-navy-800 text-white cursor-pointer"
                    >
                      {isAddingBatch ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                      ) : null}
                      Save Batch
                    </Button>
                  </div>
                </form>
              )}

              {/* Batches Table */}
              <div className="rounded-xl border border-medical-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-medical-slate-50 border-b border-medical-slate-200 text-medical-slate-700 font-bold text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Batch Number</th>
                      <th className="py-2.5 px-3">Expiry Date</th>
                      <th className="py-2.5 px-3">Cost Price</th>
                      <th className="py-2.5 px-3">MRP</th>
                      <th className="py-2.5 px-3">Selling Price</th>
                      <th className="py-2.5 px-3">Stock Units</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-medical-slate-100">
                    {(medicine?.batches || []).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-6 text-medical-slate-400">
                          No active batches found for this medicine.
                        </td>
                      </tr>
                    ) : (
                      (medicine?.batches || []).map((b) => {
                        const expStatus = calculateExpiryStatus(b.expDate);
                        return (
                          <tr key={b.id} className="hover:bg-medical-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-medical-navy-950">
                              {b.batchNumber}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5 font-mono">
                                <span>{b.expDate}</span>
                                {expStatus === "EXPIRED" && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-100 text-red-800">
                                    EXPIRED
                                  </span>
                                )}
                                {expStatus === "EXPIRING_SOON" && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                    Expiring &le;10d
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-medical-slate-600">
                              {formatCurrencyINR(b.costPrice)}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-medical-slate-900">
                              {formatCurrencyINR(b.mrp)}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-medical-green-700">
                              {formatCurrencyINR(b.sellingPrice)}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-medical-navy-950">
                              {b.stockQty} {medicine?.unit}s
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  onOpenStockAdjustment({
                                    medicineId: medicine!.id,
                                    batchId: b.id,
                                    adjustmentType: "ADD",
                                    quantity: 1,
                                    reason: "Manual stock adjustment",
                                  })
                                }
                                className="text-xs h-7 px-2.5 border-medical-slate-300 hover:bg-medical-slate-100 cursor-pointer"
                              >
                                <Sliders className="w-3 h-3 mr-1" />
                                Adjust
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Tab 2: Stock Movements History */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-medical-navy-950 text-xs">
                  Stock Movement Audit Ledger
                </span>
                <span className="text-[11px] text-medical-slate-500 font-mono">
                  {movements.length} total recorded transactions
                </span>
              </div>

              <div className="rounded-xl border border-medical-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-medical-slate-50 border-b border-medical-slate-200 text-medical-slate-700 font-bold text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Date & Time</th>
                      <th className="py-2.5 px-3">Batch</th>
                      <th className="py-2.5 px-3">Movement Type</th>
                      <th className="py-2.5 px-3">Change Qty</th>
                      <th className="py-2.5 px-3">Previous</th>
                      <th className="py-2.5 px-3">Updated</th>
                      <th className="py-2.5 px-3">Reason / Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-medical-slate-100">
                    {movements.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-6 text-medical-slate-400">
                          No stock movement history recorded for this medicine yet.
                        </td>
                      </tr>
                    ) : (
                      movements.map((m) => {
                        const isPositive =
                          m.movementType === "OPENING_STOCK" ||
                          m.movementType === "PURCHASE" ||
                          m.movementType === "ADJUSTMENT_ADD" ||
                          m.movementType === "RETURN";

                        return (
                          <tr key={m.id} className="hover:bg-medical-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-medical-slate-600 text-[11px]">
                              {new Date(m.createdAt).toLocaleString("en-IN", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-medical-navy-900">
                              {m.batchNumber || "-"}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-medical-slate-100 text-medical-slate-800 border border-medical-slate-200">
                                {m.movementType}
                              </span>
                            </td>
                            <td
                              className={`py-2.5 px-3 font-mono font-bold ${
                                isPositive ? "text-medical-green-700" : "text-red-600"
                              }`}
                            >
                              {isPositive ? `+${m.quantity}` : `-${m.quantity}`}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-medical-slate-500">
                              {m.previousQty}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-medical-navy-950">
                              {m.newQty}
                            </td>
                            <td className="py-2.5 px-3 text-medical-slate-600 max-w-xs truncate">
                              {m.reason || m.referenceId || "Standard movement"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
