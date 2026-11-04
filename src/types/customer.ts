/**
 * Customer Module Type Definitions
 * IM MEDICOS Pharmacy Billing Software - Command 06
 */

import { BillRecord } from "@/types/billing";

export interface CustomerListItem {
  mobile: string;
  displayName: string;
  otherNames: string[];
  billsCount: number;
  totalSpent: number;
  lastVisit: string;
  firstVisit: string;
  allTimeBillsCount: number;
  allTimeTotalSpent: number;
}

export interface CustomersSummary {
  totalCustomers: number;
  totalBills: number;
  totalSales: number;
  repeatCustomers: number;
}

export interface CustomerFilterInput {
  fromDate?: string | null;
  toDate?: string | null;
  search?: string | null;
  sortBy?: string | null;
  sortOrder?: "asc" | "desc" | null;
  page?: number | null;
  pageSize?: number | null;
}

export interface PaginatedCustomersResult {
  customers: CustomerListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  summary: CustomersSummary;
}

export interface CustomerDetailResult {
  customer: CustomerListItem;
  bills: BillRecord[];
}
