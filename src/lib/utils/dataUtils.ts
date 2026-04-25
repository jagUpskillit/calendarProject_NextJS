/**
 * dataUtils.ts — Pure parsing & normalisation utilities.
 *
 * Rules:
 *  - No function throws.  All return safe defaults on bad input.
 *  - All functions are side-effect free and independently unit-testable.
 *  - No framework dependencies — plain TypeScript only.
 */

import type { DeliveryMode, Session, SessionFilter, SessionSort } from "@/types";

// ---------------------------------------------------------------------------
// ID / slug helpers
// ---------------------------------------------------------------------------

/**
 * Convert arbitrary text to a URL-safe lowercase slug.
 * "Cloud Foundations – India" → "cloud-foundations-india"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Build a stable session id from programName + optional date + optional geo.
 * Appends a 6-char hex hash to minimise collisions on short/identical slugs.
 */
export function buildSessionId(
  programName: string,
  dateISO?: string,
  geo?: string
): string {
  const parts = [programName, dateISO, geo].filter(Boolean) as string[];
  const combined = parts.join("|");
  return `${slugify(combined)}-${djb2Hex(combined)}`;
}

/** djb2-style 32-bit hash → 6-char lowercase hex */
function djb2Hex(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0").slice(0, 6);
}

// ---------------------------------------------------------------------------
// URL extraction
// ---------------------------------------------------------------------------

const URL_RE = /https?:\/\/[^\s"'<>()[\]]+/i;

/**
 * Extract the first HTTP/HTTPS URL from a text string.
 * Strips trailing punctuation that may bleed in from CSV cells.
 * Returns null if nothing is found.
 */
export function extractUrl(text?: string | null): string | null {
  if (!text) return null;
  const m = text.match(URL_RE);
  return m ? m[0].replace(/[.,;)\]]+$/, "") : null;
}

// ---------------------------------------------------------------------------
// Batch size
// ---------------------------------------------------------------------------

/**
 * Parse a seat-count-like string to an integer.
 * Handles: "25", "~30", "Max 20", "15–20 pax".
 * Returns null if the value cannot be reliably parsed.
 */
export function parseBatchSize(raw?: string | number | null): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.round(raw) : null;
  const m = raw.toString().match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------

const MONTH_MAP: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
  jan: "01", feb: "02", mar: "03", apr: "04",
  jun: "06", jul: "07", aug: "08",
  sep: "09", oct: "10", nov: "11", dec: "12",
};

/**
 * Attempt to derive an ISO date string (YYYY-MM-DD) from raw schedule text.
 * Returns undefined when no confident parse is possible.
 *
 * Recognised patterns:
 *   "2026-05-14"          → ISO passthrough
 *   "14 May 2026"         → day-month-year
 *   "May 14, 2026"        → month-day-year
 *   "14/05/2026"          → DD/MM/YYYY
 */
