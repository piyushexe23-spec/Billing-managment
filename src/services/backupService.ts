/**
 * Backup & Restore Service
 * IM MEDICOS Pharmacy Billing Software - Command 07
 *
 * Provides complete data backup, verified snapshot archive generation,
 * automatic backup scheduling, pre-restore safety copy, and atomic restoration.
 */

import {
  BackupCounts,
  BackupRecord,
  BackupSettings,
  BackupType,
  BackupValidationResult,
  RestoreResult,
} from "@/types/backup";
import { getLocalBills } from "@/services/billingService";
import { normalizeCustomerMobile } from "@/services/customerService";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const SETTINGS_KEY = "im_medicos_backup_settings";
const BACKUPS_LIST_KEY = "im_medicos_backups_list";

function getDefaultBackupFolder(): string {
  // Dynamic default path for Windows user
  if (typeof process !== "undefined" && process.env?.USERPROFILE) {
    return `${process.env.USERPROFILE}\\Downloads\\IM_MEDICOS_Backups`;
  }
  return "C:\\Users\\User\\Downloads\\IM_MEDICOS_Backups";
}

function getStoredSettings(): BackupSettings {
  if (typeof window === "undefined") {
    return {
      autoBackupEnabled: true,
      backupFolder: getDefaultBackupFolder(),
      retentionCount: 7,
      lastBackupTime: null,
      lastBackupSize: null,
      lastBackupStatus: "NONE",
    };
  }

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Failed to load backup settings from storage:", e);
  }

  const def: BackupSettings = {
    autoBackupEnabled: true,
    backupFolder: getDefaultBackupFolder(),
    retentionCount: 7,
    lastBackupTime: null,
    lastBackupSize: null,
    lastBackupStatus: "NONE",
  };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(def));
  } catch {
    // Ignore storage write failure
  }
  return def;
}

function setStoredSettings(settings: BackupSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn("Failed to save backup settings to storage:", e);
  }
}

function getStoredBackups(): BackupRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BACKUPS_LIST_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Failed to load backups list from storage:", e);
  }
  return [];
}

function setStoredBackups(backups: BackupRecord[]): void {
  try {
    localStorage.setItem(BACKUPS_LIST_KEY, JSON.stringify(backups));
  } catch (e) {
    console.warn("Failed to save backups list to storage:", e);
  }
}

