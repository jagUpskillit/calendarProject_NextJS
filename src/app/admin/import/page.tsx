"use client";

import { useMemo, useState } from "react";
import type { CalendarDataBundle, HolidayMaster, PlanningCycle } from "@/types";
import { calendarStorage } from "@/lib/storage";
import { parseBeCogCsvFile } from "@/lib/import/parseBeCogCsv";
import { parseBeCogXlsxFile } from "@/lib/import/parseBeCogXlsx";
import { parsePlanningXlsxFile } from "@/lib/import/parsePlanningXlsx";
import { normalizeBeCogRows } from "@/lib/normalize";
import { PlanningCycleSelector } from "@/components/ui/PlanningCycleSelector";

type ImportCycleMode = "selected" | "auto";
type ImportCycleMergeMode = "replace" | "append";

export default function AdminImportPage() {
  const [beCogCsvFile, setBeCogCsvFile] = useState<File | null>(null);
  const [beCogXlsxFile, setBeCogXlsxFile] = useState<File | null>(null);
  const [planningXlsxFile, setPlanningXlsxFile] = useState<File | null>(null);

  const [processing, setProcessing] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [bundle, setBundle] = useState<CalendarDataBundle | null>(null);
  const [clearMessage, setClearMessage] = useState<string>("");
  const [planningCycles] = useState<PlanningCycle[]>(() => calendarStorage.loadPlanningCycles());
  const [selectedPlanningCycleId, setSelectedPlanningCycleId] = useState<string>(() =>
    calendarStorage.getActivePlanningCycleId()
  );
  const [importCycleMode, setImportCycleMode] = useState<ImportCycleMode>("selected");
  const [importCycleMergeMode, setImportCycleMergeMode] = useState<ImportCycleMergeMode>("replace");

  const summary = useMemo(() => bundle?.metadata ?? null, [bundle]);
  const activePlanningCycles = useMemo(
    () => planningCycles.filter((cycle) => !cycle.isArchived),
    [planningCycles]
  );

  function detectPlanningCycleIdByDate(dateISO: string | undefined, cycles: PlanningCycle[]): string | null {
    if (!dateISO) return null;
    const date = dateISO.slice(0, 10);
    if (!date || date.length !== 10) return null;

    const matchingCycle = cycles.find((cycle) => {
      const start = cycle.startDate?.slice(0, 10);
      const end = cycle.endDate?.slice(0, 10);
      if (!start || !end) return false;
      return date >= start && date <= end;
    });

    return matchingCycle?.id ?? null;
  }

  async function processImport() {
    setProcessing(true);
    setWarnings([]);

    const parserWarnings: string[] = [];
    let rawRows: Awaited<ReturnType<typeof parseBeCogCsvFile>>["rawRows"] = [];
    let holidays: HolidayMaster[] = [];

    try {
      if (beCogCsvFile) {
        const csv = await parseBeCogCsvFile(beCogCsvFile);
        rawRows = rawRows.concat(csv.rawRows);
        parserWarnings.push(...csv.warnings);
      }

      if (beCogXlsxFile) {
        const xlsx = await parseBeCogXlsxFile(beCogXlsxFile);
        rawRows = rawRows.concat(xlsx.rawRows);
        parserWarnings.push(...xlsx.warnings);
      }

      if (planningXlsxFile) {
        const planning = await parsePlanningXlsxFile(planningXlsxFile);
        holidays = planning.holidays;
        parserWarnings.push(...planning.warnings);
      }

      if (!beCogCsvFile && !beCogXlsxFile) {
        parserWarnings.push("No Be.Cognizant CSV/XLSX provided; zero sessions will be imported.");
      }

      const normalized = normalizeBeCogRows(rawRows, { holidays });
      const fileNames = [beCogCsvFile?.name, beCogXlsxFile?.name, planningXlsxFile?.name].filter(Boolean) as string[];

      const fallbackCycleId = selectedPlanningCycleId || calendarStorage.getActivePlanningCycleId();
      const selectableCycles = activePlanningCycles.length > 0 ? activePlanningCycles : planningCycles;

      const mappedSessions = normalized.sessions.map((session) => {
        const autoDetected = detectPlanningCycleIdByDate(session.dateISO, selectableCycles);
        const planningCycleId =
          importCycleMode === "auto"
            ? autoDetected ?? fallbackCycleId
            : fallbackCycleId;

        return {
          ...session,
          id: `${session.id}__${planningCycleId}`,
          planningCycleId,
        };
      });

      const cycleIdsByProgram = new Map<string, Set<string>>();
      for (const session of mappedSessions) {
        const programKey = session.programName.trim().toLowerCase();
        if (!programKey) continue;
        const set = cycleIdsByProgram.get(programKey) ?? new Set<string>();
        set.add(session.planningCycleId ?? fallbackCycleId);
        cycleIdsByProgram.set(programKey, set);
      }

      const mappedProgramMasters = normalized.masters.programs.map((program) => {
        const key = program.programName.trim().toLowerCase();
        const cycleIds = Array.from(cycleIdsByProgram.get(key) ?? new Set<string>([fallbackCycleId]));
        return {
          ...program,
          planningCycleIds: cycleIds,
        };
      });

      const existingSessions = calendarStorage.loadSessions();
      const importedCycleIds = new Set(
        mappedSessions
          .map((session) => session.planningCycleId)
          .filter((value): value is string => Boolean(value))
      );

      const mergedSessions =
        importCycleMergeMode === "replace"
          ? [
              ...existingSessions.filter(
                (session) => !importedCycleIds.has(session.planningCycleId ?? fallbackCycleId)
              ),
              ...mappedSessions,
            ]
          : (() => {
              const sessionMap = new Map<string, (typeof existingSessions)[number]>();
              for (const session of existingSessions) {
                sessionMap.set(session.id, session);
              }
              for (const session of mappedSessions) {
                sessionMap.set(session.id, session);
              }
              return Array.from(sessionMap.values());
            })();

      const existingPrograms = calendarStorage.loadProgramMasters();
      const programMap = new Map<string, (typeof existingPrograms)[number]>();
      for (const program of existingPrograms) {
        programMap.set(program.programName.trim().toLowerCase(), {
          ...program,
          planningCycleIds: Array.from(new Set((program.planningCycleIds ?? []).filter(Boolean))),
        });
      }
      for (const program of mappedProgramMasters) {
        const key = program.programName.trim().toLowerCase();
        const existing = programMap.get(key);
        if (!existing) {
          programMap.set(key, {
            ...program,
            planningCycleIds: Array.from(new Set((program.planningCycleIds ?? [fallbackCycleId]).filter(Boolean))),
          });
          continue;
        }

        const mergedCycleIds = Array.from(
          new Set([...(existing.planningCycleIds ?? []), ...(program.planningCycleIds ?? [])].filter(Boolean))
        );

        programMap.set(key, {
          ...existing,
          ...program,
          capabilityName: program.capabilityName ?? existing.capabilityName,
          objectives: program.objectives ?? existing.objectives,
          formatDuration: program.formatDuration ?? existing.formatDuration,
          defaultFacilitator: program.defaultFacilitator ?? existing.defaultFacilitator,
          planningCycleIds: mergedCycleIds.length > 0 ? mergedCycleIds : [fallbackCycleId],
        });
      }
      const mergedProgramMasters = Array.from(programMap.values()).sort((a, b) =>
        a.programName.localeCompare(b.programName)
      );

      const existingFacilitators = calendarStorage.loadFacilitatorMasters();
      const mergedFacilitatorMasters = Array.from(
        new Map(
          [...existingFacilitators, ...normalized.masters.facilitators]
            .map((item) => item.name.trim())
            .filter(Boolean)
            .map((name) => [name.toLowerCase(), { name }])
        ).values()
      ).sort((a, b) => a.name.localeCompare(b.name));

      const existingGeos = calendarStorage.loadGeoMasters();
      const mergedGeoMasters = Array.from(
        new Map(
          [...existingGeos, ...normalized.masters.geos]
            .map((item) => item.geoName.trim())
            .filter(Boolean)
            .map((geoName) => [geoName.toLowerCase(), { geoName }])
        ).values()
      ).sort((a, b) => a.geoName.localeCompare(b.geoName));

      const existingHolidays = calendarStorage.loadHolidayMasters();
      const mergedHolidayMasters = Array.from(
        new Map(
          [...existingHolidays, ...holidays]
            .map((item) => ({
              dateISO: item.dateISO.trim(),
              holidayName: item.holidayName.trim(),
              geoName: item.geoName.trim(),
            }))
            .filter((item) => item.dateISO && item.holidayName && item.geoName)
            .map((item) => [
              `${item.dateISO}__${item.geoName.toLowerCase()}__${item.holidayName.toLowerCase()}`,
              item,
            ])
        ).values()
      ).sort((a, b) => {
        if (a.dateISO !== b.dateISO) return a.dateISO.localeCompare(b.dateISO);
        if (a.geoName !== b.geoName) return a.geoName.localeCompare(b.geoName);
        return a.holidayName.localeCompare(b.holidayName);
      });

      const metadata = {
        ...normalized.metadata,
        fileNames,
        sessionCount: mergedSessions.length,
        programCount: mergedProgramMasters.length,
        facilitatorCount: mergedFacilitatorMasters.length,
        geoCount: mergedGeoMasters.length,
        holidayCount: mergedHolidayMasters.length,
        warnings: [
          ...normalized.warnings,
          ...parserWarnings,
          importedCycleIds.size > 0
            ? `Imported cycles updated (${importCycleMergeMode}): ${Array.from(importedCycleIds).join(", ")}. Other cycle sessions were preserved.`
            : "Imported sessions fell back to selected cycle assignment.",
        ],
      };

      const nextBundle: CalendarDataBundle = {
        sessions: mergedSessions,
        programMasters: mergedProgramMasters,
        facilitatorMasters: mergedFacilitatorMasters,
        geoMasters: mergedGeoMasters,
        holidayMasters: mergedHolidayMasters,
        metadata,
      };

      calendarStorage.saveBundle(nextBundle);

      // Merge newly discovered capabilities with any already in the master
      const existingCaps = calendarStorage.loadCapabilityMasters ? calendarStorage.loadCapabilityMasters() : [];
      const capKeySet = new Set(existingCaps.map((c) => c.capabilityName.trim().toLowerCase()));
      const mergedCaps = [...existingCaps];
      for (const cap of normalized.masters.capabilities) {
        if (cap.capabilityName && !capKeySet.has(cap.capabilityName.trim().toLowerCase())) {
          mergedCaps.push(cap);
          capKeySet.add(cap.capabilityName.trim().toLowerCase());
        }
      }
      if (calendarStorage.saveCapabilityMasters) {
        calendarStorage.saveCapabilityMasters(mergedCaps.sort((a, b) => a.capabilityName.localeCompare(b.capabilityName)));
      }

      setBundle(nextBundle);
      setWarnings(metadata.warnings);
    } catch (err) {
      setWarnings([`Import failed: ${err instanceof Error ? err.message : String(err)}`]);
      setBundle(null);
    } finally {
      setProcessing(false);
    }
  }

  function downloadExportJson() {
    if (!bundle) return;
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `calendar-import-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const FULL_RESET_KEYS = [
    "calendarproject_v1:supportTickets",
    "calendarproject_v1:lastFilters",
    "calendarproject_v1:assistantHistory",
  ];

  function clearImportedData() {
    calendarStorage.clearAll();
    setBundle(null);
    setWarnings([]);
    setClearMessage("✅ Imported calendar data cleared. No sessions will be shown until you import again.");
    setTimeout(() => setClearMessage(""), 5000);
  }

  function fullReset() {
    calendarStorage.clearAll();
    if (typeof window !== "undefined") {
      for (const k of FULL_RESET_KEYS) window.localStorage.removeItem(k);
    }
    setBundle(null);
    setWarnings([]);
    setClearMessage("🔄 Full dev reset complete. All app state cleared.");
    setTimeout(() => setClearMessage(""), 5000);
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-bold text-gray-900">Admin Import</h1>
            <p className="mt-1 text-sm text-gray-600">
              Upload Be.Cognizant CSV/XLSX and optional Planning workbook to refresh local imported data.
            </p>
          </div>
          {activePlanningCycles.length > 0 && (
            <div className="w-full max-w-xs">
              <PlanningCycleSelector
                cycles={activePlanningCycles}
                value={selectedPlanningCycleId}
                onChange={setSelectedPlanningCycleId}
                label="Quarter"
              />
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        {activePlanningCycles.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-600">
                Quarter Assignment Mode
              </label>
              <select
                value={importCycleMode}
                onChange={(event) => setImportCycleMode(event.target.value as ImportCycleMode)}
                className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-700"
              >
                <option value="selected">Use selected quarter for all imported sessions</option>
                <option value="auto">Auto-detect by session date (fallback to selected quarter)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-600">
                Import Safeguard (Target Cycles)
              </label>
              <select
                value={importCycleMergeMode}
                onChange={(event) => setImportCycleMergeMode(event.target.value as ImportCycleMergeMode)}
                className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-700"
              >
                <option value="replace">Replace sessions in imported cycle(s) (recommended)</option>
                <option value="append">Append to imported cycle(s) (upsert by session ID)</option>
              </select>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Be.Cognizant CSV (.csv)</label>
            <input type="file" accept=".csv,text/csv" onChange={(e) => setBeCogCsvFile(e.target.files?.[0] ?? null)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Be.Cognizant Excel (.xlsx)</label>
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => setBeCogXlsxFile(e.target.files?.[0] ?? null)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-sm font-medium text-gray-700">Planning workbook (optional .xlsx for holidays)</label>
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => setPlanningXlsxFile(e.target.files?.[0] ?? null)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={processImport} disabled={processing} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            {processing ? "Processing..." : "Process Import"}
          </button>
          <button onClick={downloadExportJson} disabled={!bundle} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
            Download Export JSON
          </button>
          <button onClick={clearImportedData} className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
            Clear Imported Data
          </button>
          <button onClick={fullReset} className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800">
            Full Reset (Dev)
          </button>
        </div>
        {clearMessage && (
          <p className="mt-2 text-sm font-semibold text-emerald-700">{clearMessage}</p>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Import Summary</h2>
        {!summary ? (
          <p className="mt-2 text-sm text-gray-500">No import processed in this session yet.</p>
        ) : (
          <div className="mt-3 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
            <p><strong>Imported At:</strong> {new Date(summary.importedAt).toLocaleString()}</p>
            <p><strong>Files:</strong> {summary.fileNames.join(", ") || "None"}</p>
            <p><strong>Sessions:</strong> {summary.sessionCount}</p>
            <p><strong>Programs:</strong> {summary.programCount}</p>
            <p><strong>Facilitators:</strong> {summary.facilitatorCount}</p>
            <p><strong>Geos:</strong> {summary.geoCount}</p>
            <p><strong>Holidays:</strong> {summary.holidayCount}</p>
          </div>
        )}

        <div className="mt-4">
          <h3 className="font-medium text-gray-900">Warnings</h3>
          {warnings.length === 0 ? (
            <p className="mt-1 text-sm text-gray-500">No warnings.</p>
          ) : (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-700">
              {warnings.map((w, i) => (
                <li key={`${i}-${w.slice(0, 24)}`}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
