import * as XLSX from "xlsx";
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

const CAPABILITY_HEADING_RE = /^(demonstrate|develop|build|strengthen|drive)\b/i;
const COMMENT_BLOCK_RE = /^(comment|thread|reply|notes?:|owner:|status:|action:)\b/i;

function norm(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function normHeader(value: unknown): string {
  return norm(value).toLowerCase().replace(/\s+/g, " ");
}

function toSheetMatrix(sheet: XLSX.WorkSheet): string[][] {
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });
  return rows.map((row) => row.map((cell) => norm(cell)));
}

function detectHeader(rows: string[][]): { headerIndex: number; map: Partial<Record<CanonicalSessionField, number>> } | null {
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

function inferGeoFromSheetName(sheetName: string): string | undefined {
  const normalized = norm(sheetName).toLowerCase();
  if (normalized.startsWith("india")) return "India";
  if (normalized.startsWith("apac")) return "APAC";
  if (normalized.startsWith("eu")) return "EU";
  if (normalized.startsWith("na")) return "NA";
  if (normalized.startsWith("global")) return "Global";
  return undefined;
}

function isHeadingLikeRow(programName: string, row: string[]): boolean {
  const nonEmpty = row.map(norm).filter(Boolean);
  if (nonEmpty.length <= 2 && CAPABILITY_HEADING_RE.test(programName)) return true;
  if (COMMENT_BLOCK_RE.test(programName)) return true;
  return false;
}

export function parseBeCogWorkbookArrayBuffer(arrayBuffer: ArrayBuffer, fileName: string): BeCogParseResult {
  const warnings: string[] = [];
  const rawRows: RawBeCogRow[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: false });
  } catch (err) {
    return {
      rawRows: [],
      warnings: [`Failed to parse workbook ${fileName}: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      warnings.push(`Sheet \"${sheetName}\" missing in workbook.`);
      return;
    }

    try {
      const rows = toSheetMatrix(sheet);
      if (rows.length === 0) {
        warnings.push(`Sheet \"${sheetName}\" is empty.`);
        return;
      }

      const header = detectHeader(rows);
      if (!header) {
        warnings.push(`Sheet \"${sheetName}\": header row not found (Program Name missing in first 30 rows).`);
        return;
      }

      let blankProgramNameStreak = 0;

      for (let i = header.headerIndex + 1; i < rows.length; i++) {
        const row = rows[i] ?? [];
        const programName = getCell(row, header.map, "programName");

        if (!programName) {
          blankProgramNameStreak++;
          if (blankProgramNameStreak >= 5) break;
          continue;
        }
        blankProgramNameStreak = 0;

        if (isHeadingLikeRow(programName, row)) {
          warnings.push(`Sheet \"${sheetName}\" row ${i + 1}: skipped non-session heading/comment row.`);
          continue;
        }

        rawRows.push({
          programName,
          objectives: getCell(row, header.map, "objectives"),
          formatDuration: getCell(row, header.map, "formatDuration"),
          facilitator: getCell(row, header.map, "facilitator"),
          scheduleRaw: getCell(row, header.map, "scheduleRaw"),
          location: getCell(row, header.map, "location"),
          targetAudience: getCell(row, header.map, "targetAudience"),
          geo: getCell(row, header.map, "geo") ?? inferGeoFromSheetName(sheetName),
          batchSize: getCell(row, header.map, "batchSize"),
          registrationLink: getCell(row, header.map, "registrationLink"),
          notes: getCell(row, header.map, "notes"),
          source: {
            type: "becog",
            fileName,
            sheetName,
            rowNumber: i + 1,
          },
        });
      }
    } catch (err) {
      warnings.push(
        `Sheet \"${sheetName}\" parse failed and was skipped: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  });

  return { rawRows, warnings };
}

export async function parseBeCogXlsxFile(file: File): Promise<BeCogParseResult> {
  const buffer = await file.arrayBuffer();
  return parseBeCogWorkbookArrayBuffer(buffer, file.name);
}
