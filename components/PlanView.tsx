"use client";

import { useMemo } from "react";
import { CATEGORY_ORDER, type Task } from "../lib/types";
import { useDevPlanStore, type DevPlanStatus } from "../lib/store";
import { downloadPlanPdf } from "../lib/pdf";

const STATUS_META: Record<DevPlanStatus, { label: string; mark: string; cls: string }> = {
  todo: { label: "TODO", mark: "[ ]", cls: "text-term-dim border-term-border" },
  working: { label: "WORK", mark: "[~]", cls: "text-term-amber border-term-amber/50" },
  done: { label: "DONE", mark: "[x]", cls: "text-term-green border-term-green/50" },
};

function statusOf(task: Task, statuses: Record<string, DevPlanStatus>): DevPlanStatus {
  return statuses[task.id ?? task.title] ?? "todo";
}

function formatMinutes(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

export default function PlanView() {
  const { plan, statuses, cycleStatus, reset } = useDevPlanStore();

  const totals = useMemo(() => {
    if (!plan) return { tasks: 0, minutes: 0, done: 0, working: 0, todo: 0, pct: 0 };
    const minutes = plan.tasks.reduce((s, t) => s + (t.estimatedMinutes || 0), 0);
    let done = 0;
    let working = 0;
    for (const task of plan.tasks) {
      const s = statusOf(task, statuses);
      if (s === "done") done++;
      else if (s === "working") working++;
    }
    const todo = plan.tasks.length - done - working;
    const pct = plan.tasks.length ? Math.round((done / plan.tasks.length) * 100) : 0;
    return { tasks: plan.tasks.length, minutes, done, working, todo, pct };
  }, [plan, statuses]);

  if (!plan) return null;

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    tasks: plan.tasks.filter((t) => t.category === category),
  })).filter((g) => g.tasks.length > 0);

  const handleDownload = () => downloadPlanPdf(plan, statuses);

  return (
    <div className="fade-up space-y-6">
      {/* header */}
      <div className="rounded border border-term-border bg-black/40 p-4">
        <p className="mb-2 text-xs text-term-dim">
          <span className="text-term-green">$</span> devplan plan
          <span className="cursor-blink ml-1">▋</span>
        </p>
        <h2 className="text-2xl font-bold text-term-green"># {plan.projectTitle}</h2>
        {plan.tagline && (
          <p className="mt-1 text-sm text-term-amber">“{plan.tagline}”</p>
        )}
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-term-fg/90">
          {plan.summary}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-term-dim">
          <span className="rounded border border-term-border px-2 py-0.5">
            mode: {plan.mode}
          </span>
          {plan.timeLimitHours && (
            <span className="rounded border border-term-border px-2 py-0.5">
              budget: {plan.timeLimitHours}h
            </span>
          )}
          <span className="rounded border border-term-border px-2 py-0.5">
            est effort: {formatMinutes(totals.minutes)}
          </span>
        </div>
      </div>

      {/* progress strip */}
      <div className="rounded border border-term-border bg-black/40 p-4">
        <div className="flex items-center justify-between text-xs text-term-dim">
          <span>
            tasks <span className="text-term-fg">{totals.tasks}</span>
          </span>
          <span>
            done <span className="text-term-green">{totals.done}</span>
          </span>
          <span>
            working <span className="text-term-amber">{totals.working}</span>
          </span>
          <span>
            todo <span className="text-term-cyan">{totals.todo}</span>
          </span>
          <span>
            progress <span className="text-term-green">{totals.pct}%</span>
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded bg-term-check">
          <div
            className="h-full bg-term-green transition-all"
            style={{ width: `${totals.pct}%` }}
          />
        </div>
      </div>

      {/* user flow */}
      <section className="rounded border border-term-border bg-black/40 p-4">
        <h3 className="mb-3 text-xs font-bold tracking-widest text-term-amber">
          {"// USER FLOW"}
        </h3>
        <ol className="space-y-2">
          {plan.userFlow.map((f, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="shrink-0 text-term-green">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-term-fg/90">
                <span className="font-bold text-term-fg">{f.step}</span>
                <span className="text-term-dim"> — {f.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* tech stack */}
      {plan.techStack.length > 0 && (
        <section className="rounded border border-term-border bg-black/40 p-4">
          <h3 className="mb-3 text-xs font-bold tracking-widest text-term-amber">
            {"// TECH STACK"}
          </h3>
          <div className="flex flex-wrap gap-2">
            {plan.techStack.map((t, i) => (
              <span
                key={i}
                className="rounded border border-term-border px-2 py-1 text-xs text-term-cyan"
              >
                {t}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* must include / must avoid */}
      {plan.mode === "hackathon" && plan.mustInclude.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded border border-term-green/40 bg-black/40 p-4">
            <h3 className="mb-3 text-xs font-bold tracking-widest text-term-green">
              [+] MUST INCLUDE
            </h3>
            <ul className="space-y-2">
              {plan.mustInclude.map((m, i) => (
                <li key={i} className="text-sm">
                  <span className="font-bold text-term-green">{m.item}</span>
                  <span className="text-term-dim"> — {m.why}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded border border-term-red/40 bg-black/40 p-4">
            <h3 className="mb-3 text-xs font-bold tracking-widest text-term-red">
              [!] MUST AVOID
            </h3>
            <ul className="space-y-2">
              {plan.mustAvoid.map((m, i) => (
                <li key={i} className="text-sm">
                  <span className="font-bold text-term-red">{m.trap}</span>
                  <span className="text-term-dim"> — {m.why}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {/* checklist */}
      <section className="space-y-4">
        <h3 className="text-xs font-bold tracking-widest text-term-amber">
          {"// CHECKLIST"}
        </h3>
        {grouped.map((group) => {
          const doneInGroup = group.tasks.filter(
            (t) => statusOf(t, statuses) === "done"
          ).length;
          return (
            <div
              key={group.category}
              className="rounded border border-term-border bg-black/40 p-4"
            >
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-bold text-term-cyan">{group.category}</span>
                <span className="text-term-dim">
                  {doneInGroup}/{group.tasks.length}
                </span>
              </div>
              <ul className="divide-y divide-term-border/50">
                {group.tasks.map((task) => {
                  const status = statusOf(task, statuses);
                  const meta = STATUS_META[status];
                  return (
                    <li key={task.id ?? task.title} className="py-2">
                      <button
                        onClick={() => cycleStatus(task.id ?? task.title)}
                        className="w-full text-left"
                        title="click to cycle todo → working → done"
                      >
                        <span className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 w-8 shrink-0 rounded border px-1 py-0.5 text-center font-mono text-xs ${meta.cls}`}
                          >
                            {meta.mark}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={`text-sm font-medium ${
                                status === "done"
                                  ? "text-term-dim line-through"
                                  : "text-term-fg"
                              }`}
                            >
                              {task.title}
                            </span>
                            {task.description && (
                              <span className="mt-0.5 block text-xs text-term-dim">
                                {task.description}
                              </span>
                            )}
                            <span className="mt-1 flex gap-2 text-[10px] uppercase tracking-wide text-term-dim">
                              <span>{meta.label}</span>
                              <span>~{formatMinutes(task.estimatedMinutes)}</span>
                              <span
                                className={
                                  task.priority === "high"
                                    ? "text-term-red"
                                    : task.priority === "medium"
                                      ? "text-term-amber"
                                      : "text-term-dim"
                                }
                              >
                                {task.priority}
                              </span>
                            </span>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      {/* footer actions */}
      <div className="flex flex-wrap gap-3 pb-12">
        <button
          onClick={handleDownload}
          className="rounded border border-term-cyan px-4 py-2 text-sm font-bold text-term-cyan transition hover:bg-term-cyan hover:text-black"
        >
          [ download plan.pdf ]
        </button>
        <button
          onClick={reset}
          className="rounded border border-term-border px-4 py-2 text-sm font-bold text-term-dim transition hover:border-term-red hover:text-term-red"
        >
          [ new plan ]
        </button>
      </div>
    </div>
  );
}