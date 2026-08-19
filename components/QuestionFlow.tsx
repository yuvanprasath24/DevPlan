"use client";

import { useState } from "react";
import type {
  ClarificationAnswer,
  ClarificationQuestion,
} from "../lib/types";

interface QuestionFlowProps {
  questions: ClarificationQuestion[];
  submitting: boolean;
  onGenerate: (answers: ClarificationAnswer[]) => void;
  onSkip: () => void;
}

export default function QuestionFlow({
  questions,
  submitting,
  onGenerate,
  onSkip,
}: QuestionFlowProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customMode, setCustomMode] = useState<Record<string, boolean>>({});

  const answeredCount = questions.filter((q) => (answers[q.id] ?? "").trim()).length;

  const pickOption = (q: ClarificationQuestion, label: string) =>
    setAnswers((prev) => ({ ...prev, [q.id]: label }));

  const toggleCustom = (q: ClarificationQuestion) =>
    setCustomMode((prev) => ({ ...prev, [q.id]: !prev[q.id] }));

  const handleGenerate = () => {
    const collected: ClarificationAnswer[] = questions
      .filter((q) => (answers[q.id] ?? "").trim().length > 0)
      .map((q) => ({ questionId: q.id, answer: answers[q.id].trim() }));
    onGenerate(collected);
  };

  return (
    <div className="rounded border border-term-amber/40 bg-black/40 p-4">
      <p className="mb-1 text-xs text-term-dim">
        <span className="text-term-amber">$</span> devplan ask --clarify
      </p>
      <p className="mb-4 text-xs text-term-dim">
        Sharpen the brief before the plan is written. Skipping uses only the
        pitch.
      </p>

      <div className="space-y-5">
        {questions.map((q, idx) => {
          const value = answers[q.id] ?? "";
          const isCustom = customMode[q.id] ?? false;
          return (
            <div
              key={q.id}
              className="rounded border border-term-border bg-black/30 p-3"
            >
              <p className="text-sm font-bold text-term-fg">
                <span className="mr-2 text-term-amber">
                  Q{idx + 1}/{questions.length}
                </span>
                {q.question}
              </p>
              {q.detail && (
                <p className="mt-1 text-xs text-term-dim">{q.detail}</p>
              )}

              <div className="mt-2 flex flex-wrap gap-2">
                {q.options.map((opt) => {
                  const active = !isCustom && value === opt.label;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        setCustomMode((p) => ({ ...p, [q.id]: false }));
                        pickOption(q, opt.label);
                      }}
                      className={`rounded border px-2 py-1 text-xs transition disabled:opacity-50 ${
                        active
                          ? "border-term-amber bg-term-amber/20 text-term-amber"
                          : "border-term-border text-term-dim hover:border-term-amber/60"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
                {q.allowCustom && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => toggleCustom(q)}
                    className={`rounded border px-2 py-1 text-xs transition disabled:opacity-50 ${
                      isCustom
                        ? "border-term-amber bg-term-amber/20 text-term-amber"
                        : "border-term-border text-term-dim hover:border-term-amber/60"
                    }`}
                  >
                    custom…
                  </button>
                )}
              </div>

              {q.allowCustom && isCustom && (
                <input
                  type="text"
                  value={value}
                  disabled={submitting}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                  placeholder="type your answer…"
                  className="mt-2 w-full rounded border border-term-amber/40 bg-black/40 px-2 py-1 text-sm text-term-fg placeholder:text-term-dim/60 outline-none focus:border-term-amber/70"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={submitting}
          className="rounded border border-term-green bg-term-check px-4 py-2 text-sm font-bold text-term-green transition hover:bg-term-green hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          [ generate optimized plan ]
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={submitting}
          className="rounded border border-term-border px-4 py-2 text-sm font-bold text-term-dim transition hover:border-term-cyan hover:text-term-cyan disabled:opacity-50"
        >
          [ skip questions ]
        </button>
        <span className="text-[11px] text-term-dim">
          {answeredCount}/{questions.length} answered
        </span>
      </div>
    </div>
  );
}