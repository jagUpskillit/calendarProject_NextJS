"use client";

import { useState, useEffect, useCallback } from "react";
import type { Session, DeliveryMode, ImportMetadata } from "@/types";
import { SessionCard } from "@/components/sessions/SessionCard";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { AssistantLitePanel } from "@/components/assistant/AssistantLitePanel";
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

  // ── apply filters client-side whenever filter state or data changes ──
  const applyFilters = useCallback(() => {
    let result = [...allSessions];

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
  }, [allSessions, query, geo, audience, facilitator, capability, deliveryMode, sortField]);

  useEffect(() => { applyFilters(); }, [applyFilters]);

  const resetFilters = () => {
    setQuery(""); setGeo(""); setAudience(""); setFacilitator("");
    setCapability(""); setDeliveryMode(""); setSortField("date");
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
    <div className="space-y-6">

      {/* ── Page heading ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Training Sessions</h1>
        <p className="mt-1 text-sm text-gray-500">
          Browse and register for quarterly training programs.
        </p>
        <div className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
          {isImportedData && importMetadata ? (
            <>
              <span className="font-medium text-green-700">Using imported data.</span>{" "}
              Last updated {new Date(importMetadata.importedAt).toLocaleString()} · Files: {importMetadata.fileNames.join(", ") || "N/A"}
            </>
          ) : (
            <span className="font-medium text-amber-700">Using sample data.</span>
          )}
        </div>
      </div>

      {/* ── Search bar ───────────────────────────────────────────────── */}
      <div className="relative">
        <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
          🔍
        </span>
        <input
          type="search"
          placeholder="Search by program name, facilitator, or objectives…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-gray-300 bg-white pl-9 pr-4 py-3 text-sm
            shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          aria-label="Search sessions"
        />
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-4 items-end">
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

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="self-end rounded-md border border-gray-300 px-3 py-2 text-xs
                text-gray-600 hover:bg-gray-50 transition-colors"
            >
              ✕ Clear all
            </button>
          )}
        </div>
      </div>

      {/* ── Results count ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Showing <strong className="text-gray-900">{filtered.length}</strong> of{" "}
          <strong className="text-gray-900">{allSessions.length}</strong> sessions
        </span>
        {hasActiveFilters && (
          <span className="text-blue-600">Filters active</span>
        )}
      </div>

      {/* ── Session grid ─────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <p className="text-3xl">🔍</p>
          <p className="mt-2 font-medium text-gray-700">No sessions match your filters</p>
          <p className="text-sm text-gray-500 mt-1">Try adjusting or clearing the filters above.</p>
          <button
            onClick={resetFilters}
            className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
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
