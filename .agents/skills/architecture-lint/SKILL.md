---
name: architecture-lint
description: >-
  Detects architectural boundary violations across the purrpaw-chatbot codebase, such as server/client leakage, duplicate headers, emoji usage in UI, and redundant fallback chains. Use when auditing architecture, refactoring code, or verifying compliance before merging.
---

# 📐 Architecture Lint Runbook

This skill verifies that all code adheres strictly to the architectural boundaries, UI standards, and import rules set forth in `AGENTS.md`.

---

## 🧭 Layering & Import Direction

The import flow inside `src/` is strictly structured:

$$\text{src/app/} \longrightarrow \text{src/components/} \longrightarrow \text{src/hooks/} \longrightarrow \text{src/store/} \longrightarrow \text{src/lib/}$$

- ✅ `app/` may import from `components/`, `hooks/`, `store/`, `lib/`, `types/`, `utils/`.
- ✅ `components/` may import from `hooks/`, `store/`, `lib/`, `types/`, `utils/`.
- ✅ Always use standard TypeScript path alias `@/...` (e.g. `@/components/ui/Button`).

---

## 🔍 Verification Checks & Search Patterns

### 1. Client / Server Boundary Leakage
Files marked with `'use client'` must NEVER import server-only modules or secret environment variables:
- **No private env access in client files:** Client code must only access `NEXT_PUBLIC_*` variables.
- **Check server-only imports:** Ensure server-only database operations or secrets are not imported into client components.

### 2. Duplicate Header Violation
All pages must control the global Topbar via `useHeaderStore`. Page bodies should not define duplicate stacked `<header>` tags:
```powershell
git grep -n "<header" src/app/
```
*Review matches: ensure page bodies do not render duplicate header bars.*

### 3. Emoji Usage in UI
Strict ban on emojis in UI elements (buttons, labels, badges, headers):
```powershell
git grep -P "[\x{1F600}-\x{1F64F}\x{1F300}-\x{1F5FF}\x{1F680}-\x{1F6FF}\x{2600}-\x{26FF}\x{2700}-\x{27BF}]" src/components/
```
*Expected result: 0 matches in UI components.*

### 4. Redundant Fallback Chains
Detect multi-tier fallback chains (`a || b || c`):
```powershell
git grep -n -E "(\?\..+\s*\|\|\s*.*\?\..+\s*\|\|)" src/
```
*Standardize on single explicit data contracts with nullish coalescing (`??`).*

---

## 🎯 Remediation Guide
1. **Header Duplication:** Remove the inner `<header>` and configure `useHeaderStore.getState().setHeader(...)` or `useHeaderStore` hook in the page/component.
2. **Emoji in UI:** Replace emojis with appropriate Lucide icons or clean textual labels.
3. **Fallback Chains:** Normalize data at the boundary and replace `||` chains with `??` and explicit typing.
