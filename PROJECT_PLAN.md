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
- [x] Updated automated test suite (`14 tests passed`) and Graphify Knowledge Graph (`237 nodes`)

### Phase 3: Pharmacy Medicine Master & Inventory (Pending Approval)
- [ ] Medicine directory with batch numbers, expiry dates, HSN codes, MRP, purchase rates
- [ ] Real-time stock calculation and expiry alerts
- [ ] Rapid search by trade name and generic composition

### Phase 4: Fast Point-of-Sale Billing (Pending Approval)
- [ ] Barcode / keyboard-first medicine lookup
- [ ] Automatic GST calculation (CGST/SGST), batch auto-selection (FIFO)
- [ ] Patient detail capture, doctor prescription tagging, printable invoice generation

### Phase 5: Transaction Reports & Auditing (Pending Approval)
- [ ] Daily sales report, tax summary reports, profit and margin analysis
- [ ] SQLite automated backups and secure export
