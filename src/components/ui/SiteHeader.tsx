import Link from "next/link";

export function SiteHeader() {
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
          <Link href="/" className="rounded-full px-3 py-2 transition-colors hover:bg-indigo-50 hover:text-[#3a2aa1]">
            Sessions
          </Link>
          <Link href="/admin/create" className="rounded-full px-3 py-2 transition-colors hover:bg-indigo-50 hover:text-[#3a2aa1]">
            Create Sessions
          </Link>
          <Link href="/admin/import" className="rounded-full px-3 py-2 transition-colors hover:bg-indigo-50 hover:text-[#3a2aa1]">
            Admin Import
          </Link>
          <Link href="/admin/masters" className="rounded-full px-3 py-2 transition-colors hover:bg-indigo-50 hover:text-[#3a2aa1]">
            Masters
          </Link>
          <Link href="/insights" className="rounded-full px-3 py-2 transition-colors hover:bg-indigo-50 hover:text-[#3a2aa1]">
            Insights
          </Link>
          <Link href="/support" className="rounded-full px-3 py-2 transition-colors hover:bg-indigo-50 hover:text-[#3a2aa1]">
            Support
          </Link>
        </nav>
      </div>
    </header>
  );
}
