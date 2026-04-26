/**
 * SessionRepository.ts — Data access abstraction for training sessions.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  This interface is the ONLY contract that UI/pages depend on.   │
 * │  Swap the implementation to change the backing data source.     │
 * │    Current → browser import storage                             │
 * │    Next    → SharePointSessionRepository  (MS Graph / SP REST)  │
 * │    Later   → DataverseSessionRepository   (Power Platform)      │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * All methods are async to keep the interface compatible with local or
 * remote data sources.
 */

import type { Session, SessionFilter, SessionSort } from "@/types";

export interface SessionRepository {
  /**
   * Return every session in the store.
   * Must never throw — return an empty array on any error.
   */
  getAll(): Promise<Session[]>;

  /**
   * Look up a single session by its stable id.
   * Returns undefined (not an exception) when the id is not found.
   */
  getById(id: string): Promise<Session | undefined>;

  /**
   * Return sessions that match the given filter criteria, sorted by the
   * given sort spec.
   *
   * @param filter  - Narrowing criteria; undefined / {} returns all sessions.
   * @param sort    - Sort field + direction; defaults to date ascending.
   */
  search(filter?: SessionFilter, sort?: SessionSort): Promise<Session[]>;

  /**
   * Return sessions "related" to the given session.
   *
   * Relatedness algorithm (any of):
   *   1. Same geo
   *   2. Same facilitator
   *   3. Overlapping tags
   *
   * The source session itself is excluded from results.
   *
   * @param sessionId - id of the reference session
   * @param limit     - maximum results to return (default 5)
   */
  getRelated(sessionId: string, limit?: number): Promise<Session[]>;

  /**
   * Return the distinct set of values for a given facet field.
   * Used to populate filter dropdown options dynamically.
   *
   * @param facet - which field to enumerate
   */
  getFacetValues(
    facet: "geo" | "targetAudience" | "facilitator" | "capability" | "deliveryMode"
  ): Promise<string[]>;
}
