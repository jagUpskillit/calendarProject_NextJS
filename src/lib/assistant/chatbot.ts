import type { Session } from "@/types";
import { buildAssistantInsightReport, isInsightsIntent } from "./insights";

export interface ParsedAssistantQuery {
  geo?: string;
  month?: string;
  facilitator?: string;
  keywords: string[];
}

export interface AssistantChatResult {
  reply: string;
  matches: Session[];
  parsed: ParsedAssistantQuery;
  insights?: {
    headline: string;
    summary: string;
    bullets: string[];
    metrics: Array<{ label: string; value: string }>;
  };
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const STOPWORDS = new Set([
  "sessions", "session", "in", "for", "show", "find", "training", "trainings",
  "please", "me", "the", "a", "an", "and", "with", "on", "of", "available",
  "what", "which", "are", "is", "there", "do", "have", "upcoming", "any",
]);

function normalizeText(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function parseAssistantQuery(input: string, sessions: Session[]): ParsedAssistantQuery {
  const lower = input.toLowerCase();
  const tokens = lower.split(/\s+/).filter(Boolean);

  const geos = [...new Set(sessions.map((s) => s.geo).filter((x): x is string => !!x))];
  const facilitators = [...new Set(sessions.map((s) => s.facilitator).filter((x): x is string => !!x))];

  const geo = geos.find((item) => lower.includes(item.toLowerCase()));
  const monthName = MONTH_NAMES.find((month) => lower.includes(month));
  const month = monthName
    ? `${new Date().getFullYear()}-${String(MONTH_NAMES.indexOf(monthName) + 1).padStart(2, "0")}`
    : undefined;
  const facilitator = facilitators.find((item) => lower.includes(item.toLowerCase()));

  const keywords = tokens.filter((token) => !STOPWORDS.has(token) && !MONTH_NAMES.includes(token));

  return { geo, month, facilitator, keywords };
}

export function scoreAssistantSession(session: Session, parsed: ParsedAssistantQuery): number {
  let score = 0;

  if (parsed.geo && normalizeText(session.geo) === normalizeText(parsed.geo)) score += 5;
  if (parsed.month && session.dateISO?.startsWith(parsed.month)) score += 4;
  if (parsed.facilitator && normalizeText(session.facilitator) === normalizeText(parsed.facilitator)) score += 5;

  const blob = [
    session.programName,
    session.objectives ?? "",
    session.facilitator ?? "",
    session.capability ?? "",
    session.targetAudience ?? "",
    ...(session.tags ?? []),
  ].join(" ").toLowerCase();

  for (const keyword of parsed.keywords) {
    if (blob.includes(keyword)) score += 2;
  }

  return score;
}

function buildCriteriaSummary(parsed: ParsedAssistantQuery): string[] {
  const parts: string[] = [];
  if (parsed.geo) parts.push(`geo ${parsed.geo}`);
  if (parsed.month) parts.push(`month ${parsed.month}`);
  if (parsed.facilitator) parts.push(`facilitator ${parsed.facilitator}`);
  if (parsed.keywords.length > 0) parts.push(`keywords ${parsed.keywords.join(", ")}`);
  return parts;
}

export function buildAssistantChatResult(message: string, sessions: Session[]): AssistantChatResult {
  const trimmed = message.trim();
  const parsed = parseAssistantQuery(trimmed, sessions);

  if (isInsightsIntent(trimmed)) {
    const insightReport = buildAssistantInsightReport(sessions);
    return {
      reply: `${insightReport.headline}. ${insightReport.summary}`,
      matches: [],
      parsed,
      insights: insightReport,
    };
  }

  if (sessions.length === 0) {
    return {
      reply: "I don’t have any imported sessions yet. Please import the latest workbook and I can help you browse, compare, and find sessions.",
      matches: [],
      parsed,
    };
  }

  if (!trimmed) {
    return {
      reply: "Ask me things like 'Show India sessions in May' or 'Find communication workshops by Sridatri Panda'.",
      matches: [],
      parsed,
    };
  }

  if (/help|what can you do|how do i use/i.test(trimmed)) {
    return {
      reply: "I can search the imported session catalog in plain English, for example by geo, month, facilitator, audience, or topic. Try asking for upcoming sessions, leadership programs, or region-specific workshops.",
      matches: [],
      parsed,
    };
  }

  const matches = sessions
    .map((session) => ({ session, score: scoreAssistantSession(session, parsed) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || (a.session.dateISO ?? "9999").localeCompare(b.session.dateISO ?? "9999"))
    .map((item) => item.session);

  const topMatches = matches.slice(0, 5);
  const criteria = buildCriteriaSummary(parsed);

  if (topMatches.length === 0) {
    return {
      reply: criteria.length > 0
        ? `I couldn’t find any sessions matching ${criteria.join(", ")}. Try another month, region, facilitator, or a simpler topic phrase.`
        : "I couldn’t find a good match for that yet. Try including a month, geo, facilitator, or a program topic.",
      matches: [],
      parsed,
    };
  }

  const countIntent = /how many|count|number of/i.test(trimmed);
  const lead = countIntent
    ? `I found ${matches.length} matching sessions${criteria.length > 0 ? ` for ${criteria.join(", ")}` : ""}.`
    : `I found ${matches.length} relevant sessions${criteria.length > 0 ? ` for ${criteria.join(", ")}` : ""}. Here are the top matches.`;

  const examples = topMatches
    .slice(0, 3)
    .map((session) => `${session.programName} (${session.geo ?? "Global"}${session.dateISO ? `, ${session.dateISO}` : ""})`)
    .join("; ");

  return {
    reply: examples ? `${lead} ${examples}.` : lead,
    matches: topMatches,
    parsed,
  };
}