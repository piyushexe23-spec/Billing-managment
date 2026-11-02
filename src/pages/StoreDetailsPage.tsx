import React, { useState, useEffect, useRef } from "react";
import { StoreDetails, StoreDetailsFormErrors } from "@/types/store";
import { storeService, DEFAULT_STORE_DETAILS } from "@/services/storeService";
import { validateStoreDetails } from "@/lib/validations";
import {
  Building2,
  UserCheck,
  Receipt,
  Landmark,
  Sliders,
  ImageDown,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  UploadCloud,
  Trash2,
  Loader2,
  Info,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const StoreDetailsPage: React.FC = () => {
  const [formData, setFormData] = useState<StoreDetails>(DEFAULT_STORE_DETAILS);
  const [initialData, setInitialData] = useState<StoreDetails>(DEFAULT_STORE_DETAILS);
  const [errors, setErrors] = useState<StoreDetailsFormErrors>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState<boolean>(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load store details on mount
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setIsLoading(true);
        const data = await storeService.getStoreDetails();
        if (isMounted) {
          setFormData(data);
          setInitialData(data);
        }
      } catch (err) {
        console.error("Failed to load store details:", err);
        if (isMounted) {
          setSaveError("Failed to load store details from local SQLite database.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Check if form has unsaved modifications
  const isDirty = JSON.stringify(formData) !== JSON.stringify(initialData);

  // Field change handler
  const handleInputChange = (
    field: keyof StoreDetails,
    value: string | number | boolean | null
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear individual field error on change
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }

    if (saveSuccess) setSaveSuccess(null);
    if (saveError) setSaveError(null);
  };

  // Reset form to last saved state
  const handleReset = () => {
    if (isDirty) {
      const confirmDiscard = window.confirm(
        "Discard unsaved changes and reload previously saved store details?"
      );
      if (!confirmDiscard) return;
    }
    setFormData(initialData);
    setErrors({});
    setSaveSuccess(null);
    setSaveError(null);
    setLogoError(null);
  };

  // Submit / Save form
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const validation = validateStoreDetails(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      setSaveError("Please resolve the validation errors highlighted below.");
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(null);

      const saved = await storeService.saveStoreDetails(formData);
      setFormData(saved);
      setInitialData(saved);
      setSaveSuccess("Store details saved successfully to local SQLite database.");

      // Auto dismiss success notice after 4.5 seconds
      setTimeout(() => {
        setSaveSuccess(null);
      }, 4500);
    } catch (err) {
      console.error("Error saving store details:", err);
      setSaveError(
        err instanceof Error
          ? err.message
          : "Failed to save store details to local database."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Logo File Selection
  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLogoUploading(true);
      setLogoError(null);

      const result = await storeService.processLogoFile(file);
      setFormData((prev) => ({
        ...prev,
        logoPath: result.logoPath,
        logoDataUrl: result.logoDataUrl,
      }));
    } catch (err) {
      console.error("Logo processing failed:", err);
      setLogoError(
        err instanceof Error ? err.message : "Failed to process logo image."
      );
    } finally {
      setLogoUploading(false);
      // Reset input value so same file can be re-selected if desired
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handle Logo Removal
  const handleRemoveLogo = async () => {
    const confirmRemove = window.confirm(
      "Are you sure you want to remove the pharmacy logo?"
    );
    if (!confirmRemove) return;

    try {
      await storeService.removeLogo();
      setFormData((prev) => ({
        ...prev,
        logoPath: null,
        logoDataUrl: null,
      }));
      setLogoError(null);
    } catch (err) {
      console.error("Failed to remove logo:", err);
      setLogoError("Failed to remove logo.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-medical-navy-600" />
        <p className="text-sm font-semibold text-medical-slate-600">
          Loading store configuration from local database...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title & Global Action Bar */}
      <div className="bg-white rounded-2xl border border-medical-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-medical-navy-950">
              Store Details & Settings
            </h1>
            {isDirty ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Unsaved Changes
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-medical-green-50 text-medical-green-700 border border-medical-green-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-medical-green-600" />
                Saved to SQLite
              </span>
            )}
          </div>
          <p className="text-xs text-medical-slate-500">
            Configure official pharmacy license details, GSTIN compliance, invoice sequence parameters, and store branding.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 self-end md:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!isDirty || isSaving}
            className="text-xs font-semibold h-9 px-3.5 border-medical-slate-300 text-medical-slate-700 hover:bg-medical-slate-100 cursor-pointer disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Reset
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => handleSave()}
            disabled={isSaving}
            className="text-xs font-bold h-9 px-4 bg-medical-navy-900 hover:bg-medical-navy-800 text-white shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Save Store Details
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Notifications Banner */}
      {saveSuccess && (
        <div className="p-4 rounded-xl bg-medical-green-50 border border-medical-green-200 text-medical-green-800 flex items-center justify-between text-xs font-semibold animate-in fade-in-50 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-medical-green-600 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccess(null)}
            className="text-medical-green-700 hover:text-medical-green-900 font-bold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center justify-between text-xs font-semibold animate-in fade-in-50 duration-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{saveError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="text-red-700 hover:text-red-900 font-bold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2-Column Responsive Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ========================================================== */}
        {/* SECTION A: PHARMACY INFORMATION                            */}
        {/* ========================================================== */}
        <Card className="border-medical-slate-200/80 shadow-xs">
          <CardHeader className="pb-3 border-b border-medical-slate-100 bg-medical-slate-50/50 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-medical-navy-100 text-medical-navy-800">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-base text-medical-navy-950">
                    A. Pharmacy Information
                  </CardTitle>
                  <CardDescription className="text-xs text-medical-slate-500">
                    Official business registration and drug license compliance details
                  </CardDescription>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-medical-navy-50 text-medical-navy-700 px-2 py-0.5 rounded border border-medical-navy-200">
                Mandatory
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-4 text-xs">
            {/* Store Name (Mandatory) */}
            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800 flex items-center gap-1">
                Pharmacy / Store Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.storeName}
                onChange={(e) => handleInputChange("storeName", e.target.value)}
                placeholder="e.g. IM MEDICOS PHARMACY"
                error={!!errors.storeName}
                className="font-medium"
              />
              {errors.storeName && (
                <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.storeName}
                </p>
              )}
            </div>

            {/* Address (Multiline) */}
            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800">
                Full Address
              </label>
              <textarea
                value={formData.address || ""}
                onChange={(e) => handleInputChange("address", e.target.value)}
                placeholder="Shop number, building, medical complex, street, area, city, pincode"
                rows={3}
                className="w-full rounded-lg border border-medical-slate-300 p-2.5 text-xs text-medical-slate-900 placeholder:text-medical-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-navy-100 focus-visible:border-medical-navy-600 transition-colors"
              />
            </div>

            {/* Phone & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-medical-slate-800 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-medical-slate-400" />
                  Phone Number
                </label>
                <Input
                  value={formData.phone || ""}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  error={!!errors.phone}
                />
                {errors.phone && (
                  <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.phone}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-medical-slate-800 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-medical-slate-400" />
                  Email Address
                </label>
                <Input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="e.g. pharmacy@example.com"
                  error={!!errors.email}
                />
                {errors.email && (
                  <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.email}
                  </p>
                )}
              </div>
            </div>

            {/* GSTIN */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-bold text-medical-slate-800">
                  GSTIN (Goods and Services Tax ID)
                </label>
                <span className="text-[10px] text-medical-slate-400 font-mono">
                  15 Alphanumeric Characters
                </span>
              </div>
              <Input
                value={formData.gstin || ""}
                onChange={(e) => handleInputChange("gstin", e.target.value.toUpperCase())}
                placeholder="e.g. 07AAAAA0000A1Z5"
                error={!!errors.gstin}
                className="font-mono uppercase tracking-wider"
              />
              {errors.gstin ? (
                <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.gstin}
                </p>
              ) : (
                <p className="text-[11px] text-medical-slate-500">
                  Format: 2 digits state code + 10 char PAN + 1 entity code + 'Z' + 1 checksum
                </p>
              )}
            </div>

            {/* Drug Licenses 1 & 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-medical-slate-800">
                  Drug License Number 1 (Form 20B)
                </label>
                <Input
                  value={formData.drugLicense1 || ""}
                  onChange={(e) => handleInputChange("drugLicense1", e.target.value)}
                  placeholder="e.g. DL-20B/12345/2024"
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-medical-slate-800">
                  Drug License Number 2 (Form 21B)
                </label>
                <Input
                  value={formData.drugLicense2 || ""}
                  onChange={(e) => handleInputChange("drugLicense2", e.target.value)}
                  placeholder="e.g. DL-21B/12346/2024"
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ========================================================== */}
        {/* SECTION B: OWNER / PHARMACIST INFORMATION                   */}
        {/* ========================================================== */}
        <div className="space-y-6">
          <Card className="border-medical-slate-200/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-medical-slate-100 bg-medical-slate-50/50 rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-medical-navy-100 text-medical-navy-800">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-base text-medical-navy-950">
                    B. Owner / Pharmacist Information
                  </CardTitle>
                  <CardDescription className="text-xs text-medical-slate-500">
                    Pharmacist supervision and state pharmacy council credentials (optional)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-medical-slate-800">
                  Owner / Proprietor Name
                </label>
                <Input
                  value={formData.ownerName || ""}
                  onChange={(e) => handleInputChange("ownerName", e.target.value)}
                  placeholder="e.g. Dr. Ramesh Kumar"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-medical-slate-800">
                    Pharmacist Name
                  </label>
                  <Input
                    value={formData.pharmacistName || ""}
                    onChange={(e) => handleInputChange("pharmacistName", e.target.value)}
                    placeholder="e.g. Suresh Sharma, B.Pharm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-medical-slate-800">
                    Pharmacist Registration Number
                  </label>
                  <Input
                    value={formData.pharmacistRegNo || ""}
                    onChange={(e) => handleInputChange("pharmacistRegNo", e.target.value)}
                    placeholder="e.g. REG-DL-987654"
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ========================================================== */}
          {/* SECTION E: INVENTORY SETTINGS                              */}
          {/* ========================================================== */}
          <Card className="border-medical-slate-200/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-medical-slate-100 bg-medical-slate-50/50 rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-900">
                  <Sliders className="w-4 h-4 text-amber-700" />
                </div>
                <div>
                  <CardTitle className="text-base text-medical-navy-950">
                    E. Inventory Settings
                  </CardTitle>
                  <CardDescription className="text-xs text-medical-slate-500">
                    Threshold configuration for low stock alerts across the application
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5 space-y-3 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-medical-slate-800 flex items-center justify-between">
                  <span>Default Low Stock Alert Quantity</span>
                  <span className="text-[11px] font-mono text-medical-navy-700 bg-medical-navy-50 px-2 py-0.5 rounded border border-medical-navy-100">
                    Current: {formData.lowStockThreshold} units
                  </span>
                </label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={formData.lowStockThreshold ?? 10}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    handleInputChange(
                      "lowStockThreshold",
                      isNaN(parsed) ? 0 : parsed
                    );
                  }}
                  error={!!errors.lowStockThreshold}
                  className="font-mono text-sm max-w-xs"
                />
                {errors.lowStockThreshold ? (
                  <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.lowStockThreshold}
                  </p>
                ) : (
                  <p className="text-[11px] text-medical-slate-500">
                    Any medicine item with remaining stock at or below this number will be flagged in amber/red on the Dashboard and procurement screens.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ========================================================== */}
        {/* SECTION C: INVOICE CONFIGURATION                           */}
        {/* ========================================================== */}
        <Card className="border-medical-slate-200/80 shadow-xs">
          <CardHeader className="pb-3 border-b border-medical-slate-100 bg-medical-slate-50/50 rounded-t-2xl">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-medical-navy-100 text-medical-navy-800">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base text-medical-navy-950">
                  C. Invoice Configuration
                </CardTitle>
                <CardDescription className="text-xs text-medical-slate-500">
                  Numbering sequences, print toggles, and standard invoice terms
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Bill Prefix */}
              <div className="space-y-1.5">
                <label className="font-bold text-medical-slate-800">
                  Bill Prefix <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.billPrefix}
                  onChange={(e) => handleInputChange("billPrefix", e.target.value)}
                  placeholder="e.g. IM"
                  error={!!errors.billPrefix}
                  className="font-mono font-bold uppercase"
                />
                {errors.billPrefix && (
                  <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.billPrefix}
                  </p>
                )}
              </div>

              {/* Starting Bill Number */}
              <div className="space-y-1.5">
                <label className="font-bold text-medical-slate-800">
                  Starting Bill Number <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={formData.startingBillNumber ?? 1}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    handleInputChange(
                      "startingBillNumber",
                      isNaN(parsed) ? 1 : parsed
                    );
                  }}
                  error={!!errors.startingBillNumber}
                  className="font-mono font-bold"
                />
                {errors.startingBillNumber && (
                  <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.startingBillNumber}
                  </p>
                )}
              </div>
            </div>

            {/* Invoicing Toggles */}
            <div className="pt-2 border-t border-medical-slate-100 space-y-3">
              <label className="flex items-center justify-between p-3 rounded-xl bg-medical-slate-50 border border-medical-slate-200/80 cursor-pointer hover:bg-medical-slate-100/70 transition-colors">
                <div className="space-y-0.5 pr-4">
                  <span className="font-bold text-medical-navy-950 block">
                    Show GSTIN on Invoice
                  </span>
                  <span className="text-[11px] text-medical-slate-500 block">
                    Print store GSTIN registration number in the top header of customer invoices
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.showGstinOnInvoice}
                  onChange={(e) =>
                    handleInputChange("showGstinOnInvoice", e.target.checked)
                  }
                  className="w-4 h-4 rounded text-medical-navy-800 focus:ring-medical-navy-600 cursor-pointer accent-medical-navy-900"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-medical-slate-50 border border-medical-slate-200/80 cursor-pointer hover:bg-medical-slate-100/70 transition-colors">
                <div className="space-y-0.5 pr-4">
                  <span className="font-bold text-medical-navy-950 block">
                    Show Amount in Words
                  </span>
                  <span className="text-[11px] text-medical-slate-500 block">
                    Render total net payable amount spelled out in English words at the bottom of invoice
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.showAmountInWords}
                  onChange={(e) =>
                    handleInputChange("showAmountInWords", e.target.checked)
                  }
                  className="w-4 h-4 rounded text-medical-navy-800 focus:ring-medical-navy-600 cursor-pointer accent-medical-navy-900"
                />
              </label>
            </div>

            {/* Default Invoice Footer Terms */}
            <div className="space-y-1.5 pt-2">
              <label className="font-bold text-medical-slate-800">
                Default Invoice Footer Terms & Conditions
              </label>
              <textarea
                value={formData.footerTerms || ""}
                onChange={(e) => handleInputChange("footerTerms", e.target.value)}
                placeholder="Return policy, prescription requirement notice, storage instructions..."
                rows={4}
                className="w-full rounded-lg border border-medical-slate-300 p-2.5 text-xs text-medical-slate-900 placeholder:text-medical-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-navy-100 focus-visible:border-medical-navy-600 transition-colors font-mono"
              />
            </div>
          </CardContent>
        </Card>

        {/* ========================================================== */}
        {/* SECTION D: BANK / UPI DETAILS                               */}
        {/* ========================================================== */}
        <Card className="border-medical-slate-200/80 shadow-xs">
          <CardHeader className="pb-3 border-b border-medical-slate-100 bg-medical-slate-50/50 rounded-t-2xl">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-medical-navy-100 text-medical-navy-800">
                <Landmark className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base text-medical-navy-950">
                  D. Bank / UPI Details
                </CardTitle>
                <CardDescription className="text-xs text-medical-slate-500">
                  Bank accounts and digital payment receivers (internal management)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-4 text-xs">
            {/* Informational Callout */}
            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/70 text-blue-900 flex items-start gap-2.5 text-[11px] leading-relaxed">
              <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <span>
                <strong>Confidentiality Notice:</strong> Bank and UPI details are stored securely for internal pharmacy bookkeeping. By default, they will not be printed on customer invoices unless a future invoice setting explicitly enables bank details.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-medical-slate-800">
                  Bank Name
                </label>
                <Input
                  value={formData.bankName || ""}
                  onChange={(e) => handleInputChange("bankName", e.target.value)}
                  placeholder="e.g. State Bank of India"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-medical-slate-800">
                  Account Holder Name
                </label>
                <Input
                  value={formData.accountHolderName || ""}
                  onChange={(e) => handleInputChange("accountHolderName", e.target.value)}
                  placeholder="e.g. IM MEDICOS PHARMACY"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-medical-slate-800">
                  Account Number
                </label>
                <Input
                  value={formData.accountNumber || ""}
                  onChange={(e) => handleInputChange("accountNumber", e.target.value)}
                  placeholder="e.g. 30987654321"
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-medical-slate-800">
                  IFSC Code
                </label>
                <Input
                  value={formData.ifscCode || ""}
                  onChange={(e) => handleInputChange("ifscCode", e.target.value.toUpperCase())}
                  placeholder="e.g. SBIN0001234"
                  error={!!errors.ifscCode}
                  className="font-mono uppercase text-xs"
                />
                {errors.ifscCode && (
                  <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.ifscCode}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-medical-slate-800">
                UPI ID (Virtual Payment Address)
              </label>
              <Input
                value={formData.upiId || ""}
                onChange={(e) => handleInputChange("upiId", e.target.value)}
                placeholder="e.g. immedicos@sbi or pharmacy@paytm"
                className="font-mono text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* ========================================================== */}
        {/* SECTION F: PHARMACY LOGO                                   */}
        {/* ========================================================== */}
        <Card className="border-medical-slate-200/80 shadow-xs lg:col-span-2">
          <CardHeader className="pb-3 border-b border-medical-slate-100 bg-medical-slate-50/50 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-medical-navy-100 text-medical-navy-800">
                  <ImageDown className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-base text-medical-navy-950">
                    F. Pharmacy Logo & Branding
                  </CardTitle>
                  <CardDescription className="text-xs text-medical-slate-500">
                    Upload and manage custom pharmacy logo (stored permanently in local app directory)
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-4 text-xs">
            {/* Logo Disclaimer Note */}
            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/70 text-amber-900 flex items-start gap-2.5 text-[11px] leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                <strong>System Notice:</strong> The custom pharmacy logo is stored in your permanent application directory. Standard invoice templates will feature the official fixed IM MEDICOS header emblem alongside your store identity.
              </span>
            </div>

            {/* Hidden native file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleLogoFileChange}
              accept="image/png,image/jpeg,image/jpg"
              className="hidden"
            />

            {/* Logo Display or Upload Area */}
            {formData.logoDataUrl || formData.logoPath ? (
              <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-medical-slate-50 border border-medical-slate-200/80">
                <div className="w-32 h-32 rounded-xl bg-white border border-medical-slate-300 flex items-center justify-center p-2 shadow-xs shrink-0 overflow-hidden">
                  <img
                    src={formData.logoDataUrl || formData.logoPath || ""}
                    alt="Pharmacy Logo Preview"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>

                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <div className="space-y-1">
                    <span className="font-bold text-medical-navy-950 block text-sm">
                      Custom Pharmacy Logo Active
                    </span>
                    <span className="text-[11px] text-medical-slate-500 font-mono block">
                      Local Path: {formData.logoPath || "Embedded Data URL"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={logoUploading}
                      className="text-xs h-8 px-3 border-medical-slate-300 hover:bg-medical-slate-100 cursor-pointer"
                    >
                      {logoUploading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Replace Logo"
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveLogo}
                      className="text-xs h-8 px-3 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Remove Logo
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-medical-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-medical-navy-600 hover:bg-medical-slate-50/80 transition-all cursor-pointer group space-y-2"
              >
                <div className="p-3 rounded-full bg-medical-navy-50 group-hover:bg-medical-navy-100 text-medical-navy-800 transition-colors">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-medical-navy-950 text-xs">
                    Click to select and upload your pharmacy logo
                  </p>
                  <p className="text-[11px] text-medical-slate-500 mt-0.5">
                    Supports PNG, JPG, or JPEG (Maximum file size: 2 MB)
                  </p>
                </div>
                {logoUploading && (
                  <div className="flex items-center gap-1.5 text-xs text-medical-navy-700 font-semibold pt-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing logo image...
                  </div>
                )}
              </div>
            )}

            {logoError && (
              <p className="text-red-600 text-[11px] font-semibold flex items-center gap-1 mt-2">
                <AlertCircle className="w-3.5 h-3.5" />
                {logoError}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
