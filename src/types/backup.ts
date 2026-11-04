/**
 * Backup & Restore Types
 * IM MEDICOS Pharmacy Billing Software - Command 07
 */

export type BackupType = "Manual" | "Auto" | "Pre-restore";
export type BackupStatus = "SUCCESS" | "FAILED" | "NONE";

export interface BackupCounts {
  bills: number;
  medicines: number;
  batches: number;
  customers: number;
}

export interface BackupSettings {
  autoBackupEnabled: boolean;
  backupFolder: string;
  retentionCount: number;
  lastBackupTime: string | null;
  lastBackupSize: number | null;
  lastBackupStatus: BackupStatus;
  updatedAt?: string;
}

export interface BackupManifest {
  appName: string;
  appVersion: string;
  schemaVersion: number;
  createdAt: string;
  backupType: BackupType;
  counts: BackupCounts;
  checksums: Record<string, string>;
}

export interface BackupRecord {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  createdAt: string;
  backupType: BackupType;
  manifest?: BackupManifest;
}

export interface BackupValidationResult {
  isValid: boolean;
  error?: string;
  manifest?: BackupManifest;
  currentCounts?: BackupCounts;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  preRestoreFile?: string;
  restoredCounts?: BackupCounts;
}

