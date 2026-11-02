# Graph Report - medical  (2026-11-02)

## Corpus Check
- 44 files · ~13,692 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .css 1)

## Summary
- 252 nodes · 461 edges · 18 communities (12 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `36675b31`
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
- im-medicos
- App.tsx

## God Nodes (most connected - your core abstractions)
1. `cn()` - 28 edges
2. `react` - 21 edges
3. `compilerOptions` - 18 edges
4. `lucide-react` - 16 edges
5. `Card` - 14 edges
6. `CardContent` - 14 edges
7. `DashboardPage()` - 11 edges
8. `CardHeader` - 10 edges
9. `CardTitle` - 10 edges
10. `SalesOverviewChart()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Current Active Screen State` --references--> `DashboardPage()`  [INFERRED]
  DEVELOPMENT_PROGRESS.md → src/pages/DashboardPage.tsx
- `Current Active Screen State` --references--> `LoginPage()`  [INFERRED]
  DEVELOPMENT_PROGRESS.md → src/pages/LoginPage.tsx
- `App()` --calls--> `DashboardPage()`  [EXTRACTED]
  src/App.tsx → src/pages/DashboardPage.tsx
- `LoginPage()` --calls--> `LoginForm()`  [EXTRACTED]
  src/pages/LoginPage.tsx → src/components/auth/LoginForm.tsx
- `Logo()` --calls--> `cn()`  [EXTRACTED]
  src/components/brand/logo.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (18 total, 6 thin omitted)

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
Cohesion: 0.17
Nodes (19): lucide-react, react, LoginForm(), LoginFormProps, Alert, AlertProps, Button, ButtonProps (+11 more)

### Community 4 - "4. Phase Breakdown & Roadmap"
Cohesion: 0.18
Nodes (10): 1. Project Overview, 2. Core Architectural Pillars, 3. Strict Development Rule & Workflow, 4. Phase Breakdown & Roadmap, IM MEDICOS — Project Master Plan, Phase 1: Foundation & Authentication (COMPLETED), Phase 2: Application Shell & Executive Dashboard (COMPLETED), Phase 3: Pharmacy Medicine Master & Inventory (Pending Approval) (+2 more)

### Community 5 - "3. Schema Definitions"
Cohesion: 0.22
Nodes (8): 1. Overview, 2. Entity-Relationship Diagram, 3. Schema Definitions, `bills` (Foundation), IM MEDICOS — Database Schema (SQLite Foundation), `medicines` (Foundation), `pharmacy_profile`, `users`

### Community 6 - "cn"
Cohesion: 0.18
Nodes (27): DevDataBanner(), LowStockMedicines(), LowStockMedicinesProps, RecentBillsTable(), RecentBillsTableProps, SalesOverviewChart(), SalesOverviewChartProps, SummaryCardsGrid() (+19 more)

### Community 7 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, strict, include

### Community 8 - "db.rs"
Cohesion: 0.43
Nodes (3): create_tables(), init_database(), seed_default_admin()

### Community 9 - "IM MEDICOS — Architecture & Knowledge Graph"
Cohesion: 0.29
Nodes (6): 1. System Architecture Overview, 2. Component Dependency Graph, 3. Knowledge Graph (Graphify Engine), 4. Design System Compliance, Extracted Code Graph Summary, IM MEDICOS — Architecture & Knowledge Graph

### Community 10 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 16 - "App.tsx"
Cohesion: 0.10
Nodes (20): Current Active Screen State, IM MEDICOS — Development Progress Tracker, Log of Tasks & Implementation Status, Project Policy: One Screen & One Feature At A Time, App(), Logo(), LogoProps, AppLayout() (+12 more)

## Knowledge Gaps
- **1 isolated node(s):** `im-medicos`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 120 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `cn` to `package.json`, `App.tsx`, `cn`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **What connects `im-medicos` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06201550387596899 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `cn` to `package.json`, `App.tsx`, `cn`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Why does `cn()` connect `cn` to `App.tsx`, `cn`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._