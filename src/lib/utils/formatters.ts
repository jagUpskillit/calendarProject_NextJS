/** Format an ISO date string to a readable label, e.g. "14 May 2026" */
export function formatDate(iso?: string): string {
  if (!iso) return "TBD";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Truncate text to maxLen chars, adding ellipsis */
export function truncate(text: string, maxLen = 120): string {
  return text.length > maxLen ? text.slice(0, maxLen).trimEnd() + "…" : text;
}