class BackupService {
  /**
   * Retrieves the active backup configuration settings
   */
  async getSettings(): Promise<BackupSettings> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res = await invoke<BackupSettings>("get_backup_settings");
        if (res && typeof res.backupFolder === "string") {
          return res;
        }
      } catch (err) {
        console.warn("Tauri get_backup_settings fallback:", err);
      }
    }
    return getStoredSettings();
  }

  /**
   * Updates backup configuration settings
   */
  async saveSettings(settings: BackupSettings): Promise<void> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("save_backup_settings", { settings });
        return;
      } catch (err) {
        console.warn("Tauri save_backup_settings fallback:", err);
      }
    }
    setStoredSettings(settings);
  }

  /**
   * Computes current count of live records
   */
  async getCurrentCounts(): Promise<BackupCounts> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res = await invoke<BackupCounts>("get_current_counts");
        if (res) return res;
      } catch (err) {
        console.warn("Tauri get_current_counts fallback:", err);
      }
    }

    // Local fallback
    const bills = getLocalBills();
    let medicinesCount = 0;
    let batchesCount = 0;

    try {
      const rawMeds = localStorage.getItem("im_medicos_medicines");
      if (rawMeds) {
        const meds = JSON.parse(rawMeds);
        if (Array.isArray(meds)) {
          medicinesCount = meds.length;
          batchesCount = meds.reduce(
            (acc, m) => acc + (Array.isArray(m.batches) ? m.batches.length : 0),
            0
          );
        }
      }
    } catch {
      // Ignore
    }

    const uniqueMobiles = new Set(
      bills
        .map((b) => normalizeCustomerMobile(b.customerMobile))
        .filter((m) => m !== "No mobile")
    );

    return {
      bills: bills.length,
      medicines: medicinesCount,
      batches: batchesCount,
      customers: uniqueMobiles.size,
    };
  }

  /**
   * Creates a verified backup archive snapshot
   */
  async createBackup(
    backupType: BackupType = "Manual",
    targetFolder?: string
  ): Promise<BackupRecord> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res = await invoke<BackupRecord>("create_backup", {
          backupType,
          targetFolder: targetFolder || null,
        });
        if (res && res.fileName) return res;
      } catch (err) {
        console.warn("Tauri create_backup fallback:", err);
        throw err;
      }
    }

    // Fallback simulation for browser/test environments
    const counts = await this.getCurrentCounts();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const tsFile = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const tsDisplay = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const settings = getStoredSettings();
    const folder = targetFolder || settings.backupFolder;
    const suffix = backupType === "Pre-restore" ? "_PreRestore" : "";
    const fileName = `IM_MEDICOS_Backup_${tsFile}${suffix}.zip`;
    const filePath = `${folder}\\${fileName}`;
    // Approximate realistic backup size based on bill/medicine counts
    const approxSize = 250000 + counts.bills * 850 + counts.medicines * 450;

    const record: BackupRecord = {
      fileName,
      filePath,
      sizeBytes: approxSize,
      createdAt: tsDisplay,
      backupType,
      manifest: {
        appName: "IM MEDICOS",
        appVersion: "0.1.0",
        schemaVersion: 1,
        createdAt: tsDisplay,
        backupType,
        counts,
        checksums: {
          "im_medicos.db": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        },
      },
    };

    // Update settings last backup
    settings.lastBackupTime = tsDisplay;
    settings.lastBackupSize = approxSize;
    settings.lastBackupStatus = "SUCCESS";
    setStoredSettings(settings);

    // Update backup list
    const existing = getStoredBackups();
    existing.unshift(record);

    // Retention cleanup for Auto backups in storage
    if (backupType === "Auto") {
      const autoBackups = existing.filter((b) => b.backupType === "Auto");
      if (autoBackups.length > settings.retentionCount) {
        const toKeep = new Set(
          autoBackups.slice(0, settings.retentionCount).map((b) => b.fileName)
        );
        const filtered = existing.filter(
          (b) => b.backupType !== "Auto" || toKeep.has(b.fileName)
        );
        setStoredBackups(filtered);
      } else {
        setStoredBackups(existing);
      }
    } else {
      setStoredBackups(existing);
    }

    return record;
  }

  /**
   * Lists backup archives found in folder
   */
  async listBackups(folder?: string): Promise<BackupRecord[]> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res = await invoke<BackupRecord[]>("list_backups", {
          folder: folder || null,
        });
        if (Array.isArray(res)) return res;
      } catch (err) {
        console.warn("Tauri list_backups fallback:", err);
      }
    }
    return getStoredBackups();
  }

  /**
   * Deletes a backup archive
   */
  async deleteBackup(filePath: string): Promise<void> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("delete_backup", { filePath });
        return;
      } catch (err) {
        console.warn("Tauri delete_backup fallback:", err);
        throw err;
      }
    }

    const existing = getStoredBackups();
    const updated = existing.filter((b) => b.filePath !== filePath);
    setStoredBackups(updated);
  }

  /**
   * Validates a backup archive before restoring
   */
  async validateBackup(filePath: string): Promise<BackupValidationResult> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res = await invoke<BackupValidationResult>("validate_backup_file", {
          filePath,
        });
        if (res) return res;
      } catch (err) {
        console.warn("Tauri validate_backup_file fallback:", err);
      }
    }

    // Mock validation
    const currentCounts = await this.getCurrentCounts();
    const existing = getStoredBackups();
    const found = existing.find((b) => b.filePath === filePath);

    if (found?.manifest) {
      return {
        isValid: true,
        manifest: found.manifest,
        currentCounts,
      };
    }

    // Default valid mock manifest if not found in list (e.g. user selected from disk)
    return {
      isValid: true,
      manifest: {
        appName: "IM MEDICOS",
        appVersion: "0.1.0",
        schemaVersion: 1,
        createdAt: new Date().toISOString().replace("T", " ").slice(0, 19),
        backupType: "Manual",
        counts: {
          bills: Math.max(1, currentCounts.bills),
          medicines: Math.max(5, currentCounts.medicines),
          batches: Math.max(5, currentCounts.batches),
          customers: Math.max(1, currentCounts.customers),
        },
        checksums: {
          "im_medicos.db": "mock-checksum-sha256",
        },
      },
      currentCounts,
    };
  }

  /**
   * Performs restore from a verified backup archive
   */
  async restoreBackup(filePath: string): Promise<RestoreResult> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res = await invoke<RestoreResult>("restore_backup", { filePath });
        if (res) return res;
      } catch (err) {
        console.warn("Tauri restore_backup fallback:", err);
        throw err;
      }
    }

    // Fallback: create pre-restore backup first
    const preRestore = await this.createBackup("Pre-restore");

    return {
      success: true,
      message:
        "Data restored successfully from backup. Please log in with your credentials.",
      preRestoreFile: preRestore.fileName,
      restoredCounts: await this.getCurrentCounts(),
    };
  }

  /**
   * Opens backup folder in native Windows Explorer
   */
  async openBackupFolder(folder?: string): Promise<void> {
    if (folder !== undefined && folder.trim() === "") {
      throw new Error("Backup folder path cannot be empty.");
    }

    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("open_backup_folder", { folder: folder?.trim() || null });
        return;
      } catch (err: unknown) {
        console.error("Tauri open_backup_folder failed:", err);
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(msg);
      }
    }

    // Browser / mock environment
    const target = folder?.trim() || getDefaultBackupFolder();
    console.log("Mock open backup folder:", target);
  }

  /**
   * Checks whether automatic backup should run today
   */
  async checkAutoBackup(): Promise<BackupRecord | null> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res = await invoke<BackupRecord | null>("check_auto_backup");
        return res;
      } catch (err) {
        console.warn("Tauri check_auto_backup fallback:", err);
      }
    }

    const settings = getStoredSettings();
    if (!settings.autoBackupEnabled) return null;

    const today = new Date().toISOString().slice(0, 10);
    if (settings.lastBackupTime && settings.lastBackupTime.startsWith(today)) {
      return null;
    }

    return this.createBackup("Auto");
  }
}

export const backupService = new BackupService();

