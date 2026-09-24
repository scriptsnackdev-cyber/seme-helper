# AGENTS.md — purrpaw-chatbot

## What This Is
Single Next.js App (Web only) + TypeScript + Tailwind CSS.  
Domain: AI character chatbot platform (Web only, mobile-responsive).  
Status: Active production codebase.

---

## 🎯 Core Directive: Tri-Pillar Principle

Every feature, module, page, or API created in this repository must strictly adhere to the three pillars:

### Pillar 1: Current UI, Design & Business Logic Consistency
1. **Inspect Current Source First**:
   - Before writing any component or query, inspect existing modules under `src/app/...`, `src/components/...`, `src/lib/...`, `src/store/...`, `src/hooks/...`, and `src/actions/...`.
2. **Auto-Responsive Design (Mobile-First Web)**:
   - All layouts must be 100% **auto-responsive** across mobile, tablet, and desktop viewports without horizontal scroll.
   - Mobile-first approach: fluid flexbox/grid containers and readable typography at any screen width.
3. **Performance-First Design (Zero CPU/RAM Bloat, Plain Colors Only)**:
   - **STRICT BAN on Heavy Effects**: Strictly NO glassmorphism (`backdrop-filter: blur()`), NO diffuse glowing box-shadows, NO iridescent/complex color-shift gradients, and NO heavy blur/particle effects.
   - **Plain Solid Colors**: All UI elements must use clean, solid plain colors for instant GPU/CPU rendering and minimal battery/memory consumption.
   - **Universal Brand Background**: Use pastel lilac (`#F3E4F5`) as the universal background (`var(--background)`).
   - **High-Readability Typography**: High-contrast, clean font sizing (base 16px, headings crisp `#2D2235`, body/subtext `#5A4B64` and `#7D6E87`) designed for effortless reading on light background.
4. **Minimalist UI & Strict Emoji Ban**:
   - **STRICTLY NO EMOJIS IN UI**: Never use emojis in UI components, headings, buttons, tags, or labels.
   - **Lucide Icons Only (Minimal Use)**: When an icon is truly necessary, use Lucide icons sparingly. Prefer clear typography and clean layout over excessive iconography.
5. **Database & Config Parsing**:
   - Preserve JSON parsing for `details` and `config` columns (e.g. `characterName`, `modelId`, `promo_limit`, `daily_limit`, `is_daily`, `allowed_days`).
   - Use Bangkok Timezone (`Asia/Bangkok`, UTC+7) for all daily resets, streaks, dates, and live clocks.
6. **Asset & Visual Elements**:
   - Use official icons from `/public/icons/...` (e.g. `/icons/02_ECONOMIC/0201_COIN.webp` for all PAW mentions, `/icons/03_MENU_ICONS/0306_STAMP.png` for check-ins).
   - Replicate ribbons (`WEEKEND GACHA BOX`, `DAILY DEAL`, `PREMIUM`), quotas (`0/3`, `0/1`), countdown timer boxes, and gradient styles.
7. **Header & Layout Architecture**:
   - Control global Topbar via `useHeaderStore` (title, back button `<`, right action icons). Never create stacked duplicate headers inside page bodies.

### Pillar 2: Best-Practice High-Performance Architecture
1. **Zero Legacy Spaghetti**:
   - Backend operations must be RESTful Route Handlers under `src/app/api/...`. (Avoid copying outdated Server Actions for fetchable public data).
2. **Ultra-Fast Speed (< 10ms) & Cache-First Strategy**:
   - **Read Paths (Cache-First)**: Apply Edge Caching (`Cache-Control: public, s-maxage=30, stale-while-revalidate=120`) and SWR client caching for all cacheable data to maximize speed.
   - **Write Paths (Strict Cache Invalidation)**: Whenever data is mutated, created, updated, or deleted, explicitly invalidate or purge relevant caches immediately (e.g. `revalidateTag()`, `revalidatePath()`, SWR `mutate()`) to prevent stale data.
3. **Zero Redundant Fallbacks / No Legacy Fallback Chains**:
   - Do not use nested fallback chains (e.g. `res?.data?.images || res?.data?.data?.images`, `a || b || c`).
   - Standardize on single explicit data contracts. Use nullish coalescing (`??`) for intentional default values instead of truthy fallbacks (`||`).
