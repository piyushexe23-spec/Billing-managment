/**
 * Invoice Printing & PDF Generation Helper
 * IM MEDICOS Pharmacy Billing Software
 */

import { BillRecord } from "@/types/billing";
import { formatIndianCurrency } from "@/lib/billingConfig";

export function generateInvoiceHtml(bill: BillRecord): string {
  const store = bill.storeSnapshot;
  const itemsPerPage = 10;
  const totalPages = Math.ceil(Math.max(bill.items.length, itemsPerPage) / itemsPerPage);

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

  let pagesHtml = "";

  for (let p = 0; p < totalPages; p++) {
    const pageItems = bill.items.slice(p * itemsPerPage, (p + 1) * itemsPerPage);
    const isLastPage = p === totalPages - 1;
    const blankRowsCount = itemsPerPage - pageItems.length;

    let rowsHtml = "";
    pageItems.forEach((it, idx) => {
      const sNo = p * itemsPerPage + idx + 1;
      rowsHtml += `
        <tr>
          <td style="text-align: center; font-family: monospace;">${sNo}</td>
          <td style="font-weight: 600; color: #0f172a;">${it.medicineName}${it.unit ? ` (${it.unit})` : ""}</td>
          <td style="font-family: monospace;">${it.batchNumber}</td>
          <td style="text-align: center; font-family: monospace;">${it.expDate}</td>
          <td style="text-align: center; font-weight: bold;">${it.quantity}</td>
          <td style="text-align: right; font-family: monospace;">${it.mrp.toFixed(2)}</td>
          <td style="text-align: right; font-family: monospace;">${it.rate.toFixed(2)}</td>
          <td style="text-align: right; font-family: monospace; font-weight: bold;">${it.amount.toFixed(2)}</td>
        </tr>
      `;
    });

    for (let b = 0; b < blankRowsCount; b++) {
      rowsHtml += `
        <tr class="blank-row">
          <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
        </tr>
      `;
    }

    const totalsHtml = isLastPage
      ? `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-top: 2px solid #0f172a; padding-top: 8px; margin-top: 6px;">
          <div style="width: 58%;">
            ${
              store.showAmountInWords && bill.amountInWords
                ? `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 10px; border-radius: 4px; font-size: 11px;">
                  <span style="font-weight: bold; color: #64748b; font-size: 9.5px; text-transform: uppercase;">Amount in Words:</span><br/>
                  <span style="font-weight: bold; color: #0f172a; font-style: italic;">${bill.amountInWords}</span>
                </div>
              `
                : ""
            }
            <div style="font-size: 9.5px; color: #64748b; margin-top: 4px;">
              * All prices are inclusive of GST. Tax amount reflects included taxes as per statutory rules.
            </div>
          </div>
          
          <div style="width: 38%; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px; font-size: 11px;">
            <div style="display: flex; justify-content: space-between; color: #475569; margin-bottom: 2px;">
              <span>Sub Total:</span>
              <span style="font-family: monospace;">${formatIndianCurrency(bill.subTotal)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #15803d; margin-bottom: 4px;">
              <span>Discount:</span>
              <span style="font-family: monospace;">${bill.discount > 0 ? `- ${formatIndianCurrency(bill.discount)}` : "₹ 0.00"}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 3px; font-size: 10px;">
              <span>Incl. GST (18%):</span>
              <span style="font-family: monospace;">${formatIndianCurrency(bill.gstTotal)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #64748b; padding-left: 8px; font-size: 9.5px;">
              <span>• CGST 9%:</span>
              <span style="font-family: monospace;">${formatIndianCurrency(bill.cgst)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #64748b; padding-left: 8px; font-size: 9.5px;">
              <span>• SGST 9%:</span>
              <span style="font-family: monospace;">${formatIndianCurrency(bill.sgst)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 900; color: #0f172a; border-top: 2px solid #0f172a; padding-top: 4px; margin-top: 4px;">
              <span>Grand Total:</span>
              <span style="font-family: monospace;">${formatIndianCurrency(bill.grandTotal)}</span>
            </div>
          </div>
        </div>
      `
      : `<div style="text-align: right; font-size: 10.5px; font-weight: bold; color: #64748b; font-style: italic; padding: 4px 0;">Continued on Page ${p + 2}...</div>`;

    pagesHtml += `
      <div class="a4-page">
        <div>
          <!-- Header -->
          <div class="header">
            <div class="logo-box">
              <svg viewBox="0 0 320 80" width="180" height="45">
                <rect x="0" y="0" width="45" height="45" rx="10" fill="#0f172a" />
                <rect x="19" y="8" width="7" height="29" rx="2.5" fill="#22c55e" />
                <rect x="8" y="19" width="29" height="7" rx="2.5" fill="#22c55e" />
                <path d="M11 22 H16 L18 17 L21 27 L24 22 H29" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                <circle cx="39" cy="8" r="3.5" fill="#22c55e" stroke="#ffffff" stroke-width="1.5" />
                <text x="56" y="27" font-family="sans-serif" font-size="20" font-weight="800" fill="#0f172a">IM <tspan font-weight="900" fill="#1e3a8a">MEDICOS</tspan><tspan fill="#22c55e">.</tspan></text>
                <text x="57" y="40" font-family="sans-serif" font-size="7.5" font-weight="700" fill="#64748b" letter-spacing="1">MEDICAL BILLING SOFTWARE</text>
              </svg>
            </div>
            
            <div class="store-info">
              <div class="store-title">${store.storeName}</div>
              ${store.address ? `<div class="store-sub">${store.address}</div>` : ""}
              <div class="store-contact">
                ${store.phone ? `<span>Ph: ${store.phone}</span>` : ""}
                ${store.email ? `<span>Email: ${store.email}</span>` : ""}
              </div>
              <div class="store-licenses">
                ${store.showGstin && store.gstin ? `<span class="badge">GSTIN: ${store.gstin}</span>` : ""}
                ${store.drugLicense1 ? `<span class="badge">DL 1: ${store.drugLicense1}</span>` : ""}
                ${store.drugLicense2 ? `<span class="badge">DL 2: ${store.drugLicense2}</span>` : ""}
              </div>
            </div>
          </div>

          <!-- Title bar -->
          <div class="title-bar">
            <span>ORIGINAL FOR RECIPIENT</span>
            <span style="font-size: 11.5px; font-weight: 900; letter-spacing: 1.5px;">TAX INVOICE / PHARMACY BILL</span>
            <span>Page ${p + 1} of ${totalPages}</span>
          </div>

          <!-- Patient & Invoice Meta -->
          <div class="meta-grid">
            <div>
              <div><span class="meta-label">Bill No.:</span> <span style="font-weight: 800; font-family: monospace;">${bill.billNumber}</span></div>
              <div><span class="meta-label">Date:</span> <span>${bill.billDate}</span></div>
              <div><span class="meta-label">Payment:</span> <b>${bill.paymentMode}</b></div>
            </div>
            <div>
              <div><span class="meta-label">Patient Name:</span> <b>${bill.customerName}</b></div>
              <div><span class="meta-label">Mobile:</span> <span style="font-family: monospace;">+91 ${bill.customerMobile}</span></div>
              <div><span class="meta-label">Doctor Name:</span> <span>${bill.doctorName ? `Dr. ${bill.doctorName.replace(/^Dr\.?\s*/i, "")}` : "—"}</span></div>
            </div>
          </div>

          <!-- Table -->
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">S.No.</th>
                <th>Medicine Name</th>
                <th style="width: 90px;">Batch No.</th>
                <th style="width: 65px; text-align: center;">Expiry</th>
                <th style="width: 45px; text-align: center;">Qty.</th>
                <th style="width: 65px; text-align: right;">MRP (₹)</th>
                <th style="width: 65px; text-align: right;">Rate (₹)</th>
                <th style="width: 75px; text-align: right;">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>

        <div>
          ${totalsHtml}

          <!-- Footer -->
          <div class="footer">
            <div style="width: 65%;">
              <div style="font-weight: bold; color: #0f172a; font-size: 10.5px;">Thank you for choosing I M Medicos</div>
              <div style="color: #475569; font-style: italic; font-size: 9.5px;">Please take medicines as directed by the Physician.</div>
              <div style="margin-top: 4px;">
                <div style="font-weight: bold; font-size: 9px; color: #475569; text-transform: uppercase;">Terms &amp; Conditions:</div>
                <ul style="margin: 2px 0 0 14px; padding: 0; font-size: 8.5px; color: #64748b;">
                  ${termsBullets.map((b) => `<li>${b.replace(/^\d+[\.\)]\s*/, "")}</li>`).join("")}
                </ul>
              </div>
            </div>

            <div style="width: 32%; text-align: right;">
              <div style="font-size: 9.5px; color: #475569;">For <b>${store.storeName}</b></div>
              <div style="margin-top: 36px; border-top: 1px solid #94a3b8; font-weight: bold; font-size: 9.5px; display: inline-block; min-width: 130px; text-align: center;">
                Authorised Signatory
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Invoice - ${bill.billNumber}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 6mm;
        }
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #0f172a;
          background: #f1f5f9;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .a4-page {
          width: 210mm;
          min-height: 297mm;
          height: 297mm;
          margin: 0 auto 10px auto;
          padding: 10mm;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          page-break-after: always;
          break-after: page;
        }
        @media print {
          body {
            background: #ffffff;
          }
          .a4-page {
            margin: 0;
            padding: 8mm;
            border: none;
            box-shadow: none;
          }
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 8px;
        }
        .store-info {
          text-align: right;
          max-width: 55%;
        }
        .store-title {
          font-size: 15px;
          font-weight: 900;
          color: #0f172a;
        }
        .store-sub {
          font-size: 10px;
          color: #475569;
          margin-top: 1px;
        }
        .store-contact {
          font-size: 10px;
          color: #334155;
          margin-top: 2px;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .store-licenses {
          font-size: 9.5px;
          margin-top: 3px;
          display: flex;
          justify-content: flex-end;
          gap: 6px;
        }
        .badge {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          padding: 1px 4px;
          border-radius: 3px;
          font-weight: 600;
        }
        .title-bar {
          background: #0f172a;
          color: #ffffff;
          padding: 3px 10px;
          margin-top: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 9.5px;
          font-weight: 700;
          border-radius: 2px;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          padding: 6px 10px;
          margin-top: 8px;
          font-size: 11px;
        }
        .meta-label {
          color: #64748b;
          font-weight: 600;
          display: inline-block;
          width: 85px;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          font-size: 10.5px;
        }
        .items-table th {
          background: #1e293b;
          color: #ffffff;
          font-weight: 700;
          text-align: left;
          padding: 5px 6px;
          border: 1px solid #334155;
        }
        .items-table td {
          padding: 3.5px 6px;
          border: 1px solid #e2e8f0;
        }
        .blank-row td {
          padding: 6px;
        }
        .footer {
          border-top: 1px solid #cbd5e1;
          padding-top: 8px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
      </style>
    </head>
    <body>
      ${pagesHtml}
    </body>
    </html>
  `;
}

/**
 * Triggers printing using a hidden iframe to prevent interrupting active application UI
 */
export function printInvoice(bill: BillRecord): void {
  const html = generateInvoiceHtml(bill);

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

/**
 * Saves invoice as an offline HTML file or prompts user to save
 */
export function downloadInvoicePdf(bill: BillRecord): void {
  const html = generateInvoiceHtml(bill);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Invoice_${bill.billNumber}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
