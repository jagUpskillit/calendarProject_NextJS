import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "blue" | "green" | "amber" | "purple" | "red" | "gray";
}

const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "border border-slate-200 bg-slate-100/90 text-slate-700",
  blue:    "border border-sky-200 bg-sky-50 text-sky-800",
  green:   "border border-emerald-200 bg-emerald-50 text-emerald-800",
  amber:   "border border-amber-200 bg-amber-50 text-amber-800",
  purple:  "border border-violet-200 bg-violet-50 text-violet-800",
  red:     "border border-rose-200 bg-rose-50 text-rose-800",
  gray:    "border border-slate-200 bg-slate-100 text-slate-600",
};

export function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shadow-sm ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}
