import type {
  FacilitatorMaster,
  GeoMaster,
  HolidayMaster,
  ImportMetadata,
  ProgramMaster,
  RawBeCogRow,
  Session,
} from "@/types";
import { inferDeliveryMode } from "@/lib/utils/dataUtils";
import { extractUrl } from "./extractUrl";
import { makeStableId } from "./makeStableId";
import { parseBatchSize } from "./parseBatchSize";
import { parseBestEffortDate } from "./parseBestEffortDate";

export interface NormalizeBeCogResult {
  sessions: Session[];
  masters: {
    programs: ProgramMaster[];
    facilitators: FacilitatorMaster[];
    geos: GeoMaster[];
  };
  metadata: ImportMetadata;
  warnings: string[];
}

function clean(value?: string): string | undefined {
  const v = value?.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  return v ? v : undefined;
}

function normalizeGeo(value?: string): string | undefined {
  const v = clean(value);
  if (!v) return undefined;
  return v.replace(/[\/|]+/g, ",").replace(/\s*,\s*/g, ", ").replace(/\s+/g, " ").trim();
}

function isCapabilityHeading(programName: string, row: RawBeCogRow): boolean {
  const nonEmpty = [
    row.objectives,
    row.formatDuration,
    row.facilitator,
    row.scheduleRaw,
    row.location,
    row.targetAudience,
    row.geo,
    row.batchSize,
    row.registrationLink,
    row.notes,
  ].filter((x) => clean(x)).length;

  return nonEmpty <= 1 && /^(demonstrate|develop|build|strengthen|drive)\b/i.test(programName);
}

