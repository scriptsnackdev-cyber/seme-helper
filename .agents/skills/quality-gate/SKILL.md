---
name: quality-gate
description: >-
  Enforces strict code quality checks, TypeScript type checking, ESLint compliance, and anti-pattern scans. Use whenever validating changes before finishing a task, running code audits, checking for legacy fallback chains, or when the user asks to "run quality gate", "check type errors", "lint", or "verify code".
---

# 🛡️ Quality Gate Runbook

This skill outlines the strict validation standards required for every code modification in `purrpaw-chatbot`. No changes should be finalized without passing these quality gates.

---

## 📋 Quality Gate Checklist

| Gate | Check Item | Requirement | Command / Check Method |
| :--- | :--- | :--- | :--- |
| **1. TypeScript** | Static type check | **0 Errors** | `npx tsc --noEmit` |
| **2. ESLint** | Linter rules & formatting | **0 Errors, 0 Warnings** | `npm run lint` |
| **3. Fallbacks** | Zero redundant fallback chains | No `a \|\| b \|\| c` | Audit code diffs; use `??` for intentional defaults |
| **4. Emojis** | Strict emoji ban in UI | No emojis in UI | Check UI components for emojis; use Lucide sparingly |
| **5. Timezone** | Bangkok Timezone enforcement | UTC+7 / `Asia/Bangkok` | Grep dates/resets for `Asia/Bangkok` |
| **6. Header Rules** | Duplicate header prevention | Global Topbar via `useHeaderStore` | Check no duplicate `<header>` in page bodies |

---

## 🛠️ Step-by-Step Verification Procedure

### Step 1: TypeScript Type Checking
Run typecheck across the project:
```powershell
npx tsc --noEmit
```
- **Rule:** If any TypeScript error appears, fix the root type definition or interface. Do not use `any` or `@ts-ignore` without a comment explaining why.

### Step 2: ESLint Verification
Run the project linter:
```powershell
npm run lint
```
- **Rule:** Fix all warnings and errors. Ensure there are no unused variables, unhandled promises, or missing React hook dependencies.

### Step 3: Anti-Pattern Scan (Redundant Fallback Chains)
Check modified files for legacy dual-schema or multi-tier fallbacks:
- ❌ **Anti-pattern:**
  ```typescript
  const images = res?.data?.images || res?.data?.data?.images || [];
  const name = user?.display_name || user?.name || profile?.name || 'Guest';
  ```
- ✅ **Standard pattern:**
  ```typescript
  // Single explicit schema contract with nullish coalescing
  const images = res?.data?.images ?? [];
  const name = user?.display_name ?? 'Guest';
  ```

### Step 4: Timezone & Daily Reset Audit
Verify that any date-time arithmetic, daily reward claim, streak calculation, or timer uses Bangkok timezone:
```typescript
const BANGKOK_TZ = 'Asia/Bangkok';
```

---

## 🎯 Completion Criteria
A task is considered complete only when:
1. `npx tsc --noEmit` exits with status code 0.
2. `npm run lint` exits with 0 errors and 0 warnings.
3. All file changes adhere to the Golden Rules and Tri-Pillar Principle in `AGENTS.md`.
