"use client";

import type { PlanningCycle } from "@/types";

interface PlanningCycleSelectorProps {
  cycles: PlanningCycle[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  label?: string;
}

export function PlanningCycleSelector({
  cycles,
  value,
  onChange,
  className,
  label = "Quarter",
}: PlanningCycleSelectorProps) {
  return (
    <label className={className ?? "block"}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.04)] outline-none focus:border-[#2876b5] focus:ring-2 focus:ring-[#2876b5]/15"
      >
        {cycles.map((cycle) => (
          <option key={cycle.id} value={cycle.id}>
            {cycle.label}
          </option>
        ))}
      </select>
    </label>
  );
}
