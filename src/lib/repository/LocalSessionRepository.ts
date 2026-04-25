/**
 * LocalSessionRepository.ts
 *
 * Concrete implementation of SessionRepository that reads from a static JSON
 * file bundled under /public/data/sessions.json.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PHASE 2 SWAP GUIDE
 * To move to SharePoint / Dataverse:
 *   1. Create `SharePointSessionRepository implements SessionRepository`.
 *   2. Replace the `fetch('/data/sessions.json')` call with MS Graph or
 *      SharePoint REST API calls inside `_loadAll()`.
 *   3. Update the singleton export in `src/lib/repository/index.ts`.
 *   No UI or page files need to change.
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { Session, SessionFilter, SessionSort } from "@/types";
import type { SessionRepository } from "./SessionRepository";
import {
  applyFilter,
  applySort,
  relatednessScore,
  inferDeliveryMode,
  deriveTags,
  parseBatchSize,
  extractUrl,
  parseDateISO,
  buildSessionId,
} from "@/lib/utils/dataUtils";

// ---------------------------------------------------------------------------
// Raw JSON shape (what lives in public/data/sessions.json)
// ---------------------------------------------------------------------------

/**
 * Mirrors the JSON structure exactly.  Every field is unknown / optional so
 * the normaliser can cope with hand-edited or Excel-exported data without
 * crashing.
 */
interface RawSession {
  id?: unknown;
  programName?: unknown;
  objectives?: unknown;
  formatDuration?: unknown;
  deliveryMode?: unknown;
  facilitator?: unknown;
  scheduleRaw?: unknown;
  dateISO?: unknown;
  geo?: unknown;
  location?: unknown;
  targetAudience?: unknown;
  batchSize?: unknown;
  registrationLink?: unknown;
  notes?: unknown;
  capability?: unknown;
  tags?: unknown;
  rating?: unknown;
  recordingLink?: unknown;
}

// ---------------------------------------------------------------------------
// Normaliser
// ---------------------------------------------------------------------------

/**
 * Convert one raw JSON record into a well-typed Session.
 * Never throws — falls back to safe defaults for every field.
 */
function normalise(raw: RawSession, index: number): Session {
  const programName =
    typeof raw.programName === "string" && raw.programName.trim()
      ? raw.programName.trim()
      : `Unnamed Session ${index + 1}`;

  // Prefer an explicit dateISO from JSON; fall back to parsing scheduleRaw
  const dateISO =
    typeof raw.dateISO === "string" && raw.dateISO.trim()
      ? raw.dateISO.trim()
      : parseDateISO(typeof raw.scheduleRaw === "string" ? raw.scheduleRaw : undefined);

  const geo = typeof raw.geo === "string" ? raw.geo.trim() || undefined : undefined;

  // Stable id: use what's in the JSON if it looks valid, else derive one
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : buildSessionId(programName, dateISO, geo);

  const formatDuration =
    typeof raw.formatDuration === "string" ? raw.formatDuration.trim() || undefined : undefined;
  const location =
    typeof raw.location === "string" ? raw.location.trim() || undefined : undefined;

  // Delivery mode: trust JSON if valid, else infer
  const validModes = new Set(["Virtual", "In-Person", "Hybrid", "Unknown"]);
  const deliveryMode =
    typeof raw.deliveryMode === "string" && validModes.has(raw.deliveryMode)
      ? (raw.deliveryMode as Session["deliveryMode"])
      : inferDeliveryMode(formatDuration, location);

  // Registration link: extract URL from any string value
  let registrationLink: string | null | undefined;
  if (raw.registrationLink === null) {
    registrationLink = null;
  } else if (typeof raw.registrationLink === "string") {
    registrationLink = extractUrl(raw.registrationLink) ?? null;
  } else if (raw.registrationLink === undefined) {
    registrationLink = undefined;
  } else {
    registrationLink = null;
  }

  const capability =
    typeof raw.capability === "string" ? raw.capability.trim() || undefined : undefined;

  const targetAudience =
    typeof raw.targetAudience === "string" ? raw.targetAudience.trim() || undefined : undefined;

  // Tags: use JSON array if valid, else derive
  const tags: string[] =
    Array.isArray(raw.tags) && raw.tags.every((t) => typeof t === "string")
      ? (raw.tags as string[])
      : deriveTags(programName, geo, targetAudience, capability);

  // Rating
  const rating =
    typeof raw.rating === "number" && Number.isFinite(raw.rating)
      ? Math.min(5, Math.max(0, raw.rating))
      : null;

  // Recording link
  const recordingLink =
    typeof raw.recordingLink === "string" ? extractUrl(raw.recordingLink) : null;

  return {
    id,
    programName,
    objectives:
      typeof raw.objectives === "string" ? raw.objectives.trim() || undefined : undefined,
    formatDuration,
    deliveryMode,
    facilitator:
      typeof raw.facilitator === "string" ? raw.facilitator.trim() || undefined : undefined,
    scheduleRaw:
      typeof raw.scheduleRaw === "string" ? raw.scheduleRaw.trim() || undefined : undefined,
    dateISO,
    geo,
    location,
    targetAudience,
    batchSize: parseBatchSize(raw.batchSize as string | number | null | undefined),
    registrationLink,
    notes: typeof raw.notes === "string" ? raw.notes.trim() || undefined : undefined,
    capability,
    tags,
    rating,
    recordingLink,
  };
}

