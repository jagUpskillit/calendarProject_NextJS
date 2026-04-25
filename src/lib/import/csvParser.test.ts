import { describe, expect, it } from "vitest";
import { parseBecogCsvText } from "./csvParser";

describe("parseBecogCsvText", () => {
  it("detects header row with leading noise rows and maps synonyms", async () => {
    const csv = [
      "This is metadata,,,,",
      "Generated on 2026-04-25,,,,",
      "Program Name,Overall Objectives,Program Format & Duration,Facilitator,Schedule,Geo ,Links,Notes/Comments",
      "Cloud Foundations,Learn cloud basics,VILT | 2 days,Priya Sharma,21 - Apr\\n10 AM IST,India,https://example.com/reg,Bring laptop",
      ",,,,,,,",
      ",,,,,,,",
      ",,,,,,,",
      ",,,,,,,",
      ",,,,,,,",
    ].join("\n");

    const result = await parseBecogCsvText(csv, "be-cognizant.csv");

    expect(result.headerRowNumber).toBe(3);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].programName).toBe("Cloud Foundations");
    expect(result.rows[0].source.fileName).toBe("be-cognizant.csv");
    expect(result.mappedColumns.programName).toBe("Program Name");
    expect(result.mappedColumns.geo).toBe("Geo");
  });

  it("returns warning when header row is missing", async () => {
    const csv = [
      "Random,Columns,Only",
      "No,Expected,Headers",
      "Still,Nothing,Useful",
    ].join("\n");

    const result = await parseBecogCsvText(csv, "bad.csv");

    expect(result.rows).toHaveLength(0);
    expect(result.warnings.some((w) => /Could not detect a valid header row/i.test(w))).toBe(true);
  });
});
