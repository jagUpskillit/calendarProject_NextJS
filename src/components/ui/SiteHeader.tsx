"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  match: (path: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Sessions",
    match: (path) => path === "/" || path.startsWith("/sessions/"),
  },
  {
    href: "/admin/create",
    label: "Create Sessions",
    match: (path) => path === "/admin/create",
  },
  {
    href: "/admin/import",
    label: "Admin Import",
    match: (path) => path === "/admin/import",
  },
  {
    href: "/admin/planner",
    label: "Quarter Planner",
    match: (path) => path === "/admin/planner",
  },
  {
    href: "/admin/masters",
    label: "Masters",
    match: (path) => path === "/admin/masters",
  },
  {
    href: "/insights",
    label: "Insights",
    match: (path) => path === "/insights",
  },
  {
    href: "/support",
    label: "Support",
    match: (path) => path === "/support",
  },
];

function navLinkClassName(isActive: boolean): string {
  if (isActive) {
    return "relative rounded-full bg-indigo-100 px-3 py-2 text-[#3a2aa1] shadow-[inset_0_0_0_1px_rgba(58,42,161,0.14)] transition-all duration-200 after:absolute after:bottom-1 after:left-1/2 after:h-0.5 after:w-6 after:-translate-x-1/2 after:rounded-full after:bg-[#3a2aa1] after:content-['']";
  }
  return "relative rounded-full px-3 py-2 text-slate-600 transition-all duration-200 hover:bg-indigo-50 hover:text-[#3a2aa1] after:absolute after:bottom-1 after:left-1/2 after:h-0.5 after:w-0 after:-translate-x-1/2 after:rounded-full after:bg-[#3a2aa1] after:transition-all after:duration-200 after:content-[''] hover:after:w-6";
}

export function SiteHeader() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/60 bg-white/82 backdrop-blur-xl shadow-[0_8px_30px_rgba(17,32,59,0.06)]">
      <div className="h-1 w-full bg-[linear-gradient(90deg,#3a2aa1_0%,#2876b5_50%,#4eb8d7_100%)]" />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 font-semibold text-slate-900 transition-colors hover:text-[#3a2aa1]">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3a2aa1,#2876b5_65%,#4eb8d7)] text-lg text-white shadow-[0_10px_24px_rgba(58,42,161,0.22)]">📅</span>
          <span className="flex flex-col leading-tight">
            <span className="hidden sm:inline text-base">Quarterly Calendar Explorer</span>
            <span className="sm:hidden text-base">Calendar</span>
            <span className="hidden sm:inline text-[11px] font-medium tracking-wide text-slate-500">Cognizant-inspired training hub</span>
          </span>
          <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700 shadow-sm">
            DEV
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium text-slate-600 sm:gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive = item.match(pathname);
            return (
              <Link key={item.href} href={item.href} className={navLinkClassName(isActive)} aria-current={isActive ? "page" : undefined}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
