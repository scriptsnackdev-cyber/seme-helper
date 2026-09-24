---
name: scaffold-feature
description: >-
  Scaffolds new features, routes, and modules across the purrpaw-chatbot Next.js web application strictly adhering to App Router patterns, component domain organization, and quality standards. Use whenever the user asks to add a new page, route, or domain feature.
---

# 🚀 Feature Scaffolding Runbook

This skill enforces the standard structure and conventions for adding new features and routes to `purrpaw-chatbot`.

---

## 🏗️ Project Architecture & Layout

All source code lives under `src/`:

```text
src/
├── app/
│   ├── <route>/
│   │   ├── page.tsx          # Page component (thin wrapper, layout & params)
│   │   └── loading.tsx       # Route loading skeleton
│   └── api/
│       └── <domain>/
│           └── route.ts      # RESTful Route Handler (< 10ms target, edge caching)
├── components/
│   └── <domain>/             # Domain-specific UI & container components
├── hooks/                    # Custom React hooks (e.g. use<Feature>.ts)
├── store/                    # Zustand state stores (e.g. use<Domain>Store.ts)
├── lib/                      # Adapters, clients (Supabase), and external utilities
└── types/                    # TypeScript interfaces and DB types
```

---

## 🪜 Step-by-Step Scaffolding Procedure

### Step 1: Define Types & Schemas
- Define domain interfaces, request/response models, and Zod schemas in `src/types/<domain>.ts`.
- Ensure strict typing (no `any`).

### Step 2: Scaffold RESTful Route Handler (if backend endpoint needed)
- Create `src/app/api/<domain>/route.ts`.
- Enforce public edge caching for read paths (`s-maxage=30, stale-while-revalidate=120`).
- Ensure all database queries pass through authenticated Supabase client + RLS.
- Enforce pagination (`limit`, default 20, max 50) on list endpoints.

### Step 3: Build Domain Components
- Create modular components in `src/components/<domain>/`.
- Adhere to Pillar 1 styling rules:
  - **No glassmorphism, no heavy blur, no diffuse glow shadows.**
  - Plain solid colors, universal background `#F3E4F5` (`var(--background)`).
  - High-readability typography (`#2D2235`, `#5A4B64`, `#7D6E87`).
  - **Zero emojis in UI** — use Lucide icons sparingly.
  - Official icons from `/public/icons/...`.

### Step 4: Implement State Management / Hooks
- If shared client state is required, create a Zustand store in `src/store/`.
- If encapsulated client fetching is required, create a hook in `src/hooks/use<Feature>.ts` using SWR.

### Step 5: Scaffold Page Route
- Create `src/app/<route>/page.tsx`.
- Connect Topbar title and actions using `useHeaderStore` (never duplicate headers in page body).
- Ensure 100% auto-responsive mobile-first layout without horizontal scroll.

---

## 🚫 Common Pitfalls to Avoid
- ❌ Do not create duplicate headers inside page bodies (use `useHeaderStore`).
- ❌ Do not use emojis in buttons, headings, tags, or labels.
- ❌ Do not write complex fallback chains (`a || b || c`); use single explicit contracts with `??`.
- ❌ Do not create files outside `src/` or write speculative code.
