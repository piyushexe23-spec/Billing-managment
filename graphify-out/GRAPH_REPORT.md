# Graph Report - medical  (2026-11-02)

## Corpus Check
- 25 files · ~3,450 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 1 file(s) not represented in the graph (top: .css 1)

## Summary
- 154 nodes · 229 edges · 16 communities (11 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- package.json
- compilerOptions
- tauri.conf.json
- LoginForm.tsx
- react
- utils.ts
- dependencies
- compilerOptions
- db.rs
- cn
- default.json
- im-medicos

## God Nodes (most connected - your core abstractions)
1. `cn()` - 20 edges
2. `compilerOptions` - 18 edges
3. `react` - 13 edges
4. `LoginForm()` - 8 edges
5. `lucide-react` - 7 edges
6. `LoginPage()` - 7 edges
7. `compilerOptions` - 7 edges
8. `init_database()` - 5 edges
9. `build` - 5 edges
10. `scripts` - 4 edges

## Surprising Connections (you probably didn't know these)
- `LoginPage()` --calls--> `LoginForm()`  [EXTRACTED]
  src/pages/LoginPage.tsx → src/components/auth/LoginForm.tsx
- `Logo()` --calls--> `cn()`  [EXTRACTED]
  src/components/brand/logo.tsx → src/lib/utils.ts
- `Alert` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/alert.tsx → src/lib/utils.ts
- `Button` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/button.tsx → src/lib/utils.ts
- `Card` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/card.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (16 total, 5 thin omitted)

### Community 0 - "package.json"
Cohesion: 0.09
Nodes (27): devDependencies, autoprefixer@^10.4.20, postcss@^8.4.47, tailwindcss@^3.4.14, @types/node@^22.9.0, @types/react@^18.3.12, @types/react-dom@^18.3.1, typescript@^5.6.3 (+19 more)

### Community 1 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleResolution (+12 more)

### Community 2 - "tauri.conf.json"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 3 - "LoginForm.tsx"
Cohesion: 0.24
Nodes (10): LoginForm(), LoginFormProps, Alert, Button, Checkbox, Input, Label, LabelProps (+2 more)

### Community 4 - "react"
Cohesion: 0.32
Nodes (7): react, App(), Logo(), LogoProps, Card, CardContent, LoginPage()

### Community 5 - "utils.ts"
Cohesion: 0.22
Nodes (6): lucide-react@^0.460.0, lucide-react, AlertProps, ButtonProps, CheckboxProps, InputProps

### Community 6 - "dependencies"
Cohesion: 0.20
Nodes (10): dependencies, clsx@^2.1.1, react@^18.3.1, react-dom@^18.3.1, tailwind-merge@^2.5.4, @tauri-apps/api@^2.0.0, clsx, react-dom (+2 more)

### Community 7 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, strict, include

### Community 8 - "db.rs"
Cohesion: 0.43
Nodes (3): create_tables(), init_database(), seed_default_admin()

### Community 9 - "cn"
Cohesion: 0.60
Nodes (5): CardDescription, CardFooter, CardHeader, CardTitle, cn()

### Community 10 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

## Knowledge Gaps
- **1 isolated node(s):** `im-medicos`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 73 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `package.json`, `LoginForm.tsx`, `utils.ts`, `dependencies`, `cn`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **What connects `im-medicos` to the rest of the system?**
  _1 weakly-connected nodes found - possible missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.0896551724137931 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `utils.ts` to `package.json`, `LoginForm.tsx`, `react`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._