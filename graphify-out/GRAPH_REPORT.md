# Graph Report - medical  (2026-11-02)

## Corpus Check
- 30 files · ~5,592 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .css 1)

## Summary
- 191 nodes · 262 edges · 20 communities (13 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2085a339`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- package.json
- compilerOptions
- tauri.conf.json
- cn
- 4. Phase Breakdown & Roadmap
- 3. Schema Definitions
- dependencies
- compilerOptions
- db.rs
- IM MEDICOS — Architecture & Knowledge Graph
- default.json
- im-medicos
- IM MEDICOS — Development Progress Tracker
- scripts
- auth.ts

## God Nodes (most connected - your core abstractions)
1. `cn()` - 20 edges
2. `compilerOptions` - 18 edges
3. `react` - 13 edges
4. `LoginForm()` - 8 edges
5. `LoginPage()` - 8 edges
6. `lucide-react` - 7 edges
7. `compilerOptions` - 7 edges
8. `4. Phase Breakdown & Roadmap` - 6 edges
9. `scripts` - 5 edges
10. `init_database()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Current Active Screen` --references--> `LoginPage()`  [INFERRED]
  DEVELOPMENT_PROGRESS.md → src/pages/LoginPage.tsx
- `App()` --calls--> `LoginPage()`  [EXTRACTED]
  src/App.tsx → src/pages/LoginPage.tsx
- `CardHeader` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/card.tsx → src/lib/utils.ts
- `CardTitle` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/card.tsx → src/lib/utils.ts
- `CardDescription` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/card.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (20 total, 7 thin omitted)

### Community 0 - "package.json"
Cohesion: 0.11
Nodes (23): devDependencies, autoprefixer@^10.4.20, postcss@^8.4.47, tailwindcss@^3.4.14, @types/node@^22.9.0, @types/react@^18.3.12, @types/react-dom@^18.3.1, typescript@^5.6.3 (+15 more)

### Community 1 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleResolution (+12 more)

### Community 2 - "tauri.conf.json"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 3 - "cn"
Cohesion: 0.16
Nodes (24): lucide-react, react, LoginForm(), LoginFormProps, Logo(), LogoProps, Alert, AlertProps (+16 more)

### Community 4 - "4. Phase Breakdown & Roadmap"
Cohesion: 0.18
Nodes (10): 1. Project Overview, 2. Core Architectural Pillars, 3. Strict Development Rule & Workflow, 4. Phase Breakdown & Roadmap, IM MEDICOS — Project Master Plan, Phase 1: Foundation & Authentication (Current), Phase 2: Navigation Shell & Dashboard (Pending Approval), Phase 3: Pharmacy Medicine Master & Inventory (Pending Approval) (+2 more)

### Community 5 - "3. Schema Definitions"
Cohesion: 0.22
Nodes (8): 1. Overview, 2. Entity-Relationship Diagram, 3. Schema Definitions, `bills` (Foundation), IM MEDICOS — Database Schema (SQLite Foundation), `medicines` (Foundation), `pharmacy_profile`, `users`

### Community 6 - "dependencies"
Cohesion: 0.14
Nodes (12): dependencies, clsx@^2.1.1, lucide-react@^0.460.0, react@^18.3.1, react-dom@^18.3.1, tailwind-merge@^2.5.4, @tauri-apps/api@^2.0.0, clsx (+4 more)

### Community 7 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, strict, include

### Community 8 - "db.rs"
Cohesion: 0.43
Nodes (3): create_tables(), init_database(), seed_default_admin()

### Community 9 - "IM MEDICOS — Architecture & Knowledge Graph"
Cohesion: 0.29
Nodes (6): 1. System Architecture Overview, 2. Component Dependency Graph, 3. Knowledge Graph (Graphify Engine), 4. Frontend Design System Guidelines, Extracted Code Graph Summary, IM MEDICOS — Architecture & Knowledge Graph

### Community 10 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 16 - "IM MEDICOS — Development Progress Tracker"
Cohesion: 0.40
Nodes (4): Current Active Screen, IM MEDICOS — Development Progress Tracker, Log of Tasks & Implementation Status, Project Policy: One Screen & One Feature At A Time

### Community 17 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, preview, test

## Knowledge Gaps
- **1 isolated node(s):** `im-medicos`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 101 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `cn` to `package.json`, `dependencies`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **What connects `im-medicos` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1076923076923077 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `cn` to `package.json`, `dependencies`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Why does `LoginPage()` connect `cn` to `IM MEDICOS — Development Progress Tracker`, `dependencies`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._