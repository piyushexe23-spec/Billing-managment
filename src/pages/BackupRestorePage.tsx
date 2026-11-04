import React, { useState, useEffect, useCallback, useId } from "react";
import {
  DatabaseBackup,
  RotateCcw,
  Clock,
  FolderOpen,
  FolderEdit,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  HardDrive,
  ShieldCheck,
  FileArchive,
  ArrowRight,
  Loader2,
  X,
} from "lucide-react";
import {
  BackupCounts,
  BackupRecord,
  BackupSettings,
  BackupValidationResult,
} from "@/types/backup";
import { backupService } from "@/services/backupService";

interface BackupRestorePageProps {
  onRestoreSuccess?: () => void;
}

export const BackupRestorePage: React.FC<BackupRestorePageProps> = ({
  onRestoreSuccess,
}) => {
  // Primary state
  const [settings, setSettings] = useState<BackupSettings>({
    autoBackupEnabled: true,
    backupFolder: "C:\\Users\\User\\Downloads\\IM_MEDICOS_Backups",
    retentionCount: 7,
    lastBackupTime: null,
    lastBackupSize: null,
    lastBackupStatus: "NONE",
  });
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [currentCounts, setCurrentCounts] = useState<BackupCounts>({
    bills: 0,
    medicines: 0,
    batches: 0,
    customers: 0,
  });

  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Modals state
  const [showRestoreModal, setShowRestoreModal] = useState<boolean>(false);
  const [selectedBackupForRestore, setSelectedBackupForRestore] =
    useState<BackupRecord | null>(null);
  const [restoreValidation, setRestoreValidation] =
    useState<BackupValidationResult | null>(null);
  const [isValidatingRestore, setIsValidatingRestore] = useState<boolean>(false);
  const [confirmRestoreAcknowledged, setConfirmRestoreAcknowledged] =
    useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  // Delete modal state
  const [backupToDelete, setBackupToDelete] = useState<BackupRecord | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Folder edit modal state
  const [showFolderModal, setShowFolderModal] = useState<boolean>(false);
  const [newFolderPath, setNewFolderPath] = useState<string>("");

  // Restore success modal state
  const [restoreSuccessNotice, setRestoreSuccessNotice] = useState<{
    message: string;
    preRestoreFile?: string;
  } | null>(null);

  // Generate unique form control IDs
  const autoBackupToggleId = useId();
  const retentionCountInputId = useId();
  const folderPathInputId = useId();
  const confirmRestoreCheckboxId = useId();

  // Load all data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [currSettings, currCounts] = await Promise.all([
        backupService.getSettings(),
        backupService.getCurrentCounts(),
      ]);
      setSettings(currSettings);
      setCurrentCounts(currCounts);

      const backupList = await backupService.listBackups(
        currSettings.backupFolder
      );
      setBackups(backupList);
    } catch (err) {
      console.error("Failed to load backup data:", err);
      setStatusMessage({
        type: "error",
        text: "Could not retrieve backup settings or file history.",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Run automated daily check on page mount
    backupService.checkAutoBackup().then((created) => {
      if (created) {
        loadData();
      }
    });
  }, [loadData]);

  // Determine if backup is stale (> 7 days old or never)
  const isBackupStale = (): boolean => {
    if (!settings.lastBackupTime) return true;
    try {
      const lastDate = new Date(settings.lastBackupTime.replace(" ", "T"));
      if (isNaN(lastDate.getTime())) return true;
      const now = new Date();
      const diffDays =
        (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 7;
    } catch {
      return true;
    }
  };

  // Format bytes to human readable string
  const formatBytes = (bytes: number | null): string => {
    if (bytes === null || bytes === undefined || bytes === 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Format date display
  const formatDateDisplay = (dateStr: string | null): string => {
    if (!dateStr) return "Never";
    try {
      const d = new Date(dateStr.replace(" ", "T"));
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  // Handle Manual Backup Now
  const handleBackupNow = async () => {
    setIsBackingUp(true);
    setStatusMessage(null);
    try {
      const record = await backupService.createBackup(
        "Manual",
        settings.backupFolder
      );
      setStatusMessage({
        type: "success",
        text: `Backup created successfully: ${record.fileName} (${formatBytes(
          record.sizeBytes
        )})`,
      });
      await loadData();
    } catch (err: unknown) {
      console.error("Backup failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({
        type: "error",
        text: `Backup failed: ${msg}`,
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  // Handle Saving Settings
  const handleSaveSettings = async (updated: Partial<BackupSettings>) => {
    setIsSavingSettings(true);
    setStatusMessage(null);
    try {
      const newSettings: BackupSettings = {
        ...settings,
        ...updated,
      };
      await backupService.saveSettings(newSettings);
      setSettings(newSettings);
      setStatusMessage({
        type: "success",
        text: "Backup settings updated successfully.",
      });
      // Refresh list if folder changed
      if (updated.backupFolder) {
        const backupList = await backupService.listBackups(
          updated.backupFolder
        );
        setBackups(backupList);
      }
    } catch (err) {
      console.error("Failed to save settings:", err);
      setStatusMessage({
        type: "error",
        text: "Failed to save backup settings.",
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Handle Open Backup Folder
  const handleOpenFolder = async () => {
    try {
      await backupService.openBackupFolder(settings.backupFolder);
    } catch (err) {
      console.error("Failed to open backup folder:", err);
    }
  };

  // Start Restore Flow: Validate backup file first
  const handleInitiateRestore = async (backup: BackupRecord) => {
    setSelectedBackupForRestore(backup);
    setIsValidatingRestore(true);
    setShowRestoreModal(true);
    setConfirmRestoreAcknowledged(false);
    setRestoreValidation(null);

    try {
      const val = await backupService.validateBackup(backup.filePath);
      setRestoreValidation(val);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setRestoreValidation({
        isValid: false,
        error: `Validation error: ${msg}`,
      });
    } finally {
      setIsValidatingRestore(false);
    }
  };

  // Perform Confirmed Restore
  const handleExecuteRestore = async () => {
    if (!selectedBackupForRestore || !restoreValidation?.isValid) return;

    setIsRestoring(true);
    try {
      const result = await backupService.restoreBackup(
        selectedBackupForRestore.filePath
      );
      if (result.success) {
        setShowRestoreModal(false);
        setRestoreSuccessNotice({
          message: result.message,
          preRestoreFile: result.preRestoreFile,
        });
      } else {
        setStatusMessage({
          type: "error",
          text: `Restore failed: ${result.message}`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({
        type: "error",
        text: `Restore failed: ${msg}`,
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // Handle Restore Success Complete: Purge session and redirect
  const handleAcknowledgeRestoreSuccess = () => {
    setRestoreSuccessNotice(null);
    if (onRestoreSuccess) {
      onRestoreSuccess();
    } else {
      // Clear session and reload to force login
      try {
        localStorage.removeItem("im_medicos_auth_token");
        sessionStorage.clear();
      } catch {
        // Ignore
      }
      window.location.reload();
    }
  };

  // Handle Delete Backup
  const handleExecuteDelete = async () => {
    if (!backupToDelete) return;
    setIsDeleting(true);
    try {
      await backupService.deleteBackup(backupToDelete.filePath);
      setBackupToDelete(null);
      setStatusMessage({
        type: "success",
        text: `Deleted backup file: ${backupToDelete.fileName}`,
      });
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage({
        type: "error",
        text: `Failed to delete backup: ${msg}`,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 bg-medical-slate-50 min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Title & Subtitle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-medical-slate-200">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-medical-navy-900 text-white shadow-md">
                <DatabaseBackup className="h-6 w-6 text-medical-green-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-medical-navy-900 tracking-tight">
                  Backup & Restore
                </h1>
                <p className="text-sm text-medical-slate-500 font-medium">
                  Protect your pharmacy data.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-medical-slate-600 bg-white border border-medical-slate-300 rounded-lg hover:bg-medical-slate-50 active:bg-medical-slate-100 transition shadow-sm"
              title="Refresh backup status and archives"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* Global Feedback Alert */}
        {statusMessage && (
          <div
            className={`p-4 rounded-xl border flex items-start justify-between gap-3 shadow-sm ${
              statusMessage.type === "success"
                ? "bg-medical-green-50 border-medical-green-300 text-medical-green-900"
                : statusMessage.type === "error"
                ? "bg-red-50 border-red-300 text-red-900"
                : "bg-blue-50 border-blue-300 text-blue-900"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-medical-green-600 shrink-0" />
              ) : statusMessage.type === "error" ? (
                <XCircle className="h-5 w-5 text-red-600 shrink-0" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0" />
              )}
              <span className="text-sm font-semibold">
                {statusMessage.text}
              </span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-medical-slate-400 hover:text-medical-slate-600 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* TOP STATUS CARD */}
        <div className="bg-white rounded-2xl border border-medical-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-xl ${
                  isBackupStale()
                    ? "bg-amber-100 text-amber-700"
                    : "bg-medical-green-100 text-medical-green-700"
                }`}
              >
                {isBackupStale() ? (
                  <AlertTriangle className="h-6 w-6" />
                ) : (
                  <ShieldCheck className="h-6 w-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-medical-navy-900">
                    Backup Health Status
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                      isBackupStale()
                        ? "bg-amber-100 text-amber-800 border border-amber-300"
                        : "bg-medical-green-100 text-medical-green-800 border border-medical-green-300"
                    }`}
                  >
                    {isBackupStale() ? "Action Needed" : "Protected"}
                  </span>
                </div>
                <p className="text-xs text-medical-slate-500">
                  {isBackupStale()
                    ? "Your database is vulnerable without a recent verified backup archive."
                    : "Verified snapshots protect your business data against workstation or disk failure."}
                </p>
              </div>
            </div>

            {/* Quick stats in status card */}
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div>
                <span className="block text-xs font-medium text-medical-slate-500 uppercase">
                  Last Backup Date
                </span>
                <span className="font-bold text-medical-navy-900 tabular-nums">
                  {formatDateDisplay(settings.lastBackupTime)}
                </span>
              </div>
              <div className="border-l border-medical-slate-200 pl-6">
                <span className="block text-xs font-medium text-medical-slate-500 uppercase">
                  Archive Size
                </span>
                <span className="font-bold text-medical-navy-900 tabular-nums">
                  {formatBytes(settings.lastBackupSize)}
                </span>
              </div>
              <div className="border-l border-medical-slate-200 pl-6">
                <span className="block text-xs font-medium text-medical-slate-500 uppercase">
                  Last Result
                </span>
                <span
                  className={`inline-flex items-center gap-1 font-bold text-xs ${
                    settings.lastBackupStatus === "SUCCESS"
                      ? "text-medical-green-600"
                      : settings.lastBackupStatus === "FAILED"
                      ? "text-red-600"
                      : "text-medical-slate-500"
                  }`}
                >
                  {settings.lastBackupStatus === "SUCCESS" && (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  {settings.lastBackupStatus === "FAILED" && (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  {settings.lastBackupStatus || "NONE"}
                </span>
              </div>
            </div>
          </div>

          {/* Amber warning banner if backup is older than 7 days or never backed up */}
          {isBackupStale() && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <span className="text-sm font-bold">
                  No recent backup. Back up now to protect your data.
                </span>
              </div>
              <button
                onClick={handleBackupNow}
                disabled={isBackingUp}
                className="px-3.5 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 active:bg-amber-800 transition shadow-sm shrink-0"
              >
                {isBackingUp ? "Backing up..." : "Back Up Now"}
              </button>
            </div>
          )}
        </div>

        {/* THREE ACTION CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* CARD 1: BACKUP NOW */}
          <div className="bg-white rounded-2xl border border-medical-slate-200 shadow-sm p-6 flex flex-col justify-between space-y-4 hover:border-medical-navy-300 transition">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-medical-navy-900 text-white flex items-center justify-center shadow-md">
                <HardDrive className="h-6 w-6 text-medical-green-400" />
              </div>
              <h3 className="text-lg font-bold text-medical-navy-900">
                Backup Now
              </h3>
              <p className="text-xs text-medical-slate-600 leading-relaxed">
                Create a complete, verified snapshot of your pharmacy SQLite
                database and store logos in a secure, self-contained ZIP archive.
              </p>
              <div className="pt-2 text-xs text-medical-slate-500 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Current Bills:</span>
                  <span className="font-semibold tabular-nums text-medical-navy-900">
                    {currentCounts.bills}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Active Medicines:</span>
                  <span className="font-semibold tabular-nums text-medical-navy-900">
                    {currentCounts.medicines}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Customers:</span>
                  <span className="font-semibold tabular-nums text-medical-navy-900">
                    {currentCounts.customers}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleBackupNow}
              disabled={isBackingUp}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-medical-navy-900 text-white font-bold text-sm hover:bg-medical-navy-800 active:bg-medical-navy-950 transition shadow-md disabled:opacity-60"
            >
              {isBackingUp ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-medical-green-400" />
                  Generating Snapshot...
                </>
              ) : (
                <>
                  <DatabaseBackup className="h-4 w-4 text-medical-green-400" />
                  Create Backup Now
                </>
              )}
            </button>
          </div>

          {/* CARD 2: RESTORE FROM BACKUP */}
          <div className="bg-white rounded-2xl border border-medical-slate-200 shadow-sm p-6 flex flex-col justify-between space-y-4 hover:border-amber-300 transition">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md">
                <RotateCcw className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-medical-navy-900">
                Restore from Backup
              </h3>
              <p className="text-xs text-medical-slate-600 leading-relaxed">
                Restore pharmacy data from a verified backup archive.
              </p>
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium space-y-1">
                <span className="font-bold flex items-center gap-1 text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Warning: Data Replacement
                </span>
                <p className="text-[11px] leading-tight">
                  Restoring will replace the active database. An automatic
                  safety Pre-restore snapshot is saved before applying.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                if (backups.length > 0) {
                  handleInitiateRestore(backups[0]);
                } else {
                  setStatusMessage({
                    type: "info",
                    text: "Please place a backup archive into the backup folder or select one below.",
                  });
                }
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 text-white font-bold text-sm hover:bg-amber-700 active:bg-amber-800 transition shadow-md"
            >
              <RotateCcw className="h-4 w-4" />
              {backups.length > 0 ? "Restore Latest Backup" : "Restore Archive"}
            </button>
          </div>

          {/* CARD 3: AUTOMATIC BACKUP SETTINGS */}
          <div className="bg-white rounded-2xl border border-medical-slate-200 shadow-sm p-6 flex flex-col justify-between space-y-4 hover:border-medical-navy-300 transition">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-medical-navy-100 text-medical-navy-800 flex items-center justify-center shadow-sm">
                <Clock className="h-6 w-6 text-medical-navy-700" />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-medical-navy-900">
                  Automatic Backup
                </h3>
                {/* Auto Backup Toggle */}
                <label
                  htmlFor={autoBackupToggleId}
                  className="relative inline-flex items-center cursor-pointer"
                >
                  <input
                    id={autoBackupToggleId}
                    type="checkbox"
                    checked={settings.autoBackupEnabled}
                    onChange={(e) =>
                      handleSaveSettings({
                        autoBackupEnabled: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                    disabled={isSavingSettings}
                  />
                  <div className="w-11 h-6 bg-medical-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-medical-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-medical-green-600"></div>
                </label>
              </div>

              <div className="text-xs space-y-2 text-medical-slate-600">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-medical-slate-700">
                    Daily Schedule:
                  </span>
                  <span
                    className={`font-bold ${
                      settings.autoBackupEnabled
                        ? "text-medical-green-600"
                        : "text-medical-slate-400"
                    }`}
                  >
                    {settings.autoBackupEnabled ? "Active (Daily)" : "Disabled"}
                  </span>
                </div>

                {/* Retention Setting */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor={retentionCountInputId}
                      className="font-medium text-medical-slate-700"
                    >
                      Retention Count:
                    </label>
                    <span className="font-bold text-medical-navy-900 tabular-nums">
                      {settings.retentionCount} backups
                    </span>
                  </div>
                  <input
                    id={retentionCountInputId}
                    type="range"
                    min="1"
                    max="30"
                    value={settings.retentionCount}
                    onChange={(e) =>
                      handleSaveSettings({
                        retentionCount: parseInt(e.target.value, 10) || 7,
                      })
                    }
                    className="w-full h-1.5 bg-medical-slate-200 rounded-lg appearance-none cursor-pointer accent-medical-navy-900"
                  />
                  <span className="text-[10px] text-medical-slate-400 block">
                    Keeps newest {settings.retentionCount} automatic backups;
                    older auto copies are pruned safely.
                  </span>
                </div>

                {/* Backup Folder Display */}
                <div className="space-y-1 pt-1">
                  <label
                    htmlFor={folderPathInputId}
                    className="font-medium text-medical-slate-700 block"
                  >
                    Backup Folder:
                  </label>
                  <p
                    id={folderPathInputId}
                    className="text-[11px] font-mono text-medical-slate-700 truncate bg-medical-slate-100 p-1.5 rounded-lg border border-medical-slate-200"
                    title={settings.backupFolder}
                  >
                    {settings.backupFolder}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  setNewFolderPath(settings.backupFolder);
                  setShowFolderModal(true);
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-medical-slate-300 text-medical-slate-700 font-semibold text-xs hover:bg-medical-slate-50 transition shadow-sm"
              >
                <FolderEdit className="h-3.5 w-3.5 text-medical-slate-500" />
                Change Folder
              </button>
              <button
                onClick={handleOpenFolder}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-medical-slate-100 border border-medical-slate-200 text-medical-navy-900 font-semibold text-xs hover:bg-medical-slate-200 transition shadow-sm"
                title="Open in Windows Explorer"
              >
                <FolderOpen className="h-3.5 w-3.5 text-medical-navy-700" />
                Open
              </button>
            </div>
          </div>
        </div>

        {/* EXISTING BACKUPS TABLE */}
        <div className="bg-white rounded-2xl border border-medical-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-medical-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-medical-navy-900 flex items-center gap-2">
                <FileArchive className="h-5 w-5 text-medical-green-600" />
                Backup Archives
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-medical-slate-100 text-medical-slate-700 tabular-nums">
                  {backups.length}
                </span>
              </h2>
              <p className="text-xs text-medical-slate-500">
                Archives located in{" "}
                <span className="font-mono">{settings.backupFolder}</span>
              </p>
            </div>

            <button
              onClick={handleOpenFolder}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-medical-slate-700 bg-white border border-medical-slate-300 hover:bg-medical-slate-50 shadow-sm"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Open Folder in Explorer
            </button>
          </div>

          {backups.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-medical-slate-100 text-medical-slate-400 flex items-center justify-center">
                <FileArchive className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-medical-slate-700">
                No backup archives found
              </h4>
              <p className="text-xs text-medical-slate-500 max-w-sm mx-auto">
                No backup ZIP files were detected in your configured folder.
                Click &quot;Create Backup Now&quot; above to safeguard your pharmacy
                database.
              </p>
              <button
                onClick={handleBackupNow}
                disabled={isBackingUp}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-medical-navy-900 text-white font-bold text-xs hover:bg-medical-navy-800 transition shadow-sm"
              >
                <DatabaseBackup className="h-4 w-4 text-medical-green-400" />
                Create First Backup
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-medical-slate-100/75 border-b border-medical-slate-200 text-[11px] font-bold text-medical-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">File Name</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-medical-slate-100 text-xs">
                  {backups.map((b) => (
                    <tr
                      key={b.filePath}
                      className="hover:bg-medical-slate-50/70 transition"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-medical-navy-900 truncate max-w-xs">
                        <div className="flex items-center gap-2">
                          <FileArchive className="h-4 w-4 text-medical-slate-400 shrink-0" />
                          <span title={b.fileName}>{b.fileName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-medical-slate-600 tabular-nums">
                        {formatDateDisplay(b.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-medical-slate-600 tabular-nums font-medium">
                        {formatBytes(b.sizeBytes)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                            b.backupType === "Auto"
                              ? "bg-teal-50 text-teal-700 border border-teal-200"
                              : b.backupType === "Pre-restore"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-medical-navy-50 text-medical-navy-700 border border-medical-navy-200"
                          }`}
                        >
                          {b.backupType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleInitiateRestore(b)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-medical-navy-900 text-white font-semibold text-xs hover:bg-medical-navy-800 transition shadow-sm"
                          title="Restore data from this archive"
                        >
                          <RotateCcw className="h-3 w-3 text-medical-green-400" />
                          Restore
                        </button>
                        <button
                          onClick={() => setBackupToDelete(b)}
                          className="inline-flex items-center gap-1 p-1 rounded-lg text-medical-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                          title="Delete this backup archive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* USER GUIDANCE NOTES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-medical-navy-900 text-white p-4 rounded-xl border border-medical-navy-800 shadow-sm flex items-start gap-3">
            <HardDrive className="h-5 w-5 text-medical-green-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-bold text-white block">
                Copy Backups Regularly
              </span>
              <p className="text-medical-slate-300">
                Copy your backups to a pen drive or another computer regularly
                to ensure you can recover data even if this workstation experiences
                hardware failure.
              </p>
            </div>
          </div>

          <div className="bg-medical-navy-900 text-white p-4 rounded-xl border border-medical-navy-800 shadow-sm flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-medical-green-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-bold text-white block">
                Data Privacy &amp; Security
              </span>
              <p className="text-medical-slate-300">
                Backups contain customer and sales data. Keep them in a safe place and restrict unauthorized access.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RESTORE CONFIRMATION MODAL */}
      {showRestoreModal && selectedBackupForRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-medical-navy-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-medical-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-medical-slate-200 bg-amber-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500 text-white shadow-md">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-medical-navy-900">
                    Confirm Data Restore
                  </h3>
                  <p className="text-xs text-amber-900 font-medium">
                    Critical verification before replacing active data
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isRestoring) setShowRestoreModal(false);
                }}
                disabled={isRestoring}
                className="text-medical-slate-400 hover:text-medical-slate-600 p-1.5 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {isValidatingRestore ? (
                <div className="py-12 text-center space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-medical-navy-900 mx-auto" />
                  <p className="text-sm font-semibold text-medical-navy-900">
                    Validating backup archive integrity...
                  </p>
                  <p className="text-xs text-medical-slate-500">
                    Checking zip structure, SHA-256 checksums, and SQLite
                    database integrity.
                  </p>
                </div>
              ) : restoreValidation && !restoreValidation.isValid ? (
                <div className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-red-800">
                    <XCircle className="h-5 w-5 text-red-600" />
                    Validation Failed: Cannot Restore
                  </div>
                  <p className="text-xs">
                    {restoreValidation.error ||
                      "Archive integrity or checksum mismatch detected."}
                  </p>
                </div>
              ) : (
                <>
                  {/* Warning Notice */}
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      RESTORING WILL OVERWRITE ALL CURRENT DATA!
                    </div>
                    <p className="text-xs text-red-800">
                      All active bills, customer records, and inventory in the
                      current database will be replaced by the contents of this
                      backup archive.
                    </p>
                    <p className="text-xs text-medical-slate-700 pt-1 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-medical-green-600" />
                      A safety Pre-restore backup will be created automatically
                      first.
                    </p>
                  </div>

                  {/* Comparison Table */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-medical-navy-900 uppercase tracking-wider">
                      Data Comparison: Current Live vs. Backup Archive
                    </h4>
                    <div className="border border-medical-slate-200 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-medical-slate-100 font-bold text-medical-slate-700 border-b border-medical-slate-200">
                            <th className="py-2.5 px-3">Category</th>
                            <th className="py-2.5 px-3">Current Active</th>
                            <th className="py-2.5 px-3 text-medical-navy-900 font-bold">
                              Restoring From Backup
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-medical-slate-100">
                          <tr>
                            <td className="py-2 px-3 font-semibold text-medical-slate-600">
                              Archive Date
                            </td>
                            <td className="py-2 px-3 text-medical-slate-500">
                              Live (Now)
                            </td>
                            <td className="py-2 px-3 font-bold text-medical-navy-900">
                              {restoreValidation?.manifest?.createdAt ||
                                selectedBackupForRestore.createdAt}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-semibold text-medical-slate-600">
                              Bills Count
                            </td>
                            <td className="py-2 px-3 tabular-nums">
                              {currentCounts.bills}
                            </td>
                            <td className="py-2 px-3 font-bold text-medical-navy-900 tabular-nums">
                              {restoreValidation?.manifest?.counts.bills ?? "—"}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-semibold text-medical-slate-600">
                              Medicines
                            </td>
                            <td className="py-2 px-3 tabular-nums">
                              {currentCounts.medicines}
                            </td>
                            <td className="py-2 px-3 font-bold text-medical-navy-900 tabular-nums">
                              {restoreValidation?.manifest?.counts.medicines ??
                                "—"}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-semibold text-medical-slate-600">
                              Batches
                            </td>
                            <td className="py-2 px-3 tabular-nums">
                              {currentCounts.batches}
                            </td>
                            <td className="py-2 px-3 font-bold text-medical-navy-900 tabular-nums">
                              {restoreValidation?.manifest?.counts.batches ??
                                "—"}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-semibold text-medical-slate-600">
                              Unique Customers
                            </td>
                            <td className="py-2 px-3 tabular-nums">
                              {currentCounts.customers}
                            </td>
                            <td className="py-2 px-3 font-bold text-medical-navy-900 tabular-nums">
                              {restoreValidation?.manifest?.counts.customers ??
                                "—"}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-semibold text-medical-slate-600">
                              Software Version
                            </td>
                            <td className="py-2 px-3 text-medical-slate-500">
                              v0.1.0
                            </td>
                            <td className="py-2 px-3 font-bold text-medical-navy-900">
                              {restoreValidation?.manifest?.appVersion ||
                                "v0.1.0"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Safety Checkbox */}
                  <div className="pt-2">
                    <label
                      htmlFor={confirmRestoreCheckboxId}
                      className="flex items-start gap-3 p-3 rounded-xl bg-medical-slate-50 border border-medical-slate-200 cursor-pointer hover:bg-medical-slate-100 transition"
                    >
                      <input
                        id={confirmRestoreCheckboxId}
                        type="checkbox"
                        checked={confirmRestoreAcknowledged}
                        onChange={(e) =>
                          setConfirmRestoreAcknowledged(e.target.checked)
                        }
                        className="mt-0.5 rounded border-medical-slate-300 text-medical-navy-900 focus:ring-medical-navy-900"
                        disabled={isRestoring}
                      />
                      <span className="text-xs font-semibold text-medical-navy-900">
                        I understand that active pharmacy data will be replaced
                        with this backup archive.
                      </span>
                    </label>
                  </div>
                </>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-medical-slate-200 bg-medical-slate-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowRestoreModal(false)}
                disabled={isRestoring}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-medical-slate-700 bg-white border border-medical-slate-300 hover:bg-medical-slate-100 transition shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRestore}
                disabled={
                  !restoreValidation?.isValid ||
                  !confirmRestoreAcknowledged ||
                  isRestoring
                }
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Restoring Data...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    Yes, Replace All Data
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESTORE SUCCESS MODAL */}
      {restoreSuccessNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-medical-navy-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-medical-slate-200 shadow-2xl p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-medical-green-100 text-medical-green-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-medical-navy-900">
                Restore Complete
              </h3>
              <p className="text-xs text-medical-slate-600">
                {restoreSuccessNotice.message}
              </p>
              {restoreSuccessNotice.preRestoreFile && (
                <p className="text-[11px] text-medical-slate-500 pt-1 font-mono">
                  Safety backup saved: {restoreSuccessNotice.preRestoreFile}
                </p>
              )}
            </div>
            <button
              onClick={handleAcknowledgeRestoreSuccess}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-medical-navy-900 text-white font-bold text-xs hover:bg-medical-navy-800 transition shadow-md"
            >
              Continue to Login Screen
              <ArrowRight className="h-4 w-4 text-medical-green-400" />
            </button>
          </div>
        </div>
      )}

      {/* DELETE BACKUP CONFIRMATION MODAL */}
      {backupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-medical-navy-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-medical-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-100 text-red-700">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-medical-navy-900">
                  Delete Backup File?
                </h3>
                <p className="text-xs text-medical-slate-500">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p className="text-xs text-medical-slate-600 font-mono bg-medical-slate-50 p-2.5 rounded-xl border border-medical-slate-200 break-all">
              {backupToDelete.fileName}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setBackupToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-medical-slate-700 bg-white border border-medical-slate-300 hover:bg-medical-slate-100 transition shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 transition shadow-md"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete File
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE FOLDER MODAL */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-medical-navy-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-medical-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-medical-navy-100 text-medical-navy-900">
                <FolderEdit className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-medical-navy-900">
                  Set Backup Folder
                </h3>
                <p className="text-xs text-medical-slate-500">
                  Specify local destination path for archives
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="folder-path-modal-input"
                className="text-xs font-bold text-medical-slate-700"
              >
                Directory Path
              </label>
              <input
                id="folder-path-modal-input"
                type="text"
                value={newFolderPath}
                onChange={(e) => setNewFolderPath(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-medical-slate-300 focus:outline-none focus:ring-2 focus:ring-medical-navy-800"
                placeholder="C:\Users\User\Downloads\IM_MEDICOS_Backups"
              />
              <span className="text-[10px] text-medical-slate-400 block">
                The folder will be created automatically if it does not yet exist.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowFolderModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-medical-slate-700 bg-white border border-medical-slate-300 hover:bg-medical-slate-100 transition shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newFolderPath.trim()) {
                    handleSaveSettings({
                      backupFolder: newFolderPath.trim(),
                    });
                    setShowFolderModal(false);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-medical-navy-900 hover:bg-medical-navy-800 active:bg-medical-navy-950 transition shadow-md"
              >
                Save Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupRestorePage;
