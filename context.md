# context.md — DevPlan

> Living context doc for agents (Antigravity, code assistants). Update it whenever the product changes.

## Core value

DevPlan turns a one-line project pitch into a **working, prioritized build checklist** before the deadline is gone — like `opencode plan mode`, but for building software fast.

- **Who:** Hackers in 4–48h hackathons, and solo devs who always overplan and under-ship.
- **The pain:** People burn their budget on fancy features and run out of time on the 20% that actually demos.
- **The answer:** One AI call (Gemini) that returns a structured plan — a small thing that works beats a big thing that half works.

## Hard constraint: 6-hour build sprint

This whole project was built in ~3.5 hours of implementation + ~2.5h of testing, docs, recording, and submission. Every scope decision serves that:

- **No database** → state lives in the browser (`localStorage` via Zustand persist). Fewer moving parts, nothing to provision for a demo.
- **No multi-question planning flow / no Kanban board** → skipped on purpose. HR rule: *small that works beats big that half works*. Kanban + clarifying questions are the stretch branch, not the MVP.
- **API key stays server-side** → AI calls only happen in Next.js route handlers; the browser never sees `GEMINI_API_KEY`.

## Exact user flow

1. User lands on `/` — CLI-themed page (black/green terminal).
2. User types a project description (min 10 chars) into the textarea.
3. User picks mode:
   - **personal · no limit** → no time budget.
   - **hackathon · X hrs** → numeric budget (1–48h).
4. User hits `$ devplan gen` (or Enter).
5. Browser POSTs `{ description, mode, timeLimitHours }` to `POST /api/plan`.
6. Server builds a prompt + strict JSON schema, calls `gemini-3.5-flash` (env override `GEMINI_MODEL`), validates the result with Zod, returns structured plan.
7. UI renders: title/tagline/summary → progress strip → user flow → tech stack → `must include` / `must avoid` (hackathon only) → grouped checklist (Environment Setup → Foundation → Core Feature → Polish → Deployment).
8. Each task is a status cell cycling **todo → working → done** (click). Progress saved to `localStorage`, survives refresh.
9. User can download the plan as a PDF (`jspdf` + `jspdf-autotable`) and start a new plan (reset).

## Persona / tone

Everything speaks like a terminal: `$`, `▋` blinking cursor, `[ ]` / `[~]` / `[x]` status marks, `// SECION` headers. Short lines, no clutter, dark background, mono font.

## Current status (updated continuously)

- [x] Scaffold: Next.js 16 App Router, Tailwind v4, TypeScript, Turbopack.
- [x] AI layer: `lib/types.ts`, `lib/gemini.ts`, `lib/store.ts`, `app/api/plan/route.ts`.
- [x] UI: `app/page.tsx`, `components/LandingForm.tsx`, `components/LoadingTerminal.tsx`, `components/PlanView.tsx`.
- [x] Persistence + PDF: `lib/store.ts`, `lib/pdf.ts`.
- [x] Live E2E verified with `gemini-3.5-flash`: hackathon mode returns ≤ budget task plan (75–85% rule), personal mode returns full ordered plan; `mustInclude`/`mustAvoid` correctly empty in personal mode.
- [x] Docs (`context.md`, `ARCHITECTURE.md`, `API_SCHEMA.md`, `README.md`).
- [ ] Recording + submission bundle.

## Decisions log

| Decision | Why |
| --- | --- |
| `gemini-3.5-flash` default | Current stable Flash GA, fast + quality prompt adherence; most reliable structured JSON observed on the Google AI Pro tier. Override via `GEMINI_MODEL`. |
| Single page app | No DB → no routing/state-passing; plan renders under the form. |
| Zustand + persist | Tiny, battle-tested, synchronous localStorage hydration, clean `useSyncExternalStore` hydration guard. |
| jspdf + autotable | Real `.pdf` download, nowhere near as frail as print-to-PDF. |
| Zod everywhere | One source of truth for the request and the (untrusted) model output at the API boundary. |