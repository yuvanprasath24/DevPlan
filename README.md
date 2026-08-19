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
- Gemini returns a structured plan: summary, user flow, tech stack, **must include / must avoid** (hackathon mode), and a grouped checklist — Environment Setup → Foundation → Core Feature → Polish → Deployment.
- Checklist cells cycle `todo → working → done`; progress bar + per-category counts.
- Plan + progress persist in `localStorage` (zero database), survive refresh.
- Download the whole plan as a **PDF** with status marks.
- API key lives only in the server route handler — never sent to the browser.
- CLI-themed UI: black/green terminal, mono font, blinking cursor, `$` prompts.

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

- **MVP = one page, one AI call, checklist + PDF.** Multi-question planning flow and a Kanban board are the stretch branch — deliberately NOT in this build.
- No database, no auth, no payments — demo first, fancy later.