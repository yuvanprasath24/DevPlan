import { GoogleGenAI } from "@google/genai";
import {
  planResponseSchema,
  questionsResponseSchema,
  type PlanRequest,
  type PlanResponse,
  type QuestionsResponse,
} from "./types";

const DEFAULT_MODELS = "gemini-3.6-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite";

// Comma-separated fallback chain (env GEMINI_MODELS) — quota is per-model, so a
// rate-limited model falls through to the next one instead of failing the demo.
// Legacy GEMINI_MODEL only sets the primary; the default chain still follows it.
const defaultModelsArr = DEFAULT_MODELS.split(",").map((s) => s.trim());
const configuredModels = (process.env.GEMINI_MODELS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const legacyModel = (process.env.GEMINI_MODEL ?? "").trim();

export const GEMINI_MODELS = configuredModels.length
  ? configuredModels
  : legacyModel
    ? [legacyModel, ...defaultModelsArr.filter((m) => m !== legacyModel)]
    : defaultModelsArr;

export const GEMINI_MODEL = GEMINI_MODELS[0];

const categoryEnum = [
  "Environment Setup",
  "Foundation",
  "Core Feature",
  "Polish",
  "Deployment",
];

export const geminiQuestionsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", description: "Short unique id, e.g. 'q1'." },
          question: { type: "string", description: "The clarifying question." },
          detail: {
            type: "string",
            description: "Optional one-line context helping the user answer.",
          },
          options: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string", description: "Short option id, e.g. 'a'." },
                label: { type: "string", description: "Short answer option, max 6 words." },
              },
              required: ["id", "label"],
            },
          },
          allowCustom: {
            type: "boolean",
            description: "Whether a typed custom answer is allowed.",
          },
        },
        required: ["id", "question", "options", "allowCustom"],
      },
    },
  },
  required: ["questions"],
} as const;

export const geminiPlanSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    projectTitle: { type: "string", description: "Short, catchy name for the project." },
    tagline: { type: "string", description: "One-line pitch for the project." },
    summary: {
      type: "string",
      description:
        "1-3 sentence overview of the project, its core value, and how it will be used.",
    },
    mode: { type: "string", enum: ["personal", "hackathon"] },
    timeLimitHours: { type: "integer", minimum: 1 },
    techStack: {
      type: "array",
      items: { type: "string" },
      description: "Recommended technologies/libraries for this project.",
    },
    userFlow: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          step: { type: "string", description: "Short label of the step." },
          detail: { type: "string", description: "What the user does in this step." },
        },
        required: ["step", "detail"],
      },
      description: "The user journey through the app, in order.",
    },
    mustInclude: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          item: { type: "string", description: "Feature or thing to include." },
          why: { type: "string", description: "Why it is essential to the core value." },
        },
        required: ["item", "why"],
      },
      description: "Hackathon mode only: the essential features to ship.",
    },
    mustAvoid: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          trap: { type: "string", description: "The time-wasting trap to avoid." },
          why: { type: "string", description: "Why it eats time without adding value." },
        },
        required: ["trap", "why"],
      },
      description: "Hackathon mode only: common time traps the builder must avoid.",
    },
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", description: "Unique short id, e.g. 'env-1'." },
          category: { type: "string", enum: categoryEnum },
          title: { type: "string", description: "Short task title." },
          description: {
            type: "string",
            description: "1-2 sentence actionable description.",
          },
          estimatedMinutes: { type: "integer", minimum: 1 },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          dependencies: { type: "array", items: { type: "string" } },
        },
        required: [
          "category",
          "title",
          "description",
          "estimatedMinutes",
          "priority",
          "dependencies",
        ],
      },
      description:
        "Ordered build checklist from Environment Setup to Deployment. Keep steps small and actionable.",
    },
  },
  required: [
    "projectTitle",
    "tagline",
    "summary",
    "mode",
    "timeLimitHours",
    "techStack",
    "userFlow",
    "mustInclude",
    "mustAvoid",
    "tasks",
  ],
} as const;

