# Graph Report - medical  (2026-11-02)

## Corpus Check
- 49 files · ~22,044 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .css 1)

## Summary
- 292 nodes · 557 edges · 20 communities (16 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `48b53a88`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- package.json
- compilerOptions
- tauri.conf.json
- cn
- 4. Phase Breakdown & Roadmap
- 3. Schema Definitions
- cn
- compilerOptions
- db.rs
- IM MEDICOS — Architecture & Knowledge Graph
- default.json
- lib.rs
- im-medicos
- App.tsx
- StoreDetailsPage.tsx
- test-dashboard-flow.mjs
- IM MEDICOS — Development Progress Tracker

## God Nodes (most connected - your core abstractions)
1. `cn()` - 28 edges
2. `react` - 22 edges
3. `compilerOptions` - 18 edges
4. `lucide-react` - 17 edges
5. `Card` - 16 edges
6. `CardContent` - 16 edges
7. `StoreDetailsPage()` - 13 edges
8. `CardHeader` - 12 edges
9. `CardTitle` - 12 edges
10. `DashboardPage()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Current Active Screen State` --references--> `DashboardPage()`  [INFERRED]
  DEVELOPMENT_PROGRESS.md → src/pages/DashboardPage.tsx
- `Current Active Screen State` --references--> `LoginPage()`  [INFERRED]
  DEVELOPMENT_PROGRESS.md → src/pages/LoginPage.tsx
- `Current Active Screen State` --references--> `StoreDetailsPage()`  [INFERRED]
  DEVELOPMENT_PROGRESS.md → src/pages/StoreDetailsPage.tsx
- `App()` --calls--> `DashboardPage()`  [EXTRACTED]
  src/App.tsx → src/pages/DashboardPage.tsx
- `App()` --calls--> `LoginPage()`  [EXTRACTED]
  src/App.tsx → src/pages/LoginPage.tsx

## Import Cycles
- None detected.

## Communities (20 total, 4 thin omitted)

### Community 0 - "package.json"
Cohesion: 0.06
Nodes (40): dependencies, clsx@^2.1.1, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, tailwind-merge@^2.5.4, @tauri-apps/api@^2.0.0, devDependencies (+32 more)

### Community 1 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleResolution (+12 more)

### Community 2 - "tauri.conf.json"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 3 - "cn"
Cohesion: 0.13
Nodes (36): Current Active Screen State, lucide-react, react, LoginForm(), LoginFormProps, Logo(), LogoProps, LowStockMedicines() (+28 more)

### Community 4 - "4. Phase Breakdown & Roadmap"
Cohesion: 0.17
Nodes (11): 1. Project Overview, 2. Core Architectural Pillars, 3. Strict Development Rule & Workflow, 4. Phase Breakdown & Roadmap, IM MEDICOS — Project Master Plan, Phase 1: Foundation & Authentication (COMPLETED), Phase 2: Application Shell & Executive Dashboard (COMPLETED), Phase 3: Store Details Module (COMPLETED — Command 03) (+3 more)

### Community 5 - "3. Schema Definitions"
Cohesion: 0.20
Nodes (9): 1. Overview, 2. Entity-Relationship Diagram, 3. Schema Definitions, `bills` (Foundation), IM MEDICOS — Database Schema (SQLite Foundation), `medicines` (Foundation), `pharmacy_profile`, `store_details` (Singleton Record: ID = 1) (+1 more)

### Community 6 - "cn"
Cohesion: 0.17
Nodes (16): DevDataBanner(), LowStockMedicinesProps, RecentBillsTableProps, SalesOverviewChartProps, SummaryCardsGridProps, TopSellingMedicinesProps, formatNumberIndian(), dashboardService (+8 more)

### Community 7 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, strict, include

### Community 8 - "db.rs"
Cohesion: 0.23
Nodes (8): create_tables(), fetch_store_details(), get_connection(), init_database(), persist_store_details(), seed_default_admin(), seed_default_store(), StoreDetails

### Community 9 - "IM MEDICOS — Architecture & Knowledge Graph"
Cohesion: 0.29
Nodes (6): 1. System Architecture Overview, 2. Desktop Viewport & Scrolling Architecture, 3. Knowledge Graph (Graphify Engine), 4. Cryptographic Session Security Specification, Extracted Code Graph Summary, IM MEDICOS — Architecture & Knowledge Graph

### Community 10 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 11 - "lib.rs"
Cohesion: 0.29
Nodes (4): get_store_details(), remove_store_logo(), save_store_details(), save_store_logo()

### Community 16 - "App.tsx"
Cohesion: 0.16
Nodes (12): App(), AppLayout(), AppLayoutProps, NAV_ITEMS, NavItemConfig, NavItemKey, authService, AuthUser (+4 more)

### Community 17 - "StoreDetailsPage.tsx"
Cohesion: 0.29
Nodes (9): isValidEmail(), isValidGSTIN(), isValidIFSC(), isValidPhoneNumber(), validateStoreDetails(), DEFAULT_STORE_DETAILS, storeService, StoreDetails (+1 more)

### Community 18 - "test-dashboard-flow.mjs"
Cohesion: 0.11
Nodes (5): isValidEmail(), isValidGSTIN(), isValidIFSC(), isValidPhoneNumber(), validateStore()

### Community 19 - "IM MEDICOS — Development Progress Tracker"
Cohesion: 0.50
Nodes (3): IM MEDICOS — Development Progress Tracker, Log of Tasks & Implementation Status, Project Policy: One Screen & One Feature At A Time

## Knowledge Gaps
- **1 isolated node(s):** `im-medicos`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 127 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `cn` to `package.json`, `App.tsx`, `cn`, `StoreDetailsPage.tsx`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **What connects `im-medicos` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06201550387596899 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `cn` to `package.json`, `App.tsx`, `cn`, `StoreDetailsPage.tsx`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.12928022361984626 - nodes in this community are weakly interconnected._