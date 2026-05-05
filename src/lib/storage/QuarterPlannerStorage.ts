import type { PlanningCycle } from "@/types";

export interface QuarterPlanRow {
  id: string;
  planningCycleId: string;
  dateISO: string;
  programName: string;
  capability: string;
  targetAudience: string;
  deliveryMode: string;
  facilitator: string;
  notes: string;
  source: "suggested" | "manual";
}

export interface QuarterPlanDraft {
  planningCycleId: string;
  rows: QuarterPlanRow[];
  updatedAt: string;
}

const STORAGE_KEY = "calendarproject_v1.quarterPlanner.byCycle";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeRead<T>(fallback: T): T {
  if (!canUseStorage()) return fallback;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite(value: unknown): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export class QuarterPlannerStorage {
  loadAll(): Record<string, QuarterPlanDraft> {
    return safeRead<Record<string, QuarterPlanDraft>>({});
  }

  loadCycle(cycleId: string): QuarterPlanDraft | null {
    const all = this.loadAll();
    return all[cycleId] ?? null;
  }

  saveCycle(cycleId: string, rows: QuarterPlanRow[]): QuarterPlanDraft {
    const all = this.loadAll();
    const draft: QuarterPlanDraft = {
      planningCycleId: cycleId,
      rows,
      updatedAt: new Date().toISOString(),
    };
    all[cycleId] = draft;
    safeWrite(all);
    return draft;
  }

  clearCycle(cycleId: string): void {
    const all = this.loadAll();
    if (all[cycleId]) {
      delete all[cycleId];
      safeWrite(all);
    }
  }
}

export const quarterPlannerStorage = new QuarterPlannerStorage();
