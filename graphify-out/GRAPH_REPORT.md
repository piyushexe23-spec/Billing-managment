# Graph Report - medical  (2026-11-03)

## Corpus Check
- 59 files · ~40,575 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .css 1)

## Summary
- 394 nodes · 823 edges · 19 communities (15 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dc0ed2e6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- package.json
- compilerOptions
- tauri.conf.json
- cn
- 4. Phase Breakdown & Roadmap
- 3. Schema Definitions
- DashboardPage.tsx
- compilerOptions
- db.rs
- IM MEDICOS — Architecture & Knowledge Graph
- default.json
- lib.rs
- im-medicos
- StoreDetailsPage.tsx
- test-dashboard-flow.mjs
- medicineService.ts

## God Nodes (most connected - your core abstractions)
1. `react` - 28 edges
2. `cn()` - 28 edges
3. `lucide-react` - 23 edges
4. `Button` - 20 edges
5. `compilerOptions` - 18 edges
6. `Card` - 16 edges
7. `CardContent` - 16 edges
8. `StoreDetailsPage()` - 13 edges
9. `CardHeader` - 12 edges
10. `CardTitle` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Current Active Screen State` --references--> `LoginPage()`  [INFERRED]
  DEVELOPMENT_PROGRESS.md → src/pages/LoginPage.tsx
- `Current Active Screen State` --references--> `MedicinesPage()`  [INFERRED]
  DEVELOPMENT_PROGRESS.md → src/pages/MedicinesPage.tsx
- `Log of Tasks & Implementation Status` --references--> `AddMedicineModal()`  [INFERRED]
  DEVELOPMENT_PROGRESS.md → src/components/medicines/AddMedicineModal.tsx
- `Log of Tasks & Implementation Status` --references--> `BulkImportModal()`  [INFERRED]
  DEVELOPMENT_PROGRESS.md → src/components/medicines/BulkImportModal.tsx
- `Log of Tasks & Implementation Status` --references--> `ExportModal()`  [INFERRED]
  DEVELOPMENT_PROGRESS.md → src/components/medicines/ExportModal.tsx

## Import Cycles
- None detected.

## Communities (19 total, 4 thin omitted)

### Community 0 - "package.json"
Cohesion: 0.06
Nodes (42): dependencies, clsx@^2.1.1, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, tailwind-merge@^2.5.4, @tauri-apps/api@^2.0.0, xlsx@^0.18.5 (+34 more)

### Community 1 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleResolution (+12 more)

### Community 2 - "tauri.conf.json"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 3 - "cn"
Cohesion: 0.09
Nodes (31): lucide-react, react, App(), LoginForm(), LoginFormProps, Logo(), LogoProps, AppLayout() (+23 more)

### Community 4 - "4. Phase Breakdown & Roadmap"
Cohesion: 0.17
Nodes (11): 1. Project Overview, 2. Core Architectural Pillars, 3. Strict Development Rule & Workflow, 4. Phase Breakdown & Roadmap, IM MEDICOS — Project Master Plan, Phase 1: Foundation & Authentication (COMPLETED), Phase 2: Application Shell & Executive Dashboard (COMPLETED), Phase 3: Store Details Module (COMPLETED — Command 03) (+3 more)

### Community 5 - "3. Schema Definitions"
Cohesion: 0.17
Nodes (11): 1. Overview, 2. Entity-Relationship Diagram, 3. Schema Definitions, `bills` (Foundation), IM MEDICOS — Database Schema (SQLite Foundation), `medicine_batches`, `medicines`, `pharmacy_profile` (+3 more)

### Community 6 - "DashboardPage.tsx"
Cohesion: 0.14
Nodes (32): Current Active Screen State, IM MEDICOS — Development Progress Tracker, Project Policy: One Screen & One Feature At A Time, DevDataBanner(), LowStockMedicines(), LowStockMedicinesProps, RecentBillsTable(), RecentBillsTableProps (+24 more)

### Community 7 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, strict, include

### Community 8 - "db.rs"
Cohesion: 0.14
Nodes (23): adjust_batch_stock(), archive_medicine(), create_tables(), fetch_inventory_summary(), fetch_medicine_by_id(), fetch_medicines_with_batches(), fetch_stock_movements(), fetch_store_details() (+15 more)

### Community 9 - "IM MEDICOS — Architecture & Knowledge Graph"
Cohesion: 0.29
Nodes (6): 1. System Architecture Overview, 2. Desktop Viewport & Scrolling Architecture, 3. Knowledge Graph (Graphify Engine), 4. Cryptographic Session Security Specification, Extracted Code Graph Summary, IM MEDICOS — Architecture & Knowledge Graph

### Community 10 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 11 - "lib.rs"
Cohesion: 0.15
Nodes (12): add_medicine_batch(), adjust_stock(), archive_medicine(), create_medicine(), get_inventory_summary(), get_medicine_by_id(), get_medicines(), get_stock_movements() (+4 more)

### Community 17 - "StoreDetailsPage.tsx"
Cohesion: 0.32
Nodes (9): isValidEmail(), isValidGSTIN(), isValidIFSC(), isValidPhoneNumber(), validateStoreDetails(), DEFAULT_STORE_DETAILS, storeService, StoreDetails (+1 more)

### Community 18 - "test-dashboard-flow.mjs"
Cohesion: 0.09
Nodes (8): calculateExpiryStatus(), getLocalTodayStr(), getOffsetDateStr(), isValidEmail(), isValidGSTIN(), isValidIFSC(), isValidPhoneNumber(), validateStore()

### Community 19 - "medicineService.ts"
Cohesion: 0.07
Nodes (50): Log of Tasks & Implementation Status, AddMedicineModal(), AddMedicineModalProps, COMMON_CATEGORIES, COMMON_UNITS, BulkImportModal(), BulkImportModalProps, ExportModal() (+42 more)

## Knowledge Gaps
- **1 isolated node(s):** `im-medicos`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 149 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `cn` to `package.json`, `StoreDetailsPage.tsx`, `medicineService.ts`, `DashboardPage.tsx`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **What connects `im-medicos` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.0595959595959596 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `cn` to `package.json`, `StoreDetailsPage.tsx`, `medicineService.ts`, `DashboardPage.tsx`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Why does `Button` connect `medicineService.ts` to `StoreDetailsPage.tsx`, `cn`, `DashboardPage.tsx`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._