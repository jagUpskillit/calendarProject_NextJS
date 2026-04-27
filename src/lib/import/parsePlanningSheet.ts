/**
 * parsePlanningSheet.ts — Parse Q2 Calendar Planning Sheet masters.
 *
 * Extracts:
 * - New Capability Mapping_D-SD sheet → ProgramMaster[]
 * - Holiday List sheet → HolidayMaster[]
 * - Unique facilitators + geos from Budget View
 */

import type {
  ProgramMaster,
  FacilitatorMaster,
  GeoMaster,
  HolidayMaster,
  ImportMetadata,
} from "@/types";

const XLSX = require("xlsx");

export interface PlanningSheetParseResult {
  programMasters: ProgramMaster[];
  facilitatorMasters: FacilitatorMaster[];
  geoMasters: GeoMaster[];
  holidayMasters: HolidayMaster[];
  warnings: string[];
}

/**
 * Parse the planning sheet Excel file and extract masters.
 * Expects file buffer (from FormData or File input).
 */
export async function parsePlanningSheetFile(
  file: File | Blob
): Promise<PlanningSheetParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });

  const result: PlanningSheetParseResult = {
    programMasters: [],
    facilitatorMasters: [],
    geoMasters: [],
    holidayMasters: [],
    warnings: [],
  };

  // Parse Capability Mapping sheet
  if (wb.Sheets["New Capability Mapping_D-SD"]) {
    const capabilityRows = parseCapabilityMapping(
      wb.Sheets["New Capability Mapping_D-SD"]
    );
    result.programMasters.push(...capabilityRows.programs);
    result.geoMasters.push(...capabilityRows.geos);
    result.warnings.push(...capabilityRows.warnings);
  } else {
    result.warnings.push(
      'Warning: "New Capability Mapping_D-SD" sheet not found'
    );
  }

  // Parse Holiday List sheet
  if (wb.Sheets["Holiday List"]) {
    const holidayRows = parseHolidayList(wb.Sheets["Holiday List"]);
    result.holidayMasters.push(...holidayRows.holidays);
    result.geoMasters.push(...holidayRows.geos);
    result.warnings.push(...holidayRows.warnings);
  } else {
    result.warnings.push('Warning: "Holiday List" sheet not found');
  }

  // Parse Budget View sheet to extract facilitators
  if (wb.Sheets["Q2 Budget View"]) {
    const budgetRows = parseBudgetView(wb.Sheets["Q2 Budget View"]);
    result.facilitatorMasters.push(...budgetRows.facilitators);
    result.geoMasters.push(...budgetRows.geos);
    result.warnings.push(...budgetRows.warnings);
  } else {
    result.warnings.push('Warning: "Q2 Budget View" sheet not found');
  }

  // Deduplicate geo masters
  const uniqueGeos = Array.from(
    new Map(result.geoMasters.map((g) => [g.geoName, g])).values()
  );
  result.geoMasters = uniqueGeos;

  // Deduplicate facilitators
  const uniqueFacilitators = Array.from(
    new Map(result.facilitatorMasters.map((f) => [f.name, f])).values()
  );
  result.facilitatorMasters = uniqueFacilitators;

  // Deduplicate programmes
  const uniquePrograms = Array.from(
    new Map(result.programMasters.map((p) => [p.programName, p])).values()
  );
  result.programMasters = uniquePrograms;

  return result;
}

/**
 * Parse "New Capability Mapping_D-SD" sheet.
 * Columns: New Competency | Level | Geo | Program Name | Delivery Mode | Duration | Course Code | Faculty Type
 */
function parseCapabilityMapping(sheet: any): {
  programs: ProgramMaster[];
  geos: GeoMaster[];
  warnings: string[];
} {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const programs: ProgramMaster[] = [];
  const geos: GeoMaster[] = [];
  const warnings: string[] = [];

  // Skip header row (row 0)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[3]) continue; // Skip if no program name

    const competency = row[0] || "";
    const level = row[1] || "";
    const geo = row[2] || "";
    const programName = String(row[3]).trim();
    const deliveryMode = row[4] || "";
    const duration = row[5] || "";
    const courseCode = row[6] || "";
    const facultyType = row[7] || "";

    if (geo) {
      geos.push({ geoName: geo });
    }

    programs.push({
      programName,
      objectives: competency || undefined,
      formatDuration: deliveryMode
        ? `${deliveryMode} | ${duration || "unknown duration"}`
        : undefined,
      defaultFacilitator: facultyType, // store faculty type as hint
    });
  }

  return { programs, geos, warnings };
}

/**
 * Parse "Holiday List" sheet.
 * Columns: Date | Holiday | Geo
 */
function parseHolidayList(sheet: any): {
  holidays: HolidayMaster[];
  geos: GeoMaster[];
  warnings: string[];
} {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const holidays: HolidayMaster[] = [];
  const geos: GeoMaster[] = [];
  const warnings: string[] = [];

  // Skip header row (row 0)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[1]) continue; // Skip if no holiday name

    const dateExcelSerial = row[0];
    const holidayName = String(row[1]).trim();
    const geo = String(row[2]).trim();

    // Convert Excel serial number to ISO date
    let dateISO = "";
    if (typeof dateExcelSerial === "number") {
      // Excel epoch: Jan 1, 1900; offset 1 for historical leap year bug
      const excelEpoch = new Date(1900, 0, 1);
      const date = new Date(
        excelEpoch.getTime() + (dateExcelSerial - 2) * 24 * 60 * 60 * 1000
      );
      dateISO = date.toISOString().split("T")[0];
    } else {
      warnings.push(`Row ${i}: Could not parse date "${dateExcelSerial}"`);
      continue;
    }

    if (geo) {
      geos.push({ geoName: geo });
    }

    holidays.push({
      dateISO,
      holidayName,
      geoName: geo || "Global",
    });
  }

  return { holidays, geos, warnings };
}

/**
 * Parse "Q2 Budget View" sheet to extract facilitators and geo scope.
 * Columns: S.No | Entered By | Source | Program Name | Leadership Capability | Delivery Mode |
 *          Course Code | Faculty Type | Facilitator | Vendor | Target Audience |
 *          Session Type | Open to Americas | Open to Europe | Open to India | Open to APAC | ...
 */
function parseBudgetView(sheet: any): {
  facilitators: FacilitatorMaster[];
  geos: GeoMaster[];
  warnings: string[];
} {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const facilitators: FacilitatorMaster[] = [];
  const geos: GeoMaster[] = [];
  const warnings: string[] = [];

  // Col indices (0-indexed)
  const COL_FACILITATOR = 8; // "Facilitator"
  const COL_OPEN_AMERICAS = 12; // "Open to Americas"
  const COL_OPEN_EUROPE = 13; // "Open to Europe"
  const COL_OPEN_INDIA = 14; // "Open to India"
  const COL_OPEN_APAC = 15; // "Open to APAC"

  // Skip header rows (0, 1)
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue; // Skip if no S.No

    const facilitator = row[COL_FACILITATOR];
    if (facilitator && String(facilitator).trim()) {
      facilitators.push({
        name: String(facilitator).trim(),
      });
    }

    // Track geos opened to
    if (row[COL_OPEN_AMERICAS] === "Yes") geos.push({ geoName: "Americas" });
    if (row[COL_OPEN_EUROPE] === "Yes") geos.push({ geoName: "Europe" });
    if (row[COL_OPEN_INDIA] === "Yes") geos.push({ geoName: "India" });
    if (row[COL_OPEN_APAC] === "Yes") geos.push({ geoName: "APAC" });
  }

  return { facilitators, geos, warnings };
}
