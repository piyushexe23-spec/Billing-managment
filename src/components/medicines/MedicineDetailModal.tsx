import React, { useState, useEffect } from "react";
import {
  MedicineWithBatches,
  MedicineBatch,
  StockMovement,
  StockAdjustmentInput,
} from "@/types/medicine";
import {
  medicineService,
  calculateExpiryStatus,
  calculateStockStatus,
} from "@/services/medicineService";
import { formatCurrencyINR } from "@/lib/formatters";
import { AddNewBatchModal } from "@/components/medicines/AddNewBatchModal";
import { EditMedicineModal } from "@/components/medicines/EditMedicineModal";
import { EditBatchModal } from "@/components/medicines/EditBatchModal";
import { ArchiveDeleteModal } from "@/components/medicines/ArchiveDeleteModal";
import {
  X,
  Pencil,
  Sliders,
  Archive,
  Layers,
  History,
  Loader2,
  PackagePlus,
  RotateCcw,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface MedicineDetailModalProps {
  medicineId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenStockAdjustment: (input: StockAdjustmentInput) => void;
  onRefresh: () => Promise<void>;
}

function formatUnit(qty: number, rawUnit?: string | null): string {
  const base = (rawUnit || "Unit").trim();
  const singular =
    base.endsWith("s") && !base.toLowerCase().endsWith("gas")
      ? base.slice(0, -1)
      : base;
  return Math.abs(qty) === 1 ? singular : `${singular}s`;
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

  // Sub-modals inside View Panel
  const [isEditMedicineOpen, setIsEditMedicineOpen] = useState(false);
  const [isAddBatchOpen, setIsAddBatchOpen] = useState(false);
  const [isArchiveDeleteOpen, setIsArchiveDeleteOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<MedicineBatch | null>(null);

  const loadData = async () => {
    if (!medicineId) return;
    try {
      setIsLoading(true);
      const [med, movs] = await Promise.all([
        medicineService.getMedicineById(medicineId),
        medicineService.getStockMovements(medicineId),
      ]);
      setMedicine(med);
      setMovements(movs);
    } catch (err) {
      console.error("Failed to load medicine details:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && medicineId) {
      loadData();
    }
  }, [medicineId, isOpen]);

  if (!isOpen || !medicineId) return null;

  const totalStock = (medicine?.batches || [])
    .filter((b) => b.isActive)
    .reduce((acc, b) => acc + (b.stockQty || 0), 0);

  const stockStatus = medicine
    ? calculateStockStatus(totalStock, medicine.lowStockThreshold)
    : "OUT_OF_STOCK";

  const handleRestore = async () => {
    if (!medicineId) return;
    try {
      await medicineService.restoreMedicine(medicineId);
      await loadData();
      await onRefresh();
    } catch (err) {
      console.error("Failed to restore medicine:", err);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-medical-navy-950/70 backdrop-blur-xs animate-in fade-in-50">
        <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-medical-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-medical-slate-200 bg-medical-slate-50/70 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-medical-navy-950">
                  {medicine?.name || "Loading Medicine..."}
                </h3>
                {medicine && !medicine.isActive && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-medical-slate-200 text-medical-slate-700 border border-medical-slate-300">
                    Archived
                  </span>
                )}
                {stockStatus === "OUT_OF_STOCK" && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                    Out of Stock
                  </span>
                )}
                {stockStatus === "LOW_STOCK" && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    Low Stock
                  </span>
                )}
                {stockStatus === "IN_STOCK" && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-medical-green-100 text-medical-green-800 border border-medical-green-200">
                    In Stock
                  </span>
                )}
              </div>
              <p className="text-xs text-medical-slate-500">
                {medicine?.genericName ? `${medicine.genericName} • ` : ""}
                {medicine?.manufacturer || "Generic"} • Category: {medicine?.category || "General"}
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Edit Master */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditMedicineOpen(true)}
                className="text-xs h-8 px-2.5 border-medical-slate-300 hover:bg-medical-slate-100 cursor-pointer"
                title="Edit medicine master information"
              >
                <Pencil className="w-3.5 h-3.5 mr-1 text-medical-slate-600" />
                Edit Master
              </Button>

              {/* Add New Batch */}
              <Button
                type="button"
                size="sm"
                onClick={() => setIsAddBatchOpen(true)}
                className="text-xs h-8 px-3 bg-medical-navy-900 hover:bg-medical-navy-800 text-white cursor-pointer font-bold"
                title="Add new delivery batch"
              >
                <PackagePlus className="w-3.5 h-3.5 mr-1" />
                Add Batch
              </Button>

              {/* Archive / Delete or Restore */}
              {medicine?.isActive ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsArchiveDeleteOpen(true)}
                  className="text-xs text-amber-800 border-amber-300 hover:bg-amber-50 h-8 px-2.5 cursor-pointer"
                  title="Archive or delete medicine"
                >
                  <Archive className="w-3.5 h-3.5 mr-1 text-amber-700" />
                  Archive
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRestore}
                  className="text-xs text-medical-green-800 border-medical-green-300 hover:bg-medical-green-50 h-8 px-2.5 cursor-pointer font-semibold"
                  title="Restore archived medicine"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1 text-medical-green-700" />
                  Restore
                </Button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-medical-slate-400 hover:text-medical-navy-900 hover:bg-medical-slate-200/60 transition-colors cursor-pointer ml-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Top Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-medical-slate-100/60 border-b border-medical-slate-200 text-xs shrink-0">
            <div className="p-2.5 rounded-xl bg-white border border-medical-slate-200/80">
              <span className="text-[10px] text-medical-slate-500 block uppercase font-bold tracking-wider">
                Total Available Stock
              </span>
              <span className="text-base font-bold text-medical-navy-950 font-sans tabular-nums">
                {totalStock} {formatUnit(totalStock, medicine?.unit)}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-medical-slate-200/80">
              <span className="text-[10px] text-medical-slate-500 block uppercase font-bold tracking-wider">
                Low Stock Threshold
              </span>
              <span className="text-base font-bold text-medical-slate-700 font-sans tabular-nums">
                {medicine?.lowStockThreshold} {formatUnit(medicine?.lowStockThreshold || 0, medicine?.unit)}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-medical-slate-200/80">
              <span className="text-[10px] text-medical-slate-500 block uppercase font-bold tracking-wider">
                Active Batches
              </span>
              <span className="text-base font-bold text-medical-navy-900 font-sans tabular-nums">
                {(medicine?.batches || []).filter((b) => b.isActive).length} {medicine?.batches?.length === 1 ? "Batch" : "Batches"}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-medical-slate-200/80">
              <span className="text-[10px] text-medical-slate-500 block uppercase font-bold tracking-wider">
                Barcode / HSN Code
              </span>
              <span className="text-xs font-semibold text-medical-slate-700 font-sans truncate block mt-0.5">
                {medicine?.barcode || "No Barcode"} • {medicine?.hsnCode || "-"}
              </span>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center justify-between px-6 border-b border-medical-slate-200 bg-white text-xs font-semibold shrink-0">
            <div className="flex items-center">
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

            {activeTab === "batches" && (
              <Button
                type="button"
                size="sm"
                onClick={() => setIsAddBatchOpen(true)}
                className="text-xs h-7 px-2.5 bg-medical-navy-900 hover:bg-medical-navy-800 text-white cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add New Batch
              </Button>
            )}
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
                {/* Batches Table */}
                <div className="rounded-xl border border-medical-slate-200 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-medical-slate-50 border-b border-medical-slate-200 text-medical-slate-700 font-bold text-[11px] uppercase tracking-wider">
                          <th className="py-2.5 px-3 whitespace-nowrap">Batch Number</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">Mfg Date</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">Expiry Date</th>
                          <th className="py-2.5 px-3 text-right whitespace-nowrap">Cost Price</th>
                          <th className="py-2.5 px-3 text-right whitespace-nowrap">MRP</th>
                          <th className="py-2.5 px-3 text-right whitespace-nowrap">Selling Price</th>
                          <th className="py-2.5 px-3 text-right whitespace-nowrap">Stock Quantity</th>
                          <th className="py-2.5 px-3 text-right whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-medical-slate-100 font-sans">
                        {(medicine?.batches || []).length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center py-8 text-medical-slate-400">
                              <p className="font-semibold text-medical-slate-600 mb-2">
                                No batches registered for this medicine yet.
                              </p>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => setIsAddBatchOpen(true)}
                                className="h-7 text-xs font-bold bg-medical-navy-900 text-white cursor-pointer"
                              >
                                <PackagePlus className="w-3.5 h-3.5 mr-1" />
                                Add First Batch
                              </Button>
                            </td>
                          </tr>
                        ) : (
                          (medicine?.batches || []).map((b) => {
                            const expStatus = calculateExpiryStatus(b.expDate);
                            return (
                              <tr key={b.id} className="hover:bg-medical-slate-50/70 transition-colors">
                                <td className="py-2.5 px-3 font-bold text-medical-navy-950 whitespace-nowrap">
                                  {b.batchNumber}
                                </td>
                                <td className="py-2.5 px-3 text-medical-slate-500 tabular-nums whitespace-nowrap">
                                  {b.mfgDate || "—"}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5 tabular-nums">
                                    <span>{b.expDate}</span>
                                    {expStatus === "EXPIRED" && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-100 text-red-800">
                                        Expired
                                      </span>
                                    )}
                                    {expStatus === "EXPIRING_SOON" && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                        Expiring &le;10d
                                      </span>
                                    )}
                                    {expStatus === "SAFE" && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                                        Safe
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right text-medical-slate-600 tabular-nums whitespace-nowrap">
                                  {formatCurrencyINR(b.costPrice)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-semibold text-medical-slate-900 tabular-nums whitespace-nowrap">
                                  {formatCurrencyINR(b.mrp)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-medical-green-700 tabular-nums whitespace-nowrap">
                                  {formatCurrencyINR(b.sellingPrice)}
                                </td>
                                <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                                  <span className="font-bold text-medical-navy-950">
                                    {b.stockQty}
                                  </span>{" "}
                                  <span className="text-[11px] text-medical-slate-500 font-normal">
                                    {formatUnit(b.stockQty, medicine?.unit)}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {/* Edit Batch */}
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setEditingBatch(b)}
                                      className="h-7 px-2 text-xs border-medical-slate-300 hover:bg-medical-slate-100 cursor-pointer"
                                      title="Edit batch details (prices, dates, batch number)"
                                    >
                                      <Pencil className="w-3 h-3 mr-1" />
                                      Edit
                                    </Button>

                                    {/* Adjust Stock */}
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
                                          reason: "Physical count recount",
                                        })
                                      }
                                      className="text-xs h-7 px-2 border-medical-slate-300 hover:bg-medical-slate-100 cursor-pointer"
                                      title="Adjust stock quantity"
                                    >
                                      <Sliders className="w-3 h-3 mr-1" />
                                      Adjust
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              /* Tab 2: Stock Movements History */
              <div className="space-y-3 font-sans">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-medical-navy-950 text-xs">
                    Stock Movement Audit Ledger
                  </span>
                  <span className="text-[11px] text-medical-slate-500 tabular-nums font-semibold">
                    {movements.length} total recorded transactions
                  </span>
                </div>

                <div className="rounded-xl border border-medical-slate-200 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-medical-slate-50 border-b border-medical-slate-200 text-medical-slate-700 font-bold text-[11px] uppercase tracking-wider">
                          <th className="py-2 px-3 whitespace-nowrap">Timestamp</th>
                          <th className="py-2 px-3 whitespace-nowrap">Operation Type</th>
                          <th className="py-2 px-3 whitespace-nowrap">Batch</th>
                          <th className="py-2 px-3 text-right whitespace-nowrap">Qty Change</th>
                          <th className="py-2 px-3 text-right whitespace-nowrap">Previous</th>
                          <th className="py-2 px-3 text-right whitespace-nowrap">New Balance</th>
                          <th className="py-2 px-3">Audit Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-medical-slate-100">
                        {movements.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-6 text-medical-slate-400">
                              No stock transactions recorded yet.
                            </td>
                          </tr>
                        ) : (
                          movements.map((m) => (
                            <tr key={m.id} className="hover:bg-medical-slate-50/70 transition-colors">
                              <td className="py-2 px-3 text-medical-slate-500 tabular-nums whitespace-nowrap">
                                {m.createdAt.slice(0, 19).replace("T", " ")}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                {m.movementType === "OPENING_STOCK" && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    Opening Stock
                                  </span>
                                )}
                                {m.movementType === "PURCHASE" && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-medical-green-50 text-medical-green-700 border border-medical-green-200">
                                    Purchase / New Batch
                                  </span>
                                )}
                                {m.movementType === "ADJUSTMENT_ADD" && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Stock Added (+)
                                  </span>
                                )}
                                {m.movementType === "ADJUSTMENT_REDUCE" && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                    Stock Reduced (-)
                                  </span>
                                )}
                                {m.movementType === "SALE" && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                    Sale
                                  </span>
                                )}
                                {m.movementType === "DAMAGE" && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    Damaged
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 font-semibold text-medical-navy-950 whitespace-nowrap">
                                {m.batchNumber || "—"}
                              </td>
                              <td className="py-2 px-3 text-right font-bold tabular-nums whitespace-nowrap">
                                {m.movementType === "ADJUSTMENT_REDUCE" || m.movementType === "DAMAGE" ? (
                                  <span className="text-red-600">-{m.quantity}</span>
                                ) : (
                                  <span className="text-medical-green-700">+{m.quantity}</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right text-medical-slate-500 tabular-nums whitespace-nowrap">
                                {m.previousQty}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-medical-navy-950 tabular-nums whitespace-nowrap">
                                {m.newQty}
                              </td>
                              <td className="py-2 px-3 text-medical-slate-600 max-w-xs truncate">
                                {m.reason || "—"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sub-modals */}
      <AddNewBatchModal
        isOpen={isAddBatchOpen}
        onClose={() => setIsAddBatchOpen(false)}
        medicineId={medicineId}
        onSuccess={async () => {
          await loadData();
          await onRefresh();
        }}
      />

      <EditMedicineModal
        isOpen={isEditMedicineOpen}
        onClose={() => setIsEditMedicineOpen(false)}
        medicineId={medicineId}
        onSuccess={async () => {
          await loadData();
          await onRefresh();
        }}
      />

      <EditBatchModal
        isOpen={editingBatch !== null}
        onClose={() => setEditingBatch(null)}
        batch={editingBatch}
        medicineName={medicine?.name}
        onSuccess={async () => {
          await loadData();
          await onRefresh();
        }}
      />

      <ArchiveDeleteModal
        isOpen={isArchiveDeleteOpen}
        onClose={() => setIsArchiveDeleteOpen(false)}
        medicineId={medicineId}
        medicineName={medicine?.name}
        onSuccess={async () => {
          await onRefresh();
          onClose();
        }}
      />
    </>
  );
};