// ---------------------------------------------------------------------------
// LocalSessionRepository
// ---------------------------------------------------------------------------

export class LocalSessionRepository implements SessionRepository {
  /** In-memory cache so we only fetch+parse once per page lifecycle */
  private cache: Session[] | null = null;

  /** Data source URL — override in tests or alternate environments */
  private readonly dataUrl: string;

  constructor(dataUrl = "/data/sessions.json") {
    this.dataUrl = dataUrl;
  }

  // ── private ──────────────────────────────────────────────────────────────

  private async _loadAll(): Promise<Session[]> {
    if (this.cache) return this.cache;

    try {
      const res = await fetch(this.dataUrl, {
        // Next.js static asset — no caching headers needed
        cache: "no-store",
      });
      if (!res.ok) {
        console.error(`[LocalSessionRepository] HTTP ${res.status} fetching ${this.dataUrl}`);
        this.cache = [];
        return [];
      }
      const raw: unknown = await res.json();
      if (!Array.isArray(raw)) {
        console.error("[LocalSessionRepository] Expected JSON array, got:", typeof raw);
        this.cache = [];
        return [];
      }
      this.cache = (raw as RawSession[]).map((r, i) => normalise(r, i));
    } catch (err) {
      console.error("[LocalSessionRepository] Failed to load sessions:", err);
      this.cache = [];
    }
    return this.cache!;
  }

  // ── SessionRepository interface ───────────────────────────────────────────

  async getAll(): Promise<Session[]> {
    return this._loadAll();
  }

  async getById(id: string): Promise<Session | undefined> {
    const all = await this._loadAll();
    return all.find((s) => s.id === id);
  }

  async search(filter?: SessionFilter, sort?: SessionSort): Promise<Session[]> {
    const all = await this._loadAll();
    const filtered = filter ? applyFilter(all, filter) : all;
    return applySort(filtered, sort);
  }

  async getRelated(sessionId: string, limit = 5): Promise<Session[]> {
    const all = await this._loadAll();
    const source = all.find((s) => s.id === sessionId);
    if (!source) return [];

    return all
      .filter((s) => s.id !== sessionId)
      .map((s) => ({ session: s, score: relatednessScore(source, s) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ session }) => session);
  }

  async getFacetValues(
    facet: "geo" | "targetAudience" | "facilitator" | "capability" | "deliveryMode"
  ): Promise<string[]> {
    const all = await this._loadAll();
    const values = all
      .map((s) => s[facet])
      .filter((v): v is string => typeof v === "string" && v.trim() !== "");
    return [...new Set(values)].sort();
  }
}
