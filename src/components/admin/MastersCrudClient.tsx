"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { calendarStorage } from "@/lib/storage";
import type {
  FacilitatorMaster,
  GeoMaster,
  HolidayMaster,
  ImportMetadata,
  ProgramMaster,
} from "@/types";

const emptyProgram: ProgramMaster = {
  programName: "",
  objectives: "",
  formatDuration: "",
  defaultFacilitator: "",
};

const emptyHoliday: HolidayMaster = {
  dateISO: "",
  holidayName: "",
  geoName: "",
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function sortBy<T>(items: T[], selector: (item: T) => string): T[] {
  return [...items].sort((a, b) => selector(a).localeCompare(selector(b)));
}

export default function MastersCrudClient() {
  const [programs, setPrograms] = useState<ProgramMaster[]>([]);
  const [facilitators, setFacilitators] = useState<FacilitatorMaster[]>([]);
  const [geos, setGeos] = useState<GeoMaster[]>([]);
  const [holidays, setHolidays] = useState<HolidayMaster[]>([]);
  const [metadata, setMetadata] = useState<ImportMetadata | null>(null);

  const [programForm, setProgramForm] = useState<ProgramMaster>(emptyProgram);
  const [editingProgramName, setEditingProgramName] = useState<string | null>(null);

  const [newFacilitatorName, setNewFacilitatorName] = useState("");
  const [editingFacilitatorName, setEditingFacilitatorName] = useState<string | null>(null);
  const [editingFacilitatorValue, setEditingFacilitatorValue] = useState("");

  const [newGeoName, setNewGeoName] = useState("");
  const [editingGeoName, setEditingGeoName] = useState<string | null>(null);
  const [editingGeoValue, setEditingGeoValue] = useState("");

  const [holidayForm, setHolidayForm] = useState<HolidayMaster>(emptyHoliday);
  const [editingHolidayKey, setEditingHolidayKey] = useState<string | null>(null);

  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isImportingMasters, setIsImportingMasters] = useState(false);
  const [isExportingMasters, setIsExportingMasters] = useState(false);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [showReplaceConfirmModal, setShowReplaceConfirmModal] = useState(false);
  const [replaceConfirmText, setReplaceConfirmText] = useState("");
  const [pendingReplaceFile, setPendingReplaceFile] = useState<File | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    reloadMasters();
  }, []);

  const sortedPrograms = useMemo(
    () => sortBy(programs, (p) => p.programName),
    [programs]
  );

  const sortedFacilitators = useMemo(
    () => sortBy(facilitators, (f) => f.name),
    [facilitators]
  );

  const sortedGeos = useMemo(() => sortBy(geos, (g) => g.geoName), [geos]);

  const sortedHolidays = useMemo(
    () =>
      [...holidays].sort((a, b) => {
        if (a.dateISO !== b.dateISO) return a.dateISO.localeCompare(b.dateISO);
        if (a.geoName !== b.geoName) return a.geoName.localeCompare(b.geoName);
        return a.holidayName.localeCompare(b.holidayName);
      }),
    [holidays]
  );

  function reloadMasters() {
    setPrograms(calendarStorage.loadProgramMasters());
    setFacilitators(calendarStorage.loadFacilitatorMasters());
    setGeos(calendarStorage.loadGeoMasters());
    setHolidays(calendarStorage.loadHolidayMasters());
    setMetadata(calendarStorage.loadMetadata());
  }

  function refreshMetadataCounts(next?: Partial<ImportMetadata>) {
    const current = calendarStorage.loadMetadata();
    if (!current) return;

    const updated: ImportMetadata = {
      ...current,
      ...next,
      programCount: next?.programCount ?? calendarStorage.loadProgramMasters().length,
      facilitatorCount:
        next?.facilitatorCount ?? calendarStorage.loadFacilitatorMasters().length,
      geoCount: next?.geoCount ?? calendarStorage.loadGeoMasters().length,
      holidayCount: next?.holidayCount ?? calendarStorage.loadHolidayMasters().length,
    };

    calendarStorage.saveMetadata(updated);
    setMetadata(updated);
  }

  function setSuccess(message: string) {
    setStatus({ type: "success", message });
  }

  function setError(message: string) {
    setStatus({ type: "error", message });
  }

  function handleCreateOrUpdateProgram() {
    setStatus(null);
    const name = programForm.programName.trim();
    if (!name) {
      setError("Program name is required.");
      return;
    }

    const existing = calendarStorage.loadProgramMasters();
    const key = normalizeKey(name);
    const payload: ProgramMaster = {
      programName: name,
      objectives: programForm.objectives?.trim() || undefined,
      formatDuration: programForm.formatDuration?.trim() || undefined,
      defaultFacilitator: programForm.defaultFacilitator?.trim() || undefined,
    };

    const duplicateExists = existing.some(
      (program) =>
        normalizeKey(program.programName) === key &&
        normalizeKey(program.programName) !== normalizeKey(editingProgramName ?? "")
    );

    if (duplicateExists) {
      setError("Program name already exists.");
      return;
    }

    const nextPrograms = editingProgramName
      ? existing.map((program) =>
          normalizeKey(program.programName) === normalizeKey(editingProgramName)
            ? payload
            : program
        )
      : [...existing, payload];

    calendarStorage.saveProgramMasters(nextPrograms);
    refreshMetadataCounts({ programCount: nextPrograms.length });
    setPrograms(nextPrograms);
    setProgramForm(emptyProgram);
    setEditingProgramName(null);
    setSuccess(editingProgramName ? "Program updated." : "Program created.");
  }

  function startEditProgram(program: ProgramMaster) {
    setProgramForm({
      programName: program.programName,
      objectives: program.objectives ?? "",
      formatDuration: program.formatDuration ?? "",
      defaultFacilitator: program.defaultFacilitator ?? "",
    });
    setEditingProgramName(program.programName);
    setStatus(null);
  }

  function deleteProgram(programName: string) {
    const next = programs.filter(
      (program) => normalizeKey(program.programName) !== normalizeKey(programName)
    );
    calendarStorage.saveProgramMasters(next);
    refreshMetadataCounts({ programCount: next.length });
    setPrograms(next);
    if (editingProgramName && normalizeKey(editingProgramName) === normalizeKey(programName)) {
      setProgramForm(emptyProgram);
      setEditingProgramName(null);
    }
    setSuccess("Program deleted.");
  }

  function addFacilitator() {
    const name = newFacilitatorName.trim();
    if (!name) {
      setError("Facilitator name is required.");
      return;
    }

    const exists = facilitators.some((item) => normalizeKey(item.name) === normalizeKey(name));
    if (exists) {
      setError("Facilitator already exists.");
      return;
    }

    const next = [...facilitators, { name }];
    calendarStorage.saveFacilitatorMasters(next);
    refreshMetadataCounts({ facilitatorCount: next.length });
    setFacilitators(next);
    setNewFacilitatorName("");
    setSuccess("Facilitator added.");
  }

  function updateFacilitator() {
    if (!editingFacilitatorName) return;
    const nextName = editingFacilitatorValue.trim();
    if (!nextName) {
      setError("Facilitator name cannot be empty.");
      return;
    }

    const duplicate = facilitators.some(
      (item) =>
        normalizeKey(item.name) === normalizeKey(nextName) &&
        normalizeKey(item.name) !== normalizeKey(editingFacilitatorName)
    );
    if (duplicate) {
      setError("Facilitator already exists.");
      return;
    }

    const next = facilitators.map((item) =>
      normalizeKey(item.name) === normalizeKey(editingFacilitatorName)
        ? { name: nextName }
        : item
    );
    calendarStorage.saveFacilitatorMasters(next);
    refreshMetadataCounts({ facilitatorCount: next.length });
    setFacilitators(next);
    setEditingFacilitatorName(null);
    setEditingFacilitatorValue("");
    setSuccess("Facilitator updated.");
  }

  function deleteFacilitator(name: string) {
    const next = facilitators.filter((item) => normalizeKey(item.name) !== normalizeKey(name));
    calendarStorage.saveFacilitatorMasters(next);
    refreshMetadataCounts({ facilitatorCount: next.length });
    setFacilitators(next);
    if (editingFacilitatorName && normalizeKey(editingFacilitatorName) === normalizeKey(name)) {
      setEditingFacilitatorName(null);
      setEditingFacilitatorValue("");
    }
    setSuccess("Facilitator deleted.");
  }

  function addGeo() {
    const geoName = newGeoName.trim();
    if (!geoName) {
      setError("Geo name is required.");
      return;
    }

    const exists = geos.some((item) => normalizeKey(item.geoName) === normalizeKey(geoName));
    if (exists) {
      setError("Geo already exists.");
      return;
    }

    const next = [...geos, { geoName }];
    calendarStorage.saveGeoMasters(next);
    refreshMetadataCounts({ geoCount: next.length });
    setGeos(next);
    setNewGeoName("");
    setSuccess("Geo added.");
  }

  function updateGeo() {
    if (!editingGeoName) return;
    const nextGeo = editingGeoValue.trim();
    if (!nextGeo) {
      setError("Geo name cannot be empty.");
      return;
    }

    const duplicate = geos.some(
      (item) =>
        normalizeKey(item.geoName) === normalizeKey(nextGeo) &&
        normalizeKey(item.geoName) !== normalizeKey(editingGeoName)
    );
    if (duplicate) {
      setError("Geo already exists.");
      return;
    }

    const nextGeos = geos.map((item) =>
      normalizeKey(item.geoName) === normalizeKey(editingGeoName)
        ? { geoName: nextGeo }
        : item
    );
    const nextHolidays = holidays.map((item) =>
      normalizeKey(item.geoName) === normalizeKey(editingGeoName)
        ? { ...item, geoName: nextGeo }
        : item
    );

    calendarStorage.saveGeoMasters(nextGeos);
    calendarStorage.saveHolidayMasters(nextHolidays);
    refreshMetadataCounts({ geoCount: nextGeos.length, holidayCount: nextHolidays.length });
    setGeos(nextGeos);
    setHolidays(nextHolidays);
    setEditingGeoName(null);
    setEditingGeoValue("");
    setSuccess("Geo updated.");
  }

  function deleteGeo(name: string) {
    const nextGeos = geos.filter((item) => normalizeKey(item.geoName) !== normalizeKey(name));
    const nextHolidays = holidays.filter((item) => normalizeKey(item.geoName) !== normalizeKey(name));

    calendarStorage.saveGeoMasters(nextGeos);
    calendarStorage.saveHolidayMasters(nextHolidays);
    refreshMetadataCounts({ geoCount: nextGeos.length, holidayCount: nextHolidays.length });
    setGeos(nextGeos);
    setHolidays(nextHolidays);

    if (editingGeoName && normalizeKey(editingGeoName) === normalizeKey(name)) {
      setEditingGeoName(null);
      setEditingGeoValue("");
    }

    if (holidayForm.geoName && normalizeKey(holidayForm.geoName) === normalizeKey(name)) {
      setHolidayForm((prev) => ({ ...prev, geoName: "" }));
    }

    setSuccess("Geo deleted. Related holidays removed.");
  }

  function buildHolidayKey(item: HolidayMaster): string {
    return `${item.dateISO}__${normalizeKey(item.geoName)}__${normalizeKey(item.holidayName)}`;
  }

  function createOrUpdateHoliday() {
    const dateISO = holidayForm.dateISO.trim();
    const holidayName = holidayForm.holidayName.trim();
    const geoName = holidayForm.geoName.trim();

    if (!dateISO || !holidayName || !geoName) {
      setError("Holiday date, name, and geo are required.");
      return;
    }

    if (!geos.some((item) => normalizeKey(item.geoName) === normalizeKey(geoName))) {
      setError("Select a valid geo from the list.");
      return;
    }

    const payload: HolidayMaster = { dateISO, holidayName, geoName };
    const payloadKey = buildHolidayKey(payload);
    const duplicate = holidays.some(
      (item) => buildHolidayKey(item) === payloadKey && buildHolidayKey(item) !== editingHolidayKey
    );

    if (duplicate) {
      setError("Holiday already exists for this date and geo.");
      return;
    }

    const nextHolidays = editingHolidayKey
      ? holidays.map((item) => (buildHolidayKey(item) === editingHolidayKey ? payload : item))
      : [...holidays, payload];

    calendarStorage.saveHolidayMasters(nextHolidays);
    refreshMetadataCounts({ holidayCount: nextHolidays.length });
    setHolidays(nextHolidays);
    setHolidayForm(emptyHoliday);
    setEditingHolidayKey(null);
    setSuccess(editingHolidayKey ? "Holiday updated." : "Holiday added.");
  }

  function startEditHoliday(item: HolidayMaster) {
    setHolidayForm(item);
    setEditingHolidayKey(buildHolidayKey(item));
    setStatus(null);
  }

  function deleteHoliday(item: HolidayMaster) {
    const key = buildHolidayKey(item);
    const next = holidays.filter((holiday) => buildHolidayKey(holiday) !== key);
    calendarStorage.saveHolidayMasters(next);
    refreshMetadataCounts({ holidayCount: next.length });
    setHolidays(next);

    if (editingHolidayKey === key) {
      setEditingHolidayKey(null);
      setHolidayForm(emptyHoliday);
    }

    setSuccess("Holiday deleted.");
  }

  function dedupePrograms(items: ProgramMaster[]): ProgramMaster[] {
    const byName = new Map<string, ProgramMaster>();
    for (const item of items) {
      const programName = item.programName?.trim();
      if (!programName) continue;
      byName.set(normalizeKey(programName), {
        programName,
        objectives: item.objectives?.trim() || undefined,
        formatDuration: item.formatDuration?.trim() || undefined,
        defaultFacilitator: item.defaultFacilitator?.trim() || undefined,
      });
    }
    return Array.from(byName.values());
  }

  function dedupeFacilitators(items: FacilitatorMaster[]): FacilitatorMaster[] {
    const byName = new Map<string, FacilitatorMaster>();
    for (const item of items) {
      const name = item.name?.trim();
      if (!name) continue;
      byName.set(normalizeKey(name), { name });
    }
    return Array.from(byName.values());
  }

  function dedupeGeos(items: GeoMaster[]): GeoMaster[] {
    const byName = new Map<string, GeoMaster>();
    for (const item of items) {
      const geoName = item.geoName?.trim();
      if (!geoName) continue;
      byName.set(normalizeKey(geoName), { geoName });
    }
    return Array.from(byName.values());
  }

  function dedupeHolidays(items: HolidayMaster[]): HolidayMaster[] {
    const byKey = new Map<string, HolidayMaster>();
    for (const item of items) {
      const dateISO = item.dateISO?.trim();
      const holidayName = item.holidayName?.trim();
      const geoName = item.geoName?.trim();
      if (!dateISO || !holidayName || !geoName) continue;
      byKey.set(`${dateISO}__${normalizeKey(geoName)}__${normalizeKey(holidayName)}`, {
        dateISO,
        holidayName,
        geoName,
      });
    }
    return Array.from(byKey.values());
  }

  async function exportMastersToXlsx() {
    try {
      setIsExportingMasters(true);
      setStatus(null);

      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();

      const programsSheet = XLSX.utils.json_to_sheet(
        sortedPrograms.map((item) => ({
          "Program Name": item.programName,
          Objectives: item.objectives ?? "",
          "Format Duration": item.formatDuration ?? "",
          "Default Facilitator": item.defaultFacilitator ?? "",
        }))
      );
      const facilitatorsSheet = XLSX.utils.json_to_sheet(
        sortedFacilitators.map((item) => ({ Name: item.name }))
      );
      const geosSheet = XLSX.utils.json_to_sheet(
        sortedGeos.map((item) => ({ "Geo Name": item.geoName }))
      );
      const holidaysSheet = XLSX.utils.json_to_sheet(
        sortedHolidays.map((item) => ({
          "Date ISO": item.dateISO,
          "Holiday Name": item.holidayName,
          "Geo Name": item.geoName,
        }))
      );

      XLSX.utils.book_append_sheet(workbook, programsSheet, "Programs");
      XLSX.utils.book_append_sheet(workbook, facilitatorsSheet, "Facilitators");
      XLSX.utils.book_append_sheet(workbook, geosSheet, "Geos");
      XLSX.utils.book_append_sheet(workbook, holidaysSheet, "Holidays");

      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `masters-${stamp}.xlsx`);
      setSuccess("Master export (.xlsx) downloaded.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to export XLSX.");
    } finally {
      setIsExportingMasters(false);
    }
  }

  function downloadCsv(fileName: string, headers: string[], rows: string[][]) {
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((value) => {
            const safe = value ?? "";
            if (safe.includes(",") || safe.includes('"') || safe.includes("\n")) {
              return `"${safe.replace(/"/g, '""')}"`;
            }
            return safe;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function exportMastersToCsvPack() {
    setStatus(null);
    const stamp = new Date().toISOString().slice(0, 10);

    downloadCsv(
      `masters-programs-${stamp}.csv`,
      ["Program Name", "Objectives", "Format Duration", "Default Facilitator"],
      sortedPrograms.map((item) => [
        item.programName,
        item.objectives ?? "",
        item.formatDuration ?? "",
        item.defaultFacilitator ?? "",
      ])
    );

    downloadCsv(
      `masters-facilitators-${stamp}.csv`,
      ["Name"],
      sortedFacilitators.map((item) => [item.name])
    );

    downloadCsv(
      `masters-geos-${stamp}.csv`,
      ["Geo Name"],
      sortedGeos.map((item) => [item.geoName])
    );

    downloadCsv(
      `masters-holidays-${stamp}.csv`,
      ["Date ISO", "Holiday Name", "Geo Name"],
      sortedHolidays.map((item) => [item.dateISO, item.holidayName, item.geoName])
    );

    setSuccess("Master export (CSV pack) downloaded as 4 files.");
  }

  async function parseWorksheetRows(worksheet: unknown): Promise<Record<string, unknown>[]> {
    const XLSX = await import("xlsx");
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet as object, {
      defval: "",
      raw: false,
    });
  }

  async function processImportFile(file: File, mode: "merge" | "replace") {
    try {
      setIsImportingMasters(true);
      setStatus(null);

      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      const sheetNames = workbook.SheetNames;
      const isXlsx = /\.xlsx?$/i.test(file.name);
      const isCsv = /\.csv$/i.test(file.name);

      let nextPrograms = programs;
      let nextFacilitators = facilitators;
      let nextGeos = geos;
      let nextHolidays = holidays;
      let importedAny = false;

      const combineByMode = <T,>(existing: T[], incoming: T[]): T[] => {
        return mode === "replace" ? incoming : [...existing, ...incoming];
      };

      const loadPrograms = async (sheetName: string) => {
        const rows = await parseWorksheetRows(workbook.Sheets[sheetName]);
        const mapped = rows.map((row) => ({
          programName: String(row["Program Name"] ?? "").trim(),
          objectives: String(row["Objectives"] ?? "").trim() || undefined,
          formatDuration: String(row["Format Duration"] ?? "").trim() || undefined,
          defaultFacilitator: String(row["Default Facilitator"] ?? "").trim() || undefined,
        }));
        const normalized = dedupePrograms(mapped);
        if (normalized.length > 0) {
          nextPrograms = dedupePrograms(combineByMode(nextPrograms, normalized));
          importedAny = true;
        }
      };

      const loadFacilitators = async (sheetName: string) => {
        const rows = await parseWorksheetRows(workbook.Sheets[sheetName]);
        const mapped = rows.map((row) => ({
          name: String(row["Name"] ?? "").trim(),
        }));
        const normalized = dedupeFacilitators(mapped);
        if (normalized.length > 0) {
          nextFacilitators = dedupeFacilitators(combineByMode(nextFacilitators, normalized));
          importedAny = true;
        }
      };

      const loadGeos = async (sheetName: string) => {
        const rows = await parseWorksheetRows(workbook.Sheets[sheetName]);
        const mapped = rows.map((row) => ({
          geoName: String(row["Geo Name"] ?? "").trim(),
        }));
        const normalized = dedupeGeos(mapped);
        if (normalized.length > 0) {
          nextGeos = dedupeGeos(combineByMode(nextGeos, normalized));
          importedAny = true;
        }
      };

      const loadHolidays = async (sheetName: string) => {
        const rows = await parseWorksheetRows(workbook.Sheets[sheetName]);
        const mapped = rows.map((row) => ({
          dateISO: String(row["Date ISO"] ?? "").trim(),
          holidayName: String(row["Holiday Name"] ?? "").trim(),
          geoName: String(row["Geo Name"] ?? "").trim(),
        }));
        const normalized = dedupeHolidays(mapped);
        if (normalized.length > 0) {
          nextHolidays = dedupeHolidays(combineByMode(nextHolidays, normalized));
          importedAny = true;
        }
      };

      if (isXlsx) {
        if (sheetNames.includes("Programs")) await loadPrograms("Programs");
        if (sheetNames.includes("Facilitators")) await loadFacilitators("Facilitators");
        if (sheetNames.includes("Geos")) await loadGeos("Geos");
        if (sheetNames.includes("Holidays")) await loadHolidays("Holidays");
      } else if (isCsv) {
        const firstSheet = sheetNames[0];
        const rows = await parseWorksheetRows(workbook.Sheets[firstSheet]);
        const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

        if (headers.includes("Program Name")) {
          await loadPrograms(firstSheet);
        } else if (headers.includes("Date ISO") && headers.includes("Holiday Name")) {
          await loadHolidays(firstSheet);
        } else if (headers.includes("Geo Name") && headers.length === 1) {
          await loadGeos(firstSheet);
        } else if (headers.includes("Name") && headers.length === 1) {
          await loadFacilitators(firstSheet);
        } else {
          setError("CSV format not recognized. Use exported master CSV headers.");
          return;
        }
      } else {
        setError("Unsupported file. Use .xlsx or .csv.");
        return;
      }

      const normalizedGeos = dedupeGeos(nextGeos);
      const geoLookup = new Set(normalizedGeos.map((item) => normalizeKey(item.geoName)));
      const normalizedHolidays = dedupeHolidays(nextHolidays).filter((item) =>
        geoLookup.has(normalizeKey(item.geoName))
      );

      if (!importedAny) {
        setError(
          isXlsx
            ? "No valid rows found in workbook. Check sheet names and headers."
            : "No valid rows found in CSV."
        );
        return;
      }

      calendarStorage.saveProgramMasters(dedupePrograms(nextPrograms));
      calendarStorage.saveFacilitatorMasters(dedupeFacilitators(nextFacilitators));
      calendarStorage.saveGeoMasters(normalizedGeos);
      calendarStorage.saveHolidayMasters(normalizedHolidays);

      refreshMetadataCounts({
        programCount: dedupePrograms(nextPrograms).length,
        facilitatorCount: dedupeFacilitators(nextFacilitators).length,
        geoCount: normalizedGeos.length,
        holidayCount: normalizedHolidays.length,
      });
      reloadMasters();
      setSuccess(`Master import completed (${mode}).`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to import masters.");
    } finally {
      setIsImportingMasters(false);
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  }

  async function handleImportMastersFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (importMode === "replace") {
      setPendingReplaceFile(file);
      setReplaceConfirmText("");
      setShowReplaceConfirmModal(true);
      return;
    }

    await processImportFile(file, "merge");
  }

  async function confirmReplaceImport() {
    if (!pendingReplaceFile) return;
    await processImportFile(pendingReplaceFile, "replace");
    setPendingReplaceFile(null);
    setReplaceConfirmText("");
    setShowReplaceConfirmModal(false);
  }

  function cancelReplaceImport() {
    setPendingReplaceFile(null);
    setReplaceConfirmText("");
    setShowReplaceConfirmModal(false);
    if (importInputRef.current) {
      importInputRef.current.value = "";
    }
    setStatus({
      type: "error",
      message: "Import cancelled. Switch to Merge mode to keep existing master data.",
    });
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold text-gray-900">Master Utilities</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage Program, Trainer/Facilitator, Geo, and Holiday masters with full CRUD.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Import supports `.xlsx` (sheet names: Programs, Facilitators, Geos, Holidays) or one master `.csv` using exported headers.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold text-gray-700" htmlFor="masters-import-mode">
            Import Mode
          </label>
          <select
            id="masters-import-mode"
            value={importMode}
            onChange={(event) => setImportMode(event.target.value as "merge" | "replace")}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700"
          >
            <option value="merge">Merge (append + dedupe)</option>
            <option value="replace">Replace (overwrite target masters)</option>
          </select>
          <button
            onClick={exportMastersToXlsx}
            disabled={isExportingMasters}
            className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExportingMasters ? "Exporting..." : "Download Masters (.xlsx)"}
          </button>
          <button
            onClick={exportMastersToCsvPack}
            className="rounded-md border border-indigo-300 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
          >
            Download Masters (CSV pack)
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={isImportingMasters}
            className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isImportingMasters ? "Importing..." : "Import Masters (.xlsx/.csv)"}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportMastersFile}
            className="hidden"
          />
        </div>
        {metadata && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600">
            <span>Programs: {metadata.programCount}</span>
            <span>Facilitators: {metadata.facilitatorCount}</span>
            <span>Geos: {metadata.geoCount}</span>
            <span>Holidays: {metadata.holidayCount}</span>
          </div>
        )}
      </section>

      {status && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            status.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {status.message}
        </div>
      )}

      {showReplaceConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900">Confirm Replace Import</h3>
            <p className="mt-2 text-sm text-gray-700">
              You selected <span className="font-semibold">Replace</span>. This will overwrite existing master records for imported master types.
            </p>
            <p className="mt-2 text-sm text-gray-700">
              File: <span className="font-medium">{pendingReplaceFile?.name ?? "N/A"}</span>
            </p>
            <p className="mt-4 text-sm text-gray-700">
              Type <span className="rounded bg-gray-100 px-1.5 py-0.5 font-semibold">REPLACE</span> to continue.
            </p>
            <input
              type="text"
              value={replaceConfirmText}
              onChange={(event) => setReplaceConfirmText(event.target.value)}
              placeholder="Type REPLACE"
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelReplaceImport}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReplaceImport}
                disabled={replaceConfirmText !== "REPLACE" || isImportingMasters}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isImportingMasters ? "Importing..." : "Confirm Replace"}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Create / Update Program</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            type="text"
            value={programForm.programName}
            onChange={(e) => setProgramForm((prev) => ({ ...prev, programName: e.target.value }))}
            placeholder="Program name"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={programForm.defaultFacilitator ?? ""}
            onChange={(e) =>
              setProgramForm((prev) => ({ ...prev, defaultFacilitator: e.target.value }))
            }
            placeholder="Default facilitator"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={programForm.formatDuration ?? ""}
            onChange={(e) => setProgramForm((prev) => ({ ...prev, formatDuration: e.target.value }))}
            placeholder="Format and duration"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={programForm.objectives ?? ""}
            onChange={(e) => setProgramForm((prev) => ({ ...prev, objectives: e.target.value }))}
            placeholder="Objectives"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleCreateOrUpdateProgram}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {editingProgramName ? "Update Program" : "Create Program"}
          </button>
          <button
            onClick={() => {
              setProgramForm(emptyProgram);
              setEditingProgramName(null);
              setStatus(null);
            }}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Reset
          </button>
        </div>

        <div className="mt-5 max-h-72 overflow-auto rounded-md border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-700">
                <th className="px-3 py-2">Program</th>
                <th className="px-3 py-2">Format/Duration</th>
                <th className="px-3 py-2">Default Facilitator</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedPrograms.map((program) => (
                <tr key={program.programName} className="border-b border-gray-100">
                  <td className="px-3 py-2 font-medium text-gray-900">{program.programName}</td>
                  <td className="px-3 py-2 text-gray-700">{program.formatDuration ?? "-"}</td>
                  <td className="px-3 py-2 text-gray-700">{program.defaultFacilitator ?? "-"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditProgram(program)}
                        className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteProgram(program.programName)}
                        className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Trainer / Facilitator Master</h2>
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={newFacilitatorName}
            onChange={(e) => setNewFacilitatorName(e.target.value)}
            placeholder="Add facilitator"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            onClick={addFacilitator}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add
          </button>
        </div>
        <div className="mt-4 max-h-72 overflow-auto rounded-md border border-gray-200">
          {sortedFacilitators.map((item) => (
            <div key={item.name} className="flex items-center justify-between border-b border-gray-100 px-3 py-2 text-sm last:border-b-0">
              {editingFacilitatorName && normalizeKey(editingFacilitatorName) === normalizeKey(item.name) ? (
                <div className="flex w-full items-center gap-2">
                  <input
                    type="text"
                    value={editingFacilitatorValue}
                    onChange={(e) => setEditingFacilitatorValue(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                  />
                  <button
                    onClick={updateFacilitator}
                    className="rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <>
                  <span>{item.name}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingFacilitatorName(item.name);
                        setEditingFacilitatorValue(item.name);
                        setStatus(null);
                      }}
                      className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteFacilitator(item.name)}
                      className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {sortedFacilitators.length === 0 && (
            <p className="px-3 py-3 text-sm text-gray-500">No facilitators yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Geo Master</h2>
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={newGeoName}
            onChange={(e) => setNewGeoName(e.target.value)}
            placeholder="Add geo"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            onClick={addGeo}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add
          </button>
        </div>
        <div className="mt-4 max-h-72 overflow-auto rounded-md border border-gray-200">
          {sortedGeos.map((item) => (
            <div key={item.geoName} className="flex items-center justify-between border-b border-gray-100 px-3 py-2 text-sm last:border-b-0">
              {editingGeoName && normalizeKey(editingGeoName) === normalizeKey(item.geoName) ? (
                <div className="flex w-full items-center gap-2">
                  <input
                    type="text"
                    value={editingGeoValue}
                    onChange={(e) => setEditingGeoValue(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                  />
                  <button
                    onClick={updateGeo}
                    className="rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <>
                  <span>{item.geoName}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingGeoName(item.geoName);
                        setEditingGeoValue(item.geoName);
                        setStatus(null);
                      }}
                      className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteGeo(item.geoName)}
                      className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {sortedGeos.length === 0 && (
            <p className="px-3 py-3 text-sm text-gray-500">No geos yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Holiday Master</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            type="date"
            value={holidayForm.dateISO}
            onChange={(e) => setHolidayForm((prev) => ({ ...prev, dateISO: e.target.value }))}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={holidayForm.holidayName}
            onChange={(e) => setHolidayForm((prev) => ({ ...prev, holidayName: e.target.value }))}
            placeholder="Holiday name"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={holidayForm.geoName}
            onChange={(e) => setHolidayForm((prev) => ({ ...prev, geoName: e.target.value }))}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select geo</option>
            {sortedGeos.map((geo) => (
              <option key={geo.geoName} value={geo.geoName}>
                {geo.geoName}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={createOrUpdateHoliday}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {editingHolidayKey ? "Update Holiday" : "Add Holiday"}
          </button>
          <button
            onClick={() => {
              setHolidayForm(emptyHoliday);
              setEditingHolidayKey(null);
              setStatus(null);
            }}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Reset
          </button>
        </div>

        <div className="mt-5 max-h-72 overflow-auto rounded-md border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-700">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Holiday</th>
                <th className="px-3 py-2">Geo</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedHolidays.map((item) => (
                <tr key={buildHolidayKey(item)} className="border-b border-gray-100">
                  <td className="px-3 py-2">{item.dateISO}</td>
                  <td className="px-3 py-2">{item.holidayName}</td>
                  <td className="px-3 py-2">{item.geoName}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditHoliday(item)}
                        className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteHoliday(item)}
                        className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedHolidays.length === 0 && (
            <p className="px-3 py-3 text-sm text-gray-500">No holidays yet.</p>
          )}
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={() => {
            reloadMasters();
            setSuccess("Masters refreshed from local storage.");
          }}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
