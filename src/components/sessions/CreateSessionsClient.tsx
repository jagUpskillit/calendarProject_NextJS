"use client";

import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { calendarStorage } from "@/lib/storage/CalendarStorage";
import type {
  ProgramMaster,
  FacilitatorMaster,
  HolidayMaster,
  ImportMetadata,
  Session,
} from "@/types";


interface FormData {
  programName: string;
  capability: string;
  facilitator: string;
  date: string;
  numberOfSessions: number;
  cohortSize: string;
  openToAmericas: boolean;
  openToEurope: boolean;
  openToIndia: boolean;
  openToAPAC: boolean;
  targetAudience: string;
  source: string;
  cost: string;
  enteredBy: string;
  remarks: string;
}


const DEFAULT_FORM_STATE: FormData = {
  programName: "",
  capability: "",
  facilitator: "",
  date: "",
  numberOfSessions: 1,
  cohortSize: "",
  openToAmericas: true,
  openToEurope: true,
  openToIndia: true,
  openToAPAC: true,
  targetAudience: "SM+",
  source: "High Demand",
  cost: "",
  enteredBy: "",
  remarks: "",
};

const SOURCES = [
  "High Demand",
  "Accelerators",
  "GLD Initiatives",
  "BU/TR Need",
  "Org Culture",
  "Pilot",
  "Associate Lifecycle",
];

const AUDIENCES = ["SM+", "SM-SD", "SM-AD", "D+", "D-SD", "All"];

/**
 * CreateSessionsClient — Quick Form mode for creating a single session.
 * Shows programme search, facilitator suggestion, date picker with holiday warnings,
 * and exports as CSV.
 */
