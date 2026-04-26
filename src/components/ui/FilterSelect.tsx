import React from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
}

export function FilterSelect({ label, options, ...props }: SelectProps) {
  return (
    <div className="flex min-w-[140px] flex-col gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </label>
      <select
        {...props}
        className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2.5 text-sm text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.05)] outline-none transition-all focus:border-[#2876b5] focus:ring-2 focus:ring-[#2876b5]/15"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
