"use client";

import { useEffect, useState } from "react";

const STEPS = [
  { text: "apollo init devplan", icons: ["✦", "✦"] },
  { text: "resolving project description…", icons: ["◐", "◑", "◒", "◓"] },
  { text: "invoking gemini-3.5-flash…", icons: ["◐", "◑", "◒", "◓"] },
  { text: "waiting on model output…", icons: ["◐", "◑", "◒", "◓"] },
  { text: "parsing structured plan ✓", icons: ["✓"] },
];

const COLORS = ["text-term-green", "text-term-dim", "text-term-amber", "text-term-cyan", "text-term-purple"];
const TICKS_PER_STEP = 10;

export default function LoadingTerminal({ command = "gen" }: { command?: string }) {
  const [tick, setTick] = useState(0);
  const total = STEPS.length * TICKS_PER_STEP;

  useEffect(() => {
    if (tick >= total) return;
    const id = setInterval(() => setTick((t) => t + 1), 140);
    return () => clearInterval(id);
  }, [tick, total]);

  const visible = Math.min(Math.floor(tick / TICKS_PER_STEP) + 1, STEPS.length);
  const tickIdx = tick % TICKS_PER_STEP;

  return (
    <div className="rounded border border-term-border bg-black/50 p-4 text-sm">
      <p className="mb-3 text-xs text-term-dim">$ devplan {command} --now</p>
      {STEPS.slice(0, visible).map((s, i) => (
        <p key={i} className={COLORS[i % COLORS.length]}>
          <span className="mr-2">→</span>
          {s.text}
        </p>
      ))}
      {visible < STEPS.length && (
        <p className="mt-1 text-term-green">
          <span className="mr-2">→</span>
          {STEPS[visible].icons[tickIdx % STEPS[visible].icons.length]}{" "}
          <span className="cursor-blink">▋</span>
        </p>
      )}
      {visible >= STEPS.length && (
        <p className="mt-2 text-term-green">
          <span className="mr-2">$</span>plan ready
          <span className="cursor-blink ml-1">▋</span>
        </p>
      )}
    </div>
  );
}