function hash6(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = (((h << 5) + h) ^ text.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0").slice(0, 6);
}

function keyPart(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().replace(/\s+/g, " ").toLowerCase();
}

function makeSessionDuplicateKey(input: {
  baseId: string;
  facilitator?: string;
  location?: string;
  targetAudience?: string;
  scheduleRaw?: string;
  batchSize?: number | null;
}): string {
  return [
    input.baseId,
    keyPart(input.facilitator),
    keyPart(input.location),
    keyPart(input.targetAudience),
    keyPart(input.scheduleRaw),
    keyPart(input.batchSize),
  ].join("|");
}

function chooseString(current?: string, incoming?: string): string | undefined {
  if (!current && !incoming) return undefined;
  if (!current) return incoming;
  if (!incoming) return current;
  return incoming.length > current.length ? incoming : current;
}

function chooseNumber(current?: number | null, incoming?: number | null): number | null | undefined {
  if (typeof current === "number") return current;
  if (typeof incoming === "number") return incoming;
  if (current === null || incoming === null) return null;
  return undefined;
}

function chooseLink(current?: string | null, incoming?: string | null): string | null | undefined {
  if (typeof current === "string" && current) return current;
  if (typeof incoming === "string" && incoming) return incoming;
  if (current === null || incoming === null) return null;
  return undefined;
}

function mergeSessionDetails(existing: Session, incoming: Omit<Session, "id">): Session {
  return {
    ...existing,
    objectives: chooseString(existing.objectives, incoming.objectives),
    formatDuration: chooseString(existing.formatDuration, incoming.formatDuration),
    facilitator: chooseString(existing.facilitator, incoming.facilitator),
    scheduleRaw: chooseString(existing.scheduleRaw, incoming.scheduleRaw),
    dateISO: chooseString(existing.dateISO, incoming.dateISO),
    geo: chooseString(existing.geo, incoming.geo),
    location: chooseString(existing.location, incoming.location),
    targetAudience: chooseString(existing.targetAudience, incoming.targetAudience),
    batchSize: chooseNumber(existing.batchSize, incoming.batchSize),
    registrationLink: chooseLink(existing.registrationLink, incoming.registrationLink),
    notes: chooseString(existing.notes, incoming.notes),
  };
}

function makeUniqueSessionId(baseId: string, row: RawBeCogRow, seenIds: Set<string>): string {
  if (!seenIds.has(baseId)) {
    seenIds.add(baseId);
    return baseId;
  }

  const sourceSeed = [row.source.fileName, row.source.sheetName ?? "", row.source.rowNumber ?? "", row.scheduleRaw ?? ""]
    .join("|");
  const candidate = `${baseId}-${hash6(sourceSeed)}`;

  if (!seenIds.has(candidate)) {
    seenIds.add(candidate);
    return candidate;
  }

  let i = 2;
  while (seenIds.has(`${candidate}-${i}`)) {
    i++;
  }
  const resolved = `${candidate}-${i}`;
  seenIds.add(resolved);
  return resolved;
}

export function normalizeBeCogRows(
  rawRows: RawBeCogRow[],
  options?: {
    holidays?: HolidayMaster[];
    importedAtISO?: string;
  }
): NormalizeBeCogResult {
  const warnings: string[] = [];
  const sessions: Session[] = [];

  const seenSessionIds = new Set<string>();
  const sessionIndexByDuplicateKey = new Map<string, number>();
  const programMap = new Map<string, ProgramMaster>();
  const facilitatorSet = new Set<string>();
  const geoSet = new Set<string>();
  const fileNames = new Set<string>();

  for (const row of rawRows) {
    const programName = clean(row.programName);
    if (!programName) {
      warnings.push(`Row ${row.source.rowNumber ?? "?"}: skipped (missing Program Name).`);
      continue;
    }

    if (isCapabilityHeading(programName, row)) {
      warnings.push(`Row ${row.source.rowNumber ?? "?"}: skipped capability heading-like row.`);
      continue;
    }

    const objectives = clean(row.objectives);
    const formatDuration = clean(row.formatDuration);
    const facilitator = clean(row.facilitator);
    const scheduleRaw = row.scheduleRaw == null ? undefined : String(row.scheduleRaw).replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim() || undefined;
    const location = clean(row.location);
    const targetAudience = clean(row.targetAudience);
    const geo = normalizeGeo(row.geo);
    const notes = clean(row.notes);

    const dateISO = parseBestEffortDate(scheduleRaw, 2026);
    const registrationLink = extractUrl(row.registrationLink ?? undefined);
    const batchSize = parseBatchSize(row.batchSize ?? undefined);
    const deliveryMode = inferDeliveryMode(formatDuration, location);

    const baseId = makeStableId(programName, dateISO, geo);
    const duplicateKey = makeSessionDuplicateKey({
      baseId,
      facilitator,
      location,
      targetAudience,
      scheduleRaw,
      batchSize,
    });

    const draftSession: Omit<Session, "id"> = {
      programName,
      objectives,
      formatDuration,
      deliveryMode,
      facilitator,
      scheduleRaw,
      dateISO,
      geo,
      location,
      targetAudience,
      batchSize,
      registrationLink,
      notes,
      source: {
        type: row.source.type,
        fileName: row.source.fileName,
        sheetName: row.source.sheetName,
        rowNumber: row.source.rowNumber,
      },
    };

    const existingIndex = sessionIndexByDuplicateKey.get(duplicateKey);
    if (existingIndex !== undefined) {
      sessions[existingIndex] = mergeSessionDetails(sessions[existingIndex], draftSession);
      warnings.push(
        `Row ${row.source.rowNumber ?? "?"}: duplicate session row merged into "${sessions[existingIndex].id}".`
      );

      if (row.source.fileName) fileNames.add(row.source.fileName);
      continue;
    }

    const id = makeUniqueSessionId(baseId, row, seenSessionIds);
    if (id !== baseId) {
      warnings.push(
        `Row ${row.source.rowNumber ?? "?"}: duplicate session id \"${baseId}\" resolved to \"${id}\".`
      );
    }

    sessions.push({ id, ...draftSession });
    sessionIndexByDuplicateKey.set(duplicateKey, sessions.length - 1);

    if (row.source.fileName) fileNames.add(row.source.fileName);

    const key = programName.toLowerCase();
    if (!programMap.has(key)) {
      programMap.set(key, {
        programName,
        objectives,
        formatDuration,
        defaultFacilitator: facilitator,
      });
    }

    if (facilitator) facilitatorSet.add(facilitator);
    if (geo) {
      geo.split(",").map((g) => g.trim()).filter(Boolean).forEach((g) => geoSet.add(g));
    }
  }

  const programs = Array.from(programMap.values()).sort((a, b) => a.programName.localeCompare(b.programName));
  const facilitators = Array.from(facilitatorSet).sort().map((name) => ({ name }));
  const geos = Array.from(geoSet).sort().map((geoName) => ({ geoName }));

  const metadata: ImportMetadata = {
    importedAt: options?.importedAtISO ?? new Date().toISOString(),
    fileNames: Array.from(fileNames),
    sessionCount: sessions.length,
    programCount: programs.length,
    facilitatorCount: facilitators.length,
    geoCount: geos.length,
    holidayCount: options?.holidays?.length ?? 0,
    warnings,
  };

  return {
    sessions,
    masters: { programs, facilitators, geos },
    metadata,
    warnings,
  };
}
