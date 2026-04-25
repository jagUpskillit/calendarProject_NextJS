import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "blue" | "green" | "amber" | "purple" | "red" | "gray";
}

const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-gray-100 text-gray-700",
  blue:    "bg-blue-100 text-blue-800",
  green:   "bg-green-100 text-green-800",
  amber:   "bg-amber-100 text-amber-800",
  purple:  "bg-purple-100 text-purple-800",
  red:     "bg-red-100 text-red-800",
  gray:    "bg-gray-200 text-gray-600",
};

export function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}
