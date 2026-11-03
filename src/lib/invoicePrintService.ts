/**
 * Invoice Printing & PDF Generation Helper
 * IM MEDICOS Pharmacy Billing Software
 */

import { BillRecord } from "@/types/billing";
import { formatIndianCurrency, formatDisplayDate } from "@/lib/billingConfig";

// In-memory cache for auto-trimmed logo data URLs to avoid re-computing
const trimmedLogoCache = new Map<string, string>();

/**
 * Auto-trims transparent and white padding around an image using an HTML5 Canvas.
 * Generates an in-memory trimmed PNG data URL without altering the source file.
 */
export function trimImageWhitespace(imageSrc: string): Promise<string> {
  if (!imageSrc) return Promise.resolve(imageSrc);
  if (trimmedLogoCache.has(imageSrc)) {
    return Promise.resolve(trimmedLogoCache.get(imageSrc)!);
  }

  // Gracefully fallback in non-DOM environments (e.g. Node.js unit tests)
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(imageSrc);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (!width || !height) {
          resolve(imageSrc);
          return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(imageSrc);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;

        // Detect non-transparent and non-white pixels
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];

            // Ignore transparent pixels (alpha < 15)
            // Ignore pure white / near-white pixels (alpha >= 225 && RGB > 240)
            const isTransparent = a < 15;
            const isWhite = a >= 225 && r > 240 && g > 240 && b > 240;

            if (!isTransparent && !isWhite) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        // If no artwork detected or entirely blank, keep original
        if (maxX < minX || maxY < minY) {
          trimmedLogoCache.set(imageSrc, imageSrc);
          resolve(imageSrc);
          return;
        }

        // 1px safe boundary padding
        minX = Math.max(0, minX - 1);
        minY = Math.max(0, minY - 1);
        maxX = Math.min(width - 1, maxX + 1);
        maxY = Math.min(height - 1, maxY + 1);

        const trimmedWidth = maxX - minX + 1;
        const trimmedHeight = maxY - minY + 1;

        const trimmedCanvas = document.createElement("canvas");
        trimmedCanvas.width = trimmedWidth;
        trimmedCanvas.height = trimmedHeight;
        const trimmedCtx = trimmedCanvas.getContext("2d");
        if (!trimmedCtx) {
          resolve(imageSrc);
          return;
        }

        trimmedCtx.drawImage(
          canvas,
          minX,
          minY,
          trimmedWidth,
          trimmedHeight,
          0,
          0,
          trimmedWidth,
          trimmedHeight
        );

        const trimmedDataUrl = trimmedCanvas.toDataURL("image/png");
        trimmedLogoCache.set(imageSrc, trimmedDataUrl);
        resolve(trimmedDataUrl);
      } catch (err) {
        console.warn("Auto-trim failed, using original logo:", err);
        resolve(imageSrc);
      }
    };

    img.onerror = () => {
      resolve(imageSrc);
    };

    img.src = imageSrc;
  });
}

/**
 * Formats an expiry date string to strictly MM/YYYY (e.g. 01/2027)
 */
export function formatExpiryForInvoice(expDate: string | null | undefined): string {
  if (!expDate) return "-";
  const clean = expDate.trim();
  if (!clean) return "-";

  // Already MM/YYYY
  if (/^\d{2}\/\d{4}$/.test(clean)) return clean;

  // YYYY-MM or YYYY-MM-DD
  const ymdMatch = clean.match(/^(\d{4})[-\/](\d{1,2})(?:[-\/]\d{1,2})?$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, "0");
    return `${month}/${year}`;
  }

  // MM-YYYY or MM/YY
  const myMatch = clean.match(/^(\d{1,2})[-\/](\d{2,4})$/);
  if (myMatch) {
    const month = myMatch[1].padStart(2, "0");
    let year = myMatch[2];
    if (year.length === 2) year = `20${year}`;
    return `${month}/${year}`;
  }

  // Fallback via Date parser
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const y = parsed.getFullYear();
    return `${m}/${y}`;
  }

  return clean;
}

/**
 * Generates print/PDF HTML for an invoice
 */
