"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import * as React from "react";
import type { PlanResponse } from "../lib/types";

export type DevPlanStatus = "done" | "working" | "todo";

export interface DevPlanState {
  plan: PlanResponse | null;
  statuses: Record<string, DevPlanStatus>;
  setPlan: (plan: PlanResponse) => void;
  setStatus: (taskId: string, status: DevPlanStatus) => void;
  cycleStatus: (taskId: string) => void;
  reset: () => void;
}

const NEXT_STATUS: Record<DevPlanStatus, DevPlanStatus> = {
  todo: "working",
  working: "done",
  done: "todo",
};

export const useDevPlanStore = create<DevPlanState>()(
  persist(
    (set) => ({
      plan: null,
      statuses: {},
      setPlan: (plan) =>
        set(() => ({
          plan,
          statuses: Object.fromEntries(
            plan.tasks.map((task) => [task.id ?? task.title, "todo"])
          ),
        })),
      setStatus: (taskId, status) =>
        set((state) => ({ statuses: { ...state.statuses, [taskId]: status } })),
      cycleStatus: (taskId) =>
        set((state) => {
          const current: DevPlanStatus = state.statuses[taskId] ?? "todo";
          return {
            statuses: { ...state.statuses, [taskId]: NEXT_STATUS[current] },
          };
        }),
      reset: () => set(() => ({ plan: null, statuses: {} })),
    }),
    { name: "devplan-state" }
  )
);

export function useHasHydrated(): boolean {
  return React.useSyncExternalStore(
    (cb) => {
      const unsub = useDevPlanStore.subscribe(cb);
      useDevPlanStore.persist.onFinishHydration(cb);
      return unsub;
    },
    () =>
      typeof window === "undefined" ? false : useDevPlanStore.persist.hasHydrated(),
    () => false
  );
}