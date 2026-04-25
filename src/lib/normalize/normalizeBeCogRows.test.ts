import { describe, expect, it } from "vitest";
import { normalizeBeCogRows } from "./normalizeBeCogRows";
import type { RawBeCogRow } from "@/types";

describe("normalizeBeCogRows", () => {
  it("normalizes sessions, derives masters, and metadata counts", () => {
    const rows: RawBeCogRow[] = [
      {
        programName: "Cloud Foundations",
        scheduleRaw: "21 - Apr | 10 AM IST",
        geo: "India/APAC",
        facilitator: "Priya Sharma",
        registrationLink: "Register: https://example.com/register",
        source: { type: "becog", fileName: "becog.xlsx", sheetName: "India", rowNumber: 12 },
      },
      {
        programName: "Cloud Foundations",
        scheduleRaw: "7-May | 10 AM IST",
        geo: "India",
        facilitator: "Priya Sharma",
        source: { type: "becog", fileName: "becog.xlsx", sheetName: "India", rowNumber: 13 },
      },
    ];

    const result = normalizeBeCogRows(rows, { holidays: [] });

    expect(result.sessions).toHaveLength(2);
    expect(result.sessions[0].dateISO).toBe("2026-04-21");
    expect(result.sessions[0].registrationLink).toBe("https://example.com/register");
    expect(result.masters.programs).toHaveLength(1);
    expect(result.masters.facilitators).toHaveLength(1);
    expect(result.masters.geos.length).toBeGreaterThanOrEqual(1);
    expect(result.metadata.sessionCount).toBe(2);
    expect(result.metadata.programCount).toBe(1);
  });

  it("resolves duplicate base ids to unique session ids", () => {
    const rows: RawBeCogRow[] = [
      {
        programName: "Communicating Across Cultures",
        scheduleRaw: "16-Apr",
        geo: "Global",
        source: { type: "becog", fileName: "be1.xlsx", sheetName: "Global", rowNumber: 10 },
      },
      {
        programName: "Communicating Across Cultures",
        scheduleRaw: "16-Apr",
        geo: "Global",
        source: { type: "becog", fileName: "be1.xlsx", sheetName: "Global", rowNumber: 11 },
      },
    ];

    const result = normalizeBeCogRows(rows, { holidays: [] });
    const ids = result.sessions.map((s) => s.id);

    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(result.warnings.some((w) => /duplicate session id/i.test(w))).toBe(true);
  });
});
