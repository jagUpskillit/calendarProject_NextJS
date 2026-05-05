"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useMemo } from "react";
import type { Session, DeliveryMode, ImportMetadata, PlanningCycle } from "@/types";
import { SessionCard } from "@/components/sessions/SessionCard";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { AssistantLitePanel } from "@/components/assistant/AssistantLitePanel";
import { PlanningCycleSelector } from "@/components/ui/PlanningCycleSelector";
import { getSessionRepository } from "@/lib/repository";
import { calendarStorage } from "@/lib/storage";

// ── types ──────────────────────────────────────────────────────────────────

interface FacetOptions {
  geo: string[];
  targetAudience: string[];
  facilitator: string[];
  capability: string[];
}

// ── helpers ────────────────────────────────────────────────────────────────

const DELIVERY_OPTIONS: { value: string; label: string }[] = [
  { value: "Virtual",    label: "🌐 Virtual" },
  { value: "In-Person",  label: "🏢 In-Person" },
  { value: "Hybrid",     label: "🔀 Hybrid" },
];

function toOptions(values: string[]) {
  return values.map((v) => ({ value: v, label: v }));
}

// ── component ──────────────────────────────────────────────────────────────

export function HomeClient() {
  // ── data state ──
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [filtered, setFiltered]       = useState<Session[]>([]);
  const [facets, setFacets]           = useState<FacetOptions>({
    geo: [], targetAudience: [], facilitator: [], capability: [],
  });
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [isImportedData, setIsImportedData] = useState(false);
  const [importMetadata, setImportMetadata] = useState<ImportMetadata | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [planningCycles, setPlanningCycles] = useState<PlanningCycle[]>([]);
  const [selectedPlanningCycleId, setSelectedPlanningCycleId] = useState("");

  // ── filter state ──
  const [query, setQuery]               = useState("");
  const [geo, setGeo]                   = useState("");
  const [audience, setAudience]         = useState("");
  const [facilitator, setFacilitator]   = useState("");
  const [capability, setCapability]     = useState("");
  const [deliveryMode, setDeliveryMode] = useState("");
  const [sortField, setSortField]       = useState<"date" | "name">("date");

  // ── load data on mount ──
  useEffect(() => {
    (async () => {
      try {
        const rawAll = await getSessionRepository().getAll();
        // Deduplicate by session.id (guards against stale stored data with duplicate IDs)
        const seenIds = new Set<string>();
        const raw = rawAll.filter((s) => {
          if (seenIds.has(s.id)) return false;
          seenIds.add(s.id);
          return true;
        });
        setAllSessions(raw);
        const cycles = calendarStorage.loadPlanningCycles();
        const activeCycleId = calendarStorage.getActivePlanningCycleId();
        setPlanningCycles(cycles);
        setSelectedPlanningCycleId(activeCycleId);

        const imported = calendarStorage.hasImportedSessions();
        setIsImportedData(imported);
        setImportMetadata(calendarStorage.loadMetadata());

        // Build facet options from raw data
        const unique = (key: keyof Session): string[] =>
          [...new Set(
            raw.map((s) => s[key])
               .filter((v) => typeof v === "string" && !!v) as string[]
          )].sort();

        const audienceValues = [...new Set(
          raw.map((s) => s.targetAudience).filter((v): v is string => typeof v === "string" && !!v)
        )].sort();

        const geoValues = imported
          ? calendarStorage.loadGeoMasters().map((g) => g.geoName).filter(Boolean)
          : unique("geo");

        const facilitatorValues = imported
          ? calendarStorage.loadFacilitatorMasters().map((f) => f.name).filter(Boolean)
          : unique("facilitator");

        setFacets({
          geo:            geoValues.length > 0 ? [...new Set(geoValues)].sort() : unique("geo"),
          targetAudience: audienceValues,
          facilitator:    facilitatorValues.length > 0 ? [...new Set(facilitatorValues)].sort() : unique("facilitator"),
          capability:     unique("capability"),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load sessions");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activePlanningCycles = useMemo(
    () => planningCycles.filter((cycle) => !cycle.isArchived),
    [planningCycles]
  );

  const cycleScopedSessions = useMemo(() => {
    if (!selectedPlanningCycleId) return allSessions;
    return allSessions.filter((session) => session.planningCycleId === selectedPlanningCycleId);
  }, [allSessions, selectedPlanningCycleId]);

  const handlePlanningCycleChange = useCallback((cycleId: string) => {
    setSelectedPlanningCycleId(cycleId);
    calendarStorage.setActivePlanningCycleId(cycleId);
  }, []);

  // ── apply filters client-side whenever filter state or data changes ──
  const applyFilters = useCallback(() => {
    let result = [...cycleScopedSessions];

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (s) =>
          s.programName.toLowerCase().includes(q) ||
          (s.facilitator ?? "").toLowerCase().includes(q) ||
          (s.objectives ?? "").toLowerCase().includes(q)
      );
    }

    if (geo) {
      result = result.filter((s) =>
        (s.geo ?? "")
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
          .includes(geo)
      );
    }
    if (audience)     result = result.filter((s) => s.targetAudience === audience);
    if (facilitator)  result = result.filter((s) => s.facilitator === facilitator);
    if (capability)   result = result.filter((s) => s.capability === capability);
    if (deliveryMode) result = result.filter((s) => s.deliveryMode === (deliveryMode as DeliveryMode));

    // Sort
    result.sort((a, b) => {
      if (sortField === "name") return a.programName.localeCompare(b.programName);
      const da = a.dateISO ?? "9999";
      const db = b.dateISO ?? "9999";
      return da.localeCompare(db);
    });

    setFiltered(result);
  }, [cycleScopedSessions, query, geo, audience, facilitator, capability, deliveryMode, sortField]);

  useEffect(() => { applyFilters(); }, [applyFilters]);

  const resetFilters = () => {
    setQuery(""); setGeo(""); setAudience(""); setFacilitator("");
    setCapability(""); setDeliveryMode(""); setSortField("date");
  };

  const createdSessions = cycleScopedSessions.filter(
    (session) => session.source?.fileName === "create-session-form"
  );

  const exportSessionsToExcel = async (sessions: Session[], filePrefix: string) => {
    if (sessions.length === 0) return;

    try {
      setIsExportingExcel(true);
      setExportError(null);

      const XLSX = await import("xlsx");
      const exportRows = sessions.map((session) => ({
        "Session ID": session.id,
        "Program Name": session.programName,
        "Objectives": session.objectives ?? "",
        "Facilitator": session.facilitator ?? "",
        "Date": session.dateISO ?? "",
        "Schedule": session.scheduleRaw ?? "",
        "Geo": session.geo ?? "",
        "Target Audience": session.targetAudience ?? "",
        "Delivery Mode": session.deliveryMode,
        "Capability": session.capability ?? "",
        "Batch Size": session.batchSize ?? "",
        "Registration Link": session.registrationLink ?? "",
        "Notes": session.notes ?? "",
        "Created Source": session.source?.fileName ?? "",
        "Source Type": session.source?.type ?? "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sessions");

      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `${filePrefix}-${stamp}.xlsx`);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "Failed to export Excel"
      );
    } finally {
      setIsExportingExcel(false);
    }
  };

  const downloadFilteredExcel = async () => {
    await exportSessionsToExcel(filtered, "sessions-filtered");
  };

  const downloadCreatedSessionsExcel = async () => {
    await exportSessionsToExcel(createdSessions, "sessions-created-only");
  };

  const hasActiveFilters = query || geo || audience || facilitator || capability || deliveryMode;

  // ── render ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <svg className="mr-2 h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        Loading sessions…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700">
        <p className="font-semibold">Failed to load sessions</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-28">

      <section className="relative overflow-hidden rounded-[30px] border border-white/70 bg-[linear-gradient(120deg,rgba(58,42,161,0.96),rgba(40,118,181,0.94)_58%,rgba(78,184,215,0.9))] px-6 py-7 text-white shadow-[0_24px_50px_rgba(40,118,181,0.18)] sm:px-8">
        <div className="absolute right-0 top-0 h-36 w-36 translate-x-10 -translate-y-10 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-28 w-28 -translate-x-8 translate-y-8 rounded-full bg-indigo-200/20 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-white/70">Learning Calendar</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Training Sessions</h1>
            <p className="mt-3 max-w-2xl text-sm text-white/85 sm:text-base">
              Browse the quarterly learning portfolio with a cleaner, portal-inspired experience for discovery, filtering, and AI-assisted insights.
            </p>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-3">
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white/90 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.22em] text-white/65">Catalog snapshot</p>
              <p className="mt-1 text-2xl font-semibold">{cycleScopedSessions.length}</p>
              <p className="text-xs text-white/75">sessions in selected cycle</p>
            </div>
            {activePlanningCycles.length > 0 && (
              <PlanningCycleSelector
                cycles={activePlanningCycles}
                value={selectedPlanningCycleId}
                onChange={handlePlanningCycleChange}
                label="Quarter"
              />
            )}
          </div>
        </div>
        <div className="relative mt-5 rounded-2xl border border-white/16 bg-white/10 px-4 py-3 text-xs text-white/90 backdrop-blur-sm">
          {isImportedData && importMetadata ? (
            <>
              <span className="font-semibold text-emerald-200">Using imported data.</span>{" "}
              Last updated {new Date(importMetadata.importedAt).toLocaleString()} · Files: {importMetadata.fileNames.join(", ") || "N/A"}
            </>
          ) : (
            <span className="font-semibold text-amber-200">No imported data found.</span>
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/70 bg-white/78 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-md sm:p-6">
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
            🔎
          </span>
          <input
            type="search"
            placeholder="Search by program name, facilitator, or objectives…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 py-3.5 text-sm text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.05)] outline-none transition-all focus:border-[#2876b5] focus:ring-2 focus:ring-[#2876b5]/15"
            aria-label="Search sessions"
          />
        </div>

        <div className="mt-5 rounded-2xl border border-slate-100 bg-[linear-gradient(180deg,#ffffff,rgba(244,247,252,0.9))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Refine your results</h2>
              <p className="text-xs text-slate-500">Filter by region, audience, facilitator, capability, or delivery format.</p>
            </div>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                ✕ Clear all
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-4">
          <FilterSelect
            label="Geo / Region"
            options={toOptions(facets.geo)}
            value={geo}
            onChange={(e) => setGeo(e.target.value)}
          />
          <FilterSelect
            label="Target Audience"
            options={toOptions(facets.targetAudience)}
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          />
          <FilterSelect
            label="Facilitator"
            options={toOptions(facets.facilitator)}
            value={facilitator}
            onChange={(e) => setFacilitator(e.target.value)}
          />
          <FilterSelect
            label="Capability"
            options={toOptions(facets.capability)}
            value={capability}
            onChange={(e) => setCapability(e.target.value)}
          />
          <FilterSelect
            label="Delivery Mode"
            options={DELIVERY_OPTIONS}
            value={deliveryMode}
            onChange={(e) => setDeliveryMode(e.target.value)}
          />
          <FilterSelect
            label="Sort By"
            options={[
              { value: "date", label: "Date (Ascending)" },
              { value: "name", label: "Name (A–Z)" },
            ]}
            value={sortField}
            onChange={(e) => setSortField(e.target.value as "date" | "name")}
          />
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm text-slate-500 shadow-[0_10px_26px_rgba(15,23,42,0.05)] backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span>
            Showing <strong className="text-slate-900">{filtered.length}</strong> of{" "}
            <strong className="text-slate-900">{cycleScopedSessions.length}</strong> sessions
          </span>
          {hasActiveFilters && (
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">Filters active</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadCreatedSessionsExcel}
            disabled={createdSessions.length === 0 || isExportingExcel}
            className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            title="Exports only sessions created from the Create Sessions form"
          >
            {isExportingExcel ? "Exporting..." : `⬇ Download Created Only (${createdSessions.length})`}
          </button>
          <button
            onClick={downloadFilteredExcel}
            disabled={filtered.length === 0 || isExportingExcel}
            className="rounded-full bg-[linear-gradient(90deg,#3a2aa1,#2876b5)] px-4 py-2 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(40,118,181,0.2)] transition hover:shadow-[0_12px_26px_rgba(40,118,181,0.26)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExportingExcel ? "Exporting..." : "⬇ Download Filtered Excel"}
          </button>
        </div>
      </div>

      {exportError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to export Excel: {exportError}
        </div>
      )}

      {/* ── Session grid ─────────────────────────────────────────────── */}
      {filtered.length === 0 && allSessions.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/85 py-16 text-center shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm">
          <p className="text-3xl">📥</p>
          <p className="mt-2 font-medium text-slate-700">No imported sessions yet</p>
          <p className="mt-1 text-sm text-slate-500">Clear storage now leaves the catalog empty until you upload fresh data.</p>
          <Link
            href="/admin/import"
            className="mt-4 inline-flex rounded-full bg-[linear-gradient(90deg,#3a2aa1,#2876b5)] px-4 py-2 text-sm text-white shadow-[0_12px_24px_rgba(58,42,161,0.18)]"
          >
            Go to Admin Import
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/85 py-16 text-center shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm">
          <p className="text-3xl">🔍</p>
          <p className="mt-2 font-medium text-slate-700">No sessions match your filters</p>
          <p className="mt-1 text-sm text-slate-500">Try adjusting or clearing the filters above.</p>
          <button
            onClick={resetFilters}
            className="mt-4 rounded-full bg-[linear-gradient(90deg,#3a2aa1,#2876b5)] px-4 py-2 text-sm text-white shadow-[0_12px_24px_rgba(58,42,161,0.18)]"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}

      <AssistantLitePanel sessions={allSessions} />
    </div>
  );
}