export function buildSystemInstruction(): string {
  return [
    "You are DevPlan, a pragmatic senior software engineer planning a project build like sprint planning.",
    "You are direct, ruthless about cutting scope, and obsessed with 'a small thing that works beats a big thing that half works.'",
    "You always plan concrete, actionable steps a developer can execute from an empty folder to a deployed app.",
    "Respond ONLY with one JSON object that exactly matches the provided JSON Schema. No markdown, no commentary.",
    "",
    "TASK PLANNING RULES:",
    "- Cover the whole lifecycle: Environment Setup -> Foundation -> Core Feature -> Polish -> Deployment.",
    "- Order tasks from setup to deployment. Later tasks may reference earlier task ids.",
    "- Keep each task small (5-90 minutes) and independently actionable.",
    "- 12 to 22 tasks total. Do not overfragment.",
    "",
    "HACKATHON MODE (time budget given):",
    "- The total estimatedMinutes across all tasks must be roughly 75-85% of the time budget in hours, so the builder finishes before the deadline.",
    "- mustInclude lists the 3-5 features that alone deliver the core value.",
    "- mustAvoid lists 3-5 realistic time traps (gold-plating, premature optimization, over-polishing UI, building unused abstractions, autobahn deployments, etc.) with concrete reasons.",
    "- If a proposed feature clearly cannot fit the budget, cut it from tasks and mention it in mustAvoid.",
    "",
    "PERSONAL MODE (no time limit):",
    "- You may plan a more complete, ambitious build, but still keep it grounded and ordered setup -> deploy.",
    "- mustInclude / mustAvoid can be omitted as empty arrays in personal mode.",
  ].join("\n");
}

export function buildQuestionsSystemInstruction(): string {
  return [
    "You are DevPlan's planner assistant. Before a build plan is generated, you ask the 2-4 clarifying questions that would most change the plan.",
    "Rules:",
    "- Questions MUST be derived from the project description and mode. Never ask generic or boilerplate questions.",
    "- Never ask about something the description already states.",
    "- Each question gets 1-4 short, scenario-specific options (labels max ~6 words). Set allowCustom=true unless the options are clearly exhaustive.",
    "- HACKATHON MODE: prioritize questions about demo scope/target, existing code/codebase, must-have vs nice-to-have features, and deployment target.",
    "- PERSONAL MODE: prioritize questions about target users/audience, scope breadth, integrations, and data/persistence.",
    "- Ask in a decision-relevant order. Fewer, sharper questions beat many. Max 4.",
    "Respond ONLY with one JSON object that exactly matches the provided JSON Schema. No markdown, no commentary.",
  ].join("\n");
}

export function buildProjectContext(req: PlanRequest): string {
  const timeLine =
    req.mode === "hackathon"
      ? `\nTime budget: ${req.timeLimitHours} hour(s) — hard deadline.\n`
      : "\nMode: Personal project, no time limit.\n";
  return `${req.description}
${"-".repeat(60)}${timeLine}`;
}

export function buildAnswersSection(req: PlanRequest): string {
  if (!req.answers || req.answers.length === 0) return "";
  const lines = req.answers.map((a) => `  - (${a.questionId}) ${a.answer}`);
  return `\n\nClarifying answers from the user (use these to tune the plan):\n${lines.join("\n")}`;
}

export function buildQuestionsPrompt(req: PlanRequest): string {
  return `Ask the clarifying questions that would most change the build plan for the following project:
${"-".repeat(60)}
${buildProjectContext(req)}`;
}

export function buildUserPrompt(req: PlanRequest): string {
  return `Plan the following project:
${"-".repeat(60)}
${buildProjectContext(req)}${buildAnswersSection(req)}`;
}

export function generateQuestions(req: PlanRequest): Promise<QuestionsResponse> {
  return callGemini({
    systemInstruction: buildQuestionsSystemInstruction(),
    contents: buildQuestionsPrompt(req),
    jsonSchema: geminiQuestionsSchema,
    validate: (parsed) => questionsResponseSchema.safeParse(parsed),
  }).then((validated) => ({
    questions: validated.questions.slice(0, 4),
  }));
}

export async function generatePlan(req: PlanRequest): Promise<PlanResponse> {
  const validated = await callGemini({
    systemInstruction: buildSystemInstruction(),
    contents: buildUserPrompt(req),
    jsonSchema: geminiPlanSchema,
    validate: (parsed) => planResponseSchema.safeParse(parsed),
  });
  return normalizePlan(validated);
}

interface CallGeminiArgs<T> {
  systemInstruction: string;
  contents: string;
  jsonSchema: unknown;
  validate: (parsed: unknown) => { success: boolean; data?: T | undefined };
}

type ErrorKind = "quota" | "unavailable" | "notfound" | "other";