export function generateInvoiceHtml(bill: BillRecord, overrideLogoSrc?: string | null): string {
  const store = bill.storeSnapshot;

  // Resolve logo source (from parameter, bill snapshot, or local storage fallback)
  let logoSrc: string | null = overrideLogoSrc || store.logoDataUrl || store.logoPath || null;
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
          <td style="text-align: center; color: #1e293b;">${formatExpiryForInvoice(it.expDate)}</td>
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

    // Logo HTML: Height-limited to 20mm and max width 70mm, keeping aspect ratio, aligned left and centered vertically
    const logoBlockHtml = logoSrc
      ? `<div style="max-width: 70mm; max-height: 20mm; height: 20mm; display: flex; align-items: center; justify-content: flex-start;">
           <img class="store-invoice-logo" src="${logoSrc}" alt="${store.storeName || "Pharmacy Logo"}" style="max-width: 70mm; max-height: 20mm; height: auto; width: auto; object-fit: contain; object-position: left center; image-rendering: auto;" />
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

    // Formatted Mobile Number: +91 with 10 digits
    const cleanedMobile = bill.customerMobile
      ? bill.customerMobile.replace(/^\+?91\s*/, "").trim()
      : "";
    const formattedMobile = cleanedMobile ? `+91 ${cleanedMobile}` : "";

    // Formatted Doctor Name (Empty underline without underscore characters)
    const formattedDoctor = bill.doctorName
      ? `Dr. ${bill.doctorName.replace(/^Dr\.?\s*/i, "").trim()}`
      : "";

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

          <!-- Underline Meta Rows: Left (Bill No, Date, Payment Mode) & Right (Customer, Mobile, Doctor) -->
          <div class="meta-section">
            <div class="meta-col">
              <div class="meta-row">
                <span class="meta-lbl" style="width: 105px;">Bill No. :</span>
                <span class="meta-val" style="font-weight: bold;">${bill.billNumber}</span>
              </div>
              <div class="meta-row">
                <span class="meta-lbl" style="width: 105px;">Date :</span>
                <span class="meta-val" style="font-weight: 600;">${formatDisplayDate(bill.billDate)}</span>
              </div>
              <div class="meta-row">
                <span class="meta-lbl" style="width: 105px;">Payment Mode :</span>
                <span class="meta-val" style="font-weight: 600;">${bill.paymentMode || "CASH"}</span>
              </div>
            </div>

            <div class="meta-col">
              <div class="meta-row">
                <span class="meta-lbl" style="width: 165px;">Patient / Customer Name :</span>
                <span class="meta-val" style="font-weight: bold;">${bill.customerName}</span>
              </div>
              <div class="meta-row">
                <span class="meta-lbl" style="width: 165px;">Mobile No. :</span>
                <span class="meta-val" style="font-weight: 600; min-height: 16px; display: inline-block;">${formattedMobile || "&nbsp;"}</span>
              </div>
              <div class="meta-row">
                <span class="meta-lbl" style="width: 165px;">Doctor Name :</span>
                <span class="meta-val" style="font-weight: 500; min-height: 16px; display: inline-block;">${formattedDoctor || "&nbsp;"}</span>
              </div>
            </div>
          </div>

          <!-- Items Table -->
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
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #0f172a;
        }
        .a4-page {
          width: 210mm;
          max-width: 210mm;
          margin: 0 auto;
          padding: 8mm;
          background: #ffffff;
          box-sizing: border-box;
        }
        .page-border-container {
          border: 1.5px solid #0b3a73;
          padding: 5mm;
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
          min-height: 50px;
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
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .meta-row {
          display: flex;
          align-items: baseline;
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
            margin: 8mm;
          }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .a4-page {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .page-border-container {
            width: 100% !important;
            box-sizing: border-box !important;
            border: 1.5px solid #0b3a73 !important;
            padding: 5mm !important;
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
      <script>
        // Client-side auto-trim fallback for standalone HTML or browser preview
        (function() {
          function trimLogo(img) {
            if (!img || img.dataset.trimmed) return;
            try {
              var c = document.createElement('canvas');
              var w = img.naturalWidth;
              var h = img.naturalHeight;
              if (!w || !h) return;
              c.width = w;
              c.height = h;
              var ctx = c.getContext('2d');
              if (!ctx) return;
              ctx.drawImage(img, 0, 0);
              var id = ctx.getImageData(0, 0, w, h);
              var d = id.data;
              var minX = w, minY = h, maxX = -1, maxY = -1;
              for (var y = 0; y < h; y++) {
                for (var x = 0; x < w; x++) {
                  var i = (y * w + x) * 4;
                  var a = d[i+3];
                  var r = d[i], g = d[i+1], b = d[i+2];
                  if (a >= 15 && !(a >= 225 && r > 240 && g > 240 && b > 240)) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                  }
                }
              }
              if (maxX >= minX && maxY >= minY) {
                minX = Math.max(0, minX - 1);
                minY = Math.max(0, minY - 1);
                maxX = Math.min(w - 1, maxX + 1);
                maxY = Math.min(h - 1, maxY + 1);
                var tw = maxX - minX + 1;
                var th = maxY - minY + 1;
                var tc = document.createElement('canvas');
                tc.width = tw;
                tc.height = th;
                var tctx = tc.getContext('2d');
                tctx.drawImage(c, minX, minY, tw, th, 0, 0, tw, th);
                img.dataset.trimmed = 'true';
                img.src = tc.toDataURL('image/png');
              }
            } catch (e) {}
          }
          window.addEventListener('DOMContentLoaded', function() {
            var logos = document.querySelectorAll('.store-invoice-logo');
            logos.forEach(function(img) {
              if (img.complete) trimLogo(img);
              else img.onload = function() { trimLogo(img); };
            });
          });
        })();
      </script>
    </body>
    </html>
  `;
}

/**
 * Triggers printing using a hidden iframe to prevent interrupting active application UI
 */
export async function printInvoice(bill: BillRecord): Promise<void> {
  const store = bill.storeSnapshot;
  let logoSrc: string | null = store.logoDataUrl || store.logoPath || null;
  if (!logoSrc && typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("im_medicos_store_details_singleton_v1");
      if (stored) {
        const parsed = JSON.parse(stored);
        logoSrc = parsed.logoDataUrl || parsed.logoPath || null;
      }
    } catch {}
  }

  let finalLogo = logoSrc;
  if (logoSrc) {
    try {
      finalLogo = await trimImageWhitespace(logoSrc);
    } catch {
      // Ignored
    }
  }

  const html = generateInvoiceHtml(bill, finalLogo);

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
export async function downloadInvoicePdf(bill: BillRecord): Promise<void> {
  const store = bill.storeSnapshot;
  let logoSrc: string | null = store.logoDataUrl || store.logoPath || null;
  if (!logoSrc && typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("im_medicos_store_details_singleton_v1");
      if (stored) {
        const parsed = JSON.parse(stored);
        logoSrc = parsed.logoDataUrl || parsed.logoPath || null;
      }
    } catch {}
  }

  let finalLogo = logoSrc;
  if (logoSrc) {
    try {
      finalLogo = await trimImageWhitespace(logoSrc);
    } catch {
      // Ignored
    }
  }

  const html = generateInvoiceHtml(bill, finalLogo);
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
