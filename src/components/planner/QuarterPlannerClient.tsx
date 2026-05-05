"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlanningCycle, Session } from "@/types";
import { calendarStorage } from "@/lib/storage";
import {
  quarterPlannerStorage,
  type QuarterPlanRow,
} from "@/lib/storage/QuarterPlannerStorage";
import { PlanningCycleSelector } from "@/components/ui/PlanningCycleSelector";

interface ProgramStats {
  programName: string;
  capability: string;
  targetAudience: string;
  deliveryMode: string;
  facilitator: string;
  count: number;
}

type PlannerPublishMode = "replace" | "append";

const DEFAULT_ROW: Omit<QuarterPlanRow, "id" | "planningCycleId"> = {
  dateISO: "",
  programName: "",
  capability: "",
  targetAudience: "",
  deliveryMode: "",
  facilitator: "",
  notes: "",
  source: "manual",
};

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toDateValue(value: string): string {
  return value.slice(0, 10);
}

function toDeliveryMode(value: string): Session["deliveryMode"] {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("hybrid")) return "Hybrid";
  if (normalized.includes("virtual") || normalized.includes("online") || normalized.includes("remote")) return "Virtual";
  if (normalized.includes("person") || normalized.includes("classroom") || normalized.includes("onsite") || normalized.includes("on-site")) return "In-Person";
  return "Unknown";
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function buildPlannerSessionId(row: QuarterPlanRow, index: number): string {
  const datePart = toDateValue(row.dateISO || "").replace(/-/g, "") || `idx${index + 1}`;
  const programPart = slugify(row.programName || "program") || "program";
  return `planner-${programPart}-${datePart}__${row.planningCycleId}`;
}

function csvEscape(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function nextDateInCycle(startDate: string, index: number): string {
  const base = new Date(`${startDate}T00:00:00`);
  base.setDate(base.getDate() + index * 7);
  return base.toISOString().slice(0, 10);
}

function getPreviousCycle(targetCycleId: string, cycles: PlanningCycle[]): PlanningCycle | null {
  const ordered = [...cycles]
    .filter((cycle) => !cycle.isArchived)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const targetIndex = ordered.findIndex((cycle) => cycle.id === targetCycleId);
  if (targetIndex <= 0) return null;
  return ordered[targetIndex - 1] ?? null;
}

function buildTopPrograms(sessions: Session[]): ProgramStats[] {
  const map = new Map<string, ProgramStats>();

  for (const session of sessions) {
    const key = session.programName.trim().toLowerCase();
    if (!key) continue;

    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }

    map.set(key, {
      programName: session.programName,
      capability: session.capability ?? "",
      targetAudience: session.targetAudience ?? "",
      deliveryMode: session.deliveryMode ?? "",
      facilitator: session.facilitator ?? "",
      count: 1,
    });
  }

  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.programName.localeCompare(b.programName))
    .slice(0, 10);
}

