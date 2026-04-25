import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold text-blue-700 hover:text-blue-900">
          <span className="text-xl">📅</span>
          <span className="hidden sm:inline">Quarterly Calendar Explorer</span>
          <span className="sm:hidden">Calendar</span>
          <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            DEV
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium text-gray-600">
          <Link href="/" className="hover:text-blue-700 transition-colors">
            Sessions
          </Link>
          <Link href="/admin/import" className="hover:text-blue-700 transition-colors">
            Admin Import
          </Link>
          <Link href="/support" className="hover:text-blue-700 transition-colors">
            Support
          </Link>
        </nav>
      </div>
    </header>
  );
}
