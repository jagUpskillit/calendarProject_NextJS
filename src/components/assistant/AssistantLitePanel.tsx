"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Session } from "@/types";
import { formatDate } from "@/lib/utils/formatters";

interface Props {
  sessions: Session[];
}

interface ParsedQuery {
  geo?: string;
  month?: string;
  facilitator?: string;
  keywords: string[];
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function parseQuery(input: string, sessions: Session[]): ParsedQuery {
  const lower = input.toLowerCase();
  const tokens = lower.split(/\s+/).filter(Boolean);

  const geos = [...new Set(sessions.map((s) => s.geo).filter((x): x is string => !!x))];
  const facilitators = [...new Set(sessions.map((s) => s.facilitator).filter((x): x is string => !!x))];

  const geo = geos.find((g) => lower.includes(g.toLowerCase()));

  const monthName = MONTH_NAMES.find((m) => lower.includes(m));
  const month = monthName ? `${new Date().getFullYear()}-${String(MONTH_NAMES.indexOf(monthName) + 1).padStart(2, "0")}` : undefined;

  const facilitator = facilitators.find((f) => lower.includes(f.toLowerCase()));

  const stopwords = new Set(["sessions", "session", "in", "for", "show", "find", "training"]);
  const keywords = tokens.filter((t) => !stopwords.has(t) && !MONTH_NAMES.includes(t));

  return { geo, month, facilitator, keywords };
}

function scoreSession(session: Session, parsed: ParsedQuery): number {
  let score = 0;

  if (parsed.geo && session.geo === parsed.geo) score += 5;
  if (parsed.month && session.dateISO?.startsWith(parsed.month)) score += 4;
  if (parsed.facilitator && session.facilitator === parsed.facilitator) score += 5;

  const blob = [
    session.programName,
    session.objectives ?? "",
    session.facilitator ?? "",
    session.capability ?? "",
    ...(session.tags ?? []),
  ].join(" ").toLowerCase();

  for (const kw of parsed.keywords) {
    if (blob.includes(kw)) score += 2;
  }

  return score;
}

export function AssistantLitePanel({ sessions }: Props) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");

  const parsed = useMemo(() => parseQuery(submitted, sessions), [submitted, sessions]);

  const suggestions = useMemo(() => {
    if (!submitted.trim()) return [] as Session[];
    return sessions
      .map((session) => ({ session, score: scoreSession(session, parsed) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((x) => x.session);
  }, [sessions, parsed, submitted]);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Assistant-lite</h2>
      <p className="mt-1 text-sm text-gray-600">
        Ask in plain text (example: <span className="font-medium">India May sessions</span>) and get matching sessions.
      </p>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query.trim());
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try: India May sessions"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Ask
        </button>
      </form>

      {submitted && (
        <div className="mt-3 text-xs text-gray-500">
          Parsed filters: {parsed.geo ? `Geo=${parsed.geo}; ` : ""}
          {parsed.month ? `Month=${parsed.month}; ` : ""}
          {parsed.facilitator ? `Facilitator=${parsed.facilitator}; ` : ""}
          {parsed.keywords.length > 0 ? `Keywords=${parsed.keywords.join(", ")}` : "Keywords=none"}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {!submitted ? (
          <p className="text-sm text-gray-500">Submit a query to see suggestions.</p>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-gray-500">No matching sessions found.</p>
        ) : (
          suggestions.map((s) => (
            <Link
              key={s.id}
              href={`/sessions/${s.id}`}
              className="block rounded-md border border-gray-200 p-3 hover:border-indigo-300 hover:bg-indigo-50/40"
            >
              <p className="text-sm font-medium text-gray-900">{s.programName}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                {s.geo ?? "Global"} · {s.facilitator ?? "TBD"} · {formatDate(s.dateISO)}
              </p>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
