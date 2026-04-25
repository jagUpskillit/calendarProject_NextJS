import type {
  CalendarDataBundle,
  FacilitatorMaster,
  GeoMaster,
  HolidayMaster,
  ImportMetadata,
  ProgramMaster,
  Session,
} from "@/types";

const CURRENT_SCHEMA_VERSION = 1;

const STORAGE_KEYS = {
  schemaVersion: "calendarproject_v1.import.schemaVersion",
  sessions: "calendarproject_v1.import.sessions",
  programMasters: "calendarproject_v1.import.programMasters",
  facilitatorMasters: "calendarproject_v1.import.facilitatorMasters",
  geoMasters: "calendarproject_v1.import.geoMasters",
  holidayMasters: "calendarproject_v1.import.holidayMasters",
  metadata: "calendarproject_v1.import.metadata",
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function safeRead<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  return safeParse<T>(window.localStorage.getItem(key), fallback);
}

function ensureSchemaVersion(): void {
  if (!canUseStorage()) return;

  const existingRaw = window.localStorage.getItem(STORAGE_KEYS.schemaVersion);
  const existing = existingRaw ? Number(existingRaw) : null;

  if (existing === CURRENT_SCHEMA_VERSION) return;

  // Version missing or mismatched: clear import-related keys and set fresh version.
  Object.values(STORAGE_KEYS).forEach((key) => window.localStorage.removeItem(key));
  window.localStorage.setItem(STORAGE_KEYS.schemaVersion, String(CURRENT_SCHEMA_VERSION));
}

export class CalendarStorage {
  saveSessions(sessions: Session[]): void {
    ensureSchemaVersion();
    safeWrite(STORAGE_KEYS.sessions, sessions);
  }

  loadSessions(): Session[] {
    ensureSchemaVersion();
    const data = safeRead<unknown[]>(STORAGE_KEYS.sessions, []);
    return Array.isArray(data) ? (data as Session[]) : [];
  }

  saveProgramMasters(items: ProgramMaster[]): void {
    ensureSchemaVersion();
    safeWrite(STORAGE_KEYS.programMasters, items);
  }

  loadProgramMasters(): ProgramMaster[] {
    ensureSchemaVersion();
    const data = safeRead<unknown[]>(STORAGE_KEYS.programMasters, []);
    return Array.isArray(data) ? (data as ProgramMaster[]) : [];
  }

  saveFacilitatorMasters(items: FacilitatorMaster[]): void {
    ensureSchemaVersion();
    safeWrite(STORAGE_KEYS.facilitatorMasters, items);
  }

  loadFacilitatorMasters(): FacilitatorMaster[] {
    ensureSchemaVersion();
    const data = safeRead<unknown[]>(STORAGE_KEYS.facilitatorMasters, []);
    return Array.isArray(data) ? (data as FacilitatorMaster[]) : [];
  }

  saveGeoMasters(items: GeoMaster[]): void {
    ensureSchemaVersion();
    safeWrite(STORAGE_KEYS.geoMasters, items);
  }

  loadGeoMasters(): GeoMaster[] {
    ensureSchemaVersion();
    const data = safeRead<unknown[]>(STORAGE_KEYS.geoMasters, []);
    return Array.isArray(data) ? (data as GeoMaster[]) : [];
  }

  saveHolidayMasters(items: HolidayMaster[]): void {
    ensureSchemaVersion();
    safeWrite(STORAGE_KEYS.holidayMasters, items);
  }

  loadHolidayMasters(): HolidayMaster[] {
    ensureSchemaVersion();
    const data = safeRead<unknown[]>(STORAGE_KEYS.holidayMasters, []);
    return Array.isArray(data) ? (data as HolidayMaster[]) : [];
  }

  saveMetadata(metadata: ImportMetadata): void {
    ensureSchemaVersion();
    safeWrite(STORAGE_KEYS.metadata, metadata);
  }

  loadMetadata(): ImportMetadata | null {
    ensureSchemaVersion();
    const data = safeRead<ImportMetadata | null>(STORAGE_KEYS.metadata, null);
    return data;
  }

  saveBundle(bundle: CalendarDataBundle): void {
    this.saveSessions(bundle.sessions);
    this.saveProgramMasters(bundle.programMasters);
    this.saveFacilitatorMasters(bundle.facilitatorMasters);
    this.saveGeoMasters(bundle.geoMasters);
    this.saveHolidayMasters(bundle.holidayMasters);
    this.saveMetadata(bundle.metadata);
  }

  loadBundle(): CalendarDataBundle | null {
    const sessions = this.loadSessions();
    const metadata = this.loadMetadata();
    if (!sessions.length || !metadata) return null;

    return {
      sessions,
      programMasters: this.loadProgramMasters(),
      facilitatorMasters: this.loadFacilitatorMasters(),
      geoMasters: this.loadGeoMasters(),
      holidayMasters: this.loadHolidayMasters(),
      metadata,
    };
  }

  hasImportedSessions(): boolean {
    return this.loadSessions().length > 0;
  }

  clearAll(): void {
    if (!canUseStorage()) return;
    Object.values(STORAGE_KEYS).forEach((key) => window.localStorage.removeItem(key));
    window.localStorage.setItem(STORAGE_KEYS.schemaVersion, String(CURRENT_SCHEMA_VERSION));
  }
}

export const calendarStorage = new CalendarStorage();
