import React, { useState, useRef } from "react";
import { BulkImportRow, BulkImportResult } from "@/types/medicine";
import { medicineService } from "@/services/medicineService";
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<"UPLOAD" | "PREVIEW" | "SUCCESS">("UPLOAD");
  const [parsedRows, setParsedRows] = useState<BulkImportRow[]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState<"SKIP" | "UPDATE">("UPDATE");
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setStep("UPLOAD");
    setParsedRows([]);
    setDuplicateStrategy("UPDATE");
    setImportResult(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsParsing(true);
      setParseError(null);
      const rows = await medicineService.parseImportFile(file);
      if (rows.length === 0) {
        setParseError("The uploaded file contains no data rows.");
        return;
      }
      setParsedRows(rows);
      setStep("PREVIEW");
    } catch (err) {
      console.error("Bulk file parse failed:", err);
      setParseError(
        err instanceof Error ? err.message : "Failed to parse CSV or Excel file."
      );
    } finally {
      setIsParsing(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;
  const duplicateMedicineCount = parsedRows.filter((r) => r.isDuplicateMedicine).length;
  const duplicateBatchCount = parsedRows.filter((r) => r.isDuplicateBatch).length;

  const handleExecuteImport = async () => {
    if (validCount === 0) {
      alert("No valid rows to import.");
      return;
    }

    try {
      setIsImporting(true);
      const result = await medicineService.executeBulkImport(parsedRows, duplicateStrategy);
      setImportResult(result);
      setStep("SUCCESS");
      await onSuccess();
    } catch (err) {
      alert("Import execution error: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-medical-navy-950/70 backdrop-blur-xs animate-in fade-in-50">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-medical-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-medical-slate-200 bg-medical-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-medical-navy-900 text-white">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-medical-navy-950">
                Bulk Import Medicines & Batches
              </h3>
              <p className="text-xs text-medical-slate-500">
                Quickly populate or update your pharmacy stock via Excel (.xlsx) or CSV (.csv).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-medical-slate-400 hover:text-medical-navy-900 hover:bg-medical-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Upload File & Template Download */}
        {step === "UPLOAD" && (
          <div className="p-6 space-y-6 overflow-y-auto text-xs">
            {parseError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {/* Template Download Card */}
            <div className="p-4 rounded-xl bg-medical-slate-50 border border-medical-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="font-bold text-medical-navy-950 text-xs flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-medical-green-600" />
                  Need the standard format template?
                </h4>
                <p className="text-[11px] text-medical-slate-500">
                  Download a pre-formatted Excel or CSV template with example medicines, batches, and prices.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => medicineService.downloadSampleTemplate("xlsx")}
                  className="text-xs h-8 border-medical-slate-300 hover:bg-white cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-medical-green-700" />
                  Excel Template (.xlsx)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => medicineService.downloadSampleTemplate("csv")}
                  className="text-xs h-8 border-medical-slate-300 hover:bg-white cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  CSV Template (.csv)
                </Button>
              </div>
            </div>

            {/* Hidden Input & Dropzone */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-medical-slate-300 rounded-2xl p-10 flex flex-col items-center justify-center text-center hover:border-medical-navy-600 hover:bg-medical-slate-50/80 transition-all cursor-pointer group space-y-3"
            >
              <div className="p-4 rounded-full bg-medical-navy-50 group-hover:bg-medical-navy-100 text-medical-navy-800 transition-colors">
                <UploadCloud className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-medical-navy-950 text-sm">
                  Click to browse and upload your medicine file
                </p>
                <p className="text-xs text-medical-slate-500">
                  Supports Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv)
                </p>
              </div>
              {isParsing && (
                <div className="flex items-center gap-2 text-xs font-bold text-medical-navy-700 pt-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Reading and validating file data...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Preview & Validation Table */}
        {step === "PREVIEW" && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden text-xs">
            {/* Summary KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-medical-slate-50 border-b border-medical-slate-200 shrink-0">
              <div className="p-2.5 rounded-xl bg-white border border-medical-slate-200">
                <span className="text-[10px] text-medical-slate-500 uppercase font-bold block">
                  Total Parsed Rows
                </span>
                <span className="text-sm font-extrabold text-medical-navy-950 font-mono">
                  {parsedRows.length} Rows
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-medical-green-50 border border-medical-green-200">
                <span className="text-[10px] text-medical-green-800 uppercase font-bold block">
                  Valid Rows Ready
                </span>
                <span className="text-sm font-extrabold text-medical-green-700 font-mono">
                  {validCount} Rows
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200">
                <span className="text-[10px] text-red-800 uppercase font-bold block">
                  Invalid Rows
                </span>
                <span className="text-sm font-extrabold text-red-700 font-mono">
                  {invalidCount} Rows
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-[10px] text-amber-800 uppercase font-bold block">
                  Duplicates Detected
                </span>
                <span className="text-sm font-extrabold text-amber-800 font-mono">
                  {duplicateBatchCount} Batches ({duplicateMedicineCount} Meds)
                </span>
              </div>
            </div>

            {/* Duplicate Strategy Switcher */}
            <div className="px-6 py-3 bg-white border-b border-medical-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <span className="font-bold text-medical-navy-950 text-xs">
                When an existing batch number already exists in your database:
              </span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold">
                  <input
                    type="radio"
                    name="dupStrategy"
                    value="UPDATE"
                    checked={duplicateStrategy === "UPDATE"}
                    onChange={() => setDuplicateStrategy("UPDATE")}
                    className="accent-medical-navy-900"
                  />
                  <span>Update & Add to Stock Quantity</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold">
                  <input
                    type="radio"
                    name="dupStrategy"
                    value="SKIP"
                    checked={duplicateStrategy === "SKIP"}
                    onChange={() => setDuplicateStrategy("SKIP")}
                    className="accent-medical-navy-900"
                  />
                  <span>Skip Duplicate Rows</span>
                </label>
              </div>
            </div>

            {/* Preview Table */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="rounded-xl border border-medical-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-medical-slate-50 border-b border-medical-slate-200 text-medical-slate-700 font-bold text-[11px] uppercase tracking-wider">
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Medicine Name</th>
                      <th className="py-2 px-3">Batch Number</th>
                      <th className="py-2 px-3">Expiry Date</th>
                      <th className="py-2 px-3">Cost (₹)</th>
                      <th className="py-2 px-3">MRP (₹)</th>
                      <th className="py-2 px-3">Selling (₹)</th>
                      <th className="py-2 px-3">Qty</th>
                      <th className="py-2 px-3">Validation Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-medical-slate-100 text-xs">
                    {parsedRows.map((r) => (
                      <tr
                        key={r.rowNumber}
                        className={r.isValid ? "hover:bg-medical-slate-50/70" : "bg-red-50/50"}
                      >
                        <td className="py-2 px-3 font-mono text-medical-slate-500">{r.rowNumber}</td>
                        <td className="py-2 px-3">
                          {r.isValid ? (
                            <span className="inline-flex items-center gap-1 text-medical-green-700 font-bold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-600 font-bold text-[11px]">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Error
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-bold text-medical-navy-950">{r.name}</td>
                        <td className="py-2 px-3 font-mono font-bold">{r.batchNumber}</td>
                        <td className="py-2 px-3 font-mono">{r.expDate}</td>
                        <td className="py-2 px-3 font-mono">₹{r.costPrice}</td>
                        <td className="py-2 px-3 font-mono font-bold">₹{r.mrp}</td>
                        <td className="py-2 px-3 font-mono font-bold text-medical-green-800">
                          ₹{r.sellingPrice}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold">{r.quantity}</td>
                        <td className="py-2 px-3">
                          {r.errors.length > 0 ? (
                            <span className="text-red-600 font-semibold text-[11px]">
                              {r.errors.join(", ")}
                            </span>
                          ) : r.isDuplicateBatch ? (
                            <span className="text-amber-700 font-semibold text-[11px]">
                              Duplicate Batch ({duplicateStrategy === "UPDATE" ? "Will update stock" : "Will skip"})
                            </span>
                          ) : (
                            <span className="text-medical-slate-400 text-[11px]">New Record</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-medical-slate-200 bg-medical-slate-50 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep("UPLOAD")}
                disabled={isImporting}
                className="text-xs cursor-pointer"
              >
                Choose Another File
              </Button>
              <div className="flex items-center gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  disabled={isImporting}
                  className="text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleExecuteImport}
                  disabled={isImporting || validCount === 0}
                  className="text-xs font-bold bg-medical-navy-900 hover:bg-medical-navy-800 text-white shadow-xs cursor-pointer disabled:opacity-40"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Importing {validCount} Records...
                    </>
                  ) : (
                    `Confirm & Import (${validCount} Valid Rows)`
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Success Summary Report */}
        {step === "SUCCESS" && importResult && (
          <div className="p-8 space-y-6 text-center text-xs">
            <div className="w-14 h-14 rounded-full bg-medical-green-100 text-medical-green-700 flex items-center justify-center mx-auto shadow-xs">
              <FileCheck className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-extrabold text-medical-navy-950">
                Bulk Import Completed Successfully!
              </h3>
              <p className="text-xs text-medical-slate-500">
                All valid medicine records and batch quantities have been committed to local SQLite database.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
              <div className="p-3 rounded-xl bg-medical-green-50 border border-medical-green-200">
                <span className="text-[10px] text-medical-green-800 uppercase font-bold block">
                  Imported / Updated
                </span>
                <span className="text-base font-extrabold text-medical-green-700 font-mono">
                  {importResult.successCount}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-[10px] text-amber-800 uppercase font-bold block">
                  Skipped
                </span>
                <span className="text-base font-extrabold text-amber-700 font-mono">
                  {importResult.skippedCount}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                <span className="text-[10px] text-red-800 uppercase font-bold block">
                  Failed
                </span>
                <span className="text-base font-extrabold text-red-700 font-mono">
                  {importResult.failedCount}
                </span>
              </div>
            </div>

            <div className="pt-4">
              <Button
                type="button"
                size="sm"
                onClick={handleClose}
                className="text-xs font-bold bg-medical-navy-900 hover:bg-medical-navy-800 text-white px-6 cursor-pointer"
              >
                Close & View Inventory
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
