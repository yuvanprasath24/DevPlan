import { z } from "zod";

export const planModeSchema = z.enum(["personal", "hackathon"]);
export type PlanMode = z.infer<typeof planModeSchema>;

export const planRequestSchema = z.object({
  description: z
    .string()
    .trim()
    .min(10, "Describe your project in at least 10 characters.")
    .max(2000, "Keep the description under 2000 characters."),
  mode: planModeSchema,
  timeLimitHours: z
    .number()
    .int()
    .min(1, "Provide at least 1 hour.")
    .max(48, "Hackathons rarely exceed 48 hours.")
    .optional(),
});
export type PlanRequest = z.infer<typeof planRequestSchema>;

export const taskSchema = z.object({
  id: z.string().optional(),
  category: z.enum([
    "Environment Setup",
    "Foundation",
    "Core Feature",
    "Polish",
    "Deployment",
  ]),
  title: z.string(),
  description: z.string().default(""),
  estimatedMinutes: z.number().int().positive(),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  dependencies: z.array(z.string()).default([]),
});
export type Task = z.infer<typeof taskSchema>;

export const flowStepSchema = z.object({
  step: z.string(),
  detail: z.string(),
});
export type FlowStep = z.infer<typeof flowStepSchema>;

export const mustItemSchema = z.object({
  item: z.string(),
  why: z.string(),
});
export type MustItem = z.infer<typeof mustItemSchema>;

export const avoidItemSchema = z.object({
  trap: z.string(),
  why: z.string(),
});
export type AvoidItem = z.infer<typeof avoidItemSchema>;

export const planResponseSchema = z.object({
  projectTitle: z.string(),
  tagline: z.string().default(""),
  summary: z.string(),
  mode: planModeSchema,
  timeLimitHours: z.number().int().positive().optional(),
  techStack: z.array(z.string()).default([]),
  userFlow: z.array(flowStepSchema).default([]),
  mustInclude: z.array(mustItemSchema).default([]),
  mustAvoid: z.array(avoidItemSchema).default([]),
  tasks: z.array(taskSchema).min(1, "The plan must contain at least one task."),
});
export type PlanResponse = z.infer<typeof planResponseSchema>;

export const CATEGORY_ORDER = [
  "Environment Setup",
  "Foundation",
  "Core Feature",
  "Polish",
  "Deployment",
] as const;

export const apiPlanResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: planResponseSchema }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);
export type ApiPlanResponse = z.infer<typeof apiPlanResponseSchema>;