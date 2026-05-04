"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ImportMetadata, Session } from "@/types";
import { buildAssistantInsightReport } from "@/lib/assistant/insights";
import { getSessionRepository } from "@/lib/repository";
import { calendarStorage } from "@/lib/storage";

interface BreakdownRow {
  label: string;
  count: number;
}

interface InsightsFilters {
  geo: string;
  capability: string;
  deliveryMode: string;
  facilitator: string;
}

const DEFAULT_FILTERS: InsightsFilters = {
  geo: "all",
  capability: "all",
  deliveryMode: "all",
  facilitator: "all",
};

function formatMonthLabel(value: string) {
  if (value === "Undated") return value;
  const [year, month] = value.split("-");
  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  if (!parsedYear || !parsedMonth) return value;
  return new Date(parsedYear, parsedMonth - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function formatDateStamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

function uniqueValues(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function matchesFilter(value: string | undefined, selected: string, fallback: string) {
  if (selected === "all") return true;
  return (value ?? fallback) === selected;
}

function escapeCsvValue(value: string | number | null | undefined) {
  const normalized = value == null ? "" : String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function downloadBrowserFile(content: string, fileName: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function countBy(values: string[]): BreakdownRow[] {
  const map = new Map<string, number>();
  for (const value of values) {
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function BreakdownCard({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  return (
    <section className="rounded-[24px] border border-white/70 bg-white/88 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No data available.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.slice(0, 8).map((row) => (
            <div key={row.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{row.label}</span>
                <span className="text-slate-500">{row.count}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-[linear-gradient(90deg,#3a2aa1,#2876b5)]"
                  style={{ width: `${Math.max(8, (row.count / rows[0].count) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function HorizontalChart({ title, rows, tone }: { title: string; rows: BreakdownRow[]; tone: "indigo" | "emerald" | "amber" | "sky" }) {
  const toneClassNames = {
    indigo: "bg-indigo-500",
    emerald: "bg-emerald-600",
    amber: "bg-amber-600",
    sky: "bg-sky-500",
  };

  if (rows.length === 0) {
    return (
      <section className="rounded-[24px] border border-white/70 bg-white/88 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-3 text-sm text-slate-500">No chart data available.</p>
      </section>
    );
  }

  const topRows = rows.slice(0, 5);
  const max = topRows[0]?.count ?? 1;

  return (
    <section className="rounded-[24px] border border-white/70 bg-white/88 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <span className="text-xs text-slate-500">Top {topRows.length}</span>
      </div>
      <div className="mt-5 space-y-4">
        {topRows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium text-slate-700">{row.label}</span>
              <span className="shrink-0 text-slate-500">{row.count}</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100">
              <div
                className={`h-3 rounded-full ${toneClassNames[tone]}`}
                style={{ width: `${Math.max(12, (row.count / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MonthlyTrendChart({ rows }: { rows: BreakdownRow[] }) {
  if (rows.length === 0) {
    return (
      <section className="rounded-[24px] border border-white/70 bg-white/88 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-slate-900">Monthly Delivery Trend</h2>
        <p className="mt-3 text-sm text-slate-500">No monthly trend data available.</p>
      </section>
    );
  }

  const sortedRows = [...rows].sort((a, b) => a.label.localeCompare(b.label));
  const max = Math.max(...sortedRows.map((row) => row.count), 1);
  const width = 640;
  const height = 220;
  const padding = 24;
  const step = sortedRows.length > 1 ? (width - padding * 2) / (sortedRows.length - 1) : 0;
  const points = sortedRows
    .map((row, index) => {
      const x = padding + step * index;
      const y = height - padding - ((row.count / max) * (height - padding * 2));
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <section className="rounded-[24px] border border-white/70 bg-white/88 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Monthly Delivery Trend</h2>
          <p className="mt-1 text-sm text-slate-500">Session volume by delivery month across the imported calendar.</p>
        </div>
        <span className="text-xs text-slate-500">Peak {max}</span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="mt-5 h-56 w-full overflow-visible">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" strokeWidth="1" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#cbd5e1" strokeWidth="1" />
        <polyline
          fill="none"
          stroke="#4f46e5"
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
        />
        {sortedRows.map((row, index) => {
          const x = padding + step * index;
          const y = height - padding - ((row.count / max) * (height - padding * 2));
          return (
            <g key={row.label}>
              <circle cx={x} cy={y} r="5" fill="#4f46e5" />
              <text x={x} y={height - 6} textAnchor="middle" fontSize="11" fill="#475569">
                {formatMonthLabel(row.label)}
              </text>
              <text x={x} y={y - 12} textAnchor="middle" fontSize="11" fill="#312e81">
                {row.count}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}

export function InsightsClient() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importMetadata, setImportMetadata] = useState<ImportMetadata | null>(null);
  const [filters, setFilters] = useState<InsightsFilters>(DEFAULT_FILTERS);

  useEffect(() => {
    (async () => {
      try {
        const loaded = await getSessionRepository().getAll();
        setSessions(loaded);
        setImportMetadata(calendarStorage.loadMetadata());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to load insights data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredSessions = useMemo(
    () =>
      sessions.filter((session) => {
        if (!matchesFilter(session.geo, filters.geo, "Unspecified")) return false;
        if (!matchesFilter(session.capability, filters.capability, "Unspecified")) return false;
        if (!matchesFilter(session.deliveryMode, filters.deliveryMode, "Unknown")) return false;
        if (!matchesFilter(session.facilitator, filters.facilitator, "TBD")) return false;
        return true;
      }),
    [filters, sessions]
  );

  const report = useMemo(() => buildAssistantInsightReport(filteredSessions), [filteredSessions]);
  const geoBreakdown = useMemo(() => countBy(filteredSessions.map((s) => s.geo ?? "Unspecified")), [filteredSessions]);
  const capabilityBreakdown = useMemo(() => countBy(filteredSessions.map((s) => s.capability ?? "Unspecified")), [filteredSessions]);
  const facilitatorBreakdown = useMemo(() => countBy(filteredSessions.map((s) => s.facilitator ?? "TBD")), [filteredSessions]);
  const deliveryBreakdown = useMemo(() => countBy(filteredSessions.map((s) => s.deliveryMode ?? "Unknown")), [filteredSessions]);
  const monthBreakdown = useMemo(
    () => countBy(filteredSessions.map((s) => s.dateISO?.slice(0, 7) ?? "Undated")),
    [filteredSessions]
  );
  const topCapabilities = capabilityBreakdown.slice(0, 5);
  const topGeos = geoBreakdown.slice(0, 5);
  const filterOptions = useMemo(
    () => ({
      geo: uniqueValues(sessions.map((session) => session.geo ?? "Unspecified")),
      capability: uniqueValues(sessions.map((session) => session.capability ?? "Unspecified")),
      deliveryMode: uniqueValues(sessions.map((session) => session.deliveryMode ?? "Unknown")),
      facilitator: uniqueValues(sessions.map((session) => session.facilitator ?? "TBD")),
    }),
    [sessions]
  );
  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((value) => value !== "all").length,
    [filters]
  );
  const deliveryShare = useMemo(() => {
    const total = deliveryBreakdown.reduce((sum, row) => sum + row.count, 0);
    return deliveryBreakdown.map((row) => ({
      ...row,
      share: total > 0 ? Math.round((row.count / total) * 100) : 0,
    }));
  }, [deliveryBreakdown]);

  function updateFilter(key: keyof InsightsFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  function downloadFilteredCsv() {
    if (filteredSessions.length === 0) return;
    const headers = [
      "Program Name",
      "Date",
      "Geo",
      "Capability",
      "Delivery Mode",
      "Facilitator",
      "Target Audience",
      "Location",
      "Registration Link",
    ];

    const lines = [
      headers.join(","),
      ...filteredSessions.map((session) =>
        [
          session.programName,
          session.dateISO ?? session.scheduleRaw ?? "",
          session.geo ?? "Unspecified",
          session.capability ?? "Unspecified",
          session.deliveryMode,
          session.facilitator ?? "TBD",
          session.targetAudience ?? "",
          session.location ?? "",
          session.registrationLink ?? "",
        ]
          .map((value) => escapeCsvValue(value))
          .join(",")
      ),
    ];

    downloadBrowserFile(
      lines.join("\n"),
      `insights-sessions-${formatDateStamp()}.csv`,
      "text/csv;charset=utf-8"
    );
  }

  function downloadInsightsJson() {
    if (filteredSessions.length === 0) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      importedAt: importMetadata?.importedAt ?? null,
      filters,
      totalSessions: sessions.length,
      filteredSessions: filteredSessions.length,
      report,
      breakdowns: {
        geo: geoBreakdown,
        capability: capabilityBreakdown,
        facilitator: facilitatorBreakdown,
        deliveryMode: deliveryBreakdown,
        month: monthBreakdown,
      },
      sessions: filteredSessions,
    };

    downloadBrowserFile(
      JSON.stringify(payload, null, 2),
      `insights-report-${formatDateStamp()}.json`,
      "application/json"
    );
  }

  if (loading) {
    return <div className="py-24 text-center text-slate-500">Loading insights…</div>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
        <p className="font-semibold">Unable to load insights</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/85 py-16 text-center shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm">
        <p className="text-3xl">📊</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Insights</h1>
        <p className="mt-2 text-sm text-slate-500">Import a session workbook first to generate business insights and trend analysis.</p>
        <Link href="/admin/import" className="mt-4 inline-flex rounded-full bg-[linear-gradient(90deg,#3a2aa1,#2876b5)] px-4 py-2 text-sm text-white shadow-[0_12px_24px_rgba(58,42,161,0.18)]">
          Go to Admin Import
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[30px] border border-white/70 bg-[linear-gradient(120deg,rgba(58,42,161,0.96),rgba(40,118,181,0.94)_58%,rgba(78,184,215,0.9))] p-6 text-white shadow-[0_24px_50px_rgba(40,118,181,0.18)] sm:p-8">
        <div className="absolute right-0 top-0 h-36 w-36 translate-x-10 -translate-y-10 rounded-full bg-white/10 blur-3xl" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Business Intelligence</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Insights</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">Business-style analysis of the imported training calendar, including concentration, coverage, and execution risks.</p>
            <p className="mt-3 text-sm text-white/90">
              Showing <span className="font-semibold">{filteredSessions.length}</span> of <span className="font-semibold">{sessions.length}</span> sessions
              {activeFilterCount > 0 ? ` across ${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}.` : "."}
            </p>
          </div>
          <div className="relative rounded-2xl border border-white/35 bg-white/20 px-4 py-3 text-sm text-white shadow-[0_10px_24px_rgba(2,6,23,0.18)] backdrop-blur-sm">
            <p><span className="font-medium text-white">Imported:</span> {importMetadata ? new Date(importMetadata.importedAt).toLocaleString() : "Unknown"}</p>
            <p><span className="font-medium text-white">Files:</span> {importMetadata?.fileNames.join(", ") || "N/A"}</p>
          </div>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {report.metrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-white/30 bg-white/16 p-4 shadow-[0_10px_24px_rgba(2,6,23,0.16)] backdrop-blur-sm">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/70">{metric.label}</p>
              <p className="mt-2 text-xl font-semibold text-white">{metric.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-indigo-100 bg-indigo-50/55 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.07)] backdrop-blur-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Filter the dashboard</h2>
            <p className="mt-1 text-sm text-slate-500">Slice the imported calendar and export the current filtered view.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadFilteredCsv}
              disabled={filteredSessions.length === 0}
              className="rounded-full border border-indigo-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-indigo-50 disabled:opacity-60"
            >
              Download CSV
            </button>
            <button
              type="button"
              onClick={downloadInsightsJson}
              disabled={filteredSessions.length === 0}
              className="rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
            >
              Download Insights JSON
            </button>
            <button
              type="button"
              onClick={resetFilters}
              disabled={activeFilterCount === 0}
              className="rounded-full border border-indigo-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-indigo-50 disabled:opacity-60"
            >
              Reset Filters
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block text-sm text-slate-700">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Geo</span>
            <select
              value={filters.geo}
              onChange={(event) => updateFilter("geo", event.target.value)}
              className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-sm shadow-[0_8px_20px_rgba(15,23,42,0.04)] outline-none focus:border-[#2876b5] focus:ring-2 focus:ring-[#2876b5]/15"
            >
              <option value="all">All geographies</option>
              {filterOptions.geo.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-slate-700">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Capability</span>
            <select
              value={filters.capability}
              onChange={(event) => updateFilter("capability", event.target.value)}
              className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-sm shadow-[0_8px_20px_rgba(15,23,42,0.04)] outline-none focus:border-[#2876b5] focus:ring-2 focus:ring-[#2876b5]/15"
            >
              <option value="all">All capabilities</option>
              {filterOptions.capability.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-slate-700">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Delivery Mode</span>
            <select
              value={filters.deliveryMode}
              onChange={(event) => updateFilter("deliveryMode", event.target.value)}
              className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-sm shadow-[0_8px_20px_rgba(15,23,42,0.04)] outline-none focus:border-[#2876b5] focus:ring-2 focus:ring-[#2876b5]/15"
            >
              <option value="all">All delivery modes</option>
              {filterOptions.deliveryMode.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-slate-700">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Facilitator</span>
            <select
              value={filters.facilitator}
              onChange={(event) => updateFilter("facilitator", event.target.value)}
              className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-sm shadow-[0_8px_20px_rgba(15,23,42,0.04)] outline-none focus:border-[#2876b5] focus:ring-2 focus:ring-[#2876b5]/15"
            >
              <option value="all">All facilitators</option>
              {filterOptions.facilitator.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {filteredSessions.length === 0 ? (
        <section className="rounded-[28px] border border-dashed border-slate-300 bg-white/85 p-10 text-center shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm">
          <p className="text-3xl">🔎</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">No sessions match the current filters</h2>
          <p className="mt-2 text-sm text-slate-500">Try broadening the selected geo, capability, delivery mode, or facilitator filters.</p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 rounded-full bg-[linear-gradient(90deg,#3a2aa1,#2876b5)] px-4 py-2 text-sm font-medium text-white shadow-[0_12px_24px_rgba(58,42,161,0.18)]"
          >
            Reset Filters
          </button>
        </section>
      ) : (
        <>

      <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,1),rgba(255,255,255,0.98))] p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
        <h2 className="text-xl font-semibold text-slate-900">{report.headline}</h2>
        <p className="mt-2 text-sm text-slate-700">{report.summary}</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-800">
          {report.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <MonthlyTrendChart rows={monthBreakdown.filter((row) => row.label !== "Undated")} />
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-slate-900">Delivery Mix</h2>
          <p className="mt-1 text-sm text-slate-500">How the imported calendar is split across delivery types.</p>
          <div className="mt-5 space-y-4">
            {deliveryShare.map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{row.label}</span>
                  <span className="text-slate-500">{row.count} sessions · {row.share}%</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100">
                  <div className="h-3 rounded-full bg-[linear-gradient(90deg,#3a2aa1,#2876b5)]" style={{ width: `${Math.max(8, row.share)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <HorizontalChart title="Top Capabilities" rows={topCapabilities} tone="emerald" />
        <HorizontalChart title="Top Geographies" rows={topGeos} tone="sky" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <BreakdownCard title="Sessions by Geo" rows={geoBreakdown} />
        <BreakdownCard title="Sessions by Capability" rows={capabilityBreakdown} />
        <BreakdownCard title="Sessions by Facilitator" rows={facilitatorBreakdown} />
        <BreakdownCard title="Sessions by Delivery Mode" rows={deliveryBreakdown} />
      </div>

      <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-slate-900">Monthly Delivery Profile</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {monthBreakdown.map((row) => (
            <div key={row.label} className="rounded-2xl border border-slate-300 bg-white p-4 shadow-[0_10px_22px_rgba(15,23,42,0.04)]">
              <p className="text-sm font-medium text-slate-900">{formatMonthLabel(row.label)}</p>
              <p className="mt-1 text-xs text-slate-500">{row.count} sessions</p>
            </div>
          ))}
        </div>
      </section>
        </>
      )}
    </div>
  );
}