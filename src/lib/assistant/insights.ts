import type { Session } from "@/types";

export interface AssistantInsightMetric {
  label: string;
  value: string;
}

export interface AssistantInsightReport {
  headline: string;
  summary: string;
  bullets: string[];
  metrics: AssistantInsightMetric[];
}

function countBy<T extends string>(values: T[]): Array<{ key: T; count: number }> {
  const map = new Map<T, number>();
  for (const value of values) {
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)));
}

function firstOrFallback(items: Array<{ key: string; count: number }>, fallback: string): string {
  if (items.length === 0) return fallback;
  const top = items[0];
  return `${top.key} (${top.count})`;
}

export function buildAssistantInsightReport(sessions: Session[]): AssistantInsightReport {
  if (sessions.length === 0) {
    return {
      headline: "No imported data available",
      summary: "Import a workbook to generate adoption, coverage, and content-distribution insights.",
      bullets: [
        "No sessions are currently available for analysis.",
        "Once data is imported, the assistant can summarize geo spread, capability mix, and delivery patterns.",
      ],
      metrics: [
        { label: "Sessions", value: "0" },
        { label: "Geos", value: "0" },
        { label: "Capabilities", value: "0" },
      ],
    };
  }

  const geos = countBy(sessions.map((session) => session.geo ?? "Unspecified"));
  const capabilities = countBy(sessions.map((session) => session.capability ?? "Unspecified"));
  const facilitators = countBy(sessions.map((session) => session.facilitator ?? "TBD"));
  const deliveryModes = countBy(sessions.map((session) => session.deliveryMode));
  const monthBuckets = countBy(
    sessions
      .map((session) => session.dateISO?.slice(0, 7))
      .filter((value): value is string => Boolean(value))
  );

  const missingRegistration = sessions.filter((session) => !session.registrationLink).length;
  const missingDates = sessions.filter((session) => !session.dateISO).length;
  const virtualCount = sessions.filter((session) => session.deliveryMode === "Virtual").length;
  const uniqueGeos = new Set(sessions.map((session) => session.geo).filter(Boolean)).size;
  const uniqueCapabilities = new Set(sessions.map((session) => session.capability).filter(Boolean)).size;

  const missingLinkPct = Math.round((missingRegistration / sessions.length) * 100);
  const virtualPct = Math.round((virtualCount / sessions.length) * 100);

  const bullets: string[] = [
    `Top geo coverage is ${firstOrFallback(geos, "Unspecified")}, which indicates where the current calendar is most concentrated.`,
    `The strongest capability/theme is ${firstOrFallback(capabilities, "Unspecified")}, giving a quick view of content emphasis.`,
    `The busiest delivery month is ${firstOrFallback(monthBuckets, "No dated sessions")}, useful for balancing calendar load and communications.`,
  ];

  if (missingRegistration > 0) {
    bullets.push(`${missingRegistration} sessions (${missingLinkPct}%) are missing registration links, which is a likely conversion and support-ticket risk.`);
  }

  if (missingDates > 0) {
    bullets.push(`${missingDates} sessions do not have a parsed date yet, so some schedule reporting may be understated.`);
  }

  if (facilitators.length > 0) {
    bullets.push(`Most-active facilitator is ${firstOrFallback(facilitators, "TBD")}, which can help identify delivery concentration or over-reliance.`);
  }

  return {
    headline: `Calendar insights for ${sessions.length} imported sessions`,
    summary: `The current dataset spans ${uniqueGeos} geos, ${uniqueCapabilities} capability areas, and is ${virtualPct}% virtual by delivery mode.`,
    bullets,
    metrics: [
      { label: "Sessions", value: String(sessions.length) },
      { label: "Top Geo", value: firstOrFallback(geos, "N/A") },
      { label: "Top Capability", value: firstOrFallback(capabilities, "N/A") },
      { label: "Virtual Share", value: `${virtualPct}%` },
      { label: "Missing Links", value: String(missingRegistration) },
      { label: "Peak Month", value: firstOrFallback(monthBuckets, "N/A") },
    ],
  };
}

export function isInsightsIntent(message: string): boolean {
  return /(insights?|analysis|analyze|analytics|business intelligence|bi\b|value analysis|summary of data|trends?|recommendations?)/i.test(message);
}