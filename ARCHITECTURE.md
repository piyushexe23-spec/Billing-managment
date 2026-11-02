# IM MEDICOS — Architecture & Knowledge Graph

## 1. System Architecture Overview

IM MEDICOS is engineered with a decoupled desktop architecture:

```mermaid
graph TD
    subgraph Desktop["Windows Desktop Shell (Tauri 2)"]
        subgraph Frontend["Frontend Client (React + TypeScript)"]
            AppRoot["App Root (App.tsx)"]
            AuthMod["Authentication (LoginPage / LoginForm)"]
            AppShell["Desktop Shell (AppLayout.tsx)"]
            DashPage["Dashboard View (DashboardPage.tsx)"]
            
            subgraph DashboardComponents["Dashboard Component Modules"]
                SummaryCards["SummaryCardsGrid.tsx"]
                SalesChart["SalesOverviewChart.tsx"]
                TopMeds["TopSellingMedicines.tsx"]
                LowStock["LowStockMedicines.tsx"]
                RecentBills["RecentBillsTable.tsx"]
                DevBanner["DevDataBanner.tsx"]
            end

            subgraph DataService["Service & Utility Layer"]
                DashService["dashboardService.ts"]
                Formatters["formatters.ts (INR / Numbers)"]
                Types["types/dashboard.ts & auth.ts"]
            end
        end

        subgraph IPC["Tauri IPC Channel"]
            InvokeBridge["@tauri-apps/api/core"]
        end

        subgraph Backend["Rust Core Engine (src-tauri)"]
            TauriCore["Tauri App Runtime"]
            Lib["Library Core (lib.rs)"]
            DBModule["Database Engine (db.rs)"]
            SQLiteDriver["rusqlite (WAL mode)"]
        end

        subgraph Storage["Embedded Local Storage"]
            DBFile[("im_medicos.db (SQLite)")]
        end
    end

    AppRoot -->|unauthenticated| AuthMod
    AppRoot -->|authenticated| AppShell
    AppShell --> DashPage
    DashPage --> SummaryCards
    DashPage --> SalesChart
    DashPage --> TopMeds
    DashPage --> LowStock
    DashPage --> RecentBills
    DashPage --> DevBanner

    DashPage --> DashService
    DashService --> Formatters
    DashService --> Types

    Frontend -.->|Future IPC Commands| InvokeBridge
    InvokeBridge -.->|tauri::invoke| TauriCore
    TauriCore --> Lib
    Lib --> DBModule
    DBModule --> SQLiteDriver
    SQLiteDriver --> DBFile
```

---

## 2. Component Dependency Graph

```mermaid
graph LR
    subgraph Shell["Application Shell"]
        App["src/App.tsx"]
        AppLayout["src/components/layout/AppLayout.tsx"]
        Logo["src/components/brand/logo.tsx"]
    end

    subgraph Pages["Screens"]
        LoginPage["src/pages/LoginPage.tsx"]
        DashboardPage["src/pages/DashboardPage.tsx"]
    end

    subgraph DashboardModules["Dashboard Modules"]
        SummaryCards["SummaryCardsGrid"]
        SalesChart["SalesOverviewChart"]
        TopMeds["TopSellingMedicines"]
        LowStock["LowStockMedicines"]
        RecentBills["RecentBillsTable"]
        DevBanner["DevDataBanner"]
    end

    subgraph Services["Services & Utils"]
        Service["src/services/dashboardService.ts"]
        Formatters["src/lib/formatters.ts"]
        Utils["src/lib/utils.ts"]
    end

    App --> LoginPage
    App --> AppLayout
    AppLayout --> Logo
    AppLayout --> DashboardPage

    DashboardPage --> SummaryCards
    DashboardPage --> SalesChart
    DashboardPage --> TopMeds
    DashboardPage --> LowStock
    DashboardPage --> RecentBills
    DashboardPage --> DevBanner

    DashboardPage --> Service
    SummaryCards --> Formatters
    SalesChart --> Formatters
    TopMeds --> Formatters
    RecentBills --> Formatters
    
    SummaryCards --> Utils
    SalesChart --> Utils
    LowStock --> Utils
```

---

## 3. Knowledge Graph (Graphify Engine)

Official **Graphify** mapped AST relationships across the entire workspace:

- **Interactive Visual Graph:** `graphify-out/graph.html` (interactive nodes, links, and community clusters).
- **Graph Structural Manifest:** `graphify-out/graph.json` (node-and-edge model).
- **Architecture Summary:** `graphify-out/GRAPH_REPORT.md` (clustering breakdown).

### Extracted Code Graph Summary
- **Nodes mapped:** 237 AST symbols and code artifacts
- **Edges mapped:** 441 cross-symbol calls, imports, and definitions
- **Communities detected:** 19 functional clusters

---

## 4. Design System Compliance

- **Primary Tone:** Deep Medical Navy (`#091a32` to `#133560`) — professional clinical anchor.
- **Accent Tone:** Subtle Medical Emerald (`#059669` / `#10b981`) — represents positive trends, active status, and validation.
- **Alert Tones:** Amber (`#b45309`) and Red (`#dc2626`) — reserved exclusively for inventory depletion warnings.
- **Surfaces:** Clean White (`#ffffff`) and cool slate tint (`#f8fafc` / `#f1f5f9`).
- **Currency Standard:** Indian Rupee formatting (`₹`) with Lakhs/Crores grouping.
