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
| AI | **`@google/genai` v2** → `gemini-3.6-flash` (fallback chain: `.6-flash → 3.5-flash-lite → 3.1-flash-lite`) | `responseJsonSchema` gives structured outputs; `GEMINI_MODEL`/`GEMINI_MODELS` env override. Quota is per-model, so 429/503 failures transparently fall through to the next model. Runs on Google AI Pro subscription. |
| Validation | **Zod v4** | Parses both the request and the model output at the API boundary. |
| PDF | **jspdf + jspdf-autotable** | Client-side `.pdf` export of the checklist with status marks. |

## Folder structure

```
app/
  layout.tsx          metadata + fonts + root shell
  page.tsx            "use client" — single page: pitch → loader → questions → loader → plan
  globals.css         @import tailwindcss + @theme terminal palette + keyframes
  api/plan/route.ts   POST /api/plan   — validates input+answers, calls Gemini, Zod-checks output
  api/questions/route.ts POST /api/questions — validates input, asks Gemini for 2-4 questions
  favicon.ico
components/
  LandingForm.tsx     pitch textarea, mode toggle, hour budget, submit
  LoadingTerminal.tsx fake terminal output while a model call runs (`ask` / `plan` variants)
  QuestionFlow.tsx    edit answers: option buttons + custom input, generate/skip actions
  PlanView.tsx        full rendered plan + interactive checklist + PDF/actions
lib/
  types.ts            Zod schemas + inferred TS types (single source of truth)
  gemini.ts           system/prompt builders, JSON schemas, model calls, parse+normalize
  store.ts            Zustand store (plan, task statuses, actions, hydration guard)
  pdf.ts              jspdf + autotable export of the plan
.env.local.example    key + model env template (real key stays in .env.local, gitignored)
```

## Component tree

```
app/page.tsx (client)  — phases: idle / asking / answering / planning
 ├─ LandingForm — description / mode / hours → handlePitch()
 ├─ LoadingTerminal — "ask" while POST /api/questions, "plan" while POST /api/plan
 ├─ QuestionFlow — questions + answers → onGenerate(answers) | onSkip()
 └─ PlanView (reads useDevPlanStore)
     ├─ header card        title · tagline · summary · mode/budget chips
     ├─ progress strip     task counts (done/working/todo) + bar
     ├─ user flow          numbered steps
     ├─ tech stack         chips
     ├─ must-include / must-avoid  (hackathon mode only)
     └─ checklist          grouped by category, per-group counts, task rows
                           → cycleStatus(taskId) on click
Footer actions: downloadPlanPdf(plan, statuses) · new plan (onNewPlan → reset store + page state)
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
Browser                          Server (Node runtime)
onSubmit ──POST /api/questions──► questions route
   │                             ├─ planRequestSchema.parse(body) → 400 if invalid
   │                             └─ generateQuestions() → lib/gemini.ts
   │                                  buildQuestionsSystemInstruction() (mode-aware)
   │                                  + geminiQuestionsSchema → 2-4 questions
   │ ──{ ok, data:{ questions } }──► QuestionFlow renders (options + custom)
   │
 user answers / skip
   │
 tap generate ──POST /api/plan──► plan route
   │   body + answers[]           ├─ planRequestSchema.parse(body)   → 400 if invalid
   │                             └─ generatePlan() → lib/gemini.ts
   │                                  systemInstruction (rules, mode-aware)
   │                                  + plan prompt (pitch + budget + answers)
   │                                  + geminiPlanSchema → structured plan
   │                                  extractJson → Zod validate → normalizePlan()
   │ ──{ ok: true, data }───────► setPlan() → store → PlanView + statuses + PDF
   └ error path                    { ok: false, error } → CLI error box + retry
```

## Key implementation notes

- **Two model calls, one shared core:** `callGemini<T>()` in `lib/gemini.ts` is the single entry point — system instruction + contents + `responseJsonSchema` + a `validate` callback (Zod `safeParse`). Both `/api/questions` and `/api/plan` reuse it, so retry-once, fence-stripping, and error handling stay identical.
- **API key hiding:** `GEMINI_API_KEY` is read only inside `lib/gemini.ts` (server). `GoogleGenAI` client is instantiated per request; no client bundle includes it.
- **Structured outputs:** `responseJsonSchema` restricts keys/required/enums; Zod re-validates because the model output is untrusted. On schema disagreement the route retries once with a "return only JSON" nudge, then returns a friendly error.
- **No DB, refresh-safe:** persisted plan + statuses rehydrate synchronously in the browser; hydration gate prevents server/client mismatch. Questions/answers are transient component state — they don't survive refresh, by design.
- **Skip path = old MVP:** `POST /api/plan` with `answers: []` behaves exactly like the original one-shot flow, so the feature is fully backward compatible.