function describeGeminiError(raw: unknown): {
  kind: ErrorKind;
  message: string;
  retrySeconds?: number;
} {
  const text = raw instanceof Error ? raw.message : String(raw ?? "Unknown error");

  const tryParseJson = (s: string): {
    message: string;
    retrySeconds?: number;
    status?: string;
    code?: number;
  } | null => {
    const start = s.indexOf("{");
    if (start === -1) return null;
    try {
      const obj = JSON.parse(s.slice(start));
      const e = obj?.error;
      if (e && typeof e.message === "string") {
        let retrySeconds: number | undefined;
        if (Array.isArray(e.details)) {
          for (const d of e.details) {
            const delay = typeof d?.retryDelay === "string" ? d.retryDelay : undefined;
            if (delay) {
              const n = Number.parseInt(delay, 10);
              if (!Number.isNaN(n)) retrySeconds = n;
            }
          }
        }
        return { message: e.message, retrySeconds, status: e.status, code: Number(e.code) };
      }
    } catch {
      // not JSON
    }
    return null;
  };

  const parsed = tryParseJson(text);
  if (parsed) {
    const status = String(parsed.status ?? "");
    const code = parsed.code;
    const kind: ErrorKind =
      status === "RESOURCE_EXHAUSTED" || code === 429 ? "quota"
      : status === "UNAVAILABLE" || code === 503 ? "unavailable"
      : status === "NOT_FOUND" || code === 404 ? "notfound"
      : "other";
    return { kind, message: parsed.message, retrySeconds: parsed.retrySeconds };
  }

  const lower = text.toLowerCase();
  const kind: ErrorKind =
    lower.includes("quota") || lower.includes("resource_exhausted") || lower.includes(" 429 ")
      ? "quota"
      : lower.includes("unavailable") || lower.includes("high demand") || lower.includes(" 503 ")
        ? "unavailable"
        : lower.includes("no longer available") || lower.includes(" 404 ")
          ? "notfound"
          : "other";
  return { kind, message: text };
}

async function callGemini<T>(args: CallGeminiArgs<T>): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY. Copy .env.local.example to .env.local and add your Google AI Studio key."
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const config = {
    systemInstruction: args.systemInstruction,
    responseMimeType: "application/json",
    responseJsonSchema: args.jsonSchema,
  };

  const failureReasons: string[] = [];
  let waitSuggestion = 0;

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents:
            attempt === 1
              ? `${args.contents}\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no extra text.`
              : args.contents,
          config,
        });

        const text = response.text;
        if (!text) {
          throw new Error("Gemini returned an empty response.");
        }

        const validated = args.validate(extractJson(text));
        if (validated.success && validated.data !== undefined) {
          return validated.data;
        }
      } catch (err) {
        const info = describeGeminiError(err);
        failureReasons.push(`${model}: ${info.message}`);
        if (info.retrySeconds) waitSuggestion = Math.max(waitSuggestion, info.retrySeconds);
        // Retryable / model-specific failures -> fall through to the next model
        // (quota is per-model) or next attempt; unexpected errors bubble up after retries.
        if (info.kind === "quota") {
          break; // different model has a different quota bucket
        }
        if (info.kind === "unavailable" || info.kind === "notfound") {
          const backoff = info.retrySeconds
            ? Math.min(info.retrySeconds, 5000)
            : 400;
          await new Promise((r) => setTimeout(r, backoff));
          break; // try the next model
        }
        // unknown error -> give this model its second attempt
      }
    }
  }

  const tried = `Tried ${GEMINI_MODELS.length} model(s). ${failureReasons[0] ?? "No response."}`;
  const wait = waitSuggestion > 0 ? ` Wait about ${Math.ceil(waitSuggestion)}s before trying again.` : "";
  throw new Error(`Gemini was unavailable. ${tried}${wait}`);
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  // The model sometimes wraps JSON in code fences — strip them defensively.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      // fall through
    }
  }
  throw new Error("Could not parse the JSON from the model output.");
}

function normalizePlan(plan: PlanResponse): PlanResponse {
  const idByTitle = new Map<string, string>();
  const tasks = plan.tasks.map((task, i) => {
    const id = task.id && task.id.trim() ? task.id.trim() : `task-${i + 1}`;
    const resolved = {
      ...task,
      id,
      description: task.description ?? "",
      dependencies: (task.dependencies ?? []).map(
        (dep) => idByTitle.get(dep) ?? dep
      ),
      priority: task.priority ?? "medium",
    };
    idByTitle.set(task.title, id);
    return resolved;
  });
  return {
    ...plan,
    mode: plan.mode,
    timeLimitHours: plan.mode === "hackathon" ? plan.timeLimitHours : undefined,
    tasks,
  };
}