# IM MEDICOS — Architecture & Knowledge Graph

## 1. System Architecture Overview

IM MEDICOS is engineered with a decoupled desktop architecture:

```mermaid
graph TD
    subgraph Desktop["Windows Desktop Shell (Tauri 2)"]
        subgraph Frontend["Frontend Client (React + TypeScript)"]
            AppRoot["App Root (App.tsx)"]
            AuthMod["Authentication (LoginPage / LoginForm)"]
            AuthService["Cryptographic Session Service (authService.ts)"]
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
            SessionVault[("Workstation Session Vault (HMAC-SHA256)")]
        end
    end

    AppRoot -->|restores session| AuthService
    AuthService --> SessionVault
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

## 2. Desktop Viewport & Scrolling Architecture

```mermaid
graph TD
    subgraph Viewport["Full Viewport Shell (h-screen max-h-screen w-screen overflow-hidden)"]
        subgraph SidebarCol["Stationary Sidebar (h-full flex-shrink-0)"]
            BrandHeader["Brand Header (h-16 flex-shrink-0)"]
            NavList["Nav Items (flex-1 overflow-y-auto)"]
            UserArea["User Badge & Logout (h-auto flex-shrink-0)"]
        end
        
        subgraph MainCol["Main Area (flex-1 flex flex-col h-full min-w-0 min-h-0 overflow-hidden)"]
            StickyNav["Sticky Top Navbar (h-16 flex-shrink-0 z-20)"]
            NoticeBanner["Notice Banner (flex-shrink-0)"]
            ScrollContainer["Primary Scroll Container (main flex-1 min-h-0 overflow-y-auto)"]
            StickyFooter["Sticky Desktop Footer (h-9 flex-shrink-0 z-10)"]
        end
    end

    BrandHeader --- NavList --- UserArea
    StickyNav --- NoticeBanner --- ScrollContainer --- StickyFooter
```

---

## 3. Knowledge Graph (Graphify Engine)

Official **Graphify** mapped AST relationships across the entire workspace:

- **Interactive Visual Graph:** `graphify-out/graph.html` (interactive nodes, links, and community clusters).
- **Graph Structural Manifest:** `graphify-out/graph.json` (node-and-edge model).
- **Architecture Summary:** `graphify-out/GRAPH_REPORT.md` (clustering breakdown).

### Extracted Code Graph Summary
- **Nodes mapped:** 252 AST symbols and code artifacts
- **Edges mapped:** 461 cross-symbol calls, imports, and definitions
- **Communities detected:** 18 functional clusters

---

## 4. Cryptographic Session Security Specification

- **Zero Plain-Text Credentials:** Passwords are never serialized into persistent client storage.
- **HMAC-SHA256 Token Signing:** Every session ticket is signed via the native Web Crypto API (`crypto.subtle`) using a local workstation key.
- **Tamper Protection:** Any out-of-band manipulation of `username`, `role`, or `expiresAt` in client storage invalidates the cryptographic signature, triggering an immediate session purge.
- **No Login Flash:** Application initialization displays an integrated security loading splash while asynchronous session restoration occurs.
