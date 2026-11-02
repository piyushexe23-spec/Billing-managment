# IM MEDICOS — Architecture & Knowledge Graph

## 1. System Architecture Overview

IM MEDICOS is engineered with a decoupled desktop architecture:

```mermaid
graph TD
    subgraph Desktop["Windows Desktop Shell (Tauri 2)"]
        subgraph Frontend["Frontend Client (React + TypeScript)"]
            UI["UI Design System (shadcn/ui + Tailwind)"]
            AuthMod["Authentication Module (LoginForm)"]
            Pages["Page Views (LoginPage)"]
            State["Local Component State"]
            Brand["Branding & Assets (Logo)"]
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

    Pages --> AuthMod
    AuthMod --> UI
    Pages --> Brand
    AuthMod --> State
    Frontend -.->|IPC Commands| InvokeBridge
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
    subgraph Core["Entry Point"]
        IndexHTML["index.html"] --> Main["src/main.tsx"]
        Main --> App["src/App.tsx"]
        App --> LoginPage["src/pages/LoginPage.tsx"]
    end

    subgraph Views["Screen Views"]
        LoginPage --> LoginForm["src/components/auth/LoginForm.tsx"]
        LoginPage --> Logo["src/components/brand/logo.tsx"]
        LoginPage --> Card["src/components/ui/card.tsx"]
    end

    subgraph Primitives["Reusable Design System Components"]
        LoginForm --> Button["src/components/ui/button.tsx"]
        LoginForm --> Input["src/components/ui/input.tsx"]
        LoginForm --> Label["src/components/ui/label.tsx"]
        LoginForm --> Checkbox["src/components/ui/checkbox.tsx"]
        LoginForm --> Alert["src/components/ui/alert.tsx"]
        
        Button --> Utils["src/lib/utils.ts"]
        Input --> Utils
        Label --> Utils
        Card --> Utils
        Checkbox --> Utils
        Alert --> Utils
        Logo --> Utils
    end

    subgraph Types["Type Contracts"]
        LoginForm --> AuthTypes["src/types/auth.ts"]
    end
```

---

## 3. Knowledge Graph (Graphify Engine)

Official **Graphify** has been installed and generated interactive AST mappings of the codebase:

- **Interactive Knowledge Graph:** `graphify-out/graph.html` (visualizes code modules, dependencies, and cross-file relationships).
- **Graph Structural Manifest:** `graphify-out/graph.json` (node-and-edge graph model for semantic traversal).
- **Architecture Summary:** `graphify-out/GRAPH_REPORT.md` (clustering and community breakdown).

### Extracted Code Graph Summary
- **Nodes mapped:** 154 AST symbols and code artifacts
- **Edges mapped:** 229 cross-symbol calls, imports, and definitions
- **Communities detected:** 16 functional clusters

---

## 4. Frontend Design System Guidelines

- **Primary Tone:** Deep Medical Navy (`#0d2545` / `#133560`) — conveys trustworthiness, clinical precision, and commercial Windows software quality.
- **Accent Tone:** Subtle Medical Emerald (`#059669` / `#10b981`) — represents health, active status, and validation confirmation.
- **Surfaces:** Clean White (`#ffffff`) and cool slate tint (`#f8fafc` / `#f1f5f9`).
- **Borders & Dividers:** High-precision subtle borders (`#e2e8f0`).
- **Typography:** Segoe UI / Inter modern sans-serif typography with strict visual hierarchy.
