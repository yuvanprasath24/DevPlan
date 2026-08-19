"use client";

import { useState } from "react";
import type { PlanMode } from "../lib/types";

interface LandingFormProps {
  onSubmit: (input: { description: string; mode: PlanMode; hours: number }) => void;
}

export default function LandingForm({ onSubmit }: LandingFormProps) {
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<PlanMode>("hackathon");
  const [hours, setHours] = useState(6);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim().length < 10) return;
    onSubmit({ description: description.trim(), mode, hours });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="text-xs text-term-dim">
          <span className="text-term-green">$</span> describe the project
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder='e.g. "A CLI tool that turns a restaurant menu into a social share-card generator"'
          rows={4}
          className="mt-2 w-full resize-none rounded border border-term-border bg-black/40 px-3 py-2 text-sm text-term-fg placeholder:text-term-dim/60 outline-none focus:border-term-green/70"
        />
        <p className="mt-1 text-right text-xs text-term-dim">
          {description.length} chars (min 10)
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-term-dim">mode:</span>
        <button
          type="button"
          onClick={() => setMode("personal")}
          className={`rounded border px-3 py-1 text-xs transition ${
            mode === "personal"
              ? "border-term-green bg-term-check text-term-green"
              : "border-term-border text-term-dim hover:border-term-green/50"
          }`}
        >
          personal · no limit
        </button>
        <button
          type="button"
          onClick={() => setMode("hackathon")}
          className={`rounded border px-3 py-1 text-xs transition ${
            mode === "hackathon"
              ? "border-term-green bg-term-check text-term-green"
              : "border-term-border text-term-dim hover:border-term-green/50"
          }`}
        >
          hackathon · X hrs
        </button>

        {mode === "hackathon" && (
          <label className="flex items-center gap-2 text-xs text-term-dim">
            budget
            <input
              type="number"
              min={1}
              max={48}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="w-16 rounded border border-term-border bg-black/40 px-2 py-1 text-center text-term-green outline-none focus:border-term-green/70"
            />
            hrs
          </label>
        )}
      </div>

      <button
        type="submit"
        disabled={description.trim().length < 10}
        className="w-full rounded border border-term-green bg-term-check px-4 py-2 font-bold text-term-green transition hover:bg-term-green hover:text-black disabled:cursor-not-allowed disabled:border-term-border disabled:bg-transparent disabled:text-term-dim"
      >
        <span className="font-mono">$ devplan gen</span>
        <span className="ml-2 cursor-blink">▋</span>
      </button>

      <p className="text-center text-[11px] text-term-dim">
        enter key to run · one plan per project · progress saved locally
      </p>
    </form>
  );
}