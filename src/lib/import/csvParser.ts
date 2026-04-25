import Papa from "papaparse";
import type { CanonicalSessionField, CsvParseResult, RawImportSessionRow } from "@/types";

const HEADER_ALIASES: Record<CanonicalSessionField, string[]> = {
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

function normalizeCell(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function normalizeHeader(value: string): string {
  return normalizeCell(value)
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isLikelyMetadataRow(row: string[]): boolean {
  const joined = row.map(normalizeCell).join(" ").toLowerCase();
  if (!joined) return true;
  return /^(last updated|generated on|confidential|owner|version|legend)\b/.test(joined);
}

function detectHeaderRow(rows: string[][]): {
  headerRowIndex: number;
  fieldToColumnIndex: Partial<Record<CanonicalSessionField, number>>;
  warnings: string[];
} | null {
  const warnings: string[] = [];
  const scanLimit = Math.min(rows.length, 30);

  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex++) {
    const row = rows[rowIndex].map((c) => normalizeHeader(c));
    if (!row.length || row.every((c) => c === "")) continue;

    const fieldToColumnIndex: Partial<Record<CanonicalSessionField, number>> = {};

    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [CanonicalSessionField, string[]][]) {
      const foundIndex = row.findIndex((cell) => aliases.includes(cell));
      if (foundIndex >= 0) fieldToColumnIndex[field] = foundIndex;
    }

    if (fieldToColumnIndex.programName !== undefined) {
      const mappedCount = Object.keys(fieldToColumnIndex).length;
      if (mappedCount < 4) {
        warnings.push(
          `Header row detected at row ${rowIndex + 1}, but only ${mappedCount} known columns mapped.`
        );
      }
      return { headerRowIndex: rowIndex, fieldToColumnIndex, warnings };
    }
  }

  return null;
}

function buildMappedColumns(
  headers: string[],
  fieldToColumnIndex: Partial<Record<CanonicalSessionField, number>>
): Partial<Record<CanonicalSessionField, string>> {
  const mapped: Partial<Record<CanonicalSessionField, string>> = {};
  for (const [field, index] of Object.entries(fieldToColumnIndex) as [CanonicalSessionField, number][]) {
    mapped[field] = normalizeCell(headers[index] ?? "");
  }
  return mapped;
}

export async function parseBecogCsvText(text: string, fileName: string): Promise<CsvParseResult> {
  const warnings: string[] = [];

  const parsed = Papa.parse<string[]>(text, {
    delimiter: "",
    skipEmptyLines: false,
  });

  if (parsed.errors.length > 0) {
    parsed.errors.forEach((e) => {
      warnings.push(`CSV parse warning at row ${e.row ?? "?"}: ${e.message}`);
    });
  }

  const rows = (parsed.data as unknown[])
    .filter(Array.isArray)
    .map((r) => (r as unknown[]).map((c) => normalizeCell(c)));

  if (rows.length === 0) {
    return {
      rows: [],
      warnings: ["CSV contained no readable rows."],
      mappedColumns: {},
    };
  }

  const headerDetection = detectHeaderRow(rows);
  if (!headerDetection) {
    return {
      rows: [],
      warnings: [...warnings, "Could not detect a valid header row (Program Name not found in first 30 rows)."],
      mappedColumns: {},
    };
  }

  warnings.push(...headerDetection.warnings);

  const { headerRowIndex, fieldToColumnIndex } = headerDetection;
  const headerRow = rows[headerRowIndex] ?? [];

  const resultRows: RawImportSessionRow[] = [];
  let consecutiveBlanks = 0;

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];

    if (isLikelyMetadataRow(row)) continue;

    const getField = (field: CanonicalSessionField): string | undefined => {
      const col = fieldToColumnIndex[field];
      if (col === undefined) return undefined;
      const value = normalizeCell(row[col]);
      return value === "" ? undefined : value;
    };

    const programName = getField("programName");

    if (!programName) {
      consecutiveBlanks++;
      if (consecutiveBlanks >= 5) break;
      continue;
    }
    consecutiveBlanks = 0;

    resultRows.push({
      programName,
      objectives: getField("objectives"),
      formatDuration: getField("formatDuration"),
      facilitator: getField("facilitator"),
      scheduleRaw: getField("scheduleRaw"),
      location: getField("location"),
      targetAudience: getField("targetAudience"),
      geo: getField("geo"),
      batchSize: getField("batchSize"),
      registrationLink: getField("registrationLink"),
      notes: getField("notes"),
      source: {
        type: "becog",
        fileName,
        rowNumber: i + 1,
      },
    });
  }

  if (resultRows.length === 0) {
    warnings.push("No session rows were extracted from CSV after header detection.");
  }

  return {
    rows: resultRows,
    warnings,
    headerRowNumber: headerRowIndex + 1,
    mappedColumns: buildMappedColumns(headerRow, fieldToColumnIndex),
  };
}

export async function parseBecogCsvFile(file: File): Promise<CsvParseResult> {
  const text = await file.text();
  return parseBecogCsvText(text, file.name);
}
