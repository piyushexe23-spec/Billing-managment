import React, { useState, useEffect } from "react";
import { medicineService } from "@/services/medicineService";
import {
  X,
  Archive,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ArchiveDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicineId: number | null;
  medicineName?: string;
  onSuccess: () => Promise<void>;
}

export const ArchiveDeleteModal: React.FC<ArchiveDeleteModalProps> = ({
  isOpen,
  onClose,
  medicineId,
  medicineName,
  onSuccess,
}) => {
  const [canDelete, setCanDelete] = useState<boolean>(false);
  const [blockReason, setBlockReason] = useState<string>("");
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function checkDeleteStatus() {
      if (!medicineId) return;
      try {
        setIsChecking(true);
        setError(null);
        const check = await medicineService.canDeleteMedicine(medicineId);
        if (isMounted) {
          setCanDelete(check.canDelete);
          setBlockReason(check.reason);
        }
      } catch (err) {
        console.error("Failed to check delete status:", err);
      } finally {
        if (isMounted) setIsChecking(false);
      }
    }

    if (isOpen && medicineId) {
      checkDeleteStatus();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, medicineId]);

  if (!isOpen || !medicineId) return null;

  const handleArchive = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      await medicineService.archiveMedicine(medicineId);
      await onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive medicine.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePermanent = async () => {
    const confirm = window.confirm(
      `Are you sure you want to PERMANENTLY delete "${medicineName || "this medicine"}"? This action cannot be undone.`
    );
    if (!confirm) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await medicineService.deleteMedicine(medicineId);
      await onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete medicine.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-medical-navy-950/70 backdrop-blur-xs animate-in fade-in-50">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-medical-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-medical-slate-200 bg-medical-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-700">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-medical-navy-950">
                Archive / Delete Medicine
              </h3>
              <p className="text-xs text-medical-slate-500 truncate max-w-[240px]">
                {medicineName || `Medicine #${medicineId}`}
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

        {/* Content Body */}
        <div className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isChecking ? (
            <div className="py-8 text-center text-medical-slate-500 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-medical-navy-600" />
              <p>Checking regulatory and stock history...</p>
            </div>
          ) : (
            <>
              {/* Medicine Box */}
              <div className="p-3.5 rounded-xl bg-medical-slate-50 border border-medical-slate-200">
                <span className="text-[10px] uppercase font-bold text-medical-slate-400 block tracking-wider">
                  Selected Medicine
                </span>
                <span className="font-bold text-medical-navy-950 text-sm">
                  {medicineName || `Medicine #${medicineId}`}
                </span>
              </div>

              {/* Status explanation */}
              {!canDelete ? (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-amber-950">
                        Permanent Delete Is Restricted
                      </p>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        {blockReason}
                      </p>
                    </div>
                  </div>
                  <div className="text-[11px] text-amber-900 bg-white/70 p-2.5 rounded-lg border border-amber-200/80">
                    <strong>Archiving</strong> will safely hide this medicine from future billing, low stock alerts, and dashboard cards while preserving all historical batches and stock ledger entries.
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-medical-slate-50 border border-medical-slate-200 text-medical-slate-700 space-y-2">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-medical-slate-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed">
                      This medicine has no stock and no audit movement history. You may archive it or permanently remove it from the database.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-medical-slate-200 bg-medical-slate-50/70 text-xs">
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

          <div className="flex items-center gap-2">
            {canDelete && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDeletePermanent}
                disabled={isSubmitting}
                className="text-xs font-bold text-red-700 border-red-300 hover:bg-red-50 hover:text-red-900 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1 text-red-600" />
                Permanent Delete
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleArchive}
              disabled={isSubmitting}
              className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer px-4"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Archiving...
                </>
              ) : (
                <>
                  <Archive className="w-3.5 h-3.5 mr-1.5" />
                  Archive Medicine
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