4. **Zero UI Flash & Instant Client Hydration**:
   - All persistent client state, authentication sessions, and user profiles must be cached locally (`localStorage`/persistent client cache) and rehydrated synchronously on initial render/page refresh. Never allow UI elements to flash default/unauthenticated states or temporary generic placeholders during background fetches when cached state is available.
5. **Strict Quality Gate**:
   - `npx tsc --noEmit` must always exit with **0 Errors**.
   - `npm run lint` must always exit with **0 Errors and 0 Warnings**.

### Pillar 3: Minimalist Engineering (Ponytail Philosophy)
1. **The Ladder (Decision order before writing any code)**:
   - Stop at the first rung that solves the problem:
     1. *Does this need to exist at all?* → Skip speculative features (YAGNI).
     2. *Already in this codebase?* → Reuse existing helpers, stores, hooks, or types in `src/`. Look before writing.
     3. *Stdlib does it?* → Use standard JS/TS/Node library.
     4. *Native platform feature covers it?* → CSS over JS logic, native HTML over heavy custom components, DB constraints over app code.
     5. *Already-installed dependency solves it?* → Use packages already in `package.json`. Never install new packages if existing ones or a few lines can do it.
     6. *Can it be one line?* → Keep it as clean single-line expression.
     7. *Only then:* Write the absolute minimum code that works.
2. **Bug Fixing = Root Cause, Not Symptoms**:
   - Before editing, inspect/grep all callers of the function being touched.
   - Fix the issue once at the source/root cause rather than scattering defensive patches across multiple callers.
3. **Strict Simplicity Rules**:
   - **No unrequested abstractions**: No single-implementation interfaces, no factories for single products, no configs for non-varying constants.
   - **No scaffolding for "later"**: Write only what is immediately required.
   - **Deletion over addition**: Prefer removing obsolete/redundant code. Shortest working diff wins.
   - **UI vs Logic Boundary**: Maintain rich PurrPaw visual aesthetics & design specs (Pillar 1), while enforcing ruthless minimalism for logic, data flows, and architecture.

---

## ⚡ Golden Rules
1. TypeScript strict everywhere. No `any`, no `@ts-ignore` without a comment explaining why.
2. Clean modular imports via `@/...` path aliases (`@/components/...`, `@/lib/...`, `@/hooks/...`, `@/store/...`, `@/types/...`).
3. Ask before adding a dependency. Prefer stdlib / existing deps in `package.json`.
4. Do not create files that were not requested.
5. **ZERO Direct Database Access**: The Agent must NEVER connect to, query, mutate, or touch the database directly. If data or schema details are needed, write the SQL query for the user to run manually and copy the results back. Never write, update, or delete database records directly.
6. **Strict Supabase ANON KEY & RLS Only**: Strictly NO use of the Supabase Service Role Key for general queries or mutations. All database operations must use the public `ANON KEY` with authenticated user sessions, strictly passing through Row Level Security (RLS) policies.
7. **MANDATORY Planning Before ANY Code Changes**: Before modifying existing code or writing new files/features, the Agent MUST ALWAYS create a detailed Implementation Plan and wait for the USER's explicit approval first. Never modify or create code directly without prior approved plan. (General discussions, questions, and explanations do not require a plan).
8. **Minimalist Communication**: Keep explanations, responses, and summaries concise and straight to the point. No fluff or wordy explanations.
9. **Strict Emoji Ban in UI**: Never use emojis in any UI elements. If icons are needed, use Lucide icons sparingly.
10. **NEVER Start Dev Servers Autonomously**: The Agent is strictly forbidden from executing `npm run dev`, `next dev`, or any dev server processes. The USER will run and inspect servers manually. The Agent is only permitted to run non-server static verification commands (`npx tsc --noEmit`, `npm run lint`).

---

## 📋 Mandatory Planning Workflow (Plan Before Code)
Whenever a task touches code, the Agent MUST strictly follow this 2-phase process:
1. **Phase 1: Research & Plan**:
   - Research the requirements and inspect the relevant files.
   - Create/update an `implementation_plan.md` artifact outlining the exact proposed changes, files affected, and verification steps.
   - **STOP and wait for USER approval.** Do not execute any file edits or commands that modify code.
