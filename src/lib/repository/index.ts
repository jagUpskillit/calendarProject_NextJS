/**
 * Singleton accessor for repositories.
 *
 * The app now reads imported browser storage only and surfaces empty states
 * when no import has been performed yet.
 */
import { StorageSessionRepository } from "./StorageSessionRepository";
import { calendarStorage } from "@/lib/storage/CalendarStorage";
import type { SessionRepository } from "./SessionRepository";

export type { SessionRepository } from "./SessionRepository";
export type { SupportTicketRepository } from "./SupportTicketRepository";
export { StorageSessionRepository } from "./StorageSessionRepository";

let cachedRepository: SessionRepository | null = null;

/**
 * Returns a session repository instance.
 *
 * Browser and server: use imported-session storage only.
 */
export function getSessionRepository(): SessionRepository {
	if (cachedRepository) return cachedRepository;

	cachedRepository = new StorageSessionRepository(calendarStorage);

	return cachedRepository;
}

/** Backward-compatible singleton-style export */
export const sessionRepository: SessionRepository = getSessionRepository();
