# IM MEDICOS — Project Master Plan

## 1. Project Overview
**IM MEDICOS** is a commercial-grade, desktop-first Medical Billing and Pharmacy Management application built for high reliability, offline capabilities, zero-cloud data leakage, and rapid billing workflow execution.

---

## 2. Core Architectural Pillars
- **Desktop Runtime:** Tauri 2 (Lightweight, low memory, Windows native performance)
- **Frontend Stack:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui component architecture, Lucide icons
- **Backend & Database:** Rust backend runtime with embedded SQLite (WAL mode, offline-first, local transaction integrity)
- **Codebase Knowledge Graph:** Graphify AST-based knowledge graph mapping (`graphify-out/graph.html`, `graph.json`, `GRAPH_REPORT.md`)

---

## 3. Strict Development Rule & Workflow
All development strictly adheres to the rule:
> **Build ONE SCREEN AT A TIME and ONE FEATURE AT A TIME.**
> Never generate the entire software at once or jump to the next screen without explicit user approval.
> After completing each task: run the application, test it, fix errors, update documentation, and await approval.

---

## 4. Phase Breakdown & Roadmap

### Phase 1: Foundation & Authentication (COMPLETED)
- [x] **Task 1:** Workspace Inspection and Project Initialization (Tauri 2, React, TypeScript, Vite, Tailwind, shadcn/ui, Rust + SQLite foundation)
- [x] **Task 2:** Design System Implementation (Medical Navy primary, emerald green subtle accents, crisp light surfaces, clean cards & typography)
- [x] **Task 3:** Login Screen (Single screen with brand identity, inputs, validation, password toggle, dev-mode test credentials)
- [x] **Task 4:** Architecture Documentation, Graphify Integration, and Mermaid Schema mapping
- [x] **Task 5:** Verification and Testing

### Phase 2: Application Shell & Executive Dashboard (COMPLETED)
- [x] Desktop application layout (`AppLayout.tsx`) with collapsible sidebar and desktop header
- [x] 9-item navigation list with clear non-implemented markers for deferred screens
- [x] 6 Executive Summary KPI Cards (Today's Sales, Today's Profit, Today's Bills, Month Sales, Total Medicines, Low Stock Medicines)
- [x] Interactive Sales Overview SVG Chart with 7d / 30d / 12m date range selectors and ₹ tooltips
- [x] Top 5 Selling Medicines with sold volume and ₹ revenue
- [x] Low Stock Medicines alerts with critical/reorder tags and proper empty state
- [x] Recent Bills ledger (5 most recent transactions)
- [x] Clean decoupled TypeScript service layer (`dashboardService.ts`) with development sample data
- [x] Authentication integration: Login transitions into Dashboard; Logout returns cleanly to Login
- [x] Master bug fix: locked viewport height, independent vertical scrolling, 16x toggle consistency, HMAC-SHA256 session persistence
- [x] Sidebar branding fix: white text contrast in dark theme, centered emblem in collapsed mode, clipping elimination

### Phase 3: Store Details Module (COMPLETED — Command 03)
- [x] Complete Store Details screen (`StoreDetailsPage.tsx`) accessible from sidebar navigation
- [x] Section A: Pharmacy Information (Name, Address, Phone, Email, GSTIN, Drug Licenses 1 & 2)
- [x] Section B: Owner & Pharmacist Information (Owner Name, Pharmacist Name, Registration No.)
- [x] Section C: Invoice Configuration (Prefix, Starting Bill #, GSTIN toggle, Words toggle, Footer Terms)
- [x] Section D: Bank & UPI Details (Bank Name, Holder Name, Account No., IFSC, UPI ID with internal notice)
- [x] Section E: Inventory Settings (Default Low Stock Alert Quantity)
- [x] Section F: Pharmacy Logo (Upload, preview, replace, remove, PNG/JPG/JPEG under 2MB, local app data directory storage)
- [x] SQLite singleton record enforcement (`CHECK (id = 1)`) with UPSERT queries in Rust backend
- [x] Tauri IPC commands (`get_store_details`, `save_store_details`, `save_store_logo`, `remove_store_logo`)
- [x] Form state management with "Unsaved Changes" indicator, reset confirmation, and validation errors
- [x] Comprehensive test suite expanded to 30 tests (`npm test` 100% passing)

### Phase 4: Pharmacy Medicine Master & Inventory (COMPLETED — Command 04)
- [x] Complete Medicine Inventory Dashboard (`MedicinesPage.tsx`) accessible via sidebar navigation
- [x] 4 Live Summary Cards (Total Meds & Units, Top Selling Meds with honest billing empty state, Low/Out-of-Stock clickable filter, 10-day Expiring Soon & Expired clickable filter)
- [x] Comprehensive Medicine Listing Table with configurable pagination (10, 25, 50 rows), sorting, and visual status badges
- [x] Fast multi-field search (Name, Generic, Manufacturer, Category, Barcode, Batch Number)
- [x] Advanced Filter bar (Stock Status, Expiry Window, Manufacturer, Category) with Clear Filters
- [x] Add Single Medicine modal (`AddMedicineModal.tsx`) with opening batch, pricing anomaly warning review
- [x] Relational multi-batch inventory (`medicine_batches` table) with individual expiry dates, MRP, cost, and selling prices
- [x] Medicine Detail View (`MedicineDetailModal.tsx`) with active batches, "Add New Batch" form, and stock movement audit ledger
- [x] Stock Adjustment workflow (`StockAdjustmentModal.tsx`) supporting Add/Reduce with negative stock prevention and audit reasons
- [x] Full Bulk Import wizard (`BulkImportModal.tsx`) supporting Excel (.xlsx) and CSV (.csv), row validation, sample template download, and duplicate strategy (Skip vs Update)
- [x] Full Inventory Export (`ExportModal.tsx`) supporting Excel (.xlsx) and CSV (.csv) across all or filtered scopes
- [x] Soft-delete / archiving mechanism preserving historical transactions
- [x] Future billing compatibility: FEFO (First Expiry, First Out) batch selector, expired batch exclusion, internal cost price isolation
- [x] SQLite relational schema, composite indexes, and Tauri IPC commands in Rust
- [x] Automated test suite expanded to 40 tests (`npm test` 100% passing)

### Phase 5: Fast Point-of-Sale Billing (Pending Approval)
- [ ] Barcode / keyboard-first medicine lookup
- [ ] Automatic GST calculation (CGST/SGST), batch auto-selection (FIFO)
- [ ] Patient detail capture, doctor prescription tagging, printable invoice generation

### Phase 5: Transaction Reports & Auditing (Pending Approval)
- [ ] Daily sales report, tax summary reports, profit and margin analysis
- [ ] SQLite automated backups and secure export
