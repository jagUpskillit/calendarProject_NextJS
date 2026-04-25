import Papa from "papaparse";
import type { BeCogParseResult, CanonicalSessionField, RawBeCogRow } from "@/types";

const HEADER_SYNONYMS: Record<CanonicalSessionField, string[]> = {
  programName: ["program name"],
  objectives: ["overall objectives"],
  formatDuration: ["program format & duration", "program format and duration"],
  facilitator: ["facilitator"],
  scheduleRaw: ["schedule"],
  location: ["location"],
  targetAudience: ["target audience"],
  geo: ["geo", "geo "],
  batchSize: ["batch size"],
  registrationLink: ["links", "link", "registration link"],
  notes: ["notes", "notes/comments", "notes / comments", "comments"],
};

function norm(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function normHeader(value: unknown): string {
  return norm(value).toLowerCase().replace(/\s+/g, " ");
}

function detectHeaderMap(rows: string[][]): {
  headerIndex: number;
  map: Partial<Record<CanonicalSessionField, number>>;
} | null {
  const scanLimit = Math.min(rows.length, 30);

  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex++) {
    const row = rows[rowIndex].map(normHeader);
    if (!row.length || row.every((c) => c === "")) continue;

    const map: Partial<Record<CanonicalSessionField, number>> = {};

    for (const [field, aliases] of Object.entries(HEADER_SYNONYMS) as [CanonicalSessionField, string[]][]) {
      const idx = row.findIndex((c) => aliases.includes(c));
      if (idx >= 0) map[field] = idx;
    }

    if (map.programName !== undefined) {
      return { headerIndex: rowIndex, map };
    }
  }

  return null;
}

function getCell(row: string[], map: Partial<Record<CanonicalSessionField, number>>, field: CanonicalSessionField): string | undefined {
  const idx = map[field];
  if (idx === undefined) return undefined;
  const value = norm(row[idx]);
  return value === "" ? undefined : value;
}

function isEmptyRow(row: string[]): boolean {
  return row.every((c) => norm(c) === "");
}

export async function parseBeCogCsvText(text: string, fileName: string): Promise<BeCogParseResult> {
  const warnings: string[] = [];

  const parsed = Papa.parse<string[]>(text, {
    delimiter: "",
    skipEmptyLines: false,
  });

  if (parsed.errors.length > 0) {
    parsed.errors.forEach((e) => warnings.push(`CSV parse warning at row ${e.row ?? "?"}: ${e.message}`));
  }

  const rows = (parsed.data as unknown[])
    .filter(Array.isArray)
    .map((row) => (row as unknown[]).map(norm));

  if (rows.length === 0) {
    return { rawRows: [], warnings: ["CSV contained no readable rows."] };
  }

  const header = detectHeaderMap(rows);
  if (!header) {
    return {
      rawRows: [],
      warnings: [...warnings, "Could not detect header row (Program Name not found in first 30 rows)."],
    };
  }

  const missingColumns = (Object.keys(HEADER_SYNONYMS) as CanonicalSessionField[])
    .filter((f) => header.map[f] === undefined);
  if (missingColumns.length > 0) {
    warnings.push(`Missing optional columns: ${missingColumns.join(", ")}. Continuing with available columns.`);
  }

  const rawRows: RawBeCogRow[] = [];

  for (let i = header.headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (isEmptyRow(row)) continue;

    const programName = getCell(row, header.map, "programName");
    if (!programName) continue;

    rawRows.push({
      programName,
      objectives: getCell(row, header.map, "objectives"),
      formatDuration: getCell(row, header.map, "formatDuration"),
      facilitator: getCell(row, header.map, "facilitator"),
      scheduleRaw: getCell(row, header.map, "scheduleRaw"),
      location: getCell(row, header.map, "location"),
      targetAudience: getCell(row, header.map, "targetAudience"),
      geo: getCell(row, header.map, "geo"),
      batchSize: getCell(row, header.map, "batchSize"),
      registrationLink: getCell(row, header.map, "registrationLink"),
      notes: getCell(row, header.map, "notes"),
      source: {
        type: "becog",
        fileName,
        rowNumber: i + 1,
      },
    });
  }

  if (rawRows.length === 0) {
    warnings.push("No non-empty session rows found after header row.");
  }

  return { rawRows, warnings };
}

export async function parseBeCogCsvFile(file: File): Promise<BeCogParseResult> {
  const text = await file.text();
  return parseBeCogCsvText(text, file.name);
}
