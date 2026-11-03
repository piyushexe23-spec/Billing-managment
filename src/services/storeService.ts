import { StoreDetails } from "@/types/store";
import { validateStoreDetails } from "@/lib/validations";

const STORAGE_KEY = "im_medicos_store_details_singleton_v1";

export const DEFAULT_STORE_DETAILS: StoreDetails = {
  id: 1,
  storeName: "IM MEDICOS PHARMACY",
  address: "Shop No. 4, Medical Market, Main Hospital Road, New Delhi, 110001",
  phone: "+91 98765 43210",
  email: "contact@immedicos.com",
  gstin: "07AAAAA0000A1Z5",
  drugLicense1: "DL-20B/12345/2024",
  drugLicense2: "DL-21B/12346/2024",
  ownerName: "Dr. Ramesh Kumar",
  pharmacistName: "Suresh Sharma, B.Pharm",
  pharmacistRegNo: "REG-DL-987654",
  billPrefix: "IM",
  startingBillNumber: 1,
  showGstinOnInvoice: true,
  showAmountInWords: true,
  footerTerms:
    "1. Goods once sold will not be taken back without original cash memo.\n2. Prescribed medicines sold only on registered medical prescription.\n3. Keep medicines in a cool, dry place away from sunlight.",
  bankName: "State Bank of India",
  accountHolderName: "IM MEDICOS PHARMACY",
  accountNumber: "30987654321",
  ifscCode: "SBIN0001234",
  upiId: "immedicos@sbi",
  lowStockThreshold: 10,
  logoPath: null,
  logoDataUrl: null,
};

function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export const storeService = {
  /**
   * Fetches the singleton store details record
   */
  async getStoreDetails(): Promise<StoreDetails> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const details = await invoke<StoreDetails | null>("get_store_details");
        if (details) {
          // Sync with local cache mirror for offline resilience
          localStorage.setItem(STORAGE_KEY, JSON.stringify(details));
          return details;
        }
      } catch (err) {
        console.warn("Tauri get_store_details invocation fallback:", err);
      }
    }

    // Fallback: Local persistent storage mirror
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_STORE_DETAILS, ...parsed, id: 1 };
      }
    } catch {
      // Ignored
    }

    // Initialize with default store configuration
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_STORE_DETAILS));
    return { ...DEFAULT_STORE_DETAILS };
  },

  /**
   * Validates and persists store details
   */
  async saveStoreDetails(data: StoreDetails): Promise<StoreDetails> {
    const validation = validateStoreDetails(data);
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0] || "Validation failed";
      throw new Error(firstError);
    }

    const payload: StoreDetails = {
      ...data,
      id: 1, // Enforce singleton constraint
      updatedAt: new Date().toISOString(),
    };

    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("save_store_details", { details: payload });
      } catch (err) {
        console.error("Tauri save_store_details failed:", err);
        throw new Error(
          err instanceof Error ? err.message : "Failed to persist store details to SQLite"
        );
      }
    }

    // Always mirror to local storage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return payload;
  },

  /**
   * Validates and processes a logo upload file
   */
  async processLogoFile(
    file: File
  ): Promise<{ logoPath: string; logoDataUrl: string }> {
    const validTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      throw new Error("Only PNG, JPG, or JPEG images are accepted.");
    }

    const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_SIZE_BYTES) {
      throw new Error("Logo image size must be under 2 MB.");
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read image file"));
      reader.readAsDataURL(file);
    });

    let relativePath = `logos/pharmacy_logo.${extension}`;

    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const arrayBuffer = await file.arrayBuffer();
        const bytes = Array.from(new Uint8Array(arrayBuffer));
        relativePath = await invoke<string>("save_store_logo", {
          bytes,
          extension,
        });
      } catch (err) {
        console.warn("Tauri save_store_logo fallback to relative path:", err);
      }
    }

    return {
      logoPath: relativePath,
      logoDataUrl: dataUrl,
    };
  },

  /**
   * Removes the active logo from storage and local directory
   */
  async removeLogo(): Promise<void> {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("remove_store_logo");
      } catch (err) {
        console.warn("Tauri remove_store_logo error:", err);
      }
    }
  },
};