2. **Phase 2: Execution**:
   - Only AFTER the user approves the plan (via button click or confirmation message), proceed with writing the code.
   - Summarize completed work in `walkthrough.md`.
- **Exception**: General conversations, answering architectural questions, code reviews, and explanations do NOT require a plan.

---

## 🗄️ Database Safety Protocol & Schema Reference
- **Zero Direct Agent DB Contact**: The Agent is strictly forbidden from executing direct connections, migrations, RPCs, or queries against any database via scripts, commands, or local tools.
- **Manual User SQL Relay Only**: If the Agent needs database info, schema data, or table verification:
  1. The Agent writes the clean SQL query in a code block.
  2. The USER runs the query manually in their database console/dashboard.
  3. The USER copies and pastes the result back to the Agent.
- **No Autonomous Writes/Deletions**: Never generate self-executing scripts or run commands that insert, update, alter, or drop tables or rows. All DB changes must be reviewed and executed exclusively by the user.
- **No Service Key Bypass**: Never use the Supabase Service Role Key to bypass RLS policies or perform arbitrary writes. All data access must strictly pass through RLS using the Anon Key.
- **Canonical Schema**: `schema.sql` at project root serves as the reference for existing database tables, columns, and types.

---

## 🏗️ Structure

```text
src/
  actions/       Server Actions (specific mutations / legacy flows)
  app/           Next.js App Router (pages, layouts, and API route handlers)
    api/         RESTful Route Handlers
  components/    UI components (domain-organized: chat, character, layouts, ui)
  config/        Configuration constants and environment wrappers
  constants/     Application constants and enums
  hooks/         Client React hooks
  lib/           Clients, adapters & utils (Supabase, Stripe, S3, Redis)
  store/         Zustand state stores (useHeaderStore, userStore, etc.)
  types/         TypeScript definitions & DB types
  utils/         Shared utility functions
public/          Static assets and icons (/public/icons/...)
schema.sql       PostgreSQL schema reference
```

---

## 🏷️ Naming
- Files: `kebab-case.ts` (or `kebab-case.tsx`)
- React components: `PascalCase.tsx`
- Hooks: `use-thing.ts` exporting `useThing`
- Types: `PascalCase`, no `I` prefix
- Routes: Next.js App Router file conventions (`page.tsx`, `layout.tsx`, `route.ts`)

---

## 🔒 Security Rules (Non-negotiable)
- **Supabase Anon Key & RLS Only**: All database calls must use `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Strictly NO standard usage of the Service Role Key. Every single read/write must be validated by Postgres Row Level Security (RLS) policies.
- **Persona Privacy & Prompt Protection**: Strictly NEVER expose the AI character's internal `persona` definition or system prompts in public client-facing APIs or character listing endpoints (`/api/characters`). Those fields are strictly backend-only for LLM orchestration.
- **Query Limits & Pagination**: All collection listing endpoints must enforce pagination (`limit`, default 20, max 50) and cursor/page-based infinite loading to prevent memory bloat and large network payloads.
- No secrets in client code. All env access goes through environment variables with `NEXT_PUBLIC_` prefix for client-accessible values, and server-only envs remain strictly on the server.
- Never log tokens, session ids, or user message content.

---

## 🚫 Do Not
- Do not run dev servers (`npm run dev`, `next dev`, etc.) autonomously. Only run static verification (`npx tsc --noEmit`, `npm run lint`).
- Do not use emojis in UI components or designs.
- Do not write lengthy or verbose explanations; keep communication minimal.
- Do not modify or write code without an approved implementation plan.
- Do not attempt to connect to, query, or mutate the database directly.
- Do not use the Supabase Service Role Key to bypass RLS policies or for general operations.
- Do not use glassmorphism, blur, diffuse glow effects, or heavy particle animations.
- Do not add Docker, CI configs, or tests unless asked.
- Do not install a UI library without asking.
- Do not put `.env` values in `next.config.js`.

---

## 💻 Commands
- `npm run dev` : run Next.js dev server (USER only)
- `npm run build` : build production bundle
- `npm run lint` : run ESLint
- `npx tsc --noEmit` : run TypeScript typecheck
- `npm test` : run Vitest tests
