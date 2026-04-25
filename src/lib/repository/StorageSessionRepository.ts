import type { Session, SessionFilter, SessionSort } from "@/types";
import { applyFilter, applySort, relatednessScore } from "@/lib/utils/dataUtils";
import type { SessionRepository } from "./SessionRepository";
import { CalendarStorage } from "@/lib/storage/CalendarStorage";

/**
 * StorageSessionRepository
 *
 * Priority order:
 *  1) Imported sessions from CalendarStorage (localStorage)
 *  2) Fallback repository (bundled sample JSON)
 */
export class StorageSessionRepository implements SessionRepository {
  constructor(
    private readonly storage: CalendarStorage,
    private readonly fallbackRepository: SessionRepository
  ) {}

  private async loadPreferredSessions(): Promise<Session[]> {
    const imported = this.storage.loadSessions();
    if (imported.length > 0) return imported;
    return this.fallbackRepository.getAll();
  }

  async getAll(): Promise<Session[]> {
    return this.loadPreferredSessions();
  }

  async getById(id: string): Promise<Session | undefined> {
    const all = await this.loadPreferredSessions();
    return all.find((s) => s.id === id);
  }

  async search(filter?: SessionFilter, sort?: SessionSort): Promise<Session[]> {
    const all = await this.loadPreferredSessions();
    const filtered = filter ? applyFilter(all, filter) : all;
    return applySort(filtered, sort);
  }

  async getRelated(sessionId: string, limit = 5): Promise<Session[]> {
    const all = await this.loadPreferredSessions();
    const source = all.find((s) => s.id === sessionId);
    if (!source) return [];

    return all
      .filter((s) => s.id !== sessionId)
      .map((session) => ({ session, score: relatednessScore(source, session) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.session);
  }

  async getFacetValues(
    facet: "geo" | "targetAudience" | "facilitator" | "capability" | "deliveryMode"
  ): Promise<string[]> {
    const all = await this.loadPreferredSessions();
    const values = all
      .map((s) => s[facet])
      .filter((v): v is string => typeof v === "string" && v.trim() !== "");
    return [...new Set(values)].sort();
  }
}
