"use client";

import { useState } from "react";
import type { ApiPlanResponse, PlanMode } from "../lib/types";
import { useDevPlanStore, useHasHydrated } from "../lib/store";
import LandingForm from "../components/LandingForm";
import LoadingTerminal from "../components/LoadingTerminal";
import PlanView from "../components/PlanView";

interface GenerateInput {
  description: string;
  mode: PlanMode;
  hours: number;
}

export default function Home() {
  const hydrated = useHasHydrated();
  const { setPlan } = useDevPlanStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInput, setLastInput] = useState<GenerateInput | null>(null);

  const handleGenerate = async (input: GenerateInput) => {
    setLoading(true);
    setError(null);
    setLastInput(input);

    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: input.description,
          mode: input.mode,
          timeLimitHours: input.mode === "hackathon" ? input.hours : undefined,
        }),
      });

      const payload = (await res.json()) as ApiPlanResponse;
      if (!res.ok || !payload.ok) {
        const msg = !payload.ok ? payload.error : `Request failed (${res.status})`;
        throw new Error(msg);
      }

      setPlan(payload.data);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Plan generation failed. Check your Gemini API key and try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
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
            pitch → plan mode → structured checklist → pdf. no database, no fuss.
          </p>
        </header>

        <div className="mb-8 rounded border border-term-border bg-black/30 p-4">
          <p className="mb-4 text-xs text-term-dim">
            <span className="text-term-green">#</span> engage devplan
          </p>

          {loading && (
            <div className="space-y-4">
              <LoadingTerminal />
              <p className="break-words text-xs text-term-dim">
                <span className="text-term-amber">›</span> {lastInput?.description}
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="mb-4 space-y-3">
              <div className="rounded border border-term-red/50 bg-term-red/10 p-3 text-xs text-term-red">
                <span className="font-bold">✗ error:</span> {error}
              </div>
              <LandingForm onSubmit={handleGenerate} />
            </div>
          )}

          {!loading && !error && (
            <LandingForm onSubmit={handleGenerate} />
          )}
        </div>

        <PlanView />

        <footer className="pb-10 text-center text-[11px] text-term-dim">
          devplan — ai project planning that ships before the deadline ·{" "}
          <span className="text-term-green">build &gt; fancy</span>
        </footer>
      </div>
    </main>
  );
}