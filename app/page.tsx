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
import QuestionFlow from "../components/QuestionFlow";
import PlanView from "../components/PlanView";

interface GenerateInput {
  description: string;
  mode: PlanMode;
  hours: number;
}

type Phase = "idle" | "asking" | "answering" | "planning";

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
  const [latestInput, setLatestInput] = useState<GenerateInput | null>(null);
  const [questions, setQuestions] = useState<ClarificationQuestion[] | null>(null);

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
    try {
      const payload = (await callApi(
        "/api/plan",
        planBody(input, answers)
      )) as ApiPlanResponse;
      if (!payload.ok) throw new Error(payload.error);
      setPlan(payload.data);
      setQuestions(null);
      setPhase("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plan generation failed.");
      setPhase("answering");
    }
  };

  const handlePitch = async (input: GenerateInput) => {
    setPhase("asking");
    setError(null);
    setLatestInput(input);
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
      setPhase("idle");
    }
  };

  const handleAnswered = (answers: ClarificationAnswer[]) => {
    if (latestInput) void generatePlanWithAnswers(latestInput, answers);
  };

  const handleSkip = () => {
    if (latestInput) void generatePlanWithAnswers(latestInput, []);
  };

  const newPlan = () => {
    useDevPlanStore.getState().reset();
    setQuestions(null);
    setPhase("idle");
    setError(null);
  };

  if (!hydrated) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-term-bg text-term-dim">
        loading session…
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-term-bg text-term-fg">
      <div className="mx-auto max-w-3xl px-4">
        <header className="py-10">
          <pre className="text-sm leading-snug text-term-green">
{` ▄▄▄▄▄▄▄▄▄▄▄ ▄▄▄▄   ▄▄▄▄▄▄▄▄ ▄▄▄▄▄▄▄▄ ▄▄▄▄▄▄▄▄
 █ ▄▄▄▄▄ █ █▀▄█ ▄▄▄▀▀▀██ ▄▀█ █ ▄▄▄▄▄ █
 █ █   █ █ ▄ ▄  ▄▄ ▄ █▄▀▄█ █ █ █   █ █
 █ █▄▄▄█ █ █▄█ ▀▀█▄▄▀██▄▄███ █ █▄▄▄█ █
 █▄▄▄▄▄▄▄█▄█▄█▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄█▄█▄▄▄▄▄▄▄█`}
          </pre>
          <p className="mt-3 text-sm text-term-fg/90">
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
            <QuestionFlow
              questions={questions}
              submitting={false}
              onGenerate={handleAnswered}
              onSkip={handleSkip}
            />
          )}

          {error && phase === "idle" && (
            <div className="mb-4 space-y-3">
              <div className="rounded border border-term-red/50 bg-term-red/10 p-3 text-xs text-term-red">
                <span className="font-bold">✗ error:</span> {error}
              </div>
              <LandingForm onSubmit={handlePitch} />
            </div>
          )}

          {phase === "idle" && !plan && !error && (
            <LandingForm onSubmit={handlePitch} />
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