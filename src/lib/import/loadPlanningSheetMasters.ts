/**
 * loadPlanningSheetMasters.ts — Helper to load planning sheet masters into storage.
 * Call this during app initialization or import flow.
 */

import { parsePlanningSheetFile, type PlanningSheetParseResult } from "@/lib/import/parsePlanningSheet";
import { calendarStorage } from "@/lib/storage/CalendarStorage";
import type { ImportMetadata } from "@/types";

/**
 * Load planning sheet file and save masters to storage.
 * Returns metadata about what was loaded.
 */
export async function loadPlanningSheetMasters(
  file: File | Blob
): Promise<ImportMetadata> {
  const result = await parsePlanningSheetFile(file);

  // Save masters to storage
  calendarStorage.saveProgramMasters(result.programMasters);
  calendarStorage.saveFacilitatorMasters(result.facilitatorMasters);
  calendarStorage.saveGeoMasters(result.geoMasters);
  calendarStorage.saveHolidayMasters(result.holidayMasters);

  // Update metadata
  const metadata: ImportMetadata = {
    importedAt: new Date().toISOString(),
    fileNames: [file instanceof File ? file.name : "planning-sheet.xlsx"],
    sessionCount: 0, // Masters don't have sessions
    programCount: result.programMasters.length,
    facilitatorCount: result.facilitatorMasters.length,
    geoCount: result.geoMasters.length,
    holidayCount: result.holidayMasters.length,
    warnings: result.warnings,
  };

  calendarStorage.saveMetadata(metadata);

  return metadata;
}
