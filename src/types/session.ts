/**
 * session.ts — Core domain types for the Quarterly Calendar Explorer.
 *
 * Design principle: every field that may be absent in real-world Excel/CSV
 * exports is typed as optional so the app never crashes on dirty input.
 *
 * Data-source swap note (Phase 2):
 *   Only the repository implementation changes when moving from local JSON
 *   to SharePoint / Dataverse.  These types remain the single source of truth.
 */

export type ImportSourceType = "becog" | "planning" | "sample";

export interface SessionSource {
  type: ImportSourceType;
  fileName: string;
  sheetName?: string;
  rowNumber?: number;
}

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/** Inferred from formatDuration / location text */
export type DeliveryMode = "Virtual" | "In-Person" | "Hybrid" | "Unknown";

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/**
 * A single training session as understood by the application layer.
 * Raw source values (CSV / Excel) are normalised into this shape by the
 * repository before being returned to any UI component.
 */
export interface Session {
  /**
   * Stable, URL-safe unique identifier.
   * Derived by: slugify(programName + dateISO + geo) + short hash suffix.
   */
  id: string;

  /** Full program / training title — only guaranteed field */
  programName: string;

  /** What participants will learn / overall learning objectives */
  objectives?: string;

  /** Raw format & duration string, e.g. "ILT | 4 hours" or "VILT – 90 min" */
  formatDuration?: string;

  /** Delivery mode inferred from formatDuration + location text */
  deliveryMode: DeliveryMode;

  /** Facilitator name(s), may be comma-separated */
  facilitator?: string;

  /**
   * Original schedule string verbatim from source.
   * Kept for display when exact ISO parse is not possible, e.g.:
   * "May 14 | 10 AM IST / 6:30 AM CET / 9 AM GST"
   */
  scheduleRaw?: string;

  /**
   * ISO 8601 date (YYYY-MM-DD).
   * Derived by best-effort parsing of scheduleRaw / dedicated date column.
   * Undefined when the schedule text is too ambiguous to parse confidently.
   */
  dateISO?: string;

  /** Geographic region — e.g. "India", "US", "EMEA", "APAC", "Global" */
  geo?: string;

  /** Physical / virtual location string, e.g. "Bangalore – Room 3 / MS Teams" */
  location?: string;

  /** Intended audience, e.g. "Senior Associates", "All Associates", "TL+" */
  targetAudience?: string;

  /**
   * Maximum seat capacity.
   * null  → value was present but unparseable as a number.
   * undefined → column was absent from source.
   */
  batchSize?: number | null;

  /**
   * Registration or LMS URL.
   * null      → column was present but no URL could be extracted.
   * undefined → column was absent from source.
   * string    → valid URL ready to open in a new tab.
   */
  registrationLink?: string | null;

  /** Free-text notes / comments from source */
  notes?: string;

  /** Capability / competency area, e.g. "Cloud", "Data & AI", "Leadership" */
  capability?: string;

  /** Planning cycle identifier, e.g. "Q2-2026" */
  planningCycleId?: string;

  /**
   * Taxonomy tags for search and filtering.
   * Auto-derived from geo, targetAudience, capability, and programName words.
   */
  tags?: string[];

  /**
   * Peer / trainer rating (0–5 scale).
   * Populated from a ratings source in Phase 2; null until then.
   */
  rating?: number | null;

  /**
   * URL to session recording (populated after session has taken place).
   * Used for "missed session" support flow.
   */
  recordingLink?: string | null;

  /** Provenance of this row (sample import, Be.Cognizant sheet, planning sheet, etc.) */
  source?: SessionSource;
}

// ---------------------------------------------------------------------------
// Filter / Search value objects
// ---------------------------------------------------------------------------

/** All parameters that can narrow a session query */
export interface SessionFilter {
  /** Free-text — matched against programName, facilitator, objectives */
  query?: string;
  geo?: string;
  targetAudience?: string;
  deliveryMode?: DeliveryMode;
  facilitator?: string;
  capability?: string;
  /** "YYYY-MM" — returns sessions whose dateISO falls in this month */
  month?: string;
  /** ISO date — sessions on or after this date */
  dateFrom?: string;
  /** ISO date — sessions on or before this date */
  dateTo?: string;
}

export type SortField = "date" | "name";
export type SortOrder = "asc" | "desc";

export interface SessionSort {
  field: SortField;
  order: SortOrder;
}
