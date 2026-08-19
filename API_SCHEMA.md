# API_SCHEMA.md — DevPlan

> Single source of truth for every JSON shape in the system. Mirror `lib/types.ts` + `lib/gemini.ts`.
> `request` types are enforced by Zod at the route boundary; the Gemini schema is passed to `responseJsonSchema`.

## 1. `POST /api/plan`

Request (application/json):

```json
{
  "description": "A CLI tool that turns a restaurant menu into share-card images",
  "mode": "hackathon",               // "personal" | "hackathon"
  "timeLimitHours": 6                // required when mode === "hackathon"; 1..48
}
```

`description`: min 10, max 2000 chars. Zod rejects otherwise (HTTP 400).

Success response (HTTP 200):

```json
{
  "ok": true,
  "data": {
    "projectTitle": "Menu2Card",
    "tagline": "Menus → shareable cards, in one command.",
    "summary": "…",
    "mode": "hackathon",
    "timeLimitHours": 6,
    "techStack": ["TypeScript", "sharp", "…"],
    "userFlow": [
      { "step": "Paste menu", "detail": "drop raw menu text into the CLI" }
    ],
    "mustInclude": [
      { "item": "1 command = 1 card", "why": "core value, one-liner demo" }
    ],
    "mustAvoid": [
      { "trap": "Custom font preloader", "why": "eats 1h+ for zero demo value" }
    ],
    "tasks": [
      {
        "id": "env-1",
        "category": "Environment Setup",   // see enum below
        "title": "Scaffold Node + TS project",
        "description": "npm init, tsconfig, test runner.",
        "estimatedMinutes": 20,
        "priority": "high",                 // "high" | "medium" | "low"
        "dependencies": []
      }
    ]
  }
}
```

Error responses:

```json
{ "ok": false, "error": "Provide a time limit for hackathon mode." }   // HTTP 400
{ "ok": false, "error": "Missing GEMINI_API_KEY. …" }                  // HTTP 500
{ "ok": false, "error": "The plan generation failed." }                // HTTP 502
```

Enums in `data`:

- `mode`: `"personal" | "hackathon"`
- `task.category`: `"Environment Setup" | "Foundation" | "Core Feature" | "Polish" | "Deployment"`
- `task.priority`: `"high" | "medium" | "low"`

`task.descriptions` and all arrays may be empty except `tasks` (min 1).

## 2. Gemini request (server-side, never reaches the browser)

Model: `gemini-3.5-flash` (default `GEMINI_MODEL` env override).
Transport: `@google/genai` → `ai.models.generateContent`.

Call shape (Node):

```ts
await ai.models.generateContent({
  model: GEMINI_MODEL,
  contents: buildUserPrompt(req),
  config: {
    systemInstruction: buildSystemInstruction(),
    responseMimeType: "application/json",
    responseJsonSchema: geminiPlanSchema,
  },
});
```

`contents` (user message) shape:

```
Plan the following project:
------------------------------------------------------------
<pitch·description>
------------------------------------------------------------
Mode: Personal project, no time limit.
// or:
Time budget: 6 hour(s) — hard deadline. Plan must fit.
```

`systemInstruction` is a plain string with these rules:

- You are DevPlan, a pragmatic senior engineer planning a build; "small that works beats big that half works."
- Respond ONLY with one JSON object matching the schema.
- Cover lifecycle: Environment Setup → Foundation → Core Feature → Polish → Deployment, ordered.
- Tasks small (5–90 min), 12–22 total, independently actionable.
- **Hackathon:** total `estimatedMinutes` ≈ 75–85% of the hour budget; `mustInclude` = 3–5 core-value items; `mustAvoid` = 3–5 realistic time traps listed with reasons; cut anything that can't fit into `mustAvoid`.
- **Personal:** may plan more ambitiously but still ordered setup → deploy; `mustInclude`/`mustAvoid` can be empty arrays.

## 3. Gemini response JSON Schema (`responseJsonSchema`)

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "projectTitle":    { "type": "string" },
    "tagline":         { "type": "string" },
    "summary":         { "type": "string" },
    "mode":            { "type": "string", "enum": ["personal", "hackathon"] },
    "timeLimitHours":  { "type": "integer", "minimum": 1 },
    "techStack":       { "type": "array", "items": { "type": "string" } },
    "userFlow": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "step":   { "type": "string" },
          "detail": { "type": "string" }
        },
        "required": ["step", "detail"]
      }
    },
    "mustInclude": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "item": { "type": "string" },
          "why":  { "type": "string" }
        },
        "required": ["item", "why"]
      }
    },
    "mustAvoid": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "trap": { "type": "string" },
          "why":  { "type": "string" }
        },
        "required": ["trap", "why"]
      }
    },
    "tasks": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "id":               { "type": "string" },
          "category":         { "type": "string", "enum": ["Environment Setup", "Foundation", "Core Feature", "Polish", "Deployment"] },
          "title":            { "type": "string" },
          "description":      { "type": "string" },
          "estimatedMinutes": { "type": "integer", "minimum": 1 },
          "priority":         { "type": "string", "enum": ["high", "medium", "low"] },
          "dependencies":     { "type": "array", "items": { "type": "string" } }
        },
        "required": ["category", "title", "description", "estimatedMinutes", "priority", "dependencies"]
      }
    }
  },
  "required": ["projectTitle", "tagline", "summary", "mode", "timeLimitHours", "techStack", "userFlow", "mustInclude", "mustAvoid", "tasks"]
}
```

## 4. Post-processing (server)

1. Strip possible markdown fences `` ```json … ``` ``.
2. Extract first `{ … }` span, `JSON.parse`.
3. Zod validate (`planResponseSchema`); on failure retry once with a "return ONLY valid JSON" nudge on `contents`.
4. `normalizePlan()`: assign `id` when missing (`task-N`), map `dependencies` by title→id, default `priority` to `"medium"`.