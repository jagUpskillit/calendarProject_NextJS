import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseBeCogWorkbookArrayBuffer } from "./parseBeCogXlsx";

function workbookToArrayBuffer(workbook: XLSX.WorkBook): ArrayBuffer {
  const out = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return out as ArrayBuffer;
}

describe("parseBeCogWorkbookArrayBuffer", () => {
  it("detects header row within first 30 rows and extracts rows", () => {
    const data: (string | number)[][] = [
      ["Be.Cognizant View"],
      ["Generated", "2026-04-25"],
      ["Demonstrate a Strategic and Enterprise mindset"],
      [],
      ["Program Name", "Overall Objectives", "Facilitator", "Schedule", "Geo", "Links"],
      ["Cloud Foundations", "Learn cloud", "Priya", "21 - Apr", "India", "https://example.com/a"],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "India");

    const result = parseBeCogWorkbookArrayBuffer(workbookToArrayBuffer(wb), "becog.xlsx");

    expect(result.rawRows).toHaveLength(1);
    expect(result.rawRows[0].programName).toBe("Cloud Foundations");
    expect(result.rawRows[0].source.sheetName).toBe("India");
  });

  it("stops parsing a sheet after five consecutive blank Program Name rows", () => {
    const data: (string | number)[][] = [
      ["Program Name", "Facilitator", "Schedule", "Geo"],
      ["Session A", "Priya", "21-Apr", "India"],
      ["", "", "", ""],
      ["", "", "", ""],
      ["", "", "", ""],
      ["", "", "", ""],
      ["", "", "", ""],
      ["Session Should Not Be Parsed", "X", "22-Apr", "India"],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "APAC");

    const result = parseBeCogWorkbookArrayBuffer(workbookToArrayBuffer(wb), "becog.xlsx");

    expect(result.rawRows.map((r) => r.programName)).toEqual(["Session A"]);
  });

  it("infers geo from sheet name when the geo column is blank", () => {
    const data: (string | number)[][] = [
      ["Program Name", "Facilitator", "Schedule", "Geo"],
      ["Communicating Across Cultures", "Sridatri Panda", "16-Apr", ""],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "EU SM-AD");

    const result = parseBeCogWorkbookArrayBuffer(workbookToArrayBuffer(wb), "becog.xlsx");

    expect(result.rawRows).toHaveLength(1);
    expect(result.rawRows[0].geo).toBe("EU");
  });
});
