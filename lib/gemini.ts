import { GoogleGenAI } from "@google/genai";
import {
  planResponseSchema,
  questionsResponseSchema,
  type PlanRequest,
  type PlanResponse,
  type QuestionsResponse,
} from "./types";

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

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
    errorMessage:
      "The model returned questions that did not match the expected structure.",
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
    errorMessage:
      "The model returned a plan that did not match the expected structure. Please try again.",
  });
  return normalizePlan(validated);
}

interface CallGeminiArgs<T> {
  systemInstruction: string;
  contents: string;
  jsonSchema: unknown;
  validate: (parsed: unknown) => { success: boolean; data?: T | undefined };
  errorMessage: string;
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

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
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
  }

  throw new Error(args.errorMessage);
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