export function parseDateISO(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const s = raw.toString();

  // ISO already
  const iso = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // "14 May 2026"
  const dmy = s.match(
    /\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{4})\b/i
  );
  if (dmy) {
    const mon = MONTH_MAP[dmy[2].toLowerCase()];
    return `${dmy[3]}-${mon}-${dmy[1].padStart(2, "0")}`;
  }

  // "May 14, 2026"
  const mdy = s.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})\b/i
  );
  if (mdy) {
    const mon = MONTH_MAP[mdy[1].toLowerCase()];
    return `${mdy[3]}-${mon}-${mdy[2].padStart(2, "0")}`;
  }

  // "14/05/2026" (DD/MM/YYYY)
  const slash = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slash) return `${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;

  return undefined;
}

// ---------------------------------------------------------------------------
// Delivery mode inference
// ---------------------------------------------------------------------------

/**
 * Infer delivery mode from format/duration text and location string.
 */
export function inferDeliveryMode(
  formatDuration?: string,
  location?: string
): DeliveryMode {
  const s = `${formatDuration ?? ""} ${location ?? ""}`.toLowerCase();
  if (/hybrid/.test(s)) return "Hybrid";
  if (/virtual|online|teams|zoom|webex|vilt/.test(s)) return "Virtual";
  if (/in.?person|classroom|\bilt\b|face.?to.?face|\bf2f\b/.test(s)) return "In-Person";
  return "Unknown";
}

// ---------------------------------------------------------------------------
// Tag derivation
// ---------------------------------------------------------------------------

/**
 * Auto-derive lowercase taxonomy tags from available fields.
 */
export function deriveTags(
  programName: string,
  geo?: string,
  targetAudience?: string,
  capability?: string
): string[] {
  const raw: string[] = [];
  if (geo) raw.push(geo.trim());
  if (targetAudience) raw.push(targetAudience.trim());
  if (capability) raw.push(capability.trim());
  // Capitalised content words from program name
  const words = programName.match(/[A-Z][a-z]{2,}/g) ?? [];
  raw.push(...words);
  return [...new Set(raw.map((t) => t.toLowerCase()))].filter(Boolean);
}

// ---------------------------------------------------------------------------
// In-memory filter + sort helpers (used by LocalSessionRepository)
// ---------------------------------------------------------------------------

/** Case-insensitive substring check */
function ci(haystack: string | undefined, needle: string): boolean {
  return (haystack ?? "").toLowerCase().includes(needle.toLowerCase());
}

/**
 * Apply a SessionFilter to an array of sessions.
 * Returns a new filtered array; original is not mutated.
 */
export function applyFilter(sessions: Session[], filter: SessionFilter): Session[] {
  return sessions.filter((s) => {
    if (filter.query) {
      const q = filter.query;
      if (!ci(s.programName, q) && !ci(s.facilitator, q) && !ci(s.objectives, q)) {
        return false;
      }
    }
    if (filter.geo && !ci(s.geo, filter.geo)) return false;
    if (filter.targetAudience && !ci(s.targetAudience, filter.targetAudience)) return false;
    if (filter.facilitator && !ci(s.facilitator, filter.facilitator)) return false;
    if (filter.capability && !ci(s.capability, filter.capability)) return false;
    if (filter.deliveryMode && s.deliveryMode !== filter.deliveryMode) return false;

    if (filter.month && s.dateISO) {
      if (!s.dateISO.startsWith(filter.month)) return false;
    }
    if (filter.dateFrom && s.dateISO) {
      if (s.dateISO < filter.dateFrom) return false;
    }
    if (filter.dateTo && s.dateISO) {
      if (s.dateISO > filter.dateTo) return false;
    }
    return true;
  });
}

/**
 * Sort an array of sessions in place by the given sort spec.
 * Defaults to date ascending; sessions without a dateISO sort to the end.
 */
export function applySort(sessions: Session[], sort?: SessionSort): Session[] {
  const field = sort?.field ?? "date";
  const dir = sort?.order === "desc" ? -1 : 1;

  return [...sessions].sort((a, b) => {
    if (field === "name") {
      return dir * a.programName.localeCompare(b.programName);
    }
    // date
    const da = a.dateISO ?? "9999-99-99";
    const db = b.dateISO ?? "9999-99-99";
    return dir * da.localeCompare(db);
  });
}

/**
 * Compute a simple "relatedness" score between two sessions.
 * Higher = more related.
 */
export function relatednessScore(a: Session, b: Session): number {
  let score = 0;
  if (a.geo && b.geo && a.geo === b.geo) score += 3;
  if (a.facilitator && b.facilitator && a.facilitator === b.facilitator) score += 3;
  if (a.capability && b.capability && a.capability === b.capability) score += 2;
  // Overlapping tags
  const aT = new Set(a.tags ?? []);
  (b.tags ?? []).forEach((t) => { if (aT.has(t)) score += 1; });
  return score;
}
