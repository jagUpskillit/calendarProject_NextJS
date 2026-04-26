import { describe, expect, it } from "vitest";
import {
  applyFilter,
  applySort,
  buildSessionId,
  extractUrl,
  inferDeliveryMode,
  parseBatchSize,
  parseDateISO,
  relatednessScore,
  slugify,
} from "./dataUtils";
import type { Session } from "@/types";

const sessions: Session[] = [
  {
    id: "s1",
    programName: "Cloud Foundations",
    deliveryMode: "Virtual",
    facilitator: "Priya Sharma",
    objectives: "Cloud basics",
    dateISO: "2026-05-14",
    geo: "India",
    targetAudience: "Senior Associates",
    capability: "Cloud",
    tags: ["cloud", "india"],
  },
  {
    id: "s2",
    programName: "Leadership Essentials",
    deliveryMode: "Hybrid",
    facilitator: "Sophie Laurent",
    objectives: "Leadership coaching",
    dateISO: "2026-06-03",
    geo: "EMEA",
    targetAudience: "Team Leads",
    capability: "Leadership",
    tags: ["leadership", "emea"],
  },
  {
    id: "s3",
    programName: "Data and AI Primer",
    deliveryMode: "In-Person",
    facilitator: "David Chen",
    objectives: "Data and AI concepts",
    dateISO: "2026-05-20",
    geo: "US",
    targetAudience: "All Associates",
    capability: "Data & AI",
    tags: ["data", "ai"],
  },
];

describe("dataUtils parsing and normalization", () => {
  it("slugify creates URL-safe slugs", () => {
    expect(slugify("Cloud Foundations – India")).toBe("cloud-foundations-india");
  });

  it("buildSessionId is stable and contains hash", () => {
    const id = buildSessionId("Cloud Foundations", "2026-05-14", "India");
    expect(id).toMatch(/^cloud-foundations2026-05-14india-[0-9a-f]{6}$/);
  });

  it("extractUrl returns first valid URL and trims punctuation", () => {
    const text = "Register here: https://example.com/register, then confirm.";
    expect(extractUrl(text)).toBe("https://example.com/register");
    expect(extractUrl("No URL")).toBeNull();
  });

  it("parseBatchSize parses string and number values", () => {
    expect(parseBatchSize("Max 25 seats")).toBe(25);
    expect(parseBatchSize(31)).toBe(31);
    expect(parseBatchSize("n/a")).toBeNull();
  });

  it("parseDateISO handles supported date formats", () => {
    expect(parseDateISO("2026-05-14")).toBe("2026-05-14");
    expect(parseDateISO("14 May 2026")).toBe("2026-05-14");
    expect(parseDateISO("May 14, 2026")).toBe("2026-05-14");
    expect(parseDateISO("14/05/2026")).toBe("2026-05-14");
    expect(parseDateISO("TBD soon")).toBeUndefined();
  });

  it("inferDeliveryMode infers from format/location text", () => {
    expect(inferDeliveryMode("VILT | 2 hours", "Teams")).toBe("Virtual");
    expect(inferDeliveryMode("Webinar | 1.5 hours", undefined)).toBe("Virtual");
    expect(inferDeliveryMode("Self-paced(30 mins)", undefined)).toBe("Virtual");
    expect(inferDeliveryMode("ILT", "Classroom A")).toBe("In-Person");
    expect(inferDeliveryMode("Hybrid", "Office + Teams")).toBe("Hybrid");
    expect(inferDeliveryMode(undefined, undefined)).toBe("Unknown");
  });
});

describe("dataUtils filtering and sorting", () => {
  it("applyFilter matches free text query", () => {
    const result = applyFilter(sessions, { query: "priya" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("s1");
  });

  it("applyFilter supports geo + month filtering", () => {
    const result = applyFilter(sessions, { geo: "India", month: "2026-05" });
    expect(result.map((s) => s.id)).toEqual(["s1"]);
  });

  it("applySort sorts by name and date", () => {
    const byName = applySort(sessions, { field: "name", order: "asc" });
    expect(byName.map((s) => s.id)).toEqual(["s1", "s3", "s2"]);

    const byDate = applySort(sessions, { field: "date", order: "asc" });
    expect(byDate.map((s) => s.id)).toEqual(["s1", "s3", "s2"]);
  });

  it("relatednessScore increases on shared properties", () => {
    const scoreLow = relatednessScore(sessions[0], sessions[2]);
    const scoreHigh = relatednessScore(sessions[0], {
      ...sessions[2],
      geo: "India",
      tags: ["cloud"],
    });
    expect(scoreHigh).toBeGreaterThan(scoreLow);
  });
});
