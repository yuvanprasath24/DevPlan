"use client";

import { useEffect, useState } from "react";

const STEPS = [
  { text: "apollo init devplan", icons: ["✦", "✦"] },
  { text: "resolving project description…", icons: ["◐", "◑", "◒", "◓"] },
  { text: "invoking gemini-3.6-flash…", icons: ["◐", "◑", "◒", "◓"] },
  { text: "waiting on model output…", icons: ["◐", "◑", "◒", "◓"] },
  { text: "parsing structured plan ✓", icons: ["✓"] },
];

const COLORS = [
  "text-term-green",
  "text-term-dim",
  "text-term-amber",
  "text-term-cyan",
  "text-term-purple",
];
const SPINNER = ["◐", "◓", "◑", "◒"];
const TICKS_PER_STEP = 9;

export default function LoadingTerminal({ command = "gen" }: { command?: string }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 160);
    return () => clearInterval(id);
  }, []);

  const revealCount = Math.min(Math.floor(tick / TICKS_PER_STEP) + 1, STEPS.length);
  const stepIdx = tick % TICKS_PER_STEP;
  const allDone = revealCount >= STEPS.length;
  const allDoneTicks = tick - STEPS.length * TICKS_PER_STEP;

  return (
    <div className="rounded border border-term-border bg-black/50 p-4 text-sm">
      <p className="mb-3 text-xs text-term-dim">$ devplan {command} --now</p>
      {STEPS.slice(0, revealCount).map((s, i) => (
        <p key={i} className={COLORS[i % COLORS.length]}>
          <span className="mr-2">→</span>
          {s.icons[stepIdx % s.icons.length]} {s.text}
        </p>
      ))}
      {!allDone && (
        <p className="mt-1 text-term-green">
          <span className="mr-2">→</span>
          {STEPS[revealCount].icons[stepIdx % STEPS[revealCount].icons.length]}{" "}
          {STEPS[revealCount].text}
          <span className="cursor-blink ml-1">▋</span>
        </p>
      )}
      {allDone && (
        <div className="mt-2">
          <p className="font-bold text-term-green">
            <span className="mr-2">→</span>
            {SPINNER[allDoneTicks % SPINNER.length]} still thinking…
            <span className="cursor-blink ml-1">▋</span>
          </p>
          <p className="mt-1 text-[11px] text-term-dim">
            plan builds in its own time — usually 10–60s. don&apos;t close the tab.
          </p>
        </div>
      )}
    </div>
  );
}