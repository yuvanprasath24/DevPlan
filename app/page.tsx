"use client";

import { useState } from "react";
import type {
  ApiPlanResponse,
  ApiQuestionsResponse,
  ClarificationAnswer,
  ClarificationQuestion,
  PlanMode,
} from "../lib/types";
import { useDevPlanStore, useHasHydrated } from "../lib/store";
import LandingForm from "../components/LandingForm";
import LoadingTerminal from "../components/LoadingTerminal";
import QuestionFlow, { type QaState } from "../components/QuestionFlow";
import PlanView from "../components/PlanView";

interface GenerateInput {
  description: string;
  mode: PlanMode;
  hours: number;
}

type Phase = "idle" | "asking" | "answering" | "planning";
type RetryKind = "pitch" | "plan";

const EMPTY_QA: QaState = { answers: {}, customMode: {} };

function extractError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const p = payload as { error?: unknown };
    if (typeof p.error === "string") return p.error;
  }
  return `Request failed (${status}).`;
}

export default function Home() {
  const hydrated = useHasHydrated();
  const { plan, setPlan } = useDevPlanStore();

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<RetryKind | null>(null);
  const [latestInput, setLatestInput] = useState<GenerateInput | null>(null);
  const [questions, setQuestions] = useState<ClarificationQuestion[] | null>(null);
  const [qa, setQa] = useState<QaState>(EMPTY_QA);

  const callApi = async (
    path: string,
    body: Record<string, unknown>
  ): Promise<unknown> => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(extractError(payload, res.status));
    return payload;
  };

  const planBody = (input: GenerateInput, answers: ClarificationAnswer[]) => ({
    description: input.description,
    mode: input.mode,
    timeLimitHours: input.mode === "hackathon" ? input.hours : undefined,
    answers,
  });

  const generatePlanWithAnswers = async (
    input: GenerateInput,
    answers: ClarificationAnswer[]
  ) => {
    setPhase("planning");
    setError(null);
    setRetry(null);
    try {
      const payload = (await callApi(
        "/api/plan",
        planBody(input, answers)
      )) as ApiPlanResponse;
      if (!payload.ok) throw new Error(payload.error);
      setPlan(payload.data);
      setQuestions(null);
      setQa(EMPTY_QA);
      setPhase("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plan generation failed.");
      setRetry("plan");
      setPhase("answering");
    }
  };

  const handlePitch = async (input: GenerateInput) => {
    setPhase("asking");
    setError(null);
    setRetry(null);
    setLatestInput(input);
    setQa(EMPTY_QA);
    try {
      const payload = (await callApi("/api/questions", planBody(input, []))) as ApiQuestionsResponse;
      if (!payload.ok) throw new Error(payload.error);
      setQuestions(payload.data.questions);
      setPhase("answering");
    } catch (err) {
      setError(
        err instanceof Error
          ? `Questions couldn't be generated — ${err.message}`
          : "Questions couldn't be generated."
      );
      setRetry("pitch");
      setPhase("idle");
    }
  };

  const handleAnswered = (answers: ClarificationAnswer[]) => {
    if (latestInput) void generatePlanWithAnswers(latestInput, answers);
  };

  const handleSkip = () => {
    if (latestInput) void generatePlanWithAnswers(latestInput, []);
  };

  const handleRetry = () => {
    if (!latestInput) return;
    if (retry === "pitch") void handlePitch(latestInput);
    else if (retry === "plan")
      void generatePlanWithAnswers(latestInput, Object.entries(qa.answers)
        .filter(([, v]) => v.trim().length > 0)
        .map(([questionId, answer]) => ({ questionId, answer: answer.trim() })));
  };

  const resetFlow = () => {
    setError(null);
    setRetry(null);
    setQuestions(null);
    setQa(EMPTY_QA);
    setPhase("idle");
  };

  const newPlan = () => {
    useDevPlanStore.getState().reset();
    resetFlow();
  };

  if (!hydrated) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-term-bg text-term-dim">
        loading session…
      </main>
    );
  }

  const retryPanel = error && (
    <div className="mb-4 space-y-2 rounded border border-term-red/50 bg-term-red/10 p-3">
      <p className="text-xs text-term-red">
        <span className="font-bold">✗ error:</span> {error}
      </p>
      <p className="text-[11px] text-term-dim">
        If the model is busy (high demand), a quick retry usually works.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleRetry}
          className="rounded border border-term-red px-3 py-1 text-xs font-bold text-term-red transition hover:bg-term-red hover:text-black"
        >
          [ try again ]
        </button>
        <button
          type="button"
          onClick={resetFlow}
          className="rounded border border-term-border px-3 py-1 text-xs font-bold text-term-dim transition hover:border-term-cyan hover:text-term-cyan"
        >
          [ new prompt ]
        </button>
      </div>
    </div>
  );

  return (
    <main className="min-h-dvh bg-term-bg text-term-fg">
      <div className="mx-auto max-w-3xl px-4">
        <header className="py-10 text-center">
          <p className="text-xs text-term-dim">
            <span className="text-term-green">$</span> devplan --version 1.0.0
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-wider text-term-green sm:text-5xl">
            DevPlan
            <span className="cursor-blink">▋</span>
          </h1>
          <p className="mt-4 text-sm text-term-fg/90">
            Plan a whole software project with AI — from empty folder to deployed app —{" "}
            <span className="text-term-green">before the deadline is gone</span>.
          </p>
          <p className="mt-1 text-xs text-term-dim">
            pitch → clarifying questions → structured checklist → pdf. no database, no fuss.
          </p>
        </header>

        <div className="mb-8 rounded border border-term-border bg-black/30 p-4">
          <p className="mb-4 text-xs text-term-dim">
            <span className="text-term-green">#</span> engage devplan
          </p>

          {phase === "asking" && (
            <div className="space-y-4">
              <LoadingTerminal command="ask" />
              <p className="break-words text-xs text-term-dim">
                <span className="text-term-amber">›</span> {latestInput?.description}
              </p>
            </div>
          )}

          {phase === "planning" && (
            <div className="space-y-4">
              <LoadingTerminal command="plan" />
              <p className="break-words text-xs text-term-dim">
                <span className="text-term-amber">›</span> {latestInput?.description}
              </p>
            </div>
          )}

          {phase === "answering" && questions && (
            <>
              {retry === "plan" && retryPanel}
              <QuestionFlow
                questions={questions}
                qa={qa}
                onQaChange={setQa}
                submitting={false}
                onGenerate={handleAnswered}
                onSkip={handleSkip}
              />
            </>
          )}

          {phase === "idle" && (
            <>
              {retry === "pitch" && retryPanel}
              {!plan && (
                <LandingForm onSubmit={handlePitch} />
              )}
            </>
          )}
        </div>

        {plan && <PlanView onNewPlan={newPlan} />}

        <footer className="pb-10 text-center text-[11px] text-term-dim">
          devplan — ai project planning that ships before the deadline ·{" "}
          <span className="text-term-green">build &gt; fancy</span>
        </footer>
      </div>
    </main>
  );
}