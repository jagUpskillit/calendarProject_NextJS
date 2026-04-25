import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parsePlanningWorkbookArrayBuffer } from "./parsePlanningXlsx";

function workbookToArrayBuffer(workbook: XLSX.WorkBook): ArrayBuffer {
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

describe("parsePlanningWorkbookArrayBuffer", () => {
  it("finds Date/Holiday/Geo headers and extracts holiday rows", () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Some title"],
      ["Date", "Holiday", "Geo"],
      ["2026-05-01", "Labor Day", "India"],
      ["", "", ""],
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "HolidayList");

    const result = parsePlanningWorkbookArrayBuffer(workbookToArrayBuffer(wb), "planning.xlsx");

    expect(result.holidays).toHaveLength(1);
    expect(result.holidays[0]).toEqual({
      dateISO: "2026-05-01",
      holidayName: "Labor Day",
      geoName: "India",
    });
  });
});
