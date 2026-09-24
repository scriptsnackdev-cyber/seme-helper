---
name: dep-audit
description: >-
  Audits dependencies across the project to prevent bloat, duplicate packages, and unnecessary third-party libraries. Enforces stdlib and native platform solutions before adding any new package. Use when considering adding a dependency, cleaning up package.json, or optimizing build bundle size.
---

# 📦 Dependency Audit & Lean Package Runbook

This skill enforces strict dependency hygiene in accordance with Golden Rule #3 (*"Ask before adding a dependency. Prefer stdlib / existing deps in package.json"*).

---

## 🪜 The Dependency Decision Ladder

Before adding any npm package to `package.json`, evaluate in this exact order:

1. **Can Stdlib do it?**
   - Use native modern JavaScript / TypeScript / Node.js features:
     - Date math & formatting: Native `Date` and `Intl.DateTimeFormat`
     - UUID generation: `crypto.randomUUID()`
     - URL parameters: `URLSearchParams`
     - Deep cloning: `structuredClone()`
     - Array helpers: Native `find`, `some`, `every`, `flatMap`, `Object.groupBy`
2. **Can Native Platform features cover it?**
   - Native HTML5 inputs, Web APIs (`fetch`, `Headers`, `FormData`), and CSS features over custom JS widgets.
3. **Is an existing installed dependency already capable?**
   - Check existing dependencies in `package.json` before adding a competitor package.
4. **Is it explicitly requested by the user?**
   - Do NOT install UI libraries (e.g. Radix, MUI, Chakra) without explicit user permission.

---

## 🔁 Common Bloat vs. Lean Alternatives

| Overkill / Bloated Lib | Preferred Lean Alternative | Rationale |
| :--- | :--- | :--- |
| `lodash` / `underscore` | Native ES2022+ methods | Native methods are zero-bundle-overhead and faster |
| `moment` / `dayjs` | Native `Intl.DateTimeFormat` / `Date` | Built into modern JS engines |
| `axios` | Built-in `fetch` | Native in Node 18+, Next.js, and modern browsers |
| `uuid` | `crypto.randomUUID()` | Built-in Web and Node standard |
| `classnames` / `clsx` | Small 5-line inline helper or template literal | Avoid extra dependency for string concatenation |

---

## 🛠️ Audit Commands
Inspect where and why a dependency is installed:
```powershell
npm ls <package-name>
```
To check for outdated dependencies:
```powershell
npm outdated
```
