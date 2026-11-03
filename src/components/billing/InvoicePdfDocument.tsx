import React, { useState, useEffect } from "react";
import { BillRecord } from "@/types/billing";
import { formatIndianCurrency, formatDisplayDate } from "@/lib/billingConfig";
import { trimImageWhitespace, formatExpiryForInvoice } from "@/lib/invoicePrintService";

interface InvoicePdfDocumentProps {
  bill: BillRecord;
}

export const InvoicePdfDocument: React.FC<InvoicePdfDocumentProps> = ({ bill }) => {
  const store = bill.storeSnapshot;

  // Resolve logo source (from bill snapshot, falling back to local storage if needed)
  let logoSrc: string | null = store.logoDataUrl || store.logoPath || null;
  if (!logoSrc && typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("im_medicos_store_details_singleton_v1");
      if (stored) {
        const parsed = JSON.parse(stored);
        logoSrc = parsed.logoDataUrl || parsed.logoPath || null;
      }
    } catch {
      // Ignored
    }
  }

  // Auto-trimmed in-memory logo state
  const [trimmedLogoSrc, setTrimmedLogoSrc] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (logoSrc) {
      trimImageWhitespace(logoSrc).then((trimmed) => {
        if (isMounted) setTrimmedLogoSrc(trimmed);
      });
    } else {
      setTrimmedLogoSrc(null);
    }
    return () => {
      isMounted = false;
    };
  }, [logoSrc]);

  // Parse terms bullets without hardcoded fallback
  const termsBullets = store.footerTerms
    ? store.footerTerms
        .split("\n")
        .map((t) => t.trim().replace(/^\d+[\.\)]\s*/, ""))
        .filter(Boolean)
    : [];

  // Formatted mobile number with +91 prefix
  const cleanedMobile = bill.customerMobile
    ? bill.customerMobile.replace(/^\+?91\s*/, "").trim()
    : "";
  const formattedMobile = cleanedMobile ? `+91 ${cleanedMobile}` : "";

  // Formatted doctor name (no underscores)
  const formattedDoctor = bill.doctorName
    ? `Dr. ${bill.doctorName.replace(/^Dr\.?\s*/i, "").trim()}`
    : "";

  // Pagination calculation: up to 18 items fit on single page with footer
  const SINGLE_PAGE_MAX = 18;
  const FIRST_PAGE_MAX_MULTI = 16;
  const MIDDLE_PAGE_MAX = 22;
  const LAST_PAGE_MAX = 16;

  interface PageData {
    pageNumber: number;
    totalPages: number;
    items: typeof bill.items;
    startIndex: number;
    isLastPage: boolean;
  }

  const pages: PageData[] = [];
  const allItems = bill.items;

  if (allItems.length <= SINGLE_PAGE_MAX) {
    pages.push({
      pageNumber: 1,
      totalPages: 1,
      items: allItems,
      startIndex: 0,
      isLastPage: true,
    });
  } else {
    let cursor = 0;
    // Page 1
    const p1Items = allItems.slice(0, FIRST_PAGE_MAX_MULTI);
    cursor = FIRST_PAGE_MAX_MULTI;
    pages.push({
      pageNumber: 1,
      totalPages: 1,
      items: p1Items,
      startIndex: 0,
      isLastPage: false,
    });

    while (cursor < allItems.length) {
      const remainingCount = allItems.length - cursor;
      if (remainingCount <= LAST_PAGE_MAX) {
        pages.push({
          pageNumber: pages.length + 1,
          totalPages: 1,
          items: allItems.slice(cursor),
          startIndex: cursor,
          isLastPage: true,
        });
        break;
      } else if (remainingCount <= MIDDLE_PAGE_MAX) {
        const take = Math.min(remainingCount - 1, LAST_PAGE_MAX);
        pages.push({
          pageNumber: pages.length + 1,
          totalPages: 1,
          items: allItems.slice(cursor, cursor + take),
          startIndex: cursor,
          isLastPage: false,
        });
        cursor += take;
      } else {
        pages.push({
          pageNumber: pages.length + 1,
          totalPages: 1,
          items: allItems.slice(cursor, cursor + MIDDLE_PAGE_MAX),
          startIndex: cursor,
          isLastPage: false,
        });
        cursor += MIDDLE_PAGE_MAX;
      }
    }

    const total = pages.length;
    pages.forEach((p) => {
      p.totalPages = total;
    });
  }

  return (
    <div className="invoice-print-container bg-white text-slate-900 font-sans print:p-0">
      {pages.map((page) => (
        <div
          key={`invoice-page-${page.pageNumber}`}
          className={`a4-page w-[210mm] max-w-[210mm] mx-auto p-[8mm] box-border bg-white border border-slate-300 print:border-none shadow-md print:shadow-none print:m-0 print:p-0 ${
            !page.isLastPage ? "print:break-after-page mb-6 print:mb-0" : ""
          }`}
          style={{ boxSizing: "border-box" }}
        >
          {/* Thin Navy Outer Page Border Container: margin 8mm guarantees never clipped */}
          <div className="page-border-container border-[1.5px] border-[#0b3a73] p-[5mm] box-border bg-white flex flex-col justify-start">
            
            {/* 1. Header with 3 Columns & Thin Vertical Dividers (38% Logo, 27% Licenses, 35% Contact) */}
            <div className="flex items-stretch justify-between pb-2.5">
              
              {/* Left Column (38%): Logo Block or Store Name (>= 4mm padding before divider) */}
              <div className="w-[calc(38%-1px)] shrink-0 pr-[4mm] flex flex-col justify-center min-h-[46px] overflow-hidden box-border">
                {logoSrc ? (
                  <div className="w-full max-w-full max-h-[18mm] h-[18mm] flex items-center justify-start overflow-hidden">
                    <img
                      src={trimmedLogoSrc || logoSrc}
                      alt={store.storeName || "Pharmacy Logo"}
                      className="max-w-full max-h-[18mm] h-auto w-auto object-contain object-left block"
                      style={{ imageRendering: "auto" }}
                    />
                  </div>
                ) : (
                  <h1 className="text-base font-black text-[#0b3a73] tracking-tight uppercase leading-tight break-words">
                    {store.storeName || "PHARMACY"}
                  </h1>
                )}
                {store.tagline && (
                  <p className="text-[9px] font-medium text-slate-500 mt-0.5 tracking-wide break-words">
                    {store.tagline}
                  </p>
                )}
              </div>

              {/* Thin Vertical Navy Divider 1 */}
              <div className="w-[1px] bg-[#0b3a73] shrink-0 self-stretch my-0.5" />

              {/* Middle Column (27%): GSTIN & Drug Licenses (3mm padding each side) */}
              <div className="w-[calc(27%-1px)] shrink-0 px-[3mm] text-[10px] space-y-1 flex flex-col justify-center box-border overflow-hidden">
                {store.showGstin && store.gstin && (
                  <div className="flex items-baseline gap-1 break-all">
                    <span className="font-bold text-[#0b3a73] shrink-0">GSTIN :</span>
                    <span className="font-semibold text-slate-800 break-all">{store.gstin}</span>
                  </div>
                )}
                {(store.drugLicense1 || store.drugLicense2) && (
                  <div className="flex items-baseline gap-1">
                    <span className="font-bold text-[#0b3a73] shrink-0">DL No. :</span>
                    <div className="font-semibold text-slate-800 leading-tight break-words flex-1 min-w-0">
                      {store.drugLicense1 && <div className="break-words">{store.drugLicense1}</div>}
                      {store.drugLicense2 && <div className="mt-0.5 break-words">{store.drugLicense2}</div>}
                    </div>
                  </div>
                )}
              </div>

              {/* Thin Vertical Navy Divider 2 */}
              <div className="w-[1px] bg-[#0b3a73] shrink-0 self-stretch my-0.5" />

              {/* Right Column (35%): Address & Phone (3mm padding left) */}
              <div className="w-[35%] shrink-0 pl-[3mm] text-[10px] space-y-1 text-slate-700 flex flex-col justify-center box-border overflow-hidden">
                {store.address && (
                  <div className="flex items-start gap-1.5">
                    {/* Location Pin SVG */}
                    <svg
                      className="w-3.5 h-3.5 text-[#0b3a73] shrink-0 mt-0.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span className="text-[9.5px] leading-tight break-words text-slate-700">{store.address}</span>
                  </div>
                )}
                {store.phone && (
                  <div className="flex items-center gap-1.5">
                    {/* Phone SVG */}
                    <svg
                      className="w-3.5 h-3.5 text-[#0b3a73] shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <span className="text-[10px] font-semibold text-slate-800 whitespace-nowrap">{store.phone}</span>
                  </div>
                )}
              </div>

            </div>

            {/* Full-Width Navy Header Underline */}
            <div className="w-full h-[2px] bg-[#0b3a73]" />

            {/* 2. Centered Rounded Navy Pill Title */}
            <div className="text-center my-2">
              <span className="inline-block bg-[#0b3a73] text-white px-6 py-1 rounded-full text-[10.5px] font-bold tracking-wider uppercase">
                TAX INVOICE / PHARMACY BILL
              </span>
            </div>

            {/* 3. Underline-Style Meta Fields (No Boxes, Same Font & Navy Color) */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px] mb-2 px-1">
              {/* Left Column: Bill No., Date, Payment Mode */}
              <div className="space-y-1.5">
                <div className="flex items-baseline">
                  <span className="font-bold text-[#0b3a73] w-28 shrink-0">Bill No. :</span>
                  <span className="border-b border-slate-400 font-bold text-slate-900 pb-0.5 grow">
                    {bill.billNumber}
                  </span>
                </div>
                <div className="flex items-baseline">
                  <span className="font-bold text-[#0b3a73] w-28 shrink-0">Date :</span>
                  <span className="border-b border-slate-400 font-semibold text-slate-800 pb-0.5 grow">
                    {formatDisplayDate(bill.billDate)}
                  </span>
                </div>
                <div className="flex items-baseline">
                  <span className="font-bold text-[#0b3a73] w-28 shrink-0">Payment Mode :</span>
                  <span className="border-b border-slate-400 font-semibold text-slate-800 pb-0.5 grow">
                    {bill.paymentMode || "CASH"}
                  </span>
                </div>
              </div>

              {/* Right Column: Patient / Customer Name, Mobile No., Doctor Name */}
              <div className="space-y-1.5">
                <div className="flex items-baseline">
                  <span className="font-bold text-[#0b3a73] w-44 shrink-0">
                    Patient / Customer Name :
                  </span>
                  <span className="border-b border-slate-400 font-bold text-slate-900 pb-0.5 grow">
                    {bill.customerName}
                  </span>
                </div>
                <div className="flex items-baseline">
                  <span className="font-bold text-[#0b3a73] w-44 shrink-0">
                    Mobile No. :
                  </span>
                  <span className="border-b border-slate-400 font-semibold text-slate-800 pb-0.5 grow inline-block min-h-[16px]">
                    {formattedMobile || "\u00A0"}
                  </span>
                </div>
                <div className="flex items-baseline">
                  <span className="font-bold text-[#0b3a73] w-44 shrink-0">
                    Doctor Name :
                  </span>
                  <span className="border-b border-slate-400 text-slate-800 pb-0.5 grow font-medium inline-block min-h-[16px]">
                    {formattedDoctor || "\u00A0"}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Bill Items Table (Thin Grey Grid Lines, Sans-Serif, Only Actual Items) */}
            <table className="w-full border-collapse border border-slate-300 text-[10.5px]">
              <thead>
                <tr className="bg-[#0b3a73] text-white font-bold">
                  <th className="py-1 px-1.5 border border-slate-300 text-center w-8">S.No.</th>
                  <th className="py-1 px-2 border border-slate-300 text-left">Medicine Name</th>
                  <th className="py-1 px-1.5 border border-slate-300 text-left w-24">Batch No.</th>
                  <th className="py-1 px-1.5 border border-slate-300 text-center w-16">Expiry</th>
                  <th className="py-1 px-1.5 border border-slate-300 text-center w-10">Qty.</th>
                  <th className="py-1 px-1.5 border border-slate-300 text-right w-16">MRP (Rs)</th>
                  <th className="py-1 px-1.5 border border-slate-300 text-right w-16">Rate (Rs)</th>
                  <th className="py-1 px-1.5 border border-slate-300 text-right w-20">Amount (Rs)</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((it, idx) => {
                  const sNo = page.startIndex + idx + 1;
                  return (
                    <tr key={`item-${it.id || idx}`} className="border-b border-slate-200">
                      <td className="py-1 px-1.5 border border-slate-300 text-center text-slate-700">
                        {sNo}
                      </td>
                      <td className="py-1 px-2 border border-slate-300 font-semibold text-slate-900">
                        {it.medicineName}
                        {it.unit ? ` (${it.unit})` : ""}
                      </td>
                      <td className="py-1 px-1.5 border border-slate-300 text-slate-800">
                        {it.batchNumber}
                      </td>
                      <td className="py-1 px-1.5 border border-slate-300 text-center text-slate-800">
                        {formatExpiryForInvoice(it.expDate)}
                      </td>
                      <td className="py-1 px-1.5 border border-slate-300 text-center font-bold text-slate-900">
                        {it.quantity}
                      </td>
                      <td className="py-1 px-1.5 border border-slate-300 text-right text-slate-700">
                        {it.mrp.toFixed(2)}
                      </td>
                      <td className="py-1 px-1.5 border border-slate-300 text-right text-slate-800 font-medium">
                        {it.rate.toFixed(2)}
                      </td>
                      <td className="py-1 px-1.5 border border-slate-300 text-right font-bold text-slate-900">
                        {it.amount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* 5. Bottom Section: Follows DIRECTLY below table on Last Page */}
            {page.isLastPage ? (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-12 gap-3 items-start">
                  
                  {/* Left Column: Thank You Box & Terms */}
                  <div className="col-span-7">
                    <div className="border border-slate-300 rounded p-2.5 text-[10px] space-y-1 bg-white">
                      <div className="font-bold text-[#0b3a73] text-[11px]">
                        Thank you for choosing I M Medicos
                      </div>
                      <div className="text-slate-600 font-semibold italic text-[9.5px]">
                        Please take medicines as directed by the Physician.
                      </div>
                      {termsBullets.length > 0 && (
                        <div className="pt-1">
                          <div className="font-bold text-slate-700 text-[9px] uppercase tracking-wider">
                            Terms &amp; Conditions:
                          </div>
                          <ul className="list-disc list-inside text-[8.5px] text-slate-600 space-y-0.5 pt-0.5">
                            {termsBullets.map((bullet, bIdx) => (
                              <li key={`term-${bIdx}`} className="leading-tight">
                                {bullet}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Amount in Words (Below terms box, left) */}
                    {store.showAmountInWords && bill.amountInWords && (
                      <div className="mt-2 text-[10.5px]">
                        <span className="font-bold text-[#0b3a73]">Amount in Words : </span>
                        <span className="border-b border-slate-400 font-semibold text-slate-900 pb-0.5 underline">
                          {bill.amountInWords}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Totals Box & Authorised Signatory */}
                  <div className="col-span-5 flex flex-col items-end">
                    
                    {/* Bordered, Rounded Totals Box (4 Rows) */}
                    <div className="w-full border border-[#0b3a73] rounded-md overflow-hidden text-[11px]">
                      {/* Row 1: Sub Total */}
                      <div className="flex justify-between items-center px-3 py-1 bg-white border-b border-slate-200">
                        <span className="text-slate-700 font-semibold">Sub Total:</span>
                        <span className="font-bold text-slate-900">
                          {formatIndianCurrency(bill.subTotal)}
                        </span>
                      </div>

                      {/* Row 2: Discount */}
                      <div className="flex justify-between items-center px-3 py-1 bg-white border-b border-slate-200">
                        <span className="text-slate-700 font-semibold">Discount:</span>
                        <span className="font-bold text-slate-900">
                          {bill.discount > 0 ? `- ${formatIndianCurrency(bill.discount)}` : "₹ 0.00"}
                        </span>
                      </div>

                      {/* Row 3: GST Row (Text Only, No Rupee Amounts Anywhere!) */}
                      <div className="flex justify-between items-center px-3 py-1 bg-slate-50 border-b border-slate-200 text-[10px] text-slate-600 font-semibold">
                        <span>CGST 9% + SGST 9% (Included)</span>
                        <span></span>
                      </div>

                      {/* Row 4: Grand Total (Filled Navy Row with Bold White Text) */}
                      <div className="flex justify-between items-center px-3 py-1.5 bg-[#0b3a73] text-white font-black text-xs">
                        <span>Grand Total:</span>
                        <span>{formatIndianCurrency(bill.grandTotal)}</span>
                      </div>
                    </div>

                    {/* Bottom Right: For Store Name & Signature */}
                    <div className="w-full text-right mt-3">
                      <div className="font-bold text-[#0b3a73] text-[10.5px]">
                        For {store.storeName}
                      </div>
                      <div className="mt-8 pt-1 border-t border-slate-500 inline-block w-[140px] text-center text-[9.5px] font-bold text-slate-800">
                        Authorised Signatory
                      </div>
                    </div>

                  </div>

                </div>
              </div>
            ) : (
              <div className="text-right text-[10px] font-bold text-slate-500 italic py-2">
                Continued on Page {page.pageNumber + 1}...
              </div>
            )}

          </div>
        </div>
      ))}
    </div>
  );
};
