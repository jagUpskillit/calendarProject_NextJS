"use client";

import { useMemo, useState } from "react";
import type { CalendarDataBundle, HolidayMaster } from "@/types";
import { calendarStorage } from "@/lib/storage";
import { parseBeCogCsvFile } from "@/lib/import/parseBeCogCsv";
import { parseBeCogXlsxFile } from "@/lib/import/parseBeCogXlsx";
import { parsePlanningXlsxFile } from "@/lib/import/parsePlanningXlsx";
import { normalizeBeCogRows } from "@/lib/normalize";

export default function AdminImportPage() {
  const [beCogCsvFile, setBeCogCsvFile] = useState<File | null>(null);
  const [beCogXlsxFile, setBeCogXlsxFile] = useState<File | null>(null);
  const [planningXlsxFile, setPlanningXlsxFile] = useState<File | null>(null);

  const [processing, setProcessing] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [bundle, setBundle] = useState<CalendarDataBundle | null>(null);
  const [clearMessage, setClearMessage] = useState<string>("");

  const summary = useMemo(() => bundle?.metadata ?? null, [bundle]);

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

      const metadata = {
        ...normalized.metadata,
        fileNames,
        holidayCount: holidays.length,
        warnings: [...normalized.warnings, ...parserWarnings],
      };

      const nextBundle: CalendarDataBundle = {
        sessions: normalized.sessions,
        programMasters: normalized.masters.programs,
        facilitatorMasters: normalized.masters.facilitators,
        geoMasters: normalized.masters.geos,
        holidayMasters: holidays,
        metadata,
      };

      calendarStorage.saveBundle(nextBundle);
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
        <h1 className="text-2xl font-bold text-gray-900">Admin Import</h1>
        <p className="mt-1 text-sm text-gray-600">
          Upload Be.Cognizant CSV/XLSX and optional Planning workbook to refresh local imported data.
        </p>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
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
