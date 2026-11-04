/**
 * Customer Service
 * IM MEDICOS Pharmacy Billing Software - Command 06
 *
 * Derives customers and customer purchase histories from immutable saved bills.
 */

import {
  CustomerDetailResult,
  CustomerFilterInput,
  CustomerListItem,
  CustomersSummary,
  PaginatedCustomersResult,
} from "@/types/customer";
import { getLocalBills } from "@/services/billingService";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function normalizeCustomerMobile(mob: string): string {
  const trimmed = (mob || "").trim();
  if (!trimmed) return "No mobile";
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits || "No mobile";
}

class CustomerService {
  /**
   * Retrieves paginated customers derived from saved bills matching filters
   */
  async getCustomers(
    filter: CustomerFilterInput = {}
  ): Promise<PaginatedCustomersResult> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res = await invoke<PaginatedCustomersResult>("get_customers", {
          filter,
        });
        if (res && Array.isArray(res.customers)) return res;
      } catch (err) {
        console.warn("Tauri get_customers fallback:", err);
      }
    }

    // LocalStorage fallback for tests and browser environments
    const allBills = getLocalBills();

    // Group bills by normalized mobile
    const groups = new Map<string, typeof allBills>();
    for (const bill of allBills) {
      const normMob = normalizeCustomerMobile(bill.customerMobile);
      if (!groups.has(normMob)) {
        groups.set(normMob, []);
      }
      groups.get(normMob)!.push(bill);
    }

    const fromDate = filter.fromDate?.trim() || null;
    const toDate = filter.toDate?.trim() || null;

    const customerList: CustomerListItem[] = [];

    for (const [mob, bills] of groups.entries()) {
      // Sort bills by ID ascending so last item is most recent
      const sortedBills = [...bills].sort((a, b) => a.id - b.id);
      const latestBill = sortedBills[sortedBills.length - 1];

      const rawDisplayName = latestBill?.customerName?.trim() || "";
      const displayName = rawDisplayName || (mob === "No mobile" ? "Walk-in Customer" : "Customer");

      // Unique alternative names
      const allNames = Array.from(
        new Set(
          sortedBills
            .map((b) => b.customerName?.trim())
            .filter((n): n is string => Boolean(n && n.length > 0))
        )
      );
      const otherNames = allNames.filter((n) => n !== displayName);

      // All-time stats
      const allTimeBillsCount = bills.length;
      const allTimeTotalSpent = Number(
        bills.reduce((sum, b) => sum + (b.grandTotal || 0), 0).toFixed(2)
      );

      // Earliest visit
      const dates = bills.map((b) => b.billDate).filter(Boolean).sort();
      const firstVisit = dates[0] || "";
      const allTimeLastVisit = dates[dates.length - 1] || "";

      // Range filtering
      const rangeBills = bills.filter((b) => {
        const d = b.billDate.slice(0, 10);
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
        return true;
      });

      const rangeBillsCount = rangeBills.length;
      if (rangeBillsCount === 0) {
        // Skip customer if they have no bills in the active date range
        continue;
      }

      const rangeTotalSpent = Number(
        rangeBills.reduce((sum, b) => sum + (b.grandTotal || 0), 0).toFixed(2)
      );

      const rangeDates = rangeBills.map((b) => b.billDate).filter(Boolean).sort();
      const lastVisit = rangeDates[rangeDates.length - 1] || allTimeLastVisit;

      customerList.push({
        mobile: mob,
        displayName,
        otherNames,
        billsCount: rangeBillsCount,
        totalSpent: rangeTotalSpent,
        lastVisit,
        firstVisit,
        allTimeBillsCount,
        allTimeTotalSpent,
      });
    }

    // Apply search filter (name, partial name, mobile, partial mobile, alternative name)
    let filtered = customerList;
    if (filter.search) {
      const term = filter.search.trim().toLowerCase();
      if (term) {
        filtered = filtered.filter((c) => {
          const matchMobile = c.mobile.toLowerCase().includes(term);
          const matchName = c.displayName.toLowerCase().includes(term);
          const matchOther = c.otherNames.some((n) => n.toLowerCase().includes(term));
          return matchMobile || matchName || matchOther;
        });
      }
    }

    // Compute Summary KPIs on filtered customers
    const totalCustomers = filtered.length;
    let totalBills = 0;
    let totalSales = 0;
    let repeatCustomers = 0;

    for (const c of filtered) {
      totalBills += c.billsCount;
      totalSales += c.totalSpent;
      if (c.billsCount >= 2) {
        repeatCustomers += 1;
      }
    }

    const summary: CustomersSummary = {
      totalCustomers,
      totalBills,
      totalSales: Number(totalSales.toFixed(2)),
      repeatCustomers,
    };

    // Sort
    const sortBy = filter.sortBy || "last_visit";
    const sortOrder = filter.sortOrder || "desc";
    const mult = sortOrder === "asc" ? 1 : -1;

    filtered.sort((a, b) => {
      if (sortBy === "name") {
        return mult * a.displayName.localeCompare(b.displayName);
      }
      if (sortBy === "bills") {
        return mult * (a.billsCount - b.billsCount);
      }
      if (sortBy === "total_spent") {
        return mult * (a.totalSpent - b.totalSpent);
      }
      // default: last_visit
      const dateDiff = a.lastVisit.localeCompare(b.lastVisit);
      if (dateDiff !== 0) return mult * dateDiff;
      return mult * a.mobile.localeCompare(b.mobile);
    });

    // Pagination
    const page = Math.max(1, filter.page || 1);
    const pageSize = Math.max(1, filter.pageSize || 10);
    const offset = (page - 1) * pageSize;
    const paginated = filtered.slice(offset, offset + pageSize);

    return {
      customers: paginated,
      totalCount: totalCustomers,
      page,
      pageSize,
      summary,
    };
  }

  /**
   * Retrieves customer detail with all bills matching date range and optional bill search
   */
  async getCustomerDetail(
    mobile: string,
    fromDate?: string | null,
    toDate?: string | null,
    searchBill?: string | null
  ): Promise<CustomerDetailResult | null> {
    const cleanMobile = mobile.trim();
    if (!cleanMobile) return null;

    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res = await invoke<CustomerDetailResult | null>(
          "get_customer_detail",
          {
            mobile: cleanMobile,
            fromDate: fromDate || null,
            toDate: toDate || null,
            searchBill: searchBill || null,
          }
        );
        if (res && res.customer) return res;
      } catch (err) {
        console.warn("Tauri get_customer_detail fallback:", err);
      }
    }

    // Local fallback
    const allBills = getLocalBills();
    const customerBills = allBills.filter(
      (b) => normalizeCustomerMobile(b.customerMobile) === cleanMobile
    );

    if (customerBills.length === 0) {
      return null;
    }

    const sortedById = [...customerBills].sort((a, b) => a.id - b.id);
    const latestBill = sortedById[sortedById.length - 1];
    const rawDisplayName = latestBill?.customerName?.trim() || "";
    const displayName =
      rawDisplayName || (cleanMobile === "No mobile" ? "Walk-in Customer" : "Customer");

    const allNames = Array.from(
      new Set(
        customerBills
          .map((b) => b.customerName?.trim())
          .filter((n): n is string => Boolean(n && n.length > 0))
      )
    );
    const otherNames = allNames.filter((n) => n !== displayName);

    const dates = customerBills.map((b) => b.billDate).filter(Boolean).sort();
    const firstVisit = dates[0] || "";
    const allTimeLastVisit = dates[dates.length - 1] || "";
    const allTimeBillsCount = customerBills.length;
    const allTimeTotalSpent = Number(
      customerBills.reduce((sum, b) => sum + (b.grandTotal || 0), 0).toFixed(2)
    );

    // Range filtering on bills
    const fromStr = fromDate?.trim() || null;
    const toStr = toDate?.trim() || null;
    const searchStr = searchBill?.trim().toLowerCase() || null;

    let rangeBills = customerBills.filter((b) => {
      const d = b.billDate.slice(0, 10);
      if (fromStr && d < fromStr) return false;
      if (toStr && d > toStr) return false;
      return true;
    });

    const rangeBillsCount = rangeBills.length;
    const rangeTotalSpent = Number(
      rangeBills.reduce((sum, b) => sum + (b.grandTotal || 0), 0).toFixed(2)
    );

    const rangeDates = rangeBills.map((b) => b.billDate).filter(Boolean).sort();
    const lastVisit = rangeDates[rangeDates.length - 1] || allTimeLastVisit;

    // Optional bill number search within customer bills
    if (searchStr) {
      rangeBills = rangeBills.filter((b) =>
        b.billNumber.toLowerCase().includes(searchStr)
      );
    }

    // Sort bills newest first (billDate desc, id desc)
    rangeBills.sort((a, b) => {
      const d = b.billDate.localeCompare(a.billDate);
      if (d !== 0) return d;
      return b.id - a.id;
    });

    const customer: CustomerListItem = {
      mobile: cleanMobile,
      displayName,
      otherNames,
      billsCount: rangeBillsCount,
      totalSpent: rangeTotalSpent,
      lastVisit,
      firstVisit,
      allTimeBillsCount,
      allTimeTotalSpent,
    };

    return {
      customer,
      bills: rangeBills,
    };
  }
}

export const customerService = new CustomerService();