export function QuarterPlannerClient() {
  const [status, setStatus] = useState<string>("");
  const [publishMode, setPublishMode] = useState<PlannerPublishMode>("replace");
  const [isHydrated, setIsHydrated] = useState(false);
  const [planningCycles, setPlanningCycles] = useState<PlanningCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>("");

  const selectedCycle = useMemo(
    () => planningCycles.find((cycle) => cycle.id === selectedCycleId) ?? null,
    [planningCycles, selectedCycleId]
  );

  const [rows, setRows] = useState<QuarterPlanRow[]>([]);

  useEffect(() => {
    const loadedCycles = calendarStorage
      .loadPlanningCycles()
      .filter((cycle) => !cycle.isArchived);
    const activeCycleId = calendarStorage.getActivePlanningCycleId();
    const usableCycleId =
      loadedCycles.find((cycle) => cycle.id === activeCycleId)?.id ??
      loadedCycles[0]?.id ??
      activeCycleId;

    setPlanningCycles(loadedCycles);
    setSelectedCycleId(usableCycleId);
    setRows(quarterPlannerStorage.loadCycle(usableCycleId)?.rows ?? []);
    setIsHydrated(true);
  }, []);

  function switchCycle(cycleId: string) {
    const nextRows = quarterPlannerStorage.loadCycle(cycleId)?.rows ?? [];
    setSelectedCycleId(cycleId);
    setRows(nextRows);
    calendarStorage.setActivePlanningCycleId(cycleId);
    setStatus("");
  }

  function generateSuggestions() {
    if (!selectedCycle) return;

    const previousCycle = getPreviousCycle(selectedCycle.id, planningCycles);
    if (!previousCycle) {
      setStatus("No previous cycle found. Add rows manually for this cycle.");
      return;
    }

    const allSessions = calendarStorage.loadSessions();
    const previousSessions = allSessions.filter(
      (session) => session.planningCycleId === previousCycle.id
    );

    if (previousSessions.length === 0) {
      setStatus(`No sessions found in ${previousCycle.label}. Add rows manually.`);
      return;
    }

    const topPrograms = buildTopPrograms(previousSessions);
    const suggestedRows: QuarterPlanRow[] = topPrograms.map((program, index) => ({
      id: uniqueId("suggested"),
      planningCycleId: selectedCycle.id,
      dateISO: nextDateInCycle(selectedCycle.startDate, index),
      programName: program.programName,
      capability: program.capability,
      targetAudience: program.targetAudience,
      deliveryMode: program.deliveryMode,
      facilitator: program.facilitator,
      notes: `Suggested from ${previousCycle.label} (delivered ${program.count} time(s)).`,
      source: "suggested",
    }));

    setRows(suggestedRows);
    setStatus(`Generated ${suggestedRows.length} suggestions from ${previousCycle.label}.`);
  }

  function addManualRow() {
    if (!selectedCycle) return;
    setRows((current) => [
      ...current,
      {
        ...DEFAULT_ROW,
        id: uniqueId("manual"),
        planningCycleId: selectedCycle.id,
      },
    ]);
  }

  function updateRow(id: string, key: keyof QuarterPlanRow, value: string) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [key]: value } : row))
    );
  }

  function deleteRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function savePlan() {
    if (!selectedCycle) return;
    const normalized = rows.map((row) => ({
      ...row,
      planningCycleId: selectedCycle.id,
      dateISO: toDateValue(row.dateISO),
      programName: row.programName.trim(),
      capability: row.capability.trim(),
      targetAudience: row.targetAudience.trim(),
      deliveryMode: row.deliveryMode.trim(),
      facilitator: row.facilitator.trim(),
      notes: row.notes.trim(),
    }));

    quarterPlannerStorage.saveCycle(selectedCycle.id, normalized);
    setRows(normalized);
    setStatus(`Plan saved for ${selectedCycle.label}.`);
  }

  function normalizeRowsForCycle(currentCycleId: string): QuarterPlanRow[] {
    return rows
      .map((row) => ({
        ...row,
        planningCycleId: currentCycleId,
        dateISO: toDateValue(row.dateISO),
        programName: row.programName.trim(),
        capability: row.capability.trim(),
        targetAudience: row.targetAudience.trim(),
        deliveryMode: row.deliveryMode.trim(),
        facilitator: row.facilitator.trim(),
        notes: row.notes.trim(),
      }))
      .filter((row) => row.programName.length > 0);
  }

  function buildSessionsFromRows(normalizedRows: QuarterPlanRow[]): Session[] {
    return normalizedRows.map((row, index) => ({
      id: buildPlannerSessionId(row, index),
      programName: row.programName,
      capability: row.capability || undefined,
      targetAudience: row.targetAudience || undefined,
      facilitator: row.facilitator || undefined,
      notes: row.notes || undefined,
      dateISO: row.dateISO || undefined,
      scheduleRaw: row.dateISO || undefined,
      formatDuration: undefined,
      objectives: undefined,
      geo: undefined,
      location: undefined,
      batchSize: undefined,
      registrationLink: undefined,
      tags: undefined,
      rating: undefined,
      recordingLink: undefined,
      source: {
        type: "planning",
        fileName: "quarter-planner-direct-publish",
        sheetName: "Manager Planner",
      },
      planningCycleId: row.planningCycleId,
      deliveryMode: toDeliveryMode(row.deliveryMode),
    }));
  }

  function publishToCalendar() {
    if (!selectedCycle) return;

    const normalizedRows = normalizeRowsForCycle(selectedCycle.id);
    if (normalizedRows.length === 0) {
      setStatus("No valid rows to publish. Add at least one row with a program name.");
      return;
    }

    quarterPlannerStorage.saveCycle(selectedCycle.id, normalizedRows);
    setRows(normalizedRows);

    const plannerSessions = buildSessionsFromRows(normalizedRows);
    const existingSessions = calendarStorage.loadSessions();

    const mergedSessions =
      publishMode === "replace"
        ? [
            ...existingSessions.filter(
              (session) => (session.planningCycleId ?? selectedCycle.id) !== selectedCycle.id
            ),
            ...plannerSessions,
          ]
        : (() => {
            const sessionMap = new Map<string, Session>();
            for (const session of existingSessions) {
              sessionMap.set(session.id, session);
            }
            for (const session of plannerSessions) {
              sessionMap.set(session.id, session);
            }
            return Array.from(sessionMap.values());
          })();

    calendarStorage.saveSessions(mergedSessions);

    const existingPrograms = calendarStorage.loadProgramMasters();
    const programMap = new Map<string, (typeof existingPrograms)[number]>();
    for (const program of existingPrograms) {
      programMap.set(program.programName.trim().toLowerCase(), {
        ...program,
        planningCycleIds: Array.from(new Set((program.planningCycleIds ?? []).filter(Boolean))),
      });
    }

    for (const row of normalizedRows) {
      const key = row.programName.toLowerCase();
      const existing = programMap.get(key);
      if (!existing) {
        programMap.set(key, {
          programName: row.programName,
          capabilityName: row.capability || undefined,
          defaultFacilitator: row.facilitator || undefined,
          planningCycleIds: [selectedCycle.id],
        });
        continue;
      }

      const mergedCycleIds = Array.from(
        new Set([...(existing.planningCycleIds ?? []), selectedCycle.id].filter(Boolean))
      );

      programMap.set(key, {
        ...existing,
        capabilityName: row.capability || existing.capabilityName,
        defaultFacilitator: row.facilitator || existing.defaultFacilitator,
        planningCycleIds: mergedCycleIds,
      });
    }

    calendarStorage.saveProgramMasters(
      Array.from(programMap.values()).sort((a, b) => a.programName.localeCompare(b.programName))
    );

    const existingFacilitators = calendarStorage.loadFacilitatorMasters();
    const facilitatorMap = new Map<string, { name: string }>();
    for (const item of existingFacilitators) {
      const name = item.name.trim();
      if (!name) continue;
      facilitatorMap.set(name.toLowerCase(), { name });
    }
    for (const row of normalizedRows) {
      const name = row.facilitator.trim();
      if (!name) continue;
      facilitatorMap.set(name.toLowerCase(), { name });
    }
    calendarStorage.saveFacilitatorMasters(
      Array.from(facilitatorMap.values()).sort((a, b) => a.name.localeCompare(b.name))
    );

    const existingCapabilities = calendarStorage.loadCapabilityMasters();
    const capabilityMap = new Map<string, { capabilityName: string }>();
    for (const item of existingCapabilities) {
      const capabilityName = item.capabilityName.trim();
      if (!capabilityName) continue;
      capabilityMap.set(capabilityName.toLowerCase(), { capabilityName });
    }
    for (const row of normalizedRows) {
      const capabilityName = row.capability.trim();
      if (!capabilityName) continue;
      capabilityMap.set(capabilityName.toLowerCase(), { capabilityName });
    }
    calendarStorage.saveCapabilityMasters(
      Array.from(capabilityMap.values()).sort((a, b) => a.capabilityName.localeCompare(b.capabilityName))
    );

    setStatus(
      `Published ${plannerSessions.length} planner row(s) to calendar (${publishMode}) for ${selectedCycle.label}.`
    );
  }

  function exportPlannerCsv() {
    if (!selectedCycle) return;
    const normalizedRows = normalizeRowsForCycle(selectedCycle.id);
    if (normalizedRows.length === 0) {
      setStatus("No valid rows to export. Add planner rows first.");
      return;
    }

    const headers = [
      "planningCycleId",
      "dateISO",
      "programName",
      "capability",
      "targetAudience",
      "deliveryMode",
      "facilitator",
      "notes",
      "source",
    ];

    const lines = [
      headers.join(","),
      ...normalizedRows.map((row) =>
        [
          row.planningCycleId,
          row.dateISO,
          row.programName,
          row.capability,
          row.targetAudience,
          row.deliveryMode,
          row.facilitator,
          row.notes,
          row.source,
        ]
          .map((item) => csvEscape(String(item ?? "")))
          .join(",")
      ),
    ];

    const blob = new Blob([`\uFEFF${lines.join("\n")}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `quarter-planner-${selectedCycle.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);

    setStatus(`Exported ${normalizedRows.length} row(s) to Excel-ready CSV for ${selectedCycle.label}.`);
  }

  function clearPlan() {
    if (!selectedCycle) return;
    quarterPlannerStorage.clearCycle(selectedCycle.id);
    setRows([]);
    setStatus(`Cleared draft plan for ${selectedCycle.label}.`);
  }

  if (planningCycles.length === 0) {
    if (!isHydrated) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">
          Loading planner workspace...
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        <p className="font-semibold">No planning cycles found.</p>
        <p className="mt-1 text-sm">Please create cycles in `Masters` before using the quarter planner.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-semibold text-slate-900">Quarter Planner (Manager Workspace)</h1>
            <p className="mt-2 text-sm text-slate-600">
              Generate a suggested next-quarter plan from previous cycle delivery, then edit/add/delete rows and save draft.
            </p>
          </div>
          <div className="w-full max-w-xs">
            <PlanningCycleSelector
              cycles={planningCycles}
              value={selectedCycleId}
              onChange={switchCycle}
              label="Quarter"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="flex min-w-[300px] flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
              Publish Safeguard
            </label>
            <select
              value={publishMode}
              onChange={(event) => setPublishMode(event.target.value as PlannerPublishMode)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              <option value="replace">Replace sessions in this target cycle</option>
              <option value="append">Append to cycle (upsert by planner session ID)</option>
            </select>
          </div>
            <button
              onClick={generateSuggestions}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Generate Suggestions
            </button>
            <button
              onClick={addManualRow}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Add Row
            </button>
            <button
              onClick={savePlan}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Save Draft
            </button>
            <button
              onClick={publishToCalendar}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Import to Calendar
            </button>
            <button
              onClick={exportPlannerCsv}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Export Excel (CSV)
            </button>
            <button
              onClick={clearPlan}
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Clear Draft
            </button>
        </div>

        {status && (
          <div className="mt-4 rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
            {status}
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 text-sm text-slate-600">
          Planned rows for <span className="font-semibold text-slate-900">{selectedCycle?.label ?? selectedCycleId}</span>: {rows.length}
        </div>

        <div className="max-h-[70vh] overflow-auto rounded-md border border-slate-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-700">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Program</th>
                <th className="px-3 py-2">Capability</th>
                <th className="px-3 py-2">Audience</th>
                <th className="px-3 py-2">Mode</th>
                <th className="px-3 py-2">Facilitator</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="px-2 py-2">
                    <input
                      type="date"
                      value={toDateValue(row.dateISO)}
                      onChange={(event) => updateRow(row.id, "dateISO", event.target.value)}
                      className="w-[140px] rounded border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={row.programName}
                      onChange={(event) => updateRow(row.id, "programName", event.target.value)}
                      className="min-w-[220px] rounded border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={row.capability}
                      onChange={(event) => updateRow(row.id, "capability", event.target.value)}
                      className="min-w-[180px] rounded border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={row.targetAudience}
                      onChange={(event) => updateRow(row.id, "targetAudience", event.target.value)}
                      className="min-w-[140px] rounded border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={row.deliveryMode}
                      onChange={(event) => updateRow(row.id, "deliveryMode", event.target.value)}
                      className="min-w-[120px] rounded border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={row.facilitator}
                      onChange={(event) => updateRow(row.id, "facilitator", event.target.value)}
                      className="min-w-[160px] rounded border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(event) => updateRow(row.id, "notes", event.target.value)}
                      className="min-w-[260px] rounded border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-600">{row.source}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => deleteRow(row.id)}
                      className="rounded border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-sm text-slate-500">
                    No rows yet. Generate suggestions or add manual rows.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
