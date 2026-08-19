# DevPlan

AI project planning that ships **before the deadline is gone** — like `opencode plan mode`, but it turns a one-line pitch into a working build checklist from environment setup to deployment.

![stack](https://img.shields.io/badge/Next.js%2016-000000?logo=next.js)
![stack](https://img.shields.io/badge/Tailwind%20v4-38bdf8?logo=tailwindcss)
![stack](https://img.shields.io/badge/Gemini%202.5%20Flash-8c7853?logo=googlegemini)
![stack](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript)

## Why

- Hackers burn their time budget on fancy features and never demo the core value.
- **Small that works beats big that half works** — the app enforces that: pick a time limit and Gemini plans only what fits.
- Built in ~3.5h implementation as the deliverable of a 6-hour build sprint (no database, no Kanban board — just the plan that works).

## Features

- Type a project description, pick **personal (no limit)** or **hackathon (X hrs)**.
- Plan mode: Gemini asks the **2–4 clarifying questions that most change the build** (options + custom answers, skippable) — tuned per mode (hackathon → demo/scope; personal → platform/storage/export).
- The final plan: summary, user flow, tech stack, **must include / must avoid** (hackathon mode), and a grouped checklist — Environment Setup → Foundation → Core Feature → Polish → Deployment.
- Checklist cells cycle `todo → working → done`; progress bar + per-category counts.
- Plan + progress persist in `localStorage` (zero database), survive refresh.
- Download the whole plan as a **PDF** with status marks.
- API key lives only in the server route handlers — never sent to the browser.
- CLI-themed UI: black/green terminal, mono font, blinking cursor, `$` prompts.

## How it works

```
pitch ──> POST /api/questions ──> Gemini (2-4 clarifying questions)
  ── answer / skip ──> POST /api/plan ──> Gemini (structured plan, answers baked in)
  ──> Zod validate ──> checklist UI ──> localStorage ──> PDF
```

## Quick start

```bash
npm install
cp .env.local.example .env.local   # paste your Google AI Studio key in GEMINI_API_KEY
npm run dev
```

Open http://localhost:3000, describe a project, pick a mode, hit `$ devplan gen`.

### Optional env

| Var | Default | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | — | required; Google AI Studio key (works with a Google AI Pro subscription) |
| `GEMINI_MODEL` | `gemini-3.5-flash` | any model your key can reach |

## How it works

```
pitch ──> POST /api/plan ──> Gemini (server-side, structured JSON output)
     ──> Zod validate ──> checklist UI ──> localStorage ──> PDF
```

Every next agent/editor gets context fast from the living docs: **`context.md`** (product/history), **`ARCHITECTURE.md`** (stack/flow), **`API_SCHEMA.md`** (exact JSON shapes).

## Scripts

```bash
npm run dev     # dev server (Turbopack)
npm run build   # production build
npm run start   # serve the build
npm run lint    # eslint
```

## Scope guardrails

- **MVP = one page, ≤4 clarifying questions, one plan call, checklist + PDF.** The Kanban board is the remaining stretch branch — deliberately NOT in this build.
- Questions are skippable, so the flow still degrades to a single AI call when you just want the plan.
- No database, no auth, no payments — demo first, fancy later.