export default function CreateSessionsClient() {
  const [form, setForm] = useState<FormData>(DEFAULT_FORM_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"quick" | "grid">("quick");

  // Masters loaded from storage

  const [programs, setPrograms] = useState<ProgramMaster[]>([]);
  const [capabilities, setCapabilities] = useState<{ capabilityName: string }[]>([]);
  const [facilitators, setFacilitators] = useState<FacilitatorMaster[]>([]);
  const [holidays, setHolidays] = useState<HolidayMaster[]>([]);
  const [metadata, setMetadata] = useState<ImportMetadata | null>(null);
  const [historicalSessions, setHistoricalSessions] = useState<Session[]>([]);

  // UI state
  const [programSearch, setProgramSearch] = useState("");
  const [showProgramDropdown, setShowProgramDropdown] = useState(false);
  const [showFacilitatorDropdown, setShowFacilitatorDropdown] = useState(false);
  const [holidayWarnings, setHolidayWarnings] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const programInputRef = useRef<HTMLInputElement>(null);
  const facilitatorInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoadingMasters, setIsLoadingMasters] = useState(false);
  const [loadError, setLoadError] = useState("");

  // Load masters on mount

  useEffect(() => {
    const progs = calendarStorage.loadProgramMasters();
    const caps = calendarStorage.loadCapabilityMasters();
    const facils = calendarStorage.loadFacilitatorMasters();
    const hols = calendarStorage.loadHolidayMasters();
    const meta = calendarStorage.loadMetadata();
    const existingSessions = calendarStorage.loadSessions();

    setPrograms(progs);
    setCapabilities(caps);
    setFacilitators(facils);
    setHolidays(hols);
    setMetadata(meta);
    setHistoricalSessions(existingSessions);
  }, []);

  const normalizeText = (value: string): string => value.trim().toLowerCase();

  const findProgramByName = useCallback(
    (programName: string) =>
      programs.find(
        (program) => normalizeText(program.programName) === normalizeText(programName)
      ),
    [programs]
  );

  const suggestedFacilitators = useMemo(() => {
    const programKey = normalizeText(form.programName || "");
    if (!programKey) return [];

    const selectedProgram = programs.find(
      (program) => normalizeText(program.programName) === programKey
    );

    const counts = new Map<string, number>();
    historicalSessions.forEach((session) => {
      if (normalizeText(session.programName || "") !== programKey) return;
      const name = session.facilitator?.trim();
      if (!name) return;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    });

    const historySuggestions = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name]) => name);

    const seeded = [
      selectedProgram?.defaultFacilitator?.trim() || "",
      ...historySuggestions,
    ].filter(Boolean);

    return [...new Map(seeded.map((name) => [normalizeText(name), name])).values()];
  }, [form.programName, programs, historicalSessions]);

  const filteredSuggestedFacilitators = useMemo(() => {
    const lower = form.facilitator.toLowerCase().trim();
    if (!lower) return suggestedFacilitators;
    return suggestedFacilitators.filter((name) =>
      name.toLowerCase().includes(lower)
    );
  }, [suggestedFacilitators, form.facilitator]);

  const handleMasterFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingMasters(true);
    setLoadError("");

    try {
      // Parse and load masters on client side using existing logic
      const { parsePlanningSheetFile } = await import(
        "@/lib/import/parsePlanningSheet"
      );
      const result = await parsePlanningSheetFile(file);

      // Save to storage
      calendarStorage.saveProgramMasters(result.programMasters);
      const existingCapabilities = calendarStorage.loadCapabilityMasters();
      const parsedCapabilities = Array.from(
        new Map(
          [...existingCapabilities, ...result.programMasters
            .map((program) => program.capabilityName?.trim())
            .filter((capabilityName): capabilityName is string => Boolean(capabilityName))
            .map((capabilityName) => ({ capabilityName }))]
            .map((item) => [item.capabilityName.toLowerCase(), item])
        ).values()
      );
      calendarStorage.saveCapabilityMasters(parsedCapabilities);
      calendarStorage.saveFacilitatorMasters(result.facilitatorMasters);
      calendarStorage.saveGeoMasters(result.geoMasters);
      calendarStorage.saveHolidayMasters(result.holidayMasters);

      // Update metadata
      const newMeta = {
        importedAt: new Date().toISOString(),
        fileNames: [file.name],
        sessionCount: 0,
        programCount: result.programMasters.length,
        facilitatorCount: result.facilitatorMasters.length,
        geoCount: result.geoMasters.length,
        holidayCount: result.holidayMasters.length,
        warnings: result.warnings,
      };
      calendarStorage.saveMetadata(newMeta);

      // Update UI state
      setPrograms(result.programMasters);
      setCapabilities(parsedCapabilities);
      setFacilitators(result.facilitatorMasters);
      setHolidays(result.holidayMasters);
      setMetadata(newMeta);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load masters"
      );
    } finally {
      setIsLoadingMasters(false);
    }
  };

  // Filter programmes based on search
  const filteredPrograms = useMemo(() => {
    const selectedCapabilityKey = normalizeText(form.capability || "");
    const capabilityScopedPrograms = selectedCapabilityKey
      ? programs.filter(
          (program) =>
            normalizeText(program.capabilityName ?? "") === selectedCapabilityKey
        )
      : programs;

    if (!programSearch.trim()) return capabilityScopedPrograms.slice(0, 10); // Show first 10 if no filter
    const lower = programSearch.toLowerCase();
    return capabilityScopedPrograms.filter(
      (p) =>
        p.programName.toLowerCase().includes(lower) ||
        (p.objectives && p.objectives.toLowerCase().includes(lower))
    );
  }, [programs, programSearch, form.capability]);

  // Filter facilitators for dropdown
  const filteredFacilitators = useMemo(() => {
    const lower = form.facilitator.toLowerCase();
    return facilitators.filter(
      (f) =>
        f.name.toLowerCase().includes(lower) &&
        !suggestedFacilitators.some(
          (suggested) => normalizeText(suggested) === normalizeText(f.name)
        )
    );
  }, [facilitators, form.facilitator, suggestedFacilitators]);

  const facilitatorHasExactMatch = useMemo(() => {
    const allDropdownNames = [
      ...filteredSuggestedFacilitators,
      ...filteredFacilitators.map((item) => item.name),
    ];
    return allDropdownNames.some(
      (name) => normalizeText(name) === normalizeText(form.facilitator)
    );
  }, [filteredSuggestedFacilitators, filteredFacilitators, form.facilitator]);

  // Check for holiday conflicts
  const checkHolidayConflicts = useCallback(
    (dateISO: string) => {
      const warnings: string[] = [];
      const selectedDate = new Date(dateISO);

      // Map geo flags to holiday geo names
      const affectedGeos: string[] = [];
      if (form.openToAmericas)
        affectedGeos.push("NA");
      if (form.openToEurope)
        affectedGeos.push("UKI (EMEA)");
      if (form.openToIndia) affectedGeos.push("India");
      if (form.openToAPAC)
        affectedGeos.push(
          "Australia (APAC)",
          "Singapore (APAC)",
          "UAE (EMEA)"
        );

      holidays.forEach((h) => {
        const holidayDate = new Date(h.dateISO);
        const dayDiff = Math.abs(
          Math.floor(
            (selectedDate.getTime() - holidayDate.getTime()) / (1000 * 60 * 60 * 24)
          )
        );

        // Check same date or ±1 day
        if (dayDiff <= 1 && affectedGeos.includes(h.geoName)) {
          warnings.push(
            `${h.holidayName} on ${h.dateISO} in ${h.geoName}`
          );
        }
      });

      setHolidayWarnings(warnings);
    },
    [form.openToAmericas, form.openToEurope, form.openToIndia, form.openToAPAC, holidays]
  );

  const handleProgramSelect = (programName: string) => {
    const selectedProgram = findProgramByName(programName);
    setForm((prev) => ({
      ...prev,
      programName,
      capability:
        selectedProgram?.capabilityName?.trim() || prev.capability,
    }));
    setProgramSearch("");
    setShowProgramDropdown(false);
  };

  const handleCapabilityChange = (nextCapability: string) => {
    setForm((prev) => {
      const selectedProgram = findProgramByName(prev.programName);
      const selectedProgramCapability = selectedProgram?.capabilityName?.trim() || "";
      const selectedCapabilityKey = normalizeText(nextCapability);
      const programMatchesCapability =
        !selectedCapabilityKey ||
        (selectedProgramCapability &&
          normalizeText(selectedProgramCapability) === selectedCapabilityKey);

      return {
        ...prev,
        capability: nextCapability,
        programName: programMatchesCapability ? prev.programName : "",
      };
    });
    setProgramSearch("");
  };

  const handleFacilitatorSelect = (facilitatorName: string) => {
    setForm((prev) => ({ ...prev, facilitator: facilitatorName }));
    setShowFacilitatorDropdown(false);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateISO = e.target.value;
    setForm((prev) => ({ ...prev, date: dateISO }));
    if (dateISO) {
      checkHolidayConflicts(dateISO);
    } else {
      setHolidayWarnings([]);
    }
  };


  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.programName.trim()) newErrors.programName = "Required";
    if (!form.capability.trim()) newErrors.capability = "Required";
    if (!form.facilitator.trim()) newErrors.facilitator = "Required";
    if (!form.date) newErrors.date = "Required";
    if (!form.enteredBy.trim()) newErrors.enteredBy = "Required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const slugify = (value: string): string =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const toDeliveryMode = (formatDuration?: string): Session["deliveryMode"] => {
    if (!formatDuration) return "Unknown";
    const lower = formatDuration.toLowerCase();
    if (lower.includes("hybrid")) return "Hybrid";
    if (lower.includes("ilt") || lower.includes("in-person")) return "In-Person";
    if (lower.includes("vilt") || lower.includes("virtual") || lower.includes("online")) {
      return "Virtual";
    }
    return "Unknown";
  };

  const buildGeoValue = (): string =>
    [
      form.openToAmericas && "Americas",
      form.openToEurope && "Europe",
      form.openToIndia && "India",
      form.openToAPAC && "APAC",
    ]
      .filter(Boolean)
      .join(", ");

  const createSession = () => {
    setSaveStatus(null);
    if (!validateForm()) {
      setSaveStatus({ type: "error", message: "Please fill required fields." });
      return;
    }

    const selectedProgram = programs.find(
      (program) => program.programName.trim() === form.programName.trim()
    );

    const geoValue = buildGeoValue();
    const timestamp = Date.now();
    const sessionId = `${slugify(form.programName)}-${form.date || "undated"}-${timestamp}`;


    const newSession: Session = {
      id: sessionId,
      programName: form.programName.trim(),
      capability: form.capability.trim(),
      objectives: selectedProgram?.objectives,
      formatDuration: selectedProgram?.formatDuration,
      deliveryMode: toDeliveryMode(selectedProgram?.formatDuration),
      facilitator: form.facilitator.trim(),
      scheduleRaw: form.date,
      dateISO: form.date,
      geo: geoValue || undefined,
      targetAudience: form.targetAudience,
      batchSize: form.cohortSize ? Number.parseInt(form.cohortSize, 10) || null : undefined,
      notes: [
        form.remarks.trim() || null,
        form.source ? `Source: ${form.source}` : null,
        form.cost ? `Cost: ${form.cost}` : null,
        form.enteredBy ? `Entered By: ${form.enteredBy}` : null,
        form.numberOfSessions > 1 ? `Requested cohorts: ${form.numberOfSessions}` : null,
      ]
        .filter(Boolean)
        .join(" | "),
      source: {
        type: "planning",
        fileName: "create-session-form",
      },
    };

    const existingSessions = calendarStorage.loadSessions();
    calendarStorage.saveSessions([...existingSessions, newSession]);

    const currentMetadata = calendarStorage.loadMetadata();
    if (currentMetadata) {
      calendarStorage.saveMetadata({
        ...currentMetadata,
        sessionCount: (currentMetadata.sessionCount || 0) + 1,
      });
      setMetadata({
        ...currentMetadata,
        sessionCount: (currentMetadata.sessionCount || 0) + 1,
      });
    }

    setSaveStatus({
      type: "success",
      message: `Session created and saved locally. ID: ${sessionId}`,
    });
    resetForm();
  };

  const resetForm = () => {
    setForm(DEFAULT_FORM_STATE);
    setProgramSearch("");
    setErrors({});
    setHolidayWarnings([]);
    setShowProgramDropdown(false);
    setShowFacilitatorDropdown(false);
  };

  const downloadCSV = () => {
    if (!validateForm()) return;

    // CSV headers matching import pipeline
    const headers = [
      "Program Name",
      "Overall Objectives",
      "Program Format & Duration",
      "Facilitator",
      "Schedule",
      "Location",
      "Target Audience",
      "Geo",
      "Batch Size",
      "Links",
      "Notes",
    ];

    // Map form to CSV row
    const geoValue = buildGeoValue();

    const row = [
      form.programName,
      "", // objectives (empty)
      "", // formatDuration (empty)
      form.facilitator,
      form.date,
      "", // location (empty)
      form.targetAudience,
      geoValue,
      form.cohortSize || "",
      "", // links (empty)
      form.remarks,
    ];

    // Escape CSV values
    const escapedRow = row.map((val) => {
      const str = String(val || "");
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });

    // Build CSV
    const csv = [headers.join(","), escapedRow.join(",")].join("\n");

    // Download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute(
      "download",
      `session-${form.date}-${Date.now()}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="border-b bg-white/90 backdrop-blur-sm shadow-sm">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <h1 className="text-3xl font-bold text-gray-900">Create Sessions</h1>
          <p className="mt-2 text-gray-600">
            Create training sessions from masters instead of editing Excel. Your data stays in sync
            with the import pipeline.
          </p>
          <p className="mt-2 text-sm text-indigo-700">
            Need to add or update programs/masters?{" "}
            <Link href="/admin/masters" className="font-semibold underline hover:text-indigo-900">
              Open Master Utilities
            </Link>
          </p>

          {/* Master Loader */}
          {(!programs || programs.length === 0) && (
            <div className="mt-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <p className="text-sm font-semibold text-blue-900 mb-3">
                📥 Load planning sheet masters to get started
              </p>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleMasterFileUpload}
                  disabled={isLoadingMasters}
                  className="flex-1 text-sm"
                />
                {isLoadingMasters && (
                  <span className="text-sm text-blue-700">Loading...</span>
                )}
              </div>
              {loadError && (
                <p className="mt-2 text-sm text-red-600">Error: {loadError}</p>
              )}
            </div>
          )}

          {metadata && (
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-gray-500">
              <span>📊 {metadata.sessionCount} sessions</span>
              <span>📋 {metadata.programCount} programmes</span>
              <span>👤 {metadata.facilitatorCount} facilitators</span>
              <span>🌍 {metadata.geoCount} geos</span>
              <span>📅 {metadata.holidayCount} holidays</span>
            </div>
          )}
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="mx-auto max-w-4xl px-6 py-6">
        <div className="flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setMode("quick")}
            className={`px-4 py-2 font-medium transition ${
              mode === "quick"
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Quick Form
          </button>
          <button
            onClick={() => setMode("grid")}
            className={`px-4 py-2 font-medium transition ${
              mode === "grid"
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Bulk Grid (Coming Soon)
          </button>
        </div>
      </div>

      {mode === "quick" && (
        <div className="mx-auto max-w-4xl px-6 py-8">
          {/* Form Card */}
          <div className="rounded-[24px] bg-white shadow-lg p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              New Session
            </h2>

            <div className="space-y-6">
              {/* Capability Dropdown */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Capability <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.capability}
                  onChange={(e) => handleCapabilityChange(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border-2 outline-none transition ${
                    errors.capability
                      ? "border-red-500"
                      : "border-gray-200 focus:border-indigo-500"
                  }`}
                >
                  <option value="">Select capability</option>
                  {capabilities.map((cap) => (
                    <option key={cap.capabilityName} value={cap.capabilityName}>
                      {cap.capabilityName}
                    </option>
                  ))}
                </select>
                {errors.capability && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.capability}
                  </p>
                )}
                {form.capability && (
                  <p className="mt-1 text-xs text-gray-500">
                    Programme list is scoped to the selected capability.
                  </p>
                )}
              </div>

              {/* Programme Search */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Programme <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    ref={programInputRef}
                    type="text"
                    placeholder="Search programmes..."
                    value={
                      showProgramDropdown
                        ? programSearch
                        : form.programName
                    }
                    onChange={(e) => {
                      if (!showProgramDropdown) {
                        setForm((prev) => ({
                          ...prev,
                          programName: e.target.value,
                        }));
                      } else {
                        setProgramSearch(e.target.value);
                      }
                    }}
                    onFocus={() => {
                      setShowProgramDropdown(true);
                      setProgramSearch("");
                    }}
                    className={`w-full px-4 py-3 rounded-xl border-2 outline-none transition ${
                      errors.programName
                        ? "border-red-500"
                        : "border-gray-200 focus:border-indigo-500"
                    }`}
                  />
                  {showProgramDropdown && (
                    <div className="absolute z-10 mt-2 w-full bg-white border-2 border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                      {filteredPrograms.length > 0 ? (
                        filteredPrograms.map((p, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleProgramSelect(p.programName)}
                            className="w-full text-left px-4 py-3 hover:bg-indigo-50 border-b border-gray-100 last:border-0 transition"
                          >
                            <div className="font-medium text-gray-900">
                              {p.programName}
                            </div>
                            {p.objectives && (
                              <div className="text-sm text-gray-600 truncate">
                                {p.objectives}
                              </div>
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          No programmes found
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {errors.programName && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.programName}
                  </p>
                )}
              </div>

              {/* Facilitator */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Facilitator <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    ref={facilitatorInputRef}
                    type="text"
                    placeholder="Select or type facilitator..."
                    value={form.facilitator}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        facilitator: e.target.value,
                      }))
                    }
                    onFocus={() => setShowFacilitatorDropdown(true)}
                    className={`w-full px-4 py-3 rounded-xl border-2 outline-none transition ${
                      errors.facilitator
                        ? "border-red-500"
                        : "border-gray-200 focus:border-indigo-500"
                    }`}
                  />
                  {showFacilitatorDropdown &&
                    (filteredSuggestedFacilitators.length > 0 ||
                      filteredFacilitators.length > 0 ||
                      !!form.facilitator.trim()) && (
                    <div className="absolute z-10 mt-2 w-full bg-white border-2 border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {filteredSuggestedFacilitators.length > 0 && (
                        <>
                          <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-700 bg-indigo-50 border-b border-indigo-100">
                            Suggested for this programme
                          </div>
                          {filteredSuggestedFacilitators.map((name) => (
                            <button
                              key={`suggested-${name}`}
                              type="button"
                              onClick={() => handleFacilitatorSelect(name)}
                              className="w-full text-left px-4 py-3 hover:bg-indigo-50 border-b border-gray-100 transition font-medium text-gray-900"
                            >
                              {name}
                            </button>
                          ))}
                        </>
                      )}

                      {filteredFacilitators.length > 0 && (
                        <>
                          <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 bg-gray-50 border-b border-gray-100">
                            All facilitators
                          </div>
                          {filteredFacilitators.map((f) => (
                            <button
                              key={`master-${f.name}`}
                              type="button"
                              onClick={() => handleFacilitatorSelect(f.name)}
                              className="w-full text-left px-4 py-3 hover:bg-indigo-50 border-b border-gray-100 transition font-medium text-gray-900"
                            >
                              {f.name}
                            </button>
                          ))}
                        </>
                      )}

                      {!facilitatorHasExactMatch && form.facilitator.trim() && (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          Use typed value: "{form.facilitator.trim()}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {errors.facilitator && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.facilitator}
                  </p>
                )}
              </div>

              {/* Date with Holiday Check */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={handleDateChange}
                  className={`w-full px-4 py-3 rounded-xl border-2 outline-none transition ${
                    errors.date
                      ? "border-red-500"
                      : "border-gray-200 focus:border-indigo-500"
                  }`}
                />
                {errors.date && (
                  <p className="mt-1 text-sm text-red-600">{errors.date}</p>
                )}

                {/* Holiday Warning Badge */}
                {holidayWarnings.length > 0 && (
                  <div className="mt-3 p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <span className="text-lg flex-shrink-0 mt-0.5">⚠️</span>
                      <div>
                        <p className="text-sm font-semibold text-amber-900">
                          Holiday conflicts detected
                        </p>
                        <ul className="mt-2 space-y-1">
                          {holidayWarnings.map((w, i) => (
                            <li
                              key={i}
                              className="text-sm text-amber-800 list-disc list-inside"
                            >
                              {w}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-xs text-amber-700">
                          Consider choosing a different date, or proceed if intentional.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Number of Sessions & Cohort Size */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    # of Sessions
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.numberOfSessions}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        numberOfSessions: parseInt(e.target.value) || 1,
                      }))
                    }
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Cohort Size
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 75 or 'Upto 150'"
                    value={form.cohortSize}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        cohortSize: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Geo Checkboxes */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Open to Geos
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      key: "openToAmericas",
                      label: "Americas",
                    },
                    {
                      key: "openToEurope",
                      label: "Europe",
                    },
                    {
                      key: "openToIndia",
                      label: "India",
                    },
                    {
                      key: "openToAPAC",
                      label: "APAC",
                    },
                  ].map(({ key, label }) => (
                    <label
                      key={key}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={
                          form[key as keyof typeof form] as boolean
                        }
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            [key]: e.target.checked,
                          }))
                        }
                        className="h-5 w-5 rounded border-gray-300 text-indigo-600"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Target Audience */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Target Audience
                </label>
                <select
                  value={form.targetAudience}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      targetAudience: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 outline-none focus:border-indigo-500"
                >
                  {AUDIENCES.map((aud) => (
                    <option key={aud} value={aud}>
                      {aud}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Source
                </label>
                <select
                  value={form.source}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      source: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 outline-none focus:border-indigo-500"
                >
                  {SOURCES.map((src) => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cost */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Cost (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., USD 4500, INR 125000 + GST"
                  value={form.cost}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      cost: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 outline-none focus:border-indigo-500"
                />
              </div>

              {/* Entered By */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Entered By <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={form.enteredBy}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      enteredBy: e.target.value,
                    }))
                  }
                  className={`w-full px-4 py-3 rounded-xl border-2 outline-none transition ${
                    errors.enteredBy
                      ? "border-red-500"
                      : "border-gray-200 focus:border-indigo-500"
                  }`}
                />
                {errors.enteredBy && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.enteredBy}
                  </p>
                )}
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Remarks (optional)
                </label>
                <textarea
                  placeholder="Any additional notes..."
                  value={form.remarks}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      remarks: e.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex gap-3">
              <button
                onClick={createSession}
                className="flex-1 px-6 py-3 rounded-full bg-emerald-600 text-white font-semibold hover:bg-emerald-700 hover:shadow-lg transition"
              >
                ✅ Create Session
              </button>
              <button
                onClick={downloadCSV}
                className="flex-1 px-6 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold hover:shadow-lg transition"
              >
                📥 Download CSV
              </button>
              <button
                onClick={resetForm}
                className="flex-1 px-6 py-3 rounded-full border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition"
              >
                🔄 Reset
              </button>
            </div>

            {saveStatus && (
              <div
                className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
                  saveStatus.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {saveStatus.message}
              </div>
            )}

            <p className="mt-4 text-xs text-gray-500">
              💡 CSV exports with all required fields for round-trip import. No manual Excel editing needed!
            </p>
          </div>
        </div>
      )}

      {mode === "grid" && (
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="rounded-[24px] bg-white shadow-lg p-8 text-center">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Bulk Grid Mode
            </h3>
            <p className="text-gray-600">
              Coming in Phase 2 — multiple sessions, clone rows, repeat schedules, and bulk export.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
