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
> Never generate entire software at once or jump to the next screen without explicit user approval.
> After completing each task: run the application, test it, fix errors, update documentation, and await approval.

---

## 4. Phase Breakdown & Roadmap

### Phase 1: Foundation & Authentication (Current)
- [x] **Task 1:** Workspace Inspection and Project Initialization (Tauri 2, React, TypeScript, Vite, Tailwind, shadcn/ui, Rust + SQLite foundation)
- [x] **Task 2:** Design System Implementation (Medical Navy primary, emerald green subtle accents, crisp light surfaces, clean cards & typography)
- [x] **Task 3:** Login Screen (Single screen with brand identity, inputs, validation, password toggle, dev-mode test credentials)
- [x] **Task 4:** Architecture Documentation, Graphify Integration, and Mermaid Schema mapping
- [x] **Task 5:** Verification and Testing

### Phase 2: Navigation Shell & Dashboard (Pending Approval)
- [ ] Application window chrome and desktop header
- [ ] Role-aware navigation sidebar (Billing, Inventory, Invoices, Customers, Reports, Settings)
- [ ] Daily revenue metrics, low stock indicators, and quick billing shortcuts

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
