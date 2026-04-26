import { describe, expect, it } from "vitest";
import type { Session } from "@/types";
import { buildAssistantInsightReport, isInsightsIntent } from "./insights";
import { buildAssistantChatResult } from "./chatbot";

const sessions: Session[] = [
  {
    id: "s1",
    programName: "Communicating Across Cultures",
    deliveryMode: "Virtual",
    facilitator: "Sridatri Panda",
    dateISO: "2026-05-14",
    geo: "India",
    targetAudience: "All up to AD",
    objectives: "Cross-cultural communication strategies",
    registrationLink: null,
    capability: "Communication",
  },
  {
    id: "s2",
    programName: "Leadership Essentials",
    deliveryMode: "Virtual",
    facilitator: "Rakhi Bhattacharyya",
    dateISO: "2026-05-20",
    geo: "India",
    targetAudience: "Managers",
    objectives: "Leadership foundations",
    registrationLink: "https://example.com/register",
    capability: "Leadership",
  },
  {
    id: "s3",
    programName: "Client First",
    deliveryMode: "In-Person",
    facilitator: "Rakhi Bhattacharyya",
    dateISO: "2026-06-02",
    geo: "EU",
    targetAudience: "Client Partners",
    objectives: "Customer-centric thinking",
    registrationLink: null,
    capability: "Client Management",
  },
];

describe("assistant insights", () => {
  it("detects insight intent", () => {
    expect(isInsightsIntent("Give me business insights on the training calendar")).toBe(true);
    expect(isInsightsIntent("show India sessions in May")).toBe(false);
  });

  it("builds an insight report with metrics and bullets", () => {
    const report = buildAssistantInsightReport(sessions);
    expect(report.metrics.length).toBeGreaterThan(3);
    expect(report.bullets.length).toBeGreaterThan(2);
    expect(report.summary).toMatch(/spans/i);
  });

  it("returns insights through chatbot result for insight-style prompts", () => {
    const result = buildAssistantChatResult("Give me BI analysis on this data", sessions);
    expect(result.insights).toBeDefined();
    expect(result.matches).toHaveLength(0);
    expect(result.reply).toMatch(/Calendar insights/i);
  });
});