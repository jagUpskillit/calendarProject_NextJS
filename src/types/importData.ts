/**
 * importData.ts — Canonical import/storage entities for Phase 1 import pipeline.
 */

import type { Session } from "./session";

export type CanonicalSessionField =
  | "programName"
  | "objectives"
  | "formatDuration"
  | "facilitator"
  | "scheduleRaw"
  | "location"
  | "targetAudience"
  | "geo"
  | "batchSize"
  | "registrationLink"
  | "notes";

export interface RawImportSessionRow {
  programName?: string;
  objectives?: string;
  formatDuration?: string;
  facilitator?: string;
  scheduleRaw?: string;
  location?: string;
  targetAudience?: string;
  geo?: string;
  batchSize?: string;
  registrationLink?: string;
  notes?: string;
  /** Capability heading row this session falls under (e.g. "Demonstrate a Strategic and Enterprise mindset") */
  capability?: string;
  source: {
    type: "becog" | "planning";
    fileName: string;
    sheetName?: string;
    rowNumber?: number;
  };
}

export type RawBeCogRow = RawImportSessionRow;

export interface BeCogParseResult {
  rawRows: RawBeCogRow[];
  warnings: string[];
}

export interface CsvParseResult {
  rows: RawImportSessionRow[];
  warnings: string[];
  headerRowNumber?: number;
  mappedColumns: Partial<Record<CanonicalSessionField, string>>;
}

export interface ProgramMaster {
  programName: string;
  objectives?: string;
  formatDuration?: string;
  defaultFacilitator?: string;
}

export interface FacilitatorMaster {
  name: string;
}

export interface GeoMaster {
  geoName: string;
}

export interface HolidayMaster {
  dateISO: string;
  holidayName: string;
  geoName: string;
}

export interface ImportMetadata {
  importedAt: string;
  fileNames: string[];
  sessionCount: number;
  programCount: number;
  facilitatorCount: number;
  geoCount: number;
  holidayCount: number;
  warnings: string[];
}

export interface CalendarDataBundle {
  sessions: Session[];
  programMasters: ProgramMaster[];
  facilitatorMasters: FacilitatorMaster[];
  geoMasters: GeoMaster[];
  holidayMasters: HolidayMaster[];
  metadata: ImportMetadata;
}
