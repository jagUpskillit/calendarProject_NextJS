import { describe, expect, it } from "vitest";
import type { Session } from "@/types";
import { buildAssistantChatResult, parseAssistantQuery, scoreAssistantSession } from "./chatbot";

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
  },
  {
    id: "s2",
    programName: "Leadership Essentials",
    deliveryMode: "Virtual",
    facilitator: "Rakhi Bhattacharyya",
    dateISO: "2026-06-20",
    geo: "EU",
    targetAudience: "Managers",
    objectives: "Leadership foundations",
  },
];

describe("assistant chatbot helpers", () => {
  it("parses geo, month, facilitator, and keywords", () => {
    const parsed = parseAssistantQuery("show Sridatri Panda India sessions in May", sessions);
    expect(parsed.geo).toBe("India");
    expect(parsed.month).toBe("2026-05");
    expect(parsed.facilitator).toBe("Sridatri Panda");
  });

  it("scores a matching session positively", () => {
    const parsed = parseAssistantQuery("India May communication", sessions);
    expect(scoreAssistantSession(sessions[0], parsed)).toBeGreaterThan(0);
  });

  it("builds a helpful response with matches", () => {
    const result = buildAssistantChatResult("Find India sessions in May", sessions);
    expect(result.matches).toHaveLength(1);
    expect(result.reply).toMatch(/I found 1 relevant sessions?|I found 1 matching sessions?/i);
  });

  it("handles empty imported data gracefully", () => {
    const result = buildAssistantChatResult("Find leadership sessions", []);
    expect(result.matches).toHaveLength(0);
    expect(result.reply).toMatch(/don’t have any imported sessions yet/i);
  });
});