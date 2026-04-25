import * as XLSX from "xlsx";
import type { HolidayMaster } from "@/types";

export interface PlanningHolidayParseResult {
  holidays: HolidayMaster[];
  warnings: string[];
}

function norm(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function normHeader(value: unknown): string {
  return norm(value).toLowerCase().replace(/\s+/g, " ");
}

function toMatrix(sheet: XLSX.WorkSheet): string[][] {
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });
  return rows.map((r) => r.map((c) => norm(c)));
}

function parseHolidayDate(value?: string): string | undefined {
  if (!value) return undefined;
  const s = value.trim();

  const iso = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // Excel serial numbers may come as string numbers
  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (!Number.isNaN(serial) && serial > 0) {
      // Excel epoch is 1899-12-30 in JS Date serial conversions
      const epoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(epoch.getTime() + Math.floor(serial) * 86400000);
      const yyyy = date.getUTCFullYear();
      const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(date.getUTCDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return undefined;

  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function findHeader(rows: string[][]): {
  rowIndex: number;
  dateCol: number;
  holidayCol: number;
  geoCol: number;
} | null {
  const scanLimit = Math.min(rows.length, 30);

  for (let i = 0; i < scanLimit; i++) {
    const row = rows[i].map(normHeader);
    const dateCol = row.findIndex((c) => c === "date");
    const holidayCol = row.findIndex((c) => c === "holiday" || c === "holiday name");
    const geoCol = row.findIndex((c) => c === "geo" || c === "region");

    if (dateCol >= 0 && holidayCol >= 0 && geoCol >= 0) {
      return { rowIndex: i, dateCol, holidayCol, geoCol };
    }
  }

  return null;
}

export function parsePlanningWorkbookArrayBuffer(
  arrayBuffer: ArrayBuffer,
  fileName: string
): PlanningHolidayParseResult {
  const warnings: string[] = [];
  const holidays: HolidayMaster[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: false });
  } catch (err) {
    return {
      holidays: [],
      warnings: [`Failed to parse planning workbook ${fileName}: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const rows = toMatrix(sheet);
    if (rows.length === 0) return;

    const header = findHeader(rows);
    if (!header) {
      warnings.push(`Sheet \"${sheetName}\": Date/Holiday/Geo header not found.`);
      return;
    }

    for (let i = header.rowIndex + 1; i < rows.length; i++) {
      const row = rows[i] ?? [];
      const dateRaw = norm(row[header.dateCol]);
      const holidayName = norm(row[header.holidayCol]);
      const geoName = norm(row[header.geoCol]);

      if (!dateRaw && !holidayName && !geoName) continue;
      if (!dateRaw || !holidayName || !geoName) {
        warnings.push(`Sheet \"${sheetName}\" row ${i + 1}: skipped incomplete holiday row.`);
        continue;
      }

      const dateISO = parseHolidayDate(dateRaw);
      if (!dateISO) {
        warnings.push(`Sheet \"${sheetName}\" row ${i + 1}: invalid holiday date \"${dateRaw}\".`);
        continue;
      }

      holidays.push({
        dateISO,
        holidayName,
        geoName,
      });
    }
  });

  const deduped = Array.from(
    new Map(holidays.map((h) => [`${h.dateISO}|${h.holidayName.toLowerCase()}|${h.geoName.toLowerCase()}`, h])).values()
  );

  return { holidays: deduped, warnings };
}

export async function parsePlanningXlsxFile(file: File): Promise<PlanningHolidayParseResult> {
  const buffer = await file.arrayBuffer();
  return parsePlanningWorkbookArrayBuffer(buffer, file.name);
}
