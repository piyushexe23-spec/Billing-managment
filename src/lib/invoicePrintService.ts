/**
 * Invoice Printing & PDF Generation Helper
 * IM MEDICOS Pharmacy Billing Software
 */

import { BillRecord } from "@/types/billing";
import { formatIndianCurrency, formatDisplayDate } from "@/lib/billingConfig";

export function generateInvoiceHtml(bill: BillRecord): string {
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

  // Parse terms bullets without hardcoded fallback
  const termsBullets = store.footerTerms
    ? store.footerTerms
        .split("\n")
        .map((t) => t.trim().replace(/^\d+[\.\)]\s*/, ""))
        .filter(Boolean)
    : [];

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

  let pagesHtml = "";

  pages.forEach((page) => {
    let rowsHtml = "";
    page.items.forEach((it, idx) => {
      const sNo = page.startIndex + idx + 1;
      rowsHtml += `
        <tr>
          <td style="text-align: center; color: #334155;">${sNo}</td>
          <td style="font-weight: 600; color: #0f172a;">${it.medicineName}${it.unit ? ` (${it.unit})` : ""}</td>
          <td style="color: #1e293b;">${it.batchNumber}</td>
          <td style="text-align: center; color: #1e293b;">${it.expDate}</td>
          <td style="text-align: center; font-weight: bold; color: #0f172a;">${it.quantity}</td>
          <td style="text-align: right; color: #334155;">${it.mrp.toFixed(2)}</td>
          <td style="text-align: right; font-weight: 500; color: #1e293b;">${it.rate.toFixed(2)}</td>
          <td style="text-align: right; font-weight: bold; color: #0f172a;">${it.amount.toFixed(2)}</td>
        </tr>
      `;
    });

    // Middle Column licenses
    let licensesHtml = "";
    if (store.showGstin && store.gstin) {
      licensesHtml += `
        <div style="display: flex; gap: 4px; margin-bottom: 3px;">
          <span style="font-weight: bold; color: #0b3a73; width: 55px; shrink: 0;">GSTIN :</span>
          <span style="font-weight: 600; color: #1e293b;">${store.gstin}</span>
        </div>
      `;
    }
    if (store.drugLicense1 || store.drugLicense2) {
      licensesHtml += `
        <div style="display: flex; gap: 4px;">
          <span style="font-weight: bold; color: #0b3a73; width: 55px; shrink: 0;">DL No. :</span>
          <div style="font-weight: 600; color: #1e293b; line-height: 1.2;">
            ${store.drugLicense1 ? `<div>${store.drugLicense1}</div>` : ""}
            ${store.drugLicense2 ? `<div style="margin-top: 2px;">${store.drugLicense2}</div>` : ""}
          </div>
        </div>
      `;
    }

    // Right Column Contact
    let contactHtml = "";
    if (store.address) {
      contactHtml += `
        <div style="display: flex; align-items: flex-start; gap: 6px; margin-bottom: 4px;">
          <svg style="width: 14px; height: 14px; color: #0b3a73; flex-shrink: 0; margin-top: 1px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span style="font-size: 10px; color: #334155; line-height: 1.2;">${store.address}</span>
        </div>
      `;
    }
    if (store.phone) {
      contactHtml += `
        <div style="display: flex; align-items: center; gap: 6px;">
          <svg style="width: 14px; height: 14px; color: #0b3a73; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
          <span style="font-size: 10px; font-weight: 600; color: #1e293b;">${store.phone}</span>
        </div>
      `;
    }

    // Logo HTML
    const logoBlockHtml = logoSrc
      ? `<div style="max-width: 70mm; max-height: 22mm; display: flex; align-items: center;">
           <img src="${logoSrc}" alt="${store.storeName || "Pharmacy Logo"}" style="max-width: 70mm; max-height: 22mm; object-fit: contain; object-position: left center;" />
         </div>`
      : `<h1 style="margin: 0; font-size: 17px; font-weight: 800; color: #0b3a73; text-transform: uppercase; line-height: 1.2;">${store.storeName || "PHARMACY"}</h1>`;

    const taglineHtml = store.tagline
      ? `<p style="margin: 2px 0 0 0; font-size: 9.5px; font-weight: 500; color: #64748b; letter-spacing: 0.3px;">${store.tagline}</p>`
      : "";

    // Terms bullets HTML
    let termsListHtml = "";
    if (termsBullets.length > 0) {
      termsListHtml = `
        <div style="margin-top: 4px;">
          <div style="font-weight: bold; color: #334155; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;">Terms &amp; Conditions:</div>
          <ul style="margin: 2px 0 0 14px; padding: 0; list-style-type: disc; font-size: 8.5px; color: #475569; line-height: 1.3;">
            ${termsBullets.map((b) => `<li>${b}</li>`).join("")}
          </ul>
        </div>
      `;
    }

    // Bottom section HTML (Only on Last Page)
    const bottomHtml = page.isLastPage
      ? `
        <div style="margin-top: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
            
            <!-- Left Box: Thank You & Terms -->
            <div style="width: 58%;">
              <div style="border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px 10px; background: #ffffff;">
                <div style="font-weight: bold; color: #0b3a73; font-size: 11px;">Thank you for choosing I M Medicos</div>
                <div style="color: #475569; font-style: italic; font-size: 9.5px; margin-top: 2px;">Please take medicines as directed by the Physician.</div>
                ${termsListHtml}
              </div>

              ${
                store.showAmountInWords && bill.amountInWords
                  ? `
                  <div style="margin-top: 8px; font-size: 10px;">
                    <span style="font-weight: bold; color: #0b3a73;">Amount in Words : </span>
                    <span style="font-weight: 600; text-decoration: underline; color: #0f172a;">${bill.amountInWords}</span>
                  </div>
                `
                  : ""
              }
            </div>

            <!-- Right Box: Totals & Signature -->
            <div style="width: 40%; display: flex; flex-direction: column; align-items: flex-end;">
              
              <!-- Bordered Totals Box (4 Rows) -->
              <div style="width: 100%; border: 1px solid #0b3a73; border-radius: 6px; overflow: hidden; font-size: 11px;">
                <!-- Row 1: Sub Total -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 10px; background: #ffffff; border-bottom: 1px solid #e2e8f0;">
                  <span style="color: #334155; font-weight: 600;">Sub Total:</span>
                  <span style="font-weight: bold; color: #0f172a;">${formatIndianCurrency(bill.subTotal)}</span>
                </div>

                <!-- Row 2: Discount -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 10px; background: #ffffff; border-bottom: 1px solid #e2e8f0;">
                  <span style="color: #334155; font-weight: 600;">Discount:</span>
                  <span style="font-weight: bold; color: #0f172a;">${bill.discount > 0 ? `- ${formatIndianCurrency(bill.discount)}` : "₹ 0.00"}</span>
                </div>

                <!-- Row 3: GST Row (Text Only, No Rupee Amounts Anywhere!) -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 10px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 10px; color: #475569; font-weight: 600;">
                  <span>CGST 9% + SGST 9% (Included)</span>
                  <span></span>
                </div>

                <!-- Row 4: Grand Total (Filled Navy Row with Bold White Text) -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #0b3a73; color: #ffffff; font-weight: 900; font-size: 12.5px;">
                  <span>Grand Total:</span>
                  <span>${formatIndianCurrency(bill.grandTotal)}</span>
                </div>
              </div>

              <!-- Signatory Block -->
              <div style="width: 100%; text-align: right; margin-top: 12px;">
                <div style="font-weight: bold; color: #0b3a73; font-size: 10.5px;">For ${store.storeName}</div>
                <div style="margin-top: 32px; border-top: 1px solid #64748b; display: inline-block; width: 140px; text-align: center; font-size: 9.5px; font-weight: bold; color: #334155; padding-top: 3px;">
                  Authorised Signatory
                </div>
              </div>

            </div>

          </div>
        </div>
      `
      : `<div style="text-align: right; font-size: 10px; font-weight: bold; color: #64748b; font-style: italic; padding: 6px 0;">Continued on Page ${page.pageNumber + 1}...</div>`;

    pagesHtml += `
      <div class="a4-page ${!page.isLastPage ? "page-break" : ""}">
        <div class="page-border-container">
          
          <!-- Header -->
          <div class="header">
            <!-- Left: Logo Block -->
            <div class="header-col-left">
              ${logoBlockHtml}
              ${taglineHtml}
            </div>

            <!-- Vertical Divider 1 -->
            <div class="divider-v"></div>

            <!-- Middle: Licenses -->
            <div class="header-col-mid">
              ${licensesHtml}
            </div>

            <!-- Vertical Divider 2 -->
            <div class="divider-v"></div>

            <!-- Right: Contact -->
            <div class="header-col-right">
              ${contactHtml}
            </div>
          </div>

          <!-- Header Navy Underline -->
          <div class="header-line"></div>

          <!-- Title Pill -->
          <div class="title-pill-wrap">
            <span class="title-pill">TAX INVOICE / PHARMACY BILL</span>
          </div>

          <!-- Underline Meta Rows -->
          <div class="meta-section">
            <div class="meta-col">
              <div class="meta-row">
                <span class="meta-lbl" style="width: 75px;">Bill No. :</span>
                <span class="meta-val" style="font-weight: bold;">${bill.billNumber}</span>
              </div>
              <div class="meta-row">
                <span class="meta-lbl" style="width: 75px;">Date :</span>
                <span class="meta-val">
                  ${formatDisplayDate(bill.billDate)}
                  <span style="margin-left: 10px; font-size: 9.5px; font-weight: normal; color: #64748b;">(Mode: ${bill.paymentMode})</span>
                </span>
              </div>
            </div>

            <div class="meta-col">
              <div class="meta-row">
                <span class="meta-lbl" style="width: 150px;">Patient / Customer Name :</span>
                <span class="meta-val" style="font-weight: bold;">${bill.customerName}</span>
              </div>
              ${
                bill.customerMobile
                  ? `<div style="font-size: 9.5px; color: #64748b; padding-left: 150px; margin-top: -2px; margin-bottom: 2px;">Mobile: +91 ${bill.customerMobile}</div>`
                  : ""
              }
              <div class="meta-row">
                <span class="meta-lbl" style="width: 150px;">Doctor Name :</span>
                <span class="meta-val">${bill.doctorName ? `Dr. ${bill.doctorName.replace(/^Dr\.?\s*/i, "")}` : "________________________"}</span>
              </div>
            </div>
          </div>

          <!-- Table -->
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 5%; text-align: center;">S.No.</th>
                <th style="width: 37%; text-align: left;">Medicine Name</th>
                <th style="width: 14%; text-align: left;">Batch No.</th>
                <th style="width: 10%; text-align: center;">Expiry</th>
                <th style="width: 6%; text-align: center;">Qty.</th>
                <th style="width: 9%; text-align: right;">MRP (Rs)</th>
                <th style="width: 9%; text-align: right;">Rate (Rs)</th>
                <th style="width: 10%; text-align: right;">Amount (Rs)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <!-- Bottom Section -->
          ${bottomHtml}

        </div>
      </div>
    `;
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>Invoice - ${bill.billNumber}</title>
      <style>
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          margin: 0;
          padding: 0;
          background: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
        }
        .a4-page {
          width: 210mm;
          max-width: 210mm;
          margin: 0 auto;
          padding: 6mm;
          background: #ffffff;
          box-sizing: border-box;
        }
        .page-border-container {
          border: 1.5px solid #0b3a73;
          padding: 6mm;
          box-sizing: border-box;
          background: #ffffff;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 8px;
        }
        .header-col-left {
          width: 36%;
          min-height: 48px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding-right: 8px;
        }
        .header-col-mid {
          width: 28%;
          padding: 0 10px;
          font-size: 10.5px;
        }
        .header-col-right {
          width: 34%;
          padding-left: 10px;
          font-size: 10px;
        }
        .divider-v {
          width: 1px;
          background: #0b3a73;
          align-self: stretch;
          margin: 2px 0;
        }
        .header-line {
          width: 100%;
          height: 2px;
          background: #0b3a73;
        }
        .title-pill-wrap {
          text-align: center;
          margin: 8px 0;
        }
        .title-pill {
          display: inline-block;
          background: #0b3a73;
          color: #ffffff;
          padding: 3px 20px;
          border-radius: 9999px;
          font-weight: bold;
          font-size: 10.5px;
          letter-spacing: 0.8px;
          text-transform: uppercase;
        }
        .meta-section {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 11px;
        }
        .meta-col {
          width: 48%;
        }
        .meta-row {
          display: flex;
          align-items: baseline;
          margin-bottom: 4px;
        }
        .meta-lbl {
          font-weight: bold;
          color: #0b3a73;
          flex-shrink: 0;
        }
        .meta-val {
          border-bottom: 1px solid #94a3b8;
          color: #0f172a;
          padding-bottom: 1px;
          flex-grow: 1;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }
        .items-table th {
          background: #0b3a73;
          color: #ffffff;
          font-weight: bold;
          padding: 4px 6px;
          border: 1px solid #cbd5e1;
        }
        .items-table td {
          padding: 4px 6px;
          border: 1px solid #cbd5e1;
        }
        tr {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 4mm;
          }
          body {
            background: #ffffff;
          }
          .a4-page {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
          .page-break {
            page-break-after: always;
            break-after: page;
          }
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
