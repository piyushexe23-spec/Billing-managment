/**
 * Report Service & Export Utilities
 * IM MEDICOS Pharmacy Billing Software - Command 08
 */

import * as XLSX from "xlsx";
import {
  GstSummaryReportData,
  GstSummaryRow,
  ProfitReportByDateRow,
  ProfitReportByMedicineRow,
  ProfitReportData,
  SalesReportData,
  SalesReportRow,
  StockReportData,
  StockReportItem,
  StockSubView,
  TopSellingReportItem,
} from "@/types/reports";
import { getLocalBills } from "@/services/billingService";
import { medicineService } from "@/services/medicineService";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function getLocalTodayStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function get10DaysLaterStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 10);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

class ReportService {
  /**
   * Retrieves Sales Report (KPIs, daily/monthly rows, payment splits, discount splits)
   */
  async getSalesReport(
    fromDate?: string | null,
    toDate?: string | null,
    groupByMonth: boolean = false
  ): Promise<SalesReportData> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res = await invoke<SalesReportData>("get_sales_report", {
          fromDate: fromDate || null,
          toDate: toDate || null,
          groupByMonth,
        });
        if (res && res.summary) return res;
      } catch (err) {
        console.warn("Tauri get_sales_report fallback:", err);
      }
    }

    // Local storage / browser calculation fallback
    const allBills = getLocalBills().filter((b) => {
      const d = (b.billDate || "").slice(0, 10);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });

    let totalBills = allBills.length;
    let grossSales = 0;
    let totalDiscount = 0;
    let netSales = 0;
    let cashSales = 0;
    let upiSales = 0;
    let cardSales = 0;
    let cashBillsCount = 0;
    let upiBillsCount = 0;
    let cardBillsCount = 0;
    let discountedBillsCount = 0;
    let discountedBillsAmount = 0;
    let nonDiscountBillsCount = 0;
    let nonDiscountBillsAmount = 0;

    const rowMap = new Map<string, { count: number; gross: number; disc: number; net: number }>();

    for (const b of allBills) {
      grossSales += b.subTotal || 0;
      totalDiscount += b.discount || 0;
      netSales += b.grandTotal || 0;

      const payMode = (b.paymentMode || "CASH").toUpperCase();
      if (payMode === "CASH") {
        cashSales += b.grandTotal || 0;
        cashBillsCount++;
      } else if (payMode === "UPI") {
        upiSales += b.grandTotal || 0;
        upiBillsCount++;
      } else if (payMode === "CARD") {
        cardSales += b.grandTotal || 0;
        cardBillsCount++;
      }

      const isDisc = (b.discountMode || "").toUpperCase() === "DISCOUNT" || (b.discount || 0) > 0;
      if (isDisc) {
        discountedBillsCount++;
        discountedBillsAmount += b.grandTotal || 0;
      } else {
        nonDiscountBillsCount++;
        nonDiscountBillsAmount += b.grandTotal || 0;
      }

      const rawDate = (b.billDate || "").slice(0, 10);
      const period = groupByMonth ? rawDate.slice(0, 7) : rawDate;
      if (period) {
        const cur = rowMap.get(period) || { count: 0, gross: 0, disc: 0, net: 0 };
        cur.count++;
        cur.gross += b.subTotal || 0;
        cur.disc += b.discount || 0;
        cur.net += b.grandTotal || 0;
        rowMap.set(period, cur);
      }
    }

    const rows: SalesReportRow[] = Array.from(rowMap.entries())
      .map(([period, data]) => ({
        period,
        billsCount: data.count,
        grossSales: Math.round(data.gross * 100) / 100,
        discount: Math.round(data.disc * 100) / 100,
        netSales: Math.round(data.net * 100) / 100,
      }))
      .sort((a, b) => b.period.localeCompare(a.period));

    const avg = totalBills > 0 ? netSales / totalBills : 0;

    return {
      summary: {
        totalBills,
        grossSales: Math.round(grossSales * 100) / 100,
        totalDiscount: Math.round(totalDiscount * 100) / 100,
        netSales: Math.round(netSales * 100) / 100,
        averageBillValue: Math.round(avg * 100) / 100,
        cashSales: Math.round(cashSales * 100) / 100,
        upiSales: Math.round(upiSales * 100) / 100,
        cardSales: Math.round(cardSales * 100) / 100,
        cashBillsCount,
        upiBillsCount,
        cardBillsCount,
        discountedBillsCount,
        discountedBillsAmount: Math.round(discountedBillsAmount * 100) / 100,
        nonDiscountBillsCount,
        nonDiscountBillsAmount: Math.round(nonDiscountBillsAmount * 100) / 100,
      },
      rows,
    };
  }

  /**
   * Retrieves Stock Report (active units, cost/MRP values, expiring/expired, filtered batch items)
   */
  async getStockReport(
    subView: StockSubView = "ALL",
    includeArchived: boolean = false,
    search?: string
  ): Promise<StockReportData> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res = await invoke<StockReportData>("get_stock_report", {
          subView,
          includeArchived,
          search: search?.trim() || null,
        });
        if (res && res.summary) return res;
      } catch (err) {
        console.warn("Tauri get_stock_report fallback:", err);
      }
    }

    // Local storage / browser calculation fallback
    const medicines = await medicineService.getMedicines(includeArchived);
    const today = getLocalTodayStr();
    const tenDaysLater = get10DaysLaterStr();
    const threshold = 10;

    let totalActiveMedicines = 0;
    let totalStockUnits = 0;
    let stockValueCost = 0;
    let stockValueMrp = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;

    const allItems: StockReportItem[] = [];

    for (const m of medicines) {
      if (m.isActive) {
        totalActiveMedicines++;
      }

      const activeBatches = (m.batches || []).filter((b) => b.isActive);
      const totalStock = activeBatches.reduce((acc, b) => acc + (b.stockQty || 0), 0);

      if (m.isActive) {
        if (totalStock === 0) {
          outOfStockCount++;
        } else if (totalStock <= threshold) {
          lowStockCount++;
        }
      }

      for (const b of activeBatches) {
        if (m.isActive) {
          totalStockUnits += b.stockQty || 0;
          stockValueCost += (b.stockQty || 0) * (b.costPrice || 0);
          stockValueMrp += (b.stockQty || 0) * (b.mrp || 0);

          if ((b.stockQty || 0) > 0) {
            if (b.expDate < today) {
              expiredCount++;
            } else if (b.expDate <= tenDaysLater) {
              expiringSoonCount++;
            }
          }
        }

        const stockStatus =
          totalStock === 0 || (b.stockQty || 0) === 0
            ? "OUT_OF_STOCK"
            : totalStock <= threshold
            ? "LOW_STOCK"
            : "IN_STOCK";

        const expiryStatus =
          b.expDate < today
            ? "EXPIRED"
            : b.expDate <= tenDaysLater
            ? "EXPIRING_SOON"
            : "SAFE";

        allItems.push({
          id: b.id,
          medicineName: m.name,
          manufacturer: m.manufacturer || "",
          batchNumber: b.batchNumber,
          expDate: b.expDate,
          quantity: b.stockQty || 0,
          unit: m.category || "Units",
          costPrice: b.costPrice || 0,
          mrp: b.mrp || 0,
          sellingPrice: b.sellingPrice || 0,
          stockStatus,
          expiryStatus,
          isArchived: !m.isActive,
        });
      }
    }

    // Apply subView filtering
    let filtered = allItems;
    if (subView === "LOW_STOCK") {
      filtered = filtered.filter((i) => i.stockStatus === "LOW_STOCK");
    } else if (subView === "OUT_OF_STOCK") {
      filtered = filtered.filter((i) => i.stockStatus === "OUT_OF_STOCK");
    } else if (subView === "EXPIRING_SOON") {
      filtered = filtered.filter((i) => i.expiryStatus === "EXPIRING_SOON" && i.quantity > 0);
    } else if (subView === "EXPIRED") {
      filtered = filtered.filter((i) => i.expiryStatus === "EXPIRED" && i.quantity > 0);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.medicineName.toLowerCase().includes(q) ||
          i.manufacturer.toLowerCase().includes(q) ||
          i.batchNumber.toLowerCase().includes(q)
      );
    }

    filtered.sort((a, b) => a.medicineName.localeCompare(b.medicineName) || a.expDate.localeCompare(b.expDate));

    return {
      summary: {
        totalActiveMedicines,
        totalStockUnits,
        stockValueCost: Math.round(stockValueCost * 100) / 100,
        stockValueMrp: Math.round(stockValueMrp * 100) / 100,
        lowStockCount,
        outOfStockCount,
        expiringSoonCount,
        expiredCount,
      },
      items: filtered,
    };
  }

  /**
   * Retrieves Top Selling Medicines Report
   */
  async getTopSellingReport(
    fromDate?: string | null,
    toDate?: string | null,
    sortBy: "QUANTITY" | "REVENUE" = "QUANTITY",
    limit?: number
  ): Promise<TopSellingReportItem[]> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res = await invoke<TopSellingReportItem[]>("get_top_selling_report", {
          fromDate: fromDate || null,
          toDate: toDate || null,
          sortBy,
          limit: limit || null,
        });
        if (Array.isArray(res)) return res;
      } catch (err) {
        console.warn("Tauri get_top_selling_report fallback:", err);
      }
    }

    // Local storage fallback
    const allBills = getLocalBills().filter((b) => {
      const d = (b.billDate || "").slice(0, 10);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });

    const medMap = new Map<
      string,
      { name: string; mfr: string; qty: number; bills: Set<number>; revenue: number }
    >();

    for (const b of allBills) {
      for (const item of b.items || []) {
        const key = item.medicineName.trim();
        const cur = medMap.get(key) || {
          name: key,
          mfr: "",
          qty: 0,
          bills: new Set<number>(),
          revenue: 0,
        };
        cur.qty += item.quantity || 0;
        cur.bills.add(b.id);
        cur.revenue += item.amount || 0;
        medMap.set(key, cur);
      }
    }

    const items = Array.from(medMap.values()).map((val) => ({
      name: val.name,
      mfr: val.mfr,
      qtySold: val.qty,
      billsCount: val.bills.size,
      revenue: Math.round(val.revenue * 100) / 100,
    }));

    if (sortBy === "REVENUE") {
      items.sort((a, b) => b.revenue - a.revenue || b.qtySold - a.qtySold);
    } else {
      items.sort((a, b) => b.qtySold - a.qtySold || b.revenue - a.revenue);
    }

    const sliced = limit && limit > 0 ? items.slice(0, limit) : items;

    return sliced.map((item, idx) => ({
      rank: idx + 1,
      medicineName: item.name,
      manufacturer: item.mfr,
      quantitySold: item.qtySold,
      billsCount: item.billsCount,
      revenue: item.revenue,
    }));
  }

  /**
   * Retrieves Profit Report using cost price snapshots
   */
  async getProfitReport(
    fromDate?: string | null,
    toDate?: string | null,
    groupByMonth: boolean = false
  ): Promise<ProfitReportData> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res = await invoke<ProfitReportData>("get_profit_report", {
          fromDate: fromDate || null,
          toDate: toDate || null,
          groupByMonth,
        });
        if (res && res.summary) return res;
      } catch (err) {
        console.warn("Tauri get_profit_report fallback:", err);
      }
    }

    // Local storage fallback
    const allBills = getLocalBills().filter((b) => {
      const d = (b.billDate || "").slice(0, 10);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalDiscount = 0;

    const byDateMap = new Map<string, { qty: number; revenue: number; cogs: number }>();
    const byMedMap = new Map<string, { mfr: string; qty: number; revenue: number; cogs: number }>();

    for (const b of allBills) {
      totalDiscount += b.discount || 0;
      const rawDate = (b.billDate || "").slice(0, 10);
      const period = groupByMonth ? rawDate.slice(0, 7) : rawDate;

      for (const item of b.items || []) {
        const rev = item.amount || 0;
        const cogs = (item.costPrice || 0) * (item.quantity || 0);

        totalRevenue += rev;
        totalCogs += cogs;

        if (period) {
          const curD = byDateMap.get(period) || { qty: 0, revenue: 0, cogs: 0 };
          curD.qty += item.quantity || 0;
          curD.revenue += rev;
          curD.cogs += cogs;
          byDateMap.set(period, curD);
        }

        const medKey = item.medicineName.trim();
        const curM = byMedMap.get(medKey) || { mfr: "", qty: 0, revenue: 0, cogs: 0 };
        curM.qty += item.quantity || 0;
        curM.revenue += rev;
        curM.cogs += cogs;
        byMedMap.set(medKey, curM);
      }
    }

    const grossProfit = Math.round((totalRevenue - totalCogs) * 100) / 100;
    const marginPercent =
      totalRevenue > 0 ? Math.round(((grossProfit / totalRevenue) * 10000)) / 100 : 0;

    const byDate: ProfitReportByDateRow[] = Array.from(byDateMap.entries())
      .map(([period, data]) => {
        const p = Math.round((data.revenue - data.cogs) * 100) / 100;
        const m = data.revenue > 0 ? Math.round(((p / data.revenue) * 10000)) / 100 : 0;
        return {
          period,
          quantitySold: data.qty,
          revenue: Math.round(data.revenue * 100) / 100,
          cogs: Math.round(data.cogs * 100) / 100,
          grossProfit: p,
          marginPercent: m,
        };
      })
      .sort((a, b) => b.period.localeCompare(a.period));

    const byMedicine: ProfitReportByMedicineRow[] = Array.from(byMedMap.entries())
      .map(([name, data]) => {
        const p = Math.round((data.revenue - data.cogs) * 100) / 100;
        const m = data.revenue > 0 ? Math.round(((p / data.revenue) * 10000)) / 100 : 0;
        return {
          medicineName: name,
          manufacturer: data.mfr,
          quantitySold: data.qty,
          revenue: Math.round(data.revenue * 100) / 100,
          cogs: Math.round(data.cogs * 100) / 100,
          grossProfit: p,
          marginPercent: m,
        };
      })
      .sort((a, b) => b.grossProfit - a.grossProfit);

    return {
      summary: {
        revenue: Math.round(totalRevenue * 100) / 100,
        cogs: Math.round(totalCogs * 100) / 100,
        grossProfit,
        marginPercent,
        discountGiven: Math.round(totalDiscount * 100) / 100,
      },
      byDate,
      byMedicine,
    };
  }

  /**
   * Retrieves GST Summary Report (18% inclusive billing calculation)
   */
  async getGstSummaryReport(
    fromDate?: string | null,
    toDate?: string | null
  ): Promise<GstSummaryReportData> {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res = await invoke<GstSummaryReportData>("get_gst_summary_report", {
          fromDate: fromDate || null,
          toDate: toDate || null,
        });
        if (res && res.summary) return res;
      } catch (err) {
        console.warn("Tauri get_gst_summary_report fallback:", err);
      }
    }

    // Local storage fallback
    const allBills = getLocalBills().filter((b) => {
      const d = (b.billDate || "").slice(0, 10);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });

    const dayMap = new Map<string, { count: number; billed: number }>();

    for (const b of allBills) {
      const day = (b.billDate || "").slice(0, 10);
      if (day) {
        const cur = dayMap.get(day) || { count: 0, billed: 0 };
        cur.count++;
        cur.billed += b.grandTotal || 0;
        dayMap.set(day, cur);
      }
    }

    const rows: GstSummaryRow[] = Array.from(dayMap.entries())
      .map(([date, val]) => {
        const billed = Math.round(val.billed * 100) / 100;
        const totalGst = Math.round(((billed * 18) / 118) * 100) / 100;
        const cgst = Math.round((totalGst / 2) * 100) / 100;
        const sgst = Math.round((totalGst - cgst) * 100) / 100;
        const taxable = Math.round((billed - totalGst) * 100) / 100;
        return {
          date,
          billsCount: val.count,
          billedAmount: billed,
          taxableValue: taxable,
          cgst,
          sgst,
          totalGst,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    let totBilled = 0;
    let totTaxable = 0;
    let totCgst = 0;
    let totSgst = 0;
    let totGst = 0;
    let totBills = 0;

    for (const r of rows) {
      totBilled += r.billedAmount;
      totTaxable += r.taxableValue;
      totCgst += r.cgst;
      totSgst += r.sgst;
      totGst += r.totalGst;
      totBills += r.billsCount;
    }

    return {
      summary: {
        totalBilledAmount: Math.round(totBilled * 100) / 100,
        totalTaxableValue: Math.round(totTaxable * 100) / 100,
        totalCgst: Math.round(totCgst * 100) / 100,
        totalSgst: Math.round(totSgst * 100) / 100,
        totalGst: Math.round(totGst * 100) / 100,
        billsCount: totBills,
      },
      rows,
    };
  }

  // -------------------------------------------------------------
  // EXPORT UTILITIES (EXCEL & PDF)
  // -------------------------------------------------------------

  /**
   * Exports data to genuine Excel (.xlsx) with styled columns and real numbers
   */
  async exportToExcel(
    title: string,
    storeName: string,
    dateRangeText: string,
    headers: string[],
    rows: (string | number)[][],
    totalsRow: (string | number)[] | null,
    filename: string
  ): Promise<void> {
    const wb = XLSX.utils.book_new();

    const nowFormatted = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    // Build worksheet data with meta headers
    const wsData: (string | number)[][] = [
      [`IM MEDICOS - ${storeName || "Pharmacy Billing"}`],
      [title],
      [`Report Period: ${dateRangeText}`],
      [`Generated on: ${nowFormatted}`],
      [], // blank spacer
      headers,
      ...rows,
    ];

    if (totalsRow) {
      wsData.push(totalsRow);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Auto-fit column widths
    const colWidths = headers.map((h, i) => {
      let maxLen = h.length;
      for (const row of rows) {
        const val = row[i];
        if (val !== undefined && val !== null) {
          maxLen = Math.max(maxLen, String(val).length);
        }
      }
      return { wch: Math.max(maxLen + 4, 12) };
    });
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Report");

    // Save with native save picker if available, otherwise direct XLSX download
    if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
      try {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: "Excel Spreadsheet (*.xlsx)",
              accept: {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
              },
            },
          ],
        });
        const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const writable = await fileHandle.createWritable();
        await writable.write(excelBuffer);
        await writable.close();
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return; // user cancelled dialog
        }
      }
    }

    XLSX.writeFile(wb, filename);
  }

  /**
   * Generates and triggers high-fidelity printable A4 landscape HTML / PDF
   */
  async exportToPdf(
    title: string,
    storeName: string,
    dateRangeText: string,
    headers: string[],
    rows: (string | number)[][],
    totalsRow: (string | number)[] | null,
    filename: string,
    isInternal: boolean = false
  ): Promise<void> {
    const nowFormatted = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const rowsHtml = rows
      .map(
        (r) =>
          `<tr>${r
            .map((c) => {
              const isNum = typeof c === "number" || (!isNaN(Number(c)) && String(c).includes("."));
              return `<td class="${isNum ? "text-right num" : "text-left"}">${
                typeof c === "number" ? (Number.isInteger(c) ? c : c.toFixed(2)) : c
              }</td>`;
            })
            .join("")}</tr>`
      )
      .join("\n");

    const totalsHtml = totalsRow
      ? `<tr class="total-row">${totalsRow
          .map((c) => {
            const isNum = typeof c === "number" || (!isNaN(Number(c)) && String(c).includes("."));
            return `<td class="${isNum ? "text-right num" : "text-left font-bold"}">${
              typeof c === "number" ? (Number.isInteger(c) ? c : c.toFixed(2)) : c
            }</td>`;
          })
          .join("")}</tr>`
      : "";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm 12mm 12mm 12mm;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11px;
    }
    .header-bar {
      border-bottom: 2px solid #0b3a73;
      padding-bottom: 8px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .store-name {
      font-size: 18px;
      font-weight: 800;
      color: #0b3a73;
      letter-spacing: -0.2px;
    }
    .report-title {
      font-size: 15px;
      font-weight: 700;
      color: #1e293b;
      margin-top: 2px;
    }
    .meta-block {
      text-align: right;
      font-size: 10px;
      color: #64748b;
      line-height: 1.4;
    }
    .internal-badge {
      display: inline-block;
      background: #fee2e2;
      color: #991b1b;
      font-weight: 700;
      font-size: 9px;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #f87171;
      margin-left: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
    }
    th {
      background: #0b3a73;
      color: #ffffff;
      font-weight: 700;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 7px 8px;
      border: 1px solid #0b3a73;
    }
    td {
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
      font-size: 10.5px;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .total-row td {
      background: #f1f5f9 !important;
      font-weight: 800;
      border-top: 2px solid #0b3a73;
      border-bottom: 2px solid #0b3a73;
      color: #0b3a73;
    }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .num { font-variant-numeric: tabular-nums; }
    .font-bold { font-weight: 700; }
    .footer {
      margin-top: 14px;
      font-size: 9.5px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <div>
      <div class="store-name">${storeName || "IM MEDICOS"}</div>
      <div class="report-title">${title} ${isInternal ? '<span class="internal-badge">INTERNAL - DO NOT SHARE</span>' : ""}</div>
    </div>
    <div class="meta-block">
      <div><strong>Range:</strong> ${dateRangeText}</div>
      <div><strong>Generated:</strong> ${nowFormatted}</div>
      <div><strong>Software:</strong> IM MEDICOS v0.1.0</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        ${headers.map((h, i) => `<th class="${i > 1 && !h.toLowerCase().includes("name") && !h.toLowerCase().includes("status") ? "text-right" : "text-left"}">${h}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      ${totalsHtml}
    </tbody>
  </table>

  <div class="footer">
    <div>IM MEDICOS Pharmacy Billing &amp; Inventory Management System</div>
    <div>Page 1 of 1</div>
  </div>
</body>
</html>`;

    // Try save-file picker first if available
    if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
      try {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: "PDF Document (*.pdf)",
              accept: { "application/pdf": [".pdf"] },
            },
            {
              description: "HTML Printable Document (*.html)",
              accept: { "text/html": [".html"] },
            },
          ],
        });
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return;
        }
      }
    }

    // Direct printable iframe trigger fallback
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      document.body.removeChild(iframe);
      window.print();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    iframe.contentWindow?.focus();
    setTimeout(() => {
      try {
        iframe.contentWindow?.print();
      } catch (e) {
        console.warn("Iframe print error:", e);
        window.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 2000);
      }
    }, 300);
  }
}

export const reportService = new ReportService();
