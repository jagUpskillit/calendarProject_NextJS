import type {
  CalendarDataBundle,
  FacilitatorMaster,
  GeoMaster,
  HolidayMaster,
  ImportMetadata,
  PlanningCycle,
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
  capabilityMasters: "calendarproject_v1.import.capabilityMasters",
  planningCycles: "calendarproject_v1.import.planningCycles",
  activePlanningCycleId: "calendarproject_v1.import.activePlanningCycleId",
  metadata: "calendarproject_v1.import.metadata",
};


function quarterLabel(monthIndex: number): "Q1" | "Q2" | "Q3" | "Q4" {
  if (monthIndex < 3) return "Q1";
  if (monthIndex < 6) return "Q2";
  if (monthIndex < 9) return "Q3";
  return "Q4";
}

function buildQuarterRange(year: number, quarter: "Q1" | "Q2" | "Q3" | "Q4") {
  const quarterStartMonth: Record<"Q1" | "Q2" | "Q3" | "Q4", number> = {
    Q1: 0,
    Q2: 3,
    Q3: 6,
    Q4: 9,
  };
  const startMonth = quarterStartMonth[quarter];
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function buildDefaultPlanningCycles(referenceDate = new Date()): PlanningCycle[] {
  const currentYear = referenceDate.getUTCFullYear();
  const currentQuarter = quarterLabel(referenceDate.getUTCMonth());
  const quarterOrder: Array<"Q1" | "Q2" | "Q3" | "Q4"> = ["Q1", "Q2", "Q3", "Q4"];

  return quarterOrder.map((quarter) => {
    const { startDate, endDate } = buildQuarterRange(currentYear, quarter);
    return {
      id: `${quarter}-${currentYear}`,
      label: `${quarter} ${currentYear}`,
      startDate,
      endDate,
      isActive: quarter === currentQuarter,
      isArchived: false,
    };
  });
}


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
  private getSelectableCycles(cycles: PlanningCycle[]): PlanningCycle[] {
    return cycles.filter((cycle) => !cycle.isArchived);
  }

  private normalizePlanningCycles(cycles: PlanningCycle[]): PlanningCycle[] {
    return cycles.map((cycle) => ({
      ...cycle,
      isArchived: Boolean(cycle.isArchived),
    }));
  }

  private normalizeProgramCycles(program: ProgramMaster, activeCycleId: string): ProgramMaster {
    const uniqueCycleIds = Array.isArray(program.planningCycleIds)
      ? Array.from(new Set(program.planningCycleIds.map((item) => item.trim()).filter(Boolean)))
      : [];

    return {
      ...program,
      planningCycleIds: uniqueCycleIds.length > 0 ? uniqueCycleIds : [activeCycleId],
    };
  }

  private normalizeSessionCycle(session: Session, activeCycleId: string): Session {
    if (session.planningCycleId?.trim()) return session;
    return {
      ...session,
      planningCycleId: activeCycleId,
    };
  }

  // ...existing master methods...

  saveCapabilityMasters(items: { capabilityName: string }[]): void {
    ensureSchemaVersion();
    safeWrite(STORAGE_KEYS.capabilityMasters, items);
  }

  loadCapabilityMasters(): { capabilityName: string }[] {
    ensureSchemaVersion();
    const data = safeRead<unknown[]>(STORAGE_KEYS.capabilityMasters, []);
    return Array.isArray(data) ? (data as { capabilityName: string }[]) : [];
  }
  saveSessions(sessions: Session[]): void {
    ensureSchemaVersion();
    safeWrite(STORAGE_KEYS.sessions, sessions);
  }

  loadSessions(): Session[] {
    ensureSchemaVersion();
    const data = safeRead<unknown[]>(STORAGE_KEYS.sessions, []);
    if (!Array.isArray(data)) return [];
    const activeCycleId = this.getActivePlanningCycleId();
    return (data as Session[]).map((session) => this.normalizeSessionCycle(session, activeCycleId));
  }

  saveProgramMasters(items: ProgramMaster[]): void {
    ensureSchemaVersion();
    safeWrite(STORAGE_KEYS.programMasters, items);
  }

  loadProgramMasters(): ProgramMaster[] {
    ensureSchemaVersion();
    const data = safeRead<unknown[]>(STORAGE_KEYS.programMasters, []);
    if (!Array.isArray(data)) return [];
    const activeCycleId = this.getActivePlanningCycleId();
    return (data as ProgramMaster[]).map((program) =>
      this.normalizeProgramCycles(program, activeCycleId)
    );
  }

  savePlanningCycles(cycles: PlanningCycle[]): void {
    ensureSchemaVersion();
    safeWrite(STORAGE_KEYS.planningCycles, cycles);
  }

  loadPlanningCycles(): PlanningCycle[] {
    ensureSchemaVersion();
    const storedCycles = safeRead<unknown[]>(STORAGE_KEYS.planningCycles, []);
    if (Array.isArray(storedCycles) && storedCycles.length > 0) {
      return this.normalizePlanningCycles(storedCycles as PlanningCycle[]);
    }

    const defaults = buildDefaultPlanningCycles();
    this.savePlanningCycles(defaults);
    return defaults;
  }

  setActivePlanningCycleId(cycleId: string): void {
    ensureSchemaVersion();
    safeWrite(STORAGE_KEYS.activePlanningCycleId, cycleId);
  }

  getActivePlanningCycleId(): string {
    ensureSchemaVersion();
    const cycles = this.loadPlanningCycles();
    const selectableCycles = this.getSelectableCycles(cycles);
    const stored = safeRead<string | null>(STORAGE_KEYS.activePlanningCycleId, null);

    if (stored && selectableCycles.some((cycle) => cycle.id === stored)) {
      return stored;
    }

    const active =
      selectableCycles.find((cycle) => cycle.isActive) ??
      selectableCycles[0] ??
      cycles[0];
    if (!active) return "Q2-2026";
    this.setActivePlanningCycleId(active.id);
    return active.id;
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
