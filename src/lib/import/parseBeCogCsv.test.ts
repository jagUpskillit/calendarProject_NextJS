import { describe, expect, it } from "vitest";
import { parseBeCogCsvText } from "./parseBeCogCsv";

describe("parseBeCogCsvText", () => {
  it("maps headers case-insensitively and returns rawRows + warnings", async () => {
    const csv = [
      "noise row",
      "PROGRAM NAME,Overall Objectives,Facilitator,Schedule,Geo,Links",
      "Cloud Foundations,Learn cloud,Priya,21-Apr,India,https://example.com/reg",
      ",,,,,",
    ].join("\n");

    const result = await parseBeCogCsvText(csv, "becog.csv");

    expect(result.rawRows).toHaveLength(1);
    expect(result.rawRows[0].programName).toBe("Cloud Foundations");
    expect(result.rawRows[0].source.fileName).toBe("becog.csv");
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});
