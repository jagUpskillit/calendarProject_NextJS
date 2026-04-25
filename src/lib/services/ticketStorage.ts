"use client";

import type { CreateTicketInput, SupportTicket, TicketStatus } from "@/types";

const STORAGE_KEY = "calendarproject_v1_support_tickets";

function safeRead(): SupportTicket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SupportTicket[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(tickets: SupportTicket[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}

export function getAllTickets(): SupportTicket[] {
  return safeRead().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createTicket(input: CreateTicketInput): SupportTicket {
  const ticket: SupportTicket = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    sessionId: input.sessionId,
    sessionName: input.sessionName,
    issueType: input.issueType,
    description: input.description.trim(),
    userEmail: input.userEmail?.trim() || undefined,
    status: "Open",
  };

  const all = safeRead();
  all.push(ticket);
  safeWrite(all);
  return ticket;
}

export function updateTicketStatus(id: string, status: TicketStatus): SupportTicket[] {
  const all = safeRead().map((t) => (t.id === id ? { ...t, status } : t));
  safeWrite(all);
  return all;
}

export function deleteTicket(id: string): SupportTicket[] {
  const all = safeRead().filter((t) => t.id !== id);
  safeWrite(all);
  return all;
}
