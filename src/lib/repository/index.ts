/**
 * Singleton accessor for repositories.
 *
 * PHASE 2 SWAP: change the import of LocalSessionRepository to your new
 * implementation here. All consumers remain untouched.
 */
import { LocalSessionRepository } from "./LocalSessionRepository";
import { StorageSessionRepository } from "./StorageSessionRepository";
import { calendarStorage } from "@/lib/storage/CalendarStorage";
import type { SessionRepository } from "./SessionRepository";

export type { SessionRepository } from "./SessionRepository";
export type { SupportTicketRepository } from "./SupportTicketRepository";
export { LocalSessionRepository } from "./LocalSessionRepository";
export { StorageSessionRepository } from "./StorageSessionRepository";

const sampleRepository = new LocalSessionRepository();

let cachedRepository: SessionRepository | null = null;

/**
 * Returns a session repository instance.
 *
 * Browser: prefers imported sessions from localStorage, falls back to sample JSON.
 * Server: uses sample JSON (server cannot read browser localStorage).
 */
export function getSessionRepository(): SessionRepository {
	if (cachedRepository) return cachedRepository;

	cachedRepository =
		typeof window !== "undefined"
			? new StorageSessionRepository(calendarStorage, sampleRepository)
			: sampleRepository;

	return cachedRepository;
}

/** Backward-compatible singleton-style export */
export const sessionRepository: SessionRepository = getSessionRepository();
