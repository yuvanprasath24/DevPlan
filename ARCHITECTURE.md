# ARCHITECTURE.md — DevPlan

> Living doc for agents. Update when structure changes.

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 16** (App Router, Turbopack) | Full-stack in one project; route handlers host the AI call so the API key never ships to the browser. |
| Language | **TypeScript** (strict) | Shared request/response types across frontend and backend. |
| Styling | **Tailwind CSS v4** | CSS-first config via `@theme` tokens in `app/globals.css`; no JS config file to fight. |
| Fonts | `Geist Mono` via `next/font` | Native mono terminal feel, self-hosted. |
| State | **Zustand v5 + persist → localStorage** | No database. Sync hydration keeps the persisted plan on refresh. |
| AI | **`@google/genai` v2** → `gemini-3.5-flash` | `responseJsonSchema` gives structured outputs; env `GEMINI_MODEL` override. Runs on Google AI Pro subscription. |
| Validation | **Zod v4** | Parses both the request and the model output at the API boundary. |
| PDF | **jspdf + jspdf-autotable** | Client-side `.pdf` export of the checklist with status marks. |

## Folder structure

```
app/
  layout.tsx          metadata + fonts + root shell
  page.tsx            "use client" — single page: generate / loading / error / plan
  globals.css         @import tailwindcss + @theme terminal palette + keyframes
  api/plan/route.ts   POST /api/plan — validates input, calls Gemini, Zod-checks output
  favicon.ico
components/
  LandingForm.tsx     pitch textarea, mode toggle, hour budget, submit
  LoadingTerminal.tsx fake terminal output while the model runs
  PlanView.tsx        full rendered plan + interactive checklist + PDF/actions
lib/
  types.ts            Zod schemas + inferred TS types (single source of truth)
  gemini.ts           system prompt, user prompt, JSON schema, model call, parse+normalize
  store.ts            Zustand store (plan, task statuses, actions, hydration guard)
  pdf.ts              jspdf + autotable export of the plan
.env.local.example    key + model env template (real key stays in .env.local, gitignored)
```

## Component tree

```
app/page.tsx (client)
 ├─ LandingForm — description / mode / hours → onSubmit()
 ├─ LoadingTerminal — visual state while fetch("/api/plan") is in flight
 └─ PlanView (reads useDevPlanStore)
     ├─ header card        title · tagline · summary · mode/budget chips
     ├─ progress strip     task counts (done/working/todo) + bar
     ├─ user flow          numbered steps
     ├─ tech stack         chips
     ├─ must-include / must-avoid  (hackathon mode only)
     └─ checklist          grouped by category, per-group counts, task rows
                           → cycleStatus(taskId) on click
Footer actions: downloadPlanPdf(plan, statuses) · reset()
```

## State management

One Zustand store, persisted to `localStorage` under key `devplan-state`:

- `plan: PlanResponse | null` — the generated plan.
- `statuses: Record<taskId, DevPlanStatus>` (`"todo" | "working" | "done"`).
- Actions: `setPlan`, `cycleStatus(taskId)` (todo→working→done→todo), `setStatus`, `reset`.
- Hydration guard: `useHasHydrated()` uses `useSyncExternalStore` + `persist.hasHydrated()` so the static site shell never flashes a mismatch (server: empty, client: persisted plan).

Status model note: the MVP uses a single checklist with 3-cycle statuses — NOT a Kanban board. The board is the stretch branch. This keep the data model to a flat map, which is enough for the demo and the PDF.

## Data flow

```
Browser                     Server (Node runtime)
onSubmit ──POST /api/plan──► route.ts
   │                       ├─ planRequestSchema.parse(body) → 400 if invalid
   │                       ├─ generatePlan()  → lib/gemini.ts
   │                       │    ├─ buildSystemInstruction()  (rules, mode-aware)
   │                       │    ├─ buildUserPrompt(req)
   │                       │    ├─ ai.models.generateContent({
   │                       │    │    model: GEMINI_MODEL,
   │                       │    │    config: { systemInstruction, responseMimeType,
   │                       │    │              responseJsonSchema: geminiPlanSchema }
   │                       │    │  })
   │                       │    ├─ strip fences → JSON.parse → Zod validate (2 attempts)
   │                       │    └─ normalizePlan() (assign ids, resolve deps)
   │                       └─ { ok: true, data } | { ok: false, error }
   │ ──JSON response──────►
 setPlan(data) → store → PlanView renders; statuses persist; PDF on demand
```

## Key implementation notes

- **API key hiding:** `GEMINI_API_KEY` is read only inside `lib/gemini.ts` (server). `GoogleGenAI` client is instantiated per request; no client bundle includes it.
- **Structured outputs:** `responseJsonSchema` restricts keys/required/enums; Zod re-validates because the model output is untrusted. On schema disagreement the route retries once with a "return only JSON" nudge, then returns a friendly error.
- **No DB, refresh-safe:** persisted plan + statuses rehydrate synchronously in the browser; hydration gate prevents server/client mismatch.
- **Static fast path, dynamic AI path:** `/` is prerendered static; `POST /api/plan` is `dynamic = "force-dynamic"`, `runtime = "nodejs"`.