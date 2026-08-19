import { GoogleGenAI } from "@google/genai";
import { planResponseSchema, type PlanRequest, type PlanResponse } from "./types";

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

const categoryEnum = [
  "Environment Setup",
  "Foundation",
  "Core Feature",
  "Polish",
  "Deployment",
];

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

export function buildUserPrompt(req: PlanRequest): string {
  const timeLine =
    req.mode === "hackathon"
      ? `\nTime budget: ${req.timeLimitHours} hour(s) — hard deadline. Plan must fit.\n`
      : "\nMode: Personal project, no time limit.\n";
  return `Plan the following project:
${"-".repeat(60)}
${req.description}
${"-".repeat(60)}${timeLine}`;
}

export async function generatePlan(req: PlanRequest): Promise<PlanResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY. Copy .env.local.example to .env.local and add your Google AI Studio key."
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const contents = buildUserPrompt(req);
  const config = {
    systemInstruction: buildSystemInstruction(),
    responseMimeType: "application/json",
    responseJsonSchema: geminiPlanSchema,
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents:
        attempt === 1
          ? `${contents}\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no extra text.`
          : contents,
      config,
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    const parsed = parsePlanText(text);
    const validated = planResponseSchema.safeParse(parsed);
    if (validated.success) {
      return normalizePlan(validated.data);
    }
  }

  throw new Error(
    "The model returned a plan that did not match the expected structure. Please try again."
  );
}

function parsePlanText(text: string): unknown {
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
  throw new Error("Could not parse the plan JSON from the model output.");
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
  return { ...plan, tasks };
}