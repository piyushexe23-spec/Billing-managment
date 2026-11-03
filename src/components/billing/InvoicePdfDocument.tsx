import React from "react";
import { BillRecord } from "@/types/billing";
import { formatIndianCurrency } from "@/lib/billingConfig";

interface InvoicePdfDocumentProps {
  bill: BillRecord;
}

export const InvoicePdfDocument: React.FC<InvoicePdfDocumentProps> = ({ bill }) => {
  const store = bill.storeSnapshot;
  const itemsPerPage = 10;
  const totalPages = Math.ceil(Math.max(bill.items.length, itemsPerPage) / itemsPerPage);

  const pages = [];
  for (let p = 0; p < totalPages; p++) {
    const pageItems = bill.items.slice(p * itemsPerPage, (p + 1) * itemsPerPage);
    const isLastPage = p === totalPages - 1;

    // Fill remaining rows to always have at least itemsPerPage rows
    const blankRowsCount = itemsPerPage - pageItems.length;

    pages.push({
      pageIndex: p + 1,
      totalPages,
      items: pageItems,
      blankRowsCount,
      isLastPage,
    });
  }

  // Parse terms bullets
  const termsBullets = store.footerTerms
    ? store.footerTerms
        .split("\n")
        .map((t) => t.trim())
        .filter(Boolean)
    : [
        "Goods once sold will not be taken back without original cash memo.",
        "Prescribed medicines sold only on registered medical prescription.",
        "Keep medicines in a cool, dry place away from sunlight.",
      ];

  return (
    <div className="invoice-print-container bg-white text-slate-900 font-sans print:p-0">
      {pages.map((page) => (
        <div
          key={`invoice-page-${page.pageIndex}`}
          className="a4-page w-[210mm] min-h-[297mm] max-h-[297mm] h-[297mm] mx-auto p-[10mm] box-border bg-white flex flex-col justify-between border border-slate-200 print:border-none shadow-md print:shadow-none print:m-0 print:p-[8mm] print:break-after-page"
          style={{ boxSizing: "border-box" }}
        >
          {/* Top Section */}
          <div className="space-y-2">
            {/* 1. Header with Fixed Logo & Store Details */}
            <div className="flex items-start justify-between pb-3 border-b-2 border-medical-navy-900">
              {/* Brand Logo & Tagline */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-medical-navy-900 to-medical-navy-950 flex items-center justify-center p-2 shadow-xs shrink-0">
                  <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
                    <rect x="13" y="6" width="6" height="20" rx="2.5" fill="#22c55e" />
                    <rect x="6" y="13" width="20" height="6" rx="2.5" fill="#22c55e" />
                    <path
                      d="M9 16H13L15 12L17 20L19 16H23"
                      stroke="#ffffff"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-2xl font-black text-medical-navy-950 tracking-tight leading-none">
                    IM <span className="text-medical-navy-800">MEDICOS</span>
                    <span className="text-medical-green-600">.</span>
                  </div>
                  <div className="text-[9.5px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                    Medical Billing Software
                  </div>
                </div>
              </div>

              {/* Store License & Info */}
              <div className="text-right space-y-0.5 max-w-[55%]">
                <h1 className="text-base font-extrabold text-medical-navy-950 leading-tight">
                  {store.storeName}
                </h1>
                {store.address && (
                  <p className="text-[11px] text-slate-600 leading-tight">{store.address}</p>
                )}
                <div className="text-[11px] text-slate-700 flex items-center justify-end gap-2 flex-wrap pt-0.5 font-medium">
                  {store.phone && <span>Ph: {store.phone}</span>}
                  {store.email && <span>Email: {store.email}</span>}
                </div>
                <div className="text-[10px] text-slate-800 font-semibold flex items-center justify-end gap-2 flex-wrap pt-0.5">
                  {store.showGstin && store.gstin && (
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
                      GSTIN: {store.gstin}
                    </span>
                  )}
                  {store.drugLicense1 && (
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
                      DL 1: {store.drugLicense1}
                    </span>
                  )}
                  {store.drugLicense2 && (
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
                      DL 2: {store.drugLicense2}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Title Bar */}
            <div className="bg-medical-navy-950 text-white text-center py-1 rounded-sm flex items-center justify-between px-3">
              <span className="text-[10px] tracking-wider uppercase font-semibold text-medical-green-400">
                Original For Recipient
              </span>
              <span className="text-xs font-black tracking-widest uppercase">
                TAX INVOICE / PHARMACY BILL
              </span>
              <span className="text-[10px] tracking-wider text-slate-300">
                Page {page.pageIndex} of {page.totalPages}
              </span>
            </div>

            {/* 3. Patient & Invoice Meta Grid */}
            <div className="grid grid-cols-2 gap-4 p-2 bg-slate-50 border border-slate-200 rounded text-xs">
              <div className="space-y-1">
                <div className="flex">
                  <span className="w-24 text-slate-500 font-semibold">Bill No.:</span>
                  <span className="font-extrabold text-medical-navy-950 font-mono">
                    {bill.billNumber}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-24 text-slate-500 font-semibold">Date:</span>
                  <span className="font-medium text-slate-800">{bill.billDate}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-slate-500 font-semibold">Payment Mode:</span>
                  <span className="font-bold text-slate-800">{bill.paymentMode}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex">
                  <span className="w-28 text-slate-500 font-semibold">Patient Name:</span>
                  <span className="font-bold text-slate-900">{bill.customerName}</span>
                </div>
                <div className="flex">
                  <span className="w-28 text-slate-500 font-semibold">Mobile:</span>
                  <span className="font-medium text-slate-800 font-mono">
                    +91 {bill.customerMobile}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-28 text-slate-500 font-semibold">Doctor Name:</span>
                  <span className="font-medium text-slate-800">
                    {bill.doctorName ? `Dr. ${bill.doctorName.replace(/^Dr\.?\s*/i, "")}` : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Bill Items Table */}
            <table className="w-full border-collapse border border-slate-300 text-[11px]">
              <thead>
                <tr className="bg-medical-navy-900 text-white font-bold text-left">
                  <th className="py-1.5 px-2 border border-slate-400 text-center w-8">S.No.</th>
                  <th className="py-1.5 px-2 border border-slate-400">Medicine Name</th>
                  <th className="py-1.5 px-2 border border-slate-400 w-24">Batch No.</th>
                  <th className="py-1.5 px-2 border border-slate-400 w-16 text-center">Expiry</th>
                  <th className="py-1.5 px-2 border border-slate-400 w-12 text-center">Qty.</th>
                  <th className="py-1.5 px-2 border border-slate-400 w-16 text-right">MRP (Rs)</th>
                  <th className="py-1.5 px-2 border border-slate-400 w-16 text-right">Rate (Rs)</th>
                  <th className="py-1.5 px-2 border border-slate-400 w-20 text-right">Amount (Rs)</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((it, idx) => {
                  const sNo = (page.pageIndex - 1) * itemsPerPage + idx + 1;
                  return (
                    <tr
                      key={`item-${it.id || idx}`}
                      className="border-b border-slate-200 hover:bg-slate-50"
                    >
                      <td className="py-1 px-2 border border-slate-200 text-center font-mono">
                        {sNo}
                      </td>
                      <td className="py-1 px-2 border border-slate-200 font-semibold text-medical-navy-950 truncate max-w-[180px]">
                        {it.medicineName}
                        {it.unit ? ` (${it.unit})` : ""}
                      </td>
                      <td className="py-1 px-2 border border-slate-200 font-mono text-[10px]">
                        {it.batchNumber}
                      </td>
                      <td className="py-1 px-2 border border-slate-200 text-center font-mono text-[10px]">
                        {it.expDate}
                      </td>
                      <td className="py-1 px-2 border border-slate-200 text-center font-bold">
                        {it.quantity}
                      </td>
                      <td className="py-1 px-2 border border-slate-200 text-right font-mono">
                        {it.mrp.toFixed(2)}
                      </td>
                      <td className="py-1 px-2 border border-slate-200 text-right font-mono font-medium">
                        {it.rate.toFixed(2)}
                      </td>
                      <td className="py-1 px-2 border border-slate-200 text-right font-mono font-bold text-slate-900">
                        {it.amount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}

                {/* Blank Fill Rows to maintain consistent 10-row height */}
                {Array.from({ length: page.blankRowsCount }).map((_, bIdx) => (
                  <tr key={`blank-${bIdx}`} className="border-b border-slate-100">
                    <td className="py-2.5 px-2 border border-slate-200 text-center text-transparent">
                      .
                    </td>
                    <td className="py-2.5 px-2 border border-slate-200">&nbsp;</td>
                    <td className="py-2.5 px-2 border border-slate-200">&nbsp;</td>
                    <td className="py-2.5 px-2 border border-slate-200">&nbsp;</td>
                    <td className="py-2.5 px-2 border border-slate-200">&nbsp;</td>
                    <td className="py-2.5 px-2 border border-slate-200">&nbsp;</td>
                    <td className="py-2.5 px-2 border border-slate-200">&nbsp;</td>
                    <td className="py-2.5 px-2 border border-slate-200">&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Section (Totals on Last Page, Footer on All Pages) */}
          <div className="space-y-3 pt-2">
            {page.isLastPage ? (
              <>
                {/* 5. Totals & Tax Box */}
                <div className="grid grid-cols-12 gap-3 items-start border-t-2 border-medical-navy-900 pt-2">
                  {/* Amount in words */}
                  <div className="col-span-7 space-y-1">
                    {store.showAmountInWords && bill.amountInWords && (
                      <div className="bg-slate-50 border border-slate-200 p-2 rounded text-[11px]">
                        <span className="font-bold text-slate-600 block text-[9.5px] uppercase tracking-wider">
                          Amount Chargeable (in words):
                        </span>
                        <span className="font-bold text-medical-navy-950 italic">
                          {bill.amountInWords}
                        </span>
                      </div>
                    )}

                    {/* Tax Breakdown Notice */}
                    <div className="text-[10px] text-slate-500 pt-1 leading-relaxed">
                      * All prices are inclusive of GST. Tax amount reflects included taxes as per
                      statutory rules.
                    </div>
                  </div>

                  {/* Calculations Table */}
                  <div className="col-span-5 bg-slate-50 border border-slate-300 rounded p-2 text-xs space-y-1">
                    <div className="flex justify-between text-slate-600">
                      <span>Sub Total:</span>
                      <span className="font-mono">{formatIndianCurrency(bill.subTotal)}</span>
                    </div>

                    <div className="flex justify-between text-medical-green-700">
                      <span>Discount:</span>
                      <span className="font-mono">
                        {bill.discount > 0 ? `- ${formatIndianCurrency(bill.discount)}` : "₹ 0.00"}
                      </span>
                    </div>

                    {/* GST Included Line */}
                    <div className="flex justify-between text-slate-600 text-[11px] pt-0.5 border-t border-slate-200">
                      <span>Incl. GST (18%):</span>
                      <span className="font-mono">{formatIndianCurrency(bill.gstTotal)}</span>
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-500 pl-2">
                      <span>• CGST 9%:</span>
                      <span className="font-mono">{formatIndianCurrency(bill.cgst)}</span>
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-500 pl-2">
                      <span>• SGST 9%:</span>
                      <span className="font-mono">{formatIndianCurrency(bill.sgst)}</span>
                    </div>

                    {/* Grand Total */}
                    <div className="flex justify-between text-sm font-black text-medical-navy-950 pt-1 border-t-2 border-medical-navy-900">
                      <span>Grand Total:</span>
                      <span className="font-mono text-medical-navy-900">
                        {formatIndianCurrency(bill.grandTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-right text-[11px] font-bold text-slate-500 italic py-2 border-t border-slate-200">
                Continued on Page {page.pageIndex + 1}...
              </div>
            )}

            {/* 6. Footer Section (Terms, Instructions, and Signatory) */}
            <div className="border-t border-slate-300 pt-2 grid grid-cols-12 gap-3 text-[10px] items-end">
              {/* Left: Thank You Note & Terms Bullets */}
              <div className="col-span-8 space-y-1">
                <div className="font-bold text-medical-navy-950 text-[10.5px]">
                  Thank you for choosing I M Medicos
                </div>
                <div className="text-slate-600 font-semibold italic text-[9.5px]">
                  Please take medicines as directed by the Physician.
                </div>
                <div className="pt-1">
                  <div className="font-bold text-slate-700 text-[9px] uppercase tracking-wider">
                    Terms &amp; Conditions:
                  </div>
                  <ul className="list-disc list-inside text-[9px] text-slate-500 space-y-0.5 pt-0.5">
                    {termsBullets.map((bullet, bIdx) => (
                      <li key={`term-${bIdx}`} className="leading-tight">
                        {bullet.replace(/^\d+[\.\)]\s*/, "")}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Right: Signature */}
              <div className="col-span-4 text-right space-y-8">
                <div className="font-bold text-slate-700 text-[10px]">
                  For <span className="font-extrabold text-medical-navy-950">{store.storeName}</span>
                </div>
                <div className="pt-6 border-t border-slate-400 text-slate-800 font-bold inline-block min-w-[140px] text-center text-[10px]">
                  Authorised Signatory
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
