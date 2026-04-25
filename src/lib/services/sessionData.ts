import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Session } from "@/types";
import { relatednessScore } from "@/lib/utils/dataUtils";

async function readSessionsJson(): Promise<Session[]> {
  const filePath = path.join(process.cwd(), "public", "data", "sessions.json");
  try {
    const raw = await readFile(filePath, "utf-8");
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? (data as Session[]) : [];
  } catch {
    return [];
  }
}

export async function getAllSessions(): Promise<Session[]> {
  return readSessionsJson();
}

export async function getSessionById(id: string): Promise<Session | undefined> {
  const sessions = await readSessionsJson();
  return sessions.find((s) => s.id === id);
}

export async function getRelatedSessions(sessionId: string, limit = 4): Promise<Session[]> {
  const sessions = await readSessionsJson();
  const source = sessions.find((s) => s.id === sessionId);
  if (!source) return [];

  return sessions
    .filter((s) => s.id !== sessionId)
    .map((session) => ({ session, score: relatednessScore(source, session) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.session